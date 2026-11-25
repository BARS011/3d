/* ==========================================================================
   Form3D — subject isolation + relief / depth engine
   Keeps ONLY the main object: removes every background object, crops to the
   subject, then builds a closed textured solid. Everything runs locally.
   ========================================================================== */
(function (global) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- fast separable box blur ---------- */
  function boxBlur(src, W, H, r) {
    r = Math.round(r);
    if (r < 1) return src;
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[row + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) {
        tmp[row + x] = sum / (r * 2 + 1);
        sum += src[row + clamp(x + r + 1, 0, W - 1)] - src[row + clamp(x - r, 0, W - 1)];
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        out[y * W + x] = sum / (r * 2 + 1);
        sum += tmp[clamp(y + r + 1, 0, H - 1) * W + x] - tmp[clamp(y - r, 0, H - 1) * W + x];
      }
    }
    return out;
  }

  function scaledPixels(src, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, W, H);
    return x.getImageData(0, 0, W, H).data;
  }

  /* ---------- background colour model (k-means over border pixels) ---------- */
  function estimateBg(px, W, H) {
    const ids = [];
    for (let x = 0; x < W; x++) { ids.push(x); ids.push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { ids.push(y * W); ids.push(y * W + W - 1); }
    const cols = [];
    for (const i of ids) if (px[i * 4 + 3] >= 120) cols.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
    if (!cols.length) return [[255, 255, 255]];

    const k = Math.min(3, cols.length);
    const centers = [];
    for (let j = 0; j < k; j++) centers.push(cols[Math.floor((j + 0.5) * cols.length / k)].slice());
    const counts = new Array(k).fill(0);
    for (let it = 0; it < 9; it++) {
      const sums = Array.from({ length: k }, () => [0, 0, 0]);
      counts.fill(0);
      for (const c of cols) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < k; j++) {
          const d = (c[0] - centers[j][0]) ** 2 + (c[1] - centers[j][1]) ** 2 + (c[2] - centers[j][2]) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
        counts[best]++; sums[best][0] += c[0]; sums[best][1] += c[1]; sums[best][2] += c[2];
      }
      for (let j = 0; j < k; j++) if (counts[j]) centers[j] = sums[j].map(s => s / counts[j]);
    }
    const total = cols.length;
    const out = [];
    centers.forEach((c, j) => { if (counts[j] / total > 0.06) out.push(c); });
    return out.length ? out : [centers[0]];
  }

  function minColorDist(px, i, centers) {
    let best = Infinity;
    for (const c of centers) {
      const d = Math.hypot(px[i * 4] - c[0], px[i * 4 + 1] - c[1], px[i * 4 + 2] - c[2]);
      if (d < best) best = d;
    }
    return best;
  }

  /* ---------- morphology ---------- */
  function dilate(m, W, H) {
    const o = new Uint8Array(m.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (m[i]) { o[i] = 1; continue; }
      if ((x > 0 && m[i - 1]) || (x < W - 1 && m[i + 1]) || (y > 0 && m[i - W]) || (y < H - 1 && m[i + W])) o[i] = 1;
    }
    return o;
  }
  function erode(m, W, H) {
    const o = new Uint8Array(m.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      o[i] = m[i] && (x === 0 || m[i - 1]) && (x === W - 1 || m[i + 1]) && (y === 0 || m[i - W]) && (y === H - 1 || m[i + W]) ? 1 : 0;
    }
    return o;
  }
  function closeMask(m, W, H, passes) {
    let r = m;
    for (let i = 0; i < (passes || 1); i++) r = erode(dilate(r, W, H), W, H);
    return r;
  }

  /* ---------- connected components ---------- */
  function components(mask, W, H, want) {
    const label = new Int32Array(W * H).fill(-1), stack = [], sizes = [];
    let k = 0;
    for (let s = 0; s < W * H; s++) {
      if (mask[s] !== want || label[s] >= 0) continue;
      let n = 0; label[s] = k; stack.push(s);
      while (stack.length) {
        const p = stack.pop(), x = p % W, y = (p / W) | 0; n++;
        if (x > 0 && mask[p - 1] === want && label[p - 1] < 0) { label[p - 1] = k; stack.push(p - 1); }
        if (x < W - 1 && mask[p + 1] === want && label[p + 1] < 0) { label[p + 1] = k; stack.push(p + 1); }
        if (y > 0 && mask[p - W] === want && label[p - W] < 0) { label[p - W] = k; stack.push(p - W); }
        if (y < H - 1 && mask[p + W] === want && label[p + W] < 0) { label[p + W] = k; stack.push(p + W); }
      }
      sizes.push(n); k++;
    }
    return { label, sizes };
  }

  function fillHoles(mask, W, H) {
    const N = W * H, out = new Uint8Array(N), stack = [];
    const push = i => { if (!out[i]) { out[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { if (!mask[x]) push(x); if (!mask[(H - 1) * W + x]) push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { if (!mask[y * W]) push(y * W); if (!mask[y * W + W - 1]) push(y * W + W - 1); }
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      if (x > 0 && !mask[p - 1]) push(p - 1);
      if (x < W - 1 && !mask[p + 1]) push(p + 1);
      if (y > 0 && !mask[p - W]) push(p - W);
      if (y < H - 1 && !mask[p + W]) push(p + W);
    }
    let n = 0;
    for (let i = 0; i < N; i++) if (!mask[i] && !out[i]) { mask[i] = 1; n++; }
    return n;
  }

  /* ---------- main subject segmentation ---------- */
  function segment(source, opts, knownBg) {
    const N = opts.workRes || clamp(opts.res || 340, 140, 640);
    const k = N / Math.max(source.width, source.height);
    const W = Math.max(8, Math.round(source.width * k)), H = Math.max(8, Math.round(source.height * k)), NP = W * H;
    const px = scaledPixels(source, W, H);
    const centers = knownBg || estimateBg(px, W, H);
    const tol = opts.bgTol == null ? 26 : opts.bgTol;
    const iso = clamp(opts.isolate == null ? 72 : opts.isolate, 0, 100) / 100;
    const mask = new Uint8Array(NP);

    // 1) colour distance from the background model. Closer to the image centre
    //    the threshold is tighter, so the subject survives even on busy photos.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (px[i * 4 + 3] < 100) continue;
      const d = minColorDist(px, i, centers);
      const nx = x / Math.max(1, W - 1) - 0.5, ny = y / Math.max(1, H - 1) - 0.5;
      const centrality = Math.max(0, 1 - Math.hypot(nx, ny) * 2.1);
      const thr = (7 + tol * 2.7) * (1 - 0.3 * centrality);
      mask[i] = d > thr ? 1 : 0;
    }

    // 2) remove everything connected to the border that still looks like background
    const reach = new Uint8Array(NP), stack = [], borderLim = 14 + tol * 3.4;
    const seed = i => { if (!reach[i] && minColorDist(px, i, centers) < borderLim) { reach[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      if (x > 0) seed(p - 1);
      if (x < W - 1) seed(p + 1);
      if (y > 0) seed(p - W);
      if (y < H - 1) seed(p + W);
    }
    for (let i = 0; i < NP; i++) if (reach[i]) mask[i] = 0;

    // 3) close small gaps inside the subject, then drop background objects by size
    let cleaned = closeMask(mask, W, H, N > 420 ? 2 : 1);
    const before = cleaned;
    const c = components(cleaned, W, H, 1);
    if (c.sizes.length) {
      let largest = 0, largestLabel = 0;
      c.sizes.forEach((s, i) => { if (s > largest) { largest = s; largestLabel = i; } });
      const ratio = 0.003 + Math.pow(iso, 1.5) * 0.36;
      const minAbs = Math.max(Math.round(NP * 0.0025), 24);
      const limit = Math.max(minAbs, largest * ratio);
      for (let i = 0; i < NP; i++) {
        if (cleaned[i] && c.sizes[c.label[i]] < limit) cleaned[i] = 0;
      }
      // keep the dominant component anchored near the centre when isolation is high
      if (iso > 0.55) {
        let cx = 0, cy = 0, n = 0;
        for (let i = 0; i < NP; i++) if (c.label[i] === largestLabel) { cx += i % W; cy += (i / W) | 0; n++; }
        cx /= Math.max(1, n); cy /= Math.max(1, n);
        for (let i = 0; i < NP; i++) {
          if (!cleaned[i] || c.label[i] === largestLabel) continue;
          const dx = (i % W) - cx, dy = ((i / W) | 0) - cy;
          if (Math.hypot(dx, dy) > Math.min(W, H) * 0.32) cleaned[i] = 0;
        }
      }
      let count = 0; for (let i = 0; i < NP; i++) count += cleaned[i];
      if (!count) cleaned = before;
    }
    fillHoles(cleaned, W, H);

    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!cleaned[y * W + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) throw new Error('Rasmda ob’ekt topilmadi. “Fon ob’ektlarini olib tashlash” yoki “Fon sezuvchanligi”ni kamaytiring.');
    return { W, H, mask: cleaned, px, centers, bbox: { x0, y0, x1, y1 } };
  }

  /* ---------- crop away everything outside the subject ---------- */
  function cropToSubject(source, seg, targetRes) {
    const { x0, y0, x1, y1 } = seg.bbox;
    const pad = Math.max(2, Math.round(Math.min(x1 - x0 + 1, y1 - y0 + 1) * 0.07));
    const ax = Math.max(0, x0 - pad), ay = Math.max(0, y0 - pad);
    const bx = Math.min(seg.W - 1, x1 + pad), by = Math.min(seg.H - 1, y1 + pad);
    const bw = bx - ax + 1, bh = by - ay + 1;
    const sx = ax * source.width / seg.W, sy = ay * source.height / seg.H;
    const sw = bw * source.width / seg.W, sh = bh * source.height / seg.H;

    const c = document.createElement('canvas');
    c.width = Math.max(8, Math.round(sw)); c.height = Math.max(8, Math.round(sh));
    const cc = c.getContext('2d', { willReadFrequently: true });
    cc.drawImage(source, sx, sy, sw, sh, 0, 0, c.width, c.height);

    // erase every pixel outside the isolated subject — no background objects
    // can leak into the texture atlas, even in the padding area
    const cropMask = new Uint8Array(c.width * c.height);
    for (let y = 0; y < c.height; y++) {
      const my = ay + Math.min(bh - 1, Math.floor((y + 0.5) * bh / c.height));
      for (let x = 0; x < c.width; x++) {
        const mx = ax + Math.min(bw - 1, Math.floor((x + 0.5) * bw / c.width));
        cropMask[y * c.width + x] = seg.mask[my * seg.W + mx];
      }
    }
    const im = cc.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < cropMask.length; i++) {
      if (!cropMask[i]) { d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; d[i * 4 + 3] = 0; }
    }
    cc.putImageData(im, 0, 0);

    const k = targetRes / Math.max(c.width, c.height);
    const W = Math.max(8, Math.round(c.width * k)), H = Math.max(8, Math.round(c.height * k));
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const sy2 = ay + Math.min(bh - 1, Math.floor((y + 0.5) * bh / H));
      for (let x = 0; x < W; x++) {
        const sx2 = ax + Math.min(bw - 1, Math.floor((x + 0.5) * bw / W));
        mask[y * W + x] = seg.mask[sy2 * seg.W + sx2];
      }
    }
    return { canvas: c, W, H, mask };
  }

  /* ---------- transparent cut-out (2D studio) ---------- */
  function removeBackground(source, tolerance, isolate) {
    const workRes = Math.min(1500, Math.max(400, Math.max(source.width, source.height)));
    const seg = segment(source, { bgTol: tolerance == null ? 28 : tolerance, isolate: isolate == null ? 72 : isolate, workRes });
    const soft = boxBlur(Float32Array.from(seg.mask), seg.W, seg.H, 1);
    const out = document.createElement('canvas'); out.width = seg.W; out.height = seg.H;
    const cx = out.getContext('2d'), im = cx.createImageData(seg.W, seg.H), d = im.data;
    for (let i = 0; i < seg.W * seg.H; i++) {
      d[i * 4] = seg.px[i * 4]; d[i * 4 + 1] = seg.px[i * 4 + 1]; d[i * 4 + 2] = seg.px[i * 4 + 2];
      d[i * 4 + 3] = Math.round(clamp(soft[i], 0, 1) * 255);
    }
    cx.putImageData(im, 0, 0);
    return out;
  }

  /* ---------- chamfer distance transform ---------- */
  function distanceTransform(mask, W, H) {
    const N = W * H, d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = !mask[i] ? 0 : (i % W === 0 || ((i / W) | 0) === 0 || i % W === W - 1 || ((i / W) | 0) === H - 1) ? 1 : 1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!mask[i]) continue; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + 1.4142);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + 1.4142);
      }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!mask[i]) continue; let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + 1.4142);
        if (x > 0) v = Math.min(v, d[i + W - 1] + 1.4142);
      }
      d[i] = v;
    }
    let max = 1;
    for (let i = 0; i < N; i++) { d[i] = Math.sqrt(d[i]); if (mask[i] && d[i] > max) max = d[i]; }
    for (let i = 0; i < N; i++) d[i] /= max;
    return d;
  }

  /* ---------- build closed, textured solid from the isolated subject ---------- */
  function build(source, opts, onProgress) {
    opts = opts || {};
    const report = (t, p) => { if (onProgress) onProgress(t, p); };
    report('Asosiy ob’ekt ajratilmoqda…', 10);

    const seg = segment(source, opts);
    const target = clamp(opts.res || 240, 140, 420);
    const cut = cropToSubject(source, seg, target);
    const W = cut.W, H = cut.H, NP = W * H;
    const mask = cut.mask, art = cut.canvas;
    const px = scaledPixels(art, W, H);

    let solid = 0;
    for (let i = 0; i < NP; i++) solid += mask[i];
    if (solid < NP * 0.004) throw new Error('Ob’ekt juda kichik. Boshqa rasm sinang yoki fon sezuvchanligini kamaytiring.');

    report('Chuqurlik xaritasi hisoblanmoqda…', 42);
    const dist = distanceTransform(mask, W, H);
    const lum = new Float32Array(NP);
    for (let i = 0; i < NP; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    const lumS = boxBlur(lum, W, H, 2), lumL = boxBlur(lum, W, H, 8);
    const detail = clamp((opts.detail == null ? 55 : opts.detail) / 100, 0, 1);
    const smooth = clamp((opts.smooth == null ? 35 : opts.smooth) / 100, 0, 1);

    // Local contrast keeps real details (eyes, seams, printing) instead of
    // treating dark areas as holes in the object.
    const relief = new Float32Array(NP);
    for (let i = 0; i < NP; i++) relief[i] = clamp(0.5 + (lumS[i] - lumL[i]) * 2.6, 0, 1);
    const reliefS = boxBlur(relief, W, H, 1);

    let depth = new Float32Array(NP);
    for (let i = 0; i < NP; i++) {
      if (!mask[i]) { depth[i] = 0; continue; }
      // Flat front face with a smooth rounded bevel at the silhouette — this
      // preserves the photo's proportions far better than a dome-shaped relief.
      const rim = clamp(dist[i] / 0.13, 0, 1);
      const shape = 0.52 + 0.48 * (rim * rim * (3 - 2 * rim));
      depth[i] = clamp(shape * (1 - 0.32 * detail) + reliefS[i] * (0.32 * detail), 0, 1);
    }
    const smoothR = Math.round(smooth * 3) + (opts.full360 ? 1 : 0);
    depth = boxBlur(depth, W, H, smoothR);
    for (let i = 0; i < NP; i++) depth[i] = clamp(depth[i], 0, 1);

    // AI 360°: reconstruct the unseen side FROM the given side. The back
    // relief and texture are mirrored/adapted from the front; the rim, top and
    // bottom are separate surfaces coloured from the source image itself.
    const full360 = !!opts.full360;
    const regions = full360 ? 3 : 2;
    let backDepth = null;
    if (full360) {
      backDepth = new Float32Array(NP);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        const mx = y * W + (W - 1 - x);
        const mirrored = depth[mask[mx] ? mx : i];
        const rim = Math.pow(dist[i], 0.42);
        const shade = 1 - lumL[i];
        backDepth[i] = clamp(mirrored * 0.6 + rim * 0.24 + shade * 0.16, 0, 1);
      }
      backDepth = boxBlur(backDepth, W, H, Math.max(1, Math.round(smooth * 4) + 1));
    }

    report('Tekstura tayyorlanmoqda…', 62);
    const tw = Math.min(art.width, 1536), th = Math.max(1, Math.round(tw * art.height / art.width));
    const atlas = document.createElement('canvas'); atlas.width = tw * regions; atlas.height = th;
    const a = atlas.getContext('2d');
    a.imageSmoothingEnabled = true; a.imageSmoothingQuality = 'high';
    a.drawImage(art, 0, 0, tw, th); // front — the original, unchanged pixels
    if (full360) {
      if (opts.views && opts.views.back && opts.views.side) {
        // Stage 2: use the four AI-prepared views instead of guessing them.
        a.drawImage(opts.views.back, tw, 0, tw, th);
        a.drawImage(opts.views.side, tw * 2, 0, tw, th);
      } else {
      // back: the SAME image mirrored, subtly darkened so the volume reads well
      let mirrored = false;
      try {
        a.save(); a.translate(tw * 2, 0); a.scale(-1, 1);
        a.globalAlpha = 0.92; a.filter = 'brightness(.84) saturate(.94)';
        a.drawImage(art, 0, 0, tw, th); a.restore(); mirrored = true;
      } catch (e) { mirrored = false; }
      if (!mirrored) {
        a.save(); a.translate(tw * 2, 0); a.scale(-1, 1);
        a.globalAlpha = 0.9; a.drawImage(art, 0, 0, tw, th);
        a.fillStyle = 'rgba(15,12,30,.12)'; a.fillRect(0, 0, tw, th); a.restore();
      }
      // rim / top / bottom: edge colours taken from the object itself
      const rim = document.createElement('canvas'); rim.width = tw; rim.height = th;
      const rx = rim.getContext('2d', { willReadFrequently: true });
      rx.drawImage(art, 0, 0, tw, th);
      try { rx.filter = 'blur(6px) brightness(.82)'; rx.drawImage(rim, 0, 0); rx.filter = 'none'; } catch (e) {}
      const front = a.getImageData(0, 0, tw, th).data;
      const edge = rx.getImageData(0, 0, tw, th), ed = edge.data;
      for (let x = 0; x < tw; x++) {
        let top = -1, bot = -1;
        for (let y = 0; y < th; y++) {
          const j = (y * tw + x) * 4;
          if (front[j + 3] > 10) { if (top < 0) top = y; bot = y; }
        }
        if (top < 0) continue;
        for (let y = 0; y < th; y++) {
          const sy = y < th / 2 ? top : bot, s = (sy * tw + x) * 4, d = (y * tw + x) * 4;
          ed[d] = (ed[d] + front[s]) >> 1;
          ed[d + 1] = (ed[d + 1] + front[s + 1]) >> 1;
          ed[d + 2] = (ed[d + 2] + front[s + 2]) >> 1;
          ed[d + 3] = 255;
        }
      }
      rx.putImageData(edge, 0, 0);
      a.drawImage(rim, tw * 2, 0);
      }
    } else {
      let filtered = false;
      try {
        a.save(); a.filter = 'blur(5px) brightness(.72) saturate(.8)';
        a.drawImage(art, tw, 0, tw, th); a.restore(); filtered = true;
      } catch (e) { filtered = false; }
      if (!filtered) {
        const small = document.createElement('canvas');
        small.width = Math.max(4, tw >> 4); small.height = Math.max(4, th >> 4);
        small.getContext('2d').drawImage(art, 0, 0, small.width, small.height);
        a.drawImage(small, tw, 0, tw, th);
        a.fillStyle = 'rgba(12,10,32,.24)'; a.fillRect(tw, 0, tw, th);
      }
    }

    report('3D jism qurilmoqda…', 80);
    const thick = clamp((opts.thickness == null ? 45 : opts.thickness) / 100, 0, 1);
    const S = 0.14 + thick * 0.78, base = 0.028, u = 2.4 / Math.max(W, H);
    const V = y => 1 - y / Math.max(1, H - 1);
    const UF = x => (x / Math.max(1, W - 1)) / regions;
    const UB = x => (1 / regions) + ((full360 ? 1 - x / Math.max(1, W - 1) : x / Math.max(1, W - 1)) / regions);
    const UW = x => ((full360 ? 2 : 1) / regions) + (x / Math.max(1, W - 1)) / regions;
    const fIndex = new Int32Array(NP).fill(-1), pos = [], uv = [];
    const fz = new Float32Array(NP), bz = new Float32Array(NP);
    let nv = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const d = opts.invert ? 1 - depth[i] : depth[i];
      let h = base + S * (0.82 * d + 0.18 * lumS[i] * Math.min(1, d * 5));
      let hb = base + S * (0.32 + 0.24 * d);
      if (full360) {
        // mirrored back relief: the hidden side follows the visible one,
        // with its own volume and a rounded rim for a smooth closed solid.
        hb = base + S * (0.14 + 0.78 * backDepth[i]);
        const rim = clamp(dist[i] / 0.16, 0, 1);
        const bevel = 0.55 + 0.45 * (rim * rim * (3 - 2 * rim));
        h = base + (h - base) * bevel;
        hb = base + (hb - base) * bevel;
      }
      const X = (x - W / 2) * u, Y = (H / 2 - y) * u;
      fz[i] = h; bz[i] = -hb;
      pos.push(X, Y, h, X, Y, -hb);
      uv.push(UF(x), V(y), UB(x), V(y));
      fIndex[i] = nv; nv += 2;
    }

    const F = i => fIndex[i], B = i => fIndex[i] + 1, idx = [], full = new Uint8Array(NP);
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      if (mask[i] && mask[i + 1] && mask[i + W] && mask[i + W + 1]) full[i] = 1;
    }
    const isFull = (x, y) => x >= 0 && y >= 0 && x < W - 1 && y < H - 1 && full[y * W + x] === 1;
    // Every boundary edge becomes its own textured surface: horizontal edges
    // form the top/bottom caps, vertical edges form the side walls.
    const wall = (p, q) => {
      const base = pos.length / 3;
      const add = (i, z) => {
        const x = i % W, y = (i / W) | 0;
        pos.push((x - W / 2) * u, (H / 2 - y) * u, z);
        uv.push(UW(x), V(y));
      };
      add(p, fz[p]); add(q, fz[q]); add(q, bz[q]); add(p, bz[p]);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      if (!full[y * W + x]) continue;
      const a0 = y * W + x, b = a0 + 1, c = a0 + W, d = c + 1;
      idx.push(F(a0), F(c), F(b), F(b), F(c), F(d));
      idx.push(B(a0), B(b), B(c), B(b), B(d), B(c));
      if (!isFull(x, y - 1)) wall(a0, b);
      if (!isFull(x, y + 1)) wall(d, c);
      if (!isFull(x - 1, y)) wall(c, a0);
      if (!isFull(x + 1, y)) wall(b, d);
    }
    if (!idx.length) throw new Error('Geometriya yaratilmadi. Boshqa sozlamalarni sinang.');

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const tex = new THREE.CanvasTexture(atlas);
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.22,
      roughness: full360 ? 0.68 : 0.78,
      metalness: 0.01
    }));
    mesh.name = full360 ? 'ai-360-model' : 'subject-model';

    report('Model tayyor!', 100);
    return {
      mesh, width: W, height: H, coverage: solid / NP, triangles: idx.length / 3, full360,
      views: !!(opts.views && opts.views.back && opts.views.side),
      removed: 1 - (seg.bbox.x1 - seg.bbox.x0 + 1) * (seg.bbox.y1 - seg.bbox.y0 + 1) / (seg.W * seg.H)
    };
  }

  /* ---------- transparent cut-out of the main subject (AI view source) ---------- */
  function cutout(source, opts) {
    opts = opts || {};
    const seg = segment(source, opts);
    const cut = cropToSubject(source, seg, clamp(opts.res || 520, 200, 1000));
    const out = document.createElement('canvas');
    out.width = cut.W; out.height = cut.H;
    out.getContext('2d').drawImage(cut.canvas, 0, 0);
    return out;
  }

  /* ---------- choose the best photo to use as the front of the model ---------- */
  function scoreImage(source, opts) {
    try {
      const seg = segment(source, { bgTol: 30, isolate: 62, workRes: 200 });
      const N = seg.W * seg.H;
      let n = 0, cx = 0, cy = 0;
      for (let i = 0; i < N; i++) {
        if (!seg.mask[i]) continue;
        n++; cx += i % seg.W; cy += (i / seg.W) | 0;
      }
      if (!n) return 0;
      const area = (seg.bbox.x1 - seg.bbox.x0 + 1) * (seg.bbox.y1 - seg.bbox.y0 + 1) / N;
      const center = 1 - Math.min(1, Math.hypot(cx / n / seg.W - 0.5, cy / n / seg.H - 0.5) * 1.7);
      return clamp(n / N * 2 + area * 0.8 + center * 0.5, 0, 3);
    } catch (e) { return 0; }
  }

  global.Form3DRelief = { build, removeBackground, boxBlur, segment, cutout, scoreImage };
})(window);
