// ─────────────────────────────────────────────────────────────────────────────
// Abdelmajid CP — cf-verify Edge Function (v1.6)
// The ONLY trusted component of the auto-verify feature. Runs on Supabase's
// servers — students and visitors CANNOT see or bypass this code.
//
//   claim        (public, rate-limited) : secret code + problem link → checks
//                 the code hash, asks the Codeforces API, verifies the solve
//                 is an ACCEPTED submission by that exact student's handle,
//                 dedupes, and records it.
//   sync         (coach only) : scans every student's recent Codeforces
//                 submissions and records accepted solves automatically.
//   code-status  (coach only) : which students have an active code.
//   set-code     (coach only) : generates a new secret code (shown ONCE —
//                 only a SHA-256 fingerprint is ever stored server-side).
//   revoke-code  (coach only) : kills a code instantly.
//
// Secrets never leave this file's environment: SUPABASE_SERVICE_ROLE_KEY is
// injected by Supabase automatically and is never sent to browsers.
// ─────────────────────────────────────────────────────────────────────────────

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const JSON_H = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: JSON_H });

/* ---------- Supabase REST helper (service key — bypasses RLS) ---------- */
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { status: r.status, body };
}

/* ---------- coach JWT check (user token from Supabase Auth) ---------- */
async function isCoach(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.includes(ANON_KEY)) return false;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: auth },
      signal: AbortSignal.timeout(6000),
    });
    return r.ok;
  } catch { return false; }
}

/* ---------- crypto ---------- */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — kid-proof
function generateCode(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(rnd).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return raw.slice(0, 4) + '-' + raw.slice(4);
}
const normalizeCode = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ---------- Codeforces ---------- */
function parseCF(raw: string): { contestId: number; index: string } | null {
  const s = String(raw || '').trim();
  let m = s.match(/codeforces\.com\/(?:problemset\/problem|contest|gym)\/(\d+)(?:\/problem)?\/([A-Za-z]\w*)/i);
  if (m) return { contestId: Number(m[1]), index: m[2].toUpperCase() };
  m = s.match(/^(\d{1,7})\s*[/\s-]\s*([A-Za-z]\w*)$/) || s.match(/^(\d{1,7})([A-Za-z]\w*)$/);
  if (m) return { contestId: Number(m[1]), index: m[2].toUpperCase() };
  return null;
}
async function cfRecent(handle: string, count: number) {
  const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${count}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
  const j = await r.json().catch(() => null);
  if (!j || j.status !== 'OK') {
    const comment = String(j && j.comment || '');
    if (/not found/i.test(comment)) return { err: 'handle-not-found' as const, subs: [] as any[] };
    return { err: 'cf-down' as const, subs: [] as any[] };
  }
  return { err: null, subs: j.result as any[] };
}

/* ---------- shared state ---------- */
async function loadDoc() {
  const r = await rest('app_state?id=eq.1&select=data');
  const doc = r.body && r.body[0] && r.body[0].data;
  return (doc && Array.isArray(doc.students)) ? doc : null;
}
function catalogMatch(doc: any, key: { contestId: number; index: string }) {
  return (doc.problems || []).find((p: any) => {
    const pk = parseCF(p && p.link || '');
    return pk && pk.contestId === key.contestId && pk.index === key.index;
  }) || null;
}
const MIN_SECS: Record<number, number> = { 5: 30, 9: 120, 13: 600, 17: 1800 }; // escalating lockout
function lockSeconds(fails: number): number {
  let lock = 0;
  for (const k of Object.keys(MIN_SECS)) if (fails >= Number(k)) lock = MIN_SECS[Number(k)];
  return lock;
}

/* ════════════════════════════ actions ════════════════════════════ */

