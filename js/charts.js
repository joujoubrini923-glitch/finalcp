/* ============================================================
   Abdelmajid CP — charts.js
   Dependency-free SVG charts: line, bars, donut, radar + hbars.
   ============================================================ */
(function () {
  const C = {};
  let uidc = 0;

  const PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#22d3ee', '#e879f9'];
  C.palette = PALETTE;

  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  C.empty = (msg) => `<div class="chart-empty">${U.esc(msg || 'No data yet')}</div>`;

  /* ---------------- LINE CHART ----------------
     cfg: { series:[{name,color,points:[{t,y}]}], height, yFmt, fill }     */
  C.line = function (el, cfg) {
    if (!el) return;
    // drop invalid (NaN/undefined) points and coerce numeric values;
    // defence in depth: always draw forwards in time (never zigzag) and
    // collapse duplicate timestamps so no vertical stacks can appear
    const series = (cfg.series || [])
      .map((s) => ({
        name: s.name, color: s.color,
        points: (s.points || [])
          .filter((p) => isFinite(p.t) && isFinite(p.y))
          .map((p) => ({ t: +p.t, y: +p.y }))
          .sort((a, b) => a.t - b.t)
          .filter((p, i, arr) => i === arr.length - 1 || p.t !== arr[i + 1].t),
      }))
      .filter((s) => s.points.length);
    const W = 760, H = cfg.height || 260;
    const padL = 46, padR = 16, padT = 16, padB = 30;
    if (!series.length) { el.innerHTML = C.empty(); return; }

    let xmin = Infinity, xmax = -Infinity, ymin = 0, ymax = 0;
    series.forEach((s) => s.points.forEach((p) => {
      xmin = Math.min(xmin, p.t); xmax = Math.max(xmax, p.t);
      ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
    }));
    if (xmin === xmax) { xmin -= 86400000 * 15; xmax += 86400000 * 15; }
    if (ymax === ymin) ymax = ymin + 10;
    ymin = ymin < 0 ? Math.floor(ymin * 1.12) : 0;
    ymax = Math.max(ymin + 10, Math.ceil(ymax * 1.12));
    const yspan = ymax - ymin;
    const iw = W - padL - padR, ih = H - padT - padB;
    const X = (t) => padL + ((t - xmin) / (xmax - xmin)) * iw;
    const Y = (y) => padT + ih - ((y - ymin) / yspan) * ih;

    let g = '';
    // y grid + labels (5 ticks)
    for (let i = 0; i <= 4; i++) {
      const yv = ymin + (yspan / 4) * i, yy = Y(yv);
      g += `<line class="ch-grid" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/>`;
      g += `<text class="ch-axis" x="${padL - 8}" y="${yy + 3.5}" text-anchor="end">${U.fmtNum(Math.round(yv))}</text>`;
    }
    // x labels by time (max 6)
    const xticks = [];
    const spanMs = xmax - xmin;
    const count = Math.max(2, Math.min(6, series[0].points.length));
    for (let i = 0; i < count; i++) {
      const t = xmin + (spanMs * i) / (count - 1);
      xticks.push(t);
    }
    xticks.forEach((t) => {
      g += `<text class="ch-axis" x="${X(t)}" y="${H - 8}" text-anchor="middle">${U.fmtShort(t)}</text>`;
    });

    // series paths
    const dots = [];
    const paths = series.map((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = s.points;
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      let area = '';
      if (cfg.fill !== false && pts.length > 1 && series.length === 1) {
        const gid = 'grad' + (++uidc);
        area = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity=".28"/>
          <stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
          <path d="${d} L ${X(pts[pts.length - 1].t).toFixed(1)} ${Y(0)} L ${X(pts[0].t).toFixed(1)} ${Y(0)} Z" fill="url(#${gid})"/>`;
      }
      pts.forEach((p) => dots.push({ x: X(p.t), y: Y(p.y), p, color, name: s.name }));
      return area + `<path class="ch-line" d="${d}" stroke="${color}"/>`;
    }).join('');

    const firstDots = series.length === 1
      ? dots.map((d) => `<circle class="ch-dot" cx="${d.x}" cy="${d.y}" r="3.2" fill="${d.color}" stroke="${cssVar('--card', '#0e1526')}"/>`).join('')
      : series.map((s, si) => {
        const color = s.color || PALETTE[si % PALETTE.length];
        const last = s.points[s.points.length - 1];
        return `<circle class="ch-dot" cx="${X(last.t)}" cy="${Y(last.y)}" r="3.6" fill="${color}" stroke="${cssVar('--card', '#0e1526')}"/>`;
      }).join('');

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${g}${paths}${firstDots}
      <line class="ch-guide" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" style="opacity:0"/>
      <rect x="${padL}" y="${padT}" width="${iw}" height="${ih}" fill="transparent" class="ch-hover"/>
    </svg>`;

    // hover interaction
    const svg = el.querySelector('svg');
    const hover = el.querySelector('.ch-hover');
    const guide = el.querySelector('.ch-guide');
    hover.addEventListener('mousemove', (ev) => {
      const r = svg.getBoundingClientRect();
      const mx = ((ev.clientX - r.left) / r.width) * W;
      const tGuess = xmin + ((mx - padL) / iw) * (xmax - xmin);
      // nearest timestamp across series
      let best = null;
      series.forEach((s) => s.points.forEach((p) => {
        if (!best || Math.abs(p.t - tGuess) < Math.abs(best - tGuess)) best = p.t;
      }));
      if (best == null) return;
      guide.setAttribute('x1', X(best)); guide.setAttribute('x2', X(best));
      guide.style.opacity = 1;
      const rows = series.map((s, si) => {
        const pt = s.points.reduce((acc, p) => (Math.abs(p.t - best) < Math.abs(acc.t - best) ? p : acc), s.points[0]);
        const color = s.color || PALETTE[si % PALETTE.length];
        return `<div class="tt-row"><span><i class="dot" style="background:${color};display:inline-block"></i> ${U.esc(s.name || '')}</span><b>${(cfg.yFmt || U.fmtNum)(pt.y)}</b></div>`;
      }).join('');
      U.tooltip.show(`<div class="tt-title">${U.fmtDate(best)}</div>${rows}`, ev.clientX, ev.clientY);
    });
    hover.addEventListener('mouseleave', () => { guide.style.opacity = 0; U.tooltip.hide(); });
  };

  /* ---------------- VERTICAL BARS ----------------
     cfg: { items:[{label,value,color?,hint?}], height, yFmt }             */
  C.bars = function (el, cfg) {
    if (!el) return;
    const items = cfg.items || [];
    const W = 760, H = cfg.height || 250;
    const padL = 40, padR = 10, padT = 14, padB = 28;
    if (!items.length) { el.innerHTML = C.empty(); return; }
    const ymax = Math.max(1, ...items.map((i) => i.value)) * 1.15;
    const iw = W - padL - padR, ih = H - padT - padB;
    const bw = Math.min(64, (iw / items.length) * 0.62);
    const Y = (v) => padT + ih - (v / ymax) * ih;

    let g = '';
    for (let i = 0; i <= 4; i++) {
      const yv = (ymax / 4) * i, yy = Y(yv);
      g += `<line class="ch-grid" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/>`;
      g += `<text class="ch-axis" x="${padL - 8}" y="${yy + 3.5}" text-anchor="end">${U.fmtNum(Math.round(yv))}</text>`;
    }
    const defaultColor = cssVar('--accent', '#38bdf8');
    const bars = items.map((it, i) => {
      const cx = padL + (iw / items.length) * (i + 0.5);
      const y = Y(it.value), h = padT + ih - y;
      const color = it.color || defaultColor;
      return `<rect class="ch-bar" data-i="${i}" x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="6" fill="${color}" opacity="${it.value ? 0.92 : 0.3}"/>
        <text class="ch-axis" x="${cx}" y="${H - 8}" text-anchor="middle">${U.esc(it.label)}</text>`;
    }).join('');

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}${bars}</svg>`;
    el.querySelectorAll('.ch-bar').forEach((bar) => {
      bar.addEventListener('mousemove', (ev) => {
        const it = items[Number(bar.dataset.i)];
        U.tooltip.show(`<div class="tt-title">${U.esc(it.label)}</div><div class="tt-row"><span>${U.esc(it.hint || 'Value')}</span><b>${(cfg.yFmt || U.fmtNum)(it.value)}</b></div>`, ev.clientX, ev.clientY);
      });
      bar.addEventListener('mouseleave', () => U.tooltip.hide());
    });
  };

  /* ---------------- DONUT ----------------
     cfg: { segments:[{label,value,color}], size, centerTop, centerBottom }
     returns HTML string (svg + legend)                                     */
  C.donutHTML = function (cfg) {
    const segs = (cfg.segments || []).filter((s) => s.value > 0);
    const size = cfg.size || 170, stroke = cfg.stroke || 22;
    const R = (size - stroke) / 2 - 2, cx = size / 2, cy = size / 2;
    const total = segs.reduce((a, s) => a + s.value, 0);
    if (!total) return C.empty();
    const circ = 2 * Math.PI * R;
    let off = 0;
    const rings = segs.map((s) => {
      const frac = s.value / total;
      const len = frac * circ;
      const ring = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
        stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})" style="transition:stroke-dasharray 1s ease"/>`;
      off += len;
      return ring;
    }).join('');
    const legend = segs.map((s) => `<div class="dl-item"><i class="dot" style="background:${s.color}"></i>${U.esc(s.label)}<b>${s.value}</b></div>`).join('');
    return `<div class="donut-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="flex:none">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${cssVar('--border', '#1d2946')}" stroke-width="${stroke}"/>
        ${rings}
        <text x="${cx}" y="${cy - 3}" text-anchor="middle" style="font:800 ${size / 7}px var(--mono);fill:var(--text)">${cfg.centerTop != null ? cfg.centerTop : total}</text>
        <text x="${cx}" y="${cy + size / 8.5}" text-anchor="middle" style="font:600 ${size / 15}px var(--font);fill:var(--dim)">${U.esc(cfg.centerBottom || 'solved')}</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
  };

  /* ---------------- RADAR ----------------
     cfg: { axes:[labels], series:[{name,color,values:[0..1]}], size }      */
  C.radar = function (el, cfg) {
    if (!el) return;
    const axes = cfg.axes || [];
    const series = (cfg.series || []).filter((s) => s.values && s.values.length === axes.length);
    const size = cfg.size || 300;
    if (axes.length < 3 || !series.length) { el.innerHTML = C.empty('Select students to compare'); return; }
    const cx = size / 2, cy = size / 2, R = size / 2 - 44;
    const ang = (i) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];

    let g = '';
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      const pts = axes.map((_, i) => pt(i, f).map((n) => n.toFixed(1)).join(',')).join(' ');
      g += `<polygon points="${pts}" fill="none" stroke="${cssVar('--border', '#1d2946')}" stroke-width="1"/>`;
    });
    axes.forEach((a, i) => {
      const [x, y] = pt(i, 1);
      g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${cssVar('--border', '#1d2946')}"/>`;
      const [lx, ly] = pt(i, 1.22);
      const anchor = Math.abs(lx - cx) < 20 ? 'middle' : (lx > cx ? 'start' : 'end');
      g += `<text class="ch-axis" x="${lx}" y="${ly + 4}" text-anchor="${anchor}">${U.esc(a)}</text>`;
    });
    const polys = series.map((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = s.values.map((v, i) => pt(i, Math.min(1, v)).map((n) => n.toFixed(1)).join(',')).join(' ');
      const dots = s.values.map((v, i) => {
        const [x, y] = pt(i, Math.min(1, v));
        return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
      }).join('');
      return `<polygon points="${pts}" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="2"/>${dots}`;
    }).join('');

    el.innerHTML = `<div style="display:flex;justify-content:center"><svg viewBox="0 0 ${size} ${size}" style="max-width:${size}px">${g}${polys}</svg></div>`;
  };

  /* ---------------- HORIZONTAL BARS (HTML) ---------------- */
  C.hbarsHTML = function (items, opts) {
    opts = opts || {};
    if (!items.length) return C.empty();
    const max = Math.max(1, ...items.map((i) => i.value));
    return items.map((it, idx) => `
      <div class="hbar-row">
        <span class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(it.label)}</span>
        <span class="hbar"><i style="width:${Math.max(2, (it.value / max) * 100)}%;background:${it.color || `linear-gradient(90deg,${PALETTE[idx % PALETTE.length]},${PALETTE[(idx + 1) % PALETTE.length]})`}"></i></span>
        <span class="hbar-val">${(opts.fmt || U.fmtNum)(it.value)}</span>
      </div>`).join('');
  };

  window.Charts = C;
})();
