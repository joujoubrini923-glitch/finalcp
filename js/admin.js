/* ============================================================
   Abdelmajid CP — admin.js : coach panel (password protected)
   ============================================================ */
(function () {
  const Admin = {};
  const SS_KEY = 'abdelmajidcp_admin';
  const C = {}; // local components

  Admin.isAuthed = () => sessionStorage.getItem(SS_KEY) === '1';
  Admin.logout = function () {
    sessionStorage.removeItem(SS_KEY);
    if (Store.cloudSignOut) Store.cloudSignOut();
    U.toast('Logged out', 'info', 'logout');
    location.hash = '#/';
    App.updateAdminLink();
  };

  C.diffTag = (d) => `<span class="tag tag-${U.esc(d)}">${U.esc(d)}</span>`;
  C.levelChip = (lvl) => {
    const legend = lvl.isLegend;
    return `<span class="level-chip ${legend ? 'level-legend' : ''}" style="${legend ? '' : `color:${lvl.cur.color};border-color:${lvl.cur.color}66`}"><i class="dot"></i>${U.esc(lvl.cur.name)}</span>`;
  };

  /* ================= LOGIN ================= */
  function loginView(root) {
    root.innerHTML = `
    <div class="container page">
      <div class="login-wrap">
        <div class="card login-card" id="login-card">
          <div class="login-lock">${ic('lock')}</div>
          <h2 style="font-size:1.35rem">Coach Access</h2>
          <form id="login-form">
            <input class="input" type="password" id="login-pw" placeholder="Password" autocomplete="current-password" style="text-align:center;font-size:1.05rem">
            <div style="height:14px"></div>
            <button class="btn btn-primary btn-block" type="submit">${ic('key')}Unlock Dashboard</button>
          </form>
          <p class="login-hint" id="login-err" style="color:var(--red);display:none">Wrong password — try again.</p>
          <p class="login-hint"><a class="link-accent" href="#/">${ic('arrowLeft')} Back to the public site</a></p>
        </div>
      </div>
    </div>`;
    const FAIL_KEY = 'acp_login_throttle';
    const getFails = () => { try { return JSON.parse(sessionStorage.getItem(FAIL_KEY)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } };
    const registerFail = () => {
      const f = getFails();
      f.n += 1;
      // escalating lockout after the 5th wrong attempt (defense against
      // casual password guessing on the public login page)
      const lockFor = [0, 0, 0, 0, 0, 30, 120, 600, 1800][Math.min(f.n, 8)] * 1000;
      f.until = lockFor ? Date.now() + lockFor : 0;
      try { sessionStorage.setItem(FAIL_KEY, JSON.stringify(f)); } catch (e) {}
      return lockFor;
    };
    const form = U.$('#login-form', root);
    const errEl = () => U.$('#login-err', root);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const wait = Math.ceil((getFails().until - Date.now()) / 1000);
      if (wait > 0) { const er = errEl(); er.textContent = `Too many wrong attempts — try again in ${wait}s.`; er.style.display = 'block'; return; }
      const pw = U.$('#login-pw', root).value;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      let ok = false;
      if (Store.cloudEnabled && Store.cloudEnabled()) {
        // real online sign-in (Supabase Auth). A wrong CLOUD password is a
        // hard fail — the local fallback only exists for when the NETWORK is
        // down, so a leaked local password alone can never open the dashboard
        // while the academy is online.
        const r = await Store.cloudSignIn(pw);
        if (r.ok) {
          ok = true;
          await Store.syncLocalPassword(pw); // one password for both gates, kept in sync
        } else if (!/invalid login credentials/i.test(r.error || '') && (await Store.verifyPassword(pw))) {
          ok = true; // network error (not "wrong password") -> offline unlock
        }
      } else {
        ok = await Store.verifyPassword(pw);
      }
      if (btn) btn.disabled = false;
      if (ok) {
        try { sessionStorage.removeItem(FAIL_KEY); } catch (e2) {}
        sessionStorage.setItem(SS_KEY, '1');
        U.toast('Welcome back, Coach!', 'success', 'unlock');
        Store.isDefaultPassword().then((d) => { if (d) setTimeout(() => U.toast('⚠ Your coach password is still the initial password — change it in Settings before publishing.', 'error', 'warn'), 800); });
        App.updateAdminLink();
        Admin.render(root, 'overview');
      } else {
        const lockFor = registerFail();
        const er = errEl();
        er.textContent = lockFor ? `Too many wrong attempts — locked for ${Math.ceil(lockFor / 1000)}s.` : 'Wrong password — try again.';
        er.style.display = 'block';
        U.$('#login-pw', root).value = '';
        const card = U.$('#login-card', root);
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      }
    });
    setTimeout(() => { const f = U.$('#login-pw', root); if (f) f.focus(); }, 60);
  }

  /* ---------- security helpers ---------- */
  // big red banner when the default password is still in use
  function injectPwWarning(el) {
    if (!Store.isDefaultPassword) return;
    Promise.resolve(Store.isDefaultPassword()).then((isDefault) => {
      if (!isDefault || !el.isConnected) return;
      const warn = document.createElement('div');
      warn.className = 'pw-warn';
      warn.innerHTML = `${ic('warn')}<div><b>Security alert: your coach password is still the initial password.</b><span>Change it before publishing and use a unique password that is not reused anywhere else.</span></div><a class="btn btn-primary btn-sm" href="#/admin/settings">${ic('key')}Change it now</a>`;
      el.prepend(warn);
    });
  }

  // auto-logout after 30 minutes idle (public computers, forgotten tabs)
  const IDLE_LIMIT = 30 * 60 * 1000;
  let idleLast = Date.now(), idleWatcher = null;
  Admin.checkIdle = function () {
    if (Admin.isAuthed() && Date.now() - idleLast > IDLE_LIMIT) {
      Admin.logout();
      U.toast('Signed out after 30 minutes of inactivity', 'info', 'lock');
      return true;
    }
    return false;
  };
  function armIdleWatch() {
    if (idleWatcher) return;
    const bump = () => { idleLast = Date.now(); };
    window.addEventListener('pointerdown', bump, { passive: true });
    window.addEventListener('keydown', bump);
    idleWatcher = window.setInterval(Admin.checkIdle, 30000);
  }
  Admin._debugSetIdle = (t) => { idleLast = t; }; // test hook

  /* ================= SHELL ================= */
  const TABS = [
    ['overview', 'grid', 'Overview'],
    ['students', 'users', 'Students'],
    ['groups', 'layers', 'Groups'],
    ['problems', 'target', 'Problems'],
    ['solves', 'check', 'Record Solves'],
    ['verify', 'zap', 'Auto-Verify'],
    ['contests', 'trophy', 'Contests'],
    ['achievements', 'medal', 'Achievements'],
    ['requests', 'userPlus', 'Join Requests'],
    ['nextcourse', 'star', 'Next Course Requests'],
    ['messages', 'message', 'Coach Messages'],
    ['scheduling', 'calendar', 'Scheduling'],
    ['notifications', 'mail', 'Email Notifications'],
    ['clinic', 'code', 'Code Clinic'],
    ['seasons', 'flame', 'Seasons'],
    ['settings', 'settings', 'Settings Home'],
    ['academy', 'grad', 'Academy Settings'],
    ['course', 'target', 'Course Advertisement'],
    ['nextcourses', 'star', 'Next Course Ads'],
    ['scoring', 'zap', 'Scoring'],
    ['gamification', 'flame', 'Bonuses & Clinic'],
    ['levels', 'shield', 'Levels'],
    ['topics', 'target', 'Topics'],
    ['security', 'lock', 'Security'],
    ['data', 'database', 'Backup & Data'],
  ];

  Admin.render = function (root, tab) {
    if (!Admin.isAuthed()) return loginView(root);
    armIdleWatch();
    idleLast = Date.now();
    tab = tab || 'overview';
    if (!TABS.some((t) => t[0] === tab)) tab = 'overview';
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in">
        <h1>${ic('grad')}Coach Dashboard</h1>
        <p>Manage students, groups, problems, contests and achievements. Everything saves instantly to Local Storage.</p>
      </div>
      <div class="admin-layout">
        <aside class="card admin-side">
          ${TABS.map(([id, icon, label]) => `<a class="as-link ${id === tab ? 'active' : ''}" href="#/admin/${id}">${ic(icon)}${label}</a>`).join('')}
          <hr>
          <a class="as-link" href="#/" >${ic('eye')}View Public Site</a>
          <button class="as-link" type="button" id="admin-logout" style="color:var(--red)">${ic('logout')}Logout</button>
        </aside>
        <section id="admin-content"></section>
      </div>
    </div>`;
    U.$('#admin-logout', root).onclick = Admin.logout;
    const content = U.$('#admin-content', root);
    ({
      overview: tabOverview, students: tabStudents, groups: tabGroups,
      problems: tabProblems, solves: tabSolves, contests: tabContests,
      achievements: tabAchievements, requests: tabRequests, nextcourse: tabNextCourseRequests, messages: tabMessages, scheduling: tabScheduling, notifications: (el) => tabSettingsSection(el, 'notification-settings'), clinic: tabClinic, seasons: tabSeasons, verify: tabVerify, settings: tabSettings, academy: (el) => tabSettingsSection(el, 'academy-settings'), course: (el) => tabSettingsSection(el, 'course-settings'), nextcourses: tabNextCourseAds, scoring: (el) => tabSettingsSection(el, 'scoring-settings'), gamification: (el) => tabSettingsSection(el, 'gamification-settings'), levels: (el) => tabSettingsSection(el, 'levels-settings'), topics: (el) => tabSettingsSection(el, 'topics-settings'), security: (el) => tabSettingsSection(el, 'security-settings'), data: tabData,
    })[tab](content);
    U.observeReveals(content);
  };
  const rerender = (tab) => Admin.render(U.$('#app'), tab);
  const currentTab = () => (location.hash.match(/^#\/admin\/?([\w-]*)/) || [])[1] || 'overview';

  /* ================= OVERVIEW ================= */
  function tabOverview(el) {
    const st = Store.academyStats();
    const kb = (Store.storageSize() / 1024).toFixed(1);
    el.innerHTML = `
      <div class="stats-row" style="margin-top:0">
        <div class="stat-tile"><div class="st-ic">${ic('users')}</div><div class="st-val">${st.students}</div><div class="st-label">Students</div></div>
        <div class="stat-tile"><div class="st-ic">${ic('target')}</div><div class="st-val">${st.solved}</div><div class="st-label">Solves Recorded</div></div>
        <div class="stat-tile"><div class="st-ic">${ic('trophy')}</div><div class="st-val">${st.contests}</div><div class="st-label">Contests</div></div>
        <div class="stat-tile"><div class="st-ic">${ic('database')}</div><div class="st-val">${kb}<span style="font-size:.9rem">KB</span></div><div class="st-label">Local Data Size</div></div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('zap')}Quick Actions</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn btn-primary btn-sm" data-go="students" data-act="add">${ic('userPlus')}Add Student</button>
          <button class="btn btn-ghost btn-sm" data-go="problems" data-act="add">${ic('plus')}Add Problem</button>
          <button class="btn btn-ghost btn-sm" data-go="solves">${ic('check')}Record Solves</button>
          <button class="btn btn-ghost btn-sm" data-go="contests" data-act="add">${ic('trophy')}Record Contest</button>
          <button class="btn btn-ghost btn-sm" data-go="requests">${ic('userPlus')}Join Requests &amp; Questions${(Store.newJoinCount() + Store.newQuestionCount()) ? ` <span class="chip" style="margin-left:2px;color:var(--gold)">${Store.newJoinCount() + Store.newQuestionCount()} new</span>` : ''}</button>
          <button class="btn btn-ghost btn-sm" data-go="data">${ic('download')}Export Backup</button>
        </div>
      </div>
      <div class="card admin-shortcuts-card" style="margin-top:18px">
        <div class="card-title">${ic('settings')}Settings shortcuts</div>
        <p class="muted tiny" style="margin:5px 0 12px">Jump straight to the settings you use most often.</p>
        <div class="admin-shortcuts-grid">
          ${[['academy','Academy settings','grad'],['course','Course advertisement','target'],['nextcourses','Next-course ads','star'],['scheduling','Scheduling','calendar'],['scoring','Scoring','zap'],['gamification','Bonuses & clinic','flame'],['levels','Levels','shield'],['topics','Topics','target'],['security','Security','lock']].map(([id,label,icon]) => `<button class="admin-shortcut" type="button" data-admin-route="${id}">${ic(icon)}<span>${label}</span>${ic('chevronRight')}</button>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('clock')}Recent Activity</div>
        <div style="margin-top:14px">${timeline(Store.activity(), 15)}</div>
      </div>`;
    el.addEventListener('click', (ev) => {
      const routeShortcut = ev.target.closest('[data-admin-route]');
      if (routeShortcut) { location.hash = '#/admin/' + routeShortcut.dataset.adminRoute; return; }
      const shortcut = ev.target.closest('[data-settings-focus]');
      if (shortcut) { sessionStorage.setItem('acp_settings_focus', shortcut.dataset.settingsFocus); location.hash = '#/admin/settings'; return; }
      const b = ev.target.closest('[data-go]');
      if (b) {
        sessionStorage.setItem('acp_quick', b.dataset.act || '');
        location.hash = '#/admin/' + b.dataset.go;
      }
    });
    injectPwWarning(el);
  }

  function timeline(items, limit) {
    if (!items.length) return '<p class="muted">No activity yet.</p>';
    const map = { solve: ['check', 'var(--green)'], contest: ['trophy', 'var(--gold)'], achievement: ['medal', 'var(--accent-2)'], student: ['userPlus', 'var(--accent)'], group: ['layers', 'var(--accent)'], problem: ['target', 'var(--orange)'], request: ['userPlus', 'var(--accent-2)'], question: ['help', 'var(--orange)'], system: ['info', 'var(--dim)'] };
    return `<div class="timeline">${items.slice(0, limit).map((a) => {
      const [icon, col] = map[a.type] || map.system;
      return `<div class="tl-item" style="--c:${col}"><div class="tl-text">${U.esc(a.text)}</div><div class="tl-time">${U.timeAgo(a.t)}</div></div>`;
    }).join('')}</div>`;
  }

  /* ================= STUDENTS ================= */
  function tabStudents(el) {
    el.innerHTML = `
      <div class="card">
        <div class="admin-toolbar">
          <input class="input" id="as-q" placeholder="Search students…">
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" id="as-add">${ic('userPlus')}Add Student</button>
        </div>
        <div class="table-wrap" id="as-table"></div>
      </div>`;
    const render = () => {
      const q = U.$('#as-q', el).value.trim().toLowerCase();
      let list = Store.students().slice().sort((a, b) => Store.score(b.id) - Store.score(a.id));
      if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
      U.$('#as-table', el).innerHTML = list.length ? `<table class="table">
        <thead><tr><th>Student</th><th>Group</th><th>Level</th><th>Score</th><th>Solved</th><th>Joined</th><th></th></tr></thead>
        <tbody>${list.map((s) => {
        const g = Store.group(s.groupId);
        const lvl = Store.levelOf(s.id);
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:10px">${U.avatarHTML(s, 'avatar-36')}<b>${U.esc(s.name)}</b></div></td>
          <td>${g ? U.esc(g.name) : '<span class="muted">—</span>'}</td>
          <td>${C.levelChip(lvl)}</td>
          <td class="num">${Store.score(s.id)}</td>
          <td class="num">${Store.solvedCount(s.id)}</td>
          <td class="muted tiny mono">${U.fmtDate(s.joinDate)}</td>
          <td><div class="row-actions">
            <a class="icon-btn" title="View profile" href="#/student/${s.id}">${ic('eye')}</a>
            <button class="icon-btn" title="Edit" data-edit="${s.id}">${ic('edit')}</button>
            <button class="icon-btn" title="Delete" data-del="${s.id}" style="color:var(--red)">${ic('trash')}</button>
          </div></td></tr>`;
      }).join('')}</tbody></table>` : `<div style="padding:14px"><p class="muted">No students found. Click “Add Student” to register the first one.</p></div>`;
    };
    U.$('#as-q', el).addEventListener('input', render);
    U.$('#as-add', el).onclick = () => studentForm(null);
    el.addEventListener('click', async (ev) => {
      const eb = ev.target.closest('[data-edit]');
      const db2 = ev.target.closest('[data-del]');
      if (eb) studentForm(eb.dataset.edit);
      if (db2) {
        const s = Store.student(db2.dataset.del);
        const ok = await U.confirm({
          title: 'Delete student?',
          message: `Delete <b>${U.esc(s.name)}</b>? This also removes their solves, achievements and contest results. This cannot be undone.`,
          danger: true, confirmLabel: 'Delete',
        });
        if (ok) { Store.deleteStudent(s.id); U.toast('Student deleted', 'success'); render(); }
      }
    });
    render();
    if (sessionStorage.getItem('acp_quick') === 'add') { sessionStorage.removeItem('acp_quick'); studentForm(null); }
  }

  function studentForm(id) {
    const s = id ? Store.student(id) : null;
    const groups = Store.groups();
    const cat = Store.catalog();
    let photoData = s ? (U.safeImage(s.photo) || null) : null;
    const adj = s ? Store.adjustOf(s.id) : { score: 0, easy: 0, medium: 0, hard: 0 };

    const series = {};
    cat.forEach((a) => { (series[a.series] = series[a.series] || []).push(a); });
    const achHtml = Object.keys(series).sort().map((sn) => `
      <div class="muted tiny" style="text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px">${U.esc(sn)}</div>
      <div class="check-grid">${series[sn].map((a) => `
        <label class="check-row"><input type="checkbox" name="ach" value="${a.id}" ${s && Store.hasAchievement(s.id, a.id) ? 'checked' : ''}>
        <span>${U.esc(a.name)}</span><span class="sr-type">${U.esc(a.tier)}</span></label>`).join('')}</div>`).join('');

    const m = U.modal({
      title: s ? 'Edit Student' : 'Add Student',
      wide: true,
      body: `
        <div class="photo-row">
          <div class="photo-preview" id="f-photo-prev">${photoData ? `<img src="${photoData}" style="width:100%;height:100%;object-fit:cover">` : `<span style="${U.avatarStyle(s ? s.name : 'New')} ;width:100%;height:100%;display:flex;align-items:center;justify-content:center">${U.initials(s ? s.name : 'N')}</span>`}</div>
          <div>
            <input type="file" id="f-photo" accept="image/*" class="hidden">
            <button class="btn btn-ghost btn-sm" id="f-photo-btn">${ic('upload')}Upload photo</button>
            <button class="btn btn-ghost btn-sm hidden" id="f-photo-rm" style="color:var(--red)">${ic('trash')}Remove</button>
            <div class="muted tiny" style="margin-top:6px">Square image works best — it will be resized locally to 256px.</div>
          </div>
        </div>
        <div style="height:16px"></div>
        <div class="field-row">
          <label class="field"><span>Full name *</span><input class="input" id="f-name" value="${s ? U.esc(s.name) : ''}" placeholder="e.g. Yasmine Ben Ali"></label>
          <label class="field"><span>Join date</span><input class="input" type="date" id="f-join" value="${s ? s.joinDate : U.today()}"></label>
        </div>
        <label class="field"><span>Group</span>
          <select class="select" id="f-group">
            <option value="">— No group —</option>
            ${groups.map((g) => `<option value="${g.id}" ${s && s.groupId === g.id ? 'selected' : ''}>${U.esc(g.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Codeforces username <span class="muted tiny">(enables auto-verify of solves)</span></span>
          <input class="input mono" id="f-cf" maxlength="40" value="${s && s.cfHandle ? U.esc(s.cfHandle) : ''}" placeholder="e.g. yasmine_codes" spellcheck="false">
        </label>
        <div style="border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;background:var(--bg-2)">
          <div class="muted tiny" style="font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Manual Adjustments</div>
          <p class="muted tiny" style="margin-bottom:12px">Added on top of recorded solves &amp; contests — e.g. for progress made outside the platform. Use negative score to deduct.</p>
          <div class="field-row">
            <label class="field" style="margin:0"><span>Score adjustment (±)</span><input class="input" type="number" id="f-adj-score" value="${adj.score}"></label>
            <label class="field" style="margin:0"><span>Extra solved · Easy</span><input class="input" type="number" min="0" id="f-adj-easy" value="${adj.easy}"></label>
          </div>
          <div style="height:10px"></div>
          <div class="field-row">
            <label class="field" style="margin:0"><span>Extra solved · Medium</span><input class="input" type="number" min="0" id="f-adj-medium" value="${adj.medium}"></label>
            <label class="field" style="margin:0"><span>Extra solved · Hard</span><input class="input" type="number" min="0" id="f-adj-hard" value="${adj.hard}"></label>
          </div>
        </div>
        <label class="field" style="margin-bottom:6px"><span>Achievements</span></label>
        ${achHtml || '<p class="muted tiny">No achievements in catalog yet — create some in the Achievements tab.</p>'}`,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: s ? 'Save changes' : 'Add student', cls: 'btn-primary', icon: 'check', keepOpen: true,
          onClick: (ev, bd, closeFn) => {
            const name = U.$('#f-name', bd).value.trim();
            if (!name) { U.toast('Name is required', 'error'); return false; }
            const groupId = U.$('#f-group', bd).value || null;
            const joinDate = U.$('#f-join', bd).value || U.today();
            const cfHandle = (U.$('#f-cf', bd) ? U.$('#f-cf', bd).value : '').trim();
            const adjust = {
              score: U.$('#f-adj-score', bd).value,
              easy: U.$('#f-adj-easy', bd).value,
              medium: U.$('#f-adj-medium', bd).value,
              hard: U.$('#f-adj-hard', bd).value,
            };
            let sid = s ? s.id : null;
            if (s) {
              Store.updateStudent(s.id, { name, joinDate, groupId, photo: photoData, adjust, cfHandle });
            } else {
              sid = Store.addStudent({ name, groupId, joinDate, photo: photoData, adjust, cfHandle }).id;
            }
            // achievements diff
            U.$$('input[name="ach"]', bd).forEach((cb) => {
              const was = Store.hasAchievement(sid, cb.value);
              if (cb.checked && !was) {
                Store.toggleAchievement(sid, cb.value, true);
                if (s) U.toast('Achievement unlocked: ' + (Store.catItem(cb.value) || {}).name, 'gold', 'medal');
              } else if (!cb.checked && was) {
                Store.toggleAchievement(sid, cb.value, false);
              }
            });
            U.toast(s ? 'Student updated' : 'Student added', 'success');
            if (!s) U.confetti(ev.clientX, ev.clientY);
            closeFn();
            rerender('students');
            return false;
          },
        },
      ],
      mount: (bd) => {
        U.$('#f-photo-btn', bd).onclick = () => U.$('#f-photo', bd).click();
        U.$('#f-photo', bd).addEventListener('change', async (ev) => {
          try {
            photoData = await U.fileToAvatar(ev.target.files[0]);
            U.$('#f-photo-prev', bd).innerHTML = `<img src="${photoData}" style="width:100%;height:100%;object-fit:cover">`;
            U.$('#f-photo-rm', bd).classList.remove('hidden');
            U.toast('Photo ready', 'success');
          } catch (e) { U.toast(e.message, 'error'); }
        });
        U.$('#f-photo-rm', bd).onclick = () => {
          photoData = null;
          U.$('#f-photo-prev', bd).innerHTML = `<span style="${U.avatarStyle(U.$('#f-name', bd).value || '?')};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${U.initials(U.$('#f-name', bd).value || '?')}</span>`;
        };
        if (photoData) U.$('#f-photo-rm', bd).classList.remove('hidden');
      },
    });
  }

  /* ================= GROUPS ================= */
  function tabGroups(el) {
    const render = () => {
      const gs = Store.groups();
      el.innerHTML = `
      <div class="card">
        <div class="admin-toolbar">
          <span class="chip">${gs.length} groups</span><span class="spacer"></span>
          <button class="btn btn-primary btn-sm" id="g-add">${ic('plus')}Create Group</button>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Group</th><th>Members</th><th>Avg score</th><th>Solved</th><th>Assigned problems</th><th></th></tr></thead>
          <tbody>${gs.map((g) => {
        const st = Store.groupStats(g.id);
        return `<tr>
            <td><b>${U.esc(g.name)}</b><div class="muted tiny">${U.esc(g.description || '')}</div></td>
            <td class="num">${st.count}</td><td class="num">${st.avgScore}</td>
            <td class="num">${st.solved}</td><td class="num">${st.assigned.length}</td>
            <td><div class="row-actions">
              <a class="icon-btn" title="View" href="#/group/${g.id}">${ic('eye')}</a>
              <button class="icon-btn" data-edit="${g.id}" title="Edit">${ic('edit')}</button>
              <button class="icon-btn" data-del="${g.id}" title="Delete" style="color:var(--red)">${ic('trash')}</button>
            </div></td></tr>`;
      }).join('') || '<tr><td colspan="6" class="muted">No groups yet.</td></tr>'}</tbody></table></div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('users')}Move a Student</div>
        <p class="muted tiny" style="margin:6px 0 12px">Group moves are tracked — history stays visible on the student profile.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <label class="field" style="flex:2;min-width:200px;margin:0"><span>Student</span>
            <select class="select" id="mv-student">${Store.students().map((s) => `<option value="${s.id}">${U.esc(s.name)} (${(Store.group(s.groupId) || {}).name || 'no group'})</option>`).join('')}</select></label>
          <label class="field" style="flex:2;min-width:160px;margin:0"><span>To group</span>
            <select class="select" id="mv-group">${'<option value="">— No group —</option>' + gs.map((g) => `<option value="${g.id}">${U.esc(g.name)}</option>`).join('')}</select></label>
          <button class="btn btn-primary btn-sm" id="mv-go">${ic('arrowRight')}Move</button>
        </div>
      </div>`;
      U.$('#g-add', el).onclick = () => groupForm(null);
      U.$('#mv-go', el).onclick = () => {
        const sid = U.$('#mv-student', el).value, gid = U.$('#mv-group', el).value || null;
        if (!sid) return U.toast('Pick a student', 'error');
        const s = Store.student(sid);
        if ((s.groupId || null) === gid) return U.toast('Student is already in that group', 'error');
        Store.setStudentGroup(sid, gid);
        U.toast(`${s.name} moved to ${(Store.group(gid) || {}).name || 'no group'}`, 'success');
        render();
      };
    };
    el.addEventListener('click', async (ev) => {
      const eb = ev.target.closest('[data-edit]');
      const db2 = ev.target.closest('[data-del]');
      if (eb) groupForm(eb.dataset.edit);
      if (db2) {
        const g = Store.group(db2.dataset.del);
        const ok = await U.confirm({ title: 'Delete group?', message: `Delete <b>${U.esc(g.name)}</b>? Assigned problems will be unassigned.`, danger: true, confirmLabel: 'Delete' });
        if (ok) {
          const r = Store.deleteGroup(g.id);
          U.toast(r.ok ? 'Group deleted' : r.error, r.ok ? 'success' : 'error');
          render();
        }
      }
    });
    render();

    function groupForm(id) {
      const g = id ? Store.group(id) : null;
      U.modal({
        title: g ? 'Edit Group' : 'Create Group',
        body: `
          <label class="field"><span>Name *</span><input class="input" id="f-name" value="${g ? U.esc(g.name) : ''}" placeholder="e.g. Rookies"></label>
          <label class="field"><span>Description</span><textarea class="input" id="f-desc" rows="3" placeholder="What does this group train on?">${g ? U.esc(g.description || '') : ''}</textarea></label>`,
        actions: [
          { label: 'Cancel', cls: 'btn-ghost' },
          {
            label: g ? 'Save' : 'Create', cls: 'btn-primary', icon: 'check', keepOpen: true,
            onClick: (ev, bd, closeFn) => {
              const name = U.$('#f-name', bd).value.trim();
              if (!name) { U.toast('Name is required', 'error'); return false; }
              const description = U.$('#f-desc', bd).value;
              if (g) Store.updateGroup(g.id, { name, description }); else Store.addGroup({ name, description });
              U.toast(g ? 'Group updated' : 'Group created', 'success');
              closeFn(); render();
              return false;
            },
          },
        ],
      });
    }
  }

  /* ================= PROBLEMS ================= */
  function tabProblems(el) {
    el.innerHTML = `
      <div class="card">
        <div class="admin-toolbar">
          <input class="input" id="ap-q" placeholder="Search problems…">
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" id="ap-add">${ic('plus')}Add Problem</button>
        </div>
        <div class="table-wrap" id="ap-table"></div>
      </div>`;
    const render = () => {
      const q = U.$('#ap-q', el).value.trim().toLowerCase();
      let list = Store.problems();
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q));
      U.$('#ap-table', el).innerHTML = list.length ? `<table class="table">
        <thead><tr><th>Problem</th><th>Topic</th><th>Diff</th><th>Score</th><th>XP</th><th>Groups</th><th></th></tr></thead>
        <tbody>${list.map((p) => `<tr>
          <td><a class="link-accent" href="${U.safeURL(p.link)}" target="_blank" rel="noopener">${U.esc(p.name)} ${ic('external')}</a></td>
          <td class="muted">${U.esc(p.topic)}</td><td>${C.diffTag(p.difficulty)}</td>
          <td class="num">${p.score}</td><td class="num">${p.xp}</td>
          <td class="muted tiny">${p.groupIds.map((gid) => (Store.group(gid) || {}).name || '').filter(Boolean).join(', ') || '—'}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-edit="${p.id}" title="Edit">${ic('edit')}</button>
            <button class="icon-btn" data-del="${p.id}" title="Delete" style="color:var(--red)">${ic('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table>`
        : `<div style="padding:14px"><p class="muted">No problems yet — add the first one with “Add Problem”.</p></div>`;
    };
    U.$('#ap-q', el).addEventListener('input', render);
    U.$('#ap-add', el).onclick = () => problemForm(null);
    el.addEventListener('click', async (ev) => {
      const eb = ev.target.closest('[data-edit]');
      const db2 = ev.target.closest('[data-del]');
      if (eb) problemForm(eb.dataset.edit);
      if (db2) {
        const p = Store.problem(db2.dataset.del);
        const n = Store.problemSolvers(p.id).length;
        const ok = await U.confirm({ title: 'Delete problem?', message: `Delete <b>${U.esc(p.name)}</b>?${n ? ` <b>${n}</b> recorded solve(s) will also be removed, lowering scores.` : ''}`, danger: true, confirmLabel: 'Delete' });
        if (ok) { Store.deleteProblem(p.id); U.toast('Problem deleted', 'success'); render(); }
      }
    });
    render();
    if (sessionStorage.getItem('acp_quick') === 'add') { sessionStorage.removeItem('acp_quick'); problemForm(null); }
  }

  function problemForm(id) {
    const p = id ? Store.problem(id) : null;
    const S = Store.settings();
    const topics = Store.topics().map((t) => t.name);
    const groups = Store.groups();
    U.modal({
      title: p ? 'Edit Problem' : 'Add Problem',
      wide: true,
      body: `
        <div class="field-row">
          <label class="field"><span>Problem name *</span><input class="input" id="f-name" value="${p ? U.esc(p.name) : ''}" placeholder="e.g. Dice Combinations"></label>
          <label class="field"><span>Link</span><input class="input" id="f-link" value="${p ? U.esc(p.link) : ''}" placeholder="https://cses.fi/problemset/task/1633"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Topic *</span>
            <input class="input" id="f-topic" list="topic-list" value="${p ? U.esc(p.topic) : ''}" placeholder="Choose or type a new topic">
            <datalist id="topic-list">${topics.map((t) => `<option value="${U.esc(t)}">`).join('')}</datalist>
          </label>
          <label class="field"><span>Difficulty</span>
            <select class="select" id="f-diff">
              ${['easy', 'medium', 'hard'].map((d) => `<option value="${d}" ${p && p.difficulty === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}
            </select></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Score value</span><input class="input" type="number" min="0" id="f-score" value="${p ? p.score : S.difficultyScores.easy}"></label>
          <label class="field"><span>Topic XP value</span><input class="input" type="number" min="0" id="f-xp" value="${p ? p.xp : S.difficultyXP.easy}"></label>
        </div>
        <label class="field"><span>Assign to groups</span></label>
        <div class="check-grid">
          ${groups.map((g) => `<label class="check-row"><input type="checkbox" name="grp" value="${g.id}" ${p && p.groupIds.includes(g.id) ? 'checked' : ''}><span>${U.esc(g.name)}</span></label>`).join('') || '<p class="muted tiny">No groups yet.</p>'}
        </div>
        <div style="border:1px dashed var(--gold);border-radius:12px;padding:14px;margin-top:14px;background:rgba(251,191,36,.04)">
          <div class="muted tiny" style="font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--gold)">🪙 Hints for points (optional)</div>
          <p class="muted tiny" style="margin:6px 0 10px">Students pay part of this problem's score to reveal a hint. Hints are stored <b>on the server only</b> — invisible until unlocked. Cut = points deducted (blank = global default from Settings).</p>
          ${[0, 1, 2].map((i) => `<div class="hint-edit-row">
            <span class="muted tiny mono" style="min-width:52px">Hint ${i + 1}</span>
            <input class="input" id="f-hint-${i}" maxlength="600" placeholder="${['A tiny nudge…', 'A bigger nudge…', 'Almost the solution…'][i]}">
            <input class="input" type="number" min="0" id="f-cut-${i}" placeholder="−pts" title="Point discount for this hint" style="max-width:90px">
          </div>`).join('')}
        </div>
        <label class="check-row" style="margin-top:14px"><input type="checkbox" id="f-certificate" ${p && p.certificate ? 'checked' : ''}><span>Issue a green Problem Mastery certificate when a student solves this problem</span></label>
        <p class="muted tiny" style="margin-top:10px">Defaults come from Settings → Scoring Rules; you can override them per problem here.</p>`, 
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: p ? 'Save' : 'Add problem', cls: 'btn-primary', icon: 'check', keepOpen: true,
          onClick: (ev, bd, closeFn) => {
            const name = U.$('#f-name', bd).value.trim();
            const topic = U.$('#f-topic', bd).value.trim();
            if (!name) { U.toast('Name is required', 'error'); return false; }
            if (!topic) { U.toast('Topic is required', 'error'); return false; }
            if (!topics.includes(topic)) {
              const r = Store.addTopic(topic, 20);
              if (!r.ok) { U.toast(r.error, 'error'); return false; }
              U.toast(`New topic “${topic}” created (mastery 20 XP — edit in Settings)`, 'info', 'zap');
            }
            const data = {
              name, link: U.$('#f-link', bd).value, topic,
              difficulty: U.$('#f-diff', bd).value,
              score: U.$('#f-score', bd).value, xp: U.$('#f-xp', bd).value,
              certificate: U.$('#f-certificate', bd).checked,
              groupIds: U.$$('input[name="grp"]', bd).filter((x) => x.checked).map((x) => x.value),
            };
            let pid = p ? p.id : null;
            if (p) Store.updateProblem(p.id, data); else pid = Store.addProblem(data).id;
            const hints = [0, 1, 2].map((i) => ({ text: U.$('#f-hint-' + i, bd).value, cut: U.$('#f-cut-' + i, bd).value }));
            U.toast(p ? 'Problem updated' : 'Problem added', 'success');
            Store.saveHints(pid, hints).then((hr) => {
              if (!hr.ok) U.toast('Problem saved, but hints need the v1.7 cloud setup (Step 8b SQL) + sign-in', 'error');
              closeFn(); rerender('problems');
            });
            return false;
          },
        },
      ],
      mount: (bd) => {
        if (p) Store.hintsOf(p.id).then((r) => { (r.rows || []).forEach((h) => { const a = U.$('#f-hint-' + h.idx, bd), c = U.$('#f-cut-' + h.idx, bd); if (a) a.value = h.text; if (c && h.cut != null) c.value = h.cut; }); });
        if (p) return; // don't auto-overwrite when editing
        U.$('#f-diff', bd).addEventListener('input', (e) => {
          const d = e.target.value;
          U.$('#f-score', bd).value = S.difficultyScores[d];
          U.$('#f-xp', bd).value = S.difficultyXP[d];
        });
      },
    });
  }

  /* ================= RECORD SOLVES ================= */
  function tabSolves(el) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title">${ic('check')}Mark Problem as Solved</div>
        <p class="muted tiny" style="margin:6px 0 14px">Pick a problem, then tick the students who solved it. Scores, topic XP, leaderboards and analytics update automatically.</p>
        <div class="field-row">
          <label class="field"><span>Problem</span>
            <input class="input" id="sv-filter" placeholder="Type to filter problems…" style="margin-bottom:8px">
            <select class="select" id="sv-problem" size="1"></select></label>
          <label class="field"><span>Solve date</span><input class="input" type="date" id="sv-date" value="${U.today()}"></label>
        </div>
        <div id="sv-meta" class="muted tiny" style="margin-bottom:10px"></div>
        <div id="sv-students"></div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('clock')}Recently Recorded</div>
        <div class="table-wrap" style="margin-top:10px" id="sv-recent"></div>
      </div>`;

    const probSel = U.$('#sv-problem', el);
    const fillProblems = (q) => {
      let list = Store.problems();
      if (q) list = list.filter((p) => (p.name + ' ' + p.topic).toLowerCase().includes(q));
      probSel.innerHTML = list.map((p) => `<option value="${p.id}">${U.esc(p.name)} · ${U.esc(p.topic)} · ${p.difficulty}</option>`).join('') || '<option value="">(no matching problems)</option>';
      renderStudents();
    };
    const renderStudents = () => {
      const pid = probSel.value;
      const p = Store.problem(pid);
      const box = U.$('#sv-students', el);
      if (!p) { box.innerHTML = '<p class="muted">Select a problem first.</p>'; U.$('#sv-meta', el).textContent = ''; return; }
      U.$('#sv-meta', el).innerHTML = `Solving <b>${U.esc(p.name)}</b> gives <b class="mono">${p.score} pts</b> and <b class="mono">${p.xp} XP</b> in ${U.esc(p.topic)}.`;
      const inGroups = Store.students().filter((s) => p.groupIds.includes(s.groupId));
      const others = Store.students().filter((s) => !p.groupIds.includes(s.groupId));
      const row = (s) => {
        const has = s.solves.some((x) => x.problemId === pid);
        return `<label class="check-row"><input type="checkbox" data-sid="${s.id}" ${has ? 'checked' : ''}>
          <span>${U.esc(s.name)}</span><span class="sr-type">${U.esc((Store.group(s.groupId) || {}).name || 'no group')}</span></label>`;
      };
      box.innerHTML = `
        ${inGroups.length ? `<div class="muted tiny" style="margin:8px 0 6px">ASSIGNED GROUPS (${inGroups.length})</div><div class="check-grid">${inGroups.map(row).join('')}</div>` : ''}
        ${others.length ? `<div class="muted tiny" style="margin:12px 0 6px">OTHER STUDENTS (${others.length})</div><div class="check-grid">${others.map(row).join('')}</div>` : ''}
        ${Store.students().length ? '' : '<p class="muted">No students yet.</p>'}`;
    };
    const saveToggles = U.debounce(() => {
      const pid = probSel.value;
      const p = Store.problem(pid);
      if (!p) return;
      const date = U.$('#sv-date', el).value || U.today();
      let added = 0;
      U.$$('input[data-sid]', el).forEach((cb) => {
        const had = Store.student(cb.dataset.sid).solves.some((x) => x.problemId === pid);
        if (cb.checked && !had) added++;
        if (cb.checked !== had) Store.setSolve(cb.dataset.sid, pid, cb.checked, date);
      });
      if (added > 0) U.confetti();
      renderRecent();
    }, 450);

    const renderRecent = () => {
      const rec = Store.recentSolves(15);
      U.$('#sv-recent', el).innerHTML = rec.length ? `<table class="table">
        <thead><tr><th>Student</th><th>Problem</th><th>Diff</th><th>Pts</th><th>Date</th><th></th></tr></thead>
        <tbody>${rec.map((r) => `<tr>
          <td>${U.esc(r.student.name)}${r.via ? ' <span class="cf-badge" title="Verified automatically against Codeforces">✓ CF</span>' : ''}</td>
          <td><a class="link-accent" href="${U.safeURL(r.problem.link)}" target="_blank" rel="noopener">${U.esc(r.problem.name)}</a></td>
          <td>${C.diffTag(r.problem.difficulty)}</td>
          <td class="num">+${r.problem.score}</td>
          <td class="muted tiny mono">${U.fmtDate(r.date)}</td>
          <td><div class="row-actions"><button class="icon-btn" title="Remove solve" data-unsolve="${r.student.id}|${r.problem.id}" style="color:var(--red)">${ic('trash')}</button></div></td>
        </tr>`).join('')}</tbody></table>` : '<p class="muted">Nothing recorded yet.</p>';
    };

    U.$('#sv-filter', el).addEventListener('input', (e) => fillProblems(e.target.value.trim().toLowerCase()));
    probSel.addEventListener('input', renderStudents);
    el.addEventListener('change', (ev) => { if (ev.target.matches('input[data-sid]')) saveToggles(); });
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-unsolve]');
      if (!b) return;
      const [sid, pid] = b.dataset.unsolve.split('|');
      const ok = await U.confirm({ title: 'Remove solve?', message: 'The student will lose the points and XP from this problem.', danger: true, confirmLabel: 'Remove' });
      if (ok) { Store.setSolve(sid, pid, false); U.toast('Solve removed', 'success'); renderStudents(); renderRecent(); }
    });
    fillProblems('');
    renderRecent();
  }

  /* ================= CONTESTS ================= */
  function tabContests(el) {
    const render = () => {
      const cs = Store.contests().slice().sort((a, b) => b.date.localeCompare(a.date));
      el.innerHTML = `
      <div class="card">
        <div class="admin-toolbar">
          <span class="chip">${cs.length} contests</span>
          <span class="muted tiny">Points per rank: ${Store.settings().contestPoints.map((p, i) => `#${i + 1} → ${p}`).join(' · ')}</span>
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" id="c-add">${ic('trophy')}Record Contest</button>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Contest</th><th>Date</th><th>Winner</th><th>Ranked</th><th></th></tr></thead>
          <tbody>${cs.map((c) => {
        const w = c.results[0] ? Store.student(c.results[0].studentId) : null;
        return `<tr>
            <td><b>${U.esc(c.name)}</b><div class="muted tiny">${U.esc((c.description || '').slice(0, 60))}</div></td>
            <td class="muted tiny mono">${U.fmtDate(c.date)}</td>
            <td>${w ? U.esc(w.name) : '—'}</td>
            <td class="num">${c.results.length}</td>
            <td><div class="row-actions">
              <a class="icon-btn" title="View in Hall of Fame" href="#/contests">${ic('eye')}</a>
              <button class="icon-btn" data-edit="${c.id}" title="Edit">${ic('edit')}</button>
              <button class="icon-btn" data-del="${c.id}" title="Delete" style="color:var(--red)">${ic('trash')}</button>
            </div></td></tr>`;
      }).join('') || '<tr><td colspan="5" class="muted">No contests recorded yet.</td></tr>'}</tbody></table></div>
      </div>`;
    };
    U.$('#c-add', el) && null;
    el.addEventListener('click', async (ev) => {
      if (ev.target.closest('#c-add')) return contestForm(null, render);
      const eb = ev.target.closest('[data-edit]');
      const db2 = ev.target.closest('[data-del]');
      if (eb) contestForm(eb.dataset.edit, render);
      if (db2) {
        const c = Store.contest(db2.dataset.del);
        const ok = await U.confirm({ title: 'Delete contest?', message: `Delete <b>${U.esc(c.name)}</b>? Its points will be deducted from student scores.`, danger: true, confirmLabel: 'Delete' });
        if (ok) { Store.deleteContest(c.id); U.toast('Contest deleted', 'success'); render(); }
      }
    });
    render();
    if (sessionStorage.getItem('acp_quick') === 'add') { sessionStorage.removeItem('acp_quick'); contestForm(null, render); }
  }

  function contestForm(id, onDone) {
    const c = id ? Store.contest(id) : null;
    const students = Store.students();
    const pts = Store.settings().contestPoints;
    const beyond = Number(Store.settings().contestPointsBeyond) || 0;
    const award = (r) => (pts[r - 1] != null ? pts[r - 1] : beyond);
    const opt = (cur) => '<option value="">— empty —</option>' + students.map((s) => `<option value="${s.id}" ${cur === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('');
    const rowHTML = (r, ex) => `<div class="field-row rk-row" style="align-items:center">
        <label class="field" style="margin:0"><span class="rk-label">Rank #${r} · <b class="mono" style="color:var(--gold)">${award(r)} pts</b></span>
          <select class="select rk-student">${opt(ex ? ex.studentId : '')}</select></label>
        <label class="field" style="margin:0"><span>Problems solved</span>
          <input class="input rk-solved" type="number" min="0" value="${ex ? ex.solved : ''}" placeholder="0"></label>
        <button type="button" class="icon-btn rk-del" title="Remove this rank" style="visibility:${r > 5 ? 'visible' : 'hidden'}">${ic('x')}</button>
      </div>`;
    const n0 = c ? Math.max(5, c.results.length) : 5;
    const rows = Array.from({ length: n0 }, (_, i) => {
      const r = i + 1;
      const ex = c ? c.results.find((x) => x.rank === r) : null;
      return rowHTML(r, ex);
    }).join('');

    U.modal({
      title: c ? 'Edit Contest' : 'Record Contest',
      wide: true,
      body: `
        <div class="field-row">
          <label class="field"><span>Contest name *</span><input class="input" id="f-name" value="${c ? U.esc(c.name) : ''}" placeholder="e.g. Abdelmajid Cup — August"></label>
          <label class="field"><span>Date</span><input class="input" type="date" id="f-date" value="${c ? c.date : U.today()}"></label>
        </div>
        <label class="field"><span>Description</span><textarea class="input" id="f-desc" rows="2" placeholder="What was this contest about?">${c ? U.esc(c.description || '') : ''}</textarea></label>
        <label class="field" style="margin-bottom:8px"><span>Standings — in rank order <span class="muted tiny">(add as many ranks as you want)</span></span></label>
        <div id="rk-rows">${rows}</div>
        <button type="button" class="btn btn-ghost btn-sm" id="rk-add">${ic('plus')}Add rank</button>
        <div class="muted tiny" style="margin-top:8px">Ranks #1–#${pts.length}: ${pts.join(' / ')} pts · every rank beyond: ${beyond} pts (changeable in Settings).</div>`,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost' },
        {
          label: c ? 'Save results' : 'Save contest', cls: 'btn-primary', icon: 'trophy', keepOpen: true,
          onClick: (ev, bd, closeFn) => {
            const name = U.$('#f-name', bd).value.trim();
            if (!name) { U.toast('Contest name is required', 'error'); return false; }
            const picks = U.$$('.rk-row', bd).map((row) => ({
              studentId: row.querySelector('.rk-student').value,
              solved: row.querySelector('.rk-solved').value,
            }));
            const chosen = picks.map((p) => p.studentId).filter(Boolean);
            if (!chosen.length) { U.toast('Enter at least rank #1', 'error'); return false; }
            if (new Set(chosen).size !== chosen.length) { U.toast('A student cannot hold two ranks', 'error'); return false; }
            const data = { name, date: U.$('#f-date', bd).value || U.today(), description: U.$('#f-desc', bd).value, entries: picks };
            if (c) Store.updateContest(c.id, data); else Store.addContest(data);
            U.toast(c ? 'Contest updated' : 'Contest recorded — glory eternalized', 'gold', 'trophy');
            U.confetti(ev.clientX, ev.clientY);
            closeFn();
            if (onDone) onDone();
            return false;
          },
        },
      ],
      mount: (bd) => {
        const wrap = U.$('#rk-rows', bd);
        const renumber = () => {
          U.$$('.rk-row', wrap).forEach((row, i) => {
            const r = i + 1;
            row.querySelector('.rk-label').innerHTML = `Rank #${r} · <b class="mono" style="color:var(--gold)">${award(r)} pts</b>`;
            row.querySelector('.rk-del').style.visibility = r > 5 ? 'visible' : 'hidden';
          });
        };
        U.$('#rk-add', bd).onclick = () => {
          wrap.insertAdjacentHTML('beforeend', rowHTML(wrap.children.length + 1, null));
          renumber();
        };
        bd.addEventListener('click', (e) => {
          const del = e.target.closest('.rk-del');
          if (del) { del.closest('.rk-row').remove(); renumber(); }
        });
      },
    });
  }

  /* ================= ACHIEVEMENTS CATALOG ================= */
  function tabAchievements(el) {
    const tierColor = { bronze: 'var(--bronze)', silver: 'var(--silver)', gold: 'var(--gold)', special: 'var(--accent)', legend: 'var(--accent-2)' };
    const holders = (aid) => Store.students().filter((s) => s.achievements.some((x) => x.achievementId === aid));
    const render = () => {
      const cat = Store.catalog();
      el.innerHTML = `
      <div class="card">
        <div class="admin-toolbar">
          <span class="chip">${cat.length} achievements in catalog</span><span class="spacer"></span>
          <button class="btn btn-primary btn-sm" id="a-add">${ic('plus')}New Achievement</button>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Achievement</th><th>Series</th><th>Tier</th><th>Holders</th><th></th></tr></thead>
          <tbody>${cat.map((a) => `<tr>
            <td><div style="display:flex;align-items:center;gap:11px">
              <span class="${a.tier ? 'tier-' + ({ bronze: 'b', silver: 's', gold: 'g', special: 'x', legend: 'l' }[a.tier]) : ''}"><span class="ach-icon" style="width:36px;height:36px;border-radius:10px">${ic(a.icon || 'medal')}</span></span>
              <div><b>${U.esc(a.name)}</b><div class="muted tiny">${U.esc((a.description || '').slice(0, 55))}</div></div></div></td>
            <td class="muted">${U.esc(a.series)}</td>
            <td><span class="tag" style="background:color-mix(in srgb,${tierColor[a.tier] || 'var(--bronze)'} 13%,transparent);color:${tierColor[a.tier] || 'var(--bronze)'}">${U.esc(a.tier)}</span></td>
            <td class="num">${holders(a.id).length}</td>
            <td><div class="row-actions">
              <button class="icon-btn" data-edit="${a.id}" title="Edit">${ic('edit')}</button>
              <button class="icon-btn" data-del="${a.id}" title="Delete" style="color:var(--red)">${ic('trash')}</button>
            </div></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Catalog is empty.</td></tr>'}</tbody>
        </table></div>
        <p class="muted tiny" style="margin-top:12px">Award achievements to students from <b>Students → Edit</b>.</p>
      </div>`;
    };
    el.addEventListener('click', async (ev) => {
      if (ev.target.closest('#a-add')) return achForm(null, render);
      const eb = ev.target.closest('[data-edit]');
      const db2 = ev.target.closest('[data-del]');
      if (eb) achForm(eb.dataset.edit, render);
      if (db2) {
        const a = Store.catItem(db2.dataset.del);
        const ok = await U.confirm({ title: 'Delete achievement?', message: `Delete <b>${U.esc(a.name)}</b>? It will be revoked from all students.`, danger: true, confirmLabel: 'Delete' });
        if (ok) { Store.deleteCatItem(a.id); U.toast('Achievement deleted', 'success'); render(); }
      }
    });
    render();

    function achForm(id, onDone) {
      const a = id ? Store.catItem(id) : null;
      const icons = ['medal', 'trophy', 'crown', 'star', 'shield', 'flag', 'zap', 'flame', 'award', 'target', 'grad', 'code'];
      U.modal({
        title: a ? 'Edit Achievement' : 'New Achievement',
        body: `
          <div class="field-row">
            <label class="field"><span>Name *</span><input class="input" id="f-name" value="${a ? U.esc(a.name) : ''}" placeholder="e.g. TCPC Gold"></label>
            <label class="field"><span>Series</span><input class="input" id="f-series" value="${a ? U.esc(a.series) : ''}" placeholder="e.g. TCPC"></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Tier</span>
              <select class="select" id="f-tier">${['bronze', 'silver', 'gold', 'special', 'legend'].map((t) => `<option value="${t}" ${a && a.tier === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
            <label class="field"><span>Icon</span>
              <select class="select" id="f-icon">${icons.map((i2) => `<option value="${i2}" ${a && a.icon === i2 ? 'selected' : ''}>${i2}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Description</span><textarea class="input" id="f-desc" rows="2">${a ? U.esc(a.description || '') : ''}</textarea></label>`,
        actions: [
          { label: 'Cancel', cls: 'btn-ghost' },
          {
            label: a ? 'Save' : 'Create', cls: 'btn-primary', icon: 'check', keepOpen: true,
            onClick: (ev, bd, closeFn) => {
              const name = U.$('#f-name', bd).value.trim();
              if (!name) { U.toast('Name is required', 'error'); return false; }
              const data = { name, series: U.$('#f-series', bd).value.trim() || 'Custom', tier: U.$('#f-tier', bd).value, icon: U.$('#f-icon', bd).value, description: U.$('#f-desc', bd).value };
              if (a) Store.updateCatItem(a.id, data); else Store.addCatItem(data);
              U.toast(a ? 'Achievement updated' : 'Achievement created', 'success');
              closeFn(); onDone();
              return false;
            },
          },
        ],
      });
    }
  }

  /* ================= SETTINGS ================= */
  /* ============================================================ CODE CLINIC (v1.7) */
  function tabClinic(el) {
    const S = Store.settings();
    const cloud = Store.cloudEnabled && Store.cloudEnabled();
    const authed = cloud && Store.cloudStatus().authed;
    el.innerHTML = `
      <div class="card reveal in">
        <div class="card-title">${ic('code')}Code Clinic — Inbox</div>
        <p class="muted tiny" style="margin-top:6px">Buggy code sent by students (from their Student Space). Weekly limit per student: <b>${S.clinicWeeklyLimit || 'unlimited'}</b> — change it in Settings → Gamification.
        <button class="btn btn-ghost btn-sm" id="clin-sql" style="margin-left:8px">${ic('database')}Setup SQL (Step 8b)</button></p>
        <div id="clin-body" style="margin-top:12px"><p class="muted tiny">${authed ? 'Loading…' : 'Sign in with cloud sync to read the clinic inbox.'}</p></div>
      </div>`;
    U.$('#clin-sql', el).onclick = () => U.modal({
      title: 'Step 8b SQL — run once in Supabase', wide: true,
      body: `<pre class="sql-pre">${U.esc(Store.passportSQL())}</pre>`,
      actions: [{ label: 'Close', cls: 'btn-ghost' }, { label: 'Copy SQL', cls: 'btn-primary', icon: 'save', keepOpen: true, onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(Store.passportSQL()).then(() => U.toast('SQL copied', 'success')); return false; } }],
    });
    if (!authed) return;
    const SYM = { wa: 'Wrong Answer', tle: 'Time Limit', re: 'Runtime Error', other: 'Question' };
    Store.clinicCases().then((r) => {
      const body = U.$('#clin-body', el);
      if (!r.ok) { body.innerHTML = `<div class="vf-result vf-err">${ic('warn')}<span>${U.esc(r.error || 'Could not load cases — did you run the Step 8b SQL?')}</span></div>`; return; }
      const rows = r.rows || [];
      body.innerHTML = rows.length ? rows.map((c) => `
        <div class="cl-case ${c.status === 'answered' ? 'cl-answered' : ''}" data-case="${c.id}">
          <div class="jr-head">${U.avatarHTML({ name: c.student_name || '?', photo: null }, 'avatar-36')}
            <b>${U.esc(c.student_name || '')}</b>
            <span class="chip">${SYM[c.symptom] || 'Case'}</span>
            <span class="chip ${c.status === 'answered' ? '' : 'jr-status new'}">${c.status === 'answered' ? 'answered' : 'open'}</span>
            <span class="muted tiny">${U.timeAgo(c.created_at)}</span></div>
          ${c.problem_link ? `<a class="link-accent mono tiny" href="${U.safeURL(c.problem_link)}" target="_blank" rel="noopener">${U.esc(c.problem_link)}</a>` : ''}
          ${c.note ? `<div class="muted tiny" style="margin:4px 0"><b>Question:</b> ${U.esc(c.note)}</div>` : ''}
          <details style="margin-top:6px"><summary class="link-accent tiny" style="cursor:pointer">Show the code (${(c.code || '').split('\n').length} lines)</summary><pre class="sql-pre" style="max-height:260px;margin-top:8px">${U.esc(c.code || '')}</pre></details>
          ${c.coach_reply ? `<div class="cl-reply" style="margin-top:8px">${ic('grad')}<div><b>Your answer:</b><br>${U.esc(c.coach_reply)}</div></div>` : `
          <div class="field-row" style="margin-top:10px;align-items:flex-end">
            <label class="field" style="margin:0;flex:1"><span>Your answer</span><textarea class="input" id="cl-rep-${c.id}" rows="2" maxlength="2000" placeholder="Explain the bug, paste the fixed line, give a hint…"></textarea></label>
            <button class="btn btn-primary btn-sm" data-reply="${c.id}">${ic('check')}Send reply</button>
            <button class="icon-btn" data-cldel="${c.id}" title="Delete case" style="color:var(--red)">${ic('trash')}</button>
          </div>`}
        </div>`).join('') : '<p class="muted tiny">No cases yet — share the news: students can send buggy code from their Student Space! 🏥</p>';
      U.$$('[data-reply]', body).forEach((b) => b.onclick = async () => {
        const id = b.dataset.reply;
        const val = (window.document.querySelector('#cl-rep-' + CSS.escape(id)) || {}).value || '';
        if (!val.trim()) return U.toast('Write your answer first', 'error');
        b.disabled = true;
        const rr = await Store.clinicReply(id, val.trim());
        b.disabled = false;
        U.toast(rr.ok ? 'Reply sent — the student sees it in their space ✉' : (rr.error || 'Failed'), rr.ok ? 'success' : 'error');
        if (rr.ok) rerender('clinic');
      });
      U.$$('[data-cldel]', body).forEach((b) => b.onclick = async () => {
        if (!(await U.confirm('Delete this case?', { title: 'Delete', danger: true, okLabel: 'Delete' }))) return;
        const rr = await Store.clinicDelete(b.dataset.cldel);
        U.toast(rr.ok ? 'Deleted' : 'Failed', rr.ok ? 'success' : 'error');
        if (rr.ok) rerender('clinic');
      });
    });
  }

  /* ============================================================ SEASONS (v1.7) */
  function tabSeasons(el) {
    const seasons = Store.seasons().slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    const groups = Store.groups();
    const active = Store.activeSeason();
    el.innerHTML = `
      <div class="card reveal in">
        <div class="card-title">${ic('flame')}Seasons</div>
        <p class="muted tiny" style="margin-top:6px">A season follows the selected groups and counts every score event inside its dates. Membership is live: students enter or leave the season with their current group. End a season to freeze its <b>Top 2</b> on the public Champion Wall.</p>
        <div class="field-row" style="margin-top:14px;align-items:flex-end">
          <label class="field" style="margin:0;flex:2"><span>Season name</span><input class="input" id="sn-name" maxlength="60" placeholder="e.g. Season 3 — Graph Rush"></label>
          <label class="field" style="margin:0"><span>Start</span><input class="input" type="date" id="sn-start" value="${U.today()}"></label>
          <label class="field" style="margin:0"><span>End</span><input class="input" type="date" id="sn-end"></label>
        </div>
        <label class="field" style="margin-top:12px"><span>Included groups <span class="muted tiny">(students in these groups participate)</span></span></label>
        <div class="check-grid season-group-picker" id="sn-groups">
          ${groups.length ? groups.map((g) => `<label class="check-row"><input type="checkbox" name="sn-group" value="${U.esc(g.id)}"><span>${U.esc(g.name)}</span><span class="sr-type">${Store.groupStats(g.id).count} students</span></label>`).join('') : '<p class="muted tiny">Create a group first.</p>'}
        </div>
        <button class="btn btn-primary btn-sm" id="sn-create" style="margin-top:13px">${ic('plus')}Create &amp; go live</button>
        </div>
      </div>
      <div class="card reveal in" style="margin-top:16px">
        <div class="card-title">${ic('trophy')}All seasons <span class="chip" style="margin-left:auto">${seasons.length}</span></div>
        <div class="table-wrap" style="margin-top:10px">${seasons.length ? `<table class="table"><thead><tr><th>Season</th><th>Groups</th><th>Window</th><th>Status</th><th>Champion</th><th></th></tr></thead><tbody>
          ${seasons.map((s) => `<tr>
            <td><b>${U.esc(s.name)}</b></td>
            <td class="tiny">${s.groupIds && s.groupIds.length ? s.groupIds.map((gid) => { const g = Store.group(gid); return g ? `<span class="chip" style="margin:1px 3px 1px 0">${U.esc(g.name)}</span>` : ''; }).join('') : '<span class="muted">All groups</span>'}</td>
            <td class="mono tiny muted">${U.fmtDate(s.start)} → ${s.end ? U.fmtDate(s.end) : '…'}</td>
            <td>${s.champions ? '<span class="chip">🏁 finished</span>' : (active && active.id === s.id ? '<span class="chip" style="color:var(--gold)">🔥 LIVE</span>' : '<span class="chip">planned</span>')}</td>
            <td class="tiny">${s.champions && s.champions[0] ? '🥇 ' + U.esc(s.champions[0].name) : '—'}</td>
            <td><div class="row-actions">
              ${!s.champions ? (active && active.id === s.id
                ? `<button class="btn btn-ghost btn-sm" data-end="${s.id}" title="End now and crown the champions">${ic('crown')}End season</button>`
                : `<button class="btn btn-ghost btn-sm" data-live="${s.id}" title="Make this the live season">${ic('zap')}Go live</button>`) : ''}
              <button class="icon-btn" data-sndel="${s.id}" style="color:var(--red)" title="${s.champions ? 'Remove season and its wall record' : 'Delete season'}">${ic('trash')}</button>
            </div></td></tr>`).join('')}</tbody></table>` : '<p class="muted tiny">No seasons yet — create the first one above! 🔥</p>'}</div>
      </div>`;
    U.$('#sn-create', el).onclick = () => {
      const name = U.$('#sn-name', el).value.trim(), start = U.$('#sn-start', el).value, end = U.$('#sn-end', el).value;
      if (!name) return U.toast('Season name required', 'error');
      if (!start) return U.toast('Start date required', 'error');
      if (end && end < start) return U.toast('End date must be after the start', 'error');
      const groupIds = U.$$('input[name="sn-group"]', el).filter((x) => x.checked).map((x) => x.value);
      if (!groupIds.length) return U.toast('Select at least one group for the season', 'error');
      const s = Store.addSeason({ name, start, end: end || null, groupIds });
      Store.setActiveSeason(s.id);
      U.toast(`Season “${name}” is LIVE 🔥`, 'success', 'flame');
      if (U.confetti) U.confetti();
      rerender('seasons');
    };
    U.$$('[data-live]', el).forEach((b) => b.onclick = () => { Store.setActiveSeason(b.dataset.live); U.toast('Season is live now', 'success'); rerender('seasons'); });
    U.$$('[data-end]', el).forEach((b) => b.onclick = async () => {
      if (!(await U.confirm('End this season? The Top 2 will be frozen on the Champion Wall forever.', { title: 'End season', okLabel: 'Crown the champions 👑' }))) return;
      Store.endSeason(b.dataset.end);
      U.toast('Season ended — champions crowned 👑', 'gold', 'crown');
      rerender('seasons');
    });
    U.$$('[data-sndel]', el).forEach((b) => b.onclick = async () => {
      const season = Store.seasons().find((s) => s.id === b.dataset.sndel);
      const message = season && season.champions ? 'Remove this finished season? Its Champion Wall record will also be removed.' : 'Delete this season?';
      if (!(await U.confirm(message, { title: 'Remove season', danger: true, okLabel: 'Remove' }))) return;
      Store.deleteSeason(b.dataset.sndel); rerender('seasons');
    });
  }

  /* ============================================================ AUTO-VERIFY (Codeforces) */
  function tabVerify(el) {
    const S = Store.settings();
    const cloud = Store.cloudEnabled && Store.cloudEnabled();
    const authed = cloud && Store.cloudStatus().authed;
    el.innerHTML = `
      <div class="card reveal in">
        <div class="card-title">${ic('zap')}Codeforces Auto-Verify</div>
        <p class="muted tiny" style="margin-top:8px">Students submit solves from the public page <a class="link-accent mono" href="#/submit">#/submit</a> using a personal secret code. Every claim is checked <b>server-side</b> against the real Codeforces record — fake solves are impossible.
          <span class="chip" style="margin-left:6px">${cloud ? (authed ? '☁ signed in' : '☁ connected — sign in to manage') : '✕ cloud not connected'}</span>
          <span class="chip" style="margin-left:6px">🛡 codes stored as server-side hashes only</span></p>
      </div>
      ${!cloud ? `
      <div class="card reveal in"><div class="card-title">${ic('warn')}Cloud connection required</div>
        <p class="muted tiny" style="margin-top:8px">Auto-verify needs your Supabase cloud (the free plan is enough). Set it up in the Backup &amp; Data tab, then come back here.</p></div>` : `
      <div class="card reveal in">
        <div class="card-title">${ic('database')}One-time setup</div>
        <ol class="vv-steps">
          <li><b>1.</b> Run the setup SQL below in your Supabase project (SQL Editor → New query → paste → Run).</li>
          <li><b>2.</b> Deploy the secure verifier (Edge Function) — follow <b>Step 9</b> of <code>docs/SUPABASE_GUIDE.md</code>. It's one copy-paste, no coding.</li>
        </ol>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-ghost btn-sm" id="vv-sql">${ic('database')}Show setup SQL</button>
        </div>
      </div>
      <div class="card reveal in">
        <div class="card-title">${ic('calendar')}Activation date</div>
        <p class="muted tiny" style="margin-top:8px">Only Codeforces submissions made <b>on or after</b> this date are counted — students can't dig up solves from years ago. Leave empty to accept everything.</p>
        <div class="field-row" style="margin-top:10px;align-items:flex-end">
          <label class="field" style="margin:0;max-width:220px"><span>Count submissions from</span><input class="input" type="date" id="vv-since" value="${S.cfSince || ''}"></label>
          <button class="btn btn-ghost btn-sm" id="vv-today">Set to today</button>
          <button class="btn btn-primary btn-sm" id="vv-save-since">${ic('save')}Save</button>
        </div>
      </div>
      <div class="card reveal in">
        <div class="card-title">${ic('key')}Student secret codes</div>
        <p class="muted tiny" style="margin-top:8px">Give each student their code privately (in person or DM). Codes are stored as <b>hashes on the server only</b> — nobody can read them back, not even you. Lost shortcode? Generate a new one; the old one dies instantly.</p>
        <div id="vv-codes" style="margin-top:12px"><p class="muted tiny">${authed ? 'Loading…' : 'Sign in (you are in the admin panel already — just log in with cloud sync active) to manage codes.'}</p></div>
      </div>
      <div class="card reveal in">
        <div class="card-title">${ic('refresh')}Sync from Codeforces</div>
        <p class="muted tiny" style="margin-top:8px">One click scans every student's recent Codeforces submissions and records accepted solves for library problems automatically — no codes needed.</p>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="vv-sync" ${authed ? '' : 'disabled'}>${ic('refresh')}Sync now</button>
          <span class="muted tiny" id="vv-sync-out"></span>
        </div>
        <div id="vv-sync-detail" style="margin-top:10px"></div>
      </div>
      <div class="card reveal in">
        <div class="card-title">${ic('shield')}Verification log <span class="chip" style="margin-left:auto" id="vv-audit-n">${Store.verifiedRows().length}</span></div>
        <div id="vv-audit" style="margin-top:12px"></div>
      </div>`}`;

    if (!cloud) return;

    U.$('#vv-sql', el).onclick = () => {
      const m = U.modal({
        title: 'Setup SQL — run once in Supabase',
        wide: true,
        body: `<p class="muted tiny" style="margin-bottom:10px">Supabase Dashboard → SQL Editor → New query → paste everything below → Run. Safe to run twice.</p>
               <pre class="sql-pre" id="vv-sql-pre">${U.esc(Store.verifySQL())}</pre>`,
        actions: [{ label: 'Close', cls: 'btn-ghost' }, { label: 'Copy SQL', cls: 'btn-primary', icon: 'save', keepOpen: true,
          onClick: (ev, bd) => { const t = Store.verifySQL();
            if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => U.toast('SQL copied — paste it in Supabase', 'success'));
            else U.toast('Select the text and copy it manually', 'info'); return false; } }],
      });
    };

    U.$('#vv-today', el).onclick = () => { U.$('#vv-since', el).value = U.today(); };
    U.$('#vv-save-since', el).onclick = () => {
      Store.updateSettings({ cfSince: U.$('#vv-since', el).value || null });
      U.toast('Activation date saved', 'success');
    };

    const auditHTML = () => {
      const rows = Store.verifiedRows();
      U.$('#vv-audit-n', el).textContent = rows.length;
      U.$('#vv-audit', el).innerHTML = rows.length ? `<div class="jr-list">${rows.slice(0, 50).map((r) => `
        <div class="jr-item">
          ${U.avatarHTML({ name: r.student_name || r.student_id, photo: null }, 'avatar-36')}
          <div class="jr-main">
            <div class="jr-head"><b>${U.esc(r.student_name || r.student_id)}</b>
              <span class="chip">${r.source === 'claim' ? 'secret code' : 'sync'}</span>
              <span class="muted tiny">${U.timeAgo(r.created_at)}</span></div>
            <span class="muted tiny">${U.esc(r.problem_name || '')} · <b style="color:var(--gold)">+${r.points} pts</b>${/^\d+$/.test(String(r.contest_id)) && /^\d+$/.test(String(r.submission_id)) ? ` · <a class="link-accent mono tiny" href="${U.esc('https://codeforces.com/contest/' + Number(r.contest_id) + '/submission/' + Number(r.submission_id))}" target="_blank" rel="noopener">submission #${Number(r.submission_id)}</a>` : ''}</span>
          </div>
        </div>`).join('')}</div>` : '<p class="muted tiny">No verified solves yet. Share codes with students or hit “Sync now”.</p>';
    };
    auditHTML();

    const loadCodes = async () => {
      const box = U.$('#vv-codes', el);
      if (!authed) return;
      box.innerHTML = '<p class="muted tiny">Loading…</p>';
      const r = await Store.cfCodeStatus();
      if (!r.ok) { box.innerHTML = `<div class="vf-err vf-result">${ic('warn')}<span>${U.esc((r.data && r.data.message) || r.error || 'Could not reach the verifier. Is the Edge Function deployed? (Guide, Step 9)')}</span></div>`; return; }
      const active = (r.data && r.data.students) || {};
      const studs = Store.students();
      box.innerHTML = studs.length ? `<table class="table"><thead><tr><th>Student</th><th>Codeforces</th><th>Code</th><th></th></tr></thead><tbody>
        ${studs.map((s) => `<tr>
          <td>${U.esc(s.name)}</td>
          <td class="mono tiny">${s.cfHandle ? U.esc(s.cfHandle) : '<span style="color:var(--red)">not set — edit student</span>'}</td>
          <td>${active[s.id] ? '<span class="chip">🔑 active</span>' : '<span class="muted tiny">none</span>'}</td>
          <td><div class="row-actions">
            <button class="icon-btn" title="${active[s.id] ? 'Generate a NEW code (revokes the old one)' : 'Generate secret code'}" data-gen="${s.id}" ${s.cfHandle ? '' : 'disabled'}>${ic('key')}</button>
            ${active[s.id] ? `<button class="icon-btn" title="Revoke code" data-rev="${s.id}" style="color:var(--red)">${ic('trash')}</button>` : ''}
          </div></td></tr>`).join('')}</tbody></table>` : '<p class="muted tiny">Add students first.</p>';
      U.$$('[data-gen]', box).forEach((b) => b.onclick = async () => {
        const st = Store.student(b.dataset.gen);
        b.disabled = true;
        const rr = await Store.cfGenerateCode(b.dataset.gen);
        b.disabled = false;
        if (!rr.ok) return U.toast((rr.data && rr.data.message) || rr.error || 'Failed', 'error');
        if (st) U.confetti();
        const m = U.modal({
          title: `Secret code for ${st ? st.name : 'student'}`,
          body: `<p class="muted tiny">Give this code to <b>${st ? U.esc(st.name) : 'the student'}</b> privately. It is shown <b>only once</b> — the server keeps just a fingerprint (hash) of it.</p>
                 <div class="vv-code-big mono" id="vv-new-code">${U.esc(rr.data.code)}</div>`,
          actions: [{ label: 'Done', cls: 'btn-ghost' }, { label: 'Copy code', cls: 'btn-primary', icon: 'save', keepOpen: true,
            onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(rr.data.code).then(() => U.toast('Code copied — send it privately', 'success')); return false; } }],
        });
        loadCodes();
      });
      U.$$('[data-rev]', box).forEach((b) => b.onclick = async () => {
        const st = Store.student(b.dataset.rev);
        const ok = await U.confirm(`Revoke ${st ? st.name : 'this student'}'s code? They won't be able to submit until you generate a new one.`, { title: 'Revoke code', danger: true, okLabel: 'Revoke' });
        if (!ok) return;
        const rr = await Store.cfRevokeCode(b.dataset.rev);
        U.toast(rr.ok ? 'Code revoked' : ((rr.data && rr.data.message) || 'Failed'), rr.ok ? 'success' : 'error');
        loadCodes();
      });
    };
    loadCodes();

    const syncBtn = U.$('#vv-sync', el);
    if (syncBtn && authed) syncBtn.onclick = async () => {
      syncBtn.disabled = true;
      U.$('#vv-sync-out', el).textContent = 'Scanning Codeforces — this takes a few seconds…';
      const r = await Store.cfSync();
      syncBtn.disabled = false;
      const d = r.data || {};
      if (!r.ok) {
        U.$('#vv-sync-out', el).textContent = '';
        U.$('#vv-sync-detail', el).innerHTML = `<div class="vf-err vf-result">${ic('warn')}<span>${U.esc(d.message || r.error || 'Sync failed — is the Edge Function deployed? (Guide, Step 9)')}</span></div>`;
        return;
      }
      U.$('#vv-sync-out', el).textContent = `Done — ${d.added || 0} new solve${d.added === 1 ? '' : 's'} recorded.`;
      if ((d.added || 0) > 0) {
        await Store.fetchVerifiedSolves().catch(() => []);
        Store.applyVerifiedSolves(Store.verifiedRows());
        auditHTML();
        U.toast(`${d.added} verified solve${d.added === 1 ? '' : 's'} recorded ⚡`, 'success', 'zap');
        if (U.confetti) U.confetti();
      }
      const un = d.unmatched || [];
      U.$('#vv-sync-detail', el).innerHTML = un.length ? `<p class="muted tiny"><b>${un.length}</b> accepted submission${un.length === 1 ? '' : 's'} skipped because the problem is not in the library:</p>
        <div class="jr-list" style="margin-top:8px">${un.slice(0, 12).map((u) => `<div class="jr-item"><div class="jr-main">
          <div class="jr-head"><b>${U.esc(u.student || '')}</b></div>
          <a class="link-accent mono tiny" href="${U.safeURL(u.link || '#')}" target="_blank" rel="noopener">${U.esc(u.name || u.link || '')}</a>
          <span class="muted tiny">Add the problem to the library, then sync again.</span></div></div>`).join('')}</div>` : '';
    };
  }

  function tabNextCourseAds(el) {
    const groups = Store.groups();
    let ads = Store.nextCourseAdsList().map((ad, i) => ({ id: ad.id || 'ad_' + i, ...ad, visibleGroupIds: Array.isArray(ad.visibleGroupIds) && ad.visibleGroupIds.length ? ad.visibleGroupIds.slice() : (ad.sourceGroupId ? [ad.sourceGroupId] : []) }));
    const blank = () => ({ id: 'ad_' + Math.random().toString(36).slice(2), enabled: true, level: 'NEXT LEVEL', status: 'COMING SOON', title: 'Your next course starts here.', description: 'Continue building your problem-solving skills.', age: 'Ages 13–17', period: 'Dates to be announced', duration: '16 hours', experience: 'For students ready for the next challenge.', learn: ['Algorithms', 'Problem solving', 'Contest practice'], visibleGroupIds: groups.length ? [groups[0].id] : [], availability: {} });
    const readAd = (card, ad) => ({
      ...ad,
      enabled: U.$('[data-nca-enabled]', card).checked,
      level: U.$('[data-nca-level]', card).value.trim(), status: U.$('[data-nca-status]', card).value.trim(),
      title: U.$('[data-nca-title]', card).value.trim(), description: U.$('[data-nca-description]', card).value.trim(),
      age: U.$('[data-nca-age]', card).value.trim(), period: U.$('[data-nca-period]', card).value.trim(), duration: U.$('[data-nca-duration]', card).value.trim(), experience: U.$('[data-nca-experience]', card).value.trim(),
      learn: [0, 1, 2].map((i) => U.$('[data-nca-learn="' + i + '"]', card).value.trim()).filter(Boolean),
      visibleGroupIds: U.$$('[data-nca-group]', card).filter((x) => x.checked).map((x) => x.value),
      availability: window.ACPAvailability ? window.ACPAvailability.readAdmin(card, 'nca-' + ad.id) : {},
    });
    const render = () => {
      el.innerHTML = `<div class="admin-subpage-head"><span class="section-kicker"><i class="dot"></i>STUDENT EXPERIENCE</span><h2>${ic('star')}Next Course Advertisements</h2><p>Create multiple ads, choose the visible groups and publish an independent weekly schedule for each one.</p></div>
        <div class="admin-next-toolbar"><span class="chip">${ads.length} advertisements</span><button class="btn btn-primary btn-sm" id="nca-add">${ic('plus')}Add advertisement</button></div>
        <div class="next-course-ad-list">${ads.length ? ads.map((ad, i) => `<div class="card next-ad-editor" data-nca-card="${U.esc(ad.id)}">
          <div class="next-ad-editor-head"><div><span class="section-kicker">ADVERTISEMENT ${i + 1}</span><h3>${U.esc(ad.title || 'Untitled advertisement')}</h3></div><label class="check-row"><input type="checkbox" data-nca-enabled ${ad.enabled !== false ? 'checked' : ''}> Visible</label></div>
          <div class="field-row"><label class="field"><span>Level</span><input class="input" data-nca-level value="${U.esc(ad.level || '')}"></label><label class="field"><span>Status</span><input class="input" data-nca-status value="${U.esc(ad.status || '')}"></label></div>
          <label class="field"><span>Title</span><input class="input" data-nca-title maxlength="140" value="${U.esc(ad.title || '')}"></label>
          <label class="field"><span>Description</span><textarea class="input" data-nca-description rows="2" maxlength="260">${U.esc(ad.description || '')}</textarea></label>
          <div class="field-row"><label class="field"><span>Age</span><input class="input" data-nca-age value="${U.esc(ad.age || '')}"></label><label class="field"><span>Period</span><input class="input" data-nca-period value="${U.esc(ad.period || '')}"></label><label class="field"><span>Duration</span><input class="input" data-nca-duration value="${U.esc(ad.duration || '')}"></label></div>
          <label class="field"><span>Experience message</span><input class="input" data-nca-experience value="${U.esc(ad.experience || '')}"></label>
          <label class="field"><span>What students learn</span></label><div class="field-row">${[0,1,2].map((n) => `<label class="field"><span>Topic ${n + 1}</span><input class="input" data-nca-learn="${n}" value="${U.esc((ad.learn || [])[n] || '')}"></label>`).join('')}</div>
          <label class="field"><span>Visible for groups</span></label><div class="check-grid next-visible-groups">${groups.map((g) => `<label class="check-row"><input type="checkbox" data-nca-group value="${U.esc(g.id)}" ${ad.visibleGroupIds.includes(g.id) ? 'checked' : ''}><span>${U.esc(g.name)}</span></label>`).join('')}</div>
          <div class="nca-schedule-wrap">${window.ACPAvailability ? window.ACPAvailability.adminHTML('nca-' + ad.id, ad.availability || {}, { displayStart: ad.schedulePlan && ad.schedulePlan.displayStart, displayEnd: ad.schedulePlan && ad.schedulePlan.displayEnd }) : ''}</div>
          <div class="next-ad-editor-actions"><button class="btn btn-primary btn-sm" data-nca-save>${ic('save')}Save advertisement</button><button class="btn btn-danger btn-sm" data-nca-delete>${ic('trash')}Delete</button></div>
        </div>`).join('') : '<div class="card availability-empty">No next-course advertisements yet.</div>'}</div>`;
      U.$('#nca-add', el).onclick = () => { ads.push(blank()); render(); };
      ads.forEach((ad) => {
        const card = U.$(`[data-nca-card="${ad.id}"]`, el);
        if (!card) return;
        if (window.ACPAvailability) window.ACPAvailability.wireAdmin(card, 'nca-' + ad.id);
        U.$('[data-nca-save]', card).onclick = () => {
          const visible = U.$$('[data-nca-group]', card).filter((x) => x.checked);
          if (!visible.length) return U.toast('Select at least one visible group', 'error');
          ads = ads.map((x) => x.id === ad.id ? readAd(card, x) : x);
          Store.saveNextCourseAds(ads); U.toast('Advertisement saved', 'success'); render();
        };
        U.$('[data-nca-delete]', card).onclick = async () => { if (await U.confirm('Delete this advertisement?', { title: 'Delete advertisement', danger: true, okLabel: 'Delete' })) { ads = ads.filter((x) => x.id !== ad.id); Store.saveNextCourseAds(ads); render(); } };
      });
    };
    render();
  }

  function tabSettingsSection(el, id) {
    tabSettings(el);
    const target = U.$('#' + id, el);
    if (!target) return;
    const labels = { 'academy-settings': 'Academy Settings', 'course-settings': 'Course Advertisement', 'next-course-settings': 'Next Course Ads', 'scoring-settings': 'Scoring', 'gamification-settings': 'Bonuses & Clinic', 'levels-settings': 'Levels', 'topics-settings': 'Topics', 'security-settings': 'Security', 'notification-settings': 'Email Notifications' };
    const head = document.createElement('div');
    head.className = 'admin-subpage-head';
    head.innerHTML = `<span class="section-kicker"><i class="dot"></i>COACH SETTINGS</span><h2>${ic('settings')}${U.esc(labels[id] || 'Settings')}</h2><p>This is an independent settings page. Changes save immediately.</p>`;
    target.before(head);
    Array.from(el.children).forEach((child) => { if (child !== target && child !== head) child.remove(); });
    const title = target.querySelector('.card-title');
    if (title) title.classList.add('settings-page-title');
  }

  function tabMessages(el) {
    const groups = Store.groups(); const students = Store.students();
    const render = () => {
      const messages = Store.settings().coachMessages || [];
      el.innerHTML = `<div class="admin-subpage-head"><span class="section-kicker"><i class="dot"></i>STUDENT COMMUNICATION</span><h2>${ic('message')}Coach Messages</h2><p>Send a dated banner to selected groups, selected students, or everyone.</p></div>
        <div class="card message-compose-card">
          <div class="card-title">${ic('plus')}Create important message</div>
          <form id="msg-form" style="margin-top:14px">
            <div class="field-row"><label class="field"><span>Title</span><input class="input" id="msg-title" maxlength="100" placeholder="Important update"></label><label class="field"><span>Starts</span><input class="input" type="date" id="msg-start" value="${U.today()}"></label><label class="field"><span>Ends</span><input class="input" type="date" id="msg-end"></label></div>
            <label class="field"><span>Message</span><textarea class="input" id="msg-body" rows="3" maxlength="800" placeholder="Your message for students…"></textarea></label>
            <div class="message-target-grid"><div><label class="field"><span>Send to groups</span></label><div class="check-grid">${groups.map((g) => `<label class="check-row"><input type="checkbox" data-msg-group value="${U.esc(g.id)}"><span>${U.esc(g.name)}</span></label>`).join('')}</div></div><div><label class="field"><span>Send to students</span></label><div class="check-grid">${students.map((s) => `<label class="check-row"><input type="checkbox" data-msg-student value="${U.esc(s.id)}"><span>${U.esc(s.name)}</span></label>`).join('')}</div></div></div>
            <p class="muted tiny" style="margin:10px 0">Leave both audiences empty to show the banner to every student.</p>
            <button class="btn btn-primary btn-sm" type="submit">${ic('send')}Publish message</button>
          </form>
        </div>
        <div class="card" style="margin-top:18px"><div class="card-title">${ic('clock')}Published messages <span class="chip" style="margin-left:auto">${messages.length}</span></div><div class="coach-message-admin-list">${messages.length ? messages.map((m) => `<div class="coach-message-admin-row"><div class="message-admin-main"><div class="jr-head"><b>${U.esc(m.title)}</b><span class="chip">${m.enabled === false ? 'disabled' : 'live/draft'}</span><span class="muted tiny">${U.fmtDate(m.startDate)}${m.endDate ? ' → ' + U.fmtDate(m.endDate) : ''}</span></div><p>${U.esc(m.body)}</p><small>${m.groupIds && m.groupIds.length ? m.groupIds.map((id) => { const g = Store.group(id); return g ? g.name : id; }).join(', ') : 'All groups'}${m.studentIds && m.studentIds.length ? ' · ' + m.studentIds.length + ' selected students' : ''}</small></div><button class="icon-btn" data-msg-delete="${U.esc(m.id)}" style="color:var(--red)" title="Delete">${ic('trash')}</button></div>`).join('') : '<p class="muted tiny" style="padding:14px 0">No messages yet.</p>'}</div></div>`;
      U.$('#msg-form', el).onsubmit = (e) => { e.preventDefault(); const r = Store.addCoachMessage({ title: U.$('#msg-title', el).value, body: U.$('#msg-body', el).value, startDate: U.$('#msg-start', el).value, endDate: U.$('#msg-end', el).value || null, groupIds: U.$$('[data-msg-group]', el).filter((x) => x.checked).map((x) => x.value), studentIds: U.$$('[data-msg-student]', el).filter((x) => x.checked).map((x) => x.value) }); if (!r.ok) return U.toast(r.error, 'error'); U.toast('Message published', 'success', 'message'); render(); };
      U.$$('[data-msg-delete]', el).forEach((b) => b.onclick = async () => { if (await U.confirm('Delete this coach message?', { title: 'Delete message', danger: true, okLabel: 'Delete' })) { Store.deleteCoachMessage(b.dataset.msgDelete); render(); } });
    };
    render();
  }

  const scheduleTimeMinutes = (value) => {
    const m = String(value || '').match(/^(\d{2}):(\d{2})$/); if (!m) return -1;
    const mins = Number(m[1]) * 60 + Number(m[2]); return mins >= 0 && mins <= 1440 ? mins : -1;
  };
  const scheduleClock = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const scheduleDayLabel = (key) => { const day = Store.weekdays().find((x) => x.key === key); return day ? day.label : key; };
  const scheduleFitsWindow = (availability, session) => ((availability && availability[session.day]) || []).some((range) => {
    const start = scheduleTimeMinutes(range.start); const end = scheduleTimeMinutes(range.end);
    return start >= 0 && end > start && session.startMin >= start && session.endMin <= end;
  });
  const scheduleOverlaps = (a, b) => a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
  const schedulePeopleHaveAvailability = (people) => (people || []).filter((person) => person && person.availability && Object.values(person.availability).some((ranges) => Array.isArray(ranges) && ranges.length));
  const scheduleConflictSessions = (person, target, allTargets) => {
    const conflicts = [];
    (allTargets || []).forEach((other) => {
      if (!other || other.id === target.id || !other.publishedSchedule || !Array.isArray(other.publishedSchedule.sessions)) return;
      const ids = Array.isArray(other.publishedSchedule.participantIds) ? other.publishedSchedule.participantIds.map(String) : [];
      if (!ids.includes(String(person.id))) return;
      other.publishedSchedule.sessions.forEach((session) => {
        const startMin = scheduleTimeMinutes(session.start); const endMin = scheduleTimeMinutes(session.end);
        if (startMin >= 0 && endMin > startMin) conflicts.push({ ...session, startMin, endMin });
      });
    });
    return conflicts;
  };
  const scheduleStudentCanAttend = (person, session, target, allTargets) => {
    const ranges = person && person.availability && Array.isArray(person.availability[session.day]) ? person.availability[session.day] : [];
    const available = ranges.some((range) => scheduleTimeMinutes(range.start) <= session.startMin && scheduleTimeMinutes(range.end) >= session.endMin);
    if (!available) return false;
    return !scheduleConflictSessions(person, target, allTargets).some((conflict) => scheduleOverlaps(session, { ...conflict, day: conflict.day }));
  };
  const scheduleEvaluate = (target, people, sessions, allTargets) => {
    const matrix = (people || []).map((person) => sessions.map((session) => scheduleStudentCanAttend(person, session, target, allTargets)));
    const perSessionCounts = sessions.map((_, index) => matrix.filter((row) => row[index]).length);
    const allStudents = (people || []).filter((_, index) => matrix[index] && matrix[index].every(Boolean));
    const partialStudents = (people || []).filter((_, index) => matrix[index] && matrix[index].some(Boolean) && !matrix[index].every(Boolean));
    const unavailableStudents = (people || []).filter((_, index) => matrix[index] && !matrix[index].some(Boolean));
    return { sessions, matrix, perSessionCounts, allStudents, partialStudents, unavailableStudents, allCount: allStudents.length, partialCount: partialStudents.length, unavailableCount: unavailableStudents.length, totalAttendance: perSessionCounts.reduce((sum, count) => sum + count, 0) };
  };
  const scheduleCandidates = (availability, duration, displayStart, displayEnd) => {
    const result = []; const seen = new Set(); const length = Number(duration);
    if (!Number.isFinite(length) || length <= 0 || length > 24 * 60) return result;
    const visibleFrom = scheduleTimeMinutes(displayStart || '08:00'); const visibleTo = scheduleTimeMinutes(displayEnd || '22:00');
    Store.weekdays().forEach((day) => {
      const ranges = availability && Array.isArray(availability[day.key]) ? availability[day.key] : [];
      ranges.forEach((range) => {
        const from = Math.max(scheduleTimeMinutes(range.start), visibleFrom); const to = Math.min(scheduleTimeMinutes(range.end), visibleTo);
        if (from < 0 || to <= from) return;
        const first = Math.ceil(from / 15) * 15;
        for (let start = first; start + length <= to; start += 15) {
          const candidate = { day: day.key, start: scheduleClock(start), end: scheduleClock(start + length), startMin: start, endMin: start + length, duration: length };
          const key = `${candidate.day}:${candidate.start}:${candidate.end}`;
          if (!seen.has(key)) { seen.add(key); result.push(candidate); }
        }
      });
    });
    return result;
  };
  const scheduleSuggestions = (target, people, plan, allTargets) => {
    const sessions = Math.max(1, Math.min(7, Math.trunc(Number(plan.sessions) || 0)));
    const durations = Array.from({ length: sessions }, (_, index) => Number(plan.durations[index]));
    if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0 || duration > 24 * 60)) return { rows: [], capped: false, reason: 'Enter a valid duration in minutes for every session.' };
    const displayFrom = scheduleTimeMinutes(plan.displayStart || '08:00'); const displayTo = scheduleTimeMinutes(plan.displayEnd || '22:00');
    if (displayFrom < 0 || displayTo <= displayFrom) return { rows: [], capped: false, reason: 'The timetable end time must be after the start time.' };
    if (plan.endDate && plan.startDate && plan.endDate < plan.startDate) return { rows: [], capped: false, reason: 'The end date cannot be before the start date.' };
    const candidateLists = durations.map((duration) => scheduleCandidates(target.availability || {}, duration, plan.displayStart, plan.displayEnd));
    if (candidateLists.some((list) => !list.length)) return { rows: [], capped: false, reason: 'There is no complete session inside the selected course windows for one of these durations.' };
    // Search every practical combination, but protect the browser from an
    // accidental seven-session x many-hours explosion. The best options are
    // still ranked and the UI reports when this safety cap was reached.
    const MAX_COMBINATIONS = 50000; let capped = false; const combinations = []; const keys = new Set();
    const walk = (index, picked) => {
      if (combinations.length >= MAX_COMBINATIONS) { capped = true; return; }
      if (index === candidateLists.length) {
        const ordered = picked.slice().sort((a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin || a.endMin - b.endMin);
        const key = ordered.map((session) => `${session.day}:${session.start}:${session.end}`).join('|');
        if (!keys.has(key)) { keys.add(key); combinations.push(picked.slice()); }
        return;
      }
      candidateLists[index].forEach((candidate) => {
        if (capped || picked.some((session) => scheduleOverlaps(candidate, session))) return;
        walk(index + 1, picked.concat(candidate));
      });
    };
    walk(0, []);
    const rows = combinations.map((combo) => scheduleEvaluate(target, people, combo, allTargets));
    rows.sort((a, b) => b.allCount - a.allCount || b.totalAttendance - a.totalAttendance || b.partialCount - a.partialCount || a.sessions.map((x) => `${x.day}${x.start}`).join('').localeCompare(b.sessions.map((x) => `${x.day}${x.start}`).join('')));
    return { rows, capped, reason: '' };
  };

  function tabScheduling(el) {
    let failed = false;
    const states = new Map();
    const safeKey = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
    const participantsFor = (target) => {
      if (target.kind === 'course') {
        return schedulePeopleHaveAvailability(Store.joinRequests().filter((request) => request.availability).map((request, index) => ({ id: `join:${request.cloudId || request.id || index}`, name: request.name, level: request.level, availability: request.availability, source: 'join' })));
      }
      const level = target.level || '';
      return schedulePeopleHaveAvailability(Store.nextCourseRequests().filter((request) => request.availability && ((request.courseAdId && request.courseAdId === target.id) || (!request.courseAdId && request.courseLevel === level))).map((request) => ({ id: request.studentId, name: request.studentName, level: request.courseLevel, availability: request.availability, source: 'next-course' })));
    };
    const targets = () => {
      const settings = Store.settings(); const course = settings.course || {};
      const list = [{ id: 'course', kind: 'course', title: course.title || 'Homepage course', level: course.level || 'Homepage course', availability: course.availability || {}, schedulePlan: course.schedulePlan || {}, publishedSchedule: course.publishedSchedule || {} }];
      Store.nextCourseAdsList().forEach((ad, index) => list.push({ id: ad.id || 'ad_' + index, kind: 'ad', sourceGroupId: ad.sourceGroupId, title: ad.title || `Next-course advertisement ${index + 1}`, level: ad.level || 'Next course', availability: ad.availability || {}, schedulePlan: ad.schedulePlan || {}, publishedSchedule: ad.publishedSchedule || {} }));
      return list.map((target) => ({ ...target, participants: participantsFor(target) }));
    };
    const saveTarget = (target, patch) => {
      const settings = Store.settings();
      if (target.id === 'course') { Store.updateSettings({ course: { ...(settings.course || {}), ...patch } }); return true; }
      const ads = Store.nextCourseAdsList(); const found = ads.find((ad, index) => (ad.id || 'ad_' + index) === target.id);
      if (!found) return false;
      if (String(found.id || '').startsWith('legacy_') && found.sourceGroupId) {
        const nextCourses = { ...(settings.nextCourses || {}) }; nextCourses[found.sourceGroupId] = { ...(nextCourses[found.sourceGroupId] || {}), ...patch }; Store.updateSettings({ nextCourses });
      } else Store.saveNextCourseAds(ads.map((ad, index) => (ad.id || 'ad_' + index) === target.id ? { ...ad, ...patch } : ad));
      return true;
    };
    const durationFields = (sessions, values) => Array.from({ length: sessions }, (_, index) => `<label class="field schedule-duration-field"><span>Session ${index + 1} duration (minutes)</span><input class="input" type="number" min="1" max="1440" step="1" data-schedule-duration value="${U.esc(String(values[index] || 60))}"></label>`).join('');
    const readPlan = (section) => ({
      sessions: Math.max(1, Math.min(7, Math.trunc(Number(U.$('[data-schedule-sessions]', section).value) || 1))),
      durations: U.$$('[data-schedule-duration]', section).map((input) => Number(input.value)),
      displayStart: U.$('[data-schedule-display-start]', section).value || '08:00',
      displayEnd: U.$('[data-schedule-display-end]', section).value || '22:00',
      startDate: U.$('[data-schedule-start]', section).value || null,
      endDate: U.$('[data-schedule-end]', section).value || null,
    });
    const sessionText = (session) => `${U.esc(scheduleDayLabel(session.day))} ${U.esc(session.start)}–${U.esc(session.end)}`;
    const namesHTML = (people) => people.length ? people.map((person) => `<span class="schedule-person-chip">${U.esc(person.name || 'Student')}</span>`).join('') : '<span class="muted tiny">None</span>';
    const reportHTML = (result) => `<div class="schedule-session-counts">${result.perSessionCounts.map((count, index) => `<span>Session ${index + 1}: <b>${count}</b> available</span>`).join('')}</div><div class="schedule-report-grid"><div><b>${result.allCount}</b><span>available for every session</span></div><div><b>${result.partialCount}</b><span>available for only some</span></div><div><b>${result.unavailableCount}</b><span>not available</span></div></div><div class="schedule-report-lists"><details><summary>Students available for every session (${result.allCount})</summary><div class="schedule-person-list">${namesHTML(result.allStudents)}</div></details><details><summary>Students available for only some sessions (${result.partialCount})</summary><div class="schedule-person-list">${namesHTML(result.partialStudents)}</div></details><details><summary>Students not available (${result.unavailableCount})</summary><div class="schedule-person-list">${namesHTML(result.unavailableStudents)}</div></details></div>`;
    const suggestionHTML = (state, target, participants, result) => {
      if (!participants.length) return '<div class="schedule-empty"><b>No submitted availability yet.</b><span>Students must select their weekly ranges before suggestions can be calculated.</span></div>';
      if (!result.rows.length) return `<div class="schedule-empty"><b>No valid combination found.</b><span>${U.esc(result.reason || 'Select teaching windows and valid session durations first.')}</span></div>`;
      const shown = result.rows.slice(0, state.shown || 3);
      return `<div class="schedule-results-head"><div><b>${result.rows.length.toLocaleString()} possible combination${result.rows.length === 1 ? '' : 's'}</b><span>sorted by students available for every session</span></div>${result.capped ? '<span class="chip">Search capped safely at 50,000 combinations</span>' : ''}</div>${shown.map((option, index) => `<article class="schedule-suggestion ${index === 0 ? 'is-best' : ''}"><div class="schedule-suggestion-head"><div><span class="section-kicker">${index === 0 ? 'BEST MATCH' : 'OPTION ' + (index + 1)}</span><h4>${option.allCount} student${option.allCount === 1 ? '' : 's'} available for every session</h4></div><button class="btn btn-primary btn-sm" type="button" data-schedule-use="${index}">${ic('edit')}Use & edit</button></div><div class="schedule-session-list">${option.sessions.map((session, sessionIndex) => `<span><b>Session ${sessionIndex + 1}</b>${sessionText(session)} <em>${session.duration} min</em></span>`).join('')}</div>${reportHTML(option)}</article>`).join('')}${shown.length < result.rows.length ? `<button type="button" class="btn btn-ghost btn-sm schedule-load-more" data-schedule-more>Load more suggestions (${result.rows.length - shown.length} remaining)</button>` : ''}`;
    };
    const manualHTML = (manual) => `<div class="schedule-manual-editor"><div class="schedule-manual-head"><div><span class="section-kicker">MANUAL ADJUSTMENT</span><h4>Edit this suggestion before publishing</h4></div><span class="muted tiny">Starts must use 00, 15, 30, or 45 minutes.</span></div><div class="schedule-manual-rows">${manual.map((session, index) => `<div class="schedule-manual-row"><b>Session ${index + 1}</b><select class="select" data-manual-day>${Store.weekdays().map((day) => `<option value="${day.key}" ${day.key === session.day ? 'selected' : ''}>${U.esc(day.label)}</option>`).join('')}</select><input class="input" type="time" step="900" data-manual-start value="${U.esc(session.start)}"><input class="input" type="number" min="1" max="1440" step="1" data-manual-duration value="${U.esc(String(session.duration))}"><span class="schedule-manual-end" data-manual-end></span></div>`).join('')}</div><div data-manual-report></div><button type="button" class="btn btn-primary btn-sm" data-schedule-publish>${ic('calendar')}Publish this timetable</button></div>`;
    const render = () => {
      const list = targets();
      el.innerHTML = `<div class="admin-subpage-head"><span class="section-kicker"><i class="dot"></i>OPERATIONS</span><h2>${ic('calendar')}Advertisement Scheduling</h2><p>Each advertisement has its own Monday–Sunday timetable. Course windows, student availability, automatic suggestions and published sessions stay separate.</p></div><div class="schedule-ad-sections">${list.map((target, index) => { const plan = target.schedulePlan || {}; const sessions = Math.max(1, Math.min(7, Math.trunc(Number(plan.sessions) || 2))); const durations = Array.from({ length: sessions }, (_, i) => Number(plan.durations && plan.durations[i]) || 60); const displayStart = plan.displayStart || '08:00'; const displayEnd = plan.displayEnd || '22:00'; const published = target.publishedSchedule && Array.isArray(target.publishedSchedule.sessions) ? target.publishedSchedule : null; return `<details class="schedule-ad-section" data-schedule-ad="${U.esc(target.id)}" ${index === 0 ? 'open' : ''}><summary><span class="schedule-ad-summary-main"><span class="section-kicker">${target.kind === 'course' ? 'COURSE ADVERTISEMENT' : 'NEXT-COURSE ADVERTISEMENT'}</span><b>${U.esc(target.title)}</b><small>${U.esc(target.level)} · ${target.participants.length} student${target.participants.length === 1 ? '' : 's'} with submitted availability</small></span><span class="schedule-ad-summary-badges"><span class="chip">${published ? 'Published' : 'Not published'}</span><span class="chip">${target.participants.length} students</span></span></summary><div class="schedule-ad-body"><div class="schedule-published-summary">${published ? `<b>Published weekly timetable:</b> ${published.sessions.map((session) => `${U.esc(scheduleDayLabel(session.day))} ${U.esc(session.start)}–${U.esc(session.end)}`).join(' · ')}` : '<span>No final timetable published yet.</span>'}</div><div class="schedule-window-title"><div><span class="section-kicker">STEP 1 · COURSE WINDOWS & STUDENT HEATMAP</span><h3>Choose possible teaching hours</h3></div><span class="muted tiny">The green cells are the advertisement’s allowed windows. Numbers show students available at each block.</span></div>${window.ACPAvailability ? window.ACPAvailability.adminHTML('schedule-' + safeKey(target.id), target.availability || {}, { participants: target.participants, displayStart, displayEnd }) : ''}<div class="schedule-window-actions"><button type="button" class="btn btn-ghost btn-sm" data-schedule-save-windows>${ic('save')}Save course windows</button><span class="muted tiny">Click a cell to inspect the available student names. Students can still report availability outside these windows.</span></div><div class="schedule-planner"><div class="schedule-window-title"><div><span class="section-kicker">STEP 2 · AUTOMATIC PLANNER</span><h3>Generate course time suggestions</h3></div><span class="muted tiny">A student counts as available only when they can attend the complete session.</span></div><div class="schedule-controls"><label class="field"><span>Sessions per week</span><input class="input" type="number" min="1" max="7" step="1" data-schedule-sessions value="${sessions}"></label><div class="schedule-duration-list" data-schedule-durations>${durationFields(sessions, durations)}</div><label class="field"><span>Timetable starts at</span><input class="input" type="time" step="900" data-schedule-display-start value="${U.esc(displayStart)}"></label><label class="field"><span>Timetable ends at</span><input class="input" type="time" step="900" data-schedule-display-end value="${U.esc(displayEnd)}"></label><label class="field"><span>Start date (optional)</span><input class="input" type="date" data-schedule-start value="${U.esc(plan.startDate || '')}"></label><label class="field"><span>End date (optional)</span><input class="input" type="date" data-schedule-end value="${U.esc(plan.endDate || '')}"></label></div><div class="schedule-planner-actions"><button type="button" class="btn btn-primary btn-sm" data-schedule-generate>${ic('zap')}Generate suggestions</button><span class="muted tiny">Suggestions refresh automatically when the controls change.</span></div><div class="schedule-results" data-schedule-results><div class="schedule-empty"><b>Ready to calculate.</b><span>Set the sessions and durations, then the best timetable will appear here.</span></div></div><div data-schedule-manual></div></div></div></details>`; }).join('')}</div>`;
      list.forEach((target) => wireSection(target, list));
    };
    const wireSection = (target, allTargets) => {
      const section = U.$(`[data-schedule-ad="${target.id}"]`, el); if (!section) return;
      const state = states.get(target.id) || { shown: 3, result: null, manual: null, plan: null, availability: null }; states.set(target.id, state);
      const prefix = 'schedule-' + safeKey(target.id);
      if (window.ACPAvailability) window.ACPAvailability.wireAdmin(section, prefix);
      const picker = U.$(`[data-admin-availability="${prefix}"]`, section);
      const readAvailability = () => window.ACPAvailability ? window.ACPAvailability.readAdmin(section, prefix) : (target.availability || {});
      const durationWrap = U.$('[data-schedule-durations]', section);
      const sessionsInput = U.$('[data-schedule-sessions]', section);
      const syncDurations = () => { const n = Math.max(1, Math.min(7, Math.trunc(Number(sessionsInput.value) || 1))); const old = U.$$('[data-schedule-duration]', section).map((input) => input.value); durationWrap.innerHTML = durationFields(n, old); bindAuto(); };
      const plan = () => readPlan(section);
      const renderResults = () => {
        const results = U.$('[data-schedule-results]', section); if (!results || !state.result) return;
        results.innerHTML = suggestionHTML(state, target, target.participants, state.result);
        U.$$('[data-schedule-use]', results).forEach((button) => button.onclick = () => { const selected = state.result.rows[Number(button.dataset.scheduleUse)]; if (!selected) return; state.manual = selected.sessions.map((session) => ({ day: session.day, start: session.start, duration: session.duration })); const manual = U.$('[data-schedule-manual]', section); manual.innerHTML = manualHTML(state.manual); wireManual(); });
        const more = U.$('[data-schedule-more]', results); if (more) more.onclick = () => { state.shown = (state.shown || 3) + 3; renderResults(); };
      };
      const generate = () => {
        const currentPlan = plan(); const currentAvailability = readAvailability();
        const currentTarget = { ...target, availability: currentAvailability }; state.plan = currentPlan; state.availability = currentAvailability; state.manual = null;
        state.result = scheduleSuggestions(currentTarget, target.participants, currentPlan, allTargets.map((item) => item.id === target.id ? currentTarget : item)); state.shown = 3; renderResults();
      };
      let autoTimer = null;
      const generateSoon = () => { clearTimeout(autoTimer); autoTimer = setTimeout(generate, 220); };
      const manualSessions = () => U.$$('[data-manual-day]', section).map((dayInput, index) => { const row = dayInput.closest('.schedule-manual-row'); const start = U.$('[data-manual-start]', row).value; const duration = Number(U.$('[data-manual-duration]', row).value); const startMin = scheduleTimeMinutes(start); return { day: dayInput.value, start, duration, startMin, endMin: startMin + duration, end: startMin >= 0 && Number.isFinite(duration) ? scheduleClock(startMin + duration) : '' }; });
      const wireManual = () => {
        const update = () => {
          const sessions = manualSessions(); const report = U.$('[data-manual-report]', section); let error = '';
          if (sessions.some((session) => session.startMin < 0 || !Number.isFinite(session.duration) || session.duration <= 0)) error = 'Enter a valid start time and duration for every session.';
          else if (sessions.some((session) => session.startMin % 15 !== 0)) error = 'Session starts must use 00, 15, 30, or 45 minutes.';
          else if (sessions.some((session, index) => sessions.some((other, otherIndex) => index !== otherIndex && scheduleOverlaps(session, other)))) error = 'Sessions cannot overlap.';
          else if (sessions.some((session) => !scheduleFitsWindow(readAvailability(), session))) error = 'Every edited session must stay inside the advertisement’s course windows.';
          sessions.forEach((session, index) => { const row = U.$$('[data-manual-end]', section)[index]; if (row) row.textContent = session.end ? `→ ${session.end}` : ''; });
          if (report) report.innerHTML = error ? `<div class="schedule-validation-error">${ic('warn')}${U.esc(error)}</div>` : reportHTML(scheduleEvaluate({ ...target, availability: readAvailability() }, target.participants, sessions, allTargets));
          return { sessions, error };
        };
        U.$$('[data-manual-day], [data-manual-start], [data-manual-duration]', section).forEach((input) => { input.oninput = update; input.onchange = update; });
        const publish = U.$('[data-schedule-publish]', section); if (publish) publish.onclick = () => {
          const checked = update(); if (checked.error) return U.toast(checked.error, 'error');
          const currentPlan = state.plan || plan(); const av = readAvailability(); const result = scheduleEvaluate({ ...target, availability: av }, target.participants, checked.sessions, allTargets);
          saveTarget(target, { availability: av, schedulePlan: currentPlan, publishedSchedule: { sessions: checked.sessions.map((session) => ({ day: session.day, start: session.start, end: session.end, duration: session.duration })), startDate: currentPlan.startDate, endDate: currentPlan.endDate, participantIds: target.participants.map((person) => person.id), attendance: { allCount: result.allCount, partialCount: result.partialCount, unavailableCount: result.unavailableCount, totalAttendance: result.totalAttendance }, publishedAt: new Date().toISOString(), attendanceNote: `${result.allCount} students available for every session.` } });
          U.toast('Timetable published', 'success', 'calendar'); render();
        };
        update();
      };
      const bindAuto = () => {
        U.$$('[data-schedule-duration], [data-schedule-start], [data-schedule-end]', section).forEach((input) => { input.oninput = generateSoon; input.onchange = generate; });
      };
      if (sessionsInput) { sessionsInput.oninput = () => { syncDurations(); generateSoon(); }; sessionsInput.onchange = sessionsInput.oninput; }
      bindAuto();
      U.$$('[data-schedule-display-start], [data-schedule-display-end]', section).forEach((input) => { input.onchange = () => { const nextPlan = plan(); if (scheduleTimeMinutes(nextPlan.displayEnd) <= scheduleTimeMinutes(nextPlan.displayStart)) return U.toast('The timetable end time must be after the start time.', 'error'); saveTarget(target, { schedulePlan: nextPlan }); render(); }; });
      const generateButton = U.$('[data-schedule-generate]', section); if (generateButton) generateButton.onclick = generate;
      if (picker) picker.addEventListener('availabilitychange', generate);
      const saveWindows = U.$('[data-schedule-save-windows]', section); if (saveWindows) saveWindows.onclick = () => { const currentPlan = plan(); saveTarget(target, { availability: readAvailability(), schedulePlan: currentPlan }); U.toast('Course windows and planner settings saved', 'success', 'calendar'); render(); };
      if (target.publishedSchedule && Array.isArray(target.publishedSchedule.sessions) && target.publishedSchedule.sessions.length) {
        // Do not calculate automatically for a previously published timetable;
        // the coach can still regenerate it by changing a planner control.
      }
    };
    render();
    if (Store.cloudEnabled && Store.cloudEnabled() && Store.cloudStatus().authed) Promise.all([Store.fetchJoinRequests(), Store.fetchNextCourseRequests()]).then((results) => { failed = results.some((result) => !result.ok); render(); });
  }

  function tabSettings(el) {
    const S = Store.settings();
    const coach = S.coach || { name: '', title: '', bio: '', experience: '', photo: null, achievements: [] };
    let coachPhoto = U.safeImage(coach.photo) || null;
    const coachHas = (aid) => (coach.achievements || []).some((a) => a.achievementId === aid);
    const cSeries = {};
    Store.catalog().forEach((a) => { (cSeries[a.series] = cSeries[a.series] || []).push(a); });

    el.innerHTML = `
      <div class="settings-command-bar card">
        <div><b>${ic('settings')}Settings shortcuts</b><span class="muted tiny">Jump directly to the part you want to change.</span></div>
        <div class="settings-command-links">
          ${[['academy-settings','Academy & course'],['next-course-settings','Next courses'],['notification-settings','Email notifications'],['scoring-settings','Scoring'],['gamification-settings','Bonuses'],['levels-settings','Levels'],['topics-settings','Topics'],['security-settings','Security']].map(([id,label]) => `<button class="btn btn-ghost btn-sm" type="button" data-settings-jump="${id}">${label}</button>`).join('')}
        </div>
      </div>
      <div class="card" id="coach-settings">
        <div class="card-title">${ic('grad')}Coach Profile <span class="muted tiny" style="font-weight:400">(shown at the top of the home page)</span></div>
        <div class="photo-row" style="margin-top:16px">
          <div class="photo-preview" id="co-photo-prev">${coachPhoto ? `<img src="${coachPhoto}" style="width:100%;height:100%;object-fit:cover">` : `<span style="${U.avatarStyle(coach.name || 'Coach')};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${U.initials(coach.name || 'C')}</span>`}</div>
          <div>
            <input type="file" id="co-photo" accept="image/*" class="hidden">
            <button class="btn btn-ghost btn-sm" id="co-photo-btn">${ic('upload')}Upload photo</button>
            <button class="btn btn-ghost btn-sm ${coachPhoto ? '' : 'hidden'}" id="co-photo-rm" style="color:var(--red)">${ic('trash')}Remove</button>
            <div class="muted tiny" style="margin-top:6px">Your photo as the academy coach — resized locally to 256px.</div>
          </div>
        </div>
        <div style="height:16px"></div>
        <div class="field-row">
          <label class="field"><span>Coach name</span><input class="input" id="co-name" value="${U.esc(coach.name || '')}" placeholder="e.g. Coach Abdelmajid"></label>
          <label class="field"><span>Title / role</span><input class="input" id="co-title" value="${U.esc(coach.title || '')}" placeholder="e.g. Founder & Head Coach"></label>
        </div>
        <label class="field"><span>Short bio</span><textarea class="input" id="co-bio" rows="2" placeholder="A line or two about you…">${U.esc(coach.bio || '')}</textarea></label>
        <label class="field"><span>Experience</span><textarea class="input" id="co-experience" rows="3" maxlength="800" placeholder="Describe your coaching experience, focus and what students can expect…">${U.esc(coach.experience || '')}</textarea></label>
        <label class="field" style="margin-bottom:6px"><span>Coach achievements <span class="chip" id="co-ach-count" style="margin-left:6px">${(coach.achievements || []).length} selected</span></span></label>
        <p class="muted tiny" style="margin:0 0 8px">Pick from the same catalog as your students — these appear on the home page coach card and on the Achievements page.</p>
        <div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:12px;padding:10px">
        ${Object.keys(cSeries).sort().map((sn) => `
          <div class="muted tiny" style="text-transform:uppercase;letter-spacing:1px;margin:8px 0 6px">${U.esc(sn)}</div>
          <div class="check-grid">${cSeries[sn].map((a) => {
            const earned = (coach.achievements || []).find((x) => x.achievementId === a.id);
            return `
            <label class="check-row"><input type="checkbox" name="coach-ach" value="${a.id}" ${earned ? 'checked' : ''}>
            <span class="tier-${U.esc(a.tier)}"><span class="ach-icon">${ic(a.icon || 'medal')}</span></span>
            <span>${U.esc(a.name)}${earned && earned.date ? `<span class="muted tiny" style="display:block">${U.fmtDate(earned.date)}</span>` : ''}</span><span class="sr-type">${U.esc(a.tier)}</span></label>`;
          }).join('')}</div>`).join('') || '<p class="muted tiny">No achievements in catalog yet.</p>'}
        </div>
        <div style="height:14px"></div>
        <button class="btn btn-primary btn-sm" id="co-save">${ic('save')}Save Coach Profile</button>
      </div>

      <div class="card" id="academy-settings" style="margin-top:18px">
        <div class="card-title">${ic('grad')}Academy</div>
        <div class="field-row" style="margin-top:14px">
          <label class="field"><span>Academy name</span><input class="input" id="st-name" value="${U.esc(S.academyName)}"></label>
          <label class="field"><span>English tagline</span><input class="input" id="st-tag" value="${U.esc(S.tagline)}"></label>
        </div>
        <label class="field"><span>French tagline</span><input class="input" id="st-tag-fr" value="${U.esc(S.taglineFr || '')}" placeholder="Une phrase courte qui résume votre académie…"></label>
        <div class="field-row">
          <label class="field"><span>Next cohort dates (English)</span><input class="input" id="st-dates" value="${U.esc(S.cohortDates || '')}" placeholder="Next cohort: dates announced soon"></label>
          <label class="field"><span>Dates de la prochaine session (français)</span><input class="input" id="st-dates-fr" value="${U.esc(S.cohortDatesFr || '')}" placeholder="Prochaine session : dates bientôt annoncées"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Program duration (English)</span><input class="input" id="st-duration" value="${U.esc(S.programDuration || '')}" placeholder="16 hours total"></label>
          <label class="field"><span>Durée du programme (français)</span><input class="input" id="st-duration-fr" value="${U.esc(S.programDurationFr || '')}" placeholder="16 heures au total"></label>
        </div>
        <label class="field academy-description-field"><span>English academy description</span>
          <textarea class="input" id="st-desc" rows="5" maxlength="1600" placeholder="Explain who the academy is for, how training works and what students can achieve…">${U.esc(S.academyDescription || '')}</textarea>
        </label>
        <label class="field academy-description-field"><span>French academy description</span>
          <textarea class="input" id="st-desc-fr" rows="5" maxlength="1600" placeholder="Présentez l’académie, son public, sa méthode et les progrès possibles…">${U.esc(S.academyDescriptionFr || '')}</textarea>
        </label>
        <p class="muted tiny" style="margin:-4px 0 14px">These texts appear on the homepage and the About page. Visitors can switch between English and French using the language button.</p>
        <button class="btn btn-primary btn-sm" id="st-save">${ic('save')}Save Academy Info</button>
      </div>

      <div class="card course-admin-card" id="course-settings" style="margin-top:18px">
        <div class="card-title">${ic('target')}Homepage Course Advertisement</div>
        <p class="muted tiny" style="margin:6px 0 14px">Edit the small course advertisement shown on the homepage. Keep the copy short and clear.</p>
        <div class="field-row">
          <label class="field"><span>Course level</span><input class="input" id="course-level" value="${U.esc((S.course || {}).level || '')}" placeholder="LEVEL 1"></label>
          <label class="field"><span>Status</span><input class="input" id="course-status" value="${U.esc((S.course || {}).status || '')}" placeholder="COMING SOON"></label>
        </div>
        <label class="field"><span>Course title</span><input class="input" id="course-title" maxlength="140" value="${U.esc((S.course || {}).title || '')}" placeholder="16 hours to start coding with confidence."></label>
        <label class="field"><span>Course description</span><textarea class="input" id="course-description" rows="2" maxlength="260" placeholder="Learn C++, problem solving and upgrade your CV to another level.">${U.esc((S.course || {}).description || '')}</textarea></label>
        <div class="field-row">
          <label class="field"><span>Target age</span><input class="input" id="course-age" value="${U.esc((S.course || {}).age || '')}" placeholder="Ages 13–17"></label>
          <label class="field"><span>Date / period</span><input class="input" id="course-period" value="${U.esc((S.course || {}).period || '')}" placeholder="Late August"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Duration</span><input class="input" id="course-duration" value="${U.esc((S.course || {}).duration || '')}" placeholder="16 hours"></label>
          <label class="field"><span>Experience message</span><input class="input" id="course-experience" value="${U.esc((S.course || {}).experience || '')}" placeholder="No experience needed."></label>
        </div>
        <label class="field"><span>What students learn</span></label>
        <div class="field-row">
          ${(Array.isArray((S.course || {}).learn) ? (S.course || {}).learn : ['', '', '']).slice(0, 3).map((v, i) => `<label class="field"><span>Topic ${i + 1}</span><input class="input" id="course-learn-${i}" value="${U.esc(v || '')}" placeholder="${['C++', 'Problem solving', 'CV upgrade'][i]}"></label>`).join('')}
        </div>
        <div style="margin-top:12px">${window.ACPAvailability ? window.ACPAvailability.adminHTML('course', (S.course || {}).availability || {}, { displayStart: S.course && S.course.schedulePlan && S.course.schedulePlan.displayStart, displayEnd: S.course && S.course.schedulePlan && S.course.schedulePlan.displayEnd }) : ''}</div>
        <div class="course-location-admin">
          <div class="card-title">${ic('layers')}Course location</div>
          <div class="field-row" style="margin-top:10px">
            <label class="field"><span>Center name</span><input class="input" id="course-location-name" value="${U.esc((S.course || {}).locationName || '')}" placeholder="e.g. Abdelmajid CP Center"></label>
            <label class="field"><span>Address</span><input class="input" id="course-location-address" value="${U.esc((S.course || {}).locationAddress || '')}" placeholder="Address or neighborhood"></label>
          </div>
          <label class="field"><span>Location description</span><textarea class="input" id="course-location-description" rows="2" maxlength="300" placeholder="A short description of the center and how to find it.">${U.esc((S.course || {}).locationDescription || '')}</textarea></label>
          <label class="field"><span>Map link (optional)</span><input class="input" id="course-location-map" value="${U.esc((S.course || {}).locationMapUrl || '')}" placeholder="https://maps.google.com/..."></label>
        </div>
        <button class="btn btn-primary btn-sm" id="course-save">${ic('save')}Save Homepage Course</button>
      </div>

      <div class="card next-course-admin-card" id="next-course-settings" style="margin-top:18px">
        <div class="card-title">${ic('star')}Next-course advertisements for current students</div>
        <p class="muted tiny" style="margin:6px 0 14px">Each student sees the next course configured for their current group inside My Space.</p>
        ${Store.groups().map((g) => {
          const c = (S.nextCourses || {})[g.id] || {};
          const learn = Array.isArray(c.learn) ? c.learn : [];
          const visible = Array.isArray(c.visibleGroupIds) && c.visibleGroupIds.length ? c.visibleGroupIds : [g.id];
          return `<div class="next-course-admin-group">
            <div class="card-title"><span class="chip">${U.esc(g.name)}</span><label class="check-row" style="margin-left:auto;width:auto"><input type="checkbox" id="next-${g.id}-enabled" ${c.enabled !== false ? 'checked' : ''}> Show to students</label></div>
            <label class="field" style="margin-top:10px"><span>Visible for groups</span></label>
            <div class="check-grid next-visible-groups">${Store.groups().map((vg) => `<label class="check-row"><input type="checkbox" data-next-visible="${g.id}" value="${U.esc(vg.id)}" ${visible.includes(vg.id) ? 'checked' : ''}><span>${U.esc(vg.name)}</span></label>`).join('')}</div>
            <div style="margin-top:11px">${window.ACPAvailability.adminHTML('next-' + g.id, c.availability || {}, { displayStart: c.schedulePlan && c.schedulePlan.displayStart, displayEnd: c.schedulePlan && c.schedulePlan.displayEnd })}</div>
            <div class="field-row" style="margin-top:12px">
              <label class="field"><span>Level</span><input class="input" id="next-${g.id}-level" value="${U.esc(c.level || '')}" placeholder="LEVEL 2"></label>
              <label class="field"><span>Status</span><input class="input" id="next-${g.id}-status" value="${U.esc(c.status || '')}" placeholder="NEXT LEVEL"></label>
            </div>
            <label class="field"><span>Title</span><input class="input" id="next-${g.id}-title" value="${U.esc(c.title || '')}" placeholder="Go further with problem solving."></label>
            <label class="field"><span>Description</span><textarea class="input" id="next-${g.id}-description" rows="2" maxlength="260">${U.esc(c.description || '')}</textarea></label>
            <div class="field-row">
              <label class="field"><span>Age</span><input class="input" id="next-${g.id}-age" value="${U.esc(c.age || '')}"></label>
              <label class="field"><span>Period</span><input class="input" id="next-${g.id}-period" value="${U.esc(c.period || '')}"></label>
              <label class="field"><span>Duration</span><input class="input" id="next-${g.id}-duration" value="${U.esc(c.duration || '')}"></label>
            </div>
            <label class="field"><span>Experience message</span><input class="input" id="next-${g.id}-experience" value="${U.esc(c.experience || '')}"></label>
            <div class="field-row">
              ${[0, 1, 2].map((i) => `<label class="field"><span>Learn ${i + 1}</span><input class="input" id="next-${g.id}-learn-${i}" value="${U.esc(learn[i] || '')}" placeholder="Topic"></label>`).join('')}
            </div>
          </div>`;
        }).join('')}
        <button class="btn btn-primary btn-sm" id="next-courses-save">${ic('save')}Save Next Courses</button>
      </div>

      <div class="card notification-settings-card" id="notification-settings" style="margin-top:18px">
        <div class="card-title">${ic('mail')}Email Notifications</div>
        <p class="muted tiny" style="margin:6px 0 13px">Receive an email immediately when a public join request, next-course request, or Code Clinic case arrives. This setting is the recipient address; the email provider secret stays on Supabase.</p>
        <label class="field" style="max-width:440px"><span>Coach notification email</span><input class="input" id="notification-email" type="email" maxlength="160" value="${U.esc(S.notificationEmail || (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.coachEmail) || '')}" placeholder="coach@example.com"></label>
        <button class="btn btn-primary btn-sm" id="notification-save">${ic('save')}Save notification email</button>
        <p class="muted tiny" style="margin:10px 0 0">The email service sends only after the request reaches Supabase. Local/offline submissions cannot trigger an email.</p>
      </div>

      <div class="card" id="scoring-settings" style="margin-top:18px">
        <div class="card-title">${ic('zap')}Scoring Rules <span class="muted tiny" style="font-weight:400">(defaults for new problems)</span></div>
        <div class="field-row" style="margin-top:14px">
          <div>
            ${['easy', 'medium', 'hard'].map((d) => `<label class="field"><span>Score — ${d}</span><input class="input" type="number" min="0" id="sc-${d}" value="${S.difficultyScores[d]}"></label>`).join('')}
          </div>
          <div>
            ${['easy', 'medium', 'hard'].map((d) => `<label class="field"><span>Topic XP — ${d}</span><input class="input" type="number" min="0" id="xp-${d}" value="${S.difficultyXP[d]}"></label>`).join('')}
          </div>
        </div>
        <label class="field" style="margin-top:4px"><span>Contest points per rank (Top 5)</span></label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${S.contestPoints.map((p, i) => `<label class="field" style="margin:0;flex:1;min-width:90px"><span>#${i + 1}</span><input class="input" type="number" min="0" id="cp-${i}" value="${p}"></label>`).join('')}
          <label class="field" style="margin:0;flex:1;min-width:120px"><span>#6 and below</span><input class="input" type="number" min="0" id="cp-beyond" value="${S.contestPointsBeyond != null ? S.contestPointsBeyond : 20}"></label>
        </div>
        <div style="height:14px"></div>
        <button class="btn btn-primary btn-sm" id="sc-save">${ic('save')}Save Scoring</button>
        <p class="muted tiny" style="margin-top:10px">Changing contest points affects contests recorded <b>after</b> the change.</p>
      </div>

      <div class="card" id="gamification-settings" style="margin-top:18px">
        <div class="card-title">${ic('zap')}Gamification — Bonuses, Hints & Clinic</div>
        <p class="muted tiny" style="margin:6px 0 12px">Extra score for great habits (0 = disabled). Bonuses update every scoreboard automatically.</p>
        <div class="field-row">
          <label class="field" style="margin:0"><span>2-week streak + each next week</span><input class="input" type="number" min="0" id="bn-streak" value="${S.bonusWeeklyStreak || 0}"></label>
          <label class="field" style="margin:0"><span>2+ solves in one day</span><input class="input" type="number" min="0" id="bn-multiday" value="${S.bonusMultiDay || 0}"></label>
          <label class="field" style="margin:0"><span>Topic mastered</span><input class="input" type="number" min="0" id="bn-mastery" value="${S.bonusTopicMastery || 0}"></label>
        </div>
        <div class="field-row" style="margin-top:12px">
          <label class="field" style="margin:0"><span>Hint cost 1 / 2 / 3 (pts)</span>
            <div style="display:flex;gap:8px">
              <input class="input" type="number" min="0" id="hc-0" value="${(S.hintCuts || [10, 15, 20])[0]}" title="Hint 1">
              <input class="input" type="number" min="0" id="hc-1" value="${(S.hintCuts || [10, 15, 20])[1]}" title="Hint 2">
              <input class="input" type="number" min="0" id="hc-2" value="${(S.hintCuts || [10, 15, 20])[2]}" title="Hint 3">
            </div></label>
          <label class="field" style="margin:0;max-width:160px"><span>Minimum earnable score</span><input class="input" type="number" min="1" id="hc-floor" value="${S.hintFloor || 5}"></label>
          <label class="field" style="margin:0;max-width:190px"><span>Clinic cases per week</span><input class="input" type="number" min="0" id="cl-limit" value="${S.clinicWeeklyLimit != null ? S.clinicWeeklyLimit : 2}"></label>
        </div>
        <div style="height:12px"></div>
        <button class="btn btn-primary btn-sm" id="gm-save">${ic('save')}Save Gamification</button>
      </div>

      <div class="card" id="levels-settings" style="margin-top:18px">
        <div class="card-title">${ic('shield')}Level Requirements</div>
        <p class="muted tiny" style="margin:6px 0 12px">A student reaches a level when score AND mastered topics AND achievements meet the row. Keep rows ascending.</p>
        <div class="table-wrap"><table class="table level-edit-table" style="min-width:640px">
          <thead><tr><th>Level</th><th>Min score</th><th>Min topics</th><th>Min achievements</th><th>Color</th><th></th></tr></thead>
          <tbody id="lv-body">
            ${S.levels.map((l, i) => `<tr data-i="${i}">
              <td><input class="input" name="lv-name" value="${U.esc(l.name)}"></td>
              <td><input class="input" type="number" min="0" name="lv-score" value="${l.minScore}"></td>
              <td><input class="input" type="number" min="0" name="lv-topics" value="${l.minTopics}"></td>
              <td><input class="input" type="number" min="0" name="lv-ach" value="${l.minAchievements || 0}"></td>
              <td><input type="color" class="color-dot" name="lv-color" value="${l.color}" title="Level color"></td>
              <td><button class="icon-btn" data-lvdel="${i}" title="Remove" style="color:var(--red)" ${S.levels.length <= 1 ? 'disabled' : ''}>${ic('trash')}</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn btn-ghost btn-sm" id="lv-add">${ic('plus')}Add Level</button>
          <button class="btn btn-primary btn-sm" id="lv-save">${ic('save')}Save Levels</button>
        </div>
      </div>

      <div class="card" id="topics-settings" style="margin-top:18px">
        <div class="card-title">${ic('target')}Topic Mastery</div>
        <p class="muted tiny" style="margin:6px 0 12px">XP needed to master a topic (Easy +${S.difficultyXP.easy} · Medium +${S.difficultyXP.medium} · Hard +${S.difficultyXP.hard} per solve by default).</p>
        <div class="table-wrap"><table class="table" style="min-width:420px">
          <thead><tr><th>Topic</th><th>Mastery XP</th><th>Problems</th><th></th></tr></thead>
          <tbody id="tp-body">
            ${S.topics.map((t) => `<tr data-name="${U.esc(t.name)}">
              <td><input class="input" name="tp-name" value="${U.esc(t.name)}"></td>
              <td style="max-width:110px"><input class="input" type="number" min="1" name="tp-xp" value="${t.masteryXP}"></td>
              <td class="num">${Store.problems().filter((p) => p.topic === t.name).length}</td>
              <td><button class="icon-btn" data-tpdel="${U.esc(t.name)}" title="Delete" style="color:var(--red)">${ic('trash')}</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:flex-end">
          <label class="field" style="margin:0;flex:2;min-width:180px"><span>New topic</span><input class="input" id="tp-new-name" placeholder="e.g. Flow Networks"></label>
          <label class="field" style="margin:0;width:120px"><span>XP</span><input class="input" type="number" min="1" id="tp-new-xp" value="20"></label>
          <button class="btn btn-ghost btn-sm" id="tp-add">${ic('plus')}Add Topic</button>
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" id="tp-save">${ic('save')}Save Topics</button>
        </div>
      </div>

      <div class="card" id="security-settings" style="margin-top:18px">
        <div class="card-title">${ic('key')}Change Admin Password</div>
        <p class="muted tiny" style="margin:4px 0 0">This one password protects BOTH the offline panel and the online cloud — changing it updates both at once. Use <b>8+ characters</b>, letters + numbers, and nothing anyone could guess (never reuse it anywhere else).</p>
        <div class="field-row" style="margin-top:14px">
          <label class="field"><span>Current password</span><input class="input" type="password" id="pw-old" autocomplete="current-password"></label>
          <label class="field"><span>New password (min 8 chars)</span><input class="input" type="password" id="pw-new" autocomplete="new-password"></label>
        </div>
        <label class="field" style="max-width:300px"><span>Confirm new password</span><input class="input" type="password" id="pw-new2" autocomplete="new-password"></label>
        <button class="btn btn-primary btn-sm" id="pw-save">${ic('lock')}Change Password</button>
      </div>`;

    // coach profile
    U.$('#co-photo-btn', el).onclick = () => U.$('#co-photo', el).click();
    U.$('#co-photo', el).addEventListener('change', async (ev) => {
      try {
        coachPhoto = await U.fileToAvatar(ev.target.files[0]);
        U.$('#co-photo-prev', el).innerHTML = `<img src="${coachPhoto}" style="width:100%;height:100%;object-fit:cover">`;
        U.$('#co-photo-rm', el).classList.remove('hidden');
        U.toast('Photo ready', 'success');
      } catch (e) { U.toast(e.message, 'error'); }
    });
    U.$('#co-photo-rm', el).onclick = () => {
      coachPhoto = null;
      U.$('#co-photo-prev', el).innerHTML = `<span style="${U.avatarStyle(U.$('#co-name', el).value || 'Coach')};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${U.initials(U.$('#co-name', el).value || 'C')}</span>`;
      U.$('#co-photo-rm', el).classList.add('hidden');
    };
    // live "selected" counter on the achievement picker (same pattern as students)
    U.$$('input[name="coach-ach"]', el).forEach((cb) => cb.addEventListener('change', () => {
      const n = U.$$('input[name="coach-ach"]', el).filter((x) => x.checked).length;
      const c = U.$('#co-ach-count', el);
      if (c) c.textContent = n + ' selected';
    }));
    U.$('#co-save', el).onclick = () => {
      const name = U.$('#co-name', el).value.trim();
      if (!name) return U.toast('Coach name is required', 'error');
      const prevDates = new Map((coach.achievements || []).map((a) => [a.achievementId, a.date]));
      const achievements = U.$$('input[name="coach-ach"]', el)
        .filter((cb) => cb.checked)
        .map((cb) => ({ achievementId: cb.value, date: prevDates.get(cb.value) || U.today() }));
      Store.updateCoach({ name, title: U.$('#co-title', el).value, bio: U.$('#co-bio', el).value, experience: U.$('#co-experience', el).value, photo: coachPhoto, achievements });
      U.toast('Coach profile saved — visible on the home page', 'success');
      rerender('settings');
    };

    // academy info
    U.$('#st-save', el).onclick = () => {
      Store.updateSettings({
        academyName: U.$('#st-name', el).value.trim() || 'Abdelmajid CP',
        tagline: U.$('#st-tag', el).value.trim(),
        taglineFr: U.$('#st-tag-fr', el).value.trim(),
        cohortDates: U.$('#st-dates', el).value.trim(),
        cohortDatesFr: U.$('#st-dates-fr', el).value.trim(),
        programDuration: U.$('#st-duration', el).value.trim(),
        programDurationFr: U.$('#st-duration-fr', el).value.trim(),
        academyDescription: U.$('#st-desc', el).value.trim(),
        academyDescriptionFr: U.$('#st-desc-fr', el).value.trim(),
      });
      U.toast('Academy info saved — English and French copy are live', 'success');
    };

    Store.groups().forEach((g) => window.ACPAvailability && window.ACPAvailability.wireAdmin(el, 'next-' + g.id));
    if (window.ACPAvailability) window.ACPAvailability.wireAdmin(el, 'course');
    U.$('#course-save').onclick = () => {
      const current = Store.settings().course || {};
      Store.updateSettings({ course: {
        ...current,
        level: U.$('#course-level', el).value.trim(), status: U.$('#course-status', el).value.trim(),
        title: U.$('#course-title', el).value.trim(), description: U.$('#course-description', el).value.trim(),
        age: U.$('#course-age', el).value.trim(), period: U.$('#course-period', el).value.trim(),
        duration: U.$('#course-duration', el).value.trim(), experience: U.$('#course-experience', el).value.trim(),
        learn: [0, 1, 2].map((i) => U.$('#course-learn-' + i, el).value.trim()).filter(Boolean),
        availability: window.ACPAvailability ? window.ACPAvailability.readAdmin(el, 'course') : {},
        locationName: U.$('#course-location-name', el).value.trim(), locationAddress: U.$('#course-location-address', el).value.trim(), locationDescription: U.$('#course-location-description', el).value.trim(), locationMapUrl: U.$('#course-location-map', el).value.trim(),
      } });
      U.toast('Homepage course advertisement saved', 'success');
      rerender('settings');
    };

    U.$('#next-courses-save').onclick = () => {
      const nextCourses = { ...(Store.settings().nextCourses || {}) };
      Store.groups().forEach((g) => {
        const old = nextCourses[g.id] || {};
        nextCourses[g.id] = {
          ...old,
          enabled: U.$('#next-' + g.id + '-enabled', el).checked,
          level: U.$('#next-' + g.id + '-level', el).value.trim(), status: U.$('#next-' + g.id + '-status', el).value.trim(),
          title: U.$('#next-' + g.id + '-title', el).value.trim(), description: U.$('#next-' + g.id + '-description', el).value.trim(),
          age: U.$('#next-' + g.id + '-age', el).value.trim(), period: U.$('#next-' + g.id + '-period', el).value.trim(), duration: U.$('#next-' + g.id + '-duration', el).value.trim(), experience: U.$('#next-' + g.id + '-experience', el).value.trim(),
          learn: [0, 1, 2].map((i) => U.$('#next-' + g.id + '-learn-' + i, el).value.trim()).filter(Boolean),
          visibleGroupIds: U.$$('[data-next-visible="' + g.id + '"]', el).filter((x) => x.checked).map((x) => x.value),
          availability: window.ACPAvailability ? window.ACPAvailability.readAdmin(el, 'next-' + g.id) : {}, 
        };
      });
      Store.updateSettings({ nextCourses });
      U.toast('Next-course advertisements saved', 'success');
      rerender('settings');
    };

    const notificationSave = U.$('#notification-save', el);
    if (notificationSave) notificationSave.onclick = () => {
      const email = U.$('#notification-email', el).value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) return U.toast('Enter a valid coach notification email', 'error');
      Store.updateSettings({ notificationEmail: email });
      U.toast('Notification email saved', 'success', 'mail');
    };

    // scoring
    U.$('#sc-save', el).onclick = () => {
      Store.updateSettings({
        difficultyScores: { easy: +U.$('#sc-easy', el).value || 0, medium: +U.$('#sc-medium', el).value || 0, hard: +U.$('#sc-hard', el).value || 0 },
        difficultyXP: { easy: +U.$('#xp-easy', el).value || 0, medium: +U.$('#xp-medium', el).value || 0, hard: +U.$('#xp-hard', el).value || 0 },
        contestPoints: [0, 1, 2, 3, 4].map((i) => +U.$('#cp-' + i, el).value || 0),
        contestPointsBeyond: +U.$('#cp-beyond', el).value || 0,
      });
      U.toast('Scoring rules saved', 'success');
    };
    const gmBtn = U.$('#gm-save', el);
    if (gmBtn) gmBtn.onclick = () => {
      Store.updateSettings({
        bonusWeeklyStreak: Math.max(0, +U.$('#bn-streak', el).value || 0),
        bonusMultiDay: Math.max(0, +U.$('#bn-multiday', el).value || 0),
        bonusTopicMastery: Math.max(0, +U.$('#bn-mastery', el).value || 0),
        hintCuts: [0, 1, 2].map((i) => Math.max(0, +U.$('#hc-' + i, el).value || 0)),
        hintFloor: Math.max(1, +U.$('#hc-floor', el).value || 5),
        clinicWeeklyLimit: Math.max(0, +U.$('#cl-limit', el).value || 0),
      });
      U.toast('Gamification saved — scores update live ⚡', 'success');
    };
    // levels
    U.$('#lv-add', el).onclick = () => {
      const tb = U.$('#lv-body', el);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input class="input" name="lv-name" value="New Level"></td>
        <td><input class="input" type="number" min="0" name="lv-score" value="0"></td>
        <td><input class="input" type="number" min="0" name="lv-topics" value="0"></td>
        <td><input class="input" type="number" min="0" name="lv-ach" value="0"></td>
        <td><input type="color" class="color-dot" name="lv-color" value="#38bdf8"></td>
        <td><button class="icon-btn" data-lvdel style="color:var(--red)">${ic('trash')}</button></td>`;
      tb.appendChild(tr);
    };
    U.$('#lv-body', el).addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-lvdel]');
      if (b && !b.disabled) b.closest('tr').remove();
    });
    U.$('#lv-save', el).onclick = () => {
      const rows = U.$$('tr', U.$('#lv-body', el));
      const levels = rows.map((tr) => ({
        name: U.$('[name="lv-name"]', tr).value.trim() || 'Level',
        minScore: +U.$('[name="lv-score"]', tr).value || 0,
        minTopics: +U.$('[name="lv-topics"]', tr).value || 0,
        minAchievements: +U.$('[name="lv-ach"]', tr).value || 0,
        color: U.$('[name="lv-color"]', tr).value,
      }));
      if (!levels.length) return U.toast('You need at least one level', 'error');
      Store.updateSettings({ levels });
      U.toast('Level requirements saved — levels recomputed', 'success');
    };
    // topics
    U.$('#tp-add', el).onclick = () => {
      const name = U.$('#tp-new-name', el).value.trim();
      const xp = U.$('#tp-new-xp', el).value;
      const r = Store.addTopic(name, xp);
      U.toast(r.ok ? `Topic “${name}” added` : r.error, r.ok ? 'success' : 'error');
      if (r.ok) rerender('settings');
    };
    U.$('#tp-body', el).addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tpdel]');
      if (!b) return;
      const r = Store.deleteTopic(b.dataset.tpdel);
      U.toast(r.ok ? 'Topic deleted' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) rerender('settings');
    });
    U.$('#tp-save', el).onclick = () => {
      const rows = U.$$('tr', U.$('#tp-body', el));
      let err = null;
      const saved = [];
      rows.forEach((tr) => {
        const oldName = tr.dataset.name;
        const newName = U.$('[name="tp-name"]', tr).value.trim();
        const xp = U.$('[name="tp-xp"]', tr).value;
        if (oldName === newName && String(Store.topics().find((t) => t.name === oldName).masteryXP) === String(xp)) return;
        const r = Store.updateTopic(oldName, newName, xp);
        if (!r.ok) err = r.error; else saved.push(newName);
      });
      U.toast(err || 'Topics saved', err ? 'error' : 'success');
      if (!err && saved.length) rerender('settings');
    };
    // password (async — PBKDF2 hashing + optional cloud sync)
    U.$('#pw-save', el).onclick = async () => {
      const oldPw = U.$('#pw-old', el).value, nw = U.$('#pw-new', el).value, nw2 = U.$('#pw-new2', el).value;
      if (nw !== nw2) return U.toast('New passwords do not match', 'error');
      const r = await Store.changePassword(oldPw, nw);
      U.toast(r.ok ? 'Password changed' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) {
        U.$('#pw-old', el).value = ''; U.$('#pw-new', el).value = ''; U.$('#pw-new2', el).value = '';
        injectPwWarning(el); // removes the alert if it was about the default password (re-render clears it)
        const warnNow = el.querySelector('.pw-warn'); if (warnNow) warnNow.remove();
        // keep the online coach login in sync (Supabase Auth)
        if (Store.cloudEnabled && Store.cloudEnabled() && Store.cloudStatus && Store.cloudStatus().authed) {
          Store.cloudUpdatePassword(nw).then((cr) => {
            if (!cr.skipped) U.toast(cr.ok ? 'Cloud login password updated too' : 'Cloud password update failed: ' + (cr.error || ''), cr.ok ? 'success' : 'error');
          });
        }
      }
    };
    U.$$('[data-settings-jump]', el).forEach((b) => b.onclick = () => { const target = U.$('#' + b.dataset.settingsJump, el); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const focus = sessionStorage.getItem('acp_settings_focus');
    if (focus) { sessionStorage.removeItem('acp_settings_focus'); setTimeout(() => { const target = U.$('#' + focus, el); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40); }
    injectPwWarning(el);
  }

  /* ================= NEXT COURSE REQUESTS ================= */
  function tabNextCourseRequests(el) {
    let fetched = false, fetchFailed = false;
    const render = () => {
      const rows = Store.nextCourseRequests();
      const availabilityText = (a) => Store.weekdays().map((d) => { const rs = (a && a[d.key]) || []; return rs.length ? `${d.label.slice(0, 3)} ${rs.map((x) => `${U.esc(x.start)}–${U.esc(x.end)}`).join(', ')}` : ''; }).filter(Boolean).join(' · ') || 'No availability submitted';
      el.innerHTML = `
        <div class="card next-course-requests-card">
          <div class="card-title">${ic('star')}Next Course Requests <span class="chip" style="margin-left:auto">${Store.newNextCourseCount()} new</span></div>
          <p class="muted tiny" style="margin:6px 0 14px">Current students who asked to continue to their next group level from My Space.</p>
          ${fetchFailed ? `<div class="vf-offline" style="margin:0 0 14px">${ic('warn')}<span>The cloud table is not ready yet. Run the SQL from <b>Show setup SQL</b> in this tab once.</span><button class="btn btn-ghost btn-sm" id="ncr-sql">Show setup SQL</button></div>` : ''}
          <div class="next-course-request-list">
            ${rows.length ? rows.map((r) => { const g = Store.group(r.groupId); return `<div class="next-course-request-row" data-ncr-id="${U.esc(r.cloudId || r.id || '')}">
              ${U.avatarHTML({ name: r.studentName }, 'avatar-44')}
              <div class="jr-main"><div class="jr-head"><b>${U.esc(r.studentName)}</b><span class="jr-status ${r.status === 'new' ? 'new' : 'read'}">${r.status === 'new' ? 'New' : 'Read'}</span>${g ? `<span class="chip">${U.esc(g.name)}</span>` : ''}<span class="muted tiny">${U.timeAgo(r.createdAt)}</span></div><div class="muted tiny">Interested in <b>${U.esc(r.courseLevel || 'next course')}</b></div><div class="ncr-availability">${availabilityText(r.availability)}</div></div>
              <div class="jr-actions"><button class="icon-btn ncr-toggle" title="Mark as read/new">${ic(r.status === 'new' ? 'check' : 'refresh')}</button><button class="icon-btn ncr-delete" title="Delete" style="color:var(--red)">${ic('trash')}</button></div>
            </div>`; }).join('') : '<p class="muted" style="padding:16px 4px">No next-course requests yet.</p>'}
          </div>
        </div>`;
      const sqlBtn = U.$('#ncr-sql', el);
      if (sqlBtn) sqlBtn.onclick = () => U.modal({ title: 'Next-course requests SQL', wide: true, body: `<pre class="sql-pre">${U.esc(Store.nextCourseSQL())}</pre>`, actions: [{ label: 'Close', cls: 'btn-ghost' }] });
      U.$$('.next-course-request-row', el).forEach((row) => {
        const id = row.dataset.ncrId;
        const item = rows.find((x) => String(x.cloudId || x.id || '') === id);
        if (!item) return;
        row.querySelector('.ncr-toggle').onclick = async () => { await Store.setNextCourseStatus(item, item.status === 'new' ? 'read' : 'new'); render(); };
        row.querySelector('.ncr-delete').onclick = async () => { if (await U.confirm('Delete this next-course request?', { title: 'Delete request', danger: true, okLabel: 'Delete' })) { await Store.deleteNextCourseRequest(item); render(); } };
      });
    };
    const start = async () => {
      render();
      if (fetched) return;
      fetched = true;
      if (Store.cloudEnabled && Store.cloudEnabled() && Store.cloudStatus().authed) { const r = await Store.fetchNextCourseRequests(); fetchFailed = !r.ok; render(); }
    };
    start();
  }

  /* ================= JOIN REQUESTS ================= */
  function tabRequests(el) {
    let fetched = false;
    const fetchFailed = { join: false, q: false };

    const itemHTML = (r, kind) => `
      <div class="jr-item" data-kind="${kind}" data-cid="${r.cloudId || ''}" data-lid="${r.id || ''}">
        ${U.avatarHTML({ name: r.name, photo: null }, 'avatar-44')}
        <div class="jr-main">
          <div class="jr-head">
            <b>${U.esc(r.name)}</b>
            <span class="jr-status ${r.status === 'new' ? 'new' : 'read'}">${r.status === 'new' ? 'New' : 'Read'}</span>
            ${r.age != null ? `<span class="chip">Age ${r.age}</span>` : ''}
            ${r.level ? `<span class="chip" title="Self-declared level">${U.esc(r.level)}</span>` : ''}
            <span class="muted tiny">${U.timeAgo(r.createdAt)}</span>
            ${!r.cloudId ? `<span class="chip" title="Saved in this browser only — not in the cloud">local</span>` : ''}
          </div>
          <a class="jr-mail" href="mailto:${U.esc(r.email)}">${U.esc(r.email)}</a>
          ${kind === 'q'
            ? `<div class="jr-desc"><span class="jr-q-mark">?</span>${U.esc(r.question)}</div>`
            : (r.description ? `<div class="jr-desc">${U.esc(r.description)}</div>` : '')}
        </div>
        <div class="jr-actions">
          <button class="icon-btn jr-toggle" title="${r.status === 'new' ? 'Mark as read' : 'Mark as new'}">${ic(r.status === 'new' ? 'check' : 'refresh')}</button>
          <button class="icon-btn jr-del" title="Delete" style="color:var(--red)">${ic('trash')}</button>
        </div>
      </div>`;

    const fetchState = () => {
      const cloud = Store.cloudEnabled && Store.cloudEnabled();
      const authed = cloud && Store.cloudStatus().authed;
      return { cloud, authed, showSetup: cloud && (!authed || fetchFailed.join || fetchFailed.q) };
    };
    const setupSQL = () => {
      const parts = [];
      if (fetchFailed.join || !(fetchFailed.join || fetchFailed.q)) parts.push(Store.joinSQL());
      if (fetchFailed.q || !(fetchFailed.join || fetchFailed.q)) parts.push(Store.questionsSQL());
      return parts.join('\n\n');
    };

    const renderList = () => {
      const apps = Store.joinRequests();
      const qs = Store.questions();
      const { cloud, authed, showSetup } = fetchState();
      const missing = fetchFailed.join && fetchFailed.q ? 'join_requests and questions tables' : (fetchFailed.q ? 'questions table' : 'join_requests table');
      const avRows = apps.filter((r) => r.availability && Object.values(r.availability).some((ranges) => Array.isArray(ranges) && ranges.length));
      const avCell = (r, key) => ((r.availability && r.availability[key]) || []).map((x) => `${U.esc(x.start)}–${U.esc(x.end)}`).join('<br>') || '<span class="muted">—</span>';
      el.innerHTML = `
      <div class="availability-board card">
        <div class="card-title">${ic('calendar')}Weekly availability <span class="chip" style="margin-left:auto">${avRows.length} students</span></div>
        <p class="muted tiny" style="margin:6px 0 12px">Free-time ranges from applications — weekly days only, not calendar dates.</p>
        ${avRows.length ? `<div class="table-wrap"><table class="table availability-table"><thead><tr><th>Student</th>${Store.weekdays().map((d) => `<th>${d.label.slice(0, 3)}</th>`).join('')}</tr></thead><tbody>${avRows.map((r) => `<tr><td><b>${U.esc(r.name)}</b></td>${Store.weekdays().map((d) => `<td>${avCell(r, d.key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted tiny">No availability has been submitted yet.</p>'}
      </div>
      <div class="requests-split">
      <div class="card">
        <div class="card-title">${ic('userPlus')}Join Requests <span class="chip" style="margin-left:auto">${Store.newJoinCount()} new</span>
          <button class="btn btn-ghost btn-sm" id="jr-refresh" style="margin-left:8px">${ic('refresh')}Refresh</button></div>
        <p class="muted tiny" style="margin:6px 0 14px">People who applied through the “Join the Academy” page.</p>
        ${showSetup ? `<div class="card" style="background:var(--bg-2);margin-bottom:14px;border-color:color-mix(in srgb,var(--gold) 40%,var(--border))">
            <b style="color:var(--gold)">${ic('warn')} Cloud inbox not active yet</b>
            <p class="muted tiny" style="margin:8px 0 10px">${authed ? `The ${missing} is missing (or has no policies).` : 'You are not signed into the cloud.'} Messages still reach <b>this browser</b>, but to receive them from any device, run this once in Supabase → SQL Editor:</p>
            <pre class="jr-sql">${U.esc(setupSQL())}</pre>
            <button class="btn btn-ghost btn-sm" id="jr-copy" style="margin-top:10px">${ic('save')}Copy SQL</button>
          </div>` : ''}
        <div id="jr-list">
          ${apps.length ? apps.map((r) => itemHTML(r, 'join')).join('') : '<p class="muted" style="padding:14px 4px">No join requests yet — share your Join page link and they will start coming in.</p>'}
        </div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('help')}Questions <span class="chip" style="margin-left:auto">${Store.newQuestionCount()} new</span></div>
        <p class="muted tiny" style="margin:6px 0 14px">Asked through the “Just have a question?” form on the Join page — these people are <b>not</b> applying to the academy.</p>
        <div id="q-list">
          ${qs.length ? qs.map((r) => itemHTML(r, 'q')).join('') : '<p class="muted" style="padding:14px 4px">No questions yet.</p>'}
        </div>
      </div>
      </div>`;

      U.$('#jr-refresh', el).onclick = () => { fetched = false; fetchFailed.join = false; fetchFailed.q = false; start(); };
      const cp = U.$('#jr-copy', el);
      if (cp) cp.onclick = () => {
        const w = navigator.clipboard && navigator.clipboard.writeText(setupSQL());
        (w || Promise.reject()).then(
          () => U.toast('SQL copied — paste it in the Supabase SQL Editor and press Run', 'success'),
          () => U.toast('Copy failed — select the text and copy manually', 'error'));
      };

      U.$$('.jr-item', el).forEach((row) => {
        const cid = row.dataset.cid || null, lid = row.dataset.lid || null;
        const isQ = row.dataset.kind === 'q';
        const list = isQ ? Store.questions() : Store.joinRequests();
        const item = list.find((x) => (cid && String(x.cloudId) === cid) || (lid && x.id === lid));
        if (!item) return;
        row.querySelector('.jr-toggle').onclick = async () => {
          await (isQ ? Store.setQuestionStatus : Store.setJoinStatus)(item, item.status === 'new' ? 'read' : 'new');
          renderList();
        };
        row.querySelector('.jr-del').onclick = async () => {
          const okDel = await U.confirm({
            title: isQ ? 'Delete question' : 'Delete join request',
            message: `Delete the ${isQ ? 'question' : 'application'} from <b>${U.esc(item.name)}</b> (${U.esc(item.email)})?`,
            danger: true, confirmLabel: 'Delete',
          });
          if (!okDel) return;
          await (isQ ? Store.deleteQuestion : Store.deleteJoinRequest)(item);
          U.toast(isQ ? 'Question deleted' : 'Join request deleted', 'success');
          renderList();
        };
      });
    };

    const start = async () => {
      renderList();
      if (fetched) return;
      fetched = true;
      if (Store.cloudEnabled && Store.cloudEnabled() && Store.cloudStatus().authed) {
        const [r1, r2] = await Promise.all([Store.fetchJoinRequests(), Store.fetchQuestions()]);
        fetchFailed.join = !r1.ok;
        fetchFailed.q = !r2.ok;
        if (fetchFailed.join || fetchFailed.q) U.toast('Could not load everything from the cloud — check the setup note in this tab', 'error');
        renderList();
      }
    };
    start();
  }

  /* ================= BACKUP & DATA ================= */
  function tabData(el) {
    const st = Store.academyStats();
    el.innerHTML = `
      <div class="card">
        <div class="card-title">${ic('database')}Backup &amp; Restore</div>
        <p class="muted tiny" style="margin:6px 0 16px">${Store.cloudEnabled && Store.cloudEnabled() ? `Data syncs to the academy cloud. Status: <span class="chip" style="margin-left:6px">${Store.cloudStatus().authed ? '☁ signed in — edits go live instantly' : '☁ read-only (sign in to publish changes)'}</span> <span class="chip" style="margin-left:6px">${Store.cloudStatus().hashInCloud ? '⚠ password hash still in cloud — sign in once to remove it' : '🛡 no secrets stored in the cloud'}</span>` : 'All academy data lives in this browser\'s Local Storage. Export regularly to keep it safe.'} <span class="chip" style="margin-left:6px">Build v1.7.1</span></p>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          <div class="card hoverable" style="flex:1;min-width:230px;background:var(--card-2)">
            <div class="st-ic">${ic('download')}</div>
            <h3 style="margin:10px 0 6px">Export Backup</h3>
            <p class="muted tiny" style="margin-bottom:14px">Download everything as a single JSON file (${(Store.storageSize() / 1024).toFixed(1)} KB).</p>
            <button class="btn btn-primary btn-sm btn-block" id="d-export">${ic('download')}Export JSON</button>
          </div>
          <div class="card hoverable" style="flex:1;min-width:230px;background:var(--card-2)">
            <div class="st-ic">${ic('upload')}</div>
            <h3 style="margin:10px 0 6px">Import Backup</h3>
            <p class="muted tiny" style="margin-bottom:14px">Restore from a previously exported JSON file. Current data is replaced.</p>
            <input type="file" id="d-import" accept="application/json,.json" class="hidden">
            <button class="btn btn-ghost btn-sm btn-block" id="d-import-btn">${ic('upload')}Choose JSON file…</button>
          </div>
        </div>
        <hr class="divider">
        <div class="muted tiny">Current: <b>${st.students}</b> students · <b>${st.solved}</b> solves · <b>${st.contests}</b> contests · <b>${st.catalogSize}</b> achievements</div>
      </div>

      <div class="card danger-zone" style="margin-top:18px">
        <div class="card-title" style="color:var(--red)">${ic('warn')}Danger Zone</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <button class="btn btn-ghost btn-sm" id="d-demo">${ic('refresh')}Restore Demo Data</button>
          <button class="btn btn-ghost btn-sm" id="d-erase" style="color:var(--orange);border-color:rgba(251,146,60,.4)">${ic('trash')}Erase Content (keep settings)</button>
          <button class="btn btn-danger btn-sm" id="d-factory">${ic('warn')}Factory Reset</button>
        </div>
        <p class="muted tiny" style="margin-top:12px">
          <b>Restore Demo</b> brings back the sample academy (password kept).<br>
          <b>Erase Content</b> deletes students, groups, problems and contest history but keeps your settings &amp; password.<br>
          <b>Factory Reset</b> wipes absolutely everything, including the password (back to <span class="kbd-pill">admin123</span>).
        </p>
      </div>`;

    U.$('#d-export', el).onclick = () => {
      U.download(`abdelmajid-cp-backup-${U.today()}.json`, Store.exportJSON());
      U.toast('Backup downloaded', 'success', 'download');
    };
    U.$('#d-import-btn', el).onclick = () => U.$('#d-import', el).click();
    U.$('#d-import', el).addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      let obj;
      try { obj = await U.readJSONFile(file); } catch (e) { return U.toast(e.message, 'error'); }
      const v = Store.validateBackup(obj);
      if (!v.ok) return U.toast(v.error, 'error');
      const d = v.data;
      const ok = await U.confirm({
        title: 'Import this backup?',
        message: `This will <b>replace all current data</b> with: <b>${d.students.length}</b> students, <b>${d.groups.length}</b> groups, <b>${d.problems.length}</b> problems, <b>${d.contests.length}</b> contests. Consider exporting your current data first.`,
        confirmLabel: 'Import & Replace',
      });
      if (!ok) return;
      const r = Store.importJSON(obj);
      U.toast(r.ok ? 'Backup imported successfully' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { App.updateAdminLink(); rerender('data'); }
    });
    U.$('#d-demo', el).onclick = async () => {
      const ok = await U.confirm({ title: 'Restore demo data?', message: 'All current content will be replaced by the sample academy. Your password and settings stay.', confirmLabel: 'Restore Demo' });
      if (ok) { Store.resetDemo(); U.toast('Demo data restored', 'success'); rerender('data'); }
    };
    U.$('#d-erase', el).onclick = async () => {
      const ok = await U.confirm({ title: 'Erase all content?', message: 'Students, groups, problems, contests and achievements will be deleted. Settings and password are kept. Export a backup first!', danger: true, confirmLabel: 'Erase Content' });
      if (ok) { Store.eraseContent(); U.toast('Content erased', 'success'); rerender('data'); }
    };
    U.$('#d-factory', el).onclick = async () => {
      const ok = await U.confirm({ title: 'Factory reset?', message: 'Everything — data, settings AND the admin password — will be wiped and replaced by fresh demo data. Password returns to <span class="kbd-pill">admin123</span>.', danger: true, confirmLabel: 'Factory Reset' });
      if (ok) { sessionStorage.removeItem(SS_KEY); Store.factoryReset(); U.toast('Factory reset complete', 'success'); location.hash = '#/'; }
    };
  }

  window.Admin = Admin;
})();
