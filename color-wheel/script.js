/* ═══════════════════════════════════════════════════════════
   RGB Color Explorer — script.js
   ═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   Color Math
───────────────────────────────────────────── */

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6;               break;
      case b: h = ((r - g) / d + 4) / 6;               break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function getLuminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function getContrastColor(r, g, b) {
  return getLuminance(r, g, b) > 0.5 ? '#111111' : '#f7f7f9';
}

/* ─────────────────────────────────────────────
   Color Naming
───────────────────────────────────────────── */

const HUE_NAMES = [
  [0,   12,  'Red'],         [12,  22,  'Coral'],
  [22,  38,  'Orange'],      [38,  55,  'Amber'],
  [55,  70,  'Yellow'],      [70,  85,  'Lime'],
  [85,  145, 'Green'],       [145, 165, 'Emerald'],
  [165, 185, 'Teal'],        [185, 210, 'Cyan'],
  [210, 238, 'Sky Blue'],    [238, 265, 'Blue'],
  [265, 288, 'Indigo'],      [288, 318, 'Violet'],
  [318, 345, 'Fuchsia'],     [345, 360, 'Red'],
];

function getColorName(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 8) {
    if (l < 5)  return 'Black';
    if (l < 18) return 'Near Black';
    if (l < 38) return 'Dark Gray';
    if (l < 58) return 'Gray';
    if (l < 80) return 'Silver';
    return 'White';
  }
  let base = 'Color';
  for (const [min, max, name] of HUE_NAMES) {
    if (h >= min && h < max) { base = name; break; }
  }
  let mod = '';
  if      (s > 82 && l >= 42 && l <= 62) mod = 'Vivid ';
  else if (l < 22)  mod = 'Dark ';
  else if (l < 34)  mod = 'Deep ';
  else if (l > 78 && s < 55) mod = 'Light ';
  else if (l > 68)  mod = 'Soft ';
  return mod + base;
}

/* ─────────────────────────────────────────────
   Harmony Palette Generation
───────────────────────────────────────────── */

function clampL(v) { return Math.min(88, Math.max(12, v)); }
function clampS(v) { return Math.min(100, Math.max(0, v)); }

function generateHarmonyPalette(r, g, b, harmony) {
  const [h, s, l] = rgbToHsl(r, g, b);

  switch (harmony) {
    case 'complementary':
      return [
        hslToRgb(h,                      s,         l),
        hslToRgb(h,                      clampS(s - 18), clampL(l + 22)),
        hslToRgb(h,                      s,         clampL(l - 18)),
        hslToRgb((h + 180) % 360,        s,         l),
        hslToRgb((h + 180) % 360,        s,         clampL(l + 20)),
      ];
    case 'analogous':
      return [
        hslToRgb((h - 30 + 360) % 360, s, l),
        hslToRgb((h - 15 + 360) % 360, s, l),
        hslToRgb(h,                    s, l),
        hslToRgb((h + 15) % 360,       s, l),
        hslToRgb((h + 30) % 360,       s, l),
      ];
    case 'triadic':
      return [
        hslToRgb(h,                s, l),
        hslToRgb(h,                s, clampL(l + 22)),
        hslToRgb((h + 120) % 360, s, l),
        hslToRgb((h + 240) % 360, s, l),
        hslToRgb((h + 240) % 360, s, clampL(l + 22)),
      ];
    case 'split-complementary':
      return [
        hslToRgb(h,                s, l),
        hslToRgb(h,                s, clampL(l + 22)),
        hslToRgb((h + 150) % 360, s, l),
        hslToRgb((h + 210) % 360, s, l),
        hslToRgb((h + 210) % 360, s, clampL(l + 22)),
      ];
    default:
      return [hslToRgb(h, s, l)];
  }
}

/* ─────────────────────────────────────────────
   Custom Scale Generation
   Generates a Tailwind-style tint/shade scale
   from a single base color.
───────────────────────────────────────────── */

// 11-stop lightness/saturation curve (light → dark)
const SCALE_STOPS = [
  { l: 96, s: -36 }, // 50
  { l: 88, s: -24 }, // 100
  { l: 78, s: -14 }, // 200
  { l: 67, s: -7  }, // 300
  { l: 55, s: -2  }, // 400
  { l: 44, s:  4  }, // 500
  { l: 34, s:  8  }, // 600
  { l: 25, s: 10  }, // 700
  { l: 17, s:  9  }, // 800
  { l: 10, s:  7  }, // 900
  { l:  6, s:  4  }, // 950
];

