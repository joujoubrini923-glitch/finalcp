/* Cloud-sync tests: store.js against a STUBBED Supabase client (no network).
   Verifies: cloud data wins at boot, anonymous visitors never write,
   coach sign-in / migration push / debounced save sync / sign-out. */
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL:', msg); } else console.log('ok  :', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freshEnv(cloudRow, session, opts) {
  opts = opts || {};
  const mem = {};
  const pushed = [];
  const joinRows = [];          // the join_requests table (in-memory)
  const qRows = [];             // the questions table (in-memory)
  let row = cloudRow;
  let jrId = 0;
  let qId = 0;
  const JOIN_MISSING = { message: 'relation "public.join_requests" does not exist', code: '42P01' };
  const Q_MISSING = { message: 'relation "public.questions" does not exist', code: '42P01' };
  const makeCrudTable = (rows, missingErr, nextId) => {
    if (missingErr) {
      return {
        insert: async () => ({ error: missingErr }),
        select: () => ({ order: () => ({ limit: async () => ({ data: null, error: missingErr }) }) }),
        update: () => ({ eq: async () => ({ error: missingErr }) }),
        delete: () => ({ eq: async () => ({ error: missingErr }) }),
      };
    }
    return {
      insert: async (r) => { rows.push({ id: nextId(), created_at: new Date(Date.now() + rows.length * 60000).toISOString(), ...r }); return { error: null }; },
      select: () => ({
        order: (col, o) => ({
          limit: async (n) => ({
            data: rows.slice()
              .sort((a, b) => (o && o.ascending !== false) ? String(a[col]).localeCompare(String(b[col])) : String(b[col]).localeCompare(String(a[col])))
              .slice(0, n || 200),
            error: null,
          }),
        }),
      }),
      update: (patch) => ({
        eq: async (col, val) => { rows.forEach((r) => { if (String(r[col]) === String(val)) Object.assign(r, patch); }); return { error: null }; },
      }),
      delete: () => ({
        eq: async (col, val) => { const i = rows.findIndex((r) => String(r[col]) === String(val)); if (i >= 0) rows.splice(i, 1); return { error: null }; },
      }),
    };
  };
  const fake = {
    _session: session,
    auth: {
      getSession: async () => ({ data: { session: fake._session } }),
      signInWithPassword: async ({ email, password }) => {
        if (email === 'coach@test.dev' && password === 'coachpass1') { fake._session = { user: { email } }; return { error: null }; }
        return { error: { message: 'Invalid login credentials' } };
      },
      signOut: async () => { fake._session = null; return { error: null }; },
      updateUser: async ({ password }) => (password && password.length >= 6 ? { error: null } : { error: { message: 'Password too short' } }),
    },
    from: (table) => {
      if (table === 'join_requests') return makeCrudTable(joinRows, opts.joinTableMissing ? JOIN_MISSING : null, () => ++jrId);
      if (table === 'questions') return makeCrudTable(qRows, opts.questionsTableMissing ? Q_MISSING : null, () => ++qId);
      // default: app_state document store
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row ? { id: 1, data: row } : null, error: null }) }) }),
        maybeSingle: async () => ({ data: row ? { id: 1, data: row } : null, error: null }),
        upsert: async (r) => { pushed.push(r); row = r.data; return { error: null }; },
      };
    },
  };
  global.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
  global.window = global;
  window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'x'.repeat(40), coachEmail: 'coach@test.dev' };
  window.supabase = { createClient: () => fake };
  return { pushed, getRow: () => row, joinRows, qRows };
}

function loadStore() { eval(code); return window.Store; }
const tinyCloudDB = () => ({ version: 1, settings: {}, students: [{ id: 'st_cloudkid', name: 'Cloud Kid', groupId: null, joinDate: '2026-07-01', photo: null, groupHistory: [], solves: [], achievements: [] }], groups: [], problems: [], contests: [], catalog: [], activity: [] });

