/* ============================================================
   Abdelmajid CP — store.js
   Data layer: Local Storage persistence, seed/demo data,
   derived statistics and all mutations. No DOM usage here.
   ============================================================ */
(function () {
  const KEY = 'abdelmajidcp_db_v1';
  const VER = 1;

  /* ---------------- helpers ---------------- */
  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const hashPW = (s) => (window.U ? window.U.hash(s) : String(s));
  // PBKDF2 via utils (always present in the browser); deterministic stand-in
  // for headless/test environments where utils.js isn't loaded.
  const pbkdf2PW = (pw, salt, iter) => {
    if (window.U && window.U.pbkdf2) return window.U.pbkdf2(pw, salt, iter);
    return Promise.resolve('pbkdf2$' + (iter || 120000) + '$' + (salt || 'staticsalt') + '$' + hashPW(String(pw) + '|' + (salt || '')));
  };
  const newSalt = () => (window.U && window.U.randomHex ? window.U.randomHex(16) : 'staticsalt');

  // deterministic rng for demo data
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- default settings ---------------- */
  function defaultSettings() {
    return {
      academyName: 'Abdelmajid CP',
      tagline: 'A competitive programming academy where progress is measured, ranked and celebrated.',
      passwordHash: hashPW('admin123'),
      passwordChanged: false,
      difficultyScores: { easy: 10, medium: 30, hard: 60 },
      difficultyXP: { easy: 1, medium: 3, hard: 6 },
      contestPoints: [150, 120, 100, 80, 60],
      contestPointsBeyond: 20, // points for every rank below the Top 5 // rank 1..5
      cfSince: null, // 'YYYY-MM-DD' — Codeforces submissions made before this date are ignored by auto-verify
      levels: [
        { name: 'Newcomer', minScore: 0, minTopics: 0, minAchievements: 0, color: '#9e9e9e' },
        { name: 'Learner', minScore: 80, minTopics: 1, minAchievements: 0, color: '#4caf50' },
        { name: 'Apprentice', minScore: 200, minTopics: 2, minAchievements: 0, color: '#00bcd4' },
        { name: 'Coder', minScore: 350, minTopics: 3, minAchievements: 0, color: '#2196f3' },
        { name: 'Problem Solver', minScore: 550, minTopics: 4, minAchievements: 1, color: '#7c4dff' },
        { name: 'Specialist', minScore: 800, minTopics: 6, minAchievements: 1, color: '#ab47bc' },
        { name: 'Expert', minScore: 1100, minTopics: 8, minAchievements: 2, color: '#ff9800' },
        { name: 'Master', minScore: 1500, minTopics: 10, minAchievements: 3, color: '#ff5722' },
        { name: 'Grandmaster', minScore: 1900, minTopics: 12, minAchievements: 4, color: '#f44336' },
        { name: 'Legend', minScore: 2400, minTopics: 14, minAchievements: 6, color: '#ffd700' },
      ],
      topics: [
        { name: 'Implementation', masteryXP: 4 },
        { name: 'Math & Number Theory', masteryXP: 3 },
        { name: 'Greedy', masteryXP: 8 },
        { name: 'Sorting & Searching', masteryXP: 2 },
        { name: 'Binary Search', masteryXP: 5 },
        { name: 'Two Pointers', masteryXP: 5 },
        { name: 'Recursion & Backtracking', masteryXP: 4 },
        { name: 'Graph Traversal', masteryXP: 12 },
        { name: 'Shortest Paths', masteryXP: 12 },
        { name: 'Dynamic Programming', masteryXP: 26 },
        { name: 'Data Structures', masteryXP: 6 },
        { name: 'Segment Tree & Fenwick', masteryXP: 7 },
        { name: 'Strings', masteryXP: 5 },
        { name: 'Combinatorics', masteryXP: 8 },
        { name: 'Bit Manipulation', masteryXP: 4 },
        { name: 'Geometry', masteryXP: 5 },
      ],
      coach: {
        name: 'Coach Abdelmajid',
        title: 'Founder & Head Coach',
        bio: 'Competitive programming coach and academy founder. Building the next generation of Tunisian competitive programmers — one problem at a time.',
        photo: null,
        achievements: [],
      },
    };
  }

  function emptyDB() {
    return {
      version: VER,
      createdAt: new Date().toISOString(),
      settings: defaultSettings(),
      students: [], groups: [], problems: [], contests: [],
      catalog: [], activity: [], joinRequests: [], questions: [],
    };
  }

  /* Deep-heal a database object: fill in settings keys added by newer
     versions (e.g. the coach profile) and coerce every numeric field so
     old or hand-edited data can never corrupt charts (string scores were
     silently concatenated into bogus values). */
  function normalizeDB(data) {
    if (!data || typeof data !== 'object') return data;
    data.settings = Object.assign(defaultSettings(), data.settings || {});
    const S = data.settings;
    const num = (v, dflt) => { const n = Number(v); return isFinite(n) ? n : (dflt || 0); };
    const numMap = (o, keys) => { const out = {}; keys.forEach((k) => { out[k] = num(o && o[k]); }); return out; };
    S.difficultyScores = numMap(S.difficultyScores, ['easy', 'medium', 'hard']);
    S.difficultyXP = numMap(S.difficultyXP, ['easy', 'medium', 'hard']);
    S.contestPoints = (Array.isArray(S.contestPoints) ? S.contestPoints : [150, 120, 100, 80, 60]).map((v) => num(v));
    if (!isFinite(Number(S.contestPointsBeyond))) S.contestPointsBeyond = 20;
    S.contestPointsBeyond = num(S.contestPointsBeyond, 20);
    if (!Array.isArray(data.joinRequests)) data.joinRequests = [];
    if (!Array.isArray(data.questions)) data.questions = [];
    (data.problems || []).forEach((p) => { p.score = num(p.score); p.xp = num(p.xp); });
    (data.contests || []).forEach((c) => (c.results || []).forEach((r) => {
      r.points = num(r.points); r.solved = Math.max(0, num(r.solved)); r.rank = num(r.rank);
    }));
    (data.students || []).forEach((s) => {
      if (!Array.isArray(s.solves)) s.solves = [];
      if (!Array.isArray(s.achievements)) s.achievements = [];
      if (s.adjust) s.adjust = { score: Math.trunc(num(s.adjust.score)), easy: Math.max(0, Math.trunc(num(s.adjust.easy))), medium: Math.max(0, Math.trunc(num(s.adjust.medium))), hard: Math.max(0, Math.trunc(num(s.adjust.hard))) };
    });
    if (!Array.isArray(data.activity)) data.activity = [];
    data.version = VER;
    return data;
  }

  /* ================================================================
     SEED DEMO DATA
     ================================================================ */
  function seedDB() {
    const rng = mulberry32(20260730);
    const db = emptyDB();
    const S = db.settings;

    /* ----- groups ----- */
    const gR = { id: 'g_rookies', name: 'Rookies', description: 'Foundations — first steps into problem solving, logic and basic implementation.', createdAt: daysAgoStr(300) };
    const gC = { id: 'g_challengers', name: 'Challengers', description: 'Core techniques — greedy, graphs, data structures and introductory DP.', createdAt: daysAgoStr(300) };
    const gE = { id: 'g_elite', name: 'Elite', description: 'National team preparation — advanced topics, hard problems and contest strategy.', createdAt: daysAgoStr(300) };
    db.groups.push(gR, gC, gE);

    /* ----- problems: [name, judge url, topic, difficulty] ----- */
    const CF = (n, id) => ({ name: n, link: 'https://codeforces.com/problemset/problem/' + id });
    const CS = (n, id) => ({ name: n, link: 'https://cses.fi/problemset/task/' + id });
    const raw = [
      [CF('Watermelon', '4/A'), 'Implementation', 'easy'],
      [CF('Way Too Long Words', '71/A'), 'Strings', 'easy'],
      [CF('Team', '231/A'), 'Implementation', 'easy'],
      [CF('Bit++', '282/A'), 'Implementation', 'easy'],
      [CF('Theatre Square', '1/A'), 'Math & Number Theory', 'easy'],
      [CF('Domino Piling', '50/A'), 'Math & Number Theory', 'easy'],
      [CF('Beautiful Matrix', '263/A'), 'Implementation', 'easy'],
      [CF('Helpful Maths', '339/A'), 'Sorting & Searching', 'easy'],
      [CF('Elephant', '617/A'), 'Greedy', 'easy'],
      [CF('Soldier and Bananas', '546/A'), 'Math & Number Theory', 'easy'],
      [CF('Wrong Subtraction', '977/A'), 'Implementation', 'easy'],
      [CF('Stones on the Table', '266/A'), 'Strings', 'easy'],
      [CS('Weird Algorithm', '1068'), 'Implementation', 'easy'],
      [CS('Missing Number', '1083'), 'Math & Number Theory', 'easy'],
      [CS('Repetitions', '1069'), 'Strings', 'easy'],
      [CS('Increasing Array', '1094'), 'Greedy', 'easy'],
      [CS('Number Spiral', '1071'), 'Math & Number Theory', 'easy'],
      [CS('Distinct Numbers', '1621'), 'Sorting & Searching', 'easy'],
      [CS('Collecting Numbers', '2216'), 'Sorting & Searching', 'easy'],
      [CS('Static Range Sum Queries', '1646'), 'Data Structures', 'easy'],
      [CS('Creating Strings', '1622'), 'Recursion & Backtracking', 'medium'],
      [CS('Apple Division', '1623'), 'Recursion & Backtracking', 'medium'],
      [CS('Two Knights', '1072'), 'Combinatorics', 'medium'],
      [CS('Towers', '1073'), 'Data Structures', 'medium'],
      [CS('Traffic Lights', '1163'), 'Data Structures', 'medium'],
      [CS('String Matching', '1753'), 'Strings', 'medium'],
      [CS('Finding Borders', '1732'), 'Strings', 'medium'],
      [CF('Petr and a Combination Lock', '1097/B'), 'Bit Manipulation', 'medium'],
      [CF('Preparing Olympiad', '550/B'), 'Bit Manipulation', 'medium'],
      [CS('Point Location Test', '2189'), 'Geometry', 'medium'],
      [CS('Dynamic Range Minimum Queries', '1649'), 'Segment Tree & Fenwick', 'medium'],
      [CS('Range Xor Queries', '1650'), 'Segment Tree & Fenwick', 'medium'],
      [CS('Apartments', '1084'), 'Greedy', 'medium'],
      [CS('Ferris Wheel', '1090'), 'Greedy', 'medium'],
      [CS('Concert Tickets', '1091'), 'Data Structures', 'medium'],
      [CS('Maximum Subarray Sum', '1643'), 'Dynamic Programming', 'medium'],
      [CS('Stick Lengths', '1074'), 'Greedy', 'medium'],
      [CS('Sum of Two Values', '1640'), 'Two Pointers', 'medium'],
      [CS('Subarray Sums I', '1660'), 'Two Pointers', 'medium'],
      [CS('Playlist', '1141'), 'Two Pointers', 'medium'],
      [CS('Factory Machines', '1620'), 'Binary Search', 'medium'],
      [CS('Missing Coin Sum', '2183'), 'Greedy', 'medium'],
      [CS('Counting Rooms', '1192'), 'Graph Traversal', 'medium'],
      [CS('Labyrinth', '1193'), 'Graph Traversal', 'medium'],
      [CS('Building Roads', '1666'), 'Graph Traversal', 'medium'],
      [CS('Message Route', '1667'), 'Graph Traversal', 'medium'],
      [CS('Building Teams', '1668'), 'Graph Traversal', 'medium'],
      [CS('Dice Combinations', '1633'), 'Dynamic Programming', 'medium'],
      [CS('Minimizing Coins', '1634'), 'Dynamic Programming', 'medium'],
      [CS('Coin Combinations I', '1635'), 'Dynamic Programming', 'medium'],
      [CS('Static Range Minimum Queries', '1647'), 'Segment Tree & Fenwick', 'medium'],
      [CS('Dynamic Range Sum Queries', '1648'), 'Segment Tree & Fenwick', 'medium'],
      [CS('Shortest Routes I', '1671'), 'Shortest Paths', 'medium'],
      [CS('Round Trip', '1669'), 'Graph Traversal', 'hard'],
      [CS('Shortest Routes II', '1672'), 'Shortest Paths', 'hard'],
      [CS('High Score', '1673'), 'Shortest Paths', 'hard'],
      [CS('Grid Paths', '1638'), 'Dynamic Programming', 'hard'],
      [CS('Book Shop', '1158'), 'Dynamic Programming', 'hard'],
      [CS('Array Description', '1746'), 'Dynamic Programming', 'hard'],
      [CS('Edit Distance', '1639'), 'Dynamic Programming', 'hard'],
      [CS('Counting Towers', '2413'), 'Dynamic Programming', 'hard'],
      [CS('Removal Game', '1097'), 'Dynamic Programming', 'hard'],
      [CS('Array Division', '1085'), 'Binary Search', 'hard'],
      [CS('Flight Discount', '1195'), 'Shortest Paths', 'hard'],
      [CS('Binomial Coefficients', '1079'), 'Combinatorics', 'hard'],
      [CS('Distributing Apples', '1716'), 'Combinatorics', 'hard'],
      [CS('Point in Polygon', '2192'), 'Geometry', 'hard'],
    ];
    db.problems = raw.map((r, i) => {
      const diff = r[2];
      const p = {
        id: 'p' + String(i + 1).padStart(2, '0'),
        name: r[0].name, link: r[0].link,
        topic: r[1], difficulty: diff,
        score: S.difficultyScores[diff], xp: S.difficultyXP[diff],
        groupIds: [],
      };
      if (diff === 'easy') p.groupIds = ['g_rookies', 'g_challengers', 'g_elite'];
      else if (diff === 'medium') p.groupIds = ['g_challengers', 'g_elite'];
      else p.groupIds = ['g_elite'];
      return p;
    });

    /* ----- students ----- */
    const mk = (id, name, gid, joinDaysAgo, history) => ({
      id, name, photo: null, groupId: gid,
      joinDate: daysAgoStr(joinDaysAgo),
      groupHistory: history || [],
      solves: [], achievements: [],
      adjust: { score: 0, easy: 0, medium: 0, hard: 0 },
    });
    const st = [
      // Elite
      mk('st_yasmine', 'Yasmine Ben Ali', 'g_elite', 300, [{ groupId: 'g_challengers', from: daysAgoStr(300), to: daysAgoStr(140) }, { groupId: 'g_elite', from: daysAgoStr(140), to: null }]),
      mk('st_ahmed', 'Ahmed Trabelsi', 'g_elite', 290, [{ groupId: 'g_challengers', from: daysAgoStr(290), to: daysAgoStr(100) }, { groupId: 'g_elite', from: daysAgoStr(100), to: null }]),
      mk('st_omar', 'Omar Jebali', 'g_elite', 250),
      mk('st_nour', 'Nour Eddine Sassi', 'g_elite', 230),
      // Challengers
      mk('st_amine', 'Mohamed Amine Gharbi', 'g_challengers', 210),
      mk('st_khalil', 'Khalil Bouzid', 'g_challengers', 205, [{ groupId: 'g_rookies', from: daysAgoStr(205), to: daysAgoStr(60) }, { groupId: 'g_challengers', from: daysAgoStr(60), to: null }]),
      mk('st_sara', 'Sara Mansour', 'g_challengers', 180, [{ groupId: 'g_rookies', from: daysAgoStr(180), to: daysAgoStr(45) }, { groupId: 'g_challengers', from: daysAgoStr(45), to: null }]),
      mk('st_rayen', 'Rayen Chaabane', 'g_challengers', 150),
      mk('st_ilyes', 'Ilyes Haddad', 'g_challengers', 120),
      // Rookies
      mk('st_maryem', 'Maryem Khelifi', 'g_rookies', 90),
      mk('st_aziz', 'Aziz Ben Romdhane', 'g_rookies', 70),
      mk('st_chaima', 'Chaima Ayari', 'g_rookies', 40),
    ];

    // groupId should reflect latest history entry when present
    st.forEach((s) => {
      if (s.groupHistory.length) {
        const last = s.groupHistory[s.groupHistory.length - 1];
        if (!last.to) s.groupId = last.groupId;
      }
    });
    db.students = st;

    /* ----- solves ----- */
    const easy = db.problems.filter((p) => p.difficulty === 'easy');
    const med = db.problems.filter((p) => p.difficulty === 'medium');
    const hard = db.problems.filter((p) => p.difficulty === 'hard');
    const pickN = (arr, fracMin, fracMax) => {
      const n = Math.round(arr.length * (fracMin + rng() * (fracMax - fracMin)));
      const copy = arr.slice();
      const out = [];
      for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
      return out;
    };
    const dateFor = (maxDays) => daysAgoStr(Math.floor(Math.pow(rng(), 1.4) * maxDays));

    const plans = {
      st_yasmine: [[easy, .95, 1], [med, .92, 1], [hard, .85, 1]],
      st_ahmed: [[easy, .9, 1], [med, .85, .95], [hard, .7, .85]],
      st_omar: [[easy, .85, .95], [med, .7, .85], [hard, .5, .7]],
      st_nour: [[easy, .85, .95], [med, .65, .8], [hard, .4, .6]],
      st_amine: [[easy, .85, 1], [med, .45, .6], [hard, 0, .12]],
      st_khalil: [[easy, .8, .95], [med, .35, .5], [hard, 0, 0]],
      st_sara: [[easy, .8, .95], [med, .3, .45], [hard, 0, 0]],
      st_rayen: [[easy, .7, .85], [med, .2, .35], [hard, 0, 0]],
      st_ilyes: [[easy, .6, .8], [med, .15, .3], [hard, 0, 0]],
      st_maryem: [[easy, .5, .65], [med, 0, 0], [hard, 0, 0]],
      st_aziz: [[easy, .4, .55], [med, 0, 0], [hard, 0, 0]],
      st_chaima: [[easy, .25, .4], [med, 0, 0], [hard, 0, 0]],
    };
    st.forEach((s) => {
      const plan = plans[s.id] || [];
      plan.forEach(([arr, f1, f2]) => {
        pickN(arr, f1, f2).forEach((p) => s.solves.push({ problemId: p.id, date: dateFor(220) }));
      });
      s.solves.sort((a, b) => a.date.localeCompare(b.date));
    });

    /* ----- contests ----- */
    const contestDefs = [
      { id: 'c1', name: 'Winter Warmup #1', days: 173, desc: 'First internal speed round of the year — implementation and greedy focus.' },
      { id: 'c2', name: 'TCPC Teens — Mock Qualifier', days: 138, desc: 'Simulation of the TCPC Teens qualification round under real time pressure.' },
      { id: 'c3', name: 'Spring Graph Clash', days: 110, desc: 'Graph traversal special: BFS, DFS and connectivity under the clock.' },
      { id: 'c4', name: 'National Selection Mock', days: 82, desc: 'Full 5-hour mock in the style of the national olympiad selection.' },
      { id: 'c5', name: 'Summer Clash #1', days: 47, desc: 'Mixed-bag summer round — dynamic programming heavy problemset.' },
      { id: 'c6', name: 'Abdelmajid Cup — July Edition', days: 12, desc: 'The academy flagship monthly cup. Fast fingers, sharp minds.' },
    ];
    const podiumRot = [
      ['st_yasmine', 'st_ahmed', 'st_omar', 'st_nour', 'st_amine'],
      ['st_ahmed', 'st_yasmine', 'st_nour', 'st_omar', 'st_khalil'],
      ['st_yasmine', 'st_omar', 'st_ahmed', 'st_amine', 'st_sara'],
      ['st_yasmine', 'st_ahmed', 'st_omar', 'st_sara', 'st_nour'],
      ['st_ahmed', 'st_yasmine', 'st_amine', 'st_omar', 'st_khalil'],
      ['st_yasmine', 'st_nour', 'st_ahmed', 'st_omar', 'st_amine'],
    ];
    db.contests = contestDefs.map((c, i) => ({
      id: c.id, name: c.name, date: daysAgoStr(c.days), description: c.desc,
      results: podiumRot[i].map((sid, r) => ({
        studentId: sid, rank: r + 1,
        solved: Math.max(1, 6 - r - Math.floor(rng() * 2)),
        points: S.contestPoints[r],
      })),
    }));

    /* ----- achievement catalog ----- */
    const cat = (id, name, series, tier, icon, description) => ({ id, name, series, tier, icon, description });
    db.catalog = [
      cat('a_topj_b', 'TOP Junior Bronze', 'TOP Junior', 'bronze', 'medal', 'Bronze medal — Tunisian Olympiad in Programming, junior division.'),
      cat('a_topj_s', 'TOP Junior Silver', 'TOP Junior', 'silver', 'medal', 'Silver medal — Tunisian Olympiad in Programming, junior division.'),
      cat('a_topj_g', 'TOP Junior Gold', 'TOP Junior', 'gold', 'medal', 'Gold medal — Tunisian Olympiad in Programming, junior division.'),
      cat('a_top_b', 'TOP Bronze', 'TOP', 'bronze', 'medal', 'Bronze medal — Tunisian Olympiad in Programming.'),
      cat('a_top_s', 'TOP Silver', 'TOP', 'silver', 'medal', 'Silver medal — Tunisian Olympiad in Programming.'),
      cat('a_top_g', 'TOP Gold', 'TOP', 'gold', 'medal', 'Gold medal — Tunisian Olympiad in Programming.'),
      cat('a_tcpct_b', 'TCPC Teens Bronze', 'TCPC Teens', 'bronze', 'trophy', 'Bronze medal — Tunisian Collegiate Programming Contest, teens division.'),
      cat('a_tcpct_s', 'TCPC Teens Silver', 'TCPC Teens', 'silver', 'trophy', 'Silver medal — Tunisian Collegiate Programming Contest, teens division.'),
      cat('a_tcpct_g', 'TCPC Teens Gold', 'TCPC Teens', 'gold', 'trophy', 'Gold medal — Tunisian Collegiate Programming Contest, teens division.'),
      cat('a_tcpc_b', 'TCPC Bronze', 'TCPC', 'bronze', 'trophy', 'Bronze medal — Tunisian Collegiate Programming Contest.'),
      cat('a_tcpc_s', 'TCPC Silver', 'TCPC', 'silver', 'trophy', 'Silver medal — Tunisian Collegiate Programming Contest.'),
      cat('a_tcpc_g', 'TCPC Gold', 'TCPC', 'gold', 'trophy', 'Gold medal — Tunisian Collegiate Programming Contest.'),
      cat('a_acpc_q', 'Qualified ACPC', 'Regional', 'special', 'flag', 'Qualified to the Arab & Africa Collegiate Programming Championship.'),
      cat('a_acpc_m', 'ACPC Medal', 'Regional', 'special', 'medal', 'Medalist at the Arab & Africa Collegiate Programming Championship.'),
      cat('a_ioi_q', 'Qualified IOI', 'International', 'special', 'star', 'Selected to represent Tunisia at the International Olympiad in Informatics.'),
      cat('a_ioi_m', 'IOI Medal', 'International', 'legend', 'crown', 'Medalist at the International Olympiad in Informatics.'),
      cat('a_nt', 'National Team', 'International', 'legend', 'shield', 'Member of the Tunisian national competitive programming team.'),
    ];
    const byId = (id) => db.students.find((s) => s.id === id);
    const award = (sid, aid, days) => { const s = byId(sid); if (s) s.achievements.push({ achievementId: aid, date: daysAgoStr(days) }); };
    award('st_yasmine', 'a_top_g', 250); award('st_yasmine', 'a_tcpc_g', 170);
    award('st_yasmine', 'a_acpc_q', 120); award('st_yasmine', 'a_acpc_m', 96);
    award('st_yasmine', 'a_ioi_q', 60); award('st_yasmine', 'a_nt', 30); award('st_yasmine', 'a_ioi_m', 25);
    award('st_ahmed', 'a_top_s', 250); award('st_ahmed', 'a_tcpc_s', 170);
    award('st_ahmed', 'a_acpc_q', 120); award('st_ahmed', 'a_acpc_m', 96); award('st_ahmed', 'a_nt', 30);
    award('st_omar', 'a_tcpct_g', 220); award('st_omar', 'a_top_b', 250); award('st_omar', 'a_tcpc_b', 170);
    award('st_nour', 'a_tcpct_s', 220); award('st_nour', 'a_acpc_q', 120);
    award('st_amine', 'a_tcpct_b', 220); award('st_khalil', 'a_topj_g', 200); award('st_khalil', 'a_tcpct_b', 220);
    award('st_sara', 'a_topj_s', 200); award('st_rayen', 'a_topj_b', 200);

    /* ----- coach (demo) ----- */
    db.settings.coach.achievements = [
      { achievementId: 'a_nt', date: daysAgoStr(280) },
      { achievementId: 'a_tcpc_g', date: daysAgoStr(172) },
      { achievementId: 'a_acpc_m', date: daysAgoStr(98) },
    ];

    /* ----- activity log ----- */
    const acts = [];
    st.forEach((s) => acts.push({ t: s.joinDate + 'T09:00:00', type: 'student', text: `${s.name} joined the academy` }));
    st.forEach((s) => s.solves.forEach((sv) => {
      const p = db.problems.find((x) => x.id === sv.problemId);
      if (p) acts.push({ t: sv.date + 'T18:30:00', type: 'solve', text: `${s.name} solved “${p.name}” (+${p.score} pts)` });
    }));
    db.contests.forEach((c) => {
      const first = byId(c.results[0].studentId);
      acts.push({ t: c.date + 'T14:00:00', type: 'contest', text: `Contest “${c.name}” — won by ${first ? first.name : '—'}` });
    });
    st.forEach((s) => s.achievements.forEach((a) => {
      const c = db.catalog.find((x) => x.id === a.achievementId);
      if (c) acts.push({ t: a.date + 'T12:00:00', type: 'achievement', text: `${s.name} earned “${c.name}”` });
    }));
    (db.settings.coach.achievements || []).forEach((a) => {
      const c = db.catalog.find((x) => x.id === a.achievementId);
      if (c) acts.push({ t: a.date + 'T12:00:00', type: 'achievement', text: `${db.settings.coach.name} earned “${c.name}”` });
    });
    acts.sort((a, b) => b.t.localeCompare(a.t));
    db.activity = acts.slice(0, 60).map((a) => ({ id: uid('ev'), t: new Date(a.t), type: a.type, text: a.text }));

    return db;
  }

  /* ================================================================
     STORE
     ================================================================ */
  const Store = {};
  let db = null;

  /* ================================================================
     CLOUD SYNC (optional Supabase backend)
     One shared JSON document in an `app_state` table. Anonymous visitors
     can only READ (RLS); only the signed-in coach can WRITE.
     Local Storage always stays as offline cache / fallback — when no
     Supabase config is present the app behaves exactly like before.
     ================================================================ */
  const CLOUD_TABLE = 'app_state';
  const CLOUD_ROW_ID = 1;
  const Cloud = { client: null, authed: false, empty: false, synced: false, lastError: null, hashInCloud: null };
  let cloudTimer = null;

  function cloudConfig() {
    const c = window.SUPABASE_CONFIG || {};
    return (c.url && c.anonKey && c.coachEmail) ? c : null;
  }
  function cloudClient() {
    if (Cloud.client) return Cloud.client;
    const cfg = cloudConfig();
    if (!cfg || !window.supabase || !window.supabase.createClient) return null;
    try { Cloud.client = window.supabase.createClient(cfg.url, cfg.anonKey); } catch (e) { Cloud.client = null; }
    return Cloud.client;
  }
  Store.cloudEnabled = () => !!cloudClient();
  Store.cloudStatus = () => ({ enabled: !!cloudClient(), authed: Cloud.authed, synced: Cloud.synced, error: Cloud.lastError, hashInCloud: Cloud.hashInCloud });

  function cloudLooksValid(d) { return d && typeof d === 'object' && d.settings && Array.isArray(d.students); }

  // Pull the shared document once at boot; if the row is still the empty
  // placeholder and the coach is signed in, upload current data (migration).
  Store._cloudFetch = async function (onApplied) {
    const client = cloudClient();
    if (!client) return;
    const done = (applied) => { try { onApplied && onApplied(applied); } catch (e) {} };
    try {
      const sess = await client.auth.getSession();
      Cloud.authed = !!(sess && sess.data && sess.data.session);
      const res = await client.from(CLOUD_TABLE).select('id,data').eq('id', CLOUD_ROW_ID).maybeSingle();
      if (res.error) throw res.error;
      if (res.data && cloudLooksValid(res.data.data)) {
        const fresh = normalizeDB(JSON.parse(JSON.stringify(res.data.data)));
        // SECURITY: the admin password hash is device-local only. Keep the
        // local one; never adopt (or re-upload) anything from the cloud doc.
        if (db && db.settings && db.settings.passwordHash) {
          fresh.settings.passwordHash = db.settings.passwordHash;
          fresh.settings.passwordChanged = !!db.settings.passwordChanged;
        }
        // SECURITY self-heal: older builds uploaded the password hash inside
        // the public cloud document. If it's still there and the coach is
        // signed in, immediately re-upload WITHOUT it.
        const hashInCloudDoc = !!(res.data.data.settings && res.data.data.settings.passwordHash);
        Cloud.hashInCloud = hashInCloudDoc;
        if (hashInCloudDoc && Cloud.authed) {
          Cloud.hashInCloud = false;
          Store._cloudPush();
          if (window.U) window.U.toast('Security upgrade: sensitive data was removed from the cloud', 'success', 'shield');
        }
        // Never lose applications/questions that live ONLY in this browser
        // (submitted while the cloud table was missing / unreachable): carry
        // them over the cloud replacement, deduped against the fresh copy.
        ['joinRequests', 'questions'].forEach((key) => {
          const localOnly = (db && db[key] ? db[key] : []).filter((x) => !x.cloudId);
          if (localOnly.length) {
            fresh[key] = fresh[key].filter((x) => !localOnly.some((l) => l.id && l.id === x.id)).concat(localOnly);
          }
        });
        db = fresh;
        // Merge Codeforces-verified solves (public table, server-written) into
        // the document so every stat/achievement/streak counts them.
        try { Store.applyVerifiedSolves(await Store.fetchVerifiedSolves()); } catch (e) {}
        Cloud.empty = false; Cloud.synced = true;
        try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
        done(true);
      } else {
        Cloud.empty = true;
        if (Cloud.authed) {
          Cloud.empty = false;
          Store._cloudPush();
          if (window.U) window.U.toast('Your data was uploaded to the cloud — everything is online now!', 'success', 'cloud');
          done(true);
        } else done(false);
      }
    } catch (e) {
      Cloud.lastError = String(e && e.message || e);
      done(false);
    }
  };

  Store._cloudPush = async function () {
    const client = cloudClient();
    if (!client || !Cloud.authed || !db) return;
    try {
      // SECURITY: strip the admin password hash (and anything future-secret)
      // before uploading — the cloud document is publicly readable by design.
      const { passwordHash, ...safeSettings } = db.settings;
      const payload = { ...db, settings: safeSettings };
      void passwordHash;
      const res = await client.from(CLOUD_TABLE).upsert({ id: CLOUD_ROW_ID, data: payload, updated_at: new Date().toISOString() });
      if (res.error) throw res.error;
      Cloud.synced = true; Cloud.lastError = null; Cloud.hashInCloud = false;
    } catch (e) {
      Cloud.lastError = String(e && e.message || e);
      if (window.U) window.U.toast('Cloud sync failed — your changes are saved locally and will retry with the next edit.', 'error');
    }
  };

  function scheduleCloudPush() {
    if (!cloudClient() || !Cloud.authed) return; // anonymous visitors never write
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => Store._cloudPush(), 700);
  }

  // Coach authentication (Supabase Auth). Same password as the admin panel.
  Store.cloudSignIn = async function (password) {
    const client = cloudClient(), cfg = cloudConfig();
    if (!client) return { ok: false, error: 'not-configured' };
    try {
      const res = await client.auth.signInWithPassword({ email: cfg.coachEmail, password });
      if (res.error) return { ok: false, error: res.error.message || 'Invalid login credentials' };
      Cloud.authed = true;
      if (Cloud.empty) { // first cloud login -> migrate local data up
        Cloud.empty = false;
        Store._cloudPush();
        if (window.U) window.U.toast('Your data was uploaded to the cloud — everything is online now!', 'success', 'cloud');
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  };
  Store.cloudSignOut = async function () {
    Cloud.authed = false;
    const client = cloudClient();
    if (client) { try { await client.auth.signOut(); } catch (e) {} }
  };
  Store.cloudUpdatePassword = async function (newPw) {
    const client = cloudClient();
    if (!client || !Cloud.authed) return { ok: false, skipped: true };
    try {
      const res = await client.auth.updateUser({ password: newPw });
      return res.error ? { ok: false, error: res.error.message } : { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  };

  Store.load = function (onCloudData) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.settings && Array.isArray(parsed.students)) {
          // Migrate + heal databases saved by older versions: fill in settings
          // added later (e.g. the coach profile) and coerce numeric fields,
          // keeping every value the user already has.
          db = normalizeDB(parsed);
        }
      }
    } catch (e) { /* corrupted -> reseed */ }
    if (!db) {
      db = seedDB();
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
    }
    // after first paint, refresh from the cloud (if configured)
    if (cloudClient()) {
      const cb = typeof onCloudData === 'function' ? onCloudData : () => {};
      Promise.resolve().then(() => Store._cloudFetch(cb));
    }
    return db;
  };

  Store.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { if (window.U) window.U.toast('Storage full — could not save. Try exporting a backup and clearing data.', 'error'); }
    scheduleCloudPush();
    return db;
  };

  Store.raw = () => db;
  Store.settings = () => db.settings;
  Store.levels = () => db.settings.levels;
  Store.topics = () => db.settings.topics;
  Store.students = () => db.students;
  Store.groups = () => db.groups;
  Store.problems = () => db.problems;
  Store.contests = () => db.contests;
  Store.catalog = () => db.catalog;
  Store.activity = () => db.activity;

  Store.student = (id) => db.students.find((s) => s.id === id) || null;
  Store.group = (id) => db.groups.find((g) => g.id === id) || null;
  Store.problem = (id) => db.problems.find((p) => p.id === id) || null;
  Store.contest = (id) => db.contests.find((c) => c.id === id) || null;
  Store.catItem = (id) => db.catalog.find((a) => a.id === id) || null;

  /* ---------------- activity ---------------- */
  Store.log = function (type, text) {
    db.activity.unshift({ id: uid('ev'), t: new Date().toISOString(), type, text });
    if (db.activity.length > 200) db.activity.length = 200;
  };

  /* ---------------- derived: students ---------------- */
  Store.solvesOf = function (sid) {
    const s = Store.student(sid);
    if (!s) return [];
    return s.solves
      .map((sv) => ({ problem: Store.problem(sv.problemId), date: sv.date, via: sv.via || null, subId: sv.subId || null }))
      .filter((x) => x.problem)
      .sort((a, b) => a.date.localeCompare(b.date));
  };
  Store.solvePoints = (sid) => Store.solvesOf(sid).reduce((a, x) => a + (x.problem.score || 0), 0);
  // manual adjustments set by the coach (added on top of recorded activity)
  Store.adjustOf = function (sid) {
    const s = Store.student(sid);
    const a = (s && s.adjust) || {};
    const i = (v) => Math.trunc(Number(v) || 0);
    return { score: i(a.score), easy: Math.max(0, i(a.easy)), medium: Math.max(0, i(a.medium)), hard: Math.max(0, i(a.hard)) };
  };
  Store.solvedCount = function (sid) {
    const a = Store.adjustOf(sid);
    return Store.solvesOf(sid).length + a.easy + a.medium + a.hard;
  };
  Store.solvedByDiff = function (sid) {
    const out = { easy: 0, medium: 0, hard: 0 };
    Store.solvesOf(sid).forEach((x) => { if (out[x.problem.difficulty] != null) out[x.problem.difficulty]++; });
    const a = Store.adjustOf(sid);
    out.easy += a.easy; out.medium += a.medium; out.hard += a.hard;
    return out;
  };
  Store.resultsOf = function (sid) {
    const out = [];
    db.contests.forEach((c) => c.results.forEach((r) => {
      if (r.studentId === sid) out.push({ contest: c, rank: r.rank, solved: r.solved, points: r.points });
    }));
    return out.sort((a, b) => a.contest.date.localeCompare(b.contest.date));
  };
  Store.contestPointsSum = (sid) => Store.resultsOf(sid).reduce((a, r) => a + (r.points || 0), 0);
  Store.score = (sid) => Math.max(0, Store.solvePoints(sid) + Store.contestPointsSum(sid) + Store.adjustOf(sid).score);
  Store.contestStats = function (sid) {
    const res = Store.resultsOf(sid);
    const podiums = res.filter((r) => r.rank <= 3).length;
    const best = res.length ? Math.min.apply(null, res.map((r) => r.rank)) : null;
    const points = res.reduce((a, r) => a + (r.points || 0), 0);
    const avg = res.length ? (res.reduce((a, r) => a + r.rank, 0) / res.length) : null;
    return { count: res.length, podiums, best, points, avg };
  };
  function mondayOf(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday = 0
    x.setDate(x.getDate() - day);
    return x.toISOString().slice(0, 10);
  }
  Store.weeklyStreak = function (sid) {
    const weeks = new Set();
    Store.solvesOf(sid).forEach((x) => weeks.add(mondayOf(x.date)));
    let streak = 0;
    for (let i = 0; i < 260; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      if (weeks.has(mondayOf(d))) streak++;
      else if (i === 0) continue; // current week may not be done yet
      else break;
    }
    return streak;
  };
  Store.topicXP = function (sid) {
    const out = {};
    Store.solvesOf(sid).forEach((x) => {
      const t = x.problem.topic || 'General';
      out[t] = (out[t] || 0) + (x.problem.xp || 0);
    });
    return out;
  };
  Store.mastery = function (sid) {
    const xp = Store.topicXP(sid);
    return db.settings.topics.map((t) => ({
      name: t.name, required: t.masteryXP,
      xp: xp[t.name] || 0,
      done: (xp[t.name] || 0) >= t.masteryXP,
    }));
  };
  Store.masteredCount = (sid) => Store.mastery(sid).filter((m) => m.done).length;
  function mapAchievements(list) {
    const rank = { bronze: 1, silver: 2, gold: 3, special: 4, legend: 5 };
    return (list || [])
      .map((a) => Object.assign({}, Store.catItem(a.achievementId) || { name: 'Unknown', tier: 'bronze', icon: 'medal', series: '', description: '' }, { date: a.date }))
      .sort((a, b) => (rank[b.tier] || 0) - (rank[a.tier] || 0));
  }
  Store.achievementsOf = function (sid) {
    const s = Store.student(sid);
    if (!s) return [];
    return mapAchievements(s.achievements);
  };
  Store.coachAchievements = function () {
    return mapAchievements((db.settings.coach || {}).achievements || []);
  };
  Store.updateCoach = function (patch) {
    db.settings.coach = Object.assign(
      { name: 'Coach', title: '', bio: '', photo: null, achievements: [] },
      db.settings.coach || {}, patch
    );
    Store.save();
    return db.settings.coach;
  };
  Store.levelOf = function (sid) {
    const score = Store.score(sid);
    const topics = Store.masteredCount(sid);
    const ach = Store.achievementsOf(sid).length;
    const levels = db.settings.levels;
    let idx = 0;
    levels.forEach((l, i) => {
      if (score >= (l.minScore || 0) && topics >= (l.minTopics || 0) && ach >= (l.minAchievements || 0)) idx = i;
    });
    const cur = levels[idx];
    const next = levels[idx + 1] || null;
    let progress = 1;
    if (next) {
      const parts = [];
      if ((next.minScore || 0) > (cur.minScore || 0)) parts.push((score - cur.minScore) / (next.minScore - cur.minScore));
      if ((next.minTopics || 0) > (cur.minTopics || 0)) parts.push((topics - cur.minTopics) / (next.minTopics - cur.minTopics));
      if ((next.minAchievements || 0) > (cur.minAchievements || 0)) parts.push((ach - cur.minAchievements) / (next.minAchievements - cur.minAchievements));
      progress = parts.length ? Math.min.apply(null, parts) : 1;
      progress = Math.max(0, Math.min(1, progress));
    }
    return { idx, cur, next, progress, score, topics, ach, isMax: !next, isLegend: idx === levels.length - 1 };
  };
  Store.ranking = function () {
    return db.students
      .map((s) => ({ s, score: Store.score(s.id), solved: Store.solvedCount(s.id) }))
      .sort((a, b) => b.score - a.score || b.solved - a.solved || a.s.name.localeCompare(b.s.name));
  };
  Store.globalRank = function (sid) {
    const r = Store.ranking();
    const i = r.findIndex((x) => x.s.id === sid);
    return { rank: i < 0 ? null : i + 1, total: r.length };
  };
  Store.leaderboard = function (groupId) {
    return Store.ranking()
      .filter((x) => !groupId || x.s.groupId === groupId)
      .map((x) => ({ s: x.s, score: x.score, solved: x.solved, level: Store.levelOf(x.s.id) }));
  };

  /* ---------------- derived: history ---------------- */
  // Build a strictly time-ordered, day-deduplicated cumulative series.
  // Fixes: unsorted baselines, same-day point stacks and invalid (NaN) events.
  function cumulative(events, startT, startY) {
    const evs = events
      .filter((e) => isFinite(Number(e.t)) && isFinite(Number(e.v)))
      .map((e) => ({ t: +e.t, v: +e.v }))
      .sort((a, b) => a.t - b.t);
    let y = Number(startY) || 0;
    // baseline never sits IN FRONT of the first event (e.g. student added today
    // with solves backdated earlier) — that would draw the line backwards
    let t0 = isFinite(startT) ? startT : (evs[0] ? evs[0].t : Date.now());
    if (evs.length && t0 > evs[0].t) t0 = evs[0].t - 86400000; // step one day back so the baseline stays its own point
    const pts = [{ t: t0, y }];
    const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
    evs.forEach((e) => {
      y += e.v;
      if (dayOf(e.t) === dayOf(pts[pts.length - 1].t)) pts[pts.length - 1] = { t: e.t, y };
      else pts.push({ t: e.t, y });
    });
    // final guarantee: strictly ascending, one point per day (latest wins)
    pts.sort((a, b) => a.t - b.t);
    const out = [];
    pts.forEach((p) => {
      if (out.length && dayOf(out[out.length - 1].t) === dayOf(p.t)) out[out.length - 1] = p;
      else out.push(p);
    });
    return out;
  }
  function minT(events) {
    return events.reduce((m, e) => (isFinite(e.t) ? Math.min(m, e.t) : m), Infinity);
  }
  Store.scoreHistory = function (sid) {
    const s = Store.student(sid);
    const evs = [];
    Store.solvesOf(sid).forEach((x) => evs.push({ t: new Date(x.date + 'T10:00:00').getTime(), v: Number(x.problem.score) || 0 }));
    Store.resultsOf(sid).forEach((r) => evs.push({ t: new Date(r.contest.date + 'T16:00:00').getTime(), v: Number(r.points) || 0 }));
    return cumulative(evs, s ? new Date(s.joinDate + 'T09:00:00').getTime() : undefined, Store.adjustOf(sid).score);
  };
  Store.solvedHistory = function (sid) {
    const s = Store.student(sid);
    const a = Store.adjustOf(sid);
    const evs = Store.solvesOf(sid).map((x) => ({ t: new Date(x.date + 'T10:00:00').getTime(), v: 1 }));
    return cumulative(evs, s ? new Date(s.joinDate + 'T09:00:00').getTime() : undefined, a.easy + a.medium + a.hard);
  };
  Store.contestPerf = function (sid) {
    return Store.resultsOf(sid).map((r) => ({
      t: new Date(r.contest.date + 'T16:00:00').getTime(),
      label: r.contest.name, points: Number(r.points) || 0, rank: r.rank, solved: r.solved,
    }));
  };

  /* ---------------- derived: groups & academy ---------------- */
  Store.groupStats = function (gid) {
    const members = db.students.filter((s) => s.groupId === gid);
    const scores = members.map((m) => Store.score(m.id));
    const solved = members.reduce((a, m) => a + Store.solvedCount(m.id), 0);
    const lb = Store.leaderboard(gid);
    return {
      members, count: members.length, solved,
      avgScore: members.length ? Math.round(scores.reduce((a, b) => a + b, 0) / members.length) : 0,
      top: lb[0] || null,
      assigned: db.problems.filter((p) => p.groupIds.includes(gid)),
    };
  };
  Store.academyStats = function () {
    const solved = db.students.reduce((a, s) => a + Store.solvedCount(s.id), 0);
    const achAwards = db.students.reduce((a, s) => a + s.achievements.length, 0);
    const scores = db.students.map((s) => Store.score(s.id));
    return {
      students: db.students.length,
      solved, contests: db.contests.length,
      achievements: achAwards,
      catalogSize: db.catalog.length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      totalScore: scores.reduce((a, b) => a + b, 0),
    };
  };
  Store.academyMonthly = function (months) {
    months = months || 8;
    const out = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()], y: d.getFullYear(), m: d.getMonth(), count: 0 });
    }
    db.students.forEach((s) => s.solves.forEach((sv) => {
      const d = new Date(sv.date + 'T12:00:00');
      const slot = out.find((o) => o.y === d.getFullYear() && o.m === d.getMonth());
      if (slot) slot.count++;
    }));
    return out;
  };
  Store.academyScoreGrowth = function () {
    const evs = [];
    db.students.forEach((s) => {
      s.solves.forEach((sv) => {
        const p = Store.problem(sv.problemId);
        if (p) evs.push({ t: new Date(sv.date + 'T10:00:00').getTime(), v: Number(p.score) || 0 });
      });
    });
    db.contests.forEach((c) => c.results.forEach((r) => {
      evs.push({ t: new Date(c.date + 'T16:00:00').getTime(), v: Number(r.points) || 0 });
    }));
    const t0 = minT(evs);
    return cumulative(evs, isFinite(t0) ? t0 - 86400000 : undefined);
  };
  Store.groupScoreGrowth = function (gid) {
    const members = db.students.filter((s) => s.groupId === gid);
    if (!members.length) return [];
    const evs = [];
    members.forEach((s) => {
      Store.solvesOf(s.id).forEach((x) => evs.push({ t: new Date(x.date + 'T10:00:00').getTime(), v: (Number(x.problem.score) || 0) / members.length }));
      Store.resultsOf(s.id).forEach((r) => evs.push({ t: new Date(r.contest.date + 'T16:00:00').getTime(), v: (Number(r.points) || 0) / members.length }));
    });
    const t0 = minT(evs);
    return cumulative(evs, isFinite(t0) ? t0 - 86400000 : undefined);
  };
  Store.groupTopicMatrix = function () {
    const topics = db.settings.topics.map((t) => t.name);
    const rows = db.groups.map((g) => {
      const members = db.students.filter((s) => s.groupId === g.id);
      const cells = db.settings.topics.map((t) => {
        if (!members.length) return { pct: 0 };
        const sum = members.reduce((a, m) => a + Math.min(1, (Store.topicXP(m.id)[t.name] || 0) / t.masteryXP), 0);
        return { pct: sum / members.length };
      });
      return { group: g, cells };
    });
    return { topics, rows };
  };
  Store.recentSolves = function (n) {
    const all = [];
    db.students.forEach((s) => s.solves.forEach((sv) => {
      const p = Store.problem(sv.problemId);
      if (p) all.push({ student: s, problem: p, date: sv.date, via: sv.via || null });
    }));
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, n || 20);
  };
  Store.problemSolvers = (pid) => db.students.filter((s) => s.solves.some((sv) => sv.problemId === pid));

  /* ================================================================
     MUTATIONS (admin)
     ================================================================ */

  /* ----- students ----- */
  Store.addStudent = function (data) {
    const s = {
      id: uid('st'), name: data.name.trim(), photo: data.photo || null,
      groupId: data.groupId || null,
      joinDate: data.joinDate || todayStr(),
      cfHandle: String(data.cfHandle || '').trim() || null,
      groupHistory: data.groupId ? [{ groupId: data.groupId, from: data.joinDate || todayStr(), to: null }] : [],
      solves: [], achievements: [],
      adjust: data.adjust || { score: 0, easy: 0, medium: 0, hard: 0 },
    };
    db.students.push(s);
    const g = Store.group(s.groupId);
    Store.log('student', `${s.name} joined the academy${g ? ' (' + g.name + ')' : ''}`);
    Store.save();
    return s;
  };
  Store.updateStudent = function (id, data) {
    const s = Store.student(id);
    if (!s) return null;
    if (data.name != null) s.name = data.name.trim();
    if (data.joinDate) s.joinDate = data.joinDate;
    if (data.photo !== undefined) s.photo = data.photo;
    if (data.cfHandle !== undefined) s.cfHandle = String(data.cfHandle || '').trim() || null;
    if (data.adjust) {
      const i = (v) => Math.trunc(Number(v) || 0);
      s.adjust = {
        score: i(data.adjust.score),
        easy: Math.max(0, i(data.adjust.easy)),
        medium: Math.max(0, i(data.adjust.medium)),
        hard: Math.max(0, i(data.adjust.hard)),
      };
    }
    if (data.groupId && data.groupId !== s.groupId) Store.setStudentGroup(id, data.groupId, true);
    Store.save();
    return s;
  };
  Store.setStudentGroup = function (id, gid, silent) {
    const s = Store.student(id);
    if (!s || s.groupId === gid) return;
    const open = s.groupHistory.find((h) => !h.to);
    if (open) open.to = todayStr();
    if (gid) s.groupHistory.push({ groupId: gid, from: todayStr(), to: null });
    const g = Store.group(gid);
    s.groupId = gid;
    if (!silent) Store.log('group', `${s.name} moved to ${g ? g.name : '—'}`);
    Store.save();
  };
  Store.deleteStudent = function (id) {
    const s = Store.student(id);
    if (!s) return;
    db.students = db.students.filter((x) => x.id !== id);
    db.contests.forEach((c) => { c.results = c.results.filter((r) => r.studentId !== id); });
    Store.log('system', `Student ${s.name} was removed`);
    Store.save();
  };
  Store.hasAchievement = (sid, aid) => {
    const s = Store.student(sid);
    return !!(s && s.achievements.some((a) => a.achievementId === aid));
  };
  Store.toggleAchievement = function (sid, aid, on) {
    const s = Store.student(sid), c = Store.catItem(aid);
    if (!s || !c) return;
    const has = Store.hasAchievement(sid, aid);
    if (on && !has) {
      s.achievements.push({ achievementId: aid, date: todayStr() });
      Store.log('achievement', `${s.name} earned “${c.name}”`);
    } else if (!on && has) {
      s.achievements = s.achievements.filter((a) => a.achievementId !== aid);
    }
    Store.save();
  };

  /* ----- groups ----- */
  Store.addGroup = function (data) {
    const g = { id: uid('g'), name: data.name.trim(), description: data.description || '', createdAt: todayStr() };
    db.groups.push(g);
    Store.log('group', `Group “${g.name}” was created`);
    Store.save();
    return g;
  };
  Store.updateGroup = function (id, data) {
    const g = Store.group(id);
    if (!g) return null;
    if (data.name != null) g.name = data.name.trim();
    if (data.description != null) g.description = data.description;
    Store.save();
    return g;
  };
  Store.deleteGroup = function (id) {
    const g = Store.group(id);
    if (!g) return { ok: false, error: 'Group not found' };
    if (db.students.some((s) => s.groupId === id)) return { ok: false, error: 'Move all students out of this group first.' };
    db.groups = db.groups.filter((x) => x.id !== id);
    db.problems.forEach((p) => { p.groupIds = p.groupIds.filter((x) => x !== id); });
    Store.log('group', `Group “${g.name}” was deleted`);
    Store.save();
    return { ok: true };
  };

  /* ----- problems ----- */
  Store.addProblem = function (data) {
    const p = {
      id: uid('p'), name: data.name.trim(), link: (data.link || '').trim(),
      topic: data.topic, difficulty: data.difficulty,
      score: Number(data.score) || 0, xp: Number(data.xp) || 0,
      groupIds: data.groupIds || [],
    };
    db.problems.push(p);
    Store.log('problem', `New problem “${p.name}” added to the library`);
    Store.save();
    return p;
  };
  Store.updateProblem = function (id, data) {
    const p = Store.problem(id);
    if (!p) return null;
    ['name', 'link', 'topic', 'difficulty'].forEach((k) => { if (data[k] != null) p[k] = typeof data[k] === 'string' ? data[k].trim() : data[k]; });
    if (data.score != null) p.score = Number(data.score) || 0;
    if (data.xp != null) p.xp = Number(data.xp) || 0;
    if (data.groupIds) p.groupIds = data.groupIds;
    Store.save();
    return p;
  };
  Store.deleteProblem = function (id) {
    const p = Store.problem(id);
    if (!p) return;
    db.problems = db.problems.filter((x) => x.id !== id);
    db.students.forEach((s) => { s.solves = s.solves.filter((sv) => sv.problemId !== id); });
    Store.log('problem', `Problem “${p.name}” was removed`);
    Store.save();
  };
  Store.setSolve = function (sid, pid, on, date) {
    const s = Store.student(sid), p = Store.problem(pid);
    if (!s || !p) return false;
    const has = s.solves.some((sv) => sv.problemId === pid);
    if (on && !has) {
      s.solves.push({ problemId: pid, date: date || todayStr() });
      Store.log('solve', `${s.name} solved “${p.name}” (+${p.score} pts)`);
    } else if (!on && has) {
      s.solves = s.solves.filter((sv) => sv.problemId !== pid);
      Store.log('solve', `Solve removed: ${s.name} — “${p.name}”`);
    }
    Store.save();
    return true;
  };

  /* ----- contests ----- */
  function bakeResults(entries) {
    // entries: [{studentId, solved}] in rank order -> attach rank & points
    const beyond = Number(db.settings.contestPointsBeyond) || 0;
    return entries
      .filter((e) => e.studentId)
      .map((e, i) => ({
        studentId: e.studentId, rank: i + 1,
        solved: Math.max(0, Number(e.solved) || 0),
        points: db.settings.contestPoints[i] != null ? Number(db.settings.contestPoints[i]) : beyond,
      }));
  }
  Store.addContest = function (data) {
    const c = {
      id: uid('c'), name: data.name.trim(), date: data.date || todayStr(),
      description: data.description || '',
      results: bakeResults(data.entries || []),
    };
    db.contests.push(c);
    db.contests.sort((a, b) => a.date.localeCompare(b.date));
    const first = c.results[0] && Store.student(c.results[0].studentId);
    Store.log('contest', `Contest “${c.name}” — won by ${first ? first.name : '—'}`);
    Store.save();
    return c;
  };
  Store.updateContest = function (id, data) {
    const c = Store.contest(id);
    if (!c) return null;
    if (data.name != null) c.name = data.name.trim();
    if (data.date) c.date = data.date;
    if (data.description != null) c.description = data.description;
    if (data.entries) c.results = bakeResults(data.entries);
    db.contests.sort((a, b) => a.date.localeCompare(b.date));
    Store.save();
    return c;
  };
  Store.deleteContest = function (id) {
    const c = Store.contest(id);
    if (!c) return;
    db.contests = db.contests.filter((x) => x.id !== id);
    Store.log('contest', `Contest “${c.name}” was removed from history`);
    Store.save();
  };

  /* ----- achievement catalog ----- */
  Store.addCatItem = function (data) {
    const a = {
      id: uid('a'), name: data.name.trim(), series: data.series || 'Custom',
      tier: data.tier || 'bronze', icon: data.icon || 'medal',
      description: data.description || '',
    };
    db.catalog.push(a);
    Store.log('achievement', `New achievement “${a.name}” added to the catalog`);
    Store.save();
    return a;
  };
  Store.updateCatItem = function (id, data) {
    const a = Store.catItem(id);
    if (!a) return null;
    ['name', 'series', 'tier', 'icon', 'description'].forEach((k) => { if (data[k] != null) a[k] = data[k]; });
    Store.save();
    return a;
  };
  Store.deleteCatItem = function (id) {
    const a = Store.catItem(id);
    if (!a) return;
    db.catalog = db.catalog.filter((x) => x.id !== id);
    db.students.forEach((s) => { s.achievements = s.achievements.filter((x) => x.achievementId !== id); });
    Store.log('achievement', `Achievement “${a.name}” was removed from the catalog`);
    Store.save();
  };

  /* ----- settings ----- */
  Store.updateSettings = function (patch) {
    Object.assign(db.settings, patch);
    Store.save();
  };
  Store.addTopic = function (name, masteryXP) {
    name = name.trim();
    if (!name) return { ok: false, error: 'Topic name required' };
    if (db.settings.topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Topic already exists' };
    db.settings.topics.push({ name, masteryXP: Number(masteryXP) || 20 });
    Store.save();
    return { ok: true };
  };
  Store.updateTopic = function (oldName, name, masteryXP) {
    const t = db.settings.topics.find((x) => x.name === oldName);
    if (!t) return { ok: false, error: 'Topic not found' };
    name = name.trim();
    if (!name) return { ok: false, error: 'Topic name required' };
    if (db.settings.topics.some((x) => x !== t && x.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Another topic has this name' };
    t.name = name; t.masteryXP = Number(masteryXP) || t.masteryXP;
    db.problems.forEach((p) => { if (p.topic === oldName) p.topic = name; });
    Store.save();
    return { ok: true };
  };
  Store.deleteTopic = function (name) {
    if (db.problems.some((p) => p.topic === name)) return { ok: false, error: 'Topic is used by existing problems — reassign them first.' };
    db.settings.topics = db.settings.topics.filter((t) => t.name !== name);
    Store.save();
    return { ok: true };
  };
  /* ---------- admin password (PBKDF2, local-only — the hash NEVER leaves
     this device; it is stripped from every cloud push) ---------- */

  // verify against a stored hash; auto-upgrades legacy cyrb53 / xlite hashes
  // to PBKDF2 on first successful use.
  Store.verifyPassword = async (pw) => {
    const stored = db.settings.passwordHash || '';
    if (stored.startsWith('pbkdf2$') || stored.startsWith('xlite$')) {
      const parts = stored.startsWith('pbkdf2$') ? stored.split('$') : null;
      const iter = parts ? Number(parts[1]) : 0;
      const salt = parts ? parts[2] : stored.split('$')[1];
      const again = await pbkdf2PW(pw, salt, parts ? iter : undefined);
      if (again === stored) return true;
      // xlite fallback produced by browsers without WebCrypto: recompute with
      // the same salt; a WebCrypto PBKDF2 string can never equal an xlite one.
      const alt = await (async () => {
        if (!parts) { let h = 'salt:' + salt; for (let i = 0; i < 90000; i++) h = hashPW(h + String(pw)); return 'xlite$' + salt + '$' + h; }
        return null;
      })();
      return alt !== null && alt === stored;
    }
    // legacy single-round cyrb53 (16 hex chars)
    if (hashPW(pw) === stored) {
      db.settings.passwordHash = await pbkdf2PW(pw, newSalt());
      Store.save();
      return true;
    }
    return false;
  };

  Store.isDefaultPassword = () => Store.verifyPassword('admin123').catch(() => false);

  // adopt a (cloud-verified) password as the local offline password too, so
  // both gates use ONE password and never drift apart
  Store.syncLocalPassword = async function (pw) {
    db.settings.passwordHash = await pbkdf2PW(pw, newSalt());
    db.settings.passwordChanged = true;
    Store.save();
  };

  Store.usesStrongPasswordStorage = () => String(db.settings.passwordHash || '').startsWith('pbkdf2$');

  Store.changePassword = async function (oldPw, newPw) {
    if (!(await Store.verifyPassword(oldPw))) return { ok: false, error: 'Current password is incorrect.' };
    if (!newPw || newPw.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
    if (newPw === 'admin123' || newPw === 'password') return { ok: false, error: 'Pick something harder to guess than that.' };
    db.settings.passwordHash = await pbkdf2PW(newPw, newSalt());
    db.settings.passwordChanged = true;
    Store.save();
    return { ok: true };
  };

  /* ----- backup / reset ----- */
  /* ---------------- join requests (public application form) ----------------
     Anyone may SUBMIT (cloud policy: anon insert). Only the signed-in coach
     may READ/UPDATE/DELETE. Without Supabase they stay local to this browser. */
  const JOIN_SQL_SNIPPET =
`create table public.join_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null, age integer, email text not null,
  level text, description text, status text not null default 'new'
);
alter table public.join_requests enable row level security;
create policy "anyone can apply" on public.join_requests for insert with check (true);
create policy "coach reads" on public.join_requests for select using (auth.role() = 'authenticated');
create policy "coach updates" on public.join_requests for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "coach deletes" on public.join_requests for delete using (auth.role() = 'authenticated');`;

  /* ================================================================
     CODEFORCES AUTO-VERIFY (v1.6)
     - `verified_solves` (public read, written ONLY by the server-side
       Edge Function with the private service key) is materialized into
       students' solves on every cloud fetch — deduped by student+problem.
     - Secret codes live ONLY as SHA-256 hashes in the private
       `student_codes` table — they are never in the cloud document and
       never touch the browser bundle. All code checks happen server-side.
     ================================================================ */
  Store._verifiedRows = [];

  Store.fetchVerifiedSolves = async function () {
    const client = cloudClient();
    if (!client) return [];
    const res = await client.from('verified_solves')
      .select('id,student_id,problem_id,student_name,problem_name,submission_id,contest_id,p_index,points,source,created_at')
      .order('created_at', { ascending: false }).limit(1000);
    if (res.error) throw res.error;
    Store._verifiedRows = res.data || [];
    return Store._verifiedRows;
  };
  Store.verifiedRows = () => Store._verifiedRows;

  // Materialize server rows into the local doc (idempotent)
  Store.applyVerifiedSolves = function (rows) {
    if (!db) return 0;
    let added = 0;
    (rows || []).forEach((r) => {
      const s = Store.student(r.student_id); if (!s) return;
      const p = Store.problem(r.problem_id); if (!p) return;
      if (s.solves.some((sv) => sv.problemId === p.id)) return; // already counted (manual or verified)
      s.solves.push({
        problemId: p.id,
        date: String(r.created_at || '').slice(0, 10) || todayStr(),
        via: r.source === 'claim' ? 'cf-submit' : 'cf-sync',
        subId: r.submission_id || null,
      });
      Store.log('solve', `${s.name} solved “${p.name}” — verified on Codeforces ✓ (+${p.score} pts)`);
      added++;
    });
    if (added > 0) Store.save(); // persists locally; if coach is signed in it also publishes, so the table & doc converge
    return added;
  };

  // After a successful public claim, fold the fresh row in immediately.
  Store.noteVerifiedRow = function (row) {
    if (!row) return;
    Store._verifiedRows.unshift(row);
    Store.applyVerifiedSolves([row]);
  };

  /* ---- calls to the Edge Function (the ONLY trusted checker) ---- */
  Store._cfCall = async function (body, needsCoach) {
    const cfg = cloudConfig(), client = cloudClient();
    if (!cfg || !client) return { ok: false, error: 'Cloud is not connected — auto-verify needs your Supabase connection.' };
    const headers = { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey };
    if (needsCoach) {
      const sess = await client.auth.getSession();
      const tok = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!tok) return { ok: false, error: 'Sign in as coach first.' };
      headers.Authorization = 'Bearer ' + tok;
    }
    let res, data = {};
    try {
      res = await fetch(cfg.url + '/functions/v1/cf-verify', { method: 'POST', headers, body: JSON.stringify(body || {}) });
      data = await res.json().catch(() => ({}));
    } catch (e) { return { ok: false, error: 'Auto-verify server unreachable. Is the cf-verify Edge Function deployed? See the Supabase guide, Step 9.' }; }
    return { ok: data && data.ok === true, data: data || {}, status: res && res.status };
  };
  Store.cfClaim = (code, problem) => Store._cfCall({ action: 'claim', code, problem }, false);
  Store.cfWhoAmI = (code) => Store._cfCall({ action: 'whoami', code }, false);
  Store.cfSync = () => Store._cfCall({ action: 'sync' }, true);
  Store.cfCodeStatus = () => Store._cfCall({ action: 'code-status' }, true);
  Store.cfGenerateCode = (studentId) => Store._cfCall({ action: 'set-code', studentId }, true);
  Store.cfRevokeCode = (studentId) => Store._cfCall({ action: 'revoke-code', studentId }, true);

  Store.joinSQL = () => JOIN_SQL_SNIPPET;

  Store.joinRequests = () => db.joinRequests;
  Store.newJoinCount = () => db.joinRequests.filter((r) => r.status === 'new').length;

  Store.addJoinRequest = async function (req) {
    const clean = (v, n) => String(v || '').replace(/[<>]/g, '').trim().slice(0, n);
    const age = parseInt(req.age, 10);
    const jr = {
      name: clean(req.name, 60), email: clean(req.email, 90),
      age: isFinite(age) ? Math.max(4, Math.min(120, age)) : null,
      level: clean(req.level, 120), description: clean(req.description, 600),
      status: 'new', createdAt: new Date().toISOString(),
    };
    if (!jr.name || !jr.email) return { ok: false, error: 'missing-fields' };
    Store.log('request', `Join request from ${jr.name}`);
    const client = cloudClient();
    if (client) { // anonymous insert allowed by RLS policy — no auth needed
      try {
        const res = await client.from('join_requests').insert({
          name: jr.name, age: jr.age, email: jr.email, level: jr.level, description: jr.description, status: 'new',
        });
        if (res.error) throw res.error;
        Store.save();
        return { ok: true, where: 'cloud' };
      } catch (e) { /* table missing or offline -> local fallback below */ }
    }
    jr.id = uid('jr');
    db.joinRequests.unshift(jr);
    Store.save();
    return { ok: true, where: 'local' };
  };

  // coach-only: pull applications from the cloud into the local cache
  Store.fetchJoinRequests = async function () {
    const client = cloudClient();
    if (!client || !Cloud.authed) return { ok: false, reason: 'not-authed' };
    try {
      const res = await client.from('join_requests').select('*').order('created_at', { ascending: false }).limit(200);
      if (res.error) throw res.error;
      const localOnly = db.joinRequests.filter((x) => !x.cloudId);
      db.joinRequests = (res.data || []).map((r) => ({
        cloudId: r.id, name: r.name, age: r.age, email: r.email,
        level: r.level || '', description: r.description || '',
        status: r.status || 'new', createdAt: r.created_at,
      })).concat(localOnly);
      Store.save();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'fetch-failed', error: String(e && e.message || e), code: e && e.code };
    }
  };

  Store.setJoinStatus = async function (item, status) {
    if (item.cloudId && cloudClient() && Cloud.authed) {
      try {
        const res = await cloudClient().from('join_requests').update({ status }).eq('id', item.cloudId);
        if (res.error) throw res.error;
      } catch (e) { /* keep local change anyway */ }
    }
    const local = db.joinRequests.find((x) => x === item || (item.cloudId && x.cloudId === item.cloudId) || (item.id && x.id === item.id));
    if (local) local.status = status;
    Store.save();
  };

  Store.deleteJoinRequest = async function (item) {
    if (item.cloudId && cloudClient() && Cloud.authed) {
      try {
        const res = await cloudClient().from('join_requests').delete().eq('id', item.cloudId);
        if (res.error) throw res.error;
      } catch (e) { /* keep going */ }
    }
    db.joinRequests = db.joinRequests.filter((x) => x !== item && !(item.cloudId && x.cloudId === item.cloudId) && !(item.id && x.id === item.id));
    Store.log('request', `Join request from ${item.name} was removed`);
    Store.save();
  };

  /* ---------------- questions (public "ask the coach" form) ----------------
     Same security model as join requests: anyone may ASK (anon insert),
     only the signed-in coach may read / mark-read / delete. */
  const QUESTION_SQL_SNIPPET =
`create table public.questions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null, age integer, email text not null,
  level text, question text not null, status text not null default 'new'
);
alter table public.questions enable row level security;
create policy "anyone can ask" on public.questions for insert with check (true);
create policy "coach reads questions" on public.questions for select using (auth.role() = 'authenticated');
create policy "coach updates questions" on public.questions for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "coach deletes questions" on public.questions for delete using (auth.role() = 'authenticated');`;
  Store.questionsSQL = () => QUESTION_SQL_SNIPPET;

  Store.questions = () => db.questions;
  Store.newQuestionCount = () => db.questions.filter((r) => r.status === 'new').length;

  Store.addQuestion = async function (req) {
    const clean = (v, n) => String(v || '').replace(/[<>]/g, '').trim().slice(0, n);
    const age = parseInt(req.age, 10);
    const q = {
      name: clean(req.name, 60), email: clean(req.email, 90),
      age: isFinite(age) ? Math.max(4, Math.min(120, age)) : null,
      level: clean(req.level, 120), question: clean(req.question, 800),
      status: 'new', createdAt: new Date().toISOString(),
    };
    if (!q.name || !q.email || !q.question) return { ok: false, error: 'missing-fields' };
    Store.log('question', `Question from ${q.name}`);
    const client = cloudClient();
    if (client) { // anonymous insert allowed by RLS policy — no auth needed
      try {
        const res = await client.from('questions').insert({
          name: q.name, age: q.age, email: q.email, level: q.level, question: q.question, status: 'new',
        });
        if (res.error) throw res.error;
        Store.save();
        return { ok: true, where: 'cloud' };
      } catch (e) { /* table missing or offline -> local fallback below */ }
    }
    q.id = uid('q');
    db.questions.unshift(q);
    Store.save();
    return { ok: true, where: 'local' };
  };

  // coach-only: pull questions from the cloud into the local cache
  Store.fetchQuestions = async function () {
    const client = cloudClient();
    if (!client || !Cloud.authed) return { ok: false, reason: 'not-authed' };
    try {
      const res = await client.from('questions').select('*').order('created_at', { ascending: false }).limit(200);
      if (res.error) throw res.error;
      const localOnly = db.questions.filter((x) => !x.cloudId);
      db.questions = (res.data || []).map((r) => ({
        cloudId: r.id, name: r.name, age: r.age, email: r.email,
        level: r.level || '', question: r.question || '',
        status: r.status || 'new', createdAt: r.created_at,
      })).concat(localOnly);
      Store.save();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'fetch-failed', error: String(e && e.message || e), code: e && e.code };
    }
  };

  Store.setQuestionStatus = async function (item, status) {
    if (item.cloudId && cloudClient() && Cloud.authed) {
      try {
        const res = await cloudClient().from('questions').update({ status }).eq('id', item.cloudId);
        if (res.error) throw res.error;
      } catch (e) { /* keep local change anyway */ }
    }
    const local = db.questions.find((x) => x === item || (item.cloudId && x.cloudId === item.cloudId) || (item.id && x.id === item.id));
    if (local) local.status = status;
    Store.save();
  };

  Store.deleteQuestion = async function (item) {
    if (item.cloudId && cloudClient() && Cloud.authed) {
      try {
        const res = await cloudClient().from('questions').delete().eq('id', item.cloudId);
        if (res.error) throw res.error;
      } catch (e) { /* keep going */ }
    }
    db.questions = db.questions.filter((x) => x !== item && !(item.cloudId && x.cloudId === item.cloudId) && !(item.id && x.id === item.id));
    Store.log('question', `Question from ${item.name} was removed`);
    Store.save();
  };

  Store.exportJSON = function () {
    return JSON.stringify({ app: 'abdelmajid-cp', version: VER, exportedAt: new Date().toISOString(), data: db }, null, 2);
  };
  Store.validateBackup = function (obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a valid backup object.' };
    const data = obj.data && obj.data.students ? obj.data : (obj.students ? obj : null);
    if (!data) return { ok: false, error: 'Missing data — expected { data: {...} } or a raw database object.' };
    const need = ['students', 'groups', 'problems', 'contests', 'catalog', 'activity', 'settings'];
    for (const k of need) if (data[k] === undefined) return { ok: false, error: `Backup is missing “${k}”.` };
    if (!Array.isArray(data.students) || !Array.isArray(data.groups)) return { ok: false, error: 'Corrupted collections in backup.' };
    return { ok: true, data };
  };
  Store.importJSON = function (obj) {
    const v = Store.validateBackup(obj);
    if (!v.ok) return v;
    db = normalizeDB(v.data);
    Store.log('system', 'A backup was imported');
    Store.save();
    return { ok: true };
  };
  Store.resetDemo = function () {
    const pw = db ? db.settings.passwordHash : null;
    const changed = db ? db.settings.passwordChanged : false;
    db = seedDB();
    if (pw) { db.settings.passwordHash = pw; db.settings.passwordChanged = changed; }
    Store.log('system', 'Demo data was restored');
    Store.save();
  };
  Store.eraseContent = function () {
    const keepSettings = db.settings;
    db = emptyDB();
    db.settings = keepSettings;
    Store.log('system', 'All content was erased');
    Store.save();
  };
  Store.factoryReset = function () {
    localStorage.removeItem(KEY);
    db = seedDB();
    Store.save();
  };
  Store.storageSize = function () {
    try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; }
  };


  /* ---- Codeforces Auto-Verify : ONE-TIME Supabase setup (Step 8) ---- */
  const VERIFY_SQL_SNIPPET =
