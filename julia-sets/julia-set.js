// ===== STATE =====
const S = {
  type: 'julia', cReal: -0.7269, cImag: 0.1889, maxIter: 300, resScale: 1,
  centerX: 0, centerY: 0, zoom: 1,
  colorScheme: 'psychedelic',
  splitView: false, eduMode: false, showInfo: false,
  dragging: false, dragStartX: 0, dragStartY: 0, dragCX: 0, dragCY: 0,
  iterData: null, width: 0, height: 0,
  customStops: [
    { pos: 0, color: [0, 0, 0] }, { pos: 0.33, color: [255, 0, 100] },
    { pos: 0.66, color: [100, 200, 255] }, { pos: 1, color: [255, 255, 255] }
  ],
  selectedStop: 0,
  splitMbData: null, splitJlData: null,
  splitCenterX: -0.5, splitCenterY: 0, splitZoom: 1,
};

const PRESETS = [
  { name: 'Spiral', r: -0.7269, i: 0.1889 },
  { name: 'Dendrite', r: 0, i: -1 },
  { name: 'Rabbit', r: -0.123, i: 0.745 },
  { name: 'San Marco', r: -0.75, i: 0 },
  { name: 'Siegel', r: -0.391, i: -0.587 },
  { name: 'Dragon', r: -0.8, i: 0.156 },
  { name: 'Lightning', r: -0.4, i: 0.6 },
  { name: 'Starfish', r: -0.54, i: 0.54 },
  { name: 'Galaxy', r: 0.355, i: 0.355 },
  { name: 'Frost', r: -0.1, i: 0.651 },
];

const INFO_TEXT = {
  julia: `<b>The Julia Set</b> is defined for a fixed complex constant <i>c</i>. For each point <i>z</i> in the complex plane, we iterate z \u2192 z\u00B2 + c and check if the orbit escapes. Points that never escape form the Julia set (shown in black). The boundary is where the fascinating fractal structure lives. Each value of <i>c</i> produces a unique Julia set \u2014 connected sets correspond to <i>c</i> values inside the Mandelbrot set.`,
  mandelbrot: `<b>The Mandelbrot Set</b> is the "map" of all Julia sets. For each point <i>c</i>, we iterate z \u2192 z\u00B2 + c starting from z = 0. If the orbit stays bounded, <i>c</i> is in the Mandelbrot set. Each point in the Mandelbrot set corresponds to a connected Julia set. The boundary of the Mandelbrot set has infinite fractal complexity at every scale.`,
  burningship: `<b>The Burning Ship Fractal</b> uses a modified iteration: z \u2192 (|Re(z)| + i|Im(z)|)\u00B2 + c. The absolute values create asymmetric, sharp structures that resemble burning ships. Discovered by Michael Michelitsch and Otto R\u00F6ssler in 1992, it exhibits fractal structure similar to the Mandelbrot set but with a distinctly different character.`,
};

// ===== ELEMENTS =====
const $ = id => document.getElementById(id);
const fractalCanvas = $('fractalCanvas'), overlayCanvas = $('overlayCanvas');
const ctx = fractalCanvas.getContext('2d'), octx = overlayCanvas.getContext('2d');
const coordsEl = $('coords'), renderTimeEl = $('renderTime');

// ===== WEB WORKER =====
const workerCode = `
self.onmessage = function(e) {
  const d = e.data;
  const {width, height, xMin, xMax, yMin, yMax, cReal, cImag, maxIter, type, id} = d;
  const data = new Float64Array(width * height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const x0 = xMin + (xMax - xMin) * px / width;
      const y0 = yMin + (yMax - yMin) * py / height;
      let zr, zi, cr, ci;
      if (type === 'julia') { zr = x0; zi = y0; cr = cReal; ci = cImag; }
      else if (type === 'mandelbrot') { zr = 0; zi = 0; cr = x0; ci = y0; }
      else { zr = 0; zi = 0; cr = x0; ci = y0; }
      let iter = 0;
      while (iter < maxIter && zr * zr + zi * zi <= 4) {
        if (type === 'burningship') { zr = Math.abs(zr); zi = Math.abs(zi); }
        const tmp = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = tmp;
        iter++;
      }
      if (iter < maxIter) {
        const log_zn = Math.log(zr * zr + zi * zi) / 2;
        const nu = Math.log(log_zn / Math.LN2) / Math.LN2;
        data[py * width + px] = iter + 1 - nu;
      } else {
        data[py * width + px] = -1;
      }
    }
  }
  self.postMessage({data: data.buffer, width, height, id}, [data.buffer]);
};`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(workerBlob));
const worker2 = new Worker(URL.createObjectURL(workerBlob));
let renderId = 0, splitRenderId = 0;