async function actClaim(codeRaw: string, problemRaw: string) {
  const code = normalizeCode(codeRaw);
  if (code.length < 6) return reply({ ok: false, error: 'bad-code' });
  const hash = await sha256Hex(code);

  // brute-force shield (server-side, per submitted code)
  const att = await rest(`code_attempts?key=eq.${hash}&select=fails,last`);
  const attRow = att.body && att.body[0];
  if (attRow) {
    const lock = lockSeconds(attRow.fails);
    const waited = (Date.now() - new Date(attRow.last).getTime()) / 1000;
    if (lock && waited < lock) return reply({ ok: false, error: 'locked' }, 429);
  }
  const bumpFail = async () => {
    await rest('code_attempts', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: hash, fails: ((attRow && attRow.fails) || 0) + 1, last: new Date().toISOString() }),
    });
  };

  const codeRow = (await rest(`student_codes?code_hash=eq.${hash}&select=student_id`)).body;
  if (!codeRow || !codeRow[0]) { await bumpFail(); return reply({ ok: false, error: 'bad-code' }); }
  const studentId = codeRow[0].student_id;

  const doc = await loadDoc();
  if (!doc) return reply({ ok: false, error: 'offline', message: 'Academy database unavailable.' });
  const student = doc.students.find((s: any) => s.id === studentId);
  if (!student) return reply({ ok: false, error: 'no-code', message: 'Student record not found — ask the coach.' });
  if (!student.cfHandle) return reply({ ok: false, error: 'no-handle' });

  const key = parseCF(problemRaw);
  if (!key) return reply({ ok: false, error: 'bad-problem' });
  const problem = catalogMatch(doc, key);
  if (!problem) return reply({ ok: false, error: 'not-in-catalog' });

  // already counted (manual or previously verified)?
  if ((student.solves || []).some((sv: any) => sv.problemId === problem.id))
    return reply({ ok: false, error: 'already-counted' });
  const dup = await rest(`verified_solves?student_id=eq.${encodeURIComponent(studentId)}&problem_id=eq.${encodeURIComponent(problem.id)}&select=id`);
  if (dup.body && dup.body[0]) return reply({ ok: false, error: 'already-counted' });

  // ask the source of truth: Codeforces
  const { err, subs } = await cfRecent(student.cfHandle, 100);
  if (err === 'handle-not-found') return reply({ ok: false, error: 'no-handle' });
  if (err) return reply({ ok: false, error: 'cf-down' });

  const matches = (subs || []).filter((s: any) =>
    s.verdict === 'OK' && s.problem && Number(s.problem.contestId) === key.contestId &&
    String(s.problem.index).toUpperCase() === key.index);
  const sinceStr = doc.settings && doc.settings.cfSince;
  const sinceEpoch = sinceStr ? Date.parse(sinceStr + 'T00:00:00Z') / 1000 : 0;
  const fresh = sinceEpoch ? matches.filter((s: any) => (s.creationTimeSeconds || 0) >= sinceEpoch) : matches;
  if (!fresh.length) return reply({ ok: false, error: matches.length ? 'old-submission' : 'not-accepted' });
  const sub = fresh.sort((a: any, b: any) => a.creationTimeSeconds - b.creationTimeSeconds)[0];

  // record it
  const row = {
    student_id: studentId, problem_id: problem.id,
    student_name: student.name, problem_name: problem.name,
    submission_id: sub.id, contest_id: key.contestId, p_index: key.index,
    points: Number(problem.score) || 0, source: 'claim',
  };
  const ins = await rest('verified_solves', {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row),
  });
  if (ins.status === 409 || (ins.body && ins.body.code === '23505'))
    return reply({ ok: false, error: 'already-counted' });
  if (!ins.body || !ins.body[0]) return reply({ ok: false, error: 'offline', message: 'Could not save the solve.' });

  await rest(`code_attempts?key=eq.${hash}`, { method: 'DELETE' }); // clean slate after success
  await rest(`student_codes?student_id=eq.${encodeURIComponent(studentId)}`, {
    method: 'PATCH', body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  });

  return reply({
    ok: true, studentName: student.name, problemName: problem.name,
    points: row.points, row: ins.body[0],
  });
}

async function actSync(req: Request) {
  const doc = await loadDoc();
  if (!doc) return reply({ ok: false, message: 'Academy database unavailable.' });
  const sinceStr = doc.settings && doc.settings.cfSince;
  const sinceEpoch = sinceStr ? Date.parse(sinceStr + 'T00:00:00Z') / 1000 : 0;

  const students = (doc.students || []).filter((s: any) => s.cfHandle).slice(0, 50);
  if (!students.length) return reply({ ok: true, added: 0, unmatched: [], message: 'No students have a Codeforces username yet — edit a student to set it.' });

  const existing = new Set<string>(
    (doc.students || []).flatMap((s: any) => (s.solves || []).map((sv: any) => s.id + '|' + sv.problemId)),
  );
  const prev = await rest('verified_solves?select=student_id,problem_id&limit=1000');
  (prev.body || []).forEach((r: any) => existing.add(r.student_id + '|' + r.problem_id));

  const rows: any[] = [];
  const unmatched: any[] = [];
  const seenSubs = new Set<number>();
  for (const st of students) {
    const { err, subs } = await cfRecent(st.cfHandle, 40);
    if (err) continue; // skip unreachable/unknown handles silently during bulk sync
    for (const s of subs || []) {
      if (s.verdict !== 'OK' || !s.problem || seenSubs.has(s.id)) continue;
      if (sinceEpoch && (s.creationTimeSeconds || 0) < sinceEpoch) continue;
      const key = s.problem.contestId ? { contestId: Number(s.problem.contestId), index: String(s.problem.index).toUpperCase() } : null;
      if (!key) continue;
      const problem = catalogMatch(doc, key);
      if (!problem) {
        if (unmatched.length < 30) unmatched.push({
          student: st.name, name: s.problem.name || (key.contestId + key.index),
          link: /^(1\d{5,})$/.test(String(key.contestId))
            ? `https://codeforces.com/gym/${key.contestId}/problem/${key.index}`
            : `https://codeforces.com/problemset/problem/${key.contestId}/${key.index}`,
        });
        continue;
      }
      if (existing.has(st.id + '|' + problem.id)) continue;
      existing.add(st.id + '|' + problem.id); seenSubs.add(s.id);
      rows.push({
        student_id: st.id, problem_id: problem.id, student_name: st.name, problem_name: problem.name,
        submission_id: s.id, contest_id: key.contestId, p_index: key.index,
        points: Number(problem.score) || 0, source: 'sync',
      });
    }
    await new Promise((r) => setTimeout(r, 260)); // be polite to the Codeforces API
  }
  if (rows.length) {
    const ins = await rest('verified_solves', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    });
    const added = Array.isArray(ins.body) ? ins.body.length : 0;
    return reply({ ok: true, added, unmatched });
  }
  return reply({ ok: true, added: 0, unmatched });
}