// Standard shade labels for each count
const SCALE_LABELS = {
  5:  ['100', '300', '500', '700', '900'],
  7:  ['50', '100', '300', '500', '700', '900', '950'],
  9:  ['50', '100', '200', '400', '500', '600', '800', '900', '950'],
  11: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
};

/**
 * Generates a tint/shade scale from a single RGB base color.
 * Returns an array of `count` [r,g,b] tuples, light → dark.
 */
function generateCustomPalette(r, g, b, count = 7) {
  const [h, s] = rgbToHsl(r, g, b);

  const numStops = SCALE_STOPS.length;
  const step = (numStops - 1) / (count - 1);

  return Array.from({ length: count }, (_, i) => {
    const idx  = Math.round(i * step);
    const stop = SCALE_STOPS[idx];
    const sat  = clampS(s + stop.s);
    return hslToRgb(h, sat, stop.l);
  });
}

/**
 * Exports a scale palette as a CSS :root block with custom properties.
 */
function exportScaleAsCSS(colors, count) {
  const labels = SCALE_LABELS[count] || colors.map((_, i) => String((i + 1) * 100));
  const lines  = colors.map((rgb, i) => `  --color-${labels[i]}: ${rgbToHex(...rgb)};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

/* ─────────────────────────────────────────────
   DOM References
───────────────────────────────────────────── */

const canvas      = document.getElementById('spotlight-canvas');
const ctx         = canvas.getContext('2d');
const canvasWrap  = document.getElementById('canvas-wrap');

const rSlider  = document.getElementById('r-slider');
const gSlider  = document.getElementById('g-slider');
const bSlider  = document.getElementById('b-slider');
const rValEl   = document.getElementById('r-val');
const gValEl   = document.getElementById('g-val');
const bValEl   = document.getElementById('b-val');

const colorSwatch = document.getElementById('color-swatch');
const hexDisplay  = document.getElementById('hex-display');
const rgbDisplay  = document.getElementById('rgb-display');
const colorNameEl = document.getElementById('color-name');

const sendToPaletteBtn = document.getElementById('send-to-palette');
const sendToScaleBtn   = document.getElementById('send-to-scale');
const resetBtn         = document.getElementById('reset-btn');

const colorPicker = document.getElementById('color-picker');
const hexInput    = document.getElementById('hex-input');
const harmonyBtns = document.querySelectorAll('.harmony-btn');
const randomizeBtn = document.getElementById('randomize-btn');
const swatchesGrid = document.getElementById('palette-swatches');

const wheelCanvas = document.getElementById('wheel-canvas');
const wheelCtx    = wheelCanvas.getContext('2d');

const scalePicker   = document.getElementById('scale-picker');
const scaleHexInput = document.getElementById('scale-hex-input');
const countBtns     = document.querySelectorAll('.count-btn');
const genScaleBtn   = document.getElementById('generate-scale-btn');
const useExplorerBtn = document.getElementById('use-explorer-color');
const scaleSwatches = document.getElementById('scale-swatches');
const exportCssBtn  = document.getElementById('export-css-btn');
const cssExportBox  = document.getElementById('css-export-box');
const cssExportCode = document.getElementById('css-export-code');
const copyCssBtn    = document.getElementById('copy-css-btn');

const tabs      = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const tabIndicator = document.getElementById('tab-indicator');

const toastEl = document.getElementById('toast');

/* ─────────────────────────────────────────────
   App State
───────────────────────────────────────────── */

const state = {
  r: 128, g: 64, b: 200,
  harmony: 'complementary',
  palette: [],
  // palette tab base color
  paletteR: 128, paletteG: 64, paletteB: 200,
  // scale tab
  scaleR: 128, scaleG: 64, scaleB: 200,
  scaleCount: 7,
  scaleColors: [],
};

/* ─────────────────────────────────────────────
   Toast
───────────────────────────────────────────── */

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${text.toUpperCase()}`);
  }).catch(() => {
    const ta = Object.assign(document.createElement('textarea'), {
      value: text,
      style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`Copied ${text.toUpperCase()}`);
  });
}

