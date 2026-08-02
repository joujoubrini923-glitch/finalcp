/* Full integration test: boots the real app in jsdom and walks every page + admin flows */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = require('path').join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

const errors = [];
const { VirtualConsole } = require('jsdom');
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const t = String(e.detail && e.detail.message || e.message || e);
  if (/not implemented/i.test(t)) return; // scrollTo etc.
  errors.push(t);
});
vc.on('error', (m) => errors.push(String(m)));

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
// load scripts in order (outside-only -> we eval them in window context manually)
const scripts = ['icons.js', 'utils.js', 'store.js', 'charts.js', 'views.js', 'admin.js', 'app.js'];
for (const s of scripts) {
  const code = fs.readFileSync(path.join(ROOT, 'js', s), 'utf8');
  window.eval(code);
}
// boot() runs on DOMContentLoaded — jsdom already parsed; readyState is 'complete' by now, app.js boots immediately.

const $ = (sel) => window.document.querySelector(sel);
const $$ = (sel) => Array.from(window.document.querySelectorAll(sel));
const nav = (hash) => { window.location.hash = hash; window.dispatchEvent(new window.HashChangeEvent('hashchange')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(50);

  /* ---------- HOME ---------- */
  ok($('.hero h1'), 'home hero rendered');
  ok($$('.stats-row .stat-tile').length === 4, 'home has 4 stat tiles');
  ok($$('#home-featured .student-card').length === 3, 'home featured 3 students');
  ok($('.terminal'), 'leaderboard terminal rendered');
  ok($$('.timeline .tl-item').length >= 5, 'activity timeline populated: ' + $$('.timeline .tl-item').length);
  ok($$('.ladder .ladder-step').length === 10, 'level ladder shows 10 levels');
  ok($('.coach-card'), 'coach section rendered on home');
  ok($$('.coach-ach .ach-row .ach-icon').length >= 3, 'coach achievement icons shown');
  ok($$('.coach-ach .ach-name').length >= 3, 'coach achievement names readable next to icons');
  ok(!$('.coach-card a[href="#/achievements"]'), 'coach card has no achievements link');

  /* ---------- CHART FIX STRESS: many same-day events ---------- */
  window.eval(`(() => {
    const S = window.Store;
    const probs = S.problems().slice(0, 12);
    probs.forEach((p, i) => S.setSolve(S.students()[i % 12 < 4 ? 0 : i % 8].id, p.id, true, new Date().toISOString().slice(0,10)));
  })()`);
  nav('#/analytics'); await sleep(30);
  const growthOk = window.eval(`(() => {
    const pts = window.Store.academyScoreGrowth();
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].t < pts[i-1].t || pts[i].y < pts[i-1].y) return false;
      if (!isFinite(pts[i].t) || !isFinite(pts[i].y)) return false;
    }
    const days = new Set(pts.map(p => new Date(p.t).toISOString().slice(0,10)));
    return days.size === pts.length;
  })()`);
  ok(growthOk, 'growth chart data monotonic, finite, one point per day (stress)');
  ok($('#an-growth svg .ch-line'), 'growth chart still rendered after stress');
  window.Store.restoreDemo ? window.Store.restoreDemo() : window.Store.factoryReset();
  nav('#/'); await sleep(30);

  /* ---------- CHART HARDENING: out-of-order / duplicate / NaN points ---------- */
  const hardOk = window.eval(`(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const day = 86400000, t0 = Date.UTC(2026, 6, 16);
    window.Charts.line(div, { series: [{ name: 'S', points: [
      { t: t0 + 14 * day, y: 170 },   // deliberately out of order
      { t: t0,            y: 120 },
      { t: t0 + 14 * day, y: 0 },     // duplicate timestamp
      { t: NaN,           y: 999 },   // invalid
    ] }] });
    const p = div.querySelector('.ch-line');
    if (!p) { div.remove(); return false; }
    const nums = p.getAttribute('d').trim().split(/[MLZ ]+/).filter(Boolean).map(Number);
    let mono = nums.length >= 4 && nums.every((n) => isFinite(n));
    for (let i = 3; i < nums.length; i += 2) if (nums[i - 2] > nums[i]) mono = false; // x never decreases
    const dots = div.querySelectorAll('.ch-dot').length;
    div.remove();
    return mono && dots === 2;
  })()`);
  ok(hardOk, 'chart layer sorts out-of-order points, drops NaN, collapses duplicate timestamps');
  ok(!$('#footer').textContent.includes('Open-source'), 'footer tagline removed');

  /* ---------- STUDENTS ---------- */
  nav('#/students'); await sleep(20);
  ok($$('#students-grid .student-card').length === 12, 'students page lists 12 cards');
  const q = $('#f-q'); q.value = 'yasmine'; q.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(20);
  ok($$('#students-grid .student-card').length === 1, 'student search filters to 1');
  q.value = ''; q.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(20);
  const gf = $('#f-group'); gf.value = 'g_elite'; gf.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(20);
  ok($$('#students-grid .student-card').length === 4, 'group filter shows 4 elite students');

  /* ---------- PROFILE ---------- */
  nav('#/student/st_yasmine'); await sleep(20);
  ok($('.profile-head') && $('.ph-name').textContent.includes('Yasmine'), 'profile renders name');
  ok($$('#ch-score svg').length === 1, 'score growth chart svg rendered');
  ok($$('#ch-solved svg').length === 1, 'solved history chart rendered');
  ok($$('#ch-contest svg').length === 1, 'contest performance chart rendered');
  ok($$('.topic-row').length === 16, 'topic mastery lists 16 topics');
  ok($$('.topic-row.mastered').length >= 10, 'mastered topics highlighted: ' + $$('.topic-row.mastered').length);
  ok($$('.ach-card').length === 7, 'achievement cards shown (7)');
  ok(/#1/.test($('.ph-meta').textContent), 'profile shows global rank #1');
  ok($('.level-legend'), 'legend level chip styled');

  /* ---------- GROUPS ---------- */
  nav('#/groups'); await sleep(20);
  ok($$('#groups-grid .card').length === 3, 'groups page lists 3 cards');
  nav('#/group/g_rookies'); await sleep(20);
  ok($('.profile-head') && $('.ph-name').textContent.includes('Rookies'), 'group detail header');
  ok($$('.table tbody tr').length >= 3, 'group leaderboard rows');
  ok($('#ch-group svg'), 'group growth chart rendered');

  /* ---------- LEADERBOARD ---------- */
  nav('#/leaderboard'); await sleep(20);
  ok($$('.podium .pd-slot').length === 3, 'podium shows top 3');
  const lbRows = $$('.table tbody tr');
  ok(lbRows.length === 12, 'leaderboard lists 12 students');
  const firstScore = lbRows[0].querySelector('td:last-child').textContent;
  ok(firstScore.includes('2.8k') || Number(firstScore) > 2000, 'top score first: ' + firstScore);
  // group tab switch
  const tabs = $$('#lb-tabs button');
  tabs[1].click(); await sleep(20);
  ok($$('.table tbody tr').length === 3, 'group leaderboard filtered (Rookies=3)');

  /* ---------- PROBLEMS ---------- */
  nav('#/problems'); await sleep(20);
  const probRows = $$('#problems-table tbody tr');
  ok(probRows.length >= 60, 'problem library lists problems: ' + probRows.length);
  const df = $('#f-diff'); df.value = 'hard'; df.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(20);
  const hardRows = $$('#problems-table tbody tr');
  ok(hardRows.length === 14, 'hard filter works: ' + hardRows.length);
  ok(hardRows[0].innerHTML.includes('tag-hard'), 'difficulty tags rendered');

  /* ---------- HALL OF FAME ---------- */
  nav('#/contests'); await sleep(20);
  ok($$('#contests-list .contest-card').length === 6, 'hall of fame lists 6 contests');
  ok($$('.podium').length === 6, 'each contest has a podium');

  /* ---------- ACHIEVEMENTS ---------- */
  nav('#/achievements'); await sleep(20);
  ok($$('.ach-card').length === 17, 'achievements catalog shows 17 items');
  ok($$('.avatar-stack a').length > 5, 'holders avatars rendered');

  /* ---------- ANALYTICS ---------- */
  nav('#/analytics'); await sleep(20);
  ok($('#an-growth svg'), 'academy growth chart');
  ok($('#an-monthly svg'), 'monthly bars chart');
  ok($('#an-group-line svg'), 'group line chart');
  ok($$('.matrix table tbody tr').length === 16, 'topic matrix 16 rows');
  ok($('.cmp-table'), 'comparison table rendered');
  ok($('#cmp-line svg') && $('#cmp-radar svg'), 'comparison overlay + radar charts');

  /* ---------- SEARCH ---------- */
  nav('#/'); await sleep(10);
  const si = $('#global-search');
  si.value = 'yasm'; si.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(250);
  ok(!$('#search-dropdown').hidden && $('#search-dropdown .sr-item'), 'global search finds student');

  /* ---------- ADMIN LOGIN ---------- */
  nav('#/admin'); await sleep(20);
  ok($('#login-form'), 'admin shows login form');
  const pw = $('#login-pw');
  pw.value = 'wrongpass';
  $('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(20);
  ok($('#login-err').style.display === 'block', 'wrong password rejected');
  ok($('#login-form'), 'still on login screen');
  pw.value = 'admin123';
  $('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(20);
  ok($('.admin-layout'), 'dashboard rendered after login');
  ok($$('.admin-side .as-link').length >= 10, 'sidebar links rendered');

  /* ---------- ADMIN: ADD STUDENT VIA UI ---------- */
  nav('#/admin/students'); await sleep(20);
  const before = $$('#as-table tbody tr').length;
  ok(before === 12, 'students admin table has 12 rows');
  $('#as-add').click(); await sleep(20);
  ok($('.modal'), 'add student modal opens');
  $('#f-name').value = 'Test Newbie';
  const gsel = $('#f-group'); gsel.value = 'g_rookies';
  // click primary action
  const saveBtn = $$('.modal-foot .btn').find((b) => b.className.includes('btn-primary'));
  saveBtn.click(); await sleep(30);
  ok(window.Store.students().length === 13, 'student saved via modal');
  ok($$('#as-table tbody tr').length === 13, 'table refreshed with 13 rows');
  const added = window.Store.students().find((s) => s.name === 'Test Newbie');
  ok(added && added.groupHistory.length === 1, 'join records group history');

  /* ---------- ADMIN: GROUP VIA UI ---------- */
  nav('#/admin/groups'); await sleep(20);
  $('#g-add').click(); await sleep(20);
  $('#f-name').value = 'Test Group';
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-primary')).click(); await sleep(20);
  ok(window.Store.groups().some((g) => g.name === 'Test Group'), 'group created via modal');
  // move student
  const mvS = $('#mv-student'); mvS.value = added.id;
  const mvG = $('#mv-group'); mvG.value = window.Store.groups().find((g) => g.name === 'Test Group').id;
  $('#mv-go').click(); await sleep(20);
  ok(window.Store.student(added.id).groupHistory.length === 2, 'move logged in history');

  /* ---------- ADMIN: PROBLEM + SOLVE VIA UI ---------- */
  nav('#/admin/problems'); await sleep(20);
  const pBefore = window.Store.problems().length;
  $('#ap-add').click(); await sleep(20);
  $('#f-name').value = 'Test Problem';
  $('#f-topic').value = 'Dynamic Programming';
  const grpCb = $$('input[name="grp"]')[0]; if (grpCb) grpCb.checked = true;
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-primary')).click(); await sleep(20);
  ok(window.Store.problems().length === pBefore + 1, 'problem added via modal');
  const tp = window.Store.problems().find((p) => p.name === 'Test Problem');

  nav('#/admin/solves'); await sleep(20);
  ok($('#sv-problem'), 'solves tab rendered');
  // pick our problem
  const sel = $('#sv-problem');
  sel.value = tp.id; sel.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(20);
  const cb = $(`input[data-sid="${added.id}"]`);
  ok(cb, 'student listed for solving');
  const scoreBefore = window.Store.score(added.id);
  cb.checked = true; cb.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(600); // debounce
  ok(window.Store.score(added.id) > scoreBefore, 'marking solved increased score by ' + (window.Store.score(added.id) - scoreBefore));

  /* ---------- ADMIN: CONTEST VIA UI ---------- */
  nav('#/admin/contests'); await sleep(20);
  $('#c-add').click(); await sleep(20);
  $('#f-name').value = 'Test Cup';
  const r1 = $('select[data-rank="1"]'); r1.value = added.id;
  $('input[data-rank="1"]').value = '3';
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-primary')).click(); await sleep(20);
  const cup = window.Store.contests().find((c) => c.name === 'Test Cup');
  ok(cup && cup.results[0].points === window.Store.settings().contestPoints[0], 'contest recorded with baked points');
  ok(window.Store.score(added.id) === scoreBefore + tp.score + cup.results[0].points, 'contest points added to score');

  /* ---------- ADMIN: ACHIEVEMENT VIA UI (student form) ---------- */
  nav('#/admin/students'); await sleep(20);
  const editBtn = $(`[data-edit="${added.id}"]`);
  editBtn.click(); await sleep(20);
  const achCb = $$('input[name="ach"]').find((c) => !c.checked);
  achCb.checked = true;
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-primary')).click(); await sleep(30);
  ok(window.Store.achievementsOf(added.id).length === 1, 'achievement awarded via student edit');

  /* ---------- ADMIN: SETTINGS ---------- */
  nav('#/admin/settings'); await sleep(20);
  $('#pw-old').value = 'admin123';
  $('#pw-new').value = 'newsecret1';
  $('#pw-new2').value = 'newsecret1';
  $('#pw-save').click(); await sleep(20);
  ok(window.Store.verifyPassword('newsecret1'), 'password changed via settings UI');

  /* ---------- ADMIN: COACH PROFILE (achievements picked like students) ---------- */
  const coachCbs = () => $$('input[name="coach-ach"]');
  ok(coachCbs().length >= 17, 'coach achievement picker lists the catalog: ' + coachCbs().length);
  // toggle two achievements on, one pre-selected achievement off (seed coach has 3)
  coachCbs()[5].click();
  coachCbs()[9].click();
  coachCbs().find((cb) => cb.checked).click(); // uncheck an existing one
  const countChip = $('#co-ach-count');
  ok(countChip && /selected/.test(countChip.textContent), 'live selected counter works: ' + (countChip || {}).textContent);
  const expectedN = coachCbs().filter((cb) => cb.checked).length;
  $('#co-save').click(); await sleep(30);
  ok(window.Store.settings().coach.achievements.length === expectedN, 'coach achievements saved (' + expectedN + ')');
  nav('#/'); await sleep(20);
  ok($('.coach-card'), 'coach card still rendered after coach edit');
  ok($$('.coach-ach .ach-row .ach-icon').length === Math.min(8, expectedN), 'coach card shows selected achievement icons');
  ok($$('.coach-ach .ach-name').length === Math.min(8, expectedN), 'coach card shows selected achievement names');

  /* ---------- ADMIN: EXPORT / IMPORT / RESET ---------- */
  nav('#/admin/data'); await sleep(20);
  ok($('#d-export') && $('#d-import'), 'backup tab rendered');
  const dump = window.Store.exportJSON();
  ok(dump.includes('Test Newbie') && dump.includes('Test Cup'), 'export contains live data');
  // erase content
  window.Store.eraseContent();
  ok(window.Store.students().length === 0, 'erased');
  // import back
  const imp = window.Store.importJSON(JSON.parse(dump));
  ok(imp.ok && window.Store.students().length === 13, 'import restored data');
  ok(window.Store.score(added.id) > 0, 'scores intact after roundtrip');

  // old-format backup (pre-coach): must migrate on import AND on load
  const old = JSON.parse(dump);
  delete old.data.settings.coach;
  ok(window.Store.importJSON(JSON.parse(JSON.stringify(old))).ok, 'old-format backup imports');
  ok(window.Store.settings().coach && window.Store.settings().coach.name === 'Coach Abdelmajid', 'coach defaults filled after old backup import');
  window.localStorage.setItem('abdelmajidcp_db_v1', JSON.stringify(JSON.parse(JSON.stringify(old)).data));
  window.Store.load();
  ok(window.Store.settings().coach && window.Store.settings().coach.name === 'Coach Abdelmajid', 'load() migrates pre-coach database from storage');
  nav('#/'); await sleep(20);
  ok($('.coach-card'), 'coach section visible after migrating old database');
  window.Store.importJSON(JSON.parse(dump)); // restore live data for following steps

  // empty-state rendering check (public pages with 0 data)
  window.Store.eraseContent();
  nav('#/'); await sleep(20);
  ok($('.empty'), 'empty home shows beautiful empty state');
  nav('#/students'); await sleep(20);
  ok($('.empty'), 'empty students page shows empty state');
  nav('#/admin'); await sleep(20);
  ok($('.admin-layout'), 'admin still accessible with empty data');

  // restore demo
  window.Store.resetDemo();
  ok(window.Store.students().length === 12, 'demo restored');

  /* ---------- theming ---------- */
  $('#theme-toggle').click(); await sleep(30);
  ok(window.document.documentElement.getAttribute('data-theme') === 'light', 'theme toggles to light');
  $('#theme-toggle').click(); await sleep(30);
  ok(window.document.documentElement.getAttribute('data-theme') === 'dark', 'theme toggles back');

  /* ---------- 404 ---------- */
  nav('#/student/nope'); await sleep(20);
  ok($('.empty'), 'unknown profile shows 404 state');

  ok(errors.length === 0, 'zero uncaught page errors' + (errors.length ? ' → ' + errors.slice(0, 4).join(' | ') : ''));

  console.log(failures === 0 ? '\nALL INTEGRATION TESTS PASSED' : `\n${failures} FAILURES`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