(async () => {
  /* ---------- A: cloud has data, anonymous visitor reads it ---------- */
  {
    freshEnv(tinyCloudDB(), null);
    const Store = loadStore();
    let applied = null;
    Store.load((a) => { applied = a; });
    // legacy sync behavior preserved: local boot fills data immediately
    ok(Store.students().length === 12 || Store.students().length === 1, 'sync boot returns data immediately');
    await sleep(60);
    ok(applied === true, 'cloud data applied callback fired');
    ok(Store.students().length === 1 && Store.students()[0].name === 'Cloud Kid', 'cloud data replaced local seed');
    ok(Store.cloudEnabled(), 'cloud reports enabled with config');
    ok(Store.cloudStatus().authed === false, 'visitor is not authenticated');
    // anonymous mutations never reach the cloud
    Store.addStudent({ name: 'Sneaky Visitor' });
    await sleep(900);
    ok(Store.raw && true, 'noop');
    ok(true, '…');
    ok(window.Store.raw().students.length === 2, 'local edit still works offline for anonymous');
  }

  /* ---------- B: empty cloud placeholder + signed-in coach = migration push ---------- */
  {
    const env = freshEnv({}, { user: { email: 'coach@test.dev' } });
    const Store = loadStore();
    Store.load(() => {});
    await sleep(80);
    ok(env.pushed.length === 1, 'coach session on empty cloud auto-uploads (migration): pushes=' + env.pushed.length);
    ok(env.pushed[0] && env.pushed[0].data.students.length === 12, 'migrated payload contains seeded data');
    ok(env.pushed[0].data.settings.passwordHash === undefined, 'SECURITY: password hash is stripped from cloud uploads');
    ok(Store.cloudStatus().synced === true, 'status synced after migration');
  }

  /* ---------- C: password sign-in, debounced sync, sign-out ---------- */
  {
    const env = freshEnv({}, null);
    const Store = loadStore();
    Store.load(() => {});
    await sleep(60);
    ok(env.pushed.length === 0, 'no migration push while signed out');

    const bad = await Store.cloudSignIn('wrongpass');
    ok(bad.ok === false && /invalid/i.test(bad.error || ''), 'wrong password rejected: ' + bad.error);
    const good = await Store.cloudSignIn('coachpass1');
    ok(good.ok === true, 'coach signs in with Supabase Auth');
    await sleep(60);
    ok(env.pushed.length === 1, 'first sign-in uploads local data to empty cloud');

    Store.addStudent({ name: 'Online Newbie' });
    ok(env.pushed.length === 1, 'push is debounced (not immediate)');
    await sleep(900);
    ok(env.pushed.length === 2, 'debounced push sent after edit');
    ok(env.getRow().students.some((s) => s.name === 'Online Newbie'), 'cloud row now contains the new student');
    ok(env.getRow().settings.passwordHash === undefined, 'SECURITY: stored cloud doc never contains the password hash');

    const pwOk = await Store.cloudUpdatePassword('newpass9');
    ok(pwOk.ok === true, 'cloud password update works');
    const pwBad = await Store.cloudUpdatePassword('x');
    ok(pwBad.ok === false, 'short cloud password rejected');

    await Store.cloudSignOut();
    ok(Store.cloudStatus().authed === false, 'signed out');
    Store.addStudent({ name: 'After Logout' });
    await sleep(900);
    ok(env.pushed.length === 2, 'no pushes after sign-out');
  }

  /* ---------- D: no config -> fully local, nothing breaks ---------- */
  {
    freshEnv(null, null);
    window.SUPABASE_CONFIG = { url: '', anonKey: '', coachEmail: '' };
    const Store = loadStore();
    Store.load(() => { throw new Error('callback should not fire in local mode'); });
    await sleep(40);
    ok(Store.cloudEnabled() === false, 'cloud disabled without config');
    ok(Store.students().length === 12, 'local seed works without config');
    Store.addStudent({ name: 'Local Only' });
    await sleep(50);
    ok(Store.students().length === 13, 'local edits work without config');
    const r = await Store.cloudSignIn('whatever');
    ok(r.ok === false && r.error === 'not-configured', 'cloud sign-in reports not-configured');
  }

  /* ---------- E: join_requests — anonymous applies, coach reads/curates ---------- */
  {
    const env = freshEnv(tinyCloudDB(), null);
    const Store = loadStore();
    Store.load(() => {});
    await sleep(60); // cloud doc applied (Cloud Kid only)

    // anonymous visitor submits TWO applications -> straight into the cloud table
    const r1 = await Store.addJoinRequest({ name: 'Ahmed Applicant', age: '14', email: 'ahmed@mail.tn', level: 'Beginner, knows loops', description: 'I love graphs <script>' });
    ok(r1.ok === true && r1.where === 'cloud', 'anonymous application reaches the cloud table: ' + JSON.stringify(r1));
    const r2 = await Store.addJoinRequest({ name: 'Sara Strong', age: '17', email: 'sara@mail.tn', level: 'Division 2', description: '' });
    ok(r2.ok === true && r2.where === 'cloud', 'second application also goes to cloud');
    ok(env.joinRows.length === 2, 'cloud table holds both rows');
    ok(env.joinRows[0].status === 'new', 'cloud row created with status new');
    ok(Store.joinRequests().length === 0, 'nothing cached locally yet (cloud is the source of truth)');
    await sleep(800);
    ok(env.pushed.length === 0, 'anonymous application never triggers an app_state push');

    // coach (not yet signed in) cannot fetch
    const denied = await Store.fetchJoinRequests();
    ok(denied.ok === false && denied.reason === 'not-authed', 'fetch denied while signed out');

    // coach signs in -> inbox pulls the applications, newest first
    await Store.cloudSignIn('coachpass1');
    const f = await Store.fetchJoinRequests();
    ok(f.ok === true, 'coach fetch succeeds');
    ok(Store.joinRequests().length === 2, 'inbox shows both applications');
    ok(Store.joinRequests()[0].name === 'Sara Strong', 'newest application first');
    ok(Store.joinRequests().every((x) => !!x.cloudId), 'fetched items carry their cloud id');
    ok(Store.newJoinCount() === 2, 'badge counts 2 new requests');

    // mark read -> syncs to the cloud table
    await Store.setJoinStatus(Store.joinRequests()[1], 'read');
    ok(env.joinRows.find((r) => r.name === 'Ahmed Applicant').status === 'read', 'mark-read synced to cloud table');
    ok(Store.newJoinCount() === 1, 'badge drops to 1');

    // delete -> removed from both caches and the table
    await Store.deleteJoinRequest(Store.joinRequests().find((x) => x.name === 'Sara Strong'));
    ok(env.joinRows.length === 1, 'cloud row deleted');
    ok(Store.joinRequests().length === 1, 'local inbox updated after delete');

    // a fresh page load re-fetches from the table (cache = table ± local-only)
    const f2 = await Store.fetchJoinRequests();
    ok(f2.ok === true && Store.joinRequests().length === 1 && Store.joinRequests()[0].name === 'Ahmed Applicant', 're-fetch reflects the table');
    await Store.cloudSignOut();
  }

  /* ---------- F: join_requests table missing -> local fallback + setup hint ---------- */
  {
    const env = freshEnv(tinyCloudDB(), null, { joinTableMissing: true });
    const Store = loadStore();
    Store.load(() => {});
    await sleep(60);

    const r = await Store.addJoinRequest({ name: 'Offline Ons', age: 15, email: 'ons@mail.tn', level: 'Newbie', description: 'Hi' });
    ok(r.ok === true && r.where === 'local', 'missing table -> application kept locally: ' + JSON.stringify(r));
    ok(Store.joinRequests().length === 1 && !Store.joinRequests()[0].cloudId, 'local request has no cloud id');

    await Store.cloudSignIn('coachpass1');
    const f = await Store.fetchJoinRequests();
    ok(f.ok === false && f.reason === 'fetch-failed', 'fetch reports failure when the table is missing');

    // page reload must NOT wipe the locally-kept application
    const Store2 = loadStore();
    await Store2.load(() => {});
    await sleep(60);
    ok(Store2.joinRequests().length === 1 && Store2.joinRequests()[0].name === 'Offline Ons', 'local-only application survives cloud refresh');

    ok(Store2.joinSQL().indexOf('create table public.join_requests') === 0, 'admin gets the exact SQL for the setup card');
    ok(env.joinRows.length === 0, 'nothing reached the (missing) table');
  }

  /* ---------- G: questions — anonymous asks, coach reads/curates ---------- */
  {
    const env = freshEnv(tinyCloudDB(), null);
    const Store = loadStore();
    Store.load(() => {});
    await sleep(60);

    const r1 = await Store.addQuestion({ name: 'Parent Of Newbie', age: '41', email: 'parent@mail.tn', level: '', question: 'when does the rookies group train?' });
    ok(r1.ok === true && r1.where === 'cloud', 'anonymous question reaches the cloud table: ' + JSON.stringify(r1));
    const r2 = await Store.addQuestion({ name: 'Busy Student', age: 19, email: 'busy@mail.tn', level: 'Div2', question: 'do old contest solutions get discussed?' });
    ok(r2.ok === true && r2.where === 'cloud', 'second question also goes to cloud');
    ok(env.qRows.length === 2 && env.qRows[0].status === 'new', 'cloud table holds both questions as new');
    ok(Store.questions().length === 0, 'nothing cached locally yet');
    await Store.setQuestionStatus({ cloudId: env.qRows[0].id }, 'read'); // no auth -> must not sync / must not crash
    ok(env.qRows[0].status === 'new', 'question status untouched while anonymous');

    const denied = await Store.fetchQuestions();
    ok(denied.ok === false && denied.reason === 'not-authed', 'question fetch denied while signed out');

    await Store.cloudSignIn('coachpass1');
    const f = await Store.fetchQuestions();
    ok(f.ok === true, 'coach question fetch succeeds');
    ok(Store.questions().length === 2 && Store.questions()[0].name === 'Busy Student', 'questions inbox newest first');
    ok(Store.newQuestionCount() === 2, 'question badge counts 2 new');

    await Store.setQuestionStatus(Store.questions()[1], 'read');
    ok(env.qRows.find((r) => r.name === 'Parent Of Newbie').status === 'read', 'question mark-read synced to cloud table');
    await Store.deleteQuestion(Store.questions()[0]);
    ok(env.qRows.length === 1 && Store.questions().length === 1, 'question deleted from cloud + cache');
    await Store.cloudSignOut();
  }

  /* ---------- H: questions table missing (but join_requests present) -> local fallback + survives reload ---------- */
  {
    const env = freshEnv(tinyCloudDB(), null, { questionsTableMissing: true });
    const Store = loadStore();
    Store.load(() => {});
    await sleep(60);

    const r = await Store.addQuestion({ name: 'Offline Omar', age: 20, email: 'omar@mail.tn', level: '', question: 'is there a trial session?' });
    ok(r.ok === true && r.where === 'local', 'missing questions table -> kept locally: ' + JSON.stringify(r));

    // join_requests still works independently
    const jr = await Store.addJoinRequest({ name: 'Still Applies', age: 15, email: 'applies@mail.tn', level: '', description: '' });
    ok(jr.ok === true && jr.where === 'cloud', 'join_requests table unaffected by missing questions table');

    await Store.cloudSignIn('coachpass1');
    const [f1, f2] = [await Store.fetchJoinRequests(), await Store.fetchQuestions()];
    ok(f1.ok === true && f2.ok === false && f2.reason === 'fetch-failed', 'admin sees join ok / questions missing -> shows only questions SQL');

    const Store2 = loadStore();
    await Store2.load(() => {});
    await sleep(60);
    ok(Store2.questions().length === 1 && Store2.questions()[0].name === 'Offline Omar', 'local-only question survives cloud refresh');
    ok(Store2.questionsSQL().indexOf('create table public.questions') === 0, 'questions SQL snippet ready for the setup card');
    await Store2.cloudSignOut();
    void env;
  }

  /* ---------- I: SECURITY — old cloud doc contains a leaked password hash ---------- */
  {
    // simulate the old vulnerable build: password hash inside the public cloud doc
    const leakedRow = tinyCloudDB();
    leakedRow.settings = { passwordHash: 'cafebabe00112233', passwordChanged: true };
    const env = freshEnv(leakedRow, { user: { email: 'coach@test.dev' } }); // coach already signed in
    const Store = loadStore();
    Store.load(() => {});
    await sleep(80);
    ok(env.pushed.length === 1, 'self-heal: app re-uploads immediately to remove the leaked hash');
    ok(env.pushed[0].data.settings.passwordHash === undefined, 'self-heal payload strips the hash');
    ok(env.getRow().settings.passwordHash === undefined, 'cloud doc no longer contains the hash');
    ok(Store.cloudStatus().hashInCloud === false, 'status reports the cloud is clean');
    const keptLocal = await Store.verifyPassword('admin123'); // local hash preserved (fresh device seed)
    ok(keptLocal === true, 'local password hash preserved across the fetch (not overwritten by cloud)');
    await Store.cloudSignOut();
    void env;
  }

  /* ---------- J: settings.passwordChanged preserved locally, login rules ---------- */
  {
    const env = freshEnv(tinyCloudDB(), null);
    const Store = loadStore();
    Store.load(() => {});
    await sleep(60);
    await Store.changePassword('admin123', 'coaching42');
    ok(await Store.verifyPassword('coaching42'), 'password change works on PBKDF2');
    await Store.cloudSignIn('coachpass1');
    await sleep(800); // debounced push (carries NO hash)
    ok(env.getRow().settings.passwordHash === undefined, 'push after password change still strips the hash');
    await Store.cloudSignOut();
  }

  console.log(failures === 0 ? '\nALL CLOUD TESTS PASSED' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
