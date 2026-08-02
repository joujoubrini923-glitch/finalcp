/* Node smoke test for store.js (no DOM needed) */
const fs = require('fs');
const path = require('path');

// localStorage stub
const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
global.window = global;

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
eval(code);
const Store = window.Store;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

Store.load();
const db = Store.raw();

assert(db.students.length === 12, 'seed created 12 students, got ' + db.students.length);
assert(db.groups.length === 3, 'seed created 3 groups');
assert(db.problems.length >= 45, 'seed created problems: ' + db.problems.length);
assert(db.contests.length === 6, 'seed created 6 contests');
assert(db.catalog.length === 17, 'seed created 17 catalog achievements');
assert(db.activity.length > 20, 'activity log populated: ' + db.activity.length);

// topics referenced by problems exist
const topicNames = db.settings.topics.map(t => t.name);
const missing = db.problems.filter(p => !topicNames.includes(p.topic));
assert(missing.length === 0, 'all problems reference valid topics');

// group assignment sanity
db.problems.forEach(p => p.groupIds.forEach(g => assert(db.groups.some(x => x.id === g), 'problem group ref valid: ' + g)));

// scores/levels
const yas = Store.score('st_yasmine');
const rookie = Store.score('st_chaima');
assert(yas > rookie, 'elite score (' + yas + ') > rookie score (' + rookie + ')');
assert(yas > 1500, 'top student has strong score: ' + yas);
const lvl = Store.levelOf('st_yasmine');
assert(lvl.idx >= 5, 'top student is high level: ' + lvl.cur.name);
const lvlR = Store.levelOf('st_chaima');
assert(lvlR.idx <= 2, 'rookie is low level: ' + lvlR.cur.name);

const lb = Store.leaderboard();
assert(lb[0].s.id === 'st_yasmine' || lb[0].score >= lb[1].score, 'leaderboard sorted');
assert(lb[0].score >= lb[1].score, 'leaderboard desc order');

const rank = Store.globalRank('st_yasmine');
assert(rank.rank >= 1 && rank.total === 12, 'global rank computed: #' + rank.rank);

// mastery
const m = Store.mastery('st_yasmine');
const mastered = m.filter(x => x.done).length;
assert(mastered >= 8, 'top student has mastered topics: ' + mastered);
assert(lvl.topics === mastered, 'level.topics matches masteredCount');

// contest points baked
const c1 = db.contests.find(c => c.id === 'c1');
assert(c1.results[0].rank === 1 && c1.results[0].points === 150, 'contest rank1 gets 150 pts');
const cs = Store.contestStats('st_yasmine');
assert(cs.count === 6, 'yasmine participated in 6 contests: ' + cs.count);
assert(cs.podiums >= 4, 'yasmine podiums: ' + cs.podiums);

// history monotonic
const hist = Store.scoreHistory('st_yasmine');
let mono = true;
for (let i = 1; i < hist.length; i++) if (hist[i].y < hist[i - 1].y) mono = false;
assert(mono && hist.length > 10, 'score history cumulative & monotonic (' + hist.length + ' pts)');
assert(hist[hist.length - 1].y === yas, 'history end equals current score');
assert(Store.weeklyStreak('st_yasmine') >= 1, 'weekly streak computed: ' + Store.weeklyStreak('st_yasmine'));
const sr = Store.weeklyStreak('st_chaima');
assert(Number.isInteger(sr) && sr >= 0, 'streak handles sparse solvers: ' + sr);

// achievements
const ach = Store.achievementsOf('st_yasmine');
assert(ach.length === 7 && ach[0].tier === 'legend', 'achievements sorted by tier: ' + ach[0].name);

// mutation: add/update/delete student
const s = Store.addStudent({ name: 'Test Person', groupId: 'g_rookies' });
assert(Store.students().length === 13, 'student added');
Store.setStudentGroup(s.id, 'g_elite');
const t = Store.student(s.id);
assert(t.groupId === 'g_elite' && t.groupHistory.length === 2 && t.groupHistory[0].to, 'group move records history');
const pr = db.problems[0];
Store.setSolve(s.id, pr.id, true, '2026-07-01');
assert(Store.solvedCount(s.id) === 1 && Store.score(s.id) === pr.score, 'solve increases score by ' + pr.score);
Store.setSolve(s.id, pr.id, false);
assert(Store.score(s.id) === 0, 'unsolve removes points');
Store.toggleAchievement(s.id, 'a_nt', true);
assert(Store.achievementsOf(s.id).length === 1, 'achievement awarded');
Store.toggleAchievement(s.id, 'a_nt', false);
assert(Store.achievementsOf(s.id).length === 0, 'achievement revoked');
Store.deleteStudent(s.id);
assert(Store.students().length === 12, 'student deleted');

