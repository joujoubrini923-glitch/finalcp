/* ============================================================
   Abdelmajid CP — views.js : public pages
   ============================================================ */
(function () {
  /* ---------------- shared components ---------------- */
  const C = {};
  const T = (key, fallback) => window.App && typeof window.App.t === 'function' ? window.App.t(key, fallback) : fallback;
  const AppLabel = (key, fallback) => T({ students: 'navStudents', groups: 'navGroups', problems: 'navProblems', contests: 'navHall' }[key] || key, fallback);
  const academyCopy = (s) => {
    const fr = window.App && typeof window.App.lang === 'function' && window.App.lang() === 'fr';
    return {
      tagline: fr ? (s.taglineFr || s.tagline || '') : (s.tagline || ''),
      description: fr ? (s.academyDescriptionFr || s.academyDescription || s.tagline || '') : (s.academyDescription || s.tagline || ''),
      dates: fr ? (s.cohortDatesFr || s.cohortDates || '') : (s.cohortDates || ''),
      duration: fr ? (s.programDurationFr || s.programDuration || '') : (s.programDuration || ''),
    };
  };
  const availabilityOptions = Array.from({ length: 29 }, (_, i) => { const mins = 8 * 60 + i * 30; const h = String(Math.floor(mins / 60)).padStart(2, '0'); const m = String(mins % 60).padStart(2, '0'); return `<option value="${h}:${m}">${h}:${m}</option>`; }).join('');
  const availabilityEndOptions = availabilityOptions.replace('value="22:00"', 'value="22:00" selected');
  const availabilityPickerHTML = (prefix) => `<div class="availability-picker"><div class="availability-picker-head"><b>Weekly availability</b><span>Choose your free time, not specific dates.</span></div><div class="availability-grid">${Store.weekdays().map((day) => `<div class="availability-day" data-av-day="${prefix}-${day.key}" data-av-key="${day.key}"><label class="availability-day-name"><input type="checkbox" data-av-enabled><span>${U.esc(day.label)}</span></label><div class="availability-range"><select class="select" data-av-start disabled>${availabilityOptions}</select><span>to</span><select class="select" data-av-end disabled>${availabilityEndOptions}</select></div></div>`).join('')}</div></div>`;
  const wireAvailabilityPicker = (root, prefix) => {
    U.$$(`[data-av-day^="${prefix}-"]`, root).forEach((row) => {
      const check = U.$('[data-av-enabled]', row);
      U.$$('[data-av-start], [data-av-end]', row).forEach((input) => { input.disabled = !check.checked; });
      check.addEventListener('change', () => U.$$('[data-av-start], [data-av-end]', row).forEach((input) => { input.disabled = !check.checked; }));
    });
  };
  const readAvailability = (root, prefix) => {
    const out = {};
    U.$$(`[data-av-day^="${prefix}-"]`, root).forEach((row) => {
      const check = U.$('[data-av-enabled]', row);
      if (check && check.checked) out[row.dataset.avKey] = [{ start: U.$('[data-av-start]', row).value, end: U.$('[data-av-end]', row).value }];
    });
    return out;
  };
  const studentRangeOptions = (options, selected) => {
    const value = String(selected || ''); const clean = options.replace(/ selected/g, '');
    return value && clean.includes(`value="${value}"`) ? clean.replace(`value="${value}"`, `value="${value}" selected`) : clean;
  };
  const studentRangeRowHTML = (prefix, key, range = {}) => {
    const start = range.start || '17:00'; const end = range.end || '18:00';
    return `<div class="student-availability-range" data-student-av-range><select class="select" data-student-av-start aria-label="Start time">${studentRangeOptions(availabilityOptions, start)}</select><span>to</span><select class="select" data-student-av-end aria-label="End time">${studentRangeOptions(availabilityEndOptions, end)}</select><button type="button" class="icon-btn availability-range-remove" data-student-av-remove title="Remove range" aria-label="Remove range">${ic('x')}</button></div>`;
  };
  const studentAvailabilityPickerHTML = (prefix, savedAvailability) => {
    const days = Store.weekdays().map((day) => {
      const ranges = savedAvailability && Array.isArray(savedAvailability[day.key]) ? savedAvailability[day.key] : [];
      const rangeRows = (ranges.length ? ranges : [{}]).map((range) => studentRangeRowHTML(prefix, day.key, range)).join('');
      return `<div class="student-availability-day" data-student-av-day="${prefix}-${day.key}" data-av-key="${day.key}"><label class="student-availability-day-head"><input type="checkbox" data-student-av-enabled ${ranges.length ? 'checked' : ''}><b>${U.esc(day.label)}</b></label><div class="student-availability-ranges" data-student-av-ranges>${rangeRows}</div><button type="button" class="btn btn-ghost btn-xs student-availability-add" data-student-av-add>${ic('plus')}Add range</button></div>`;
    }).join('');
    return `<div class="availability-picker student-availability-picker" data-student-av-picker="${U.esc(prefix)}"><div class="availability-picker-head"><div><b>Choose your weekly availability</b><span>Select any Monday–Sunday times that work for you. This is independent from the coach’s possible teaching windows.</span></div></div><div class="student-availability-week">${days}</div></div>`;
  };
  const wireStudentAvailabilityPicker = (root, prefix) => {
    const picker = U.$(`[data-student-av-picker="${prefix}"]`, root); if (!picker) return;
    const syncDay = (day) => { const check = U.$('[data-student-av-enabled]', day); U.$$('[data-student-av-start], [data-student-av-end], [data-student-av-remove], [data-student-av-add]', day).forEach((input) => { input.disabled = !check.checked; }); };
    U.$$('[data-student-av-day]', picker).forEach((day) => {
      const check = U.$('[data-student-av-enabled]', day); syncDay(day);
      if (check) check.onchange = () => syncDay(day);
      U.$$('[data-student-av-remove]', day).forEach((button) => button.onclick = () => {
        const rows = U.$$('[data-student-av-range]', day); if (rows.length > 1) button.closest('[data-student-av-range]').remove(); else { const start = U.$('[data-student-av-start]', button.closest('[data-student-av-range]')); const end = U.$('[data-student-av-end]', button.closest('[data-student-av-range]')); if (start) start.value = '17:00'; if (end) end.value = '18:00'; }
      });
      const add = U.$('[data-student-av-add]', day);
      if (add) add.onclick = () => { const wrap = U.$('[data-student-av-ranges]', day); if (!wrap || U.$$('[data-student-av-range]', day).length >= 6) return; wrap.insertAdjacentHTML('beforeend', studentRangeRowHTML(prefix, day.dataset.avKey)); wireStudentAvailabilityPicker(root, prefix); };
    });
  };
  const readStudentAvailability = (root) => {
    const out = {};
    U.$$('[data-student-av-day]', root).forEach((day) => {
      const check = U.$('[data-student-av-enabled]', day); if (!check || !check.checked) return;
      const ranges = U.$$('[data-student-av-range]', day).map((row) => ({ start: U.$('[data-student-av-start]', row).value, end: U.$('[data-student-av-end]', row).value })).filter((range) => range.start && range.end && range.start < range.end).slice(0, 6);
      if (ranges.length) out[day.dataset.avKey] = ranges;
    });
    return out;
  };
  const applyStudentAvailability = (root, prefix, availability) => {
    const picker = U.$(`[data-student-av-picker="${prefix}"]`, root); if (!picker) return;
    Store.weekdays().forEach((day) => {
      const row = U.$(`[data-student-av-day="${prefix}-${day.key}"]`, picker); if (!row) return;
      const ranges = availability && Array.isArray(availability[day.key]) ? availability[day.key] : [];
      const check = U.$('[data-student-av-enabled]', row); if (check) check.checked = ranges.length > 0;
      const wrap = U.$('[data-student-av-ranges]', row); if (wrap) wrap.innerHTML = (ranges.length ? ranges : [{}]).map((range) => studentRangeRowHTML(prefix, day.key, range)).join('');
    });
    wireStudentAvailabilityPicker(root, prefix);
  };
  const publishedAvailabilityHTML = (availability) => {
    const rows = Store.weekdays().map((day) => { const ranges = availability && Array.isArray(availability[day.key]) ? availability[day.key] : []; return ranges.length ? `<span><b>${U.esc(day.label.slice(0, 3))}</b> ${ranges.map((r) => `${U.esc(r.start)}–${U.esc(r.end)}`).join(', ')}</span>` : ''; }).filter(Boolean).join('');
    return `<div class="published-schedule"><small>COACH POSSIBLE WINDOWS</small><div>${rows || '<span>Schedule to be announced</span>'}</div></div>`;
  };
  const publishedCourseScheduleHTML = (course) => {
    const schedule = course && course.publishedSchedule;
    const sessions = schedule && Array.isArray(schedule.sessions) ? schedule.sessions : [];
    if (!sessions.length) return '';
    const days = sessions.map((session, i) => { const day = Store.weekdays().find((x) => x.key === session.day); return `<span><b>${U.esc(day ? day.label.slice(0, 3) : session.day || ('Session ' + (i + 1)))}</b> ${U.esc(session.start || '')}–${U.esc(session.end || '')}</span>`; }).join('');
    const dates = schedule.startDate ? ` · starts ${U.esc(schedule.startDate)}${schedule.endDate ? ` → ${U.esc(schedule.endDate)}` : ''}` : '';
    return `<div class="published-course-schedule"><div class="published-course-schedule-head"><small>PUBLISHED WEEKLY SESSIONS</small><b>${sessions.length} session${sessions.length === 1 ? '' : 's'} / week</b></div><div class="published-course-sessions">${days}</div><p>${U.esc(schedule.attendanceNote || 'Final course timetable published by the coach.')}${dates}</p></div>`;
  };

  // Admin schedules are edited as a real Monday–Sunday timetable. The stored
  // format remains { mon: [{ start, end }] } so existing student forms,
  // advertisements and old saved data continue to work.
  const availabilityMinutes = (value) => { const m = String(value || '').match(/^(\d{2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
  const availabilitySlotsFor = (from = '08:00', to = '22:00') => {
    let start = availabilityMinutes(from); let end = availabilityMinutes(to);
    if (start < 0) start = 8 * 60; if (end <= start) end = 22 * 60;
    const time = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const slots = [];
    for (let cursor = start; cursor + 30 <= end; cursor += 30) slots.push({ start: time(cursor), end: time(cursor + 30), label: `${time(cursor)}–${time(cursor + 30)}`, startMin: cursor, endMin: cursor + 30 });
    return slots;
  };
  const adminAvailabilityPickerHTML = (prefix, availability, options = {}) => {
    const days = Store.weekdays();
    const slots = availabilitySlotsFor(options.displayStart || '08:00', options.displayEnd || '22:00');
    const participants = Array.isArray(options.participants) ? options.participants : [];
    const availableFor = (day, start, end) => participants.filter((person) => {
      const ranges = person && person.availability && Array.isArray(person.availability[day.key]) ? person.availability[day.key] : [];
      return ranges.some((range) => availabilityMinutes(range.start) <= start && availabilityMinutes(range.end) >= end);
    });
    const body = slots.map((slot) => `<tr><th scope="row" class="availability-time">${slot.label}</th>${days.map((day) => {
      const ranges = availability && Array.isArray(availability[day.key]) ? availability[day.key] : [];
      const active = ranges.some((range) => availabilityMinutes(range.start) <= slot.startMin && availabilityMinutes(range.end) >= slot.endMin);
      const people = availableFor(day, slot.startMin, slot.endMin); const count = people.length;
      const heat = count ? Math.min(5, Math.max(1, Math.ceil((count / Math.max(1, participants.length)) * 5))) : 0;
      const names = people.map((person) => person.name).join(', ');
      const heatClass = heat ? ` has-students heat-${heat}${active ? '' : ' is-outside-window'}` : '';
      const label = `${day.label} ${slot.label} · ${count} student${count === 1 ? '' : 's'} available${names ? ': ' + names : ''}`;
      return `<td><button type="button" class="availability-cell${active ? ' is-active' : ''}${heatClass}" data-av-cell data-av-key="${day.key}" data-av-start="${slot.start}" data-av-end="${slot.end}" data-av-count="${count}" data-av-students="${U.esc(names)}" aria-pressed="${active ? 'true' : 'false'}" aria-label="${U.esc(label)}" title="${U.esc(label)}"><span class="availability-cell-count">${count || ''}</span></button></td>`;
    }).join('')}</tr>`).join('');
    return `<div class="admin-availability-picker" data-admin-availability="${U.esc(prefix)}">
      <div class="availability-picker-head"><div><b>Weekly timetable</b><span>Monday to Sunday · 30-minute blocks</span></div><button type="button" class="btn btn-ghost btn-xs" data-av-clear>Clear all</button></div>
      <p class="availability-timetable-help">Click or drag across the timetable to mark the hours available for this course. Student counts are based on the availability submitted for this advertisement.</p>
      <div class="availability-timetable-wrap"><table class="availability-timetable"><thead><tr><th class="availability-time-head">TIME</th>${days.map((day) => `<th>${U.esc(day.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="availability-timetable-legend"><span><i class="availability-legend-swatch"></i>Course window</span><span><i class="availability-legend-heat"></i>Student count</span><span><i class="availability-legend-outside"></i>Outside course window</span><span>${U.esc(options.displayStart || '08:00')}–${U.esc(options.displayEnd || '22:00')}</span></div><div class="availability-cell-inspector" data-av-inspector>Click a cell to see the students available at that time.</div>
    </div>`;
  };
  const wireAdminAvailabilityPicker = (root, prefix) => {
    const picker = U.$(`[data-admin-availability="${prefix}"]`, root);
    if (!picker) return;
    const cells = U.$$('[data-av-cell]', picker);
    let painting = false; let paintValue = true; let suppressClick = false;
    const inspector = U.$('[data-av-inspector]', picker);
    const notifyAvailabilityChange = () => picker.dispatchEvent(new CustomEvent('availabilitychange'));
    const inspect = (cell) => { if (!inspector) return; const count = Number(cell.dataset.avCount || 0); const names = cell.dataset.avStudents || ''; inspector.textContent = `${cell.dataset.avKey.toUpperCase()} ${cell.dataset.avStart}–${cell.dataset.avEnd} · ${count} student${count === 1 ? '' : 's'} available${names ? ': ' + names : ''}`; };
    const setCell = (cell, value) => { cell.classList.toggle('is-active', value); cell.setAttribute('aria-pressed', value ? 'true' : 'false'); };
    const stopPainting = () => { if (painting) { painting = false; notifyAvailabilityChange(); } };
    cells.forEach((cell) => {
      cell.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault(); suppressClick = true;
        painting = true; paintValue = !cell.classList.contains('is-active'); setCell(cell, paintValue); inspect(cell);
        window.addEventListener('pointerup', stopPainting, { once: true });
      });
      // Also support keyboard activation and test/mobile click events. A real
      // pointer gesture already painted the cell, so its synthetic click is
      // ignored once to avoid toggling it back immediately.
      cell.addEventListener('click', () => { if (suppressClick) { suppressClick = false; inspect(cell); return; } setCell(cell, !cell.classList.contains('is-active')); inspect(cell); notifyAvailabilityChange(); });
      cell.addEventListener('pointerenter', () => { if (painting) { setCell(cell, paintValue); inspect(cell); } });
      cell.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); setCell(cell, !cell.classList.contains('is-active')); inspect(cell); notifyAvailabilityChange();
      });
    });
    const clear = U.$('[data-av-clear]', picker);
    if (clear) clear.onclick = () => { cells.forEach((cell) => setCell(cell, false)); notifyAvailabilityChange(); };
  };
  const readAdminAvailability = (root, prefix) => {
    const out = {};
    Store.weekdays().forEach((day) => {
      const cells = U.$$(`[data-admin-availability="${prefix}"] [data-av-cell][data-av-key="${day.key}"]`, root);
      const ranges = []; let start = null; let end = null;
      const flush = () => { if (start && end) ranges.push({ start, end }); start = null; end = null; };
      cells.forEach((cell) => {
        if (cell.classList.contains('is-active')) {
          if (!start) start = cell.dataset.avStart;
          end = cell.dataset.avEnd;
        } else flush();
      });
      flush();
      if (ranges.length) out[day.key] = ranges.slice(0, 6);
    });
    return out;
  };

  window.ACPAvailability = { adminHTML: adminAvailabilityPickerHTML, wireAdmin: wireAdminAvailabilityPicker, readAdmin: readAdminAvailability };

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
    return `<div class="card hoverable student-card reveal ${topCls}" data-nav="#/student/${s.id}">
      ${rank ? `<span class="rank-tag">#${rank}</span>` : ''}
      ${U.avatarHTML(s, 'avatar-56')}
      <h3>${U.esc(s.name)}</h3>
      <div class="sc-head">${C.levelChip(lvl, true)}${g ? `<a class="chip" href="#/group/${g.id}" data-nav-stop>${U.esc(g.name)}</a>` : ''}</div>
      <div class="sc-ach">${ach.slice(0, 3).map((a) => C.achIcon(a)).join('')}${ach.length > 3 ? `<span class="more">+${ach.length - 3}</span>` : ''}</div>
      <div class="sc-stats">
        <div class="sc-stat"><b class="mono">${U.fmtNum(entry.score)}</b><span>Score</span></div>
        <div class="sc-stat"><b class="mono">${entry.solved}</b><span>Solved</span></div>
        <div class="sc-stat"><b class="mono">${lvl.topics}</b><span>Topics</span></div>
      </div>
    </div>`;
  };

  C.podiumHTML = (entries, metricLabel, tied = true) => {
    if (!entries || !entries.length) return '';
    if (!tied) {
      const single = (e, cls, crown) => `<div class="pd-slot ${cls}">${crown ? `<span class="pd-crown">${ic('crown')}</span>` : ''}${e && e.avatarHTML ? e.avatarHTML : ''}<span class="pd-name">${U.esc(e ? e.name : '—')}</span><span class="pd-score mono">${e ? U.fmtNum(e.value) + ' ' + U.esc(metricLabel || '') : ''}</span><div class="pd-bar">${e ? e.rank : '—'}</div></div>`;
      return `<div class="podium">${single(entries[1], 'pd-2', false)}${single(entries[0], 'pd-1', true)}${single(entries[2], 'pd-3', false)}</div>`;
    }
    const group = (rank) => entries.filter((e) => Number(e.rank) === rank);
    const slot = (rank, cls) => {
      const people = group(rank);
      return `<div class="pd-slot ${cls} ${people.length ? '' : 'pd-empty'}">
        ${rank === 1 && people.length ? `<span class="pd-crown">${ic('crown')}</span>` : ''}
        <div class="pd-people">${people.map((e) => `<div class="pd-person">${e.avatarHTML || ''}<span class="pd-name">${U.esc(e.name)}</span><span class="pd-score mono">${U.fmtNum(e.value)} ${U.esc(metricLabel || '')}</span></div>`).join('')}</div>
        <div class="pd-bar">${people.length ? rank : '—'}</div>
      </div>`;
    };
    return `<div class="podium">${slot(2, 'pd-2')}${slot(1, 'pd-1')}${slot(3, 'pd-3')}</div>`;
  };

  C.backLink = (href, label) => `<a class="back-link" href="${href}">${ic('arrowLeft')}${U.esc(label)}</a>`;

  const PV = {};
  window.PublicViews = PV;

  const certAccent = (cert) => cert && cert.accent || ({ gold: '#bd8a1f', silver: '#78838e', bronze: '#a96342', green: '#2f8467' }[cert && cert.tier] || '#2f8467');
  const certLines = (text, max = 28) => {
    const words = String(text || '').split(/\s+/); const lines = []; let line = '';
    words.forEach((word) => { if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim(); });
    if (line) lines.push(line); return lines.slice(0, 2);
  };
  const certificateSVG = (cert, student, logoHref = 'assets/academy-logo.png') => {
    const accent = certAccent(cert); const silver = cert.tier === 'silver'; const avatar = U.safeImage(student && student.photo); const initials = U.initials(student && student.name || '?');
    const titleLines = certLines(cert.title, 23);
    const detailParts = String(cert.detail || cert.subtitle || '').split(' · ');
    const detailHeadlineLines = certLines(detailParts.shift() || '', 30);
    const detailMetaLines = certLines(detailParts.join(' · '), 38);
    const pillFill = silver ? '#ffffff' : accent; const pillText = silver ? '#111111' : '#fffdf4'; const pillStroke = silver ? '#111111' : accent;
    const id = U.esc(cert.id).replace(/[^A-Za-z0-9_-]/g, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs><clipPath id="cert-avatar-${id}"><circle cx="540" cy="570" r="142"/></clipPath><filter id="cert-shadow-${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#111827" flood-opacity=".18"/></filter></defs>
      <rect width="1080" height="1920" fill="#f5efe3"/>
      <path d="M-90 330 C150 170 245 390 430 265 S780 105 1170 260" fill="none" stroke="${accent}" stroke-width="18" opacity=".2"/>
      <path d="M-100 1705 C170 1535 330 1830 600 1650 S920 1510 1180 1660 L1180 1960 L-100 1960Z" fill="${accent}" opacity=".12"/>
      <circle cx="942" cy="410" r="78" fill="${accent}" opacity=".11"/><circle cx="132" cy="1410" r="100" fill="${accent}" opacity=".07"/>
      <image href="${logoHref}" x="52" y="40" width="225" height="225" preserveAspectRatio="xMidYMid meet"/>
      <rect x="500" y="245" width="510" height="112" rx="56" fill="${pillFill}" stroke="${pillStroke}" stroke-width="4"/>
      <text x="755" y="286" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" letter-spacing="3" fill="${pillText}">VISIT ME ON</text>
      <text x="755" y="330" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="900" fill="${pillText}">abdelmajidbrini.tn</text>
      <circle cx="540" cy="570" r="158" fill="#fffaf1" stroke="${accent}" stroke-width="8" filter="url(#cert-shadow-${id})"/>
      ${avatar ? `<image href="${avatar}" x="398" y="428" width="284" height="284" preserveAspectRatio="xMidYMid slice" clip-path="url(#cert-avatar-${id})"/>` : `<circle cx="540" cy="570" r="142" fill="${accent}" opacity=".16"/><text x="540" y="598" text-anchor="middle" font-family="Arial,sans-serif" font-size="78" font-weight="700" fill="${accent}">${U.esc(initials)}</text>`}
      <circle cx="540" cy="810" r="44" fill="${accent}" opacity=".16"/><circle cx="540" cy="810" r="28" fill="none" stroke="${accent}" stroke-width="6"/><path d="M540 785 l7 16 18 2-13 12 4 18-16-9-16 9 4-18-13-12 18-2z" fill="${accent}"/>
      <text x="540" y="950" text-anchor="middle" font-family="Arial,sans-serif" font-size="66" font-weight="900" fill="#111111">${U.esc(student && student.name || '')}</text>
      <path d="M190 1015 H890" stroke="#111111" stroke-width="2" opacity=".24"/>
      ${titleLines.map((line, i) => `<text x="540" y="${1135 + i * 95}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${titleLines.length > 1 ? 67 : 86}" font-weight="900" fill="${accent}">${U.esc(line)}</text>`).join('')}
      ${detailHeadlineLines.map((line, i) => `<text x="540" y="${1365 + i * 62}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${detailHeadlineLines.length > 1 ? 48 : 58}" font-weight="900" fill="#111111">${U.esc(line)}</text>`).join('')}
      ${detailMetaLines.map((line, i) => `<text x="540" y="${1495 + i * 50}" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="900" fill="${accent}">${U.esc(line)}</text>`).join('')}
      <text x="540" y="1615" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="900" letter-spacing="3" fill="#111111">${U.esc(U.fmtDate(cert.date))}</text>
      <path d="M70 1740 H1010" stroke="${accent}" stroke-width="5" opacity=".55"/><circle cx="540" cy="1778" r="6" fill="${accent}"/>
    </svg>`;
  };

  const openCertificate = (cert, student) => {
    const modal = U.modal({ title: 'Certificate Preview', wide: true, body: `<div class="certificate-modal-preview">${certificateSVG(cert, student)}</div>`, actions: [{ label: 'Close', cls: 'btn-ghost' }, { label: 'Download PNG', cls: 'btn-primary', icon: 'download', keepOpen: true, onClick: () => { downloadCertificate(cert, student); return false; } }] });
    return modal;
  };
  const downloadCertificate = async (cert, student) => {
    let logo = 'assets/academy-logo.png';
    try { const r = await fetch('assets/academy-logo.png'); const buf = await r.arrayBuffer(); let binary = ''; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); logo = 'data:image/png;base64,' + btoa(binary); } catch (e) {}
    const source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(certificateSVG(cert, student, logo));
    const image = new Image(); image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `abdelmajid-cp-${cert.type}-${cert.id}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 800); }, 'image/png'); }; image.src = source;
  };

  const nextCourseSpaceCardHTML = (course, index, student) => {
    const learn = (Array.isArray(course.learn) ? course.learn : []).filter(Boolean);
    const period = course.period || course.dates || course.date || 'Schedule to be announced';
    const duration = course.duration || course.hours || 'Duration to be announced';
    const savedRequest = student && typeof Store.nextCourseRequestFor === 'function' ? Store.nextCourseRequestFor(student.id, course.id, course.level) : null;
    return `<section class="course-launch-card next-course-space-ad card reveal in" id="next-course-ad-${index}">
      <div class="course-launch-copy">
        <span class="course-kicker"><i class="dot"></i>${U.esc(course.level || 'NEXT LEVEL')} · ${U.esc(course.status || 'NEXT LEVEL')}</span>
        <h2>${U.esc(course.title || 'Your next course starts here.')}</h2>
        <p>${U.esc(course.description || '')}</p>
        <div class="course-facts"><span>${ic('calendar')}${U.esc(period)}</span><span>${ic('clock')}${U.esc(duration)}</span><span class="course-age-fact">${ic('users')}${U.esc(course.age || 'Age to be announced')}</span></div>
        ${publishedCourseScheduleHTML(course)}
        ${publishedAvailabilityHTML(course.availability || course.weeklyAvailability || course.schedule || {})}
        ${studentAvailabilityPickerHTML('next-' + index, savedRequest ? savedRequest.availability : null)}
        <div class="course-actions"><button class="btn btn-primary btn-sm" type="button" data-next-interest="${index}">${ic('star')}${savedRequest ? 'Update my availability' : 'I’m interested'}</button><a class="btn btn-ghost btn-sm" href="#/join#ask">Ask the coach</a></div>
      </div>
      <div class="course-launch-side" aria-label="Next course highlights">
        ${(learn[0] ? `<span class="course-topic-float topic-cpp">${U.esc(learn[0])}</span>` : '')}
        ${(learn[1] ? `<span class="course-topic-float topic-problem">${U.esc(learn[1])}</span>` : '')}
        ${(learn[2] ? `<span class="course-topic-float topic-cv">${U.esc(learn[2])}</span>` : '')}
        <div class="course-no-experience-side">${U.esc(course.experience || 'No experience needed.')}</div>
        <div class="course-hours-mark"><span>${U.esc(String(duration).replace(/[^0-9]/g, '') || '16')}</span><small>HOURS</small></div>
        <div class="course-level-label">${U.esc(course.level || 'NEXT')}</div>
      </div>
    </section>`;
  };

  /* ============================================================ HOME */
  PV.home = (root) => {
    const st = Store.academyStats();
    const top = Store.leaderboard().slice(0, 3);
    const latest = Store.contests().slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const sb = Store.settings();
    const copy = academyCopy(sb);
    const course = sb.course || { level: 'LEVEL 1', status: 'COMING SOON', title: '16 hours to start coding with confidence.', description: 'Learn C++, problem solving and upgrade your CV to another level.', age: 'Ages 13–17', period: 'Late August', duration: '16 hours', experience: 'No experience needed.', learn: ['C++', 'Problem solving', 'CV upgrade'] };
    const learn = (Array.isArray(course.learn) ? course.learn : []).filter(Boolean);

    root.innerHTML = `
    <div class="container page">
      <section class="hero">
        <div>
          <span class="hero-eyebrow"><i class="dot"></i>${T('heroEyebrow', 'COMPETITIVE PROGRAMMING TRAINING · FOR THE NEXT GENERATION')}</span>
          <h1>${T('heroTitleA', 'Build confidence.')}<br><span class="grad">${T('heroTitleB', 'Think like a competitor.')}</span></h1>
          <p class="lead">${U.esc(copy.tagline)}</p>
          <div class="hero-ctas">
            <a class="btn btn-primary" href="#/join">${ic('userPlus')}${T('heroPrimary', 'Start your journey')}</a>
          </div>
          <div class="hero-mini">
            <span><b>${sb.levels.length}</b>&nbsp;${T('statsLevels', 'levels')}</span><span>·</span>
            <span><b>${sb.topics.length}</b>&nbsp;${T('statsTopics', 'topics')}</span><span>·</span>
            <span><b>${st.catalogSize}</b>&nbsp;${T('statsAchievements', 'achievements')}</span><span>·</span>
            <span><b>${Store.problems().length}</b>&nbsp;${T('statsProblems', 'problems')}</span>
          </div>
        </div>
        ${heroCoachCard()}
      </section>

      <section class="course-launch-card card reveal" id="level-1-course">
        <div class="course-launch-copy">
          <span class="course-kicker"><i class="dot"></i>${U.esc(course.level)} · ${U.esc(course.status)}</span>
          <h2>${U.esc(course.title)}</h2>
          <p>${U.esc(course.description)}</p>
          <div class="course-facts">
            <span>${ic('calendar')}${U.esc(course.period)}</span>
            <span>${ic('clock')}${U.esc(course.duration)}</span>
            <span class="course-age-fact">${ic('users')}${U.esc(course.age)}</span>
          </div>
          ${publishedCourseScheduleHTML(course)}
          ${publishedAvailabilityHTML(course.availability)}
          <div class="course-actions">
            <a class="btn btn-ghost btn-sm" href="#/join#ask">${T('courseDetails', 'more details')}</a>
            <a class="btn btn-primary btn-sm" href="#/join#apply">${T('courseJoin', 'join now in 30 sec')}${ic('arrowRight')}</a>
          </div>
        </div>
        <div class="course-launch-side" aria-label="Course highlights">
          <span class="course-topic-float topic-cpp">${U.esc(learn[0] || 'C++')}</span>
          <span class="course-topic-float topic-problem">${U.esc(learn[1] || 'Problem solving')}</span>
          <span class="course-topic-float topic-cv">${U.esc(learn[2] || 'CV upgrade')}</span>
          <div class="course-no-experience-side">${U.esc(course.experience)}</div>
          <div class="course-hours-mark"><span>${U.esc(course.duration.replace(/[^0-9]/g, '') || '16')}</span><small>HOURS</small></div>
          <div class="course-level-label">${U.esc(course.level)}</div>
        </div>
      </section>

      <section class="stats-row">
        ${C.statTile({ icon: 'users', label: 'Students', count: st.students })}
        ${C.statTile({ icon: 'target', label: 'Problems Solved', count: st.solved, delay: 'reveal-d1' })}
        ${C.statTile({ icon: 'trophy', label: 'Contests Completed', count: st.contests, delay: 'reveal-d2' })}
        ${C.statTile({ icon: 'medal', label: 'Achievements Earned', count: st.achievements, delay: 'reveal-d3' })}
      </section>

      <div class="section-head reveal"><div><h2>${ic('star')}${T('featuredTitle', 'Featured Students')}</h2><div class="sub">${T('featuredSub', 'Progress worth celebrating')}</div></div>
        <a class="link-accent" href="#/leaderboard">Full ranking ${ic('arrowRight')}</a></div>
      <section class="grid grid-3" id="home-featured">
        ${top.length ? top.map((e, i) => C.studentCard(e, i + 1)).join('') : C.empty({ icon: 'users', title: 'No students yet', text: 'Once the coach adds students, the stars of the academy will shine here.', action: '<a class="btn btn-ghost btn-sm" href="#/admin">Open admin panel</a>' })}
      </section>

      <div class="section-head reveal"><div><h2>${ic('trend')}${T('recentTitle', 'Recent Activity')}</h2><div class="sub">${T('recentSub', 'Latest solves, contests and milestones across the academy')}</div></div></div>
      <section class="grid grid-2">
        <div class="card">${C.timelineHTML(Store.activity(), 8)}</div>
        <div class="card" id="home-hof">
          ${latest ? hofPreview(latest) : C.empty({ icon: 'trophy', title: 'No contests yet', text: 'The Hall of Fame is waiting for its first podium.' })}
        </div>
      </section>

      <div class="section-head reveal"><div><h2>${ic('shield')}${T('ladderTitle', 'The Ranking Ladder')}</h2><div class="sub">${T('ladderSub', 'Climb from Newcomer to Legend — every point counts')}</div></div>
        <a class="link-accent" href="#/leaderboard">See who is on top ${ic('arrowRight')}</a></div>
      <section class="ladder reveal">
        ${sb.levels.map((l, i) => `<div class="ladder-step" style="--lc:${l.color}"><b>${U.esc(l.name)}</b><span>${U.fmtNum(l.minScore)}+ pts${l.minTopics ? ' · ' + l.minTopics + ' topics' : ''}</span></div>`).join('')}
      </section>
    </div>`;

    function heroCoachCard() {
      const co = sb.coach || {};
      const ach = Store.coachAchievements();
      return `<div class="hero-coach-card card reveal">
        <div class="hero-coach-top"><span class="hero-coach-label"><i class="dot"></i>${T('coachEyebrow', 'MEET THE COACH')}</span><span class="hero-coach-code">coach@acp</span></div>
        <div class="hero-coach-main">${U.avatarHTML({ name: co.name || 'Coach Abdelmajid', photo: co.photo || null }, 'avatar-96')}<div><h2>${U.esc(co.name || 'Coach Abdelmajid')}</h2><span>${U.esc(co.title || 'Founder & Head Coach')}</span><p>${U.esc(co.bio || '')}</p></div></div>
        <div class="hero-coach-ach">${ach.slice(0, 4).map((a) => `<span class="chip">${C.achIcon(a)}${U.esc(a.name)}</span>`).join('')}</div>
      </div>`;
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
        ${e.length === 3 ? C.podiumHTML(e, 'pts', false) : ''}
        <div style="margin-top:16px;text-align:center"><a class="btn btn-ghost btn-sm" href="#/contests">${ic('trophy')}All contests</a></div>`;
    }
  };

  /* ============================================================ JOIN + ASK */
  PV.join = (root, focus) => {
    const S = Store.settings();
    const copy = academyCopy(S);
    const location = S.course || {};
    root.innerHTML = `
    <div class="container page join-page">
      <div class="page-head reveal in">
        <h1>${ic('userPlus')}Join the Academy</h1>
        <p>One form, 30 seconds, a real seat on the leaderboard. The coach reviews every application personally — and answers every question.</p>
      </div>

      ${(location.locationName || location.locationAddress || location.locationDescription) ? `<section class="course-location-card card reveal in">
        <div class="course-location-icon">${ic('layers')}</div>
        <div><span class="section-kicker">COURSE LOCATION</span><h2>${U.esc(location.locationName || 'Course center')}</h2>${location.locationAddress ? `<p class="location-address">${U.esc(location.locationAddress)}</p>` : ''}${location.locationDescription ? `<p class="muted tiny">${U.esc(location.locationDescription)}</p>` : ''}</div>
        ${location.locationMapUrl ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${U.safeURL(location.locationMapUrl)}">${ic('external')}Open map</a>` : ''}
      </section>` : ''}

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
            ${availabilityPickerHTML('join')}
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

    wireAvailabilityPicker(root, 'join');
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
        if (formId === 'join-form' && !Object.keys(data.availability || {}).length) return U.toast('Select at least one weekly availability range', 'error');
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
        availability: readAvailability(root, 'join'),
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

    if (focus === 'ask' || focus === 'apply') {
      setTimeout(() => {
        const target = U.$('#' + focus, root);
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  /* ============================================================ STUDENTS */
  /* ======================================================= SUBMIT (auto-verify) */
  /* ================================================================ SUBMIT */
  // Shared by the standalone #/submit page and the My Space "Submit a Solve" tab.
  // When a passport session exists (p), students skip typing their code entirely.
  function submitBlockHTML(p) {
    const cloud = Store.cloudEnabled && Store.cloudEnabled();
    return `
    <section class="grid grid-2 join-grid">
      <div class="card join-pitch reveal in">
        <div class="jp-badge vf-badge">${ic('shield')}</div>
        <h3>How it works</h3>
        <ol class="jp-steps">
          <li><b>1.</b> Get your <b>secret code</b> from the coach (one per student — keep it private 🤐)</li>
          <li><b>2.</b> Solve the problem on <b>codeforces.com</b> with <b>your own username</b> — verdict must be <span class="chip">Accepted</span></li>
          <li><b>3.</b> Come back here and paste the problem link</li>
          <li><b>4.</b> Our server double-checks with Codeforces and awards the points instantly ⚡</li>
        </ol>
        <ul class="jp-list" style="margin-top:16px">
          <li>${ic('check')}Only <b>your own</b> accepted submissions count</li>
          <li>${ic('check')}Each submission can be counted only once</li>
          <li>${ic('lock')}Wrong codes are locked after repeated attempts</li>
          <li>${ic('zap')}Unlocked <b>hints</b> lower the points a problem can earn</li>
        </ul>
      </div>
      <div class="card reveal in">
        <div class="card-title">${ic('zap')}Verify my solve</div>
        ${cloud ? '' : `<div class="vf-offline">${ic('warn')}<span>Auto-verify needs a connection to the academy cloud and is temporarily offline. Try again later, or ask the coach to record your solve manually.</span></div>`}
        <form id="verify-form" style="margin-top:14px">
          ${p
            ? `<div class="vf-signed">${ic('user')}<span>Signed in as <b>${U.esc(p.name)}</b> — no code needed.</span></div>`
            : `<label class="field"><span>Your secret code *</span>
                <input class="input mono vf-code" id="vf-code" maxlength="12" placeholder="e.g. K7X2-QM91" autocomplete="off" spellcheck="false">
              </label>`}
          <label class="field"><span>Problem link or ID *</span>
            <input class="input mono" id="vf-problem" maxlength="120" placeholder="https://codeforces.com/problemset/problem/1234/A  — or just  1234A">
          </label>
          <input type="text" id="vf-web" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="vf-result hidden" id="vf-result"></div>
          <button class="btn btn-primary btn-block" type="submit" id="vf-btn" ${cloud ? '' : 'disabled'}>${ic('check')}Verify &amp; record my solve</button>
        </form>
        <p class="muted tiny" style="margin-top:12px">${ic('info')}Only problems from the academy library are counted. Solved something else? Tell the coach — they might add it!</p>
      </div>
    </section>`;
  }

  function wireVerifyForm(root, p) {
    const cloud = Store.cloudEnabled && Store.cloudEnabled();
    const form = U.$('#verify-form', root);
    if (!form || !cloud) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (U.$('#vf-web', root).value) { form.reset(); return; } // honeypot — silently drop bots
      const box = U.$('#vf-result', root), btn = U.$('#vf-btn', root);
      const show = (ok, html) => { box.className = 'vf-result ' + (ok ? 'vf-ok' : 'vf-err'); box.innerHTML = html; };
      const codeEl = U.$('#vf-code', root);
      const code = codeEl ? codeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() : '';
      const raw = U.$('#vf-problem', root).value.trim();
      if (!p && code.length < 6) return show(false, `${ic('warn')}<span>Enter your secret code (ask the coach if you lost it).</span>`);
      const cf = U.parseCFLink(raw);
      if (!cf) return show(false, `${ic('warn')}<span>That does not look like a Codeforces problem. Paste the full link or an ID like <b>1234A</b>.</span>`);
      btn.disabled = true; btn.classList.add('is-loading');
      const r = await Store.cfClaim(code, raw, p && p.token);
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
        'no-session': 'Your session expired — sign in again with your secret code.',
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
  }

  PV.submit = (root) => {
    const p = Store.passport && Store.passport();
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in">
        <h1>${ic('zap')}Submit a Solve</h1>
        <p>Problems submitted here are <b>verified automatically</b> against the real Codeforces${'&trade;'} servers — no screenshots, no manual checking, no cheating.${p ? '' : ' <a class="link-accent" href="#/space">Signed-in students can submit from My Space →</a>'}</p>
      </div>
      ${submitBlockHTML(p)}
    </div>`;
    wireVerifyForm(root, p);
  };

  /* ======================================================= STUDENT MODE */
  // Shared gate: content only renders after a server-verified secret code.
  C.passportGate = (root, html) => {
    const p = Store.passport && Store.passport();
    if (p) return html(p);
    const cloud = Store.cloudEnabled && Store.cloudEnabled();
    return `
    <div class="container page">
      <div class="passport-card card reveal in">
        <div class="jp-badge vf-badge" style="margin:0 auto 14px">${ic('lock')}</div>
        <h2 style="text-align:center">Student Mode</h2>
        <p class="muted" style="text-align:center;margin:8px 0 18px">Enter your <b>secret code</b> (the one the coach gave you) to unlock your personal space: submit solves, send buggy code for review, buy hints and read your AI coach.</p>
        ${cloud ? `
        <div class="passport-form">
          <input class="input mono vf-code" id="pp-code" maxlength="12" placeholder="K7X2-QM91" autocomplete="off" spellcheck="false">
          <button class="btn btn-primary" id="pp-go">${ic('zap')}Unlock my space</button>
        </div>
        <div class="me-err" id="pp-err" style="display:none;justify-content:center;margin-top:12px"></div>` : `
        <div class="vf-offline" style="margin-top:16px">${ic('warn')}<span>Student mode needs the academy cloud, which is offline right now. Try again later.</span></div>`}
      </div>
    </div>`;
  };
  C.wirePassportGate = (root, done) => {
    const go = U.$('#pp-go', root);
    if (!go) return;
    const inp = U.$('#pp-code', root), err = U.$('#pp-err', root);
    go.onclick = async () => {
      const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
      if (code.length < 6) { err.textContent = 'Enter your secret code.'; err.style.display = 'flex'; return; }
      go.disabled = true;
      const r = await Store.passportLogin(code);
      go.disabled = false;
      if (!r.ok) {
        const m = { 'bad-code': 'Wrong code — check for typos or ask the coach.', locked: 'Too many tries — this code is locked for a while.' };
        err.textContent = m[r.data && r.data.error] || 'Could not verify the code right now. Try again in a moment.';
        err.style.display = 'flex';
        return;
      }
      try { sessionStorage.setItem('acp_me', JSON.stringify({ id: r.data.studentId, name: r.data.studentName })); } catch (e) {}
      U.toast(`Welcome back, ${r.data.studentName.split(' ')[0]}! 🔓`, 'success', 'zap');
      if (U.confetti) U.confetti();
      done(r.data);
    };
    inp && inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
  };

  /* ======================================================= MY SPACE (passport) */
  PV.space = (root) => {
    root.innerHTML = C.passportGate(root, spaceHTML);
    if (!Store.passport()) { C.wirePassportGate(root, () => PV.space(root)); return; }
    wireSpace(root, Store.passport());
  };

  function spaceHTML(p) {
    const st = Store.student(p.id);
    const messages = Store.messagesFor(p.id);
    if (!st) return `<div class="container page"><div class="card reveal in"><p class="muted">Your record was removed — ask the coach.</p></div></div>`;
    return `
    <div class="container page">
      <div class="page-head reveal in" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        ${U.avatarHTML(st, 'avatar-56')}
        <div style="flex:1"><h1>${ic('user')}My Space</h1><p>Welcome, <b>${U.esc(st.name)}</b> — your solves, your coach answers, your next missions.</p></div>
        <div class="space-profile-actions"><input type="file" id="sp-photo" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" class="hidden"><button class="btn btn-ghost btn-sm" id="sp-photo-btn" type="button">${ic('upload')}Change photo</button><button class="btn btn-ghost btn-sm" id="sp-forget" type="button">${ic('logout')}Forget me</button></div>
      </div>
      ${messages.length ? `<section class="space-message-stack" aria-label="Coach messages">${messages.map((m) => `<article class="space-important-message"><div class="space-message-icon">${ic('message')}</div><div><span class="message-kicker">IMPORTANT · COACH MESSAGE</span><h3>${U.esc(m.title)}</h3><p>${U.esc(m.body)}</p><small>${m.endDate ? 'Available until ' + U.fmtDate(m.endDate) : 'From your coach'}</small></div></article>`).join('')}</section>` : ''}
      <div class="lb-tabs reveal in" style="margin-bottom:16px" id="sp-tabs">
        <button class="btn btn-sm btn-primary" data-t="coach">${ic('zap')}My AI Coach</button>
        <button class="btn btn-sm btn-ghost" data-t="certificates">${ic('award')}My Certificates</button>
        <button class="btn btn-sm btn-ghost" data-t="score">${ic('trend')}Score Improvement</button>
        <button class="btn btn-sm btn-ghost" data-t="submit">${ic('check')}Submit a Solve</button>
        <button class="btn btn-sm btn-ghost" data-t="clinic">${ic('code')}Code Clinic</button>
      </div>
      <div id="sp-body"></div>
    </div>`;
  }

  function wireSpace(root, p) {
    const me = () => Store.student(p.id);
    const photoBtn = U.$('#sp-photo-btn', root), photoInput = U.$('#sp-photo', root);
    if (photoBtn && photoInput) {
      photoBtn.onclick = () => photoInput.click();
      photoInput.onchange = async () => {
        try {
          const photo = await U.fileToAvatar(photoInput.files[0]);
          photoBtn.disabled = true;
          const r = await Store.updateStudentPhoto(photo);
          photoBtn.disabled = false;
          if (!r.ok) return U.toast(r.data && r.data.message || 'Photo could not be saved. Ask the coach.', 'error');
          U.toast('Your photo was updated', 'success', 'check');
          PV.space(root);
        } catch (e) { U.toast(e.message, 'error'); }
      };
    }
    U.$('#sp-forget', root).onclick = () => { Store.passportLogout(); U.toast('You are signed out of student mode', 'info'); location.hash = '#/'; };
    const body = U.$('#sp-body', root);
    const renderCoach = () => {
      const s = me(); if (!s) return;
      const solves = Store.solvesOf(s.id);
      const lvl = Store.levelOf(s.id);
      const score = Store.score(s.id);
      const since28 = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
      const recent = solves.filter((x) => x.date >= since28);
      const weeklyRate = recent.length / 4;
      const recentPts = recent.reduce((a, x) => a + (x.pts != null ? x.pts : x.problem.score || 0), 0);
      const avgPts = recent.length ? recentPts / recent.length : 25;
      let pace;
      if (lvl.next && score < lvl.next.minScore) {
        if (weeklyRate >= 0.5) {
          const weeks = Math.ceil((lvl.next.minScore - score) / (weeklyRate * avgPts));
          const when = new Date(Date.now() + weeks * 7 * 864e5);
          pace = { txt: `~${weeks} week${weeks === 1 ? '' : 's'}`, when: U.fmtDate(when.toISOString().slice(0, 10)), level: lvl.next.name };
        } else pace = { txt: '—', when: null, level: lvl.next.name };
      } else pace = null;
      const mine = new Set(solves.map((x) => x.problem.id));
      const mastery = Store.mastery(s.id);
      const todoTopics = new Set(mastery.filter((m) => !m.done).map((m) => m.name));
      const diffOrder = ['easy', 'medium', 'hard'];
      const counts = Store.solvedByDiff(s.id);
      const nextDiff = counts.easy < 10 ? 'easy' : counts.medium < 8 ? 'medium' : 'hard';
      const recs = Store.problems().filter((pp) => !mine.has(pp.id))
        .sort((a, b) => (todoTopics.has(b.topic) - todoTopics.has(a.topic)) || (diffOrder.indexOf(a.difficulty) - diffOrder.indexOf(b.difficulty)) || (a.score - b.score));
      const top = recs.filter((pp) => pp.difficulty === nextDiff).slice(0, 3);
      const recList = (top.length ? top : recs.slice(0, 3));
      const nextCourses = Store.nextCourseAdsFor(s.id);
      const nextCourseChoices = nextCourses.length ? `<div class="next-course-choice-bar"><span>${ic('star')}Next courses for you</span>${nextCourses.map((course, i) => `<button type="button" class="next-course-choice ${i === 0 ? 'active' : ''}" data-next-choice="${i}">${U.esc(course.level || ('Option ' + (i + 1)))}</button>`).join('')}</div><div id="next-course-panel">${nextCourseSpaceCardHTML(nextCourses[0], 0, s)}</div>` : '';
      body.innerHTML = `
        <div class="grid grid-2">
          <div class="card reveal in">
            <div class="card-title">${ic('trend')}Pace Predictor</div>
            <div class="pace-big">${pace ? pace.txt : '—'}</div>
            ${pace ? (pace.when
              ? `<p class="muted tiny">At your current rhythm (<b>${weeklyRate.toFixed(1)} solves/week</b>), you reach <b class="grad">${U.esc(pace.level)}</b> around <b>${pace.when}</b>.</p>`
              : `<p class="muted tiny">Solve at least 2 problems this week and I can forecast your climb to <b>${U.esc(pace.level)}</b>.</p>`)
            : `<p class="muted tiny">You've reached the top of the ladder — legend territory. 👑</p>`}
            <div class="pace-stats">
              <div><b>${recent.length}</b><span>solved · last 28d</span></div>
              <div><b>${weeklyRate.toFixed(1)}</b><span>per week</span></div>
              <div><b>${U.fmtNum(score)}</b><span>your score</span></div>
            </div>
          </div>
          <div class="card reveal in">
            <div class="card-title">${ic('target')}Recommended for you</div>
            <p class="muted tiny" style="margin:6px 0 10px">Hand-picked from the library: topics you haven't mastered, in your growth zone (<b>${nextDiff}</b>).</p>
            ${recList.length ? recList.map((pp) => `
              <div class="rec-row">
                <a class="link-accent" href="${U.safeURL(pp.link)}" target="_blank" rel="noopener">${U.esc(pp.name)} ${ic('external')}</a>
                <span class="chip">${U.esc(pp.topic)}</span>${C.diffTag(pp.difficulty)}<span class="chip" style="color:var(--gold)">+${pp.score}</span>
              </div>`).join('') : '<p class="muted tiny">Library cleared 😳 — ask the coach for more problems!</p>'}
          </div>
        </div>
        ${nextCourseChoices}
      `;
      const wireNextCourse = (scope, course, index) => {
        const interest = U.$('[data-next-interest="' + index + '"]', scope);
        if (!interest) return;
        wireStudentAvailabilityPicker(scope, 'next-' + index);
        const picker = U.$('[data-student-av-picker="next-' + index + '"]', scope);
        if (picker) {
          picker.onchange = () => { picker.dataset.availabilityDirty = '1'; };
          picker.onclick = (event) => { if (event.target.closest('[data-student-av-add], [data-student-av-remove]')) picker.dataset.availabilityDirty = '1'; };
        }
        if (Store.getNextCourseAvailability) Store.getNextCourseAvailability(s.id, course).then((r) => {
          if (r && r.ok && r.availability && picker && picker.dataset.availabilityDirty !== '1') applyStudentAvailability(scope, 'next-' + index, r.availability);
        }).catch(() => {});
        interest.onclick = async () => {
          const availability = readStudentAvailability(scope);
          if (!Object.keys(availability).length) return U.toast('Select at least one weekly availability range', 'error');
          interest.disabled = true;
          const r = Store.saveNextCourseAvailability ? await Store.saveNextCourseAvailability(s.id, course, availability) : await Store.addNextCourseRequest(s.id, availability);
          interest.disabled = false;
          if (!r.ok) return U.toast('Could not save your availability right now.', 'error');
          interest.textContent = r.duplicate ? 'Already saved' : 'Availability saved ✓';
          U.toast(r.duplicate ? 'Your availability is already with the coach.' : 'Your availability was sent to the coach.', 'success', 'star');
        };
      };
      if (nextCourses.length) {
        const panel = U.$('#next-course-panel', body);
        wireNextCourse(panel, nextCourses[0], 0);
        U.$$('[data-next-choice]', body).forEach((button) => button.onclick = () => {
          const index = Number(button.dataset.nextChoice);
          U.$$('[data-next-choice]', body).forEach((x) => x.classList.toggle('active', x === button));
          panel.innerHTML = nextCourseSpaceCardHTML(nextCourses[index], index, s);
          wireNextCourse(panel, nextCourses[index], index);
        });
      }
    };
    const renderCertificates = () => {
      const s = me(); if (!s) return;
      const certificates = Store.certificatesOf(s.id);
      body.innerHTML = `<div class="certificates-head"><div><div class="card-title">${ic('award')}My Certificates</div><p class="muted tiny">Achievement cards you can open, download and share.</p></div><span class="chip">${certificates.length} earned</span></div>
        ${certificates.length ? `<div class="certificate-grid">${certificates.map((cert) => `<article class="certificate-card certificate-${cert.tier}" style="--cert-accent:${U.esc(certAccent(cert))}"><div class="certificate-card-accent"></div><div class="certificate-card-top"><span class="certificate-tier">${U.esc(cert.tier)}</span><span class="certificate-type">${U.esc(cert.type)}</span></div><div class="certificate-mini-medal">${ic(cert.type === 'problem' ? 'target' : cert.type === 'season' ? 'crown' : cert.type === 'level' ? 'award' : 'trophy')}</div><h3>${U.esc(cert.title)}</h3><p>${U.esc(cert.detail || cert.subtitle || '')}</p><small>${U.fmtDate(cert.date)}</small><button class="btn btn-primary btn-sm" data-certificate="${U.esc(cert.id)}">${ic('eye')}Open certificate</button></article>`).join('')}</div>` : '<div class="card certificate-empty"><div class="certificate-empty-icon">✦</div><h3>Your first certificate is waiting.</h3><p>Solve a certificate problem or finish on a contest podium.</p></div>'}`;
      U.$$('[data-certificate]', body).forEach((button) => button.onclick = () => { const cert = certificates.find((x) => x.id === button.dataset.certificate); if (cert) openCertificate(cert, s); });
    };
    const renderScore = () => {
      const s = me(); if (!s) return;
      const events = Store.scoreEventsOf(s.id);
      const active = Store.activeSeason();
      const included = active && Store.seasonMembers(active).some((m) => m.id === s.id);
      const eventRows = events.length ? events.slice(0, 40).map((e) => `
        <div class="score-event-row ${e.points < 0 ? 'score-event-negative' : ''}">
          <span class="score-event-icon">${ic(e.icon || 'trend')}</span>
          <div class="score-event-copy"><b>${U.esc(e.label)}</b><small>${U.esc(e.detail || '')} · ${U.fmtDate(e.date)}</small></div>
          <strong>${e.points > 0 ? '+' : ''}${U.fmtNum(e.points)}</strong>
        </div>`).join('') : '<div class="score-empty">No score changes yet. Your first solve will appear here.</div>';
      body.innerHTML = `
        <div class="score-summary-grid">
          <div class="card score-summary-card">
            <div class="card-title">${ic('trend')}Your score</div>
            <div class="score-total">${U.fmtNum(Store.score(s.id))}</div>
            <p class="muted tiny">Every solve, contest, bonus and coach adjustment is explained below.</p>
            <div class="score-summary-meta"><span><b>${events.length}</b> score events</span><span><b>${Store.solvedCount(s.id)}</b> problems solved</span></div>
          </div>
          ${active && included ? `<div class="card score-season-card"><div class="card-title">${ic('flame')}${U.esc(active.name)}</div><div class="score-total season-total">${U.fmtNum(Store.seasonScore(s.id, active))}</div><p class="muted tiny">Season score only · original score stays ${U.fmtNum(Store.score(s.id))}</p></div>` : `<div class="card score-season-card score-season-empty"><div class="card-title">${ic('flame')}Season score</div><p class="muted tiny">You are not included in a live season right now.</p></div>`}
        </div>
        <div class="card score-ledger-card" style="margin-top:16px"><div class="card-title">${ic('trend')}Score Improvement</div><p class="muted tiny" style="margin:5px 0 12px">A clear record of why your score changed.</p><div class="score-ledger">${eventRows}</div></div>`;
    };
    const renderClinic = async () => {
      body.innerHTML = '<p class="muted tiny">Loading your cases…</p>';
      const S = Store.settings();
      const r = await Store.clinicMine();
      const cases = (r.ok && r.data && r.data.cases) || [];
      const week = cases.filter((c) => Date.parse(c.created_at) > Date.now() - 7 * 864e5).length;
      body.innerHTML = `
        <div class="grid grid-2">
          <div class="card reveal in">
            <div class="card-title">${ic('code')}Send buggy code</div>
            <p class="muted tiny" style="margin:6px 0 12px">Stuck? Paste your broken code and the coach answers here${S.clinicWeeklyLimit ? ` — <b>${S.clinicWeeklyLimit} case${S.clinicWeeklyLimit === 1 ? '' : 's'}/week</b> (used ${week})` : ''}.</p>
            <form id="cl-form">
              <label class="field"><span>Problem link <span class="muted tiny">(optional)</span></span><input class="input mono" id="cl-link" maxlength="120" placeholder="https://codeforces.com/problemset/problem/1234/A"></label>
              <label class="field"><span>What goes wrong?</span>
                <select class="select" id="cl-symptom">
                  <option value="wa">Wrong Answer</option><option value="tle">Time Limit</option><option value="re">Runtime Error / Crash</option><option value="other">Something else</option>
                </select></label>
              <label class="field"><span>Your code *</span><textarea class="input mono" id="cl-code" rows="8" maxlength="12000" placeholder="#include <bits/stdc++.h> …"></textarea></label>
              <label class="field"><span>Your question <span class="muted tiny">(optional)</span></span><textarea class="input" id="cl-note" rows="2" maxlength="600" placeholder="Test 3 fails and I don't know why…"></textarea></label>
              <div class="me-err" id="cl-err" style="display:none"></div>
              <button class="btn btn-primary btn-block" type="submit">${ic('arrowRight')}Send to the coach</button>
            </form>
          </div>
          <div class="card reveal in">
            <div class="card-title">${ic('message')}My cases <span class="chip" style="margin-left:auto">${cases.length}</span></div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
            ${cases.length ? cases.map((c) => `
              <div class="cl-case ${c.status === 'answered' ? 'cl-answered' : ''}">
                <div class="jr-head"><b>${({ wa: 'Wrong Answer', tle: 'Time Limit', re: 'Runtime Error', other: 'Question' })[c.symptom] || 'Case'}</b>
                  <span class="chip">${c.status === 'answered' ? '✅ Coach answered' : '⏳ waiting'}</span>
                  <span class="muted tiny">${U.timeAgo(c.created_at)}</span></div>
                ${c.problem_link ? `<a class="link-accent mono tiny" href="${U.safeURL(c.problem_link)}" target="_blank" rel="noopener">${U.esc(c.problem_link)}</a>` : ''}
                ${c.note ? `<div class="muted tiny" style="margin-top:4px">${U.esc(c.note)}</div>` : ''}
                ${c.coach_reply ? `<div class="cl-reply">${ic('grad')}<div><b>Coach:</b><br>${U.esc(c.coach_reply)}</div></div>` : ''}
              </div>`).join('') : '<p class="muted tiny">No cases yet — send your first buggy code from the left!</p>'}
            </div>
          </div>
        </div>`;
      U.$('#cl-form', body).addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = U.$('#cl-err', body);
        const payload = { problemLink: U.$('#cl-link', body).value.trim(), symptom: U.$('#cl-symptom', body).value, code: U.$('#cl-code', body).value, note: U.$('#cl-note', body).value.trim() };
        if (payload.code.trim().length < 10) { err.textContent = 'Paste your code first (at least a few lines).'; err.style.display = 'flex'; return; }
        const r = await Store.clinicSend(payload);
        if (!r.ok) { err.textContent = (r.data && r.data.message) || 'Could not send — try again in a moment.'; err.style.display = 'flex'; return; }
        U.toast('Sent! The coach will answer right here.', 'success', 'check');
        renderClinic();
      });
    };
    const renderSubmit = () => {
      body.innerHTML = submitBlockHTML(p);
      wireVerifyForm(body, p);
    };
    U.$('#sp-tabs', root).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]'); if (!b) return;
      U.$$('button', U.$('#sp-tabs', root)).forEach((x) => x.className = 'btn btn-sm btn-ghost');
      b.className = 'btn btn-sm btn-primary';
      ({ coach: renderCoach, certificates: renderCertificates, score: renderScore, submit: renderSubmit, clinic: renderClinic }[b.dataset.t] || renderCoach)();
    });
    renderCoach();
  }

  /* ======================================================= SEASONS + CHAMPIONS */
  PV.seasons = (root) => {
    const seasons = Store.seasons().slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    const active = Store.activeSeason();
    const past = seasons.filter((s) => s.champions);
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('flame')}Seasons</h1><p>Sprint competitions — fresh start, new champion every season. The all-time leaderboard stays untouched.</p></div>
      ${active ? `
      <div class="card reveal in">
        <div class="card-title">${ic('zap')}${U.esc(active.name)} <span class="chip" style="margin-left:auto">live now</span></div>
        <div class="muted tiny" style="margin:4px 0 12px">${U.fmtDate(active.start)} → ${active.end ? U.fmtDate(active.end) : '…'}</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>Student</th><th>Season points</th></tr></thead>
          <tbody>${Store.seasonStandings(active).map((e) => `
            <tr data-nav="#/student/${e.s.id}" style="cursor:pointer">
              <td class="rank-cell ${e.rank <= 3 ? 'r' + e.rank : ''}">${e.rank}</td>
              <td><div style="display:flex;align-items:center;gap:10px">${U.avatarHTML(e.s, 'avatar-36')}<b>${U.esc(e.s.name)}</b></div></td>
              <td class="num" style="color:var(--gold)">${U.fmtNum(e.points)}</td></tr>`).join('')}
          </tbody></table></div>
      </div>` : `<div class="card reveal in" style="text-align:center;padding:28px">${ic('flame')}<p class="muted">No season is running right now — the next one is being prepared. Warm up! 🔥</p></div>`}
      <div class="section-head reveal" style="margin-top:26px"><div><h2>${ic('crown')}Champions Wall</h2><div class="sub">Top 2 of every finished season — forever remembered</div></div></div>
      ${past.length ? `<div class="grid grid-3">${past.map((s) => `
        <div class="card reveal season-card">
          <div class="crown-row">${ic('crown')}</div>
          <h3 style="text-align:center">${U.esc(s.name)}</h3>
          <div class="muted tiny" style="text-align:center;margin-bottom:10px">${U.fmtDate(s.start)} → ${U.fmtDate(s.end || '')}</div>
          ${s.champions.slice(0, 2).map((c) => { const student = Store.student(c.studentId); const rank = 1 + s.champions.filter((x) => Number(x.points) > Number(c.points)).length; return `
            <div class="champ-row r${rank}">
              <span class="champ-medal">${['🥇', '🥈', '🥉'][rank - 1] || '🏅'}</span>
              ${U.avatarHTML(student || { name: c.name }, 'avatar-36')}<b>${U.esc(c.name)}</b><span class="chip" style="margin-left:auto;color:var(--gold)">${U.fmtNum(c.points)} pts</span>
            </div>`; }).join('')}
        </div>`).join('')}</div>` : `<div class="card reveal in"><p class="muted" style="text-align:center">The wall is empty — the first season champion takes the first stone. 🏆</p></div>`}
    </div>`;
  };

  /* ============================================================ CHAMPION WALL */
  PV.champions = (root) => {
    const finished = Store.seasons().filter((s) => Array.isArray(s.champions) && s.champions.length)
      .slice().sort((a, b) => (b.end || b.start || '').localeCompare(a.end || a.start || ''));
    const resolveChampion = (entry) => {
      const student = Store.student(entry.studentId);
      return { name: student ? student.name : (entry.name || '—'), student, points: Number(entry.points) || 0 };
    };
    const allChampions = finished.flatMap((s) => s.champions.slice(0, 2).map(resolveChampion));
    const latest = finished[0];
    root.innerHTML = `
    <div class="container page champions-page">
      <div class="page-head reveal in">
        <span class="section-kicker"><i class="dot"></i>SEASONS · CHAMPIONS</span>
        <h1>${ic('crown')}Champion Wall</h1>
        <p>Every finished season leaves its top 2 on the wall. Their places are frozen here forever.</p>
      </div>
      <section class="champions-intro card reveal in">
        <div>
          <span class="champions-intro-label">THE WALL</span>
          <h2>${finished.length ? 'Names worth remembering.' : 'The first stone is waiting.'}</h2>
          <p>${finished.length ? `${finished.length} finished season${finished.length === 1 ? '' : 's'} · ${allChampions.length} podium place${allChampions.length === 1 ? '' : 's'} recorded.` : 'The first Top 2 champions will be remembered here.'}</p>
        </div>
        <div class="champions-intro-mark"><span>${finished.length ? finished.length : '—'}</span><small>SEASONS</small></div>
      </section>
      ${finished.length ? `<section class="champions-grid">
        ${finished.map((season, si) => `
          <article class="champion-season-card card reveal" style="--season-delay:${si * .06}s">
            <div class="champion-season-head">
              <div><span class="champion-season-kicker">SEASON ${finished.length - si}</span><h3>${U.esc(season.name || 'Season')}</h3></div>
              <span class="champion-season-date">${U.fmtDate(season.start)} → ${U.fmtDate(season.end || '')}</span>
            </div>
            <div class="champion-podium-list">
              ${season.champions.slice(0, 2).map((raw) => {
                const c = resolveChampion(raw);
                const rank = 1 + season.champions.filter((x) => Number(x.points) > c.points).length;
                const row = `<div class="champion-wall-row rank-${rank}">
                  <span class="champion-medal">${['🥇', '🥈', '🥉'][rank - 1] || '🏅'}</span>
                  ${c.student ? U.avatarHTML(c.student, 'avatar-44') : U.avatarHTML({ name: c.name }, 'avatar-44')}
                  ${c.student ? `<a href="#/student/${c.student.id}" class="champion-name">${U.esc(c.name)}</a>` : `<b class="champion-name">${U.esc(c.name)}</b>`}
                  <span class="champion-points">${U.fmtNum(c.points)} pts</span>
                </div>`;
                return row;
              }).join('')}
            </div>
          </article>`).join('')}
      </section>` : `<div class="champions-empty card reveal in"><div class="champions-empty-mark">${ic('crown')}</div><h2>No champions yet</h2><p>The wall is ready for its first Top 2.</p></div>`}
      ${latest ? `<div class="champions-note reveal"><span>${ic('trophy')}</span><p>Latest season champion: <b>${U.esc(resolveChampion(latest.champions[0]).name)}</b></p></div>` : ''}
    </div>`;
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
    const activeSeason = Store.activeSeason();
    const seasonIncluded = activeSeason && Store.seasonMembers(activeSeason).some((m) => m.id === id);
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
        ${seasonIncluded ? C.statTile({ icon: 'crown', label: 'Season Score', value: Store.seasonScore(id, activeSeason) }) : ''}
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
      return `<div class="card hoverable reveal" style="cursor:pointer" data-nav="#/group/${g.id}">
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
            ${lb.map((e) => `<tr style="cursor:pointer" data-nav="#/student/${e.s.id}">
              <td class="rank-cell ${e.rank <= 3 ? 'r' + e.rank : ''}">${e.rank}</td>
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
      const top3 = lb.filter((e) => e.rank <= 3).map((e) => ({ name: e.s.name, value: e.score, rank: e.rank, avatarHTML: U.avatarHTML(e.s, 'avatar-56') }));
      body.innerHTML = `
        ${top3.length ? `<div class="card reveal in" style="padding-top:26px">${C.podiumHTML(top3, 'pts')}</div>` : ''}
        <div class="card reveal in" style="margin-top:18px">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Rank</th><th>Student</th><th>Level</th><th>Group</th><th>Solved</th><th>Score</th></tr></thead>
            <tbody>
              ${lb.map((e) => {
        const g = Store.group(e.s.groupId);
        return `<tr style="cursor:pointer" data-nav="#/student/${e.s.id}">
                <td class="rank-cell ${e.rank <= 3 ? 'r' + e.rank : ''}">${e.rank}</td>
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
    /* ── "My solves" identity (server-verified secret code, session only) ── */
    const ME_KEY = 'acp_me';
    let me = null;
    const passport = Store.passport && Store.passport();
    if (passport) me = { id: passport.id, name: passport.name };
    else { try { me = JSON.parse(sessionStorage.getItem(ME_KEY) || 'null'); } catch (e) { me = null; } }
    let myHints = {}, hintsAvail = {}, hintsCuts = {};
    const loadMyHints = async () => {
      if (!Store.cloudEnabled || !Store.cloudEnabled() || !Store.hintsMine) return;
      // token is optional for hint-status: counts + prices are public, texts need sign-in
      const r = await Store.hintsMine();
      if (r.ok && r.data) { myHints = r.data.hints || {}; hintsAvail = r.data.available || {}; hintsCuts = r.data.cuts || {}; }
    };
    let meSolved = new Set();
    const refreshSolved = () => {
      const st = me && Store.student(me.id);
      meSolved = new Set(st ? (st.solves || []).map((sv) => sv.problemId) : []);
    };
    refreshSolved();

    const topics = Store.topics().map((t) => t.name);
    root.innerHTML = `
    <div class="container page">
      <div class="page-head reveal in"><h1>${ic('target')}Problem Library</h1><p>Curated problems assigned to academy groups. Difficulty defines score and topic XP.</p></div>
      <div class="card reveal in me-bar" id="me-bar" style="display:none"></div>
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
          <tr${meSolved.has(p.id) ? ' class="row-solved"' : ''}>
            <td><a class="link-accent" href="${U.safeURL(p.link)}" target="_blank" rel="noopener">${U.esc(p.name)} ${ic('external')}</a>${meSolved.has(p.id) ? ' <span class="solved-badge">✓ Solved</span>' : ''}${hintStrip(p)}</td>
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

    const renderMeBar = () => {
      const bar = U.$('#me-bar', root);
      const cloud = Store.cloudEnabled && Store.cloudEnabled();
      if (!cloud) { bar.style.display = 'none'; return; } // identity needs the academy cloud
      bar.style.display = '';
      if (me) {
        const st = Store.student(me.id);
        bar.innerHTML = `
          <div class="me-who-row">
            ${U.avatarHTML({ name: me.name, photo: st ? st.photo : null }, 'avatar-36')}
            <span class="me-hi">Hi, <b>${U.esc(me.name)}</b>!</span>
            <span class="solved-badge">✓ ${meSolved.size} solved here</span>
            <a class="link-accent" href="#/student/${me.id}">My profile</a>
            <button class="btn btn-ghost btn-sm" id="me-forget" style="margin-left:auto">${ic('logout')}Not you? Forget</button>
          </div>`;
        U.$('#me-forget', bar).onclick = () => {
          Store.passportLogout(); me = null; myHints = {}; hintsAvail = {};
          refreshSolved(); renderMeBar(); render();
        };
      } else {
        bar.innerHTML = `
          <div class="me-form-row">
            <span class="me-label">${ic('key')}<span>Enter your <b>secret code</b> to highlight what you already solved:</span></span>
            <input class="input mono" id="me-code" maxlength="12" placeholder="K7X2-QM91" autocomplete="off" spellcheck="false">
            <button class="btn btn-primary btn-sm" id="me-go">${ic('check')}Show my solves</button>
          </div>
          <div class="me-err" id="me-err" style="display:none"></div>`;
        const go = U.$('#me-go', bar), inp = U.$('#me-code', bar), err = U.$('#me-err', bar);
        const fail = (txt) => { err.textContent = txt; err.style.display = 'flex'; };
        go.onclick = async () => {
          const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
          if (code.length < 6) return fail('Enter the secret code your coach gave you.');
          go.disabled = true; go.classList.add('is-loading'); err.style.display = 'none';
          const r = await Store.passportLogin(code);
          go.disabled = false; go.classList.remove('is-loading');
          if (r.ok) {
            me = { id: r.data.studentId, name: r.data.studentName };
            try { sessionStorage.setItem(ME_KEY, JSON.stringify(me)); } catch (e) {}
            refreshSolved(); renderMeBar();
            loadMyHints().then(render); render();
            U.toast(`Welcome back, ${me.name.split(' ')[0]}! Your solved problems are marked ✓`, 'success', 'check');
            if (U.confetti) U.confetti();
          } else {
            const m = { 'bad-code': 'Wrong code — check for typos or ask the coach.', 'locked': 'Too many tries — this code is locked for a while.', 'offline': 'This feature is not active yet — the coach needs to finish the setup.' };
            fail(m[r.data && r.data.error] || 'Could not verify the code right now. Try again in a moment.');
          }
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
      }
    };

    // hint strip under a problem name — locks are visible to everyone (text lives on the
    // server and is only ever returned for the signed-in student who unlocked it)
    const hintStrip = (p) => {
      if (meSolved.has(p.id) || !hintsAvail[p.id]) return '';
      const S = Store.settings();
      const cuts = S.hintCuts || [10, 15, 20];
      const bits = [];
      for (let i = 0; i < hintsAvail[p.id]; i++) {
        if (myHints[p.id] && myHints[p.id][i] != null) bits.push(`<span class="hint-open">${ic('zap')}<b>Hint ${i + 1}:</b> ${U.esc(myHints[p.id][i])}</span>`);
        else {
          const cut = (hintsCuts[p.id] && hintsCuts[p.id][i] != null) ? hintsCuts[p.id][i] : cuts[i];
          const title = me ? 'Unlocking this hint lowers the points this problem can earn you' : 'Sign in with your secret code to unlock hints';
          bits.push(`<button class="hint-lock${me ? '' : ' hint-lock-out'}" data-hint="${p.id}|${i}" title="${title}">${ic('lock')}Hint ${i + 1} <span class="hint-cost">−${cut} pts</span></button>`);
        }
      }
      return bits.length ? `<div class="hint-line">${bits.join('')}</div>` : '';
    };
    U.$('#problems-table', root).addEventListener('click', async (e) => {
      const b = e.target.closest('[data-hint]');
      if (!b) return;
      if (!Store.passport || !Store.passport()) {
        U.toast('Sign in with your secret code to unlock hints — use the bar at the top of this page, or My Space.', 'info', 'lock');
        const inp = U.$('#me-code', root);
        if (inp) { if (inp.scrollIntoView) inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus(); }
        return;
      }
      const [pid, idxS] = b.dataset.hint.split('|'); const idx = +idxS;
      const okGo = await U.confirm('Unlock this hint? If you later solve this problem, it earns fewer points (shown on the button). Hints never cost anything if you don\'t solve it.', { title: 'Spend score for a hint?', okLabel: 'Unlock hint' });
      if (!okGo) return;
      b.disabled = true;
      const r = await Store.hintUnlock(pid, idx);
      b.disabled = false;
      if (!r.ok) {
        const m = { 'no-session': 'Your session expired — enter your code again.', 'already-solved': 'You already solved this one 💪', 'no-hint': 'No hint here — try the next one.' };
        U.toast(m[r.data && r.data.error] || 'Could not unlock right now.', 'error');
        return;
      }
      myHints[pid] = myHints[pid] || {}; myHints[pid][idx] = r.data.text;
      U.toast(`Hint unlocked — this problem now earns ${r.data.earns} pts`, 'info', 'zap');
      render();
    });

    renderMeBar();
    loadMyHints().then(render);
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
            ${entries.length === 3 ? C.podiumHTML(entries, 'pts', false) : ''}
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
