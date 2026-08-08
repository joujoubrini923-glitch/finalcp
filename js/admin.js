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
    const form = U.$('#login-form', root);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = U.$('#login-pw', root).value;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      let ok = false;
      if (Store.cloudEnabled && Store.cloudEnabled()) {
        // real online sign-in (Supabase Auth); local password stays as an
        // offline fallback if the network is down
        const r = await Store.cloudSignIn(pw);
        ok = !!r.ok;
        if (!ok && Store.verifyPassword(pw)) ok = true;
      } else {
        ok = Store.verifyPassword(pw);
      }
      if (btn) btn.disabled = false;
      if (ok) {
        sessionStorage.setItem(SS_KEY, '1');
        U.toast('Welcome back, Coach!', 'success', 'unlock');
        App.updateAdminLink();
        Admin.render(root, 'overview');
      } else {
        const err = U.$('#login-err', root); err.style.display = 'block';
        const card = U.$('#login-card', root);
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      }
    });
    setTimeout(() => { const f = U.$('#login-pw', root); if (f) f.focus(); }, 60);
  }

  /* ================= SHELL ================= */
  const TABS = [
    ['overview', 'grid', 'Overview'],
    ['students', 'users', 'Students'],
    ['groups', 'layers', 'Groups'],
    ['problems', 'target', 'Problems'],
    ['solves', 'check', 'Record Solves'],
    ['contests', 'trophy', 'Contests'],
    ['achievements', 'medal', 'Achievements'],
    ['requests', 'userPlus', 'Join Requests'],
    ['settings', 'settings', 'Settings'],
    ['data', 'database', 'Backup & Data'],
  ];

  Admin.render = function (root, tab) {
    if (!Admin.isAuthed()) return loginView(root);
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
          <a class="as-link" href="javascript:void(0)" id="admin-logout" style="color:var(--red)">${ic('logout')}Logout</a>
        </aside>
        <section id="admin-content"></section>
      </div>
    </div>`;
    U.$('#admin-logout', root).onclick = Admin.logout;
    const content = U.$('#admin-content', root);
    ({
      overview: tabOverview, students: tabStudents, groups: tabGroups,
      problems: tabProblems, solves: tabSolves, contests: tabContests,
      achievements: tabAchievements, requests: tabRequests, settings: tabSettings, data: tabData,
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
          <button class="btn btn-ghost btn-sm" data-go="requests">${ic('userPlus')}Join Requests${Store.newJoinCount() ? ` <span class="chip" style="margin-left:2px;color:var(--gold)">${Store.newJoinCount()} new</span>` : ''}</button>
          <button class="btn btn-ghost btn-sm" data-go="data">${ic('download')}Export Backup</button>
        </div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('clock')}Recent Activity</div>
        <div style="margin-top:14px">${timeline(Store.activity(), 15)}</div>
      </div>`;
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-go]');
      if (b) {
        sessionStorage.setItem('acp_quick', b.dataset.act || '');
        location.hash = '#/admin/' + b.dataset.go;
      }
    });
  }

  function timeline(items, limit) {
    if (!items.length) return '<p class="muted">No activity yet.</p>';
    const map = { solve: ['check', 'var(--green)'], contest: ['trophy', 'var(--gold)'], achievement: ['medal', 'var(--accent-2)'], student: ['userPlus', 'var(--accent)'], group: ['layers', 'var(--accent)'], problem: ['target', 'var(--orange)'], request: ['userPlus', 'var(--accent-2)'], system: ['info', 'var(--dim)'] };
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
    let photoData = s ? s.photo : null;
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
            const adjust = {
              score: U.$('#f-adj-score', bd).value,
              easy: U.$('#f-adj-easy', bd).value,
              medium: U.$('#f-adj-medium', bd).value,
              hard: U.$('#f-adj-hard', bd).value,
            };
            let sid = s ? s.id : null;
            if (s) {
              Store.updateStudent(s.id, { name, joinDate, groupId, photo: photoData, adjust });
            } else {
              sid = Store.addStudent({ name, groupId, joinDate, photo: photoData, adjust }).id;
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
          <td><a class="link-accent" href="${U.esc(p.link)}" target="_blank" rel="noopener">${U.esc(p.name)} ${ic('external')}</a></td>
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
              groupIds: U.$$('input[name="grp"]', bd).filter((x) => x.checked).map((x) => x.value),
            };
            if (p) Store.updateProblem(p.id, data); else Store.addProblem(data);
            U.toast(p ? 'Problem updated' : 'Problem added', 'success');
            closeFn(); rerender('problems');
            return false;
          },
        },
      ],
      mount: (bd) => {
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
          <td>${U.esc(r.student.name)}</td>
          <td><a class="link-accent" href="${U.esc(r.problem.link)}" target="_blank" rel="noopener">${U.esc(r.problem.name)}</a></td>
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
  function tabSettings(el) {
    const S = Store.settings();
    const coach = S.coach || { name: '', title: '', bio: '', photo: null, achievements: [] };
    let coachPhoto = coach.photo || null;
    const coachHas = (aid) => (coach.achievements || []).some((a) => a.achievementId === aid);
    const cSeries = {};
    Store.catalog().forEach((a) => { (cSeries[a.series] = cSeries[a.series] || []).push(a); });

    el.innerHTML = `
      <div class="card">
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

      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('grad')}Academy</div>
        <div class="field-row" style="margin-top:14px">
          <label class="field"><span>Academy name</span><input class="input" id="st-name" value="${U.esc(S.academyName)}"></label>
          <label class="field"><span>Tagline</span><input class="input" id="st-tag" value="${U.esc(S.tagline)}"></label>
        </div>
        <button class="btn btn-primary btn-sm" id="st-save">${ic('save')}Save Academy Info</button>
      </div>

      <div class="card" style="margin-top:18px">
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

      <div class="card" style="margin-top:18px">
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

      <div class="card" style="margin-top:18px">
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

      <div class="card" style="margin-top:18px">
        <div class="card-title">${ic('key')}Change Admin Password</div>
        <div class="field-row" style="margin-top:14px">
          <label class="field"><span>Current password</span><input class="input" type="password" id="pw-old" autocomplete="current-password"></label>
          <label class="field"><span>New password (min 6 chars)</span><input class="input" type="password" id="pw-new" autocomplete="new-password"></label>
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
      Store.updateCoach({ name, title: U.$('#co-title', el).value, bio: U.$('#co-bio', el).value, photo: coachPhoto, achievements });
      U.toast('Coach profile saved — visible on the home page', 'success');
      rerender('settings');
    };

    // academy info
    U.$('#st-save', el).onclick = () => {
      Store.updateSettings({ academyName: U.$('#st-name', el).value.trim() || 'Abdelmajid CP', tagline: U.$('#st-tag', el).value });
      U.toast('Academy info saved', 'success');
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
    // levels
    U.$('#lv-add', el).onclick = () => {
      const tb = U.$('#lv-body', el);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input class="input" name="lv-name" value="New Level"></td>
        <td><input class="input" type="number" min="0" name="lv-score" value="0"></td>
        <td><input class="input" type="number" min="0" name="lv-topics" value="0"></td>
        <td><input class="input" type="number" min="0" name="lv-ach" value="0"></td>
        <td><input type="color" class="color-dot" name="lv-color" value="#38bdf8"></td>
        <td><button class="icon-btn" onclick="this.closest('tr').remove()" style="color:var(--red)">${ic('trash')}</button></td>`;
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
    // password
    U.$('#pw-save', el).onclick = () => {
      const oldPw = U.$('#pw-old', el).value, nw = U.$('#pw-new', el).value, nw2 = U.$('#pw-new2', el).value;
      if (nw !== nw2) return U.toast('New passwords do not match', 'error');
      const r = Store.changePassword(oldPw, nw);
      U.toast(r.ok ? 'Password changed' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) {
        U.$('#pw-old', el).value = ''; U.$('#pw-new', el).value = ''; U.$('#pw-new2', el).value = '';
        // keep the online coach login in sync (Supabase Auth)
        if (Store.cloudEnabled && Store.cloudEnabled() && Store.cloudStatus && Store.cloudStatus().authed) {
          Store.cloudUpdatePassword(nw).then((cr) => {
            if (!cr.skipped) U.toast(cr.ok ? 'Cloud login password updated too' : 'Cloud password update failed: ' + (cr.error || ''), cr.ok ? 'success' : 'error');
          });
        }
      }
    };
  }

  /* ================= JOIN REQUESTS ================= */
  function tabRequests(el) {
    let fetched = false;
    let fetchFailed = false;

    const itemHTML = (r) => `
      <div class="jr-item" data-cid="${r.cloudId || ''}" data-lid="${r.id || ''}">
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
          ${r.description ? `<div class="jr-desc">${U.esc(r.description)}</div>` : ''}
        </div>
        <div class="jr-actions">
          <button class="icon-btn jr-toggle" title="${r.status === 'new' ? 'Mark as read' : 'Mark as new'}">${ic(r.status === 'new' ? 'check' : 'refresh')}</button>
          <button class="icon-btn jr-del" title="Delete" style="color:var(--red)">${ic('trash')}</button>
        </div>
      </div>`;

    const renderList = () => {
      const items = Store.joinRequests();
      const cloud = Store.cloudEnabled && Store.cloudEnabled();
      const authed = cloud && Store.cloudStatus().authed;
      const showSetup = cloud && (!authed || fetchFailed);
      el.innerHTML = `
      <div class="card">
        <div class="card-title">${ic('userPlus')}Join Requests <span class="chip" style="margin-left:auto">${Store.newJoinCount()} new</span>
          <button class="btn btn-ghost btn-sm" id="jr-refresh" style="margin-left:8px">${ic('refresh')}Refresh</button></div>
        <p class="muted tiny" style="margin:6px 0 14px">People who applied through the “Join the Academy” form on the home page.</p>
        ${showSetup ? `<div class="card" style="background:var(--bg-2);margin-bottom:14px;border-color:color-mix(in srgb,var(--gold) 40%,var(--border))">
            <b style="color:var(--gold)">${ic('warn')} Cloud inbox not active yet</b>
            <p class="muted tiny" style="margin:8px 0 10px">${authed ? 'The join_requests table is missing (or has no policies).' : 'You are not signed into the cloud.'} Applications still reach <b>this browser</b>, but to receive them from any device, run this once in Supabase → SQL Editor:</p>
            <pre class="jr-sql">${U.esc(Store.joinSQL())}</pre>
            <button class="btn btn-ghost btn-sm" id="jr-copy" style="margin-top:10px">${ic('save')}Copy SQL</button>
          </div>` : ''}
        <div id="jr-list">
          ${items.length ? items.map(itemHTML).join('') : '<p class="muted" style="padding:14px 4px">No join requests yet — share your home page link and they will start coming in.</p>'}
        </div>
      </div>`;

      U.$('#jr-refresh', el).onclick = () => { fetched = false; fetchFailed = false; start(); };
      const cp = U.$('#jr-copy', el);
      if (cp) cp.onclick = () => {
        const w = navigator.clipboard && navigator.clipboard.writeText(Store.joinSQL());
        (w || Promise.reject()).then(
          () => U.toast('SQL copied — paste it in the Supabase SQL Editor and press Run', 'success'),
          () => U.toast('Copy failed — select the text and copy manually', 'error'));
      };

      U.$$('.jr-item', el).forEach((row) => {
        const cid = row.dataset.cid || null, lid = row.dataset.lid || null;
        const item = Store.joinRequests().find((x) => (cid && String(x.cloudId) === cid) || (lid && x.id === lid));
        if (!item) return;
        row.querySelector('.jr-toggle').onclick = async () => {
          await Store.setJoinStatus(item, item.status === 'new' ? 'read' : 'new');
          renderList();
        };
        row.querySelector('.jr-del').onclick = async () => {
          const okDel = await U.confirm({ title: 'Delete join request', message: `Delete the application from <b>${U.esc(item.name)}</b> (${U.esc(item.email)})?`, danger: true, confirmLabel: 'Delete' });
          if (!okDel) return;
          await Store.deleteJoinRequest(item);
          U.toast('Join request deleted', 'success');
          renderList();
        };
      });
    };

    const start = async () => {
      renderList();
      if (fetched) return;
      fetched = true;
      if (Store.cloudEnabled && Store.cloudEnabled() && Store.cloudStatus().authed) {
        const r = await Store.fetchJoinRequests();
        if (r.ok) { fetchFailed = false; } else {
          fetchFailed = true;
          U.toast('Could not load requests from the cloud — check the setup note in this tab', 'error');
        }
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
        <p class="muted tiny" style="margin:6px 0 16px">${Store.cloudEnabled && Store.cloudEnabled() ? `Data syncs to the academy cloud. Status: <span class="chip" style="margin-left:6px">${Store.cloudStatus().authed ? '☁ signed in — edits go live instantly' : '☁ read-only (sign in to publish changes)'}</span>` : 'All academy data lives in this browser\'s Local Storage. Export regularly to keep it safe.'} <span class="chip" style="margin-left:6px">Build v1.3</span></p>
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
