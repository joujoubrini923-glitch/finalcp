/* ============================================================
   Abdelmajid CP — views.js : public pages
   ============================================================ */
(function () {
  /* ---------------- shared components ---------------- */
  const C = {};

  C.levelChip = (lvl, sm) => {
    const v = lvl.cur || lvl;
    const legend = (lvl.isLegend) || (lvl.cur && lvl.idx === Store.levels().length - 1);
    return `<span class="level-chip ${legend ? 'level-legend' : ''}" style="${legend ? '' : `color:${v.color};border-color:${v.color}66`};font-size:${sm ? '.72rem' : ''}">
      <i class="dot"></i>${U.esc(v.name)}</span>`;
  };

  const TIER_CLASS = { bronze: 'tier-b', silver: 'tier-s', gold: 'tier-g', special: 'tier-x', legend: 'tier-l' };
  C.tierClass = (t) => TIER_CLASS[t] || 'tier-b';
  C.achIcon = (a, big, shine) => `<span class="${C.tierClass(a.tier)}"><span class="ach-icon ${big ? 'big' : ''} ${shine ? 'shine' : ''}">${ic(a.icon || 'medal')}</span></span>`;
  C.diffTag = (d) => `<span class="tag tag-${U.esc(d)}">${U.esc(d)}</span>`;
  C.groupChip = (g) => g ? `<a class="chip" href="#/group/${g.id}">${ic('layers')}${U.esc(g.name)}</a>` : `<span class="chip">No group</span>`;
  C.rankBadge = (r) => `<span class="rank-badge ${r <= 3 ? 'r' + r : 'rx'}">${r}</span>`;

  C.statTile = (o) => `
    <div class="stat-tile reveal ${o.delay || ''}">
      <div class="st-ic">${ic(o.icon)}</div>
      <div class="st-val" data-count="${o.count != null ? o.count : ''}">${o.value != null ? U.esc(o.value) : '0'}</div>
      <div class="st-label">${U.esc(o.label)}</div>
    </div>`;

  C.empty = (o) => `
    <div class="empty reveal in">
      <div class="e-ic">${ic(o.icon || 'info')}</div>
      <h3>${U.esc(o.title || 'Nothing here yet')}</h3>
      <p>${U.esc(o.text || '')}</p>
      ${o.action || ''}
    </div>`;

  C.sectionHead = (icon, title, sub, action) => `
    <div class="section-head reveal">
      <div><h2>${ic(icon)}${U.esc(title)}</h2>${sub ? `<div class="sub">${U.esc(sub)}</div>` : ''}</div>
      ${action || ''}
    </div>`;

  C.activityIcon = (type) => ({
    solve: ['check', 'var(--green)'], contest: ['trophy', 'var(--gold)'],
    achievement: ['medal', 'var(--accent-2)'], student: ['userPlus', 'var(--accent)'],
    group: ['layers', 'var(--accent)'], problem: ['target', 'var(--orange)'],
    system: ['info', 'var(--dim)'], settings: ['settings', 'var(--dim)'],
  }[type] || ['info', 'var(--dim)']);

  C.timelineHTML = (items, limit) => {
    if (!items.length) return C.empty({ icon: 'clock', title: 'No activity yet', text: 'Solves, contests and achievements will appear here in real time.' });
    return `<div class="timeline">${items.slice(0, limit || 10).map((a) => {
      const [icon, col] = C.activityIcon(a.type);
      return `<div class="tl-item" style="--c:${col}">
        <div class="tl-text">${U.esc(a.text)}</div>
        <div class="tl-time">${U.timeAgo(a.t)}</div>
      </div>`;
    }).join('')}</div>`;
  };

  C.studentCard = (entry, rank) => {
    const s = entry.s, lvl = entry.level;
    const g = Store.group(s.groupId);
    const ach = Store.achievementsOf(s.id);
    const topCls = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
    return `<div class="card hoverable student-card reveal ${topCls}" onclick="location.hash='#/student/${s.id}'">
      ${rank ? `<span class="rank-tag">#${rank}</span>` : ''}
      ${U.avatarHTML(s, 'avatar-56')}
      <h3>${U.esc(s.name)}</h3>
      <div class="sc-head">${C.levelChip(lvl, true)}${g ? `<a class="chip" href="#/group/${g.id}" onclick="event.stopPropagation()">${U.esc(g.name)}</a>` : ''}</div>
      <div class="sc-ach">${ach.slice(0, 3).map((a) => C.achIcon(a)).join('')}${ach.length > 3 ? `<span class="more">+${ach.length - 3}</span>` : ''}</div>
      <div class="sc-stats">
        <div class="sc-stat"><b class="mono">${U.fmtNum(entry.score)}</b><span>Score</span></div>
        <div class="sc-stat"><b class="mono">${entry.solved}</b><span>Solved</span></div>
        <div class="sc-stat"><b class="mono">${lvl.topics}</b><span>Topics</span></div>
      </div>
    </div>`;
  };

  C.podiumHTML = (entries, metricLabel) => {
    // entries: [{name, sub, value, avatarHTML}] ranks 1..3 ordered visually 2,1,3
    if (entries.length < 3) return '';
    const slot = (e, cls, crown) => `
      <div class="pd-slot ${cls}">
        ${crown ? `<span class="pd-crown">${ic('crown')}</span>` : ''}
        ${e.avatarHTML || ''}
        <span class="pd-name">${U.esc(e.name)}</span>
        <span class="pd-score mono">${U.fmtNum(e.value)} ${U.esc(metricLabel || '')}</span>
        <div class="pd-bar">${e.rank}</div>
      </div>`;
    return `<div class="podium">${slot(entries[1], 'pd-2', false)}${slot(entries[0], 'pd-1', true)}${slot(entries[2], 'pd-3', false)}</div>`;
  };

  C.backLink = (href, label) => `<a class="back-link" href="${href}">${ic('arrowLeft')}${U.esc(label)}</a>`;

  const PV = {};
  window.PublicViews = PV;

  /* ============================================================ HOME */
  PV.home = (root) => {
    const st = Store.academyStats();
    const top = Store.leaderboard().slice(0, 3);
    const latest = Store.contests().slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const sb = Store.settings();

    const terminalLines = Store.leaderboard().slice(0, 5).map((e, i) =>
      `<div class="tl-line" style="animation-delay:${0.7 + i * 0.25}s"><span class="tl-rank">${String(i + 1).padEnd(3)}</span> ${U.esc(e.s.name).padEnd(22, ' ')} <b>${String(e.score).padStart(5)}</b> <span class="tl-dim">${U.esc(e.level.cur.name)}</span></div>`
    ).join('');

    root.innerHTML = `
    <div class="container page">
      <section class="hero">
        <div>
          <span class="hero-eyebrow"><i class="dot"></i>COMPETITIVE PROGRAMMING ACADEMY · TRACKER</span>
          <h1>Train. Solve.<br><span class="grad">Dominate the standings.</span></h1>
          <p class="lead">${U.esc(sb.tagline)} Follow every student, every problem, every contest — rankings, levels, topic mastery and achievements in one place.</p>
          <div class="hero-ctas">
            <a class="btn btn-primary" href="#/leaderboard">${ic('trophy')}View Leaderboard</a>
            <a class="btn btn-ghost" href="#/students">${ic('users')}Meet the Students</a>
          </div>
          <div class="hero-mini">
            <span><b>${sb.levels.length}</b>&nbsp;levels</span><span>·</span>
            <span><b>${sb.topics.length}</b>&nbsp;topics</span><span>·</span>
            <span><b>${st.catalogSize}</b>&nbsp;achievements</span><span>·</span>
            <span><b>${Store.problems().length}</b>&nbsp;problems</span>
          </div>
        </div>
        <div class="terminal reveal">
          <div class="terminal-bar">
            <span class="dot" style="background:#f87171"></span>
            <span class="dot" style="background:#fbbf24"></span>
            <span class="dot" style="background:#34d399"></span>
            <span>academy@acp: ~/rankings</span>
          </div>
          <div class="terminal-body">
            <div class="tl-line tl-cmd" style="animation-delay:.1s">$ abdelmajid-cp --leaderboard --global</div>
            <div class="tl-line tl-dim" style="animation-delay:.45s">RK  NAME                   SCORE  LEVEL</div>
            ${terminalLines || '<div class="tl-line tl-dim">— no students yet —</div>'}
            <div class="tl-line" style="animation-delay:2.2s">$ <span class="cursor"></span></div>
          </div>
        </div>
      </section>

      <section class="join-cta reveal" id="join-cta">
        <div class="jc-copy">
          <span class="jc-eyebrow"><i class="dot"></i>NEW MEMBERS WELCOME</span>
          <h2>Think you can climb this leaderboard? <span class="grad">Join the academy.</span></h2>
          <p class="muted">Send an application in 30 seconds — the coach reads every single one. Just curious? You can also ask a question, no commitment.</p>
        </div>
        <div class="jc-actions">
          <a class="btn btn-primary btn-jumbo" href="#/join">${ic('userPlus')}Join the Academy${ic('arrowRight')}</a>
          <a class="btn btn-ghost btn-jumbo" href="#/submit" title="Already a member? Submit a Codeforces-verified solve">${ic('zap')}Submit a Solve</a>
        </div>
      </section>

      ${coachCard()}

      <section class="stats-row">
        ${C.statTile({ icon: 'users', label: 'Students', count: st.students })}
        ${C.statTile({ icon: 'target', label: 'Problems Solved', count: st.solved, delay: 'reveal-d1' })}
        ${C.statTile({ icon: 'trophy', label: 'Contests Completed', count: st.contests, delay: 'reveal-d2' })}
        ${C.statTile({ icon: 'medal', label: 'Achievements Earned', count: st.achievements, delay: 'reveal-d3' })}
      </section>

      <div class="section-head reveal"><div><h2>${ic('star')}Featured Students</h2><div class="sub">Top of the global leaderboard right now</div></div>
        <a class="link-accent" href="#/leaderboard">Full ranking ${ic('arrowRight')}</a></div>
      <section class="grid grid-3" id="home-featured">
        ${top.length ? top.map((e, i) => C.studentCard(e, i + 1)).join('') : C.empty({ icon: 'users', title: 'No students yet', text: 'Once the coach adds students, the stars of the academy will shine here.', action: '<a class="btn btn-ghost btn-sm" href="#/admin">Open admin panel</a>' })}
      </section>

      <div class="section-head reveal"><div><h2>${ic('trend')}Recent Activity</h2><div class="sub">Latest solves, contests and unlocks across the academy</div></div></div>
      <section class="grid grid-2">
        <div class="card">${C.timelineHTML(Store.activity(), 8)}</div>
        <div class="card" id="home-hof">
          ${latest ? hofPreview(latest) : C.empty({ icon: 'trophy', title: 'No contests yet', text: 'The Hall of Fame is waiting for its first podium.' })}
        </div>
      </section>

      <div class="section-head reveal"><div><h2>${ic('shield')}The Ranking Ladder</h2><div class="sub">Climb from Newcomer to Legend — every point counts</div></div>
        <a class="link-accent" href="#/leaderboard">See who is on top ${ic('arrowRight')}</a></div>
      <section class="ladder reveal">
        ${sb.levels.map((l, i) => `<div class="ladder-step" style="--lc:${l.color}"><b>${U.esc(l.name)}</b><span>${U.fmtNum(l.minScore)}+ pts${l.minTopics ? ' · ' + l.minTopics + ' topics' : ''}</span></div>`).join('')}
      </section>
    </div>`;

    function coachCard() {
      // always rendered — empty fields fall back to sensible placeholders
      const co = Store.settings().coach || {};
      const ach = Store.coachAchievements();
      return `
      <section class="card coach-card reveal">
        ${U.avatarHTML({ name: co.name || 'Coach', photo: co.photo || null }, 'avatar-96')}
        <div class="coach-info">
          <span class="coach-eyebrow"><i class="dot"></i>MEET THE COACH</span>
          <h2>${U.esc(co.name || 'The Coach')}</h2>
          ${co.title ? `<div class="coach-title">${U.esc(co.title)}</div>` : ''}
          ${co.bio ? `<p class="muted">${U.esc(co.bio)}</p>` : ''}
        </div>
        <div class="coach-ach">
          ${ach.length ? `<div class="ach-row ach-labeled">
            ${ach.slice(0, 8).map((a) => `
              <span class="coach-ach-item" title="${U.esc(a.name)}${a.date ? ' · earned ' + U.fmtDate(a.date) : ''}">
                ${C.achIcon(a, false, true)}<span class="ach-name">${U.esc(a.name)}</span>
              </span>`).join('')}
            ${ach.length > 8 ? `<span class="coach-ach-item more">+${ach.length - 8} more</span>` : ''}
          </div>` : '<span class="muted tiny">No coach achievements selected yet</span>'}
        </div>
      </section>`;
    }

    function hofPreview(c) {
      const e = c.results.slice(0, 3).map((r) => ({
        name: (Store.student(r.studentId) || {}).name || '—', value: r.points, rank: r.rank,
        avatarHTML: U.avatarHTML(Store.student(r.studentId) || { name: '?' }, 'avatar-44'),
      }));
      return `
        <div class="card-title" style="margin-bottom:4px">${ic('crown')}Hall of Fame — latest</div>
        <h3 style="font-size:1.25rem;margin:8px 0 2px">${U.esc(c.name)}</h3>
        <div class="c-date muted mono tiny">${U.fmtDate(c.date)}</div>
        ${e.length === 3 ? C.podiumHTML(e, 'pts') : ''}
        <div style="margin-top:16px;text-align:center"><a class="btn btn-ghost btn-sm" href="#/contests">${ic('trophy')}All contests</a></div>`;
    }
  };

  /* ============================================================ JOIN + ASK */
  PV.join = (root) => {
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in">
        <h1>${ic('userPlus')}Join the Academy</h1>
        <p>One form, 30 seconds, a real seat on the leaderboard. The coach reviews every application personally — and answers every question.</p>
      </div>

      <section class="grid grid-2 join-grid" id="apply">
        <div class="card join-pitch reveal">
          <div class="jp-badge">${ic('grad')}</div>
          <h3>Think you've got what it takes?</h3>
          <p class="muted">Whether you're writing your first <span class="mono">if</span> statement or grinding for the national team — there's a seat (and a leaderboard) waiting for you.</p>
          <ul class="jp-list">
            <li>${ic('check')}Structured training in real groups — from Rookies to Elite</li>
            <li>${ic('check')}Weekly problems, timed contests and a live leaderboard</li>
            <li>${ic('check')}Topic mastery, levels and achievements to chase</li>
          </ul>
        </div>
        <div class="card reveal">
          <div class="card-title">${ic('userPlus')}Apply now</div>
          <form id="join-form" style="margin-top:14px">
            <div class="field-row">
              <label class="field"><span>Your name *</span><input class="input" id="jf-name" maxlength="60" placeholder="e.g. Amine Ben Salah"></label>
              <label class="field" style="max-width:110px"><span>Age</span><input class="input" id="jf-age" type="number" min="4" max="120" placeholder="14"></label>
            </div>
            <label class="field"><span>Email *</span><input class="input" id="jf-email" type="email" maxlength="90" placeholder="you@example.com"></label>
            <label class="field"><span>Your level <span class="muted tiny">(a word or two)</span></span><input class="input" id="jf-level" maxlength="120" placeholder="e.g. Beginner in C++ — solved ~50 easy problems"></label>
            <label class="field"><span>Anything else? <span class="muted tiny">(optional)</span></span><textarea class="input" id="jf-desc" rows="3" maxlength="600" placeholder="Why do you want to join? Experience, contests, goals…"></textarea></label>
            <input type="text" id="jf-web" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="join-done hidden" id="join-done">${ic('check')}<span>Application sent! The coach reviews every request and will reach out by email.</span></div>
            <button class="btn btn-primary btn-block" type="submit">${ic('arrowRight')}Send application</button>
          </form>
        </div>
      </section>

      <div class="section-head reveal" style="margin-top:34px"><div><h2>${ic('help')}Just have a question?</h2><div class="sub">Not ready to join — or wondering about schedules, groups or anything else? Ask away.</div></div></div>
      <section class="grid grid-2 join-grid" id="ask">
        <div class="card join-pitch ask-pitch reveal">
          <div class="jp-badge jp-badge-q">${ic('help')}</div>
          <h3>No strings attached</h3>
          <p class="muted">You don't need to join the academy to ask. Training times? Which group fits your level? How contests work? Type it below — the coach replies <b>by email</b>, usually within a day or two.</p>
          <ul class="jp-list jp-list-q">
            <li>${ic('check')}Asking a question is <b>not</b> an application</li>
            <li>${ic('check')}Your email is only used to answer you</li>
            <li>${ic('check')}Changed your mind later? Come back and apply anytime</li>
          </ul>
        </div>
        <div class="card reveal">
          <div class="card-title">${ic('help')}Ask the coach</div>
          <form id="question-form" style="margin-top:14px">
            <div class="field-row">
              <label class="field"><span>Your name *</span><input class="input" id="qf-name" maxlength="60" placeholder="e.g. Yasmine Trabelsi"></label>
              <label class="field" style="max-width:110px"><span>Age</span><input class="input" id="qf-age" type="number" min="4" max="120" placeholder="14"></label>
            </div>
            <label class="field"><span>Email *</span><input class="input" id="qf-email" type="email" maxlength="90" placeholder="you@example.com"></label>
            <label class="field"><span>Your level <span class="muted tiny">(a word or two)</span></span><input class="input" id="qf-level" maxlength="120" placeholder="e.g. Total beginner — never coded before"></label>
            <label class="field" style="margin-bottom:14px"><span>Your question *</span><textarea class="input" id="qf-question" rows="3" maxlength="800" placeholder="e.g. I have zero experience — can I still join? And when do trainings happen?"></textarea></label>
            <input type="text" id="qf-web" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="join-done hidden" id="q-done">${ic('check')}<span>Question sent! The coach will reply to your email soon.</span></div>
            <button class="btn btn-primary btn-block" type="submit">${ic('arrowRight')}Send question</button>
          </form>
        </div>
      </section>
    </div>`;

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const wire = (formId, honeyId, doneId, build, send, toastMsg, toastIcon) => {
      const form = U.$(`#${formId}`, root);
      if (!form) return;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (U.$(`#${honeyId}`, root).value) { form.reset(); return; } // honeypot — silently drop bots
        const data = build();
        if (!data.name) return U.toast('Your name is required', 'error');
        if (!emailRe.test(data.email)) return U.toast('Please enter a valid email address', 'error');
        if (data.needQuestion && !data.question) return U.toast('Please type your question first', 'error');
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        const r = await send(data);
        if (btn) btn.disabled = false;
        if (!r.ok) return U.toast('Something went wrong — please try again in a moment', 'error');
        form.reset();
        U.$(`#${doneId}`, root).classList.remove('hidden');
        U.toast(toastMsg, 'success', toastIcon);
        if (U.confetti) U.confetti();
      });
    };

    wire('join-form', 'jf-web', 'join-done',
      () => ({
        name: U.$('#jf-name', root).value.trim(), email: U.$('#jf-email', root).value.trim(),
        age: U.$('#jf-age', root).value, level: U.$('#jf-level', root).value,
        description: U.$('#jf-desc', root).value,
      }),
      (d) => Store.addJoinRequest(d),
      'Application sent — the coach will reach out soon!', 'userPlus');

    wire('question-form', 'qf-web', 'q-done',
      () => ({
        name: U.$('#qf-name', root).value.trim(), email: U.$('#qf-email', root).value.trim(),
        age: U.$('#qf-age', root).value, level: U.$('#qf-level', root).value,
        question: U.$('#qf-question', root).value.trim(), needQuestion: true,
      }),
      (d) => Store.addQuestion(d),
      'Question sent — the coach will reply by email!', 'help');
  };

  /* ============================================================ STUDENTS */
  /* ======================================================= SUBMIT (auto-verify) */
  PV.submit = (root) => {
    const cloud = Store.cloudEnabled && Store.cloudEnabled();
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in">
        <h1>${ic('zap')}Submit a Solve</h1>
        <p>Problems submitted here are <b>verified automatically</b> against the real Codeforces${'&trade;'} servers — no screenshots, no manual checking, no cheating.</p>
      </div>

      <section class="grid grid-2 join-grid">
        <div class="card join-pitch reveal">
          <div class="jp-badge vf-badge">${ic('shield')}</div>
          <h3>How it works</h3>
          <ol class="jp-steps">
            <li><b>1.</b> Get your <b>secret code</b> from the coach (one per student — keep it private 🤐)</li>
            <li><b>2.</b> Solve the problem on <b>codeforces.com</b> with <b>your own username</b> — verdict must be <span class="chip">Accepted</span></li>
            <li><b>3.</b> Come back here, paste the problem link + your code</li>
            <li><b>4.</b> Our server double-checks with Codeforces and awards the points instantly ⚡</li>
          </ol>
          <ul class="jp-list" style="margin-top:16px">
            <li>${ic('check')}Only <b>your own</b> accepted submissions count</li>
            <li>${ic('check')}Each submission can be counted only once</li>
            <li>${ic('lock')}Wrong codes are locked after repeated attempts</li>
          </ul>
        </div>
        <div class="card reveal">
          <div class="card-title">${ic('zap')}Verify my solve</div>
          ${cloud ? '' : `<div class="vf-offline">${ic('warn')}<span>Auto-verify needs a connection to the academy cloud and is temporarily offline. Try again later, or ask the coach to record your solve manually.</span></div>`}
          <form id="verify-form" style="margin-top:14px">
            <label class="field"><span>Your secret code *</span>
              <input class="input mono vf-code" id="vf-code" maxlength="12" placeholder="e.g. K7X2-QM91" autocomplete="off" spellcheck="false">
            </label>
            <label class="field"><span>Problem link or ID *</span>
              <input class="input mono" id="vf-problem" maxlength="120" placeholder="https://codeforces.com/problemset/problem/1234/A  — or just  1234A">
            </label>
            <input type="text" id="vf-web" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="vf-result hidden" id="vf-result"></div>
            <button class="btn btn-primary btn-block" type="submit" id="vf-btn" ${cloud ? '' : 'disabled'}>${ic('check')}Verify &amp; record my solve</button>
          </form>
          <p class="muted tiny" style="margin-top:12px">${ic('info')}Only problems from the academy library are counted. Solved something else? Tell the coach — they might add it!</p>
        </div>
      </section>
    </div>`;

    const form = U.$('#verify-form', root);
    if (!form || !cloud) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (U.$('#vf-web', root).value) { form.reset(); return; } // honeypot — silently drop bots
      const box = U.$('#vf-result', root), btn = U.$('#vf-btn', root);
      const show = (ok, html) => { box.className = 'vf-result ' + (ok ? 'vf-ok' : 'vf-err'); box.innerHTML = html; };
      const code = U.$('#vf-code', root).value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
      const raw = U.$('#vf-problem', root).value.trim();
      if (code.length < 6) return show(false, `${ic('warn')}<span>Enter your secret code (ask the coach if you lost it).</span>`);
      const cf = U.parseCFLink(raw);
      if (!cf) return show(false, `${ic('warn')}<span>That does not look like a Codeforces problem. Paste the full link or an ID like <b>1234A</b>.</span>`);
      btn.disabled = true; btn.classList.add('is-loading');
      const r = await Store.cfClaim(code, raw);
      btn.disabled = false; btn.classList.remove('is-loading');
      const d = r.data || {};
      if (r.ok) {
        Store.noteVerifiedRow(d.row);
        show(true, `${ic('check')}<span><b>Verified on Codeforces ✓</b><br>${U.esc(d.studentName || '')} solved <b>${U.esc(d.problemName || '')}</b> — <b class="vf-pts">+${d.points || 0} pts</b> added to the leaderboard.</span>`);
        form.reset();
        U.toast('Solve verified — points added! 🎉', 'success', 'zap');
        if (U.confetti) U.confetti();
        return;
      }
      const msgs = {
        'bad-code': 'Wrong secret code. Check for typos — codes are case-insensitive but every character matters.',
        'locked': 'Too many wrong codes — this code is temporarily locked. Try again later.',
        'no-code': 'This code was revoked. Ask the coach for a new one.',
        'not-accepted': 'No <b>Accepted</b> submission for this problem was found on your Codeforces account. Solve it on codeforces.com first, then come back!',
        'no-handle': 'Your Codeforces username is not set in the academy database yet — tell the coach.',
        'not-in-catalog': 'This problem is not in the academy library, so it cannot be counted yet. Ask the coach to add it.',
        'already-counted': 'This solve was already counted — each submission counts once. 😉',
        'old-submission': 'This submission is from before the auto-verify activation date, so it is not counted.',
        'cf-down': 'Codeforces is not answering right now. Try again in a minute.',
        'offline': 'Auto-verify is not deployed yet — the coach needs to finish Step 9 of the Supabase guide.',
      };
      show(false, `${ic('warn')}<span>${msgs[d.error] || r.error || msgs.offline}</span>`);
    });
  };

  PV.students = (root) => {
    const groups = Store.groups();
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('users')}Students</h1><p>Every competitor in the academy — click a card to open the full profile with stats, graphs and achievements.</p></div>
      <div class="filter-bar reveal in">
        <input class="input" id="f-q" placeholder="Search students…">
        <select class="select" id="f-group"><option value="">All groups</option>${groups.map((g) => `<option value="${g.id}">${U.esc(g.name)}</option>`).join('')}</select>
        <select class="select" id="f-sort">
          <option value="score">Sort: Score</option><option value="solved">Sort: Solved</option>
          <option value="name">Sort: Name</option><option value="joined">Sort: Newest</option>
        </select>
        <span class="spacer"></span><span class="chip" id="f-count"></span>
      </div>
      <div class="grid grid-3" id="students-grid"></div>
    </div>`;

    const grid = U.$('#students-grid', root);
    const render = () => {
      const q = U.$('#f-q', root).value.trim().toLowerCase();
      const gf = U.$('#f-group', root).value;
      const sort = U.$('#f-sort', root).value;
      let list = Store.leaderboard();
      if (gf) list = list.filter((e) => e.s.groupId === gf);
      if (q) list = list.filter((e) => e.s.name.toLowerCase().includes(q));
      if (sort === 'name') list.sort((a, b) => a.s.name.localeCompare(b.s.name));
      else if (sort === 'solved') list.sort((a, b) => b.solved - a.solved);
      else if (sort === 'joined') list.sort((a, b) => b.s.joinDate.localeCompare(a.s.joinDate));
      const rk = Store.ranking();
      U.$('#f-count', root).textContent = list.length + ' student' + (list.length === 1 ? '' : 's');
      grid.innerHTML = list.length
        ? list.map((e) => C.studentCard(e, rk.findIndex((x) => x.s.id === e.s.id) + 1)).join('')
        : C.empty({ icon: 'search', title: 'No students found', text: 'Try a different search or filter — or ask the coach to add new students.' });
      U.observeReveals(grid);
    };
    ['f-q', 'f-group', 'f-sort'].forEach((id) => U.$('#' + id, root).addEventListener('input', render));
    render();
  };

  /* ============================================================ PROFILE */
  PV.profile = (root, id) => {
    const s = Store.student(id);
    if (!s) return PV.notFound(root, 'Student not found');
    const lvl = Store.levelOf(id);
    const g = Store.group(s.groupId);
    const rank = Store.globalRank(id);
    const solves = Store.solvesOf(id);
    const byDiff = Store.solvedByDiff(id);
    const cstats = Store.contestStats(id);
    const mastery = Store.mastery(id);
    const mastered = mastery.filter((m) => m.done);
    const ach = Store.achievementsOf(id);
    const results = Store.resultsOf(id);
    const streak = Store.weeklyStreak(id);
    const pastGroups = s.groupHistory.filter((h) => h.to).map((h) => Store.group(h.groupId)).filter(Boolean);

    // donut segments
    const donut = Charts.donutHTML({
      segments: [
        { label: 'Easy', value: byDiff.easy, color: 'var(--easy)' },
        { label: 'Medium', value: byDiff.medium, color: 'var(--medium)' },
        { label: 'Hard', value: byDiff.hard, color: 'var(--hard)' },
      ],
      centerTop: solves.length, centerBottom: 'solved',
    });

    // next level requirement chips
    const reqs = lvl.next ? [
      { ok: lvl.score >= lvl.next.minScore, txt: `${U.fmtNum(lvl.next.minScore)} pts` },
      { ok: lvl.topics >= lvl.next.minTopics, txt: `${lvl.next.minTopics} topics` },
      { ok: lvl.ach >= (lvl.next.minAchievements || 0), txt: `${lvl.next.minAchievements || 0} achievements` },
    ] : [];

    root.innerHTML = `
    <div class="container page">
      ${C.backLink('#/students', 'All students')}
      <div class="card profile-head reveal in">
        ${U.avatarHTML(s, 'avatar-96')}
        <div>
          <h2 class="ph-name">${U.esc(s.name)}</h2>
          <div class="ph-chips">
            ${C.levelChip(lvl)}
            ${C.groupChip(g)}
            ${pastGroups.map((pg) => `<span class="chip muted" title="Former group">${ic('clock')}${U.esc(pg.name)}</span>`).join('')}
          </div>
          <div class="ph-meta">
            <span>${ic('calendar')}Joined ${U.fmtDate(s.joinDate)}</span>
            <span>${ic('hash')}Global rank <b class="mono">#${rank.rank || '—'}</b> of ${rank.total}</span>
            <span>${ic('layers')}${g ? U.esc(g.name) : 'No group'}</span>
          </div>
        </div>
        <div class="ph-score">
          <div class="val mono">${U.fmtNum(lvl.score)}</div>
          <div class="lbl">Academy Score</div>
        </div>
      </div>

      ${lvl.next ? `
      <div class="card reveal in" style="margin-top:18px">
        <div class="next-level">
          <div class="nl-top"><span>Progress to <b style="color:${lvl.next.color}">${U.esc(lvl.next.name)}</b></span><span class="mono">${Math.round(lvl.progress * 100)}%</span></div>
          <div class="progress"><i style="width:${(lvl.progress * 100).toFixed(1)}%"></i></div>
          <div class="nl-reqs">Requires: ${reqs.map((r) => `<span class="${r.ok ? 'ok' : ''}">${r.ok ? '✓' : '·'} ${r.txt}</span>`).join('')}</div>
        </div>
      </div>` : `
      <div class="card reveal in" style="margin-top:18px;text-align:center">
        <b style="background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:1.05rem">Maximum level reached — a living legend of the academy.</b>
      </div>`}

      <div class="grid" style="margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
        ${C.statTile({ icon: 'target', label: 'Problems Solved', value: solves.length })}
        ${C.statTile({ icon: 'trophy', label: 'Contests Played', value: cstats.count, delay: 'reveal-d1' })}
        ${C.statTile({ icon: 'crown', label: 'Podiums (Top 3)', value: cstats.podiums, delay: 'reveal-d2' })}
        ${C.statTile({ icon: 'flag', label: 'Best Contest Rank', value: cstats.best ? '#' + cstats.best : '—', delay: 'reveal-d3' })}
        ${C.statTile({ icon: 'flame', label: 'Weekly Solve Streak', value: streak + (streak === 1 ? ' wk' : ' wks') })}
      </div>

      <div class="grid grid-3" style="margin-top:18px">
        <div class="card reveal"><div class="card-title">${ic('chart')}Difficulty Split</div><div style="margin-top:16px">${donut}</div></div>
        <div class="card reveal" style="grid-column:span 2">
          <div class="card-title">${ic('trend')}Score Growth</div>
          <div class="chart" id="ch-score" style="margin-top:12px"></div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card reveal"><div class="card-title">${ic('target')}Problems Solved Over Time</div><div class="chart" id="ch-solved" style="margin-top:12px"></div></div>
        <div class="card reveal"><div class="card-title">${ic('trophy')}Contest Performance</div><div class="chart" id="ch-contest" style="margin-top:12px"></div></div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card reveal">
          <div class="card-title">${ic('zap')}Topic Mastery <span class="chip" style="margin-left:auto">${mastered.length}/${mastery.length} mastered</span></div>
          <div style="margin-top:14px;max-height:420px;overflow:auto">
            ${mastery.map((m) => `
              <div class="topic-row ${m.done ? 'mastered' : ''}">
                <span class="t-name"><span class="tn-line">${m.done ? '★ ' : ''}${U.esc(m.name)}</span>${m.done ? '<span class="mastered-tag">Mastered</span>' : ''}</span>
                <span class="progress"><i style="width:${Math.min(100, (m.xp / m.required) * 100)}%"></i></span>
                <span class="t-xp">${m.xp}/${m.required} XP</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="card reveal">
          <div class="card-title">${ic('medal')}Achievements <span class="chip" style="margin-left:auto">${ach.length}</span></div>
          <div class="ach-grid" style="margin-top:14px">
            ${ach.length ? ach.map((a, i) => `
              <div class="ach-card pop-in" style="animation-delay:${i * 0.06}s">
                ${C.achIcon(a, false, true)}
                <div><h4>${U.esc(a.name)}</h4><p>${U.esc(a.description)}</p><div class="a-date">${U.fmtDate(a.date)}</div></div>
              </div>`).join('') : `<p class="muted" style="grid-column:1/-1">No achievements yet — the first medal is the hardest. Keep solving.</p>`}
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card reveal">
          <div class="card-title">${ic('check')}Recent Solves</div>
          <div class="table-wrap" style="margin-top:10px">
            ${solves.length ? `<table class="table"><thead><tr><th>Problem</th><th>Topic</th><th>Diff</th><th>Pts</th><th>Date</th></tr></thead><tbody>
              ${solves.slice(-10).reverse().map((x) => `<tr>
                <td><a class="link-accent" href="${U.safeURL(x.problem.link)}" target="_blank" rel="noopener">${U.esc(x.problem.name)} ${ic('external')}</a>${x.via ? ' <span class="cf-badge" title="Verified automatically against the Codeforces servers">✓ CF</span>' : ''}</td>
                <td class="muted">${U.esc(x.problem.topic)}</td><td>${C.diffTag(x.problem.difficulty)}</td>
                <td class="num">+${x.problem.score}</td><td class="muted tiny mono">${U.fmtDate(x.date)}</td></tr>`).join('')}
            </tbody></table>` : `<p class="muted" style="padding:12px 4px">No solved problems yet.</p>`}
          </div>
        </div>
        <div class="card reveal">
          <div class="card-title">${ic('trophy')}Contest History</div>
          <div class="table-wrap" style="margin-top:10px">
            ${results.length ? `<table class="table"><thead><tr><th>Contest</th><th>Rank</th><th>Solved</th><th>Pts</th></tr></thead><tbody>
              ${results.slice().reverse().map((r) => `<tr>
                <td>${U.esc(r.contest.name)}<div class="muted tiny mono">${U.fmtDate(r.contest.date)}</div></td>
                <td>${C.rankBadge(r.rank)}</td><td class="num">${r.solved}</td><td class="num" style="color:var(--gold)">+${r.points}</td></tr>`).join('')}
            </tbody></table>` : `<p class="muted" style="padding:12px 4px">No contest appearances yet.</p>`}
          </div>
        </div>
      </div>
    </div>`;

    Charts.line(U.$('#ch-score', root), { series: [{ name: 'Score', points: Store.scoreHistory(id), color: '#38bdf8' }] });
    Charts.line(U.$('#ch-solved', root), { series: [{ name: 'Solved', points: Store.solvedHistory(id), color: '#34d399' }], height: 230 });
    const perf = Store.contestPerf(id);
    if (perf.length) {
      Charts.bars(U.$('#ch-contest', root), {
        items: perf.map((p) => ({ label: p.label.length > 14 ? p.label.slice(0, 13) + '…' : p.label, value: p.points, hint: `Rank #${p.rank} · ${p.solved} solved`, color: p.rank <= 3 ? 'var(--gold)' : 'var(--accent)' })),
        height: 230,
      });
    } else U.$('#ch-contest', root).innerHTML = Charts.empty('No contests yet');
  };

  /* ============================================================ GROUPS */
  PV.groups = (root) => {
    const gs = Store.groups();
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('layers')}Groups</h1><p>Students train in groups. Each group has its own assigned problems, internal leaderboard and analytics.</p></div>
      <div class="grid grid-3" id="groups-grid">
        ${gs.length ? gs.map((g, i) => {
      const st = Store.groupStats(g.id);
      return `<div class="card hoverable reveal" style="cursor:pointer" onclick="location.hash='#/group/${g.id}'">
            <div class="card-title">${ic('layers')}${U.esc(g.name)}</div>
            <p class="muted" style="margin:10px 0 16px;font-size:.9rem;line-height:1.55;min-height:44px">${U.esc(g.description || '—')}</p>
            <div class="sc-stats" style="border:none;padding-top:0;margin-top:0">
              <div class="sc-stat"><b>${st.count}</b><span>Students</span></div>
              <div class="sc-stat"><b>${U.fmtNum(st.avgScore)}</b><span>Avg score</span></div>
              <div class="sc-stat"><b>${st.solved}</b><span>Solved</span></div>
              <div class="sc-stat"><b>${st.assigned.length}</b><span>Problems</span></div>
            </div>
            <hr class="divider">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar-stack">${st.members.slice(0, 5).map((m) => U.avatarHTML(m, 'avatar-36')).join('')}</div>
              ${st.top ? `<span class="muted tiny">Top: <b>${U.esc(st.top.s.name)}</b></span>` : '<span class="muted tiny">No members yet</span>'}
              <span class="spacer"></span><span class="link-accent">${ic('chevronRight')}</span>
            </div>
          </div>`;
    }).join('') : C.empty({ icon: 'layers', title: 'No groups yet', text: 'The coach can create groups from the admin panel to organize training.' })}
      </div>
    </div>`;
  };

  /* ============================================================ GROUP DETAIL */
  PV.groupDetail = (root, id) => {
    const g = Store.group(id);
    if (!g) return PV.notFound(root, 'Group not found');
    const st = Store.groupStats(id);
    const lb = Store.leaderboard(id);
    const allSolved = { easy: 0, medium: 0, hard: 0 };
    st.members.forEach((m) => {
      const d = Store.solvedByDiff(m.id);
      allSolved.easy += d.easy; allSolved.medium += d.medium; allSolved.hard += d.hard;
    });

    root.innerHTML = `
    <div class="container page">
      ${C.backLink('#/groups', 'All groups')}
      <div class="card profile-head reveal in" style="grid-template-columns:1fr auto">
        <div>
          <div class="ph-chips" style="margin-bottom:10px"><span class="chip">${ic('layers')}${st.count} members</span><span class="chip">${ic('target')}${st.assigned.length} assigned problems</span></div>
          <h2 class="ph-name">${U.esc(g.name)}</h2>
          <p class="muted" style="max-width:560px;line-height:1.6">${U.esc(g.description || '')}</p>
          <div class="ph-meta" style="margin-top:12px">
            <span>${ic('calendar')}Created ${U.fmtDate(g.createdAt)}</span>
            <span>${ic('trend')}Total solved <b class="mono">${st.solved}</b></span>
          </div>
        </div>
        <div class="ph-score"><div class="val mono">${U.fmtNum(st.avgScore)}</div><div class="lbl">Average Score</div></div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card reveal">
          <div class="card-title">${ic('trophy')}Group Leaderboard</div>
          <div class="table-wrap" style="margin-top:10px">
          ${lb.length ? `<table class="table"><thead><tr><th>#</th><th>Student</th><th>Level</th><th>Solved</th><th>Score</th></tr></thead><tbody>
            ${lb.map((e, i) => `<tr style="cursor:pointer" onclick="location.hash='#/student/${e.s.id}'">
              <td class="rank-cell ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</td>
              <td><div style="display:flex;align-items:center;gap:10px">${U.avatarHTML(e.s, 'avatar-36')}<b>${U.esc(e.s.name)}</b></div></td>
              <td>${C.levelChip(e.level, true)}</td><td class="num">${e.solved}</td><td class="num" style="color:var(--accent)">${U.fmtNum(e.score)}</td></tr>`).join('')}
          </tbody></table>` : `<p class="muted" style="padding:12px 4px">No members in this group yet.</p>`}
          </div>
        </div>
        <div class="card reveal">
          <div class="card-title">${ic('chart')}Group Analytics</div>
          <div style="margin-top:14px">
            <div class="muted tiny" style="margin-bottom:6px">Solves by difficulty</div>
            ${Charts.donutHTML({
      segments: [
        { label: 'Easy', value: allSolved.easy, color: 'var(--easy)' },
        { label: 'Medium', value: allSolved.medium, color: 'var(--medium)' },
        { label: 'Hard', value: allSolved.hard, color: 'var(--hard)' },
      ], centerTop: st.solved, centerBottom: 'team solves',
    })}
          </div>
          <hr class="divider">
          <div class="muted tiny" style="margin-bottom:8px">Average member score growth</div>
          <div class="chart" id="ch-group"></div>
        </div>
      </div>

      <div class="card reveal" style="margin-top:18px">
        <div class="card-title">${ic('target')}Assigned Problems <span class="chip" style="margin-left:auto">${st.assigned.length}</span></div>
        <div class="table-wrap" style="margin-top:10px">
        ${st.assigned.length ? `<table class="table"><thead><tr><th>Problem</th><th>Topic</th><th>Difficulty</th><th>Score</th><th>XP</th><th>Solved by</th></tr></thead><tbody>
          ${st.assigned.map((p) => {
      const solvers = Store.problemSolvers(p.id).filter((s) => s.groupId === id).length;
      return `<tr>
            <td><a class="link-accent" href="${U.safeURL(p.link)}" target="_blank" rel="noopener">${U.esc(p.name)} ${ic('external')}</a></td>
            <td class="muted">${U.esc(p.topic)}</td><td>${C.diffTag(p.difficulty)}</td>
            <td class="num">${p.score}</td><td class="num" style="color:var(--accent-2)">${p.xp} XP</td>
            <td><span class="chip">${ic('users')}${solvers}/${st.count}</span></td></tr>`;
    }).join('')}
        </tbody></table>` : `<p class="muted" style="padding:12px 4px">No problems assigned to this group yet.</p>`}
        </div>
      </div>
    </div>`;

    Charts.line(U.$('#ch-group', root), { series: [{ name: 'Avg score', points: Store.groupScoreGrowth(id), color: '#a78bfa' }], height: 210 });
  };

  /* ============================================================ LEADERBOARD */
  PV.leaderboard = (root) => {
    const groups = Store.groups();
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('trophy')}Leaderboard</h1><p>Global academy ranking by score — contest points and solved problems combined.</p></div>
      <div class="filter-bar reveal in" id="lb-tabs">
        <button class="btn btn-sm btn-primary" data-g="">Global</button>
        ${groups.map((g) => `<button class="btn btn-sm btn-ghost" data-g="${g.id}">${U.esc(g.name)}</button>`).join('')}
      </div>
      <div id="lb-body"></div>
    </div>`;

    const body = U.$('#lb-body', root);
    const renderLB = (gid) => {
      const lb = Store.leaderboard(gid || null);
      if (!lb.length) { body.innerHTML = C.empty({ icon: 'trophy', title: 'No ranking yet', text: gid ? 'This group has no members yet.' : 'Students will appear here once added by the coach.' }); return; }
      const top3 = lb.slice(0, 3).map((e, i) => ({ name: e.s.name, value: e.score, rank: i + 1, avatarHTML: U.avatarHTML(e.s, 'avatar-56') }));
      body.innerHTML = `
        ${lb.length >= 3 ? `<div class="card reveal in" style="padding-top:26px">${C.podiumHTML(top3, 'pts')}</div>` : ''}
        <div class="card reveal in" style="margin-top:18px">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Rank</th><th>Student</th><th>Level</th><th>Group</th><th>Solved</th><th>Score</th></tr></thead>
            <tbody>
              ${lb.map((e, i) => {
        const g = Store.group(e.s.groupId);
        return `<tr style="cursor:pointer" onclick="location.hash='#/student/${e.s.id}'">
                <td class="rank-cell ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</td>
                <td><div style="display:flex;align-items:center;gap:10px">${U.avatarHTML(e.s, 'avatar-36')}<b>${U.esc(e.s.name)}</b></div></td>
                <td>${C.levelChip(e.level, true)}</td>
                <td>${g ? `<span class="chip">${U.esc(g.name)}</span>` : '<span class="muted">—</span>'}</td>
                <td class="num">${e.solved}</td>
                <td class="num" style="color:var(--accent);font-size:1rem">${U.fmtNum(e.score)}</td></tr>`;
      }).join('')}
            </tbody></table></div>
        </div>`;
    };
    U.$('#lb-tabs', root).addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-g]');
      if (!b) return;
      U.$$('button', U.$('#lb-tabs', root)).forEach((x) => { x.className = 'btn btn-sm btn-ghost'; });
      b.className = 'btn btn-sm btn-primary';
      renderLB(b.dataset.g);
    });
    renderLB('');
  };

  /* ============================================================ PROBLEMS */
  PV.problems = (root) => {
    const topics = Store.topics().map((t) => t.name);
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('target')}Problem Library</h1><p>Curated problems assigned to academy groups. Difficulty defines score and topic XP.</p></div>
      <div class="filter-bar reveal in">
        <input class="input" id="f-q" placeholder="Search problems…">
        <select class="select" id="f-topic"><option value="">All topics</option>${topics.map((t) => `<option>${U.esc(t)}</option>`).join('')}</select>
        <select class="select" id="f-diff"><option value="">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <span class="spacer"></span><span class="chip" id="f-count"></span>
      </div>
      <div class="card reveal in"><div class="table-wrap" id="problems-table"></div></div>
    </div>`;

    const render = () => {
      const q = U.$('#f-q', root).value.trim().toLowerCase();
      const tp = U.$('#f-topic', root).value, df = U.$('#f-diff', root).value;
      let list = Store.problems();
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
      if (tp) list = list.filter((p) => p.topic === tp);
      if (df) list = list.filter((p) => p.difficulty === df);
      U.$('#f-count', root).textContent = list.length + ' problems';
      U.$('#problems-table', root).innerHTML = list.length ? `<table class="table">
        <thead><tr><th>Problem</th><th>Topic</th><th>Difficulty</th><th>Score</th><th>XP</th><th>Groups</th><th>Solved by</th></tr></thead>
        <tbody>${list.map((p) => `
          <tr>
            <td><a class="link-accent" href="${U.safeURL(p.link)}" target="_blank" rel="noopener">${U.esc(p.name)} ${ic('external')}</a></td>
            <td class="muted">${U.esc(p.topic)}</td>
            <td>${C.diffTag(p.difficulty)}</td>
            <td class="num">${p.score}</td>
            <td class="num" style="color:var(--accent-2)">${p.xp}</td>
            <td>${p.groupIds.map((gid) => { const g = Store.group(gid); return g ? `<span class="chip" style="margin:1px 3px 1px 0;padding:3px 9px;font-size:.72rem">${U.esc(g.name)}</span>` : ''; }).join('') || '<span class="muted">—</span>'}</td>
            <td><span class="chip">${ic('users')}${Store.problemSolvers(p.id).length}</span></td>
          </tr>`).join('')}</tbody></table>`
        : `<div style="padding:10px">${C.empty({ icon: 'search', title: 'No problems found', text: 'Try different filters.' })}</div>`;
    };
    ['f-q', 'f-topic', 'f-diff'].forEach((id) => U.$('#' + id, root).addEventListener('input', render));
    render();
  };

  /* ============================================================ HALL OF FAME / CONTESTS */
  PV.contests = (root) => {
    const contests = Store.contests().slice().sort((a, b) => b.date.localeCompare(a.date));
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('crown')}Hall of Fame</h1><p>Every academy contest, every podium, forever remembered. Contest points feed the global leaderboard.</p></div>
      <div class="grid" id="contests-list">
      ${contests.length ? contests.map((c, i) => {
      const top3rows = c.results.slice(0, 3);
      const rest = c.results.slice(3);
      const entries = top3rows.map((r) => {
        const st = Store.student(r.studentId);
        return { name: st ? st.name : '—', value: r.points, rank: r.rank, avatarHTML: U.avatarHTML(st || { name: '?' }, 'avatar-56'), link: st ? '#/student/' + st.id : null };
      });
      return `<div class="card reveal contest-card">
          <div class="contest-meta">
            <span class="tag" style="background:var(--accent-soft);color:var(--accent)">CONTEST #${contests.length - i}</span>
            <h3 style="margin-top:10px">${U.esc(c.name)}</h3>
            <div class="c-date">${ic('calendar')}${U.fmtDate(c.date)}</div>
            <p>${U.esc(c.description || '')}</p>
            <div class="contest-mini">
              <span class="chip">${ic('users')}${c.results.length} ranked</span>
              <span class="chip">${ic('zap')}${c.results.reduce((a, r) => a + r.solved, 0)} total solves</span>
              <span class="chip" style="color:var(--gold)">${ic('star')}${c.results[0] ? c.results[0].points : 0} pts for gold</span>
            </div>
          </div>
          <div>
            ${entries.length === 3 ? C.podiumHTML(entries, 'pts') : ''}
            ${rest.map((r) => {
        const st = Store.student(r.studentId);
        return `<div class="rank-45"><span class="rk">#${r.rank}</span>
              <span>${st ? `<a href="#/student/${st.id}" class="link-accent">${U.esc(st.name)}</a>` : '—'}</span>
              <span class="muted tiny">${r.solved} solved</span>
              <span class="pts">+${r.points}</span></div>`;
      }).join('')}
            ${top3rows.map((r) => {
        const st = Store.student(r.studentId);
        return `<div class="rank-45" style="border-color:${['rgba(251,191,36,.4)', 'rgba(203,213,225,.3)', 'rgba(208,138,78,.35)'][r.rank - 1]};grid-template-columns:36px 1fr auto auto"><span class="rank-badge r${r.rank}">${r.rank}</span>
              <span>${st ? `<a href="#/student/${st.id}" class="link-accent">${U.esc(st.name)}</a>` : '—'}</span>
              <span class="muted tiny">${r.solved} solved</span>
              <span class="pts">+${r.points}</span></div>`;
      }).join('')}
          </div>
        </div>`;
    }).join('') : C.empty({ icon: 'trophy', title: 'No contests recorded yet', text: 'The coach records contest results from the admin panel — the first podium will appear here.' })}
      </div>
    </div>`;
  };

  /* ============================================================ ACHIEVEMENTS */
  PV.achievements = (root) => {
    const cat = Store.catalog();
    const series = {};
    cat.forEach((a) => { (series[a.series] = series[a.series] || []).push(a); });
    const tierRank = { bronze: 1, silver: 2, gold: 3, special: 4, legend: 5 };
    const holders = (aid) => Store.students().filter((s) => s.achievements.some((x) => x.achievementId === aid));

    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('medal')}Achievements</h1><p>Medals and milestones from olympiads, contests and the academy itself. Earned, never given.</p></div>
      <div class="card reveal in" style="margin-bottom:26px;display:flex;gap:18px;flex-wrap:wrap;align-items:center">
        <b class="muted tiny" style="text-transform:uppercase;letter-spacing:1px">Tiers</b>
        ${[['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['special', 'Special'], ['legend', 'Legendary']].map(([t, n]) =>
      `<span class="${C.tierClass(t)}" style="display:flex;align-items:center;gap:8px"><span class="ach-icon" style="width:30px;height:30px;border-radius:9px">${ic(t === 'legend' ? 'crown' : t === 'special' ? 'star' : 'medal')}</span><span style="color:var(--tc);font-weight:700;font-size:.85rem">${n}</span></span>`).join('')}
      </div>
      ${Object.keys(series).sort().map((sname) => `
        ${C.sectionHead('award', sname, series[sname].length + ' achievements')}
        <div class="ach-grid" style="margin-bottom:10px">
          ${series[sname].slice().sort((a, b) => (tierRank[a.tier] || 0) - (tierRank[b.tier] || 0)).map((a) => {
        const h = holders(a.id);
        return `<div class="ach-card reveal" style="align-items:flex-start;flex-direction:column">
            <div style="display:flex;gap:12px;align-items:center">
              ${C.achIcon(a, true, true)}
              <div><h4 style="font-size:.95rem">${U.esc(a.name)}</h4>
              <span class="tag" style="background:color-mix(in srgb,${{ bronze: 'var(--bronze)', silver: 'var(--silver)', gold: 'var(--gold)', special: 'var(--accent)', legend: 'var(--accent-2)' }[a.tier]} 14%, transparent);color:${{ bronze: 'var(--bronze)', silver: 'var(--silver)', gold: 'var(--gold)', special: 'var(--accent)', legend: 'var(--accent-2)' }[a.tier]}">${U.esc(a.tier)}</span></div>
            </div>
            <p style="margin-top:4px">${U.esc(a.description || '')}</p>
            <div style="display:flex;align-items:center;gap:9px;margin-top:8px">
              <div class="avatar-stack">${h.slice(0, 6).map((st) => `<a href="#/student/${st.id}">${U.avatarHTML(st, 'avatar-36')}</a>`).join('')}</div>
              <span class="muted tiny">${h.length ? `earned by ${h.length} student${h.length > 1 ? 's' : ''}` : 'unclaimed'}</span>
            </div>
          </div>`;
      }).join('')}
        </div>`).join('') || C.empty({ icon: 'medal', title: 'No achievements defined', text: 'The coach can design custom achievements from the admin panel.' })}
    </div>`;
  };

  /* ============================================================ ANALYTICS */
  PV.analytics = (root) => {
    const st = Store.academyStats();
    const byDiff = { easy: 0, medium: 0, hard: 0 };
    Store.students().forEach((s) => { const d = Store.solvedByDiff(s.id); byDiff.easy += d.easy; byDiff.medium += d.medium; byDiff.hard += d.hard; });
    const matrix = Store.groupTopicMatrix();
    const groups = Store.groups();

    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('chart')}Analytics</h1><p>The academy's pulse — growth, difficulty appetite, group strength and head-to-head comparison.</p></div>

      <section class="stats-row" style="margin-top:0">
        ${C.statTile({ icon: 'users', label: 'Total Students', count: st.students })}
        ${C.statTile({ icon: 'target', label: 'Problems Solved', count: st.solved, delay: 'reveal-d1' })}
        ${C.statTile({ icon: 'trend', label: 'Avg Score / Student', count: st.avgScore, delay: 'reveal-d2' })}
        ${C.statTile({ icon: 'trophy', label: 'Contest Activity', count: st.contests, delay: 'reveal-d3' })}
      </section>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card reveal"><div class="card-title">${ic('trend')}Academy Score Growth</div>
          <div class="muted tiny" style="margin-top:4px">Cumulative points earned by all students</div>
          <div class="chart" id="an-growth" style="margin-top:10px"></div></div>
        <div class="card reveal"><div class="card-title">${ic('chart')}Solves per Month</div>
          <div class="chart" id="an-monthly" style="margin-top:10px"></div></div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card reveal"><div class="card-title">${ic('target')}Difficulty Appetite</div>
          <div style="margin-top:16px">${Charts.donutHTML({
      segments: [
        { label: 'Easy', value: byDiff.easy, color: 'var(--easy)' },
        { label: 'Medium', value: byDiff.medium, color: 'var(--medium)' },
        { label: 'Hard', value: byDiff.hard, color: 'var(--hard)' },
      ], centerTop: st.solved, centerBottom: 'total solves',
    })}</div></div>
        <div class="card reveal"><div class="card-title">${ic('layers')}Group Analytics</div>
          <div class="muted tiny" style="margin:4px 0 10px">Average score per group</div>
          ${Charts.hbarsHTML(groups.map((g) => {
      const gs = Store.groupStats(g.id);
      return { label: g.name + ` (${gs.count})`, value: gs.avgScore };
    }))}
          <hr class="divider">
          <div class="muted tiny" style="margin-bottom:6px">Average member score growth</div>
          <select class="select" id="an-group-sel" style="max-width:240px;margin-bottom:10px">${groups.map((g) => `<option value="${g.id}">${U.esc(g.name)}</option>`).join('')}</select>
          <div class="chart" id="an-group-line"></div>
        </div>
      </div>

      <div class="card reveal" style="margin-top:18px">
        <div class="card-title">${ic('zap')}Topic Progress Matrix</div>
        <div class="muted tiny" style="margin:4px 0 12px">Average mastery per topic within each group (100% = topic mastered by every member)</div>
        <div class="matrix"><table>
          <thead><tr><th>Topic</th>${matrix.rows.map((r) => `<th>${U.esc(r.group.name)}</th>`).join('')}</tr></thead>
          <tbody>
            ${matrix.topics.map((t, ti) => `<tr><td class="muted">${U.esc(t)}</td>
              ${matrix.rows.map((r) => {
      const pct = Math.round((r.cells[ti] ? r.cells[ti].pct : 0) * 100);
      const col = pct >= 100 ? 'var(--gold)' : pct >= 60 ? 'var(--green)' : 'var(--accent)';
      return `<td><span class="cell-bar"><i style="width:${pct}%;background:${col}"></i></span><span class="cell-pct">${pct}%</span></td>`;
    }).join('')}</tr>`).join('')}
          </tbody></table></div>
      </div>

      <div class="card reveal" style="margin-top:18px" id="cmp-card">
        <div class="card-title">${ic('users')}Student Comparison</div>
        <div class="muted tiny" style="margin:4px 0 14px">Pick 2–4 students and compare scores, solves, topics, contests and topic mastery.</div>
        <div class="compare-bar" id="cmp-bar"></div>
        <div id="cmp-body" style="margin-top:18px"></div>
      </div>
    </div>`;

    // charts
    Charts.line(U.$('#an-growth', root), { series: [{ name: 'Total score', points: Store.academyScoreGrowth(), color: '#38bdf8' }] });
    const monthly = Store.academyMonthly(8);
    Charts.bars(U.$('#an-monthly', root), { items: monthly.map((m) => ({ label: m.label, value: m.count, hint: 'solves' })) });

    const groupLine = (gid) => Charts.line(U.$('#an-group-line', root), { series: [{ name: 'Avg member score', points: Store.groupScoreGrowth(gid), color: '#a78bfa' }], height: 200 });
    const sel = U.$('#an-group-sel', root);
    if (groups.length) { sel.addEventListener('input', () => groupLine(sel.value)); groupLine(sel.value); }
    else U.$('#an-group-line', root).innerHTML = Charts.empty('No groups yet');

    /* ----- comparison widget ----- */
    const maxCmp = 4;
    let selected = Store.students().slice(0, Math.min(2, Store.students().length)).map((s) => s.id);
    const barEl = U.$('#cmp-bar', root), bodyEl = U.$('#cmp-body', root);

    const studentOptions = (cur) => Store.students().map((s) =>
      `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('');

    const radarTopics = ['Dynamic Programming', 'Graph Traversal', 'Math & Number Theory', 'Greedy', 'Data Structures', 'Strings']
      .filter((t) => Store.topics().some((x) => x.name === t));
    const axes = (radarTopics.length >= 3 ? radarTopics : Store.topics().slice(0, 6).map((t) => t.name)).map((n) => n.length > 14 ? n.slice(0, 13) + '…' : n);
    const axesFull = (radarTopics.length >= 3 ? radarTopics : Store.topics().slice(0, 6).map((t) => t.name));

    function renderCmp() {
      barEl.innerHTML = selected.map((sid, i) => `
        <label class="field"><span style="color:${Charts.palette[i]}">Student ${i + 1}</span>
          <select class="select cmp-sel" data-i="${i}">${studentOptions(sid)}</select></label>`).join('') +
        (selected.length < maxCmp ? `<button class="btn btn-ghost btn-sm" id="cmp-add">${ic('plus')}Add student</button>` : '') +
        (selected.length > 2 ? `<button class="btn btn-ghost btn-sm" id="cmp-rm">${ic('minus')}Remove</button>` : '');

      U.$$('.cmp-sel', barEl).forEach((s) => s.addEventListener('input', () => { selected[Number(s.dataset.i)] = s.value; renderCmp(); }));
      const addBtn = U.$('#cmp-add', barEl);
      if (addBtn) addBtn.onclick = () => {
        const unused = Store.students().find((x) => !selected.includes(x.id));
        if (unused) { selected.push(unused.id); renderCmp(); }
      };
      const rmBtn = U.$('#cmp-rm', barEl);
      if (rmBtn) rmBtn.onclick = () => { selected.pop(); renderCmp(); };

      const entries = selected.map((sid, i) => ({ s: Store.student(sid), color: Charts.palette[i] })).filter((x) => x.s);
      if (!entries.length) { bodyEl.innerHTML = Charts.empty('No students to compare'); return; }

      const rows = [
        ['Score', (sid) => Store.score(sid)],
        ['Problems solved', (sid) => Store.solvedCount(sid)],
        ['Easy / Med / Hard', (sid) => { const d = Store.solvedByDiff(sid); return `${d.easy} / ${d.medium} / ${d.hard}`; }],
        ['Topics mastered', (sid) => Store.masteredCount(sid)],
        ['Level', (sid) => Store.levelOf(sid).cur.name],
        ['Contests played', (sid) => Store.contestStats(sid).count],
        ['Podiums', (sid) => Store.contestStats(sid).podiums],
        ['Achievements', (sid) => Store.achievementsOf(sid).length],
      ];

      bodyEl.innerHTML = `
        <div class="table-wrap"><table class="table cmp-table">
          <thead><tr><th>Metric</th>${entries.map((e) => `<th><span class="dot" style="background:${e.color};display:inline-block;margin-right:7px"></span>${U.esc(e.s.name)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(([label, fn]) => `<tr><td>${label}</td>${entries.map((e) => `<td class="num">${fn(e.s.id)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <div class="grid grid-2" style="margin-top:18px">
          <div><div class="muted tiny" style="margin-bottom:8px">Score growth overlay</div><div class="chart" id="cmp-line"></div></div>
          <div><div class="muted tiny" style="margin-bottom:8px">Topic mastery radar (% of requirement)</div><div class="chart" id="cmp-radar"></div></div>
        </div>`;

      Charts.line(U.$('#cmp-line', bodyEl), {
        series: entries.map((e) => ({ name: e.s.name, points: Store.scoreHistory(e.s.id), color: e.color })),
        height: 250, fill: false,
      });
      Charts.radar(U.$('#cmp-radar', bodyEl), {
        axes,
        series: entries.map((e) => {
          const xp = Store.topicXP(e.s.id);
          return {
            name: e.s.name, color: e.color,
            values: axesFull.map((t) => {
              const topic = Store.topics().find((x) => x.name === t);
              return topic ? Math.min(1, (xp[t] || 0) / topic.masteryXP) : 0;
            }),
          };
        }),
      });
    }
    renderCmp();
  };

  /* ============================================================ 404 */
  PV.notFound = (root, msg) => {
    root.innerHTML = `<div class="container page">${C.empty({
      icon: 'warn', title: msg || 'Page not found',
      text: 'The page you are looking for does not exist (anymore).',
      action: '<a class="btn btn-primary btn-sm" href="#/">Back to home</a>',
    })}</div>`;
  };
})();
