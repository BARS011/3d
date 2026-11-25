/* ==========================================================================
   Form3D — 3D Studio controller
   Multi-image input, relief / AI generation, live adjustments, exports.
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const T = () => global.Form3D.toast;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let renderer, scene, camera, controls, pivot, helpers;
  let model = null, items = [], composite = null, lastStats = null;
  let working = false, wire = false, aiOK = false, rebuildTimer = null, autoTimer = null;
  let sceneW = 2.4, sceneH = 2.4, sceneD = 1, ready = false, primaryIndex = 0, manualPrimary = false;

  function setStatus(text) { const el = $('#et'); if (el) el.textContent = text; }

  function engineError(msg) {
    ready = false;
    $('#empty').classList.remove('hide');
    $('#busy').classList.add('hide');
    setStatus(msg);
    $('#go').disabled = true;
    T()(msg, 'err');
  }

  function progress(text, pct) {
    const b = $('#busy');
    if (b) b.classList.remove('hide');
    const t = $('#bt'), i = $('#bi');
    if (t) t.textContent = text;
    if (i) i.style.width = pct + '%';
  }

  function initThree() {
    const stage = $('#stage');
    if (!stage || !global.THREE) { engineError('3D dvigatel yuklanmadi. Sahifani yangilab ko‘ring.'); return false; }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      engineError('Brauzeringizda WebGL ishlamayapti. Sozlamalarda apparat tezlatishni yoqing yoki boshqa brauzer sinang.');
      return false;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'gl';
    stage.insertBefore(renderer.domElement, stage.firstChild);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    camera.position.set(0, 0.35, 5.4);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6b88, 0.9));
    [[4, 5, 6, 0.95], [-5, -2, -4, 0.6], [-4, 4, 3, 0.4], [0, -5, 2, 0.25]].forEach(([x, y, z, i]) => {
      const l = new THREE.DirectionalLight(0xffffff, i); l.position.set(x, y, z); scene.add(l);
    });

    pivot = new THREE.Group(); scene.add(pivot);
    helpers = new THREE.Group(); scene.add(helpers);
    const grid = new THREE.GridHelper(8, 20, 0x8b7bff, 0x8b7bff);
    grid.material.opacity = 0.16; grid.material.transparent = true;
    grid.position.y = -1.6; grid.visible = false;
    helpers.add(grid);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 1.2, maxDistance: 24, autoRotate: true, autoRotateSpeed: 2.2 });
    controls.addEventListener('start', () => { controls.autoRotate = false; syncTool('ar', false); });

    const resize = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    if (global.ResizeObserver) new ResizeObserver(resize).observe(stage);
    global.addEventListener('resize', resize);
    resize();

    (function loop() {
      requestAnimationFrame(loop);
      if (controls) controls.update();
      if (renderer && scene && camera) renderer.render(scene, camera);
    })();
    return true;
  }

  function disposeObject(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  function frameModel() {
    if (!model) return;
    const box = new THREE.Box3().setFromObject(pivot);
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    sceneW = Math.max(size.x, 0.4); sceneH = Math.max(size.y, 0.4); sceneD = Math.max(size.z, 0.2);
    const radius = Math.max(size.x, size.y, size.z) / 2 || 1;
    const dist = clamp(radius / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.55, 2, 18);
    controls.target.copy(center);
    camera.position.set(center.x + dist * 0.16, center.y + dist * 0.13, center.z + dist);
    camera.near = Math.max(0.01, dist / 100); camera.far = dist * 100;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function applyWire() {
    if (!model) return;
    model.traverse(o => { if (o.material) o.material.wireframe = wire; });
    syncTool('wf', wire);
  }

  function setModel(mesh, stats) {
    if (!pivot || !controls) throw new Error('3D ko‘rinish tayyor emas. Sahifani yangilang.');
    if (model) { pivot.remove(model); disposeObject(model); }
    model = mesh; lastStats = stats || null;
    pivot.add(model);
    wire = false; applyWire();
    controls.autoRotate = true; syncTool('ar', true);
    applyTransform(); frameModel();
    $('#empty').classList.add('hide');
    const tb = $('.toolbar'); if (tb) tb.style.display = 'flex';
    const hint = $('#hint'); if (hint) hint.style.display = 'block';
    const badge = $('#badge');
    if (badge) badge.textContent = stats
      ? (stats.views ? 'AI 4 tomon · ' : stats.full360 ? 'AI 360° · ' : '') + stats.width + '×' + stats.height + ' px · ' + stats.triangles.toLocaleString('uz') + ' uchburchak · fon ' + Math.round((stats.removed || 0) * 100) + '% olib tashlandi'
      : (mesh.name === 'ai-model' ? 'AI model · to‘liq 360°' : 'AI model');
    setStatus(stats
      ? 'Model tayyor: ' + stats.width + '×' + stats.height + ' px · ' + stats.triangles.toLocaleString('uz') + ' uchburchak. Uni aylantirib, kenglik va qalinlikni sozlang.'
      : 'Model tayyor. Uni aylantirib va sozlang.');
    ['#dlZip', '#dlPng', '#dlWeb', '#to2d'].forEach(s => { if ($(s)) $(s).disabled = false; });
  }

  function applyTransform() {
    if (!pivot) return;
    const w = +$('#scW').value / 100, h = +$('#scH').value / 100, d = +$('#scD').value / 100;
    pivot.scale.set(w, h, d);
    pivot.rotation.set((+$('#rotX').value) * Math.PI / 180, (+$('#rotY').value) * Math.PI / 180, (+$('#rotZ').value) * Math.PI / 180);
    $('#oScW').textContent = Math.round(+$('#scW').value) + '%';
    $('#oScH').textContent = Math.round(+$('#scH').value) + '%';
    $('#oScD').textContent = Math.round(+$('#scD').value) + '%';
    $('#oRotX').textContent = $('#rotX').value + '°';
    $('#oRotY').textContent = $('#rotY').value + '°';
    $('#oRotZ').textContent = $('#rotZ').value + '°';
  }

  /* ---------- multi-image compositing ---------- */
  // The most detailed, most centred subject becomes the front face. Other
  // uploaded photos become the real back/side views in AI 4 tomon mode.
  function pickPrimary() {
    if (items.length === 1) return 0;
    let best = 0, bestScore = -Infinity;
    items.forEach((it, i) => {
      let s = Math.max(it.img.naturalWidth, it.img.naturalHeight) / 1000;
      try { s = global.Form3DRelief.scoreImage(it.img); } catch (e) {}
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  }

  function makeComposite() {
    if (!items.length) return null;
    const layout = document.querySelector('input[name=layout]:checked').value;
    if (layout === 'auto' || layout === 'first') {
      if (layout === 'auto') { if (!manualPrimary) primaryIndex = pickPrimary(); }
      else primaryIndex = 0;
      return copyCanvas(items[primaryIndex].img);
    }
    primaryIndex = 0;

    const maxDim = Math.max(...items.map(i => Math.max(i.img.naturalWidth, i.img.naturalHeight)));
    let W, H;
    if (layout === 'overlay') {
      W = Math.max(...items.map(i => i.img.naturalWidth));
      H = Math.max(...items.map(i => i.img.naturalHeight));
    } else if (layout === 'row') {
      W = items.reduce((s, i) => s + i.img.naturalWidth, 0);
      H = Math.max(...items.map(i => i.img.naturalHeight));
    } else {
      const cols = Math.ceil(Math.sqrt(items.length));
      const cell = maxDim * 1.06;
      W = cols * cell; H = Math.ceil(items.length / cols) * cell;
    }
    const cap = 2600, k = Math.min(1, cap / Math.max(W, H));
    W = Math.max(8, Math.round(W * k)); H = Math.max(8, Math.round(H * k));

    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';

    if (layout === 'overlay') {
      items.forEach(it => {
        const s = Math.min(1, cap / Math.max(it.img.naturalWidth, it.img.naturalHeight));
        const w = it.img.naturalWidth * s, h = it.img.naturalHeight * s;
        x.drawImage(it.img, (W - w) / 2, (H - h) / 2, w, h);
      });
    } else if (layout === 'row') {
      const widths = items.map(it => {
        const s = Math.min(1, cap / Math.max(it.img.naturalWidth, it.img.naturalHeight));
        return it.img.naturalWidth * s;
      });
      const total = widths.reduce((a, b) => a + b, 0);
      let cx = (W - total) / 2;
      items.forEach((it, i) => {
        const s = widths[i] / it.img.naturalWidth;
        const w = widths[i], h = it.img.naturalHeight * s;
        x.drawImage(it.img, cx, (H - h) / 2, w, h);
        cx += w;
      });
    } else {
      const cols = Math.ceil(Math.sqrt(items.length));
      const cellW = W / cols, cellH = H / Math.ceil(items.length / cols);
      items.forEach((it, i) => {
        const s = Math.min(cellW / it.img.naturalWidth, cellH / it.img.naturalHeight) * 0.94;
        const w = it.img.naturalWidth * s, h = it.img.naturalHeight * s;
        const ox = (i % cols) * cellW, oy = Math.floor(i / cols) * cellH;
        x.drawImage(it.img, ox + (cellW - w) / 2, oy + (cellH - h) / 2, w, h);
      });
    }
    return c;
  }

  function copyCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }

  // Transparent cut-outs of the remaining photos, in upload order.
  function extraViews(limit) {
    return items.map((it, i) => ({ it, i }))
      .filter(o => o.i !== primaryIndex)
      .slice(0, limit)
      .map(o => {
        try {
          return global.Form3DRelief.cutout(o.it.img, {
            bgTol: +$('#bgTol').value,
            isolate: Math.min(+$('#iso').value, 62),
            res: 460
          });
        } catch (e) { return null; }
      })
      .filter(Boolean);
  }

  function fitView(src, W, H, darken) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    const k = Math.min(W / src.width, H / src.height) * 0.96;
    const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
    const ox = (W - w) / 2, oy = (H - h) / 2;
    x.drawImage(src, ox, oy, w, h);
    if (darken) { x.fillStyle = 'rgba(14,11,32,' + darken + ')'; x.fillRect(ox, oy, w, h); }
    return c;
  }

  function currentOpts() {
    const layout = document.querySelector('input[name=layout]:checked').value;
    const multi = layout === 'grid' || layout === 'row';
    return {
      res: +$('#res').value,
      bgTol: +$('#bgTol').value,
      detail: +$('#detail').value,
      smooth: +$('#smooth').value,
      thickness: +$('#thick').value,
      isolate: multi ? Math.min(+$('#iso').value, 22) : +$('#iso').value,
      keepLargest: !multi
    };
  }

  function imageToBlob(img) {
    return new Promise(r => {
      const max = 900, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(r, 'image/jpeg', 0.9);
    });
  }

  /* ---------- AI stage 1: infer and draw the four orthographic views ---------- */
  function makeSideView(front, ratio, flip) {
    const H = front.height, W = Math.max(16, Math.round(H * clamp(ratio, 0.12, 1)));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    const src = front.getContext('2d').getImageData(0, 0, front.width, H).data;
    const out = x.createImageData(W, H), d = out.data;
    const edges = [];
    for (let y = 0; y < H; y++) {
      let l = -1, r = -1;
      for (let xx = 0; xx < front.width; xx++) {
        if (src[(y * front.width + xx) * 4 + 3] > 24) { if (l < 0) l = xx; r = xx; }
      }
      edges.push([l, r, y]);
    }
    let near = 0;
    for (let y = 0; y < H; y++) { if (edges[y][0] >= 0) near = y; else edges[y][2] = near; }
    near = H - 1;
    for (let y = H - 1; y >= 0; y--) { if (edges[y][0] >= 0) near = y; else if (edges[y][2] === 0 && edges[0][0] < 0) edges[y][2] = near; }
    const strip = Math.max(2, Math.round(front.width * 0.1));
    for (let y = 0; y < H; y++) {
      const e = edges[y], srcRow = e[0] >= 0 ? y : e[2];
      const l = e[0] >= 0 ? e[0] : Math.max(0, edges[srcRow][0]);
      const r = e[0] >= 0 ? e[1] : Math.max(l, edges[srcRow][1]);
      for (let xx = 0; xx < W; xx++) {
        const t = flip ? 1 - xx / Math.max(1, W - 1) : xx / Math.max(1, W - 1);
        const sx = t < 0.5
          ? clamp(l + Math.round(t * 2 * strip), 0, front.width - 1)
          : clamp(r - Math.round((1 - t) * 2 * strip), 0, front.width - 1);
        const s = (srcRow * front.width + sx) * 4, i = (y * W + xx) * 4;
        const shade = 0.74 + 0.26 * (1 - Math.abs(t - 0.5) * 2);
        d[i] = clamp(src[s] * shade, 0, 255);
        d[i + 1] = clamp(src[s + 1] * shade, 0, 255);
        d[i + 2] = clamp(src[s + 2] * shade, 0, 255);
        d[i + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
    return c;
  }

  async function inferViewParams() {
    const fallback = {
      sideRatio: clamp((+$('#thick').value) / 100, 0.2, 1) * 0.72,
      backBrightness: 0.88, symmetry: 0.9, notes: ''
    };
    if (!aiOK || !global.claude) return fallback;
    try {
      const sample = await global.claude.use('sample');
      if (!sample) return fallback;
      progress('AI: ob’ekt tahlil qilinmoqda…', 8);
      const blob = await imageToBlob(composite);
      const prompt = 'You are a 3D vision AI. Analyze the object in the image. Before modelling, infer how its unseen BACK, LEFT and RIGHT orthographic views should look. Return ONLY JSON: {"sideRatio":0.2-1,"backBrightness":0.7-1,"symmetry":0-1,"notes":"short description of the 4 views"}. No markdown.';
      const res = await sample(prompt, { images: [blob], modelTier: 'complex', cache: false });
      const m = String((res && res.text) || '').match(/\{[\s\S]*\}/);
      if (!m) return fallback;
      const j = JSON.parse(m[0]);
      return {
        sideRatio: clamp(Number(j.sideRatio) || fallback.sideRatio, 0.15, 1),
        backBrightness: clamp(Number(j.backBrightness) || fallback.backBrightness, 0.65, 1),
        symmetry: clamp(Number(j.symmetry) || fallback.symmetry, 0, 1),
        notes: String(j.notes || '')
      };
    } catch (e) { return fallback; }
  }

  async function makeViews(source, params) {
    const opts = currentOpts();
    const front = global.Form3DRelief.cutout(source, {
      bgTol: +$('#bgTol').value, isolate: opts.keepLargest ? +$('#iso').value : Math.min(+$('#iso').value, 22), res: 520
    });
    const W = front.width, H = front.height;
    // If the user uploaded more photos, use them as the ACTUAL missing sides.
    const extra = items.length > 1 ? extraViews(4) : [];
    const back = document.createElement('canvas'); back.width = W; back.height = H;
    const bx = back.getContext('2d', { willReadFrequently: true });
    if (extra[0]) {
      bx.drawImage(fitView(extra[0], W, H, 1 - params.backBrightness), 0, 0);
    } else {
      bx.save(); bx.translate(W, 0); bx.scale(-1, 1); bx.drawImage(front, 0, 0); bx.restore();
      bx.globalCompositeOperation = 'source-atop';
      bx.fillStyle = 'rgba(16,12,34,' + (1 - params.backBrightness).toFixed(3) + ')';
      bx.fillRect(0, 0, W, H);
      bx.globalCompositeOperation = 'source-over';
    }
    const sideW = Math.max(16, Math.round(H * clamp(params.sideRatio, 0.12, 1)));
    const left = extra[1] ? fitView(extra[1], sideW, H, 0.06) : makeSideView(front, params.sideRatio, false);
    const right = extra[2] ? fitView(extra[2], sideW, H, 0.12) : makeSideView(front, params.sideRatio, true);
    return { front, back, left, right, side: left, source: extra.length ? 'photos' : 'inferred' };
  }

  function renderViews(views) {
    const host = $('#views');
    if (!host) return;
    const list = [['Old tomon', 'front'], ['Orqa tomon', 'back'], ['Chap tomon', 'left'], ['O‘ng tomon', 'right']];
    host.innerHTML = list.map(([label, key]) =>
      '<figure class="view-card"><img src="' + views[key].toDataURL('image/png') + '" alt="' + label + '"><figcaption>' + label + '</figcaption></figure>'
    ).join('');
    const panel = $('#viewsPanel');
    if (panel) {
      panel.classList.remove('hide');
      const pill = panel.querySelector('.pill');
      if (pill) pill.textContent = views.source === 'photos' ? 'yuklangan rasmlar' : 'taxmin asosida';
    }
  }

  async function buildAI() {
    const sample = global.claude && await global.claude.use('sample');
    if (!sample) throw new Error('AI rejimi bu muhitda mavjud emas. Relyef rejimini tanlang.');
    progress('Rasmlar AI ga yuborilmoqda…', 15);
    const blobs = [];
    for (const it of items) blobs.push(await imageToBlob(it.img));
    const prompt = `You are an expert 3D modeler. You are given ${blobs.length} photo(s) of the SAME object from possibly different angles. Reconstruct the object faithfully: exact overall proportions, colors, parts and details, including the back and underside. Do NOT change the object, do not add a ground or background. Coordinate system: y up, +z toward the camera of the first photo; object centered at origin; about 2.4 units in its largest dimension. If several images are provided, treat them as multiple views and merge the information into ONE consistent model. Return ONLY JSON without markdown: {"parts":[{"t":"box|sphere|cylinder|cone|torus|lathe","p":[x,y,z],"r":[rx,ry,rz degrees],"s":[sx,sy,sz],"c":"#rrggbb","m":metalness0-1,"o":roughness0-1,"pr":[[radius,y],...]}]}. Sizes: box s=full size; sphere s=diameters (ellipsoids allowed); cylinder/cone s=[diameter,height,diameter]; torus s=[outer diameter,outer diameter,tube thickness]; lathe = surface of revolution around y with 8-24 profile points "pr" (radius,y) bottom-to-top (use for bottles, cups, vases, lamps, round bodies; then s=[1,1,1]). Use 8-55 parts, split into real components with correct colors.`;
    progress('AI ob’ektni qurmoqda… (10–40 soniya)', 42);
    const res = await sample(prompt, { images: blobs, modelTier: 'complex', cache: false });
    const txt = (res && res.text) || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI javobi tushunarsiz. Qayta urinib ko‘ring.');
    progress('Model yig‘ilmoqda…', 84);
    const parts = JSON.parse(m[0]).parts;
    if (!Array.isArray(parts) || !parts.length) throw new Error('AI qism topa olmadi.');

    const grp = new THREE.Group(), D = Math.PI / 180;
    const num = (v, d) => Number.isFinite(+v) ? +v : d;
    const v3 = (a, d) => [0, 1, 2].map(i => num(a && a[i], d));
    for (const q of parts.slice(0, 60)) {
      const sz = v3(q.s, 1).map(v => Math.max(Math.abs(v), 0.01));
      let g;
      switch (q.t) {
        case 'sphere': g = new THREE.SphereGeometry(0.5, 40, 28); break;
        case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 48); break;
        case 'cone': g = new THREE.ConeGeometry(0.5, 1, 48); break;
        case 'torus': {
          const t0 = Math.min(sz[2], sz[0] * 0.5);
          g = new THREE.TorusGeometry((sz[0] - t0) / 2, t0 / 2, 20, 56);
          sz[0] = sz[1] = sz[2] = 1; break;
        }
        case 'lathe': {
          const pr = (q.pr || []).filter(p => Array.isArray(p)).map(p => new THREE.Vector2(Math.max(num(p[0], 0.01), 0.001), num(p[1], 0)));
          if (pr.length < 2) continue;
          g = new THREE.LatheGeometry(pr, 64); sz[0] = sz[1] = sz[2] = 1; break;
        }
        default: g = new THREE.BoxGeometry(1, 1, 1);
      }
      const col = new THREE.Color(/^#[0-9a-f]{6}$/i.test(q.c) ? q.c : '#cccccc').convertSRGBToLinear();
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        metalness: clamp(num(q.m, 0.08), 0, 1),
        roughness: clamp(num(q.o, 0.62), 0, 1),
        side: q.t === 'lathe' ? THREE.DoubleSide : THREE.FrontSide
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.scale.set(...sz);
      const p = v3(q.p, 0), r = v3(q.r, 0);
      mesh.position.set(...p); mesh.rotation.set(r[0] * D, r[1] * D, r[2] * D);
      grp.add(mesh);
    }
    if (!grp.children.length) throw new Error('Model bo‘sh chiqdi.');
    const box = new THREE.Box3().setFromObject(grp);
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const f = 2.4 / Math.max(size.x, size.y, size.z, 0.001);
    grp.children.forEach(m => { m.position.sub(center).multiplyScalar(f); m.scale.multiplyScalar(f); });
    grp.name = 'ai-model';
    return { mesh: grp, stats: null };
  }

  async function generate(quiet) {
    if (!items.length || working) return;
    if (!ready || !pivot || !controls) { engineError('3D dvigatel tayyor emas. Sahifani yangilang.'); return; }
    clearTimeout(autoTimer);
    working = true;
    $('#go').disabled = true;
    if (!quiet) { $('#empty').classList.add('hide'); $('#busy').classList.remove('hide'); }
    else { const b = $('#badge'); if (b) b.textContent = 'Model yangilanmoqda…'; }
    setStatus('3D model qurilmoqda…');
    try {
      const prevPrimary = primaryIndex;
      composite = makeComposite();
      if (prevPrimary !== primaryIndex) renderThumbs();
      const mode = document.querySelector('input[name=mode]:checked').value;
      if (mode === 'relief') { const vp = $('#viewsPanel'); if (vp) vp.classList.add('hide'); }
      let result;
      if (mode === 'ai' && aiOK) {
        result = await buildAI();
      } else {
        // AI 360° is a local intelligent reconstruction: it builds independent
        // front, back, side and underside surfaces so the solid is complete
        // from every direction. It works in every browser, no server needed.
        const opts = currentOpts();
        if (mode !== 'relief') {
          opts.full360 = true;
          opts.smooth = Math.min(100, opts.smooth + 30);
          opts.thickness = Math.max(opts.thickness, 62);
          opts.res = Math.max(opts.res, 200);
          if (mode === 'ai360') {
            // STAGE 1 — the AI first imagines all four sides of the object.
            progress('AI: 4 tomon ko‘rinishlari yaratilmoqda…', 14);
            const params = await inferViewParams();
            const views = await makeViews(composite, params);
            renderViews(views);
            // STAGE 2 — the model is built FROM those four views.
            opts.views = views;
            progress('AI: 4 ko‘rinish asosida 3D qurilmoqda…', 44);
          }
        }
        const r = await global.Form3DRelief.build(composite, opts, progress);
        result = { mesh: r.mesh, stats: r };
      }
      setModel(result.mesh, result.stats);
      T()('Model tayyor — uni aylantirib va sozlashingiz mumkin.', 'ok');
    } catch (e) {
      console.error(e);
      const msg = (e && (e.message || e.code)) || 'noma’lum xato';
      $('#empty').classList.remove('hide');
      $('#et').textContent = 'Xatolik: ' + msg + (e && e.code === 'not_granted' ? ' (ruxsat berilmadi)' : '');
      T()(msg, 'err');
    } finally {
      $('#busy').classList.add('hide');
      working = false;
      $('#go').disabled = !items.length;
    }
  }

  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => { if (model) generate(true); }, 520);
  }

  /* ---------- images ---------- */
  function renderThumbs() {
    const host = $('#thumbs');
    if (!host) return;
    if (primaryIndex >= items.length) primaryIndex = 0;
    host.innerHTML = items.map((it, i) =>
      '<div class="thumb' + (i === primaryIndex ? ' sel' : '') + '" data-i="' + i + '" title="' + (it.name || '').replace(/"/g, '') + (i === primaryIndex ? ' · asosiy rasm' : ' · asosiy qilish uchun bosing') + '">' +
        '<img src="' + it.url + '" alt="Rasm ' + (i + 1) + '">' +
        '<span class="idx">' + (i + 1) + '</span>' +
        '<button class="x" data-x="' + i + '" aria-label="O‘chirish">×</button>' +
      '</div>'
    ).join('');
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const i = +b.dataset.x;
      URL.revokeObjectURL(items[i].url);
      items.splice(i, 1);
      renderThumbs(); updateUI();
      if (model) scheduleRebuild();
    });
    host.querySelectorAll('.thumb').forEach(t => t.onclick = () => {
      const i = +t.dataset.i;
      if (i === primaryIndex) return;
      primaryIndex = i;
      manualPrimary = true;
      renderThumbs();
      if (model) scheduleRebuild();
      T()((i + 1) + '-rasm asosiy qilib olindi.', 'ok');
    });
    $('#imgCount').textContent = items.length;
  }

  function updateUI() {
    const n = items.length;
    $('#go').disabled = !n || working || !ready;
    $('#dropTitle').textContent = n ? (n + ' ta rasm yuklandi') : 'Rasmlarni tashlang';
    $('#dropSub').textContent = n ? 'Qo‘shish uchun yana bosing yoki tashlang' : 'yoki bosib tanlang · bir nechtasini tanlash mumkin';
    if (!n) { $('#empty').classList.remove('hide'); if (!working) setStatus('Rasm yuklang va 3D model avtomatik yaratiladi'); }
    else if (!model && !working) setStatus('Rasmlar tayyor — 3D model avtomatik yaratilmoqda');
  }

  async function addFiles(list) {
    const files = Array.from(list || []).filter(f => /^image\//.test(f.type));
    if (!files.length) { T()('Faqat rasm fayllari qabul qilinadi.', 'err'); return; }
    for (const f of files) {
      if (items.length >= 8) { T()('Bir loyihaga eng ko‘pi bilan 8 ta rasm.', 'err'); break; }
      try { items.push(await global.Form3D.fileToImage(f)); }
      catch (e) { T()(e.message, 'err'); }
    }
    manualPrimary = false;
    renderThumbs(); updateUI();
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => generate(false), 260);
    T()(files.length + ' ta rasm qo‘shildi — 3D model avtomatik yaratilmoqda.', 'ok');
  }

  function resetAll() {
    clearTimeout(autoTimer); clearTimeout(rebuildTimer);
    items.forEach(i => URL.revokeObjectURL(i.url));
    items = []; primaryIndex = 0; manualPrimary = false;
    if (model && pivot) { pivot.remove(model); disposeObject(model); model = null; }
    composite = null;
    renderThumbs(); updateUI();
    $('#empty').classList.remove('hide');
    const tb = $('.toolbar'); if (tb) tb.style.display = 'none';
    const hint = $('#hint'); if (hint) hint.style.display = 'none';
    $('#badge').textContent = '3D ko‘rinish';
    const vp = $('#viewsPanel'); if (vp) vp.classList.add('hide');
    const views = $('#views'); if (views) views.innerHTML = '';
    ['#dlZip', '#dlPng', '#dlWeb', '#to2d'].forEach(s => { if ($(s)) $(s).disabled = true; });
    setStatus('Rasm yuklang va 3D model avtomatik yaratiladi');
  }

  /* ---------- exports ---------- */
  async function exportZip() {
    if (!model) return;
    const btn = $('#dlZip'), old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = global.Form3D.icon('refresh') + ' Tayyorlanmoqda…';
    try {
      const wasWire = wire; wire = false; applyWire();
      const zip = new JSZip();
      const glb = await new Promise((res, rej) => new THREE.GLTFExporter().parse(pivot, res, { binary: true }, rej));
      zip.file('model.glb', glb);
      zip.file('model.obj', new THREE.OBJExporter().parse(pivot));
      const stl = new THREE.STLExporter().parse(pivot, { binary: true });
      zip.file('model.stl', stl instanceof DataView ? new Uint8Array(stl.buffer, stl.byteOffset, stl.byteLength) : stl);
      zip.file('README.txt', 'Form3D tomonidan yaratilgan model.\nGLB - rangli (Blender, Unity, Godot)\nOBJ - ko\'p dasturlarda qo\'llab-quvvatlanadi\nSTL - 3D printer uchun');
      wire = wasWire; applyWire();
      await global.Form3D.saveBlob('form3d-model.zip', await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
      T()('ZIP arxivi yuklandi.', 'ok');
    } catch (e) { console.error(e); T()('Eksport xatosi: ' + (e.message || e), 'err'); }
    btn.innerHTML = old; btn.disabled = false;
  }

  function savePng() {
    if (!model) return;
    renderer.render(scene, camera);
    renderer.domElement.toBlob(b => {
      if (b) { global.Form3D.saveBlob('form3d-korinish.png', b); T()('PNG saqlandi.', 'ok'); }
    }, 'image/png');
  }

  function saveWeb2D() {
    if (!model) return;
    try {
      const wasWire = wire, gridWas = helpers.visible;
      wire = false; applyWire(); helpers.visible = false;
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setClearColor(0x000000, 0); r.setPixelRatio(1); r.setSize(1200, 1200, false);
      r.outputEncoding = THREE.sRGBEncoding;
      const radius = Math.max(sceneW, sceneH) * 0.68;
      const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.01, 200);
      cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0);
      r.render(scene, cam);
      r.domElement.toBlob(b => {
        if (b) { global.Form3D.saveBlob('form3d-web-2d.png', b); T()('Web uchun 2D render (shaffof fon) saqlandi.', 'ok'); }
      }, 'image/png');
      setTimeout(() => { wire = wasWire; applyWire(); helpers.visible = gridWas; r.dispose(); }, 200);
    } catch (e) { T()('2D render xatosi: ' + e.message, 'err'); }
  }

  function sendTo2D() {
    if (!composite) return;
    try {
      localStorage.setItem('f3-transfer', JSON.stringify({ data: composite.toDataURL('image/png'), name: '3D studiyadan' }));
      T()('Rasm 2D studiyaga o‘tkazildi.', 'ok');
      if (global.Form3DNavigate) global.Form3DNavigate('2d.html'); else location.href = '2d.html';
    } catch (e) { T()('O‘tkazib bo‘lmadi: ' + e.message, 'err'); }
  }

  function syncTool(id, on) {
    const el = $('#' + id);
    if (el) el.classList.toggle('on', !!on);
  }

  function bind() {
    const drop = $('#drop'), fi = $('#file');
    drop.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { addFiles(fi.files); fi.value = ''; });
    ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', ev => addFiles(ev.dataTransfer.files));
    global.addEventListener('dragover', e => e.preventDefault());
    global.addEventListener('drop', e => e.preventDefault());

    $('#clearAll').addEventListener('click', resetAll);
    $('#go').addEventListener('click', () => generate(false));
    $('#dlZip').addEventListener('click', exportZip);
    $('#dlPng').addEventListener('click', savePng);
    $('#dlWeb').addEventListener('click', saveWeb2D);
    $('#to2d').addEventListener('click', sendTo2D);

    [['res', 'oRes'], ['bgTol', 'oBg'], ['detail', 'oDetail'], ['smooth', 'oSmooth'], ['thick', 'oThick'], ['iso', 'oIso']].forEach(([id, out]) => {
      const el = $('#' + id), o = $('#' + out);
      el.addEventListener('input', () => { o.textContent = el.value + ((id === 'thick' || id === 'iso') ? '%' : ''); scheduleRebuild(); });
    });
    ['scW', 'scH', 'scD', 'rotX', 'rotY', 'rotZ'].forEach(id => $('#' + id).addEventListener('input', applyTransform));

    $('#wf').addEventListener('click', () => { wire = !wire; applyWire(); });
    $('#rs').addEventListener('click', () => { frameModel(); controls.autoRotate = true; syncTool('ar', true); });
    $('#ar').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; syncTool('ar', controls.autoRotate); });
    $('#gr').addEventListener('click', () => {
      helpers.visible = !helpers.visible;
      syncTool('gr', helpers.visible);
      if (scene) {
        const g = helpers.children[0];
        if (g && g.position) g.position.y = -Math.max(sceneH / 2 + 0.18, 0.4);
      }
    });

    $$('input[name=mode]').forEach(r => r.addEventListener('change', () => {
      syncMode();
      if (items.length && model) scheduleRebuild();
    }));

    $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.preset;
      const vals = {
        flat: { thick: 18, detail: 35, smooth: 55 },
        balanced: { thick: 45, detail: 55, smooth: 35 },
        deep: { thick: 82, detail: 75, smooth: 18 }
      }[p] || {};
      Object.keys(vals).forEach(k => {
        if ($('#' + k)) { $('#' + k).value = vals[k]; $('#' + k).dispatchEvent(new Event('input')); }
      });
      T()('Profil qo‘llanildi.', 'ok');
    }));

    $$('input[name=layout]').forEach(r => r.addEventListener('change', () => {
      const l = document.querySelector('input[name=layout]:checked').value;
      $('#layoutNote').textContent = ({
        auto: 'Eng yaxshi rasm asosiy old tomon sifatida tanlanadi; qolganlari AI 4 tomon rejimida orqa va yon ko‘rinishlar uchun ishlatiladi.',
        overlay: 'Rasmlar ustma-ust qo‘yiladi. Shaffof PNG qatlamlari bir jism hosil qiladi.',
        grid: 'Rasmlar kataklarga joylashtiriladi — barcha ob’ektlar saqlanadi (ajratish avtomatik yumshatiladi).',
        row: 'Rasmlar yonma-yon joylashtiriladi — ko‘p ob’ektli kompozitsiya.',
        first: 'Faqat birinchi rasm ishlatiladi.'
      })[l];
      if (items.length && model) scheduleRebuild();
    }));
  }

  function syncMode() {
    const checked = document.querySelector('input[name=mode]:checked');
    const mode = checked ? checked.value : 'relief';
    const remote = document.querySelector('input[value=ai]');
    if (remote && !aiOK) remote.disabled = true;
    if (remote && !aiOK && mode === 'ai') {
      document.querySelector('input[value=ai360]').checked = true;
    }
    const active = document.querySelector('input[name=mode]:checked').value;
    $('#relOpts').style.display = active === 'ai' ? 'none' : 'block';
    $('#aiOpts').style.display = active === 'ai' ? 'block' : 'none';
    if (active === 'relief') { const vp = $('#viewsPanel'); if (vp) vp.classList.add('hide'); }
    $('#modeNote').textContent = ({
      relief: 'Barcha rasmlar qurilmangizda birlashtirilib, faqat asosiy ob’ekt ajratiladi. Fon va fondagi boshqa narsalar butunlay olib tashlanadi.',
      ai360: 'AI 4 tomon: avval old, orqa, chap va o‘ng ko‘rinishlarni yaratadi, keyin ular asosida yopiq 3D jism quradi. 2–4-rasmlar mavjud bo‘lsa, ular haqiqiy orqa va yon ko‘rinish sifatida ishlatiladi.',
      ai: aiOK
        ? 'Barcha yuklangan rasmlar AI ga yuborilib, bitta izchil model quriladi. Natija taxminiy bo‘lishi mumkin.'
        : 'AI bulut rejimi bu muhitda mavjud emas — “AI 360°” rejimidan foydalaning.'
    })[active];
  }

  async function init() {
    if (!$('#stage')) return;
    ready = initThree();
    bind();
    renderThumbs(); updateUI(); syncMode();
    aiOK = await global.Form3D.canUseAI();
    syncMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