// ===== COLOR SCHEMES =====
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) { return [lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t)]; }

function hsv2rgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v*(1-s), q = v*(1-f*s), t2 = v*(1-(1-f)*s);
  let r, g, b;
  switch (i % 6) {
    case 0: r=v;g=t2;b=p;break; case 1: r=q;g=v;b=p;break; case 2: r=p;g=v;b=t2;break;
    case 3: r=p;g=q;b=v;break; case 4: r=t2;g=p;b=v;break; case 5: r=v;g=p;b=q;break;
  }
  return [r*255, g*255, b*255];
}

function gradientColor(stops, t) {
  t = ((t % 1) + 1) % 1;
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].pos && t <= stops[i+1].pos) {
      const lt = (t - stops[i].pos) / (stops[i+1].pos - stops[i].pos);
      return lerpColor(stops[i].color, stops[i+1].color, lt);
    }
  }
  return stops[stops.length-1].color;
}

const COLOR_SCHEMES = {
  classic: t => gradientColor([
    {pos:0,color:[0,7,100]},{pos:0.16,color:[32,107,203]},{pos:0.42,color:[237,255,255]},
    {pos:0.65,color:[255,170,0]},{pos:0.86,color:[0,2,0]},{pos:1,color:[0,7,100]}
  ], t),
  fire: t => gradientColor([
    {pos:0,color:[0,0,0]},{pos:0.25,color:[128,0,0]},{pos:0.5,color:[255,128,0]},
    {pos:0.75,color:[255,255,0]},{pos:1,color:[255,255,255]}
  ], t),
  ocean: t => gradientColor([
    {pos:0,color:[0,0,30]},{pos:0.3,color:[0,50,120]},{pos:0.6,color:[0,150,200]},
    {pos:0.8,color:[100,220,255]},{pos:1,color:[200,255,255]}
  ], t),
  psychedelic: t => hsv2rgb(t * 5 + 0.6, 0.8, 1.0),
  neon: t => {
    const colors = [[255,0,128],[0,255,128],[128,0,255],[255,255,0],[0,255,255]];
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx), f = idx - i;
    return lerpColor(colors[Math.min(i, colors.length-1)], colors[Math.min(i+1, colors.length-1)], f);
  },
  sunset: t => gradientColor([
    {pos:0,color:[10,0,20]},{pos:0.2,color:[80,0,80]},{pos:0.4,color:[200,50,50]},
    {pos:0.6,color:[255,150,50]},{pos:0.8,color:[255,220,100]},{pos:1,color:[255,250,200]}
  ], t),
  grayscale: t => { const v = t * 255; return [v, v, v]; },
  ice: t => gradientColor([
    {pos:0,color:[0,0,40]},{pos:0.2,color:[20,60,120]},{pos:0.4,color:[80,140,200]},
    {pos:0.6,color:[160,200,240]},{pos:0.8,color:[220,240,255]},{pos:1,color:[255,255,255]}
  ], t),
  custom: t => gradientColor(S.customStops, t),
};

function getColor(smoothIter) {
  if (smoothIter < 0) return [0, 0, 0];
  const t = (smoothIter / 40) % 1;
  return COLOR_SCHEMES[S.colorScheme](t);
}

// ===== RENDERING =====
function getViewBounds(cx, cy, zoom, w, h) {
  const aspect = w / h;
  const rh = 2.5 / zoom, rw = rh * aspect;
  return { xMin: cx - rw, xMax: cx + rw, yMin: cy - rh, yMax: cy + rh };
}