// contest mutation
const nc = Store.addContest({ name: 'Test Cup', date: '2026-07-01', entries: [{ studentId: 'st_ahmed', solved: 4 }, { studentId: 'st_omar', solved: 3 }] });
assert(nc.results.length === 2 && nc.results[1].points === 120, 'contest baked rank2 = 120pts');
const before = Store.score('st_omar');
Store.deleteContest(nc.id);
assert(Store.score('st_omar') === before - 120, 'contest deletion removes points');

// group delete guard
const bad = Store.deleteGroup('g_rookies');
assert(!bad.ok, 'cannot delete group with students');
const ng = Store.addGroup({ name: 'Temp', description: '' });
assert(Store.deleteGroup(ng.id).ok, 'empty group deleted');

// problem delete cascades solves
const victim = db.problems[db.problems.length - 1];
const solvers = Store.problemSolvers(victim.id).length;
Store.deleteProblem(victim.id);
assert(Store.problemSolvers(victim.id).length === 0 && solvers >= 0, 'problem deletion cascades');

// topic ops
assert(Store.addTopic('Test Topic', 33).ok, 'topic added');
assert(!Store.addTopic('Test Topic', 33).ok, 'duplicate topic rejected');
assert(Store.updateTopic('Test Topic', 'Renamed Topic', 44).ok, 'topic renamed');
assert(Store.deleteTopic('Renamed Topic').ok, 'unused topic deleted');
assert(!Store.deleteTopic('Dynamic Programming').ok, 'used topic delete blocked');

// password
assert(Store.verifyPassword('admin123'), 'default password verifies');
assert(Store.changePassword('admin123', 'supersecret').ok, 'password changed');
assert(!Store.verifyPassword('admin123') && Store.verifyPassword('supersecret'), 'new password verifies');
assert(!Store.changePassword('wrong', 'nope123').ok, 'wrong old password rejected');

// export/import roundtrip
const dump = JSON.parse(Store.exportJSON());
Store.factoryReset();
assert(Store.verifyPassword('admin123'), 'factory reset restores default password');
assert(Store.students().length === 12, 'factory reset reseeds');
const imp = Store.importJSON(dump);
assert(imp.ok, 'import accepted backup');
assert(Store.verifyPassword('supersecret'), 'import restored settings incl. password');
assert(Store.importJSON({ hello: 1 }).ok === false, 'invalid backup rejected');

// analytics helpers
const monthly = Store.academyMonthly(8);
assert(monthly.length === 8 && monthly.reduce((a, m) => a + m.count, 0) > 50, 'monthly solves: ' + monthly.reduce((a, m) => a + m.count, 0));
const growth = Store.academyScoreGrowth();
assert(growth.length > 10, 'academy growth computed');
const matrix = Store.groupTopicMatrix();
assert(matrix.rows.length === db.groups.length && matrix.rows[0].cells.length === topicNames.length, 'group-topic matrix shape');
const stats = Store.academyStats();
assert(stats.solved > 150 && stats.contests === db.contests.length, 'academy stats: ' + JSON.stringify(stats));

// --- manual adjustments ---
const sAdj = Store.addStudent({ name: 'Adjust Tester', groupId: 'g_rookies' });
Store.updateStudent(sAdj.id, { adjust: { score: 55, easy: 2, medium: 1, hard: 1 } });
assert(Store.score(sAdj.id) === 55, 'manual score adjustment applied');
assert(Store.solvedCount(sAdj.id) === 4, 'manual solved counts applied: ' + Store.solvedCount(sAdj.id));
const dAdj = Store.solvedByDiff(sAdj.id);
assert(dAdj.easy === 2 && dAdj.medium === 1 && dAdj.hard === 1, 'difficulty split includes adjustments');
const prAdj = db.problems[0];
Store.setSolve(sAdj.id, prAdj.id, true, '2026-07-20');
assert(Store.score(sAdj.id) === 55 + prAdj.score, 'adjusted score stacks on recorded solves');
assert(Store.solvedCount(sAdj.id) === 5, 'adjusted solved stacks');
const histAdj = Store.scoreHistory(sAdj.id);
assert(histAdj[0].y === 55 && histAdj[histAdj.length - 1].y === 55 + prAdj.score, 'history baseline starts at adjustment');
const histAdjS = Store.solvedHistory(sAdj.id);
assert(histAdjS[0].y === 4, 'solved history baseline = extras');
Store.updateStudent(sAdj.id, { adjust: { score: -9999, easy: 0, medium: 0, hard: 0 } });
assert(Store.score(sAdj.id) === 0, 'score clamped at 0 with negative adjustment');
Store.updateStudent(sAdj.id, { adjust: { score: 0, easy: 0, medium: 0, hard: 0 } });
Store.setSolve(sAdj.id, prAdj.id, false);
Store.deleteStudent(sAdj.id);