/* ─────────────────────────────────────────────
   Spotlight Canvas
───────────────────────────────────────────── */

const spotlights = [
  { label: 'R', colorFn: () => [state.r, 0, 0], x: 0, y: 0, radius: 0, dragging: false },
  { label: 'G', colorFn: () => [0, state.g, 0], x: 0, y: 0, radius: 0, dragging: false },
  { label: 'B', colorFn: () => [0, 0, state.b], x: 0, y: 0, radius: 0, dragging: false },
];

let dragTarget = null;

function initSpotlightPositions() {
  const w = canvas.clientWidth  || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  const r = Math.min(w, h) * 0.32;
  spotlights[0].radius = r;
  spotlights[1].radius = r;
  spotlights[2].radius = r;
  spotlights[0].x = w * 0.35; spotlights[0].y = h * 0.42;
  spotlights[1].x = w * 0.65; spotlights[1].y = h * 0.42;
  spotlights[2].x = w * 0.50; spotlights[2].y = h * 0.68;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w   = canvasWrap.clientWidth;
  const h   = canvasWrap.clientHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  initSpotlightPositions();
}

function drawSpotlights() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.fillStyle = '#040407';
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'lighter';
  spotlights.forEach(s => {
    const [r, g, b] = s.colorFn();
    if (!r && !g && !b) return;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
    grad.addColorStop(0,    `rgba(${r},${g},${b},0.95)`);
    grad.addColorStop(0.22, `rgba(${r},${g},${b},0.72)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},0.3)`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = 'source-over';

  // Drag handles
  spotlights.forEach(s => {
    const [r, g, b] = s.colorFn();
    const baseColor = r ? '#ff4055' : g ? '#3dff7a' : '#4a8eff';
    const alpha = s.dragging ? 1 : 0.55;

    // Glow ring
    ctx.shadowColor = baseColor;
    ctx.shadowBlur  = s.dragging ? 16 : 8;
    ctx.strokeStyle = `rgba(${r || 200},${g || 200},${b || 200},${alpha})`;
    ctx.lineWidth   = s.dragging ? 2 : 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle    = `rgba(255,255,255,${alpha + 0.1})`;
    ctx.font         = '700 11px DM Sans, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, s.x, s.y);
  });
}

function animateCanvas() {
  drawSpotlights();
  requestAnimationFrame(animateCanvas);
}

/* ─────────────────────────────────────────────
   Drag
───────────────────────────────────────────── */

function getCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return [src.clientX - rect.left, src.clientY - rect.top];
}

function onDragStart(e) {
  const [mx, my] = getCanvasXY(e);
  let best = null, bestDist = 44;
  spotlights.forEach(s => {
    const d = Math.hypot(mx - s.x, my - s.y);
    if (d < bestDist) { bestDist = d; best = s; }
  });
  if (best) {
    dragTarget = best;
    dragTarget.dragging = true;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }
}

function onDragMove(e) {
  if (!dragTarget) return;
  const [mx, my] = getCanvasXY(e);
  dragTarget.x = Math.max(0, Math.min(canvas.clientWidth,  mx));
  dragTarget.y = Math.max(0, Math.min(canvas.clientHeight, my));
  e.preventDefault();
}

function onDragEnd() {
  if (dragTarget) { dragTarget.dragging = false; dragTarget = null; }
  canvas.style.cursor = 'default';
}

canvas.addEventListener('mousedown',  onDragStart, { passive: false });
canvas.addEventListener('mousemove',  onDragMove,  { passive: false });
canvas.addEventListener('mouseup',    onDragEnd);
canvas.addEventListener('mouseleave', onDragEnd);
canvas.addEventListener('touchstart', onDragStart, { passive: false });
canvas.addEventListener('touchmove',  onDragMove,  { passive: false });
canvas.addEventListener('touchend',   onDragEnd);

/* ─────────────────────────────────────────────
   Slider Fill (dynamic gradient tracks)
───────────────────────────────────────────── */

function updateSliderFill(slider, value, trackColor) {
  const pct = (value / 255) * 100;
  slider.style.background =
    `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${pct}%, rgba(255,255,255,0.06) ${pct}%, rgba(255,255,255,0.06) 100%)`;
}

/* ─────────────────────────────────────────────
   Explorer: Update Display
───────────────────────────────────────────── */

function updateExplorerDisplay() {
  const { r, g, b } = state;
  const hex  = rgbToHex(r, g, b);
  const name = getColorName(r, g, b);

  // Swatch
  colorSwatch.style.backgroundColor = hex;
  colorSwatch.style.setProperty('--sg-l', `rgba(${r},${g},${b},0.25)`);
  colorSwatch.style.setProperty('--sg-s', `rgba(${r},${g},${b},0.52)`);

  // Canvas glow
  canvasWrap.style.setProperty('--canvas-glow', `rgba(${r},${g},${b},0.22)`);

  hexDisplay.textContent  = hex.toUpperCase();
  rgbDisplay.innerHTML    = `R: ${r} &nbsp; G: ${g} &nbsp; B: ${b}`;
  colorNameEl.textContent = name;

  rValEl.textContent = r;
  gValEl.textContent = g;
  bValEl.textContent = b;

  // Slider values sync
  rSlider.value = r;
  gSlider.value = g;
  bSlider.value = b;

  // Dynamic fills
  updateSliderFill(rSlider, r, '#ff4055');
  updateSliderFill(gSlider, g, '#3dff7a');
  updateSliderFill(bSlider, b, '#4a8eff');
}

function onSliderChange() {
  state.r = +rSlider.value;
  state.g = +gSlider.value;
  state.b = +bSlider.value;
  updateExplorerDisplay();
}

rSlider.addEventListener('input', onSliderChange);
gSlider.addEventListener('input', onSliderChange);
bSlider.addEventListener('input', onSliderChange);

hexDisplay.addEventListener('click', () => copyToClipboard(hexDisplay.textContent));
colorSwatch.addEventListener('click', () => copyToClipboard(hexDisplay.textContent));

resetBtn.addEventListener('click', () => initSpotlightPositions());

/* ─────────────────────────────────────────────
   Palette Tab: Swatches
───────────────────────────────────────────── */

function makeSwatch(r, g, b, delay = 0) {
  const hex  = rgbToHex(r, g, b);
  const name = getColorName(r, g, b);

  const card = document.createElement('div');
  card.className = 'swatch-card';
  card.style.animationDelay = `${delay}ms`;
  card.title = `Click to copy ${hex.toUpperCase()}`;

  const colorDiv = document.createElement('div');
  colorDiv.className = 'swatch-color';
  colorDiv.style.backgroundColor = hex;

  const overlay = document.createElement('div');
  overlay.className = 'swatch-copy-overlay';
  colorDiv.appendChild(overlay);

  const infoDiv = document.createElement('div');
  infoDiv.className = 'swatch-info';
  infoDiv.innerHTML = `
    <div class="swatch-hex">${hex.toUpperCase()}</div>
    <div class="swatch-name">${name}</div>
  `;

  card.appendChild(colorDiv);
  card.appendChild(infoDiv);
  card.addEventListener('click', () => copyToClipboard(hex));
  return card;
}

function renderPalette() {
  swatchesGrid.innerHTML = '';
  state.palette.forEach(([r, g, b], i) => {
    swatchesGrid.appendChild(makeSwatch(r, g, b, i * 65));
  });
}

/* ─────────────────────────────────────────────
   Palette Tab: Mini Color Wheel
───────────────────────────────────────────── */

function drawMiniWheel(markers = []) {
  const w = wheelCanvas.width, h = wheelCanvas.height;
  const cx = w / 2, cy = h / 2;
  const outerR = Math.min(cx, cy) - 6;

  wheelCtx.clearRect(0, 0, w, h);

  for (let i = 0; i < 360; i++) {
    const a0 = (i / 360) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1.5) / 360) * 2 * Math.PI - Math.PI / 2;
    const [r, g, b] = hslToRgb(i, 88, 56);
    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.arc(cx, cy, outerR, a0, a1);
    wheelCtx.closePath();
    wheelCtx.fillStyle = `rgb(${r},${g},${b})`;
    wheelCtx.fill();
  }

  // Donut hole
  wheelCtx.beginPath();
  wheelCtx.arc(cx, cy, outerR * 0.43, 0, Math.PI * 2);
  wheelCtx.fillStyle = '#131317';
  wheelCtx.fill();

  // Markers
  const mr = outerR * 0.72;
  markers.forEach(({ hue, rgb }, idx) => {
    const angle = (hue / 360) * 2 * Math.PI - Math.PI / 2;
    const mx = cx + Math.cos(angle) * mr;
    const my = cy + Math.sin(angle) * mr;
    const [r, g, b] = rgb;

    wheelCtx.beginPath();
    wheelCtx.arc(mx, my, idx === 0 ? 9 : 7, 0, Math.PI * 2);
    wheelCtx.fillStyle = `rgb(${r},${g},${b})`;
    wheelCtx.fill();
    wheelCtx.strokeStyle = '#fff';
    wheelCtx.lineWidth = idx === 0 ? 2.5 : 1.5;
    wheelCtx.stroke();
  });
}

