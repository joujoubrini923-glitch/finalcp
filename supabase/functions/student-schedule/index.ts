// Abdelmajid CP — secure student weekly availability
//
// Students authenticate with the short-lived Passport token minted by
// cf-verify. This function lets a student read/update only their own weekly
// availability for one advertisement. The browser never receives the
// service-role key.

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
};

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const reply = (data: Record<string, unknown>, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { ok: response.ok, status: response.status, body };
}

async function studentFromToken(token: string): Promise<string | null> {
  if (!token || token.length < 20 || token.length > 500) return null;
  const tokenHash = await sha256Hex(token);
  const result = await rest(`student_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&select=student_id,expires_at&limit=1`);
  const row = Array.isArray(result.body) ? result.body[0] as Record<string, unknown> | undefined : undefined;
  if (!row || new Date(String(row.expires_at || '')).getTime() < Date.now()) return null;
  return String(row.student_id || '') || null;
}

function minutes(value: unknown): number {
  const m = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return -1;
  const result = Number(m[1]) * 60 + Number(m[2]);
  return result >= 0 && result <= 24 * 60 ? result : -1;
}

function cleanAvailability(raw: unknown): Record<string, Array<{ start: string; end: string }>> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const output: Record<string, Array<{ start: string; end: string }>> = {};
  DAYS.forEach((day) => {
    const values = Array.isArray(input[day]) ? input[day] : [];
    const ranges = values.map((value) => {
      const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      return { start: String(item.start || ''), end: String(item.end || '') };
    }).filter((range) => {
      const start = minutes(range.start); const end = minutes(range.end);
      return start >= 8 * 60 && end <= 22 * 60 && start < end;
    }).slice(0, 6);
    if (ranges.length) output[day] = ranges;
  });
  return output;
}

function key(value: unknown, max = 140): string {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

async function latestRequest(studentId: string, courseAdId: string, courseLevel: string) {
  const base = `student_id=eq.${encodeURIComponent(studentId)}&order=created_at.desc&limit=1`;
  if (courseAdId) {
    const byAd = await rest(`next_course_requests?${base}&course_ad_id=eq.${encodeURIComponent(courseAdId)}&select=id,availability,course_ad_id,course_level`);
    if (byAd.ok) return { result: byAd, usedAdColumn: true };
    // This fallback keeps old projects readable until the migration adding
    // course_ad_id has been run. New projects should always use the column.
  }
  const byLevel = await rest(`next_course_requests?${base}&course_level=eq.${encodeURIComponent(courseLevel)}&select=id,availability,course_level`);
  return { result: byLevel, usedAdColumn: false };
}

async function loadStudent(studentId: string) {
  const result = await rest('app_state?id=eq.1&select=data');
  const row = Array.isArray(result.body) ? result.body[0] as Record<string, unknown> | undefined : undefined;
  const data = row && row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : {};
  const students = Array.isArray(data.students) ? data.students as Array<Record<string, unknown>> : [];
  return students.find((student) => String(student.id || '') === studentId) || null;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return reply({ ok: false, error: 'POST only' }, 405);
  if (!SB_URL || !SERVICE_KEY) return reply({ ok: false, error: 'Schedule service is not configured.' }, 500);

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { return reply({ ok: false, error: 'Bad JSON' }, 400); }
  const studentId = await studentFromToken(String(body.token || ''));
  if (!studentId) return reply({ ok: false, error: 'no-session', message: 'Your student session expired.' }, 401);

  const action = key(body.action || 'get', 20).toLowerCase();
  const courseAdId = key(body.courseAdId, 140);
  const courseLevel = key(body.courseLevel, 140);
  if (!courseLevel && !courseAdId) return reply({ ok: false, error: 'course-required' }, 400);

  try {
    const found = await latestRequest(studentId, courseAdId, courseLevel);
    if (!found.result.ok) return reply({ ok: false, error: 'Could not read your availability.' }, 502);
    const row = Array.isArray(found.result.body) ? found.result.body[0] as Record<string, unknown> | undefined : undefined;

    if (action === 'get') return reply({ ok: true, availability: cleanAvailability(row && row.availability) });
    if (action !== 'save') return reply({ ok: false, error: 'Unknown action.' }, 400);

    const availability = cleanAvailability(body.availability);
    const now = new Date().toISOString();
    if (row && row.id != null) {
      const update = await rest(`next_course_requests?id=eq.${encodeURIComponent(String(row.id))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ availability, status: 'new', created_at: now }),
      });
      if (!update.ok) return reply({ ok: false, error: 'Could not save your availability.' }, 502);
      return reply({ ok: true, updated: true, availability });
    }

    const student = await loadStudent(studentId);
    const studentName = key(student && student.name, 120) || 'Student';
    const groupId = key(student && student.groupId, 120) || null;
    const record: Record<string, unknown> = {
      student_id: studentId,
      student_name: studentName,
      group_id: groupId,
      course_level: courseLevel || courseAdId,
      availability,
      status: 'new',
    };
    if (courseAdId) record.course_ad_id = courseAdId;
    let insert = await rest('next_course_requests', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(record) });
    // Older installations may not yet have course_ad_id. They can still save
    // a level-based preference until the supplied migration is applied.
    if (!insert.ok && courseAdId && /course_ad_id|column/i.test(JSON.stringify(insert.body))) {
      delete record.course_ad_id;
      insert = await rest('next_course_requests', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(record) });
    }
    if (!insert.ok) return reply({ ok: false, error: 'Could not save your availability.' }, 502);
    return reply({ ok: true, updated: false, availability });
  } catch (error) {
    console.error('Student schedule error', error);
    return reply({ ok: false, error: 'Schedule service unavailable.' }, 502);
  }
});
