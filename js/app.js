/* ============================================================
   Abdelmajid CP — app.js : router, theme, search, fx, boot
   ============================================================ */
(function () {
  const App = {};
  window.App = App;

  /* ---------------- bilingual marketing copy ---------------- */
  const COPY = {
    en: {
      navHome: 'Home', navAbout: 'About the Academy', navStudents: 'Students', navGroups: 'Groups', navLeaderboard: 'Leaderboard', navProblems: 'Problems', navHall: 'Hall of Fame', navAnalytics: 'Analytics', navAchievements: 'Achievements', navSpace: 'My Space', navAdmin: 'Admin Panel', navJoin: 'Join the Academy', navSubmit: 'Submit a Solve', navSeasons: 'Seasons', navCoach: 'Coach Panel',
      heroEyebrow: 'COMPETITIVE PROGRAMMING TRAINING · FOR THE NEXT GENERATION', heroTitleA: 'Build confidence.', heroTitleB: 'Think like a competitor.', heroPrimary: 'Start your journey', heroSecondary: 'How it works',
      aboutKicker: 'ABOUT THE ACADEMY', aboutTitle: 'More than a leaderboard — a place to grow.', aboutLink: 'Discover the academy', aboutPath: 'Find your training path',
      courseKicker: 'LEVEL 1 · COMING SOON', courseHours: 'HOURS', courseLevel: 'LEVEL 1', courseTitle: '16 hours to start coding with confidence.', courseLine: 'Learn C++, problem solving and upgrade your CV to another level.', courseNoExperience: 'No experience needed.', courseDates: 'Late August', courseAge: 'Ages 13–17', courseDetails: 'more details', courseJoin: 'join now in 30 sec',
      pillar1Title: 'Structured paths', pillar1Text: 'From first steps to advanced contest preparation.', pillar2Title: 'Real progress', pillar2Text: 'Problems, topics, levels and achievements that show the journey.', pillar3Title: 'Competitive spirit', pillar3Text: 'Groups, contests and a community that keeps students moving.',
      programsKicker: 'FIND YOUR STARTING POINT', programsTitle: 'A path for every stage.', programsSub: 'Meet students where they are — then give them the next challenge.',
      programRookies: 'Foundations', programRookiesText: 'Build confidence with logic, implementation and your first wins.', programChallengers: 'Core Competitors', programChallengersText: 'Master the techniques that turn practice into consistent results.', programElite: 'Elite Preparation', programEliteText: 'Push deeper into advanced topics, strategy and serious contests.', programLink: 'Explore group',
      methodKicker: 'OUR METHOD', methodTitle: 'Progress should feel visible.', methodSub: 'A simple loop that turns effort into momentum.', method1Title: 'Learn', method1Text: 'Understand the idea with guidance that meets your level.', method2Title: 'Solve', method2Text: 'Practice on the right problem, not just the next problem.', method3Title: 'Compete', method3Text: 'Use contests and feedback to turn skills into confidence.',
      joinEyebrow: 'NEW MEMBERS WELCOME', joinTitle: 'A clear starting point for every student.', joinText: 'Tell us where you are today and what you want to achieve. We will help you find the right path.', joinButton: 'Join the Academy',
      coachEyebrow: 'MEET THE COACH', coachLink: 'Meet the coach', coachExperience: 'Coach and academy founder focused on building clear problem-solving habits, disciplined practice and confidence through competition.', coachExperienceLabel: 'EXPERIENCE', featuredTitle: 'Featured Students', featuredSub: 'Progress worth celebrating', recentTitle: 'Recent Activity', recentSub: 'Latest solves, contests and milestones across the academy', ladderTitle: 'The Ranking Ladder', ladderSub: 'Climb from Newcomer to Legend — every point counts',
      aboutPageKicker: 'THE ACADEMY', aboutPageSub: 'Build problem-solving skills, train with purpose and learn how to compete.', aboutApproach: 'OUR APPROACH', aboutHeadline: 'Every problem is a step forward.', aboutMeet: 'Meet our students', whatGets: 'What students get', whatGetsSub: 'A clear path from learning the basics to competing at a higher level.', benefit1Title: 'Learn by level', benefit1Text: 'Training is organized into groups so beginners build confidence before moving to harder techniques.', benefit2Title: 'Practice with purpose', benefit2Text: 'Each problem has a difficulty, topic and reward. Students can see exactly what to work on next.', benefit3Title: 'Compete and celebrate', benefit3Text: 'Contests, rankings and achievements turn steady effort into milestones students are proud to share.', journeyKicker: 'THE JOURNEY', journeyTitle: 'Start where you are. See how far you can go.', step1Title: 'Assessment', step1Text: 'We understand your current level and goals.', step2Title: 'Training group', step2Text: 'You join the path that fits your progress.', step3Title: 'Weekly practice', step3Text: 'You solve, learn from mistakes and build consistency.', step4Title: 'Competition', step4Text: 'You test yourself in contests and climb the ladder.', finalTitle: 'Ready to write your next solution?', finalText: 'Tell us about your level and goals. The coach will help you find the right starting point.', finalButton: 'Start your application',
      joinPageTitle: 'Join the Academy', joinPageSub: 'One form, one conversation, one clear next step.', languageLabel: 'Français', languageTitle: 'Switch to French'
    },
    fr: {
      navHome: 'Accueil', navAbout: 'À propos', navStudents: 'Élèves', navGroups: 'Groupes', navLeaderboard: 'Classement', navProblems: 'Problèmes', navHall: 'Palmarès', navAnalytics: 'Analyses', navAchievements: 'Récompenses', navSpace: 'Mon espace', navAdmin: 'Panneau coach', navJoin: 'Rejoindre l’académie', navSubmit: 'Valider une solution', navSeasons: 'Saisons', navCoach: 'Panneau coach',
      heroEyebrow: 'FORMATION EN PROGRAMMATION COMPÉTITIVE · POUR LA NOUVELLE GÉNÉRATION', heroTitleA: 'Construire la confiance.', heroTitleB: 'Penser comme un compétiteur.', heroPrimary: 'Commencer le parcours', heroSecondary: 'Notre méthode',
      aboutKicker: 'À PROPOS DE L’ACADÉMIE', aboutTitle: 'Plus qu’un classement — un espace pour progresser.', aboutLink: 'Découvrir l’académie', aboutPath: 'Trouver son parcours',
      courseKicker: 'NIVEAU 1 · BIENTÔT DISPONIBLE', courseHours: 'HEURES', courseLevel: 'NIVEAU 1', courseTitle: '16 heures pour commencer à coder avec confiance.', courseLine: 'Apprendre le C++, la résolution de problèmes et donner une nouvelle dimension à son CV.', courseNoExperience: 'Aucune expérience nécessaire.', courseDates: 'Fin août', courseAge: '13–17 ans', courseDetails: 'plus de détails', courseJoin: 'rejoindre en 30 sec',
      pillar1Title: 'Parcours structurés', pillar1Text: 'Des premiers pas à la préparation aux concours avancés.', pillar2Title: 'Progrès visibles', pillar2Text: 'Problèmes, thèmes, niveaux et récompenses pour suivre le chemin.', pillar3Title: 'Esprit de compétition', pillar3Text: 'Groupes, concours et communauté pour garder l’élan.',
      programsKicker: 'TROUVER SON POINT DE DÉPART', programsTitle: 'Un parcours pour chaque étape.', programsSub: 'Partir du niveau de chaque élève, puis proposer le prochain défi.',
      programRookies: 'Fondations', programRookiesText: 'Développer la confiance avec la logique, l’implémentation et les premières réussites.', programChallengers: 'Compétiteurs', programChallengersText: 'Maîtriser les techniques qui transforment la pratique en résultats réguliers.', programElite: 'Préparation élite', programEliteText: 'Approfondir les thèmes avancés, la stratégie et les concours exigeants.', programLink: 'Découvrir le groupe',
      methodKicker: 'NOTRE MÉTHODE', methodTitle: 'Le progrès doit se voir.', methodSub: 'Une boucle simple qui transforme l’effort en élan.', method1Title: 'Apprendre', method1Text: 'Comprendre l’idée avec un accompagnement adapté au niveau.', method2Title: 'Résoudre', method2Text: 'Pratiquer sur le bon problème, pas seulement sur le prochain.', method3Title: 'Compétition', method3Text: 'Utiliser les concours et les retours pour gagner en confiance.',
      joinEyebrow: 'NOUVEAUX MEMBRES BIENVENUS', joinTitle: 'Un point de départ clair pour chaque élève.', joinText: 'Dites-nous où vous en êtes et ce que vous souhaitez atteindre. Nous vous aiderons à trouver le bon parcours.', joinButton: 'Rejoindre l’académie',
      coachEyebrow: 'RENCONTRER LE COACH', coachLink: 'Rencontrer le coach', coachExperience: 'Coach et fondateur de l’académie, il accompagne les élèves pour développer un raisonnement clair, une pratique régulière et la confiance en compétition.', coachExperienceLabel: 'EXPÉRIENCE', featuredTitle: 'Élèves à l’honneur', featuredSub: 'Des progrès qui méritent d’être célébrés', recentTitle: 'Activité récente', recentSub: 'Dernières solutions, concours et étapes franchies', ladderTitle: 'L’échelle des niveaux', ladderSub: 'De Newcomer à Legend — chaque point compte',
      aboutPageKicker: 'L’ACADÉMIE', aboutPageSub: 'Développer la résolution de problèmes, s’entraîner avec méthode et apprendre à concourir.', aboutApproach: 'NOTRE APPROCHE', aboutHeadline: 'Chaque problème est un pas en avant.', aboutMeet: 'Découvrir nos élèves', whatGets: 'Ce que les élèves reçoivent', whatGetsSub: 'Un parcours clair, des bases solides jusqu’à la compétition.', benefit1Title: 'Apprendre par niveau', benefit1Text: 'Les groupes permettent aux débutants de prendre confiance avant d’aborder des techniques plus difficiles.', benefit2Title: 'Pratiquer avec un objectif', benefit2Text: 'Chaque problème a une difficulté, un thème et une récompense pour savoir quoi travailler ensuite.', benefit3Title: 'Concourir et célébrer', benefit3Text: 'Concours, classements et récompenses transforment les efforts réguliers en étapes mémorables.', journeyKicker: 'LE PARCOURS', journeyTitle: 'Commencer où vous êtes. Découvrir jusqu’où vous pouvez aller.', step1Title: 'Évaluation', step1Text: 'Comprendre le niveau et les objectifs actuels.', step2Title: 'Groupe de travail', step2Text: 'Rejoindre le parcours adapté à la progression.', step3Title: 'Pratique hebdomadaire', step3Text: 'Résoudre, apprendre des erreurs et créer de bonnes habitudes.', step4Title: 'Compétition', step4Text: 'Se tester en concours et gravir les niveaux.', finalTitle: 'Prêt à écrire votre prochaine solution ?', finalText: 'Parlez-nous de votre niveau et de vos objectifs. Le coach vous aidera à commencer au bon endroit.', finalButton: 'Commencer la candidature',
      joinPageTitle: 'Rejoindre l’académie', joinPageSub: 'Un formulaire, un échange, une prochaine étape claire.', languageLabel: 'English', languageTitle: 'Passer en anglais'
    }
  };
  const LANG_KEY = 'abdelmajidcp_lang';
  // The public site currently ships in English. Keep the copy map ready for a
  // future locale, but do not expose a language switcher in the published UI.
  App.lang = () => 'en';
  App.t = (key, fallback) => (COPY.en[key]) || fallback || key;
  App.setLang = () => {};
  function applyStaticTranslations() {
    document.documentElement.lang = App.lang();
    U.$$('[data-i18n]').forEach((el) => { el.textContent = App.t(el.dataset.i18n, el.textContent); });
    const b = U.$('#lang-toggle');
    if (b) { b.textContent = App.t('languageLabel'); b.title = App.t('languageTitle'); b.setAttribute('aria-label', App.t('languageTitle')); }
  }
  const TITLES = {
    home: 'Home', students: 'Students', student: 'Student Profile', groups: 'Groups', group: 'Group',
    leaderboard: 'Leaderboard', problems: 'Problem Library', contests: 'Hall of Fame',
    analytics: 'Analytics', achievements: 'Achievements', about: 'About the Academy', join: 'Join the Academy', submit: 'Submit a Solve', space: 'My Space', seasons: 'Seasons', admin: 'Admin Panel',
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
    if ((mm = h.match(/^\/about$/))) return { name: 'about' };
    if ((mm = h.match(/^\/join(?:#(apply|ask))?$/))) return { name: 'join', param: mm[1] || null };
    if ((mm = h.match(/^\/submit$/))) return { name: 'submit' };
    if ((mm = h.match(/^\/space$/))) return { name: 'space' };
    if ((mm = h.match(/^\/seasons$/))) return { name: 'seasons' };
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
    applyStaticTranslations();
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
      case 'about': PublicViews.about(root); break;
      case 'join': PublicViews.join(root, r.param); break;
      case 'submit': PublicViews.submit(root); break;
      case 'space': PublicViews.space(root); break;
      case 'seasons': PublicViews.seasons(root); break;
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

  /* ---------------- language switcher ---------------- */
  function initLanguage() {
    const b = U.$('#lang-toggle');
    if (!b) return;
    b.onclick = () => { App.setLang(App.lang() === 'en' ? 'fr' : 'en'); applyStaticTranslations(); route(); };
    applyStaticTranslations();
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
        <a class="sr-item" data-i="${i}" href="${r.href || U.safeURL(r.ext)}" ${r.ext ? 'target="_blank" rel="noopener"' : ''}>
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

  // Navigable cards/rows carry data-nav (CSP-safe replacement for inline
  // onclick, which the Content-Security-Policy intentionally blocks).
  // Inner links/buttons always win (same as the old stopPropagation()).
  function initNavDelegation() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest && e.target.closest('[data-nav]');
      if (!nav || !nav.dataset.nav) return;
      const inner = e.target.closest('a, button, input, select, textarea, [data-nav-stop]');
      if (inner && inner !== nav && nav.contains(inner)) return;
      location.hash = nav.dataset.nav;
    });
  }
  function boot() {
    // first paint uses the local cache immediately; when cloud data arrives
    // (or the initial migration runs) the current view re-renders
    Store.load((applied) => { if (applied) { App.updateAdminLink(); route(); } });
    U.$('#year').textContent = new Date().getFullYear();
    initTheme();
    initSearch();
    initNavDelegation();
    initBurger();
    initFx();
    App.updateAdminLink();
    route();
    window.addEventListener('hashchange', route);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
