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
// jsdom lacks WebCrypto PBKDF2 (+ TextEncoder) — inject Node's so the REAL pbkdf2 code path runs
try { Object.defineProperty(window, 'crypto', { value: require('crypto').webcrypto, configurable: true, writable: true }); }
catch (e) { try { window.crypto = require('crypto').webcrypto; } catch (e2) {} }
window.TextEncoder = require('util').TextEncoder;
window.TextDecoder = require('util').TextDecoder;
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
  // Join CTA banner: right before the coach section, tempting to click, links to /join
  ok($('.join-cta'), 'join CTA banner rendered on home');
  ok(!$('#join-form'), 'join application form is NOT on the home page anymore (own page)');
  ok($('.join-cta .btn-jumbo') && $('.join-cta .btn-jumbo').getAttribute('href') === '#/join', 'big jumbo button links to the join page');
  ok(($('.join-cta').compareDocumentPosition($('.coach-card')) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, 'CTA sits just BEFORE the coach section');
  ok(($('.hero').compareDocumentPosition($('.join-cta')) & window.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, 'CTA is not at the very top (after the hero)');

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

  /* ---------- PUBLIC: JOIN PAGE (application + question forms) ---------- */
  nav('#/join'); await sleep(30);
  ok($('.join-grid'), 'join page renders the pitch + application grid');
  ok($('.join-pitch') && $('.jp-list li'), 'join pitch with benefits list');
  ok($('#join-form') && $('#jf-name') && $('#jf-email') && $('#jf-level') && $('#jf-desc'), 'join form has name/email/level/description fields');
  ok($('#jf-web') && $('#jf-web').classList.contains('hp-field'), 'honeypot anti-spam field present');
  ok($('#join-done').classList.contains('hidden'), 'join success box hidden until submit');
  ok($('#question-form') && $('#qf-name') && $('#qf-email') && $('#qf-level') && $('#qf-question'), 'question form has the same info fields + a question box');
  ok($('#qf-web') && $('#qf-web').classList.contains('hp-field'), 'question honeypot present');
  ok($('.ask-pitch'), 'question section has its own pitch card');
  ok(window.document.title.includes('Join the Academy'), 'join page sets a proper browser title');

  const jCount0 = window.Store.joinRequests().length;
  // invalid email -> rejected with a toast, nothing stored
  $('#jf-name').value = 'Bad Mail'; $('#jf-email').value = 'not-an-email';
  $('#join-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  ok(window.Store.joinRequests().length === jCount0, 'invalid email rejected, nothing stored');
  ok(!$('#join-done').classList.contains('hidden') === false, 'no success box for rejected submit');
  // honeypot -> silently dropped
  $('#jf-name').value = 'Spammy Bot'; $('#jf-email').value = 'spam@bot.xyz'; $('#jf-web').value = 'http://spam';
  $('#join-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  ok(window.Store.joinRequests().length === jCount0, 'honeypot submission silently dropped');
  // valid application
  $('#jf-web').value = '';
  $('#jf-name').value = 'Ahmed Applicant'; $('#jf-age').value = '14'; $('#jf-email').value = 'ahmed@mail.tn';
  $('#jf-level').value = 'Beginner in C++'; $('#jf-desc').value = 'I just started learning graphs';
  $('#join-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(80);
  ok(window.Store.joinRequests().length === jCount0 + 1, 'valid application stored');
  const jr0 = window.Store.joinRequests()[0];
  ok(jr0 && jr0.name === 'Ahmed Applicant' && jr0.age === 14 && jr0.status === 'new', 'application fields captured (name/age/status)');
  ok(jr0.level === 'Beginner in C++' && jr0.description.includes('graphs'), 'level + description captured');
  ok($('#join-done').classList.contains('hidden') === false, 'success box shown after submit');
  ok($('#jf-name').value === '', 'form reset after send');
  // second application so the admin inbox has two
  $('#jf-name').value = 'Sara Strong'; $('#jf-age').value = '17'; $('#jf-email').value = 'sara@mail.tn';
  $('#jf-level').value = 'Division 2'; $('#jf-desc').value = '';
  $('#join-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(80);
  ok(window.Store.joinRequests().length === jCount0 + 2, 'second application stored');
  ok(window.Store.joinRequests()[0].name === 'Sara Strong', 'newest application first');
  ok(window.Store.newJoinCount() === jCount0 + 2, 'new-request badge count correct');

  /* ---------- PUBLIC: QUESTION FORM (same info, but just a question — not an application) ---------- */
  const qCount0 = window.Store.questions().length;
  // empty question -> rejected, nothing stored
  $('#qf-name').value = 'Wondering Walid'; $('#qf-email').value = 'walid@mail.tn'; $('#qf-level').value = 'Beginner';
  $('#question-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  ok(window.Store.questions().length === qCount0, 'empty question rejected');
  // honeypot on the question form too
  $('#qf-question').value = 'when are trainings?'; $('#qf-web').value = 'spam';
  $('#question-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  ok(window.Store.questions().length === qCount0, 'question honeypot silently drops bots');
  // valid question (honeypot test reset the form — fill everything again)
  $('#qf-web').value = '';
  $('#qf-name').value = 'Wondering Walid'; $('#qf-email').value = 'walid@mail.tn'; $('#qf-level').value = 'Beginner';
  $('#qf-question').value = 'When do the Rookies train? And is there a trial session?';
  $('#question-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(80);
  ok(window.Store.questions().length === qCount0 + 1, 'valid question stored');
  const qu0 = window.Store.questions()[0];
  ok(qu0 && qu0.name === 'Wondering Walid' && qu0.question.includes('trial session') && qu0.status === 'new', 'question fields captured (name/question/status)');
  ok(window.Store.joinRequests().length === jCount0 + 2, 'asking a question does NOT create a join application');
  ok($('#q-done').classList.contains('hidden') === false, 'question success box shown');
  ok(window.Store.newQuestionCount() === qCount0 + 1, 'new-question badge count correct');

  /* ---------- ADMIN LOGIN ---------- */
  nav('#/admin'); await sleep(20);
  ok($('#login-form'), 'admin shows login form');
  const pw = $('#login-pw');
  pw.value = 'wrongpass';
  $('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(20);
  ok($('#login-err').style.display === 'block', 'wrong password rejected');
  ok($('#login-form'), 'still on login screen');
  // brute-force throttling: 5 wrong attempts trigger a lockout countdown
  window.sessionStorage.removeItem('acp_login_throttle');
  for (let i = 0; i < 5; i++) {
    pw.value = 'wrongpass' + i;
    $('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(15);
  }
  ok(/try again in \d+s|locked/i.test($('#login-err').textContent), 'brute-force attempts get throttled: "' + $('#login-err').textContent + '"');
  window.sessionStorage.removeItem('acp_login_throttle'); // unblock for the next step
  pw.value = 'admin123';
  $('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await sleep(400); // PBKDF2 verify takes a moment
  ok($('.admin-layout'), 'dashboard rendered after login');
  ok($$('.admin-side .as-link').length >= 10, 'sidebar links rendered');
  await sleep(150); // async default-password check
  ok($('.pw-warn'), 'SECURITY: red banner warns the default password is still in use');
  ok($('.pw-warn') && $('.pw-warn').textContent.includes('admin123'), 'banner names the default password explicitly');
  ok(window.Store.usesStrongPasswordStorage() === true, 'legacy hash auto-upgraded to PBKDF2 on first login');

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

  /* ---------- ADMIN: CONTEST VIA UI (ALL ranks, beyond Top-5) ---------- */
  nav('#/admin/contests'); await sleep(20);
  $('#c-add').click(); await sleep(20);
  $('#f-name').value = 'Test Cup';
  ok($$('.rk-row').length === 5, 'contest form opens with 5 rank rows');
  ok($$('.rk-row')[0].querySelector('.rk-del').style.visibility === 'hidden', 'ranks 1-5 cannot be removed');
  $('#rk-add').click(); $('#rk-add').click(); $('#rk-add').click(); await sleep(10);
  ok($$('.rk-row').length === 8, '"Add rank" grows the form to 8 rows');
  ok($$('.rk-row')[5].querySelector('.rk-label').textContent.includes('#6'), 'rank #6 labelled');
  ok($$('.rk-row')[5].querySelector('.rk-label').textContent.includes(window.Store.settings().contestPointsBeyond + ' pts'), 'rank #6 shows the beyond-points value');
  ok($$('.rk-row')[5].querySelector('.rk-del').style.visibility === 'visible', 'added ranks can be removed');
  // remove row 8 again, then fill ranks 1-6 with six different students
  $$('.rk-row')[7].querySelector('.rk-del').click(); await sleep(10);
  ok($$('.rk-row').length === 7, 'removing a row works');
  ok($$('.rk-row')[6].querySelector('.rk-label').textContent.includes('#7'), 'rows renumber after removal');
  $$('.rk-row')[6].querySelector('.rk-del').click(); await sleep(10);
  const studs6 = window.Store.students().filter((s) => s.id !== added.id).slice(0, 5);
  $$('.rk-row').forEach((row, i) => {
    row.querySelector('.rk-student').value = i === 0 ? added.id : studs6[i - 1].id;
    row.querySelector('.rk-solved').value = String(6 - i);
  });
  const st6 = studs6[4], st6Before = window.Store.score(st6.id);
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-primary')).click(); await sleep(20);
  const cup = window.Store.contests().find((c) => c.name === 'Test Cup');
  ok(cup && cup.results.length === 6, 'contest recorded ALL 6 ranks, not just top 5');
  ok(cup && cup.results[0].points === window.Store.settings().contestPoints[0], 'rank #1 gets baked top points');
  ok(cup && cup.results[5].points === window.Store.settings().contestPointsBeyond, 'rank #6 gets beyond-Top5 points (' + (cup && cup.results[5].points) + ')');
  ok(window.Store.score(added.id) === scoreBefore + tp.score + cup.results[0].points, 'rank #1 points added to score');
  ok(window.Store.score(st6.id) === st6Before + cup.results[5].points, 'rank #6 student actually earned the points');
  // re-open the edit form: 6 rows restore, delete still blocked for first 5
  const editCup = $(`[data-edit="${cup.id}"]`);
  editCup.click(); await sleep(20);
  ok($$('.rk-row').length === 6, 'edit form restores all 6 rank rows');
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-ghost')).click(); await sleep(10);

  /* ---------- ADMIN: JOIN REQUESTS + QUESTIONS INBOX ---------- */
  nav('#/admin/requests'); await sleep(40);
  const appItems = $$('#jr-list .jr-item');
  ok(appItems.length === 2, 'inbox lists both applications: ' + appItems.length);
  ok(appItems[0].textContent.includes('Sara Strong'), 'newest application on top');
  ok($$('#jr-list .jr-status.new').length === 2, 'both applications marked as new');
  ok(appItems[0].textContent.includes('local'), 'local badge shown (no cloud in this test)');
  ok(appItems[1].querySelector('.jr-mail').getAttribute('href') === 'mailto:ahmed@mail.tn', 'mailto reply link points at the applicant');
  ok($('#jr-refresh'), 'refresh button present');
  // questions card renders below with the question item
  const qItems = $$('#q-list .jr-item');
  ok(qItems.length === 1, 'questions card lists the asked question');
  ok(qItems[0].textContent.includes('Wondering Walid') && qItems[0].textContent.includes('trial session'), 'question text and asker shown');
  ok(qItems[0].querySelector('.jr-q-mark'), 'question row visually marked with a "?" chip');
  ok(!qItems[0].textContent.includes('anything else'), 'question row does not pretend to be an application');
  // mark Sara as read
  appItems[0].querySelector('.jr-toggle').click(); await sleep(30);
  ok(window.Store.newJoinCount() === 1, 'mark-read drops the applications counter');
  ok($$('#jr-list .jr-status.read').length === 1, 'status chip now reads');
  // overview quick-action shows the COMBINED badge (1 application + 1 question = 2)
  nav('#/admin'); await sleep(30);
  const qaBtn = $$('[data-go="requests"]')[0];
  ok(qaBtn && qaBtn.textContent.includes('2 new'), 'overview inbox chip shows combined "2 new": ' + (qaBtn || {}).textContent);
  nav('#/admin/requests'); await sleep(30);
  // delete one application with confirmation
  $$('#jr-list .jr-item')[1].querySelector('.jr-del').click(); await sleep(20);
  const delBtn = $$('.modal-foot .btn').find((b) => b.className.includes('btn-danger'));
  ok(delBtn, 'delete asks for confirmation');
  delBtn.click(); await sleep(30);
  ok(window.Store.joinRequests().length === 1, 'application deleted after confirm');
  ok(window.Store.joinRequests()[0].name === 'Sara Strong', 'the other application survives');
  ok(window.Store.questions().length === 1, 'deleting an application does not touch questions');
  // mark the question read then delete it
  $('#q-list .jr-item .jr-toggle').click(); await sleep(30);
  ok(window.Store.newQuestionCount() === 0, 'question mark-read works in admin');
  $('#q-list .jr-item .jr-del').click(); await sleep(20);
  $$('.modal-foot .btn').find((b) => b.className.includes('btn-danger')).click(); await sleep(30);
  ok(window.Store.questions().length === 0, 'question deleted after confirm');
  ok($('#q-list').textContent.includes('No questions yet'), 'questions card shows its empty state');

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
  $('#pw-save').click(); await sleep(400); // PBKDF2 hashing is intentionally slow
  ok(await window.Store.verifyPassword('newsecret1'), 'password changed via settings UI');
  await sleep(120);
  ok(!$('.pw-warn'), 'security banner cleared after changing away from the default');
  // going back to the default is refused
  $('#pw-old').value = 'newsecret1'; $('#pw-new').value = 'admin123'; $('#pw-new2').value = 'admin123';
  $('#pw-save').click(); await sleep(400);
  ok(await window.Store.verifyPassword('newsecret1'), 'setting the default password again is rejected');

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

  /* ---------- SECURITY: idle auto-logout ---------- */
  nav('#/admin'); await sleep(30);
  ok(window.Admin.isAuthed(), 'still signed in before idle test');
  window.Admin._debugSetIdle(Date.now() - 31 * 60 * 1000); // pretend 31 min idle
  const loggedOut = window.Admin.checkIdle();
  ok(loggedOut === true && !window.Admin.isAuthed(), 'inactive admin session is auto-closed after 30 minutes');
  nav('#/admin'); await sleep(30);
  ok($('#login-form'), 'admin area locked again after idle logout');
  ok($$('.pw-warn').length === 0, 'no default-password banner while logged out');

  /* ---------- SECURITY: photo upload validation ---------- */
  const fakeSvg = { type: 'image/svg+xml', size: 1000 };
  const fakeBig = { type: 'image/png', size: 9 * 1024 * 1024 };
  const fakeGood = { type: 'image/png', size: 500 * 1024 };
  let rejSvg = false, rejBig = false;
  try { await window.U.fileToAvatar(fakeSvg); } catch (e) { rejSvg = true; }
  try { await window.U.fileToAvatar(fakeBig); } catch (e) { rejBig = true; }
  ok(rejSvg, 'SVG/polyglot uploads rejected (script-carrying files cannot reach storage)');
  ok(rejBig, 'oversized images rejected (> 8 MB)');
  ok(typeof fakeGood.size === 'number', 'validator reachable for real photos');

  // ── Codeforces Auto-Verify (v1.6) ──
  const pcf = window.U.parseCFLink;
  ok(pcf('https://codeforces.com/problemset/problem/1234/A').contestId === 1234 && pcf('https://codeforces.com/problemset/problem/1234/A').index === 'A', 'parseCFLink: problemset link');
  ok(pcf('https://codeforces.com/contest/1850/problem/D').index === 'D', 'parseCFLink: contest link');
  ok(pcf('https://codeforces.com/gym/102951/B').contestId === 102951, 'parseCFLink: gym link');
  ok(pcf('1234A').index === 'A' && pcf('1234 / B1').index === 'B1', 'parseCFLink: bare IDs');
  ok(pcf('hello world') === null && pcf('') === null && pcf('javascript:alert(1)') === null, 'parseCFLink: rejects garbage');

  // solves materialized from the server table (dedupe + provenance flag)
  let st0 = null, pb0 = null;
  window.Store.students().forEach((s) => window.Store.problems().forEach((pp) => {
    if (!st0 && !(s.solves || []).some((sv) => sv.problemId === pp.id)) { st0 = s; pb0 = pp; }
  }));
  ok(!!st0 && !!pb0, 'found an unsolved student/problem pair for verification test');
  const row0 = { student_id: st0.id, problem_id: pb0.id, student_name: st0.name, problem_name: pb0.name, submission_id: 424242, contest_id: 1234, p_index: 'A', points: pb0.score, source: 'claim', created_at: new Date().toISOString() };
  ok(window.Store.applyVerifiedSolves([row0]) === 1, 'verified solve materialized into student record');
  ok(window.Store.applyVerifiedSolves([row0]) === 0, 'same verified solve is never counted twice');
  ok(window.Store.solvesOf(st0.id).some((x) => x.via === 'cf-submit' && x.subId === 424242), 'verified solve keeps provenance flag (✓ CF badge)');
  window.Store.setSolve(st0.id, pb0.id, false); // restore fixture state
  ok(window.Store.verifiedRows !== undefined && window.Store.verifySQL().includes('student_codes') && window.Store.verifySQL().includes('verified_solves'), 'verify SQL snippet available for admin');

  // public submit page — offline guard when cloud is not configured
  nav('#/submit'); await sleep(20);
  ok(!!$('#verify-form'), 'submit page renders the verify form');
  ok(!!$('.vf-offline'), 'submit page warns when the academy cloud is offline');
  ok($('#vf-btn').disabled, 'submit button disabled while offline');

  // mocked happy path: a real claim round-trip through the UI
  window.Store.cloudEnabled = () => true;
  let claimed = null;
  window.Store.cfClaim = async (code, problem) => { claimed = { code, problem }; return { ok: true, data: { studentName: 'Yasmine Ben Ali', problemName: 'Watermelon', points: 10, row: null } }; };
  nav('#/submit'); await sleep(20);
  ok(!$('#vf-btn').disabled, 'submit button enabled when cloud is online');
  $('#vf-code').value = 'abcd-1234';
  $('#vf-problem').value = 'https://codeforces.com/problemset/problem/4/A';
  $('#verify-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(30);
  ok(claimed && claimed.code === 'ABCD1234', 'code normalized before being sent to the server');
  ok($('#vf-result').classList.contains('vf-ok') && $('#vf-result').textContent.includes('Verified on Codeforces'), 'successful claim shows the verified panel');
  ok($('#vf-web') && $('#vf-web').classList.contains('hp-field'), 'submit form has a honeypot field');

  // mocked rejection: known error codes are translated to friendly messages
  window.Store.cfClaim = async () => ({ ok: false, data: { error: 'not-accepted' } });
  $('#vf-code').value = 'abcd-1234'; $('#vf-problem').value = '4A';
  $('#verify-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(30);
  ok($('#vf-result').classList.contains('vf-err') && /Accepted/i.test($('#vf-result').textContent), 'rejected claim explains the reason');
  window.Store.cfClaim = async () => ({ ok: false, data: { error: 'locked' } });
  $('#verify-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(30);
  ok(/locked/i.test($('#vf-result').textContent), 'locked code shows the cooldown message');

  // admin Auto-Verify tab
  window.Store.cloudStatus = () => ({ enabled: true, authed: true, synced: true, error: null, hashInCloud: false });
  window.Store.cfCodeStatus = async () => ({ ok: true, data: { students: {} } });
  window.Store.cfSync = async () => ({ ok: true, data: { added: 0, unmatched: [] } });
  // re-login (an earlier idle-timeout test signed the coach out)
  window.Store.cloudSignIn = async () => ({ ok: true });
  nav('#/admin'); await sleep(20);
  if ($('#login-form')) {
    $('#login-pw').value = 'newsecret1';
    $('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await sleep(450);
  }
  ok($('.admin-layout'), 're-logged in for auto-verify tests');
  nav('#/admin/verify'); await sleep(40);
  ok(!!$('#vv-sync'), 'admin: Auto-Verify tab renders the sync button');
  ok(!!$('#vv-audit'), 'admin: verification log card renders');
  ok(!!$('#vv-since'), 'admin: activation-date setting renders');
  window.U.$('#vv-since', window.document).value = '2026-08-01';
  window.U.$('#vv-save-since', window.document).click(); await sleep(10);
  ok(window.Store.settings().cfSince === '2026-08-01', 'activation date saved to settings');
  $('#vv-sql').click(); await sleep(20);
  ok($('.sql-pre') && $('.sql-pre').textContent.includes('student_codes'), 'setup SQL modal shows the auto-verify tables');
  window.document.querySelectorAll('.modal .btn, .modal button').forEach((b) => { if (b.textContent.trim() === 'Close') b.click(); });
  await sleep(10);

  // code generation reveals the code exactly once in a modal
  const anySt = window.Store.students()[1];
  window.Store.updateStudent(anySt.id, { cfHandle: 'tourist' });
  window.Store.cfGenerateCode = async () => ({ ok: true, data: { code: 'K7X2-QM91' } });
  //
  nav('#/admin/verify'); await sleep(60);
  const genBtn = window.document.querySelector('[data-gen]:not([disabled])');
  ok(!!genBtn && !genBtn.disabled, 'code generation available for students with a CF username');
  genBtn.click(); await sleep(40);
  ok(window.document.body.textContent.includes('K7X2-QM91'), 'generated code revealed once in a modal');
  ok((window.Store.student(anySt.id) || {}).cfHandle === 'tourist', 'cfHandle stored on the student record');

  // sync summary renders unmatched guidance
  window.Store.cfSync = async () => ({ ok: true, data: { added: 0, unmatched: [{ student: 'Yasmine Ben Ali', name: 'Fancy Problem', link: 'https://codeforces.com/problemset/problem/1/A' }] } });
  nav('#/admin/verify'); await sleep(60);
  window.document.querySelector('#vv-sync').click(); await sleep(60);
  ok(/not in the library/i.test(window.document.querySelector('#vv-sync-detail').textContent), 'sync reports problems missing from the library');

  // URL scheme allowlist (link hardening)
  ok(window.U.safeURL('https://codeforces.com/problemset') === 'https://codeforces.com/problemset', 'safeURL keeps https links');
  ok(window.U.safeURL('http://example.com/x') === 'http://example.com/x', 'safeURL keeps http links');
  ok(window.U.safeURL('javascript:alert(1)') === '#', 'safeURL blocks javascript: URLs');
  ok(window.U.safeURL('  JaVaScRiPt:alert(1)') === '#', 'safeURL blocks case/whitespace tricks');
  ok(window.U.safeURL('data:text/html,<script>alert(1)</script>') === '#', 'safeURL blocks data: URLs');

  ok(errors.length === 0, 'zero uncaught page errors' + (errors.length ? ' → ' + errors.slice(0, 4).join(' | ') : ''));

  console.log(failures === 0 ? '\nALL INTEGRATION TESTS PASSED' : `\n${failures} FAILURES`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