/* ─────────────────────────────────────────────
   Palette Tab: UI Preview
───────────────────────────────────────────── */

function renderUIPreview(palette) {
  if (!palette.length) return;
  const [c0, c1, c2, c3, c4] = palette;

  const set = (id, bg, fg) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.backgroundColor = rgbToHex(...bg);
    el.style.color = fg || getContrastColor(...bg);
  };

  set('preview-header', c0);
  document.getElementById('preview-logo').style.color = getContrastColor(...c0);

  const navBtn = document.getElementById('preview-nav-btn');
  const nb = c2 || c1;
  navBtn.style.backgroundColor = rgbToHex(...nb);
  navBtn.style.color = getContrastColor(...nb);

  const bodyBg = c3 || c0;
  set('preview-body', bodyBg);
  document.getElementById('preview-heading').style.color = getContrastColor(...bodyBg);
  document.getElementById('preview-text').style.color    = getContrastColor(...bodyBg);

  set('preview-btn-primary', c1 || c0);

  const sec = document.getElementById('preview-btn-secondary');
  sec.style.backgroundColor = 'transparent';
  sec.style.color = getContrastColor(...bodyBg);
  sec.style.borderColor = getContrastColor(...bodyBg);

  const foot = c4 || c0;
  set('preview-footer', foot);
  document.getElementById('preview-tag').style.color = getContrastColor(...foot);
}

