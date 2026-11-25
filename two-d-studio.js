/* ==========================================================================
   Form3D — 2D Web Studio controller
   Layer composition, background removal, web presets, PNG/WebP/SVG export.
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const T = () => global.Form3D.toast;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let layers = [], selected = null, uid = 0;
  let cw = 1200, ch = 630, bg = '#ffffff', transparent = false;
  const filters = { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0 };

  function filterString() {
    return 'brightness(' + filters.brightness + '%) contrast(' + filters.contrast + '%) ' +
      'saturate(' + filters.saturate + '%) blur(' + filters.blur + 'px) ' +
      'grayscale(' + filters.grayscale + '%) sepia(' + filters.sepia + '%)';
  }

  function render() {
    const c = $('#c2d');
    if (!c) return;
    c.width = cw; c.height = ch;
    const x = c.getContext('2d');
    x.clearRect(0, 0, cw, ch);
    if (!transparent) { x.fillStyle = bg; x.fillRect(0, 0, cw, ch); }
    layers.forEach(l => {
      if (!l.visible) return;
      x.save();
      x.globalAlpha = l.opacity / 100;
      x.translate(l.x, l.y);
      x.rotate(l.rot * Math.PI / 180);
      x.scale(l.scale * l.fh, l.scale * l.fv);
      x.filter = filterString();
      x.drawImage(l.canvas, -l.w / 2, -l.h / 2);
      x.restore();
    });
    x.filter = 'none';
    const label = $('#canvasInfo');
    if (label) label.textContent = cw + ' × ' + ch + ' px · ' + layers.filter(l => l.visible).length + ' qatlam';
  }

  function thumbFor(canvas) {
    const t = document.createElement('canvas');
    const s = Math.min(1, 60 / Math.max(canvas.width, canvas.height));
    t.width = Math.max(1, Math.round(canvas.width * s));
    t.height = Math.max(1, Math.round(canvas.height * s));
    t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL('image/png');
  }

  function renderLayers() {
    const host = $('#layerList');
    if (!host) return;
    if (!layers.length) {
      host.innerHTML = '<div class="empty-layers">Hali qatlam yo‘q.<br>Rasm yuklang yoki 3D studiyadan o‘tkazing.</div>';
      return;
    }
    host.innerHTML = layers.map((l, i) =>
      '<div class="layer-item' + (l.id === selected ? ' sel' : '') + '" data-id="' + l.id + '">' +
        '<img src="' + l.thumb + '" alt="">' +
        '<span class="nm">' + (l.name || 'Qatlam ' + (i + 1)) + '</span>' +
        '<button class="eye" data-act="eye" title="Ko‘rinish">' + global.Form3D.icon(l.visible ? 'eye' : 'eyeoff') + '</button>' +
        '<button data-act="up" title="Yuqoriga">↑</button>' +
        '<button data-act="del" title="O‘chirish">' + global.Form3D.icon('trash') + '</button>' +
      '</div>'
    ).join('');
    host.querySelectorAll('.layer-item').forEach(el => {
      el.addEventListener('click', e => {
        const act = e.target.closest('[data-act]');
        const id = +el.dataset.id;
        const idx = layers.findIndex(l => l.id === id);
        if (idx < 0) return;
        if (act) {
          const a = act.dataset.act;
          if (a === 'eye') { layers[idx].visible = !layers[idx].visible; }
          else if (a === 'del') {
            layers.splice(idx, 1);
            if (selected === id) selected = layers.length ? layers[layers.length - 1].id : null;
          } else if (a === 'up' && idx < layers.length - 1) {
            const tmp = layers[idx]; layers[idx] = layers[idx + 1]; layers[idx + 1] = tmp;
          }
        } else selected = id;
        renderLayers(); syncProps(); render();
      });
    });
  }

  function addLayerFromSource(source, name) {
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    const fit = Math.min(cw / canvas.width, ch / canvas.height) * 0.82;
    const l = {
      id: ++uid, name: name || 'Rasm', canvas, thumb: thumbFor(canvas),
      w: canvas.width, h: canvas.height,
      x: cw / 2, y: ch / 2,
      scale: clamp(fit, 0.02, 4), rot: 0, opacity: 100,
      visible: true, fh: 1, fv: 1
    };
    layers.push(l); selected = l.id;
    renderLayers(); syncProps(); render();
    return l;
  }

  async function addFiles(list) {
    const files = Array.from(list || []).filter(f => /^image\//.test(f.type));
    if (!files.length) { T()('Faqat rasm fayllari qabul qilinadi.', 'err'); return; }
    for (const f of files) {
      if (layers.length >= 12) { T()('Eng ko‘pi bilan 12 ta qatlam.', 'err'); break; }
      try {
        const got = await global.Form3D.fileToImage(f);
        addLayerFromSource(got.img, got.name.replace(/\.[^.]+$/, ''));
      } catch (e) { T()(e.message, 'err'); }
    }
    T()(files.length + ' ta rasm qatlam sifatida qo‘shildi.', 'ok');
  }

  function selectedLayer() { return layers.find(l => l.id === selected) || null; }

  function syncProps() {
    const l = selectedLayer();
    const box = $('#layerProps');
    if (box) box.style.opacity = l ? '1' : '.45';
    if (!l) return;
    const map = {
      selScale: Math.round(l.scale * 100), selRot: Math.round(l.rot),
      selOpacity: Math.round(l.opacity), selX: Math.round(l.x / cw * 100), selY: Math.round(l.y / ch * 100)
    };
    Object.keys(map).forEach(id => {
      const el = $('#' + id); if (el) el.value = clamp(map[id], +el.min, +el.max);
    });
    $('#oScale').textContent = Math.round(l.scale * 100) + '%';
    $('#oRot').textContent = Math.round(l.rot) + '°';
    $('#oOpacity').textContent = Math.round(l.opacity) + '%';
    $('#oX').textContent = Math.round(l.x / cw * 100) + '%';
    $('#oY').textContent = Math.round(l.y / ch * 100) + '%';
  }

  function updateLayerFromProps() {
    const l = selectedLayer(); if (!l) return;
    l.scale = +$('#selScale').value / 100;
    l.rot = +$('#selRot').value;
    l.opacity = +$('#selOpacity').value;
    l.x = +$('#selX').value / 100 * cw;
    l.y = +$('#selY').value / 100 * ch;
    syncProps(); render();
  }

  function setSize(w, h) {
    const rx = w / cw, ry = h / ch;
    cw = clamp(Math.round(w), 64, 3000); ch = clamp(Math.round(h), 64, 3000);
    layers.forEach(l => { l.x *= rx; l.y *= ry; l.scale *= Math.min(rx, ry); });
    $$('[data-size]').forEach(b => b.classList.toggle('on', b.dataset.size === cw + 'x' + ch));
    $('#cwIn').value = cw; $('#chIn').value = ch;
    render(); syncProps();
  }

  function removeBgSelected() {
    const l = selectedLayer();
    if (!l) { T()('Avval qatlam tanlang.', 'err'); return; }
    try {
      const out = global.Form3DRelief.removeBackground(l.canvas, +$('#bgTol2').value, +$('#iso2').value);
      l.canvas = out; l.w = out.width; l.h = out.height; l.thumb = thumbFor(out);
      renderLayers(); render();
      T()('Fondan tozalandi — endi shaffof PNG.', 'ok');
    } catch (e) { T()('Xatolik: ' + e.message, 'err'); }
  }

  function resetFilters() {
    const defaults = { fBright: 100, fContrast: 100, fSat: 100, fBlur: 0, fGray: 0, fSepia: 0 };
    const keys = { fBright: 'brightness', fContrast: 'contrast', fSat: 'saturate', fBlur: 'blur', fGray: 'grayscale', fSepia: 'sepia' };
    Object.keys(defaults).forEach(id => {
      filters[keys[id]] = defaults[id];
      const el = $('#' + id), out = $('#o' + id.slice(1));
      if (el) el.value = defaults[id];
      if (out) out.textContent = defaults[id] + (keys[id] === 'blur' ? 'px' : '%');
    });
    render();
    T()('Filtrlar tiklandi.', 'ok');
  }

  function blobFromCanvas(type, quality) {
    return new Promise((res, rej) => $('#c2d').toBlob(b => b ? res(b) : rej(new Error('Blob yaratilmadi')), type, quality));
  }

  function toSVG() {
    let s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">';
    if (!transparent) s += '<rect width="100%" height="100%" fill="' + bg + '"/>';
    layers.filter(l => l.visible).forEach(l => {
      const data = l.canvas.toDataURL('image/png');
      const tr = 'translate(' + l.x.toFixed(2) + ' ' + l.y.toFixed(2) + ') rotate(' + l.rot.toFixed(2) + ') scale(' + (l.scale * l.fh).toFixed(4) + ' ' + (l.scale * l.fv).toFixed(4) + ')';
      const f = filterString().replace(/blur\([^)]*\)/g, '');
      s += '<g transform="' + tr + '" opacity="' + (l.opacity / 100).toFixed(3) + '" style="filter:' + f + '">';
      s += '<image x="' + (-l.w / 2) + '" y="' + (-l.h / 2) + '" width="' + l.w + '" height="' + l.h + '" href="' + data + '" xlink:href="' + data + '" preserveAspectRatio="none"/>';
      s += '</g>';
    });
    s += '</svg>';
    return new Blob([s], { type: 'image/svg+xml;charset=utf-8' });
  }

  async function copyPNG() {
    try {
      if (!global.navigator.clipboard || !global.ClipboardItem) throw new Error('Brauzer clipboardni qo‘llab-quvvatlamaydi');
      const blob = await blobFromCanvas('image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      T()('Rasm panelyarga nusxalandi.', 'ok');
    } catch (e) { T()('Nusxalash muvaffaqiyatsiz: ' + e.message, 'err'); }
  }

  function loadTransfer() {
    try {
      const raw = localStorage.getItem('f3-transfer');
      if (!raw) return;
      const data = JSON.parse(raw);
      const img = new Image();
      img.onload = () => { addLayerFromSource(img, data.name || '3D dan'); T()('3D studiyadagi rasm qatlam sifatida qo‘shildi.', 'ok'); };
      img.src = data.data;
      localStorage.removeItem('f3-transfer');
    } catch (e) { /* ignore broken transfer */ }
  }

  function bind() {
    const drop = $('#drop2'), fi = $('#file2');
    drop.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { addFiles(fi.files); fi.value = ''; });
    ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', ev => addFiles(ev.dataTransfer.files));
    global.addEventListener('dragover', e => e.preventDefault());
    global.addEventListener('drop', e => e.preventDefault());

    $('#clearLayers').addEventListener('click', () => {
      layers = []; selected = null; renderLayers(); render();
      T()('Barcha qatlamlar o‘chirildi.');
    });

    $$('[data-size]').forEach(b => b.addEventListener('click', () => {
      const [w, h] = b.dataset.size.split('x').map(Number); setSize(w, h);
    }));
    $('#applySize').addEventListener('click', () => setSize(+$('#cwIn').value, +$('#chIn').value));

    $('#bgColor').addEventListener('input', e => { bg = e.target.value; transparent = false; $('#transparent').checked = false; render(); });
    $('#transparent').addEventListener('change', e => { transparent = e.target.checked; render(); });

    ['selScale', 'selRot', 'selOpacity', 'selX', 'selY'].forEach(id => $('#' + id).addEventListener('input', updateLayerFromProps));
    $('#flipH').addEventListener('click', () => { const l = selectedLayer(); if (l) { l.fh *= -1; render(); } });
    $('#flipV').addEventListener('click', () => { const l = selectedLayer(); if (l) { l.fv *= -1; render(); } });
    $('#removeBg2').addEventListener('click', removeBgSelected);

    const fmap = { fBright: 'brightness', fContrast: 'contrast', fSat: 'saturate', fBlur: 'blur', fGray: 'grayscale', fSepia: 'sepia' };
    Object.keys(fmap).forEach(id => {
      const el = $('#' + id), out = $('#o' + id.slice(1));
      el.addEventListener('input', () => {
        filters[fmap[id]] = +el.value;
        if (out) out.textContent = el.value + (fmap[id] === 'blur' ? 'px' : '%');
        render();
      });
    });
    $('#resetFilters').addEventListener('click', resetFilters);

    $('#dlPng2').addEventListener('click', async () => {
      try { await global.Form3D.saveBlob('form3d-dizayn.png', await blobFromCanvas('image/png')); T()('PNG yuklandi.', 'ok'); }
      catch (e) { T()(e.message, 'err'); }
    });
    $('#dlWebp').addEventListener('click', async () => {
      try { await global.Form3D.saveBlob('form3d-dizayn.webp', await blobFromCanvas('image/webp', 0.92)); T()('WebP yuklandi.', 'ok'); }
      catch (e) { T()('WebP muvaffaqiyatsiz: ' + e.message, 'err'); }
    });
    $('#dlSvg').addEventListener('click', async () => {
      try { await global.Form3D.saveBlob('form3d-dizayn.svg', toSVG()); T()('SVG yuklandi.', 'ok'); }
      catch (e) { T()(e.message, 'err'); }
    });
    $('#copyPng').addEventListener('click', copyPNG);
  }

  function init() {
    if (!$('#c2d')) return;
    bind();
    $$('[data-size]').forEach(b => b.classList.toggle('on', b.dataset.size === cw + 'x' + ch));
    $('#cwIn').value = cw; $('#chIn').value = ch;
    renderLayers(); syncProps(); render();
    loadTransfer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