`-- Step 8 · Codeforces Auto-Verify tables (safe to run multiple times)
create table if not exists public.student_codes (
  student_id text primary key,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists public.code_attempts (
  key text primary key,
  fails int not null default 0,
  last timestamptz not null default now()
);
create table if not exists public.verified_solves (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  problem_id text not null,
  student_name text, problem_name text,
  submission_id bigint not null unique,
  contest_id int, p_index text, points int not null default 0,
  source text not null default 'claim',
  created_at timestamptz not null default now(),
  unique (student_id, problem_id)
);
alter table public.student_codes enable row level security;
alter table public.code_attempts enable row level security;
alter table public.verified_solves enable row level security;
-- verified_solves: everyone can READ (public scoreboard) — only the coach can delete.
-- NO insert/update policy for anyone: rows are written exclusively by the
-- Edge Function using the private service key. Never give that key to anyone.
create policy "public reads verified solves" on public.verified_solves for select using (true);
create policy "coach deletes verified solves" on public.verified_solves for delete using (auth.role() = 'authenticated');
-- student_codes & code_attempts have NO policies on purpose:
-- nobody (not even you in the browser) can read them — only the secure server function can.`;
  Store.verifySQL = () => VERIFY_SQL_SNIPPET;

  window.Store = Store;
})();