/* ─────────────────────────────────────────────
   Palette Tab: Generate & Render
───────────────────────────────────────────── */

function runPaletteGeneration() {
  const { paletteR: r, paletteG: g, paletteB: b, harmony } = state;
  state.palette = generateHarmonyPalette(r, g, b, harmony);
  renderPalette();
  renderUIPreview(state.palette);

  const [baseH, baseS, baseL] = rgbToHsl(r, g, b);
  let hues;
  switch (harmony) {
    case 'complementary':       hues = [baseH, (baseH + 180) % 360]; break;
    case 'analogous':           hues = [-30,-15,0,15,30].map(d => (baseH + d + 360) % 360); break;
    case 'triadic':             hues = [0, 120, 240].map(d => (baseH + d) % 360); break;
    case 'split-complementary': hues = [0, 150, 210].map(d => (baseH + d) % 360); break;
    default:                    hues = [baseH];
  }
  drawMiniWheel(hues.map(hue => ({ hue, rgb: hslToRgb(hue, baseS, baseL) })));

  const hex = rgbToHex(r, g, b);
  colorPicker.value = hex;
  hexInput.value    = hex.toUpperCase();
}

function setPaletteBase(r, g, b) {
  state.paletteR = r; state.paletteG = g; state.paletteB = b;
  runPaletteGeneration();
}

colorPicker.addEventListener('input', () => {
  const rgb = hexToRgb(colorPicker.value);
  if (rgb) setPaletteBase(...rgb);
});

hexInput.addEventListener('input', () => {
  const v = hexInput.value.trim();
  const rgb = hexToRgb(v.startsWith('#') ? v : '#' + v);
  if (rgb) setPaletteBase(...rgb);
});

hexInput.addEventListener('blur', () => {
  const v = hexInput.value.trim();
  const rgb = hexToRgb(v.startsWith('#') ? v : '#' + v);
  if (rgb) setPaletteBase(...rgb);
  else hexInput.value = rgbToHex(state.paletteR, state.paletteG, state.paletteB).toUpperCase();
});

harmonyBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    harmonyBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.harmony = btn.dataset.harmony;
    runPaletteGeneration();
  });
});

randomizeBtn.addEventListener('click', () => {
  setPaletteBase(
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256)
  );
});

/* ─────────────────────────────────────────────
   Custom Scale Tab
───────────────────────────────────────────── */

function renderScalePalette() {
  const { scaleColors, scaleCount } = state;
  const labels = SCALE_LABELS[scaleCount] || scaleColors.map((_, i) => String((i + 1) * 100));

  scaleSwatches.innerHTML = '';
  cssExportBox.hidden = true; // hide export when re-rendering

  scaleColors.forEach(([r, g, b], i) => {
    const hex  = rgbToHex(r, g, b);
    const name = getColorName(r, g, b);

    const card = document.createElement('div');
    card.className = 'scale-swatch';
    card.style.animationDelay = `${i * 45}ms`;
    card.title = `Click to copy ${hex.toUpperCase()}`;

    const colorDiv = document.createElement('div');
    colorDiv.className = 'scale-color';
    colorDiv.style.backgroundColor = hex;

    const overlay = document.createElement('div');
    overlay.className = 'swatch-copy-overlay';
    colorDiv.appendChild(overlay);

    const info = document.createElement('div');
    info.className = 'scale-info';
    info.innerHTML = `
      <div class="scale-label">${labels[i]}</div>
      <div class="scale-hex">${hex.toUpperCase()}</div>
      <div class="scale-name">${name}</div>
    `;

    card.appendChild(colorDiv);
    card.appendChild(info);
    card.addEventListener('click', () => copyToClipboard(hex));
    scaleSwatches.appendChild(card);
  });
}

function runScaleGeneration() {
  state.scaleColors = generateCustomPalette(
    state.scaleR, state.scaleG, state.scaleB, state.scaleCount
  );
  renderScalePalette();
}

function setScaleBase(r, g, b) {
  state.scaleR = r; state.scaleG = g; state.scaleB = b;
  const hex = rgbToHex(r, g, b);
  scalePicker.value    = hex;
  scaleHexInput.value  = hex.toUpperCase();
}

// Count buttons
countBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    countBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.scaleCount = +btn.dataset.count;
  });
});

// Scale color picker & hex input
scalePicker.addEventListener('input', () => {
  const rgb = hexToRgb(scalePicker.value);
  if (rgb) { state.scaleR = rgb[0]; state.scaleG = rgb[1]; state.scaleB = rgb[2]; scaleHexInput.value = rgbToHex(...rgb).toUpperCase(); }
});

scaleHexInput.addEventListener('input', () => {
  const v = scaleHexInput.value.trim();
  const rgb = hexToRgb(v.startsWith('#') ? v : '#' + v);
  if (rgb) { state.scaleR = rgb[0]; state.scaleG = rgb[1]; state.scaleB = rgb[2]; scalePicker.value = rgbToHex(...rgb); }
});

scaleHexInput.addEventListener('blur', () => {
  const v = scaleHexInput.value.trim();
  const rgb = hexToRgb(v.startsWith('#') ? v : '#' + v);
  if (rgb) { state.scaleR = rgb[0]; state.scaleG = rgb[1]; state.scaleB = rgb[2]; }
  else scaleHexInput.value = rgbToHex(state.scaleR, state.scaleG, state.scaleB).toUpperCase();
});

genScaleBtn.addEventListener('click', () => {
  runScaleGeneration();
  showToast('Scale generated!');
});

useExplorerBtn.addEventListener('click', () => {
  setScaleBase(state.r, state.g, state.b);
  runScaleGeneration();
  showToast('Explorer color applied to Scale');
});

// CSS Export
exportCssBtn.addEventListener('click', () => {
  if (!state.scaleColors.length) {
    showToast('Generate a scale first!');
    return;
  }
  const code = exportScaleAsCSS(state.scaleColors, state.scaleCount);
  cssExportCode.textContent = code;
  cssExportBox.hidden = !cssExportBox.hidden;
  exportCssBtn.textContent = cssExportBox.hidden ? '</> Export CSS' : '✕ Close';
});

copyCssBtn.addEventListener('click', () => {
  copyToClipboard(cssExportCode.textContent);
});

/* ─────────────────────────────────────────────
   Send buttons
───────────────────────────────────────────── */

