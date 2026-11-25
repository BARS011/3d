/* ==========================================================================
   Form3D — shared UI (navigation, theme, icons, toasts, reveals)
   ========================================================================== */
(function (global) {
  'use strict';

  const ICONS = {
    cube:'<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
    box:'<path d="M3 7 12 3l9 4v10l-9 4-9-4V7Z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    wand:'<path d="m15 4 5 5L9 20H4v-5L15 4Z"/><path d="m14 7 3 3M5 3v3M3 5h3M19 14v3M17.5 15.5h3"/>',
    download:'<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/>',
    upload:'<path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    shield:'<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    arrow:'<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h6a3 3 0 0 0 3-3 6 6 0 0 0-9-6Z"/><circle cx="7.5" cy="11" r=".8"/><circle cx="10" cy="7" r=".8"/><circle cx="15" cy="7.5" r=".8"/>',
    sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    spark:'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    rotate:'<path d="M20 11a8 8 0 1 0-2.3 6.6M20 5v6h-6"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff:'<path d="M3 3l18 18M10.6 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.5M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9S14.5 18.5 12 21c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z"/>',
    camera:'<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    move:'<path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/>',
    resize:'<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>',
    play:'<path d="m8 5 11 7-11 7V5Z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    refresh:'<path d="M20 11a8 8 0 1 0-2.3 6.6M20 5v6h-6"/>',
    crop:'<path d="M6 2v16h16M2 6h16v16"/>'
  };

  function icon(name, extra) {
    return '<svg class="ico ' + (extra || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function injectSprite() {
    if (document.getElementById('form3d-icons')) return;
    const body = Object.keys(ICONS).map(k => '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONS[k] + '</symbol>').join('');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'form3d-icons';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = body;
    document.body.insertBefore(svg, document.body.firstChild);
  }

  const NAV = [
    ['home', 'index.html', 'Bosh sahifa'],
    ['3d', '3d.html', '3D studiya'],
    ['2d', '2d.html', '2D studiya'],
    ['guide', 'how-it-works.html', 'Qanday ishlaydi'],
    ['features', 'features.html', 'Imkoniyatlar'],
    ['faq', 'faq.html', 'Savollar']
  ];

  function injectHeader() {
    const host = document.getElementById('site-header');
    if (!host) return;
    const active = document.body.dataset.page || '';
    const links = NAV.map(([id, href, label]) =>
      '<a href="' + href + '"' + (id === active ? ' class="active" aria-current="page"' : '') + '>' + label + '</a>'
    ).join('');
    host.innerHTML =
      '<header class="site-header"><div class="container header-inner">' +
        '<a class="brand" href="index.html" aria-label="Form3D bosh sahifa">' +
          '<span class="brand-mark">' + icon('cube') + '</span>' +
          '<span>Form<span class="grad-text">3D</span></span>' +
        '</a>' +
        '<nav class="nav" id="nav" aria-label="Asosiy menyu">' + links + '</nav>' +
        '<div class="header-actions">' +
          '<button class="icon-btn" id="themeBtn" aria-label="Rang rejimini almashtirish" title="Rang rejimi">' + icon('moon') + '</button>' +
          '<a href="3d.html" class="btn sm">' + icon('spark') + ' Boshlash</a>' +
          '<button class="icon-btn nav-toggle" id="navToggle" aria-label="Menyuni ochish" aria-expanded="false">' + icon('menu') + '</button>' +
        '</div>' +
      '</div></header>';

    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = icon(open ? 'close' : 'menu');
    });
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        document.body.classList.remove('nav-open');
      }
    });
  }

  function injectFooter() {
    const host = document.getElementById('site-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="site-footer"><div class="container">' +
        '<div class="footer-grid">' +
          '<div class="footer-about">' +
            '<a class="brand" href="index.html"><span class="brand-mark">' + icon('cube') + '</span><span>Form<span class="grad-text">3D</span></span></a>' +
            '<p>Rasmlaringizni brauzeringizda professional 3D va 2D modellarga aylantiring. Yuklash, hisob yoki cheklov yo‘q.</p>' +
          '</div>' +
          '<div><h4>Mahsulot</h4>' +
            '<a href="3d.html">3D studiya</a><a href="2d.html">2D studiya</a>' +
            '<a href="features.html">Imkoniyatlar</a><a href="how-it-works.html">Qanday ishlaydi</a>' +
          '</div>' +
          '<div><h4>Yordam</h4>' +
            '<a href="faq.html">Ko‘p so‘raladigan savollar</a><a href="how-it-works.html#maslahatlar">Maslahatlar</a>' +
            '<a href="faq.html#aloqa">Aloqa</a><a href="features.html#formatlar">Formatlar</a>' +
          '</div>' +
          '<div><h4>Chiqarish formatlari</h4>' +
            '<a href="features.html#formatlar">GLB · OBJ · STL</a><a href="features.html#formatlar">PNG · WebP · SVG</a>' +
            '<a href="features.html">ZIP arxivi</a><a href="3d.html">Web uchun 2D render</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom"><span>© 2026 Form3D. Barcha huquqlar himoyalangan.</span>' +
          '<span>Faqat o‘zingizga tegishli rasmlarni yuklang. Maxfiylik — bizning ustuvorligimiz.</span></div>' +
      '</div></footer>';
  }

  function initTheme() {
    const saved = localStorage.getItem('f3-theme');
    if (saved) document.documentElement.dataset.theme = saved;
    const btn = document.getElementById('themeBtn');
    const sync = () => {
      if (!btn) return;
      const dark = document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      btn.innerHTML = icon(dark ? 'sun' : 'moon');
      btn.title = dark ? 'Yorug‘ rejim' : 'Qorong‘u rejim';
    };
    if (btn) btn.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      const next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('f3-theme', next);
      sync();
      global.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    });
    sync();
  }

  function initReveals() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: .12 });
    els.forEach(e => io.observe(e));
  }

  function initStats() {
    document.querySelectorAll('[data-count]').forEach(el => {
      const goal = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      let started = false;
      const run = () => {
        if (started) return; started = true;
        const t0 = performance.now(), dur = 1100;
        const frame = t => {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = (goal < 10 ? goal.toFixed(1) : Math.round(goal * e)) + (p === 1 ? suffix : '');
          if (p < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { run(); io.disconnect(); } });
        io.observe(el);
      } else run();
    });
  }

  /* ---------- animated page transitions ---------- */
  function initTransitions() {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay = document.createElement('div');
    overlay.className = 'page-transition';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="pt-inner">' +
      '<span class="pt-mark">' + icon('cube') + '</span>' +
      '<b>Form3D</b><i class="pt-bar"></i></div>';
    document.body.appendChild(overlay);

    if (reduced) {
      overlay.style.display = 'none';
      return;
    }
    // fallback for background tabs where CSS animations can be paused
    setTimeout(() => document.body.classList.add('entered'), 520);

    const go = href => {
      if (document.body.classList.contains('leaving')) return;
      document.body.classList.remove('entered');
      document.body.classList.add('leaving');
      setTimeout(() => { location.href = href; }, 360);
    };
    global.Form3DNavigate = reduced ? (href => { location.href = href; }) : go;

    document.addEventListener('click', e => {
      const link = e.target.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      let url;
      try { url = new URL(link.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      const samePage = url.pathname === location.pathname;
      if (samePage && (url.hash || url.search === location.search)) return;
      e.preventDefault();
      go(url.href);
    });
  }

  function toast(message, type) {
    let host = document.querySelector('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.innerHTML = icon(type === 'err' ? 'info' : type === 'ok' ? 'check' : 'spark') + '<span></span>';
    t.querySelector('span').textContent = message;
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 250); }, 4200);
  }

  async function saveBlob(name, blob) {
    try {
      const d = global.claude && await global.claude.use('downloads');
      if (d) { await d.save({ filename: name, data: blob }); return true; }
    } catch (e) { if (e && e.code === 'declined') return false; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    return true;
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Faqat rasm fayllari qabul qilinadi')); return; }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => resolve({ img, url, name: file.name || 'image', size: file.size || 0 });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasmni o‘qib bo‘lmadi: ' + file.name)); };
      img.src = url;
    });
  }

  function canUseAI() {
    return new Promise(resolve => {
      try {
        if (!global.claude || !global.claude.use) return resolve(false);
        Promise.race([
          global.claude.use('sample').then(s => !!s),
          new Promise(r => setTimeout(() => r(false), 1200))
        ]).then(resolve).catch(() => resolve(false));
      } catch (e) { resolve(false); }
    });
  }

  function init() {
    injectSprite();
    injectHeader();
    injectFooter();
    initTheme();
    initReveals();
    initStats();
    initTransitions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.Form3D = { icon, toast, saveBlob, fileToImage, canUseAI };
})(window);