function renderFractal(canvas, targetCtx, opts, callback) {
  const w = canvas.width, h = canvas.height;
  const bounds = getViewBounds(opts.cx, opts.cy, opts.zoom, w, h);
  const id = ++renderId;
  const t0 = performance.now();
  const targetWorker = opts.worker || worker;
  const handler = function onMsg(e) {
    if (e.data.id !== id) return;
    targetWorker.removeEventListener('message', handler);
    const data = new Float64Array(e.data.data);
    const imgData = targetCtx.createImageData(w, h);
    const px = imgData.data;
    for (let i = 0; i < data.length; i++) {
      const c = getColor(data[i]);
      const j = i * 4;
      px[j] = c[0]; px[j+1] = c[1]; px[j+2] = c[2]; px[j+3] = 255;
    }
    targetCtx.putImageData(imgData, 0, 0);
    const elapsed = (performance.now() - t0).toFixed(0);
    if (!opts.quiet) renderTimeEl.textContent = `${elapsed}ms | ${w}x${h}`;
    if (callback) callback(data);
  };
  targetWorker.addEventListener('message', handler);
  targetWorker.postMessage({
    width: w, height: h, ...bounds,
    cReal: opts.cr, cImag: opts.ci, maxIter: opts.maxIter, type: opts.type, id
  });
}

function render() {
  if (S.splitView) return;
  renderFractal(fractalCanvas, ctx, {
    cx: S.centerX, cy: S.centerY, zoom: S.zoom,
    cr: S.cReal, ci: S.cImag, maxIter: S.maxIter, type: S.type
  }, data => { S.iterData = data; });
}

function resizeCanvases() {
  const wrap = $('canvasWrap');
  const dw = wrap.clientWidth, dh = wrap.clientHeight;
  if (dw === 0 || dh === 0) return;
  const w = Math.round(dw * S.resScale), h = Math.round(dh * S.resScale);
  fractalCanvas.style.width = dw + 'px'; fractalCanvas.style.height = dh + 'px';
  fractalCanvas.width = w; fractalCanvas.height = h;
  overlayCanvas.style.width = dw + 'px'; overlayCanvas.style.height = dh + 'px';
  overlayCanvas.width = w; overlayCanvas.height = h;
  S.width = w; S.height = h;
  if (!S.splitView) render();
}

// ===== PIXEL <-> COMPLEX =====
// Convert display-space coords to canvas-space coords
function displayToCanvas(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const dx = clientX - rect.left, dy = clientY - rect.top;
  return { x: dx * el.width / rect.width, y: dy * el.height / rect.height };
}
function pxToComplex(px, py, cx, cy, zoom, w, h) {
  const b = getViewBounds(cx, cy, zoom, w, h);
  return { re: b.xMin + (b.xMax - b.xMin) * px / w, im: b.yMin + (b.yMax - b.yMin) * py / h };
}

// ===== RENDER THROTTLE =====
let renderPending = false;
function throttledRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
}

// ===== MOUSE INTERACTION =====
fractalCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  const {x: mx, y: my} = displayToCanvas(fractalCanvas, e.clientX, e.clientY);
  const before = pxToComplex(mx, my, S.centerX, S.centerY, S.zoom, S.width, S.height);
  S.zoom *= e.deltaY < 0 ? 1.3 : 1 / 1.3;
  const after = pxToComplex(mx, my, S.centerX, S.centerY, S.zoom, S.width, S.height);
  S.centerX += before.re - after.re;
  S.centerY += before.im - after.im;
  throttledRender();
}, { passive: false });

fractalCanvas.addEventListener('mousedown', e => {
  if (S.eduMode && e.button === 0) {
    const {x: mx, y: my} = displayToCanvas(fractalCanvas, e.clientX, e.clientY);
    showOrbit(mx, my);
    return;
  }
  S.dragging = true;
  S.dragStartX = e.clientX; S.dragStartY = e.clientY;
  S.dragCX = S.centerX; S.dragCY = S.centerY;
  fractalCanvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
  if (!S.dragging) {
    if (!S.splitView) {
      const {x: mx, y: my} = displayToCanvas(fractalCanvas, e.clientX, e.clientY);
      if (mx >= 0 && mx < S.width && my >= 0 && my < S.height) {
        const c = pxToComplex(mx, my, S.centerX, S.centerY, S.zoom, S.width, S.height);
        coordsEl.textContent = `${c.re.toFixed(6)} ${c.im >= 0 ? '+' : '-'} ${Math.abs(c.im).toFixed(6)}i | zoom: ${S.zoom.toFixed(1)}x`;
      }
    }
    return;
  }
  const dx = (e.clientX - S.dragStartX) * S.resScale, dy = (e.clientY - S.dragStartY) * S.resScale;
  const b = getViewBounds(S.dragCX, S.dragCY, S.zoom, S.width, S.height);
  const scaleX = (b.xMax - b.xMin) / S.width, scaleY = (b.yMax - b.yMin) / S.height;
  S.centerX = S.dragCX - dx * scaleX;
  S.centerY = S.dragCY - dy * scaleY;
  throttledRender();
});