sendToPaletteBtn.addEventListener('click', () => {
  setPaletteBase(state.r, state.g, state.b);
  switchTab('palette');
  showToast('Color sent to Palette');
});

sendToScaleBtn.addEventListener('click', () => {
  setScaleBase(state.r, state.g, state.b);
  runScaleGeneration();
  switchTab('custom');
  showToast('Color sent to Scale');
});

/* ─────────────────────────────────────────────
   Tab Navigation (with sliding indicator)
───────────────────────────────────────────── */

function positionIndicator(activeTab) {
  const headerInner = document.querySelector('.header-inner');
  const headerLeft  = headerInner.getBoundingClientRect().left;
  const tabRect     = activeTab.getBoundingClientRect();
  const trackPad    = parseInt(getComputedStyle(document.querySelector('.tab-indicator-track')).paddingLeft, 10) || 28;

  tabIndicator.style.left  = `${tabRect.left - headerLeft - (trackPad - 28) + 0}px`;
  tabIndicator.style.width = `${tabRect.width}px`;
}

function switchTab(targetId) {
  tabs.forEach(t => {
    const active = t.dataset.tab === targetId;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
    if (active) positionIndicator(t);
  });
  tabPanels.forEach(p => p.classList.toggle('active', p.id === targetId));
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

/* ─────────────────────────────────────────────
   Canvas Resize
───────────────────────────────────────────── */

new ResizeObserver(() => resizeCanvas()).observe(canvasWrap);

/* ─────────────────────────────────────────────
   Init
───────────────────────────────────────────── */

function init() {
  resizeCanvas();
  animateCanvas();
  updateExplorerDisplay();
  runPaletteGeneration();

  // Initial scale
  setScaleBase(state.r, state.g, state.b);
  runScaleGeneration();

  // Position tab indicator on first active tab
  const firstActive = document.querySelector('.tab.active');
  if (firstActive) setTimeout(() => positionIndicator(firstActive), 50);
}

init();

/* ═══════════════════════════════════════════════════════════
   Accessibility Settings
   ═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   Vision types data
   Each entry maps a human-readable label to an
   SVG filter ID (null = no filter / normal vision).
───────────────────────────────────────────── */

const VISION_TYPES = [
  {
    id: 'normal',
    label: 'Normal',
    desc: 'Standard vision',
    filterId: null,
    note: 'Default',
  },
  {
    id: 'protanopia',
    label: 'Protanopia',
    desc: 'Red-blind',
    filterId: 'cb-protanopia',
    note: '~1% of males',
  },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia',
    desc: 'Green-blind',
    filterId: 'cb-deuteranopia',
    note: '~1% of males',
  },
  {
    id: 'tritanopia',
    label: 'Tritanopia',
    desc: 'Blue-blind',
    filterId: 'cb-tritanopia',
    note: 'Very rare',
  },
  {
    id: 'protanomaly',
    label: 'Protanomaly',
    desc: 'Red-weak',
    filterId: 'cb-protanomaly',
    note: '~1% of males',
  },
  {
    id: 'deuteranomaly',
    label: 'Deuteranomaly',
    desc: 'Green-weak',
    filterId: 'cb-deuteranomaly',
    note: '~5% of males',
  },
  {
    id: 'tritanomaly',
    label: 'Tritanomaly',
    desc: 'Blue-weak',
    filterId: 'cb-tritanomaly',
    note: '~0.01%',
  },
  {
    id: 'achromatopsia',
    label: 'Achromatopsia',
    desc: 'No color perception',
    filterId: 'cb-achromatopsia',
    note: '~0.003%',
  },
  {
    id: 'achromatomaly',
    label: 'Achromatomaly',
    desc: 'Partial color loss',
    filterId: 'cb-achromatomaly',
    note: 'Very rare',
  },
];

// The three reference colors shown in each vision preview
const PREVIEW_DOT_COLORS = ['#ff4055', '#3dff7a', '#4a8eff'];

/* ─────────────────────────────────────────────
   Settings state
───────────────────────────────────────────── */

const settingsState = {
  vision:        'normal',
  reduceMotion:  false,
  highContrast:  false,
};

/* ─────────────────────────────────────────────
   Settings DOM refs
───────────────────────────────────────────── */

