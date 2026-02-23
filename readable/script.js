// ── Neuron background animation ──────────────────────────────
const canvas = document.getElementById('neuron-bg');
const ctx = canvas.getContext('2d');

const NODE_COUNT = 72;
const MAX_DIST   = 190;

let nodes  = [];
let pulses = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function initNodes() {
  nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r:  2 + Math.random() * 2.5,
    });
  }
}

function spawnPulse() {
  const fromIdx = Math.floor(Math.random() * nodes.length);
  const from    = nodes[fromIdx];
  const neighbors = [];

  for (let i = 0; i < nodes.length; i++) {
    if (i === fromIdx) continue;
    const dx = from.x - nodes[i].x;
    const dy = from.y - nodes[i].y;
    if (Math.sqrt(dx * dx + dy * dy) < MAX_DIST) neighbors.push(i);
  }

  if (neighbors.length === 0) return;
  const toIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
  pulses.push({ from: fromIdx, to: toIdx, t: 0, speed: 0.010 + Math.random() * 0.008 });
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Connections
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx   = nodes[i].x - nodes[j].x;
      const dy   = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= MAX_DIST) continue;

      const alpha = (1 - dist / MAX_DIST) * 0.38;
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(nodes[j].x, nodes[j].y);
      ctx.strokeStyle = `rgba(90, 180, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Node glow + core
  for (const node of nodes) {
    const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 5);
    grd.addColorStop(0,   'rgba(160, 220, 255, 0.55)');
    grd.addColorStop(1,   'rgba(160, 220, 255, 0)');
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r * 5, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = '#b8e0ff';
    ctx.fill();
  }

  // Pulses
  pulses = pulses.filter(p => p.t <= 1);
  for (const p of pulses) {
    const from = nodes[p.from];
    const to   = nodes[p.to];
    const x    = from.x + (to.x - from.x) * p.t;
    const y    = from.y + (to.y - from.y) * p.t;

    const grd = ctx.createRadialGradient(x, y, 0, x, y, 7);
    grd.addColorStop(0,   'rgba(255, 255, 255, 0.95)');
    grd.addColorStop(0.4, 'rgba(120, 230, 255, 0.6)');
    grd.addColorStop(1,   'rgba(120, 230, 255, 0)');
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    p.t += p.speed;
  }

  // Move nodes, bounce off walls
  for (const node of nodes) {
    node.x += node.vx;
    node.y += node.vy;
    if (node.x < 0 || node.x > canvas.width)  node.vx *= -1;
    if (node.y < 0 || node.y > canvas.height)  node.vy *= -1;
  }

  // Randomly fire new pulses
  if (Math.random() < 0.04) spawnPulse();

  requestAnimationFrame(drawFrame);
}

window.addEventListener('resize', () => { resizeCanvas(); initNodes(); });
resizeCanvas();
initNodes();
drawFrame();


// ── Accessibility controls ────────────────────────────────────
const article = document.getElementById('article');

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function luminance(r, g, b) {
  return 0.2126 * Math.pow(r / 255, 2.2)
       + 0.7152 * Math.pow(g / 255, 2.2)
       + 0.0722 * Math.pow(b / 255, 2.2);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let bgR = 255, bgG = 255, bgB = 255;
let txR = 0,   txG = 0,   txB = 0;

function updateArticle() {
  article.style.backgroundColor = `rgb(${bgR},${bgG},${bgB})`;
  article.style.color           = `rgb(${txR},${txG},${txB})`;

  const bgLum = luminance(bgR, bgG, bgB);
  const txLum = luminance(txR, txG, txB);
  const cr    = contrastRatio(bgLum, txLum);

  document.getElementById('stat-bg-lum').textContent  = bgLum.toFixed(3);
  document.getElementById('stat-tx-lum').textContent  = txLum.toFixed(3);
  document.getElementById('stat-contrast').textContent = cr.toFixed(2);
}

function bindChannel(sliderId, numId, onChange) {
  const slider = document.getElementById(sliderId);
  const num    = document.getElementById(numId);

  slider.addEventListener('input', () => {
    num.value = slider.value;
    onChange(parseInt(slider.value, 10));
  });

  num.addEventListener('input', () => {
    const v = clamp(parseInt(num.value, 10) || 0, 0, 255);
    num.value    = v;
    slider.value = v;
    onChange(v);
  });
}

bindChannel('bg-r', 'bg-r-num', v => { bgR = v; updateArticle(); });
bindChannel('bg-g', 'bg-g-num', v => { bgG = v; updateArticle(); });
bindChannel('bg-b', 'bg-b-num', v => { bgB = v; updateArticle(); });

bindChannel('tx-r', 'tx-r-num', v => { txR = v; updateArticle(); });
bindChannel('tx-g', 'tx-g-num', v => { txG = v; updateArticle(); });
bindChannel('tx-b', 'tx-b-num', v => { txB = v; updateArticle(); });

const fontSlider = document.getElementById('font-slider');
const fontLabel  = document.getElementById('font-size-label');

fontSlider.addEventListener('input', () => {
  const px = fontSlider.value;
  fontLabel.textContent  = `${px}px`;
  article.style.fontSize = `${px}px`;
});

const visionFilters = {
  normal:       'none',
  protanopia:   'url(#protanopia-filter)',
  deuteranopia: 'url(#deuteranopia-filter)',
  tritanopia:   'url(#tritanopia-filter)',
  monochromacy: 'grayscale(100%)',
};

document.querySelectorAll('input[name="vision"]').forEach(radio => {
  radio.addEventListener('change', () => {
    article.style.filter = visionFilters[radio.value] || 'none';
  });
});

// ── Preset color schemes ──────────────────────────────────────
function setColors(bg, tx) {
  [bgR, bgG, bgB] = bg;
  [txR, txG, txB] = tx;

  ['r','g','b'].forEach((ch, i) => {
    document.getElementById(`bg-${ch}`).value     = bg[i];
    document.getElementById(`bg-${ch}-num`).value = bg[i];
    document.getElementById(`tx-${ch}`).value     = tx[i];
    document.getElementById(`tx-${ch}-num`).value = tx[i];
  });

  updateArticle();
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const bg = btn.dataset.bg.split(',').map(Number);
    const tx = btn.dataset.tx.split(',').map(Number);
    setColors(bg, tx);
  });
});

updateArticle();