window.addEventListener('mouseup', () => {
  S.dragging = false;
  fractalCanvas.style.cursor = S.eduMode ? 'pointer' : 'crosshair';
});

// ===== FRACTAL TYPE BUTTONS =====
document.querySelectorAll('[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.type = btn.dataset.type;
    $('paramSection').style.display = S.type === 'julia' ? '' : 'none';
    $('presetsSection').style.display = S.type === 'julia' ? '' : 'none';
    updateInfo();
    render();
  });
});

// ===== PRESETS =====
const presetsEl = $('presets');
PRESETS.forEach(p => {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = p.name;
  btn.addEventListener('click', () => {
    S.cReal = p.r; S.cImag = p.i;
    $('cReal').value = p.r; $('cRealVal').textContent = p.r.toFixed(4);
    $('cImag').value = p.i; $('cImagVal').textContent = p.i.toFixed(4);
    render();
  });
  presetsEl.appendChild(btn);
});

// ===== SLIDERS =====
function bindSlider(id, valId, prop, fmt, cb) {
  const el = $(id), valEl = $(valId);
  el.addEventListener('input', () => {
    S[prop] = parseFloat(el.value);
    valEl.textContent = fmt(S[prop]);
    if (cb) cb(); else throttledRender();
  });
}
bindSlider('cReal', 'cRealVal', 'cReal', v => v.toFixed(4));
bindSlider('cImag', 'cImagVal', 'cImag', v => v.toFixed(4));
bindSlider('maxIter', 'maxIterVal', 'maxIter', v => v.toString());

// ===== COLOR SCHEME =====
$('colorScheme').addEventListener('change', e => {
  S.colorScheme = e.target.value;
  $('gradientEditor').style.display = S.colorScheme === 'custom' ? '' : 'none';
  if (S.colorScheme === 'custom') updateGradientPreview();
  recolorFromCache();
});