const settingsOverlay  = document.getElementById('settings-overlay');
const settingsDrawer   = document.getElementById('settings-drawer');
const openSettingsBtn  = document.getElementById('open-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const visionBadge      = document.getElementById('vision-badge');
const toggleMotionBtn  = document.getElementById('toggle-motion');
const toggleContrastBtn = document.getElementById('toggle-contrast');

/* ─────────────────────────────────────────────
   Open / close drawer
───────────────────────────────────────────── */

function openSettings() {
  settingsDrawer.hidden = false;
  // Allow hidden→flex to settle before animating
  requestAnimationFrame(() => {
    settingsOverlay.classList.add('open');
    settingsDrawer.classList.add('open');
    openSettingsBtn.classList.add('active');
    closeSettingsBtn.focus();
  });
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  settingsOverlay.classList.remove('open');
  settingsDrawer.classList.remove('open');
  openSettingsBtn.classList.remove('active');
  document.body.style.overflow = '';
  // Re-hide after transition completes
  setTimeout(() => { settingsDrawer.hidden = true; }, 310);
}

openSettingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsDrawer.classList.contains('open')) {
    closeSettings();
    openSettingsBtn.focus();
  }
});

/* ─────────────────────────────────────────────
   Apply vision filter
   The filter is applied to .app-main so the
   sticky header remains always readable.
───────────────────────────────────────────── */

function applyVisionFilter(filterId) {
  const mainEl = document.querySelector('.app-main');
  mainEl.style.filter = filterId ? `url(#${filterId})` : 'none';

  const type = VISION_TYPES.find(v => v.filterId === filterId);
  if (type && type.id !== 'normal') {
    visionBadge.textContent = `👁 ${type.label}`;
    visionBadge.classList.add('visible');
  } else {
    visionBadge.classList.remove('visible');
  }
}

/* ─────────────────────────────────────────────
   Render vision type grid
───────────────────────────────────────────── */

function renderVisionGrid() {
  const grid = document.getElementById('vision-grid');
  grid.innerHTML = '';

  VISION_TYPES.forEach(v => {
    const card = document.createElement('div');
    card.className = 'vision-option' + (v.id === settingsState.vision ? ' active' : '');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', v.id === settingsState.vision ? 'true' : 'false');
    card.setAttribute('tabindex', '0');
    card.dataset.vision = v.id;

    // Colour preview dots — each set has the SVG filter applied inline
    const preview = document.createElement('div');
    preview.className = 'vision-preview';
    if (v.filterId) preview.style.filter = `url(#${v.filterId})`;

    PREVIEW_DOT_COLORS.forEach(color => {
      const dot = document.createElement('span');
      dot.className = 'v-dot';
      dot.style.background = color;
      preview.appendChild(dot);
    });

    card.appendChild(preview);
    card.insertAdjacentHTML('beforeend', `
      <div class="vision-label">${v.label}</div>
      <div class="vision-desc">${v.desc}</div>
      <div class="vision-note">${v.note}</div>
    `);

    function selectThis() {
      settingsState.vision = v.id;
      applyVisionFilter(v.filterId);
      // Update active states without a full re-render
      grid.querySelectorAll('.vision-option').forEach(el => {
        const isThis = el.dataset.vision === v.id;
        el.classList.toggle('active', isThis);
        el.setAttribute('aria-checked', isThis ? 'true' : 'false');
      });
    }

    card.addEventListener('click', selectThis);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThis(); }
    });

    grid.appendChild(card);
  });
}

/* ─────────────────────────────────────────────
   Display toggles
───────────────────────────────────────────── */

function setupToggle(btn, stateKey, onToggle) {
  btn.addEventListener('click', () => {
    settingsState[stateKey] = !settingsState[stateKey];
    const isOn = settingsState[stateKey];
    btn.setAttribute('aria-checked', isOn ? 'true' : 'false');
    onToggle(isOn);
  });
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
  });
}

setupToggle(toggleMotionBtn, 'reduceMotion', on => {
  document.body.classList.toggle('reduce-motion', on);
});

setupToggle(toggleContrastBtn, 'highContrast', on => {
  document.body.classList.toggle('high-contrast', on);
});

// Render the vision grid now that all constants and DOM refs are ready
renderVisionGrid();
