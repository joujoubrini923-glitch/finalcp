/* Abdelmajid CP — utils.js : dom, format, modal, toast, misc helpers */
(function () {
  const U = {};

  /* ---------- dom ---------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  /* Allowlist of URL schemes — anything else (javascript:, data:, vbscript:…) becomes '#'.
     Protects link hrefs even if a bad URL is pasted into a problem/contest record. */
  U.safeURL = (s) => {
    const str = String(s == null ? '' : s).trim();
    if (/^(https?:|mailto:)/i.test(str)) return U.esc(str);
    return '#';
  };
  // "contestId/index" (e.g. "1234/A") or a full codeforces.com link  →  { contestId, index } | null
  U.cfKey = (str) => (str ? String(str.contestId) + '/' + String(str.index).toUpperCase() : null);
  U.parseCFLink = (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    let m = s.match(/codeforces\.com\/(?:problemset\/problem|contest|gym)\/(\d+)(?:\/problem)?\/([A-Za-z]\w*)/i);
    if (m) return { contestId: Number(m[1]), index: m[2].toUpperCase() };
    m = s.match(/^(\d{1,7})\s*[/\s-]\s*([A-Za-z]\w*)$/) || s.match(/^(\d{1,7})([A-Za-z]\w*)$/);
    if (m) return { contestId: Number(m[1]), index: m[2].toUpperCase() };
    return null;
  };
  U.uid = (prefix) => (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- dates ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.today = () => new Date().toISOString().slice(0, 10);
  U.dateStr = (t) => new Date(t).toISOString().slice(0, 10);
  U.daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  U.fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(typeof d === 'string' && d.length === 10 ? d + 'T12:00:00' : d);
    if (isNaN(dt)) return String(d);
    return MONTHS[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
  };
  U.monthLabel = (t) => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2); };
  U.fmtShort = (t) => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate(); };
  U.timeAgo = (t) => {
    const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
    const mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo ago';
    return Math.floor(mo / 12) + 'y ago';
  };

  /* ---------- numbers ---------- */
  U.fmtNum = (n) => {
    n = Number(n) || 0;
    return n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(n));
  };
  U.countUp = (el, target, dur) => {
    if (!el) return;
    if (U.reducedMotion()) { el.textContent = U.fmtNum(target); return; }
    dur = dur || 950;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = U.fmtNum(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- passwords: PBKDF2 (WebCrypto), with legacy cyrb53 fallback ----------
     The OLD builds used a single round of cyrb53 (a 53-bit non-crypto hash) —
     trivially brute-forced. Password hashes are now stored as:
       pbkdf2$<iterations>$<saltHex>$<hashHex>
     and are NEVER sent to the cloud (store strips them before any push). */
  U.PBKDF2_ITER = 120000;

  U.randomHex = (bytes) => {
    const n = bytes || 16;
    try {
      const a = new Uint8Array(n);
      (window.crypto || crypto).getRandomValues(a);
      return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { // extremely old browser / test env without WebCrypto
      let s = '';
      for (let i = 0; i < n * 2; i++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
  };

  const hexOfBuf = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

  // PBKDF2-HMAC-SHA256 -> hex. Falls back to iterated cyrb53 on ancient
  // browsers without WebCrypto (still vastly better than one plain cyrb53).
  U.pbkdf2 = async (password, saltHex, iterations) => {
    const iter = iterations || U.PBKDF2_ITER;
    const subtle = (window.crypto && window.crypto.subtle) || (typeof crypto !== 'undefined' && crypto.subtle);
    if (subtle && subtle.deriveBits) {
      try {
        const key = await subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
        const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
        const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
        return 'pbkdf2$' + iter + '$' + saltHex + '$' + hexOfBuf(bits);
      } catch (e) { /* fall through to the JS fallback */ }
    }
    let h = 'salt:' + saltHex;
    for (let i = 0; i < Math.min(90000, iter); i++) h = U.hash(h + String(password));
    return 'xlite$' + saltHex + '$' + h;
  };

  U.hashPassword = (password, saltHex) => U.pbkdf2(password, saltHex || U.randomHex(16));

  /* ---------- legacy hash (kept ONLY to verify+migrate old databases) ---------- */
  U.hash = (str) => {
    // cyrb53 — NOT cryptographic, only local obfuscation for a client-side gate.
    let h1 = 0xdeadbeef ^ 0x7c9ab1f3, h2 = 0x41c6ce57 ^ 0x7c9ab1f3;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  };

  /* ---------- avatars ---------- */
  U.initials = (name) => {
    const parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };
  U.hueFor = (name) => {
    let h = 0;
    for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
    return h % 360;
  };
  U.avatarStyle = (name) => {
    const h = U.hueFor(name || '?');
    return `background:linear-gradient(135deg,hsl(${h},68%,46%),hsl(${(h + 45) % 360},72%,38%))`;
  };
  U.avatarHTML = (student, cls) => {
    cls = cls || 'avatar-44';
    if (student && student.photo) {
      return `<span class="avatar ${cls}" title="${U.esc(student.name)}"><img src="${student.photo}" alt="${U.esc(student.name)}"></span>`;
    }
    return `<span class="avatar ${cls}" style="${U.avatarStyle(student ? student.name : '?')}" title="${U.esc(student ? student.name : '')}">${U.initials(student ? student.name : '?')}</span>`;
  };

  /* ---------- files ---------- */
  U.download = (filename, text, mime) => {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  };
  U.readJSONFile = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { try { resolve(JSON.parse(r.result)); } catch (e) { reject(new Error('Invalid JSON file')); } };
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsText(file);
  });
  U.fileToAvatar = (file) => new Promise((resolve, reject) => {
    // whitelist: only real raster formats, max 8 MB input. The image is then
    // rasterized through a canvas (which strips any embedded code) and
    // re-encoded to a small JPEG before storage.
    const OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!file || OK.indexOf(file.type) === -1) return reject(new Error('Please choose a JPG, PNG, WebP or GIF image'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('Image is too large — please stay under 8 MB'));
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = r.result;
    };
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });

  /* ---------- toast ---------- */
  U.toast = (msg, type, iconName) => {
    type = type || 'info';
    const root = U.$('#toast-root');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const icon = iconName || (type === 'success' ? 'check' : type === 'error' ? 'warn' : type === 'gold' ? 'medal' : 'info');
    t.innerHTML = window.ic(icon) + `<span>${U.esc(msg)}</span>`;
    root.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3600);
  };

  U.confetti = (x, y) => {
    if (U.reducedMotion()) return;
    const colors = ['#38bdf8', '#a78bfa', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
    for (let i = 0; i < 26; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 130;
      d.style.left = (x != null ? x : window.innerWidth / 2) + 'px';
      d.style.top = (y != null ? y : window.innerHeight / 2) + 'px';
      d.style.background = colors[i % colors.length];
      d.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      d.style.setProperty('--dy', Math.sin(ang) * dist - 60 + 'px');
      d.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 1300);
    }
  };

  /* ---------- modal ---------- */
  U.modal = (opts) => {
    const root = U.$('#modal-root');
    root.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal' + (opts.wide ? ' wide' : '');
    modal.innerHTML = `
      <div class="modal-head"><h3>${U.esc(opts.title || '')}</h3>
        <button class="icon-btn m-close" aria-label="Close">${window.ic('x')}</button>
      </div>
      <div class="modal-body"></div>
      ${opts.actions && opts.actions.length ? '<div class="modal-foot"></div>' : ''}`;
    const body = U.$('.modal-body', modal);
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay && opts.dismissable !== false) close(); });
    U.$('.m-close', modal).onclick = close;

    if (opts.actions && opts.actions.length) {
      const foot = U.$('.modal-foot', modal);
      opts.actions.forEach((a) => {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.cls || 'btn-ghost');
        b.innerHTML = (a.icon ? window.ic(a.icon) : '') + U.esc(a.label);
        b.onclick = (ev) => {
          if (a.onClick) {
            const r = a.onClick(ev, body, close);
            if (r === false) return; // keep open
          }
          if (a.keepOpen !== true) close();
        };
        foot.appendChild(b);
      });
    }
    overlay.appendChild(modal);
    root.appendChild(overlay);
    if (opts.mount) opts.mount(body, close);
    return { close, body };
  };

  U.confirm = (opts) => new Promise((resolve) => {
    if (typeof opts === 'string') opts = { message: opts };
    let done = false;
    const { close } = U.modal({
      title: opts.title || 'Are you sure?',
      body: `<p class="muted" style="line-height:1.6">${opts.message || ''}</p>`,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost', onClick: () => { done = true; resolve(false); } },
        { label: opts.confirmLabel || 'Confirm', cls: opts.danger ? 'btn-danger' : 'btn-primary', icon: opts.danger ? 'trash' : 'check', onClick: () => { done = true; resolve(true); } },
      ],
    });
    // resolve(false) on dismiss
    const root = U.$('#modal-root');
    const mo = new MutationObserver(() => {
      if (root.childElementCount === 0 && !done) { done = true; resolve(false); mo.disconnect(); }
    });
    mo.observe(root, { childList: true });
  });

  /* ---------- tooltip ---------- */
  U.tooltip = {
    el: null,
    show(html, x, y) {
      if (!this.el) this.el = U.$('#tooltip');
      this.el.innerHTML = html;
      this.el.hidden = false;
      const pad = 14;
      const w = this.el.offsetWidth, h = this.el.offsetHeight;
      let L = x + pad, T = y - h - pad;
      if (L + w > window.innerWidth - 8) L = x - w - pad;
      if (T < 8) T = y + pad;
      this.el.style.left = L + 'px';
      this.el.style.top = T + 'px';
    },
    hide() { if (this.el) this.el.hidden = true; },
  };

  /* ---------- reveal on scroll ---------- */
  U.observeReveals = (root) => {
    if (U.reducedMotion() || typeof IntersectionObserver === 'undefined') { U.$$('.reveal', root).forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.08 });
    U.$$('.reveal', root).forEach((e) => io.observe(e));
  };

  window.U = U;
})();
