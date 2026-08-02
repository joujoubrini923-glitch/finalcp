/* Empty-database page render test */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = require('path').join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const t = String(e.detail && e.detail.message || e.message || e); if (!/not implemented/i.test(t)) errors.push(t); });
vc.on('error', (m) => errors.push(String(m)));
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
for (const s of ['icons.js','utils.js','store.js','charts.js','views.js','admin.js','app.js']) window.eval(fs.readFileSync(path.join(ROOT,'js',s),'utf8'));
const nav = (h) => { window.location.hash = h; window.dispatchEvent(new window.HashChangeEvent('hashchange')); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  await sleep(40);
  const Store = window.Store; Store.load(); Store.eraseContent(); Store.settings().topics = []; // extreme case
  const routes = ['#/','#/students','#/groups','#/leaderboard','#/problems','#/contests','#/achievements','#/analytics','#/admin'];
  for (const r of routes) { nav(r); await sleep(25); if (!window.document.querySelector('#app').innerHTML.trim()) { console.error('FAIL blank page:', r); process.exit(1);} console.log('ok  : rendered empty', r); }
  // also profile of missing student & empty admin tabs
  nav('#/admin/students'); await sleep(25); console.log('ok  : admin students empty');
  nav('#/admin/solves'); await sleep(25); console.log('ok  : admin solves empty');
  nav('#/admin/contests'); await sleep(25); console.log('ok  : admin contests empty');
  nav('#/admin/settings'); await sleep(25); console.log('ok  : admin settings empty');
  nav('#/admin/data'); await sleep(25); console.log('ok  : admin data empty');
  Store.resetDemo();
  console.log(errors.length === 0 ? 'EMPTY-DB TESTS PASSED, zero errors' : 'ERRORS: ' + errors.join(' | '));
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('CRASH:', e); process.exit(1); });