async function actCodeStatus() {
  const r = await rest('student_codes?select=student_id,created_at,last_used_at');
  const students: Record<string, any> = {};
  (r.body || []).forEach((row: any) => { students[row.student_id] = { createdAt: row.created_at, lastUsedAt: row.last_used_at }; });
  return reply({ ok: true, students });
}

async function actSetCode(studentId: string) {
  studentId = String(studentId || '');
  if (!studentId) return reply({ ok: false, message: 'studentId missing' });
  const code = generateCode();
  const codeHash = await sha256Hex(normalizeCode(code));
  const r = await rest('student_codes', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ student_id: studentId, code_hash: codeHash, created_at: new Date().toISOString(), last_used_at: null }),
  });
  if (r.status >= 400) return reply({ ok: false, message: 'Could not store the code.' });
  return reply({ ok: true, code }); // plaintext shown ONCE to the coach — only the hash is stored
}

async function actRevokeCode(studentId: string) {
  await rest(`student_codes?student_id=eq.${encodeURIComponent(String(studentId || ''))}`, { method: 'DELETE' });
  return reply({ ok: true });
}

// Looks up a secret code and answers ONLY "who is this?" — the safe public
// identity check used by the Problems page to show your ✓ Solved markers.
// Same brute-force shield as claims. Nothing sensitive is returned: solve
// lists are public scoreboard data anyway.
async function actWhoAmI(codeRaw: string) {
  const code = normalizeCode(codeRaw);
  if (code.length < 6) return reply({ ok: false, error: 'bad-code' });
  const hash = await sha256Hex(code);
  const att = await rest(`code_attempts?key=eq.${hash}&select=fails,last`);
  const attRow = att.body && att.body[0];
  if (attRow) {
    const lock = lockSeconds(attRow.fails);
    const waited = (Date.now() - new Date(attRow.last).getTime()) / 1000;
    if (lock && waited < lock) return reply({ ok: false, error: 'locked' }, 429);
  }
  const codeRow = (await rest(`student_codes?code_hash=eq.${hash}&select=student_id`)).body;
  if (!codeRow || !codeRow[0]) {
    await rest('code_attempts', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: hash, fails: ((attRow && attRow.fails) || 0) + 1, last: new Date().toISOString() }),
    });
    return reply({ ok: false, error: 'bad-code' });
  }
  const doc = await loadDoc();
  const student = doc && doc.students.find((s: any) => s.id === codeRow[0].student_id);
  if (!student) return reply({ ok: false, error: 'no-code' });
  await rest(`code_attempts?key=eq.${hash}`, { method: 'DELETE' });
  return reply({ ok: true, studentId: student.id, studentName: student.name });
}

/* ════════════════════════════ entry ════════════════════════════ */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_H });
  if (req.method !== 'POST') return reply({ ok: false, message: 'POST only' }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return reply({ ok: false, message: 'Bad JSON' }, 400); }
  const action = String(body.action || '');

  if (action === 'claim') {
    return actClaim(String(body.code || ''), String(body.problem || ''));
  }
  if (action === 'whoami') {
    return actWhoAmI(String(body.code || ''));
  }
  // everything below requires the signed-in coach
  if (!(await isCoach(req))) return reply({ ok: false, message: 'Not authorized — sign in as coach.' }, 401);
  switch (action) {
    case 'sync': return actSync(req);
    case 'code-status': return actCodeStatus();
    case 'set-code': return actSetCode(body.studentId);
    case 'revoke-code': return actRevokeCode(body.studentId);
    default: return reply({ ok: false, message: 'Unknown action' }, 400);
  }
});
