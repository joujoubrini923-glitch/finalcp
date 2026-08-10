/* ============================================================
   Abdelmajid CP — app.js : router, theme, search, fx, boot
   ============================================================ */
(function () {
  const App = {};
  window.App = App;
  const TITLES = {
    home: 'Home', students: 'Students', student: 'Student Profile', groups: 'Groups', group: 'Group',
    leaderboard: 'Leaderboard', problems: 'Problem Library', contests: 'Hall of Fame',
    analytics: 'Analytics', achievements: 'Achievements', join: 'Join the Academy', submit: 'Submit a Solve', admin: 'Admin Panel',
  };

  /* ---------------- theme ---------------- */
  const THEME_KEY = 'abdelmajidcp_theme';
  function applyTheme(t, save) {
    document.documentElement.setAttribute('data-theme', t);
    if (save) localStorage.setItem(THEME_KEY, t);
    const btn = U.$('#theme-toggle');
    if (btn) btn.innerHTML = ic(t === 'dark' ? 'sun' : 'moon');
    btn && (btn.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved || 'dark');
    U.$('#theme-toggle').onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark', true);
      route(); // re-render so charts pick up new colors
    };
  }

  /* ---------------- router ---------------- */
  function parseHash() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const m = h.match(/^\/admin(?:\/([\w-]+))?/);
    if (m) return { name: 'admin', param: m[1] || 'overview' };
    let mm;
    if (h === '/' || h === '') return { name: 'home' };
    if ((mm = h.match(/^\/students$/))) return { name: 'students' };
    if ((mm = h.match(/^\/student\/([\w-]+)$/))) return { name: 'student', param: mm[1] };
    if ((mm = h.match(/^\/groups$/))) return { name: 'groups' };
    if ((mm = h.match(/^\/group\/([\w-]+)$/))) return { name: 'group', param: mm[1] };
    if ((mm = h.match(/^\/leaderboard$/))) return { name: 'leaderboard' };
    if ((mm = h.match(/^\/problems$/))) return { name: 'problems' };
    if ((mm = h.match(/^\/contests$/))) return { name: 'contests' };
    if ((mm = h.match(/^\/analytics$/))) return { name: 'analytics' };
    if ((mm = h.match(/^\/achievements$/))) return { name: 'achievements' };
    if ((mm = h.match(/^\/join$/))) return { name: 'join' };
    if ((mm = h.match(/^\/submit$/))) return { name: 'submit' };
    return { name: '404' };
  }

  function setActiveNav(name) {
    const map = { student: 'students', group: 'groups', admin: '' };
    const active = map[name] !== undefined ? map[name] : name;
    U.$$('#main-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === active));
  }

  function route() {
    const r = parseHash();
    const root = U.$('#app');
    U.tooltip.hide();
    U.$('#nav-drawer').hidden = true;
    setActiveNav(r.name);
    document.title = (TITLES[r.name] ? TITLES[r.name] + ' · ' : '') + Store.settings().academyName + ' — Competitive Programming Academy';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    switch (r.name) {
      case 'home': PublicViews.home(root); break;
      case 'students': PublicViews.students(root); break;
      case 'student': PublicViews.profile(root, r.param); break;
      case 'groups': PublicViews.groups(root); break;
      case 'group': PublicViews.groupDetail(root, r.param); break;
      case 'leaderboard': PublicViews.leaderboard(root); break;
      case 'problems': PublicViews.problems(root); break;
      case 'contests': PublicViews.contests(root); break;
      case 'analytics': PublicViews.analytics(root); break;
      case 'achievements': PublicViews.achievements(root); break;
      case 'join': PublicViews.join(root); break;
      case 'submit': PublicViews.submit(root); break;
      case 'admin': Admin.render(root, r.param); break;
      default: PublicViews.notFound(root);
    }
    afterRender(root);
  }
  App.go = route;

  function afterRender(root) {
    U.observeReveals(root);
    U.$$('[data-count]', root).forEach((el) => {
      if (el.dataset.count === '') return; // static-value tiles
      const target = Number(el.dataset.count);
      if (!isNaN(target)) U.countUp(el, target);
    });
  }

  /* ---------------- global search ---------------- */
  function initSearch() {
    const input = U.$('#global-search');
    const dd = U.$('#search-dropdown');
    U.$('#search-icon').innerHTML = ic('search');

    const run = () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { dd.hidden = true; dd.innerHTML = ''; return; }
      const out = [];
      Store.students().forEach((s) => { if (s.name.toLowerCase().includes(q)) out.push({ t: 'Student', label: s.name, href: '#/student/' + s.id, icon: 'user', html: U.avatarHTML(s, 'avatar-36') }); });
      Store.groups().forEach((g) => { if (g.name.toLowerCase().includes(q)) out.push({ t: 'Group', label: g.name, href: '#/group/' + g.id, icon: 'layers' }); });
      Store.problems().forEach((p) => { if (p.name.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q)) out.push({ t: 'Problem', label: p.name, href: null, ext: p.link, icon: 'target' }); });
      Store.contests().forEach((c) => { if (c.name.toLowerCase().includes(q)) out.push({ t: 'Contest', label: c.name, href: '#/contests', icon: 'trophy' }); });
      Store.catalog().forEach((a) => { if (a.name.toLowerCase().includes(q)) out.push({ t: 'Achievement', label: a.name, href: '#/achievements', icon: 'medal' }); });
      if (!out.length) { dd.innerHTML = '<div class="sr-empty">No matches found.</div>'; dd.hidden = false; return; }
      dd.innerHTML = out.slice(0, 9).map((r, i) => `
        <a class="sr-item" data-i="${i}" href="${r.href || r.ext}" ${r.ext ? 'target="_blank" rel="noopener"' : ''}>
          ${r.html || `<span class="ach-icon" style="width:30px;height:30px;border-radius:9px;--tc:var(--accent)">${ic(r.icon)}</span>`}
          <span>${U.esc(r.label)}</span><span class="sr-type">${r.t}</span>
        </a>`).join('');
      dd.hidden = false;
    };
    input.addEventListener('input', U.debounce(run, 160));
    input.addEventListener('focus', run);
    document.addEventListener('click', (e) => { if (!U.$('#search-box').contains(e.target)) dd.hidden = true; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = dd.querySelector('.sr-item'); if (first) { dd.hidden = true; input.blur(); first.click(); } }
      if (e.key === 'Escape') { dd.hidden = true; input.blur(); }
    });
    // '/' focuses search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  /* ---------------- admin link state ---------------- */
  App.updateAdminLink = function () {
    const link = U.$('#admin-link');
    if (!link) return;
    const authed = Admin.isAuthed();
    link.innerHTML = ic(authed ? 'unlock' : 'lock');
    link.classList.toggle('is-auth', authed);
    link.title = authed ? 'Admin panel (unlocked)' : 'Admin panel';
  };

  /* ---------------- mobile nav ---------------- */
  function initBurger() {
    U.$('#nav-burger').innerHTML = ic('menu');
    U.$('#nav-burger').onclick = () => {
      const d = U.$('#nav-drawer');
      d.hidden = !d.hidden;
    };
    U.$('#nav-drawer').addEventListener('click', (e) => {
      if (e.target.closest('a')) U.$('#nav-drawer').hidden = true;
    });
  }

  /* ---------------- fx canvas (binary rain) ---------------- */
  function initFx() {
    if (U.reducedMotion()) return;
    const cvs = U.$('#fx-canvas');
    const ctx = cvs && cvs.getContext ? cvs.getContext('2d') : null;
    if (!ctx) return;
    let w, h, cols, drops, raf;
    const resize = () => {
      w = cvs.width = window.innerWidth;
      h = cvs.height = window.innerHeight;
      cols = Math.floor(w / 22);
      drops = Array.from({ length: cols }, () => Math.random() * h / 18);
      ctx.font = '13px "JetBrains Mono", monospace';
    };
    const draw = () => {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#070b14';
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < cols; i++) {
        const ch = Math.random() > 0.5 ? '1' : '0';
        ctx.fillText(ch, i * 22, drops[i] * 18);
        if (drops[i] * 18 > h && Math.random() > 0.985) drops[i] = 0;
        drops[i] += 0.35;
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(draw);
    });
    raf = requestAnimationFrame(draw);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    // first paint uses the local cache immediately; when cloud data arrives
    // (or the initial migration runs) the current view re-renders
    Store.load((applied) => { if (applied) { App.updateAdminLink(); route(); } });
    U.$('#year').textContent = new Date().getFullYear();
    initTheme();
    initSearch();
    initBurger();
    initFx();
    App.updateAdminLink();
    route();
    window.addEventListener('hashchange', route);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
