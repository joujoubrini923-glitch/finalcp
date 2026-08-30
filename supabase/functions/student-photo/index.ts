// Abdelmajid CP — secure student photo update function
// Students authenticate with the short-lived Passport token minted by cf-verify.
// The service-role key stays on Supabase and is never sent to the browser.

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

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
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { status: response.status, body };
}

async function studentFromToken(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const tokenHash = await sha256Hex(token);
  const result = await rest(`student_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&select=student_id,expires_at`);
  const row = result.body && result.body[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.student_id;
}

async function loadDocument() {
  const result = await rest('app_state?id=eq.1&select=data');
  return result.body && result.body[0] && result.body[0].data;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return reply({ ok: false, error: 'POST only' }, 405);

  let body: any = {};
  try { body = await request.json(); } catch { return reply({ ok: false, error: 'Bad JSON' }, 400); }

  const studentId = await studentFromToken(String(body.token || ''));
  if (!studentId) return reply({ ok: false, error: 'no-session', message: 'Your student session expired.' }, 401);

  const photo = String(body.photo || '').trim();
  // U.fileToAvatar produces a small raster base64 image. Reject SVG, HTML,
  // remote URLs and oversized payloads before touching the public document.
  if (photo.length > 450000 || !/^data:image\/(?:jpeg|png|webp|gif|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(photo)) {
    return reply({ ok: false, error: 'bad-photo', message: 'Only a small raster image is accepted.' }, 400);
  }

  const document = await loadDocument();
  if (!document || !Array.isArray(document.students)) return reply({ ok: false, error: 'offline' }, 503);
  const student = document.students.find((item: any) => item.id === studentId);
  if (!student) return reply({ ok: false, error: 'student-not-found' }, 404);

  student.photo = photo;
  const saved = await rest('app_state?id=eq.1', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ data: document, updated_at: new Date().toISOString() }),
  });
  if (saved.status >= 400) return reply({ ok: false, error: 'save-failed' }, 503);
  return reply({ ok: true, studentId });
});