// history strict ordering + day dedupe (chart fix)
const histCheck = Store.scoreHistory('st_yasmine');
let okOrder = true, okNoSameDay = true;
for (let i = 1; i < histCheck.length; i++) {
  if (histCheck[i].t < histCheck[i - 1].t) okOrder = false;
  if (new Date(histCheck[i].t).toISOString().slice(0, 10) === new Date(histCheck[i - 1].t).toISOString().slice(0, 10)) okNoSameDay = false;
}
assert(okOrder, 'score history strictly time-ordered');
assert(okNoSameDay, 'score history has no same-day duplicate points');
const gCheck = Store.academyScoreGrowth();
let okG = true;
for (let i = 1; i < gCheck.length; i++) if (gCheck[i].y < gCheck[i - 1].y || gCheck[i].t < gCheck[i - 1].t) okG = false;
assert(okG, 'academy growth monotonic & ordered');
assert(gCheck.every((p) => isFinite(p.t) && isFinite(p.y)), 'growth has no invalid points');

// --- coach profile ---
assert(Store.settings().coach && Store.settings().coach.name, 'coach exists in settings');
assert(Store.coachAchievements().length === 3, 'seeded coach achievements: ' + Store.coachAchievements().length);
Store.updateCoach({ name: 'Coach Test', title: 'Head Coach', photo: null });
assert(Store.settings().coach.name === 'Coach Test' && Store.coachAchievements().length === 3, 'coach update keeps achievements');
Store.updateCoach({ achievements: [{ achievementId: 'a_ioi_m', date: '2026-01-01' }] });
assert(Store.coachAchievements().length === 1 && Store.coachAchievements()[0].tier === 'legend', 'coach achievements editable');
assert(Store.settings().coach.achievements !== db.students[0].achievements, 'coach achievements independent from students');

// erasing
Store.eraseContent();
assert(Store.students().length === 0 && Store.settings().levels.length === 10, 'erase content keeps settings');
const lbEmpty = Store.leaderboard();
assert(Array.isArray(lbEmpty) && lbEmpty.length === 0, 'leaderboard handles empty');
const statsEmpty = Store.academyStats();
assert(statsEmpty.avgScore === 0, 'stats handle empty db');
Store.resetDemo();
assert(Store.students().length === 12, 'demo restored after erase');

// --- migration: database saved by a pre-coach version of the app ---
(function () {
  const stale = JSON.parse(JSON.stringify(Store.raw()));
  delete stale.settings.coach; // old versions had no coach in settings
  const before = Store.students().length;
  mem['abdelmajidcp_db_v1'] = JSON.stringify(stale);
  Store.load();
  assert(Store.settings().coach && Store.settings().coach.name === 'Coach Abdelmajid', 'load() migrates pre-coach database: default coach filled');
  assert(Store.students().length === before, 'migration preserves student data');
})();

// --- deep-heal: corrupted numerics and string values in old/hand-edited data ---
(function () {
  const stale = JSON.parse(JSON.stringify(Store.raw()));
  stale.problems[0].score = '30';                       // string score
  stale.contests[0].results[0].points = 'oops';         // corrupted contest points
  stale.students[0].adjust = { score: '50', easy: '2', medium: 'x', hard: 1 };
  const pid = stale.problems[0].id, sid = stale.students[0].id;
  mem['abdelmajidcp_db_v1'] = JSON.stringify(stale);
  Store.load();
  assert(Store.problem(pid).score === 30, 'load() coerces string problem scores to numbers');
  assert(Store.raw().contests[0].results[0].points === 0, 'load() heals corrupted contest points');
  const a = Store.adjustOf(sid);
  assert(a.score === 50 && a.easy === 2 && a.medium === 0 && a.hard === 1, 'load() heals student adjustments');
  // in-memory corruption must not leak into charts either
  const pr = Store.problems()[0];
  pr.score = '25';
  const st2 = Store.addStudent({ name: 'String Score Tester', groupId: 'g_rookies' });
  Store.setSolve(st2.id, pr.id, true, '2026-07-20'); // backdated before joinDate (today)
  const h2 = Store.scoreHistory(st2.id);
  let asc = true;
  for (let i = 1; i < h2.length; i++) if (h2[i].t < h2[i - 1].t) asc = false;
  assert(asc, 'history strictly ascending even with backdated solves: ' + JSON.stringify(h2));
  assert(h2.every((pt) => typeof pt.y === 'number' && isFinite(pt.y)), 'history stays numeric with string scores');
  assert(h2[h2.length - 1].y === 25, 'string score parsed as number: last y=' + h2[h2.length - 1].y);
  Store.deleteStudent(st2.id);
  Store.resetDemo();
})();

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
