/* Test runner: unit tests always run; UI (jsdom) tests run when jsdom is installed. */
const { spawnSync } = require('child_process');

function run(name, file) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  return r.status === 0;
}

const results = [];
results.push(['unit (store data layer)', run('unit: store', 'test/smoke.js')]);
results.push(['cloud sync (stubbed supabase)', run('unit: cloud', 'test/cloud.js')]);

let hasJsdom = true;
try { require.resolve('jsdom'); } catch (e) { hasJsdom = false; }

if (hasJsdom) {
  results.push(['ui integration (jsdom)', run('ui: integration', 'test/integration.js')]);
  results.push(['ui empty-db render', run('ui: empty-db', 'test/emptydb.js')]);
} else {
  console.log('\n(skipped UI tests — install dev dependencies first: npm install)');
}

const failed = results.filter(([, ok]) => !ok);
console.log('\n----------------------------------------');
results.forEach(([n, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`));
process.exit(failed.length ? 1 : 0);