function recolorFromCache() {
  if (S.splitView) { renderSplitView(); return; }
  if (!S.iterData) { render(); return; }
  const imgData = ctx.createImageData(S.width, S.height);
  const px = imgData.data;
  for (let i = 0; i < S.iterData.length; i++) {
    const c = getColor(S.iterData[i]);
    const j = i * 4;
    px[j] = c[0]; px[j+1] = c[1]; px[j+2] = c[2]; px[j+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

// ===== CUSTOM GRADIENT EDITOR =====
function updateGradientPreview() {
  const el = $('gradientPreview');
  const stops = S.customStops.map(s => `rgb(${s.color.join(',')}) ${s.pos*100}%`).join(',');
  el.style.background = `linear-gradient(to right, ${stops})`;
  el.innerHTML = '';
  S.customStops.forEach((s, i) => {
    const dot = document.createElement('div');
    dot.className = 'gradient-stop' + (i === S.selectedStop ? ' selected' : '');
    dot.style.left = (s.pos * 100) + '%';
    dot.style.backgroundColor = `rgb(${s.color.join(',')})`;
    dot.addEventListener('mousedown', e => {
      e.stopPropagation();
      S.selectedStop = i;
      $('stopColor').value = rgbToHex(s.color);
      $('stopPos').value = s.pos * 100;
      updateGradientPreview();
      let startX = e.clientX;
      const startPos = s.pos;
      const rect = el.getBoundingClientRect();
      const onMove = ev => {
        const dx = ev.clientX - startX;
        s.pos = Math.max(0, Math.min(1, startPos + dx / rect.width));
        S.customStops.sort((a, b) => a.pos - b.pos);
        S.selectedStop = S.customStops.indexOf(s);
        updateGradientPreview();
        if (S.colorScheme === 'custom') recolorFromCache();
      };
      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
    el.appendChild(dot);
  });
}

function rgbToHex(c) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join(''); }
function hexToRgb(h) { const m = h.match(/\w{2}/g); return m.map(v => parseInt(v, 16)); }

$('stopColor').addEventListener('input', e => {
  if (S.customStops[S.selectedStop]) {
    S.customStops[S.selectedStop].color = hexToRgb(e.target.value);
    updateGradientPreview();
    if (S.colorScheme === 'custom') recolorFromCache();
  }
});
$('stopPos').addEventListener('input', e => {
  if (S.customStops[S.selectedStop]) {
    S.customStops[S.selectedStop].pos = parseFloat(e.target.value) / 100;
    S.customStops.sort((a, b) => a.pos - b.pos);
    updateGradientPreview();
    if (S.colorScheme === 'custom') recolorFromCache();
  }
});
$('addStop').addEventListener('click', () => {
  S.customStops.push({ pos: 0.5, color: hexToRgb($('stopColor').value) });
  S.customStops.sort((a, b) => a.pos - b.pos);
  S.selectedStop = S.customStops.length - 1;
  updateGradientPreview();
  if (S.colorScheme === 'custom') recolorFromCache();
});
$('removeStop').addEventListener('click', () => {
  if (S.customStops.length > 2) {
    S.customStops.splice(S.selectedStop, 1);
    S.selectedStop = Math.min(S.selectedStop, S.customStops.length - 1);
    updateGradientPreview();
    if (S.colorScheme === 'custom') recolorFromCache();
  }
});

// ===== SPLIT VIEW =====
$('splitToggle').addEventListener('click', () => {
  S.splitView = !S.splitView;
  $('splitToggle').classList.toggle('on', S.splitView);
  $('canvasWrap').style.display = S.splitView ? 'none' : '';
  $('splitWrap').style.display = S.splitView ? 'flex' : 'none';
  if (S.splitView) {
    resizeSplitCanvases();
    renderSplitView();
  } else {
    resizeCanvases();
  }
});

function resizeSplitCanvases() {
  const wrap = $('splitWrap');
  const dw = Math.floor(wrap.clientWidth / 2), dh = wrap.clientHeight;
  const w = Math.round(dw * S.resScale), h = Math.round(dh * S.resScale);
  $('mandelbrotCanvas').style.width = dw + 'px'; $('mandelbrotCanvas').style.height = dh + 'px';
  $('mandelbrotCanvas').width = w; $('mandelbrotCanvas').height = h;
  $('juliaCanvas').style.width = dw + 'px'; $('juliaCanvas').style.height = dh + 'px';
  $('juliaCanvas').width = w; $('juliaCanvas').height = h;
}

function renderSplitView() {
  const mbCanvas = $('mandelbrotCanvas'), jlCanvas = $('juliaCanvas');
  const mbCtx = mbCanvas.getContext('2d'), jlCtx = jlCanvas.getContext('2d');
  renderFractal(mbCanvas, mbCtx, {
    cx: S.splitCenterX, cy: S.splitCenterY, zoom: S.splitZoom,
    cr: 0, ci: 0, maxIter: S.maxIter, type: 'mandelbrot', quiet: true, worker: worker2
  });
  renderFractal(jlCanvas, jlCtx, {
    cx: S.centerX, cy: S.centerY, zoom: S.zoom,
    cr: S.cReal, ci: S.cImag, maxIter: S.maxIter, type: 'julia', quiet: false, worker: worker
  }, data => { S.iterData = data; });
  $('splitJuliaLabel').textContent = `Julia: c = ${S.cReal.toFixed(4)} + ${S.cImag.toFixed(4)}i`;
  drawSplitCrosshair();
}

function drawSplitCrosshair() {
  const mbCanvas = $('mandelbrotCanvas');
  const w = mbCanvas.width, h = mbCanvas.height;
  const b = getViewBounds(S.splitCenterX, S.splitCenterY, S.splitZoom, w, h);
  const px = (S.cReal - b.xMin) / (b.xMax - b.xMin) * w;
  const py = (S.cImag - b.yMin) / (b.yMax - b.yMin) * h;
  const mbCtx = mbCanvas.getContext('2d');
  setTimeout(() => {
    mbCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    mbCtx.lineWidth = 1;
    mbCtx.beginPath(); mbCtx.moveTo(px - 10, py); mbCtx.lineTo(px + 10, py);
    mbCtx.moveTo(px, py - 10); mbCtx.lineTo(px, py + 10); mbCtx.stroke();
    mbCtx.strokeStyle = 'rgba(233,69,96,0.8)';
    mbCtx.beginPath(); mbCtx.arc(px, py, 5, 0, Math.PI * 2); mbCtx.stroke();
  }, 100);
}

$('mandelbrotCanvas').addEventListener('click', e => {
  const {x: mx, y: my} = displayToCanvas(e.target, e.clientX, e.clientY);
  const c = pxToComplex(mx, my, S.splitCenterX, S.splitCenterY, S.splitZoom, e.target.width, e.target.height);
  S.cReal = c.re; S.cImag = c.im;
  $('cReal').value = c.re; $('cRealVal').textContent = c.re.toFixed(4);
  $('cImag').value = c.im; $('cImagVal').textContent = c.im.toFixed(4);
  renderSplitView();
});

$('mandelbrotCanvas').addEventListener('wheel', e => {
  e.preventDefault();
  const {x: mx, y: my} = displayToCanvas(e.target, e.clientX, e.clientY);
  const before = pxToComplex(mx, my, S.splitCenterX, S.splitCenterY, S.splitZoom, e.target.width, e.target.height);
  S.splitZoom *= e.deltaY < 0 ? 1.3 : 1 / 1.3;
  const after = pxToComplex(mx, my, S.splitCenterX, S.splitCenterY, S.splitZoom, e.target.width, e.target.height);
  S.splitCenterX += before.re - after.re;
  S.splitCenterY += before.im - after.im;
  renderSplitView();
}, { passive: false });

// Mandelbrot split pan
let splitDrag = false, splitDragStart = {x:0,y:0}, splitDragCenter = {x:0,y:0};
$('mandelbrotCanvas').addEventListener('mousedown', e => {
  if (e.button === 2) {
    splitDrag = true; splitDragStart = {x: e.clientX, y: e.clientY};
    splitDragCenter = {x: S.splitCenterX, y: S.splitCenterY};
    e.preventDefault();
  }
});
$('mandelbrotCanvas').addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
  if (!splitDrag) return;
  const dx = (e.clientX - splitDragStart.x) * S.resScale, dy = (e.clientY - splitDragStart.y) * S.resScale;
  const mb = $('mandelbrotCanvas');
  const b = getViewBounds(splitDragCenter.x, splitDragCenter.y, S.splitZoom, mb.width, mb.height);
  S.splitCenterX = splitDragCenter.x - dx * (b.xMax - b.xMin) / mb.width;
  S.splitCenterY = splitDragCenter.y - dy * (b.yMax - b.yMin) / mb.height;
  renderSplitView();
});
window.addEventListener('mouseup', () => { splitDrag = false; });

// Julia split canvas interactions
$('juliaCanvas').addEventListener('wheel', e => {
  e.preventDefault();
  const {x: mx, y: my} = displayToCanvas(e.target, e.clientX, e.clientY);
  const before = pxToComplex(mx, my, S.centerX, S.centerY, S.zoom, e.target.width, e.target.height);
  S.zoom *= e.deltaY < 0 ? 1.3 : 1 / 1.3;
  const after = pxToComplex(mx, my, S.centerX, S.centerY, S.zoom, e.target.width, e.target.height);
  S.centerX += before.re - after.re;
  S.centerY += before.im - after.im;
  renderSplitView();
}, { passive: false });

// ===== EDUCATIONAL MODE =====
$('eduToggle').addEventListener('click', () => {
  S.eduMode = !S.eduMode;
  $('eduToggle').classList.toggle('on', S.eduMode);
  fractalCanvas.style.cursor = S.eduMode ? 'pointer' : 'crosshair';
  octx.clearRect(0, 0, S.width, S.height);
  $('orbitPanel').style.display = 'none';
});

function showOrbit(px, py) {
  const z0 = pxToComplex(px, py, S.centerX, S.centerY, S.zoom, S.width, S.height);
  let zr = z0.re, zi = z0.im;
  const cr = S.type === 'julia' ? S.cReal : z0.re;
  const ci = S.type === 'julia' ? S.cImag : z0.im;
  if (S.type !== 'julia') { zr = 0; zi = 0; }
  const orbit = [{ re: zr, im: zi }];
  let escaped = false;
  for (let i = 0; i < Math.min(S.maxIter, 50); i++) {
    if (S.type === 'burningship') { zr = Math.abs(zr); zi = Math.abs(zi); }
    const tmp = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = tmp;
    orbit.push({ re: zr, im: zi });
    if (zr * zr + zi * zi > 100) { escaped = true; break; }
  }

  // Draw orbit on overlay
  octx.clearRect(0, 0, S.width, S.height);
  octx.lineWidth = 1.5;
  for (let i = 0; i < orbit.length - 1; i++) {
    const t = i / orbit.length;
    const b = getViewBounds(S.centerX, S.centerY, S.zoom, S.width, S.height);
    const x1 = (orbit[i].re - b.xMin) / (b.xMax - b.xMin) * S.width;
    const y1 = (orbit[i].im - b.yMin) / (b.yMax - b.yMin) * S.height;
    const x2 = (orbit[i+1].re - b.xMin) / (b.xMax - b.xMin) * S.width;
    const y2 = (orbit[i+1].im - b.yMin) / (b.yMax - b.yMin) * S.height;
    octx.strokeStyle = `hsla(${t * 300}, 100%, 60%, 0.7)`;
    octx.beginPath(); octx.moveTo(x1, y1); octx.lineTo(x2, y2); octx.stroke();
  }
  // Draw dots
  const b = getViewBounds(S.centerX, S.centerY, S.zoom, S.width, S.height);
  orbit.forEach((p, i) => {
    const x = (p.re - b.xMin) / (b.xMax - b.xMin) * S.width;
    const y = (p.im - b.yMin) / (b.yMax - b.yMin) * S.height;
    const t = i / orbit.length;
    octx.fillStyle = `hsl(${t * 300}, 100%, 60%)`;
    octx.beginPath(); octx.arc(x, y, i === 0 ? 5 : 3, 0, Math.PI * 2); octx.fill();
    if (i === 0) {
      octx.strokeStyle = '#fff'; octx.lineWidth = 2;
      octx.beginPath(); octx.arc(x, y, 6, 0, Math.PI * 2); octx.stroke();
    }
  });

  // Update panel
  $('orbitPanel').style.display = 'block';
  $('orbitInfo').innerHTML = `Point: ${z0.re.toFixed(4)} + ${z0.im.toFixed(4)}i<br>` +
    `Iterations: ${orbit.length - 1} | ${escaped ? '<span style="color:#f85149">Escaped</span>' : '<span style="color:#3fb950">Bounded</span>'}` +
    `<br>|z<sub>final</sub>| = ${Math.sqrt(orbit[orbit.length-1].re**2 + orbit[orbit.length-1].im**2).toFixed(4)}`;
  let tableHTML = '<tr><td style="color:var(--text-dim)">n</td><td>Re(z)</td><td>Im(z)</td><td>|z|</td></tr>';
  const showCount = Math.min(orbit.length, 30);
  for (let i = 0; i < showCount; i++) {
    const mag = Math.sqrt(orbit[i].re**2 + orbit[i].im**2);
    tableHTML += `<tr><td style="color:var(--text-dim)">${i}</td><td>${orbit[i].re.toFixed(6)}</td><td>${orbit[i].im.toFixed(6)}</td><td>${mag.toFixed(4)}</td></tr>`;
  }
  if (orbit.length > 30) tableHTML += `<tr><td colspan="4" style="color:var(--text-dim)">... ${orbit.length - 30} more</td></tr>`;
  $('orbitTable').innerHTML = tableHTML;
}

// ===== INFO PANEL =====
$('infoToggle').addEventListener('click', () => {
  S.showInfo = !S.showInfo;
  $('infoToggle').classList.toggle('on', S.showInfo);
  $('infoPanel').classList.toggle('visible', S.showInfo);
});

function updateInfo() {
  $('infoTitle').textContent = S.type === 'julia' ? 'Julia Set' : S.type === 'mandelbrot' ? 'Mandelbrot Set' : 'Burning Ship';
  $('infoText').innerHTML = INFO_TEXT[S.type];
}

// ===== EXPORT =====
$('saveBtn').addEventListener('click', () => {
  const sourceCanvas = S.splitView ? $('juliaCanvas') : fractalCanvas;
  const link = document.createElement('a');
  link.download = `fractal-${S.type}-${Date.now()}.png`;
  link.href = sourceCanvas.toDataURL('image/png');
  link.click();
});

$('hiresBtn').addEventListener('click', () => {
  const base = S.splitView ? $('juliaCanvas') : fractalCanvas;
  $('hiresModal').classList.add('visible');
  updateHiresInfo(base);
});
$('hiresScale').addEventListener('change', () => {
  const base = S.splitView ? $('juliaCanvas') : fractalCanvas;
  updateHiresInfo(base);
});
$('hiresClose').addEventListener('click', () => $('hiresModal').classList.remove('visible'));

function updateHiresInfo(base) {
  const scale = parseInt($('hiresScale').value);
  $('hiresInfo').textContent = `Output: ${base.width * scale} x ${base.height * scale} pixels`;
}

$('hiresRender').addEventListener('click', () => {
  const scale = parseInt($('hiresScale').value);
  const base = S.splitView ? $('juliaCanvas') : fractalCanvas;
  const w = base.width * scale, h = base.height * scale;
  const offscreen = document.createElement('canvas');
  offscreen.width = w; offscreen.height = h;
  const offCtx = offscreen.getContext('2d');
  $('hiresProgress').style.display = 'block';
  $('hiresFill').style.width = '20%';
  const hiresWorker = new Worker(URL.createObjectURL(workerBlob));
  const bounds = getViewBounds(S.centerX, S.centerY, S.zoom, w, h);
  const hiresId = Date.now();
  hiresWorker.onmessage = e => {
    $('hiresFill').style.width = '80%';
    const data = new Float64Array(e.data.data);
    const imgData = offCtx.createImageData(w, h);
    const px = imgData.data;
    for (let i = 0; i < data.length; i++) {
      const c = getColor(data[i]);
      const j = i * 4;
      px[j] = c[0]; px[j+1] = c[1]; px[j+2] = c[2]; px[j+3] = 255;
    }
    offCtx.putImageData(imgData, 0, 0);
    $('hiresFill').style.width = '100%';
    offscreen.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `fractal-${S.type}-${w}x${h}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      hiresWorker.terminate();
      setTimeout(() => {
        $('hiresModal').classList.remove('visible');
        $('hiresProgress').style.display = 'none';
        $('hiresFill').style.width = '0%';
      }, 500);
    }, 'image/png');
  };
  hiresWorker.postMessage({
    width: w, height: h, ...bounds,
    cReal: S.cReal, cImag: S.cImag, maxIter: S.maxIter, type: S.type, id: hiresId
  });
});

// ===== RESET VIEW =====
$('resetView').addEventListener('click', () => {
  S.centerX = 0; S.centerY = 0; S.zoom = 1;
  S.splitCenterX = -0.5; S.splitCenterY = 0; S.splitZoom = 1;
  if (S.splitView) renderSplitView(); else render();
});

// ===== TOUCH SUPPORT =====
let lastTouchDist = 0, lastTouchCenter = null;
fractalCanvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    if (S.eduMode) {
      const {x: tx, y: ty} = displayToCanvas(fractalCanvas, e.touches[0].clientX, e.touches[0].clientY);
      showOrbit(tx, ty);
      return;
    }
    S.dragging = true;
    S.dragStartX = e.touches[0].clientX; S.dragStartY = e.touches[0].clientY;
    S.dragCX = S.centerX; S.dragCY = S.centerY;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDist = Math.sqrt(dx*dx + dy*dy);
    lastTouchCenter = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  }
}, { passive: false });

fractalCanvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1 && S.dragging) {
    const dx = (e.touches[0].clientX - S.dragStartX) * S.resScale;
    const dy = (e.touches[0].clientY - S.dragStartY) * S.resScale;
    const b = getViewBounds(S.dragCX, S.dragCY, S.zoom, S.width, S.height);
    S.centerX = S.dragCX - dx * (b.xMax - b.xMin) / S.width;
    S.centerY = S.dragCY - dy * (b.yMax - b.yMin) / S.height;
    throttledRender();
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (lastTouchDist > 0) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const {x: cx, y: cy} = displayToCanvas(fractalCanvas, midX, midY);
      const before = pxToComplex(cx, cy, S.centerX, S.centerY, S.zoom, S.width, S.height);
      S.zoom *= dist / lastTouchDist;
      const after = pxToComplex(cx, cy, S.centerX, S.centerY, S.zoom, S.width, S.height);
      S.centerX += before.re - after.re;
      S.centerY += before.im - after.im;
      throttledRender();
    }
    lastTouchDist = dist;
  }
}, { passive: false });

fractalCanvas.addEventListener('touchend', () => { S.dragging = false; lastTouchDist = 0; });

// ===== INIT =====
function init() {
  updateInfo();
  updateGradientPreview();
  window.addEventListener('resize', () => {
    if (S.splitView) { resizeSplitCanvases(); renderSplitView(); }
    else resizeCanvases();
  });
  resizeCanvases();
}

init();
