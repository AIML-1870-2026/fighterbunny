// ═══════════════════════════════════════
// AUDIO ENGINE (Web Audio API)
// ═══════════════════════════════════════
let soundEnabled = true;
let audioCtx;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTick(up) {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = up ? 880 : 440;
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

function playZoneChange(zone) {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const freqs = [220, 330, 440, 660, 880];
  freqs.slice(0, zone + 1).forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1 * (i + 1) + 0.2);
    osc.start(ctx.currentTime + 0.1 * i);
    osc.stop(ctx.currentTime + 0.1 * (i + 1) + 0.2);
  });
}

function playCelebration() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const melody = [523, 659, 784, 1047, 784, 1047];
  melody.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = f;
    gain.gain.value = 0.07;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.2);
  });
}

function playCombo() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  [660, 880, 1100].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = f;
    gain.gain.value = 0.04;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.15);
    osc.start(ctx.currentTime + i * 0.08);
    osc.stop(ctx.currentTime + i * 0.08 + 0.15);
  });
}

document.getElementById('sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊' : '🔇';
});

// ═══════════════════════════════════════
// CONFETTI ENGINE
// ═══════════════════════════════════════
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiRunning = false;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
window.addEventListener('resize', resizeConfetti);

function spawnConfetti(count = 80) {
  const colors = ['#ff69b4', '#ff8ecf', '#ffb8d9', '#ff4da6', '#d98cb8', '#ffd700', '#fff'];
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: -10 - Math.random() * 100,
      w: 4 + Math.random() * 6,
      h: 6 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    animateConfetti();
  }
}

function animateConfetti() {
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles = confettiParticles.filter(p => p.life > 0);
  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.rotV;
    p.vy += 0.1;
    if (p.y > confettiCanvas.height) p.life = 0;
    p.life -= 0.003;
    cCtx.save();
    cCtx.translate(p.x, p.y);
    cCtx.rotate(p.rot * Math.PI / 180);
    cCtx.globalAlpha = p.life;
    cCtx.fillStyle = p.color;
    cCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    cCtx.restore();
  });
  if (confettiParticles.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    confettiRunning = false;
  }
}

// ═══════════════════════════════════════
// CORE DATA
// ═══════════════════════════════════════
const BASE_SCORE = 78;

const yesFactors = [
  { emoji: '✅', label: "He said it's fine!", weight: 25, id: 'yes-0' },
  { emoji: '👫', label: "It's for both of us", weight: 20, id: 'yes-1' },
  { emoji: '🚨', label: "It's urgent / necessary", weight: 20, id: 'yes-2' },
  { emoji: '🎁', label: "It's actually for HIM", weight: 25, id: 'yes-3' },
  { emoji: '🪙', label: "It's not much money", weight: 15, id: 'yes-4' },
];

const yesSliders = [
  { emoji: '😊', label: "How good is his mood?", minLabel: '😤', maxLabel: '😍', min: 0, max: 20, default: 0, id: 'yes-slider-0' },
  { emoji: '💰', label: "How much is it?", minLabel: '$5', maxLabel: '$500+', min: 0, max: 15, default: 0, id: 'yes-slider-1', invert: true },
];

const noFactors = [
  { emoji: '🫣', label: "He has no idea", weight: -12, id: 'no-0' },
  { emoji: '😰', label: "He's worried about money", weight: -10, id: 'no-1' },
  { emoji: '🙈', label: "I'd rather he not see this", weight: -8, id: 'no-2' },
  { emoji: '💥', label: "This has caused drama before", weight: -7, id: 'no-3' },
  { emoji: '💳', label: "I have my own money", weight: -3, id: 'no-4' },
  { emoji: '🛍️', label: "It's definitely a want", weight: -2, id: 'no-5' },
  { emoji: '📊', label: "He tracks his spending", weight: -6, id: 'no-6' },
];

const noSliders = [
  { emoji: '💸', label: "How broke is he?", minLabel: 'Fine', maxLabel: 'Very', min: 0, max: -15, default: 0, id: 'no-slider-0' },
];

// Secret combos
const combos = [
  { ids: ['yes-0', 'yes-3'], name: 'The Perfect Alibi', bonus: 15 },
  { ids: ['yes-0', 'yes-1', 'yes-4'], name: 'Shared Joy', bonus: 12 },
  { ids: ['yes-2', 'yes-4'], name: "It's Basically Free", bonus: 10 },
  { ids: ['no-0', 'no-2'], name: 'Full Stealth Mode', bonus: -5 },
];

const zones = [
  { max: 15, label: 'Absolutely not.', className: 'zone-0' },
  { max: 30, label: 'Probably a bad idea.', className: 'zone-1' },
  { max: 50, label: "It's complicated...", className: 'zone-2' },
  { max: 70, label: 'Probably fine!', className: 'zone-3' },
  { max: Infinity, label: 'Go for it, babe!', className: 'zone-4' },
];

const faces = [
  { max: 15, face: '😨' },
  { max: 30, face: '😬' },
  { max: 50, face: '🤔' },
  { max: 70, face: '😊' },
  { max: 100, face: '😏' },
  { max: 150, face: '😈' },
  { max: Infinity, face: '👑' },
];

const easterEggs = [
  { min: 0, max: 10, text: "his bank just sent a fraud alert..." },
  { min: 11, max: 20, text: "maybe just put it back..." },
  { min: 21, max: 30, text: "the card is judging you rn" },
  { min: 31, max: 50, text: "the neuron is conflicted" },
  { min: 51, max: 70, text: "the card is warming up to you" },
  { min: 71, max: 100, text: "his card wants to be swiped" },
  { min: 101, max: 150, text: "the card is begging to be used" },
  { min: 151, max: 200, text: "slay. the economy needs you." },
  { min: 201, max: Infinity, text: "you ARE the economy" },
];

let score = BASE_SCORE;
let currentZone = 4;
let activeComboName = '';
const cardElements = [];
const activeToggles = new Set();
const sliderValues = {};
const customFactors = [];

// ═══════════════════════════════════════
// CARD BUILDERS
// ═══════════════════════════════════════
function createCard(factor, type) {
  const card = document.createElement('div');
  card.className = `factor-card ${type}-factor`;
  card.dataset.id = factor.id;
  card.dataset.type = type;

  const weightSign = factor.weight > 0 ? '+' : '';
  const weightClass = factor.weight > 0 ? 'positive' : 'negative';
  const arrow = factor.weight > 0 ? '↑' : '↓';

  card.innerHTML = `
    <span class="factor-emoji">${factor.emoji}</span>
    <div class="factor-info">
      <div class="factor-label">${factor.label}</div>
      <div class="factor-weight ${weightClass}">${arrow} ${weightSign}${factor.weight}</div>
    </div>
    <label class="toggle" onclick="event.stopPropagation()">
      <input type="checkbox" data-weight="${factor.weight}" data-id="${factor.id}">
      <span class="toggle-slider"></span>
    </label>
  `;

  const checkbox = card.querySelector('input');
  const toggle = () => { checkbox.checked = !checkbox.checked; handleToggle(card, checkbox); };
  card.addEventListener('click', toggle);
  checkbox.addEventListener('change', () => handleToggle(card, checkbox));

  cardElements.push({ el: card, id: factor.id, type });
  return card;
}

function createSliderCard(slider, type) {
  const card = document.createElement('div');
  card.className = `slider-card ${type}-factor`;
  card.dataset.id = slider.id;
  card.dataset.type = type;

  card.innerHTML = `
    <div class="slider-header">
      <span class="factor-emoji">${slider.emoji}</span>
      <span class="factor-label">${slider.label}</span>
      <span class="slider-value" id="sv-${slider.id}">0</span>
    </div>
    <input type="range" class="slider-track" min="0" max="100" value="0"
      data-id="${slider.id}" data-min="${slider.min}" data-max="${slider.max}">
  `;

  const range = card.querySelector('input[type="range"]');
  sliderValues[slider.id] = 0;

  range.addEventListener('input', () => {
    const pct = parseInt(range.value) / 100;
    const weight = Math.round(slider.min + (slider.max - slider.min) * pct);
    sliderValues[slider.id] = weight;
    const display = slider.invert
      ? (pct < 0.2 ? slider.minLabel : pct > 0.8 ? slider.maxLabel : `${weightPrefix(weight)}${weight}`)
      : `${weightPrefix(weight)}${weight}`;
    document.getElementById(`sv-${slider.id}`).textContent = display;
    card.classList.toggle('active', Math.abs(weight) > 0);
    recalculate();
    drawLines();
  });

  cardElements.push({ el: card, id: slider.id, type });
  return card;
}

function weightPrefix(w) { return w > 0 ? '+' : ''; }

function handleToggle(card, checkbox) {
  const id = checkbox.dataset.id;
  if (checkbox.checked) {
    card.classList.add('active');
    activeToggles.add(id);
    playTick(true);
  } else {
    card.classList.remove('active');
    activeToggles.delete(id);
    playTick(false);
  }
  recalculate();
  drawLines();
}

// ═══════════════════════════════════════
// COMBOS
// ═══════════════════════════════════════
function checkCombos() {
  let bestCombo = null;
  let totalBonus = 0;
  const comboIds = new Set();

  combos.forEach(combo => {
    if (combo.ids.every(id => activeToggles.has(id))) {
      totalBonus += combo.bonus;
      bestCombo = combo;
      combo.ids.forEach(id => comboIds.add(id));
    }
  });

  // highlight combo cards
  cardElements.forEach(({ el, id }) => {
    el.classList.toggle('combo-active', comboIds.has(id));
  });

  const banner = document.getElementById('combo-banner');
  if (bestCombo && totalBonus > 0) {
    banner.textContent = `COMBO: ${bestCombo.name}! +${totalBonus} bonus`;
    banner.classList.add('active');
    if (activeComboName !== bestCombo.name) {
      playCombo();
      activeComboName = bestCombo.name;
    }
  } else if (totalBonus < 0 && bestCombo) {
    banner.textContent = `COMBO: ${bestCombo.name} ${totalBonus}`;
    banner.classList.add('active');
    activeComboName = bestCombo.name;
  } else {
    banner.textContent = '';
    banner.classList.remove('active');
    activeComboName = '';
  }

  return totalBonus;
}

// ═══════════════════════════════════════
// RECALCULATE
// ═══════════════════════════════════════
function recalculate() {
  let total = BASE_SCORE;

  // toggles
  document.querySelectorAll('.factor-card input[type="checkbox"]:checked').forEach(cb => {
    total += parseInt(cb.dataset.weight);
  });

  // sliders
  Object.values(sliderValues).forEach(v => { total += v; });

  // combos
  total += checkCombos();

  score = Math.max(0, total);
  updateOrb();
  updateVerdict();
  updateFace();
  updateEasterEgg();
  updateMoodRing();
  requestBoundaryRender();
}

function updateOrb() {
  document.getElementById('neuron-score').textContent = score;
}

function updateFace() {
  let face = '😏';
  for (const f of faces) {
    if (score <= f.max) { face = f.face; break; }
  }
  document.getElementById('orb-face').textContent = face;
}

function updateEasterEgg() {
  const el = document.getElementById('easter-egg');
  for (const egg of easterEggs) {
    if (score >= egg.min && score <= egg.max) {
      el.textContent = egg.text;
      return;
    }
  }
  el.textContent = '';
}

function updateMoodRing() {
  const orb = document.getElementById('neuron-orb');
  const activeYes = document.querySelectorAll('.yes-factor.active, .yes-factor .slider-card.active').length;
  const activeNo = document.querySelectorAll('.no-factor.active').length;
  const total = activeYes + activeNo;

  // shift gradient based on active factors
  const yesHue = total > 0 ? (activeYes / Math.max(total, 1)) : 0.5;
  const intensity = Math.min(total * 0.04, 0.3);

  const r1 = Math.round(255 * yesHue);
  const b1 = Math.round(180 + 50 * (1 - yesHue));

  orb.style.background = `radial-gradient(circle at ${35 + activeYes * 3}% ${35 - activeNo * 2}%,
    rgba(${r1}, 200, 230, ${0.1 + intensity}) 0%,
    rgba(255, 105, 180, ${0.05 + intensity * 0.5}) 30%,
    rgba(28, 10, 30, 0.9) 70%)`;
}

let prevZone = 4;
function updateVerdict() {
  const verdictEl = document.getElementById('verdict');
  const orbEl = document.getElementById('neuron-orb');
  let newZone = 0;
  for (let i = 0; i < zones.length; i++) {
    if (score <= zones[i].max) { newZone = i; break; }
  }

  if (newZone !== currentZone) {
    verdictEl.classList.remove(zones[currentZone].className);
    orbEl.classList.remove(zones[currentZone].className);
    verdictEl.classList.add(zones[newZone].className);
    orbEl.classList.add(zones[newZone].className);
    verdictEl.textContent = zones[newZone].label;

    verdictEl.classList.remove('animate');
    void verdictEl.offsetWidth;
    verdictEl.classList.add('animate');

    playZoneChange(newZone);

    // confetti when entering zone 4
    if (newZone === 4 && currentZone < 4) {
      spawnConfetti(100);
      playCelebration();
    }

    // extra confetti for scores over 150
    if (score > 150 && newZone === 4) {
      spawnConfetti(50);
    }

    currentZone = newZone;
  }

  // continuous confetti above 200
  if (score > 200 && Math.random() < 0.3) {
    spawnConfetti(5);
  }
}

// ═══════════════════════════════════════
// DRAW LINES
// ═══════════════════════════════════════
function drawLines() {
  const svg = document.getElementById('lines-svg');
  const layout = document.getElementById('neuron-layout');
  const orbWrapper = document.getElementById('orb-wrapper');

  if (window.innerWidth <= 900) { svg.innerHTML = ''; return; }

  const layoutRect = layout.getBoundingClientRect();
  const orbRect = orbWrapper.getBoundingClientRect();
  const cx = orbRect.left + orbRect.width / 2 - layoutRect.left;
  const cy = orbRect.top + orbRect.height / 2 - layoutRect.top;

  let svgContent = '';

  cardElements.forEach(({ el, id, type }) => {
    const cardRect = el.getBoundingClientRect();
    const ex = type === 'yes'
      ? cardRect.right - layoutRect.left
      : cardRect.left - layoutRect.left;
    const ey = cardRect.top + cardRect.height / 2 - layoutRect.top;

    const isActive = el.classList.contains('active') ||
      el.querySelector('input[type="checkbox"]:checked') !== null ||
      (sliderValues[id] && Math.abs(sliderValues[id]) > 0);
    const isCombo = el.classList.contains('combo-active');

    const lineClass = isCombo ? 'active-combo' : (isActive ? `active-${type}` : '');
    const dotClass = isCombo ? 'active-combo' : (isActive ? `active-${type}` : '');

    const midX = (ex + cx) / 2;
    const cpOffset = type === 'yes' ? 30 : -30;

    svgContent += `<path class="connection-line ${lineClass}"
      d="M ${ex} ${ey} C ${midX + cpOffset} ${ey}, ${midX - cpOffset} ${cy}, ${cx} ${cy}" />`;
    svgContent += `<circle class="connection-dot ${dotClass}" cx="${ex}" cy="${ey}" r="3" />`;
  });

  svg.innerHTML = svgContent;
}

// ═══════════════════════════════════════
// HISTORY (localStorage)
// ═══════════════════════════════════════
function getHistory() {
  try { return JSON.parse(localStorage.getItem('neuron-history') || '[]'); }
  catch { return []; }
}

function saveHistory(entry) {
  const history = getHistory();
  history.unshift(entry);
  if (history.length > 20) history.length = 20;
  localStorage.setItem('neuron-history', JSON.stringify(history));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem('neuron-history');
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const history = getHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">No decisions saved yet</div>';
    return;
  }
  list.innerHTML = history.map(h => {
    let face = '😏';
    for (const f of faces) { if (h.score <= f.max) { face = f.face; break; } }
    return `<div class="history-entry">
      <span class="history-face">${face}</span>
      <div class="history-info">
        <span class="history-score-val">${h.score}</span>
        <span class="history-verdict-text">${h.verdict}</span>
      </div>
      <span class="history-time">${h.time}</span>
    </div>`;
  }).join('');
}

document.getElementById('save-btn').addEventListener('click', () => {
  const activeLabels = [];
  document.querySelectorAll('.factor-card.active .factor-label').forEach(el => {
    activeLabels.push(el.textContent);
  });
  const now = new Date();
  const time = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  saveHistory({
    score,
    verdict: document.getElementById('verdict').textContent,
    factors: activeLabels,
    time,
  });

  // flash the button
  const btn = document.getElementById('save-btn');
  btn.textContent = 'Saved!';
  setTimeout(() => btn.textContent = 'Save decision', 1500);
});

document.getElementById('history-clear').addEventListener('click', clearHistory);

// ═══════════════════════════════════════
// SHARE CARD
// ═══════════════════════════════════════
document.getElementById('share-btn').addEventListener('click', () => {
  document.getElementById('share-score').textContent = score;
  const verdictEl = document.getElementById('verdict');
  const shareVerdict = document.getElementById('share-verdict');
  shareVerdict.textContent = verdictEl.textContent;
  shareVerdict.style.color = getComputedStyle(verdictEl).color;

  const activeLabels = [];
  document.querySelectorAll('.factor-card.active .factor-label').forEach(el => {
    activeLabels.push('• ' + el.textContent);
  });
  document.getElementById('share-factors').innerHTML =
    activeLabels.length > 0
      ? '<strong>Active factors:</strong><br>' + activeLabels.join('<br>')
      : 'No factors selected';

  document.getElementById('share-overlay').classList.add('open');
});

document.getElementById('share-close').addEventListener('click', () => {
  document.getElementById('share-overlay').classList.remove('open');
});
document.getElementById('share-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ═══════════════════════════════════════
// CUSTOM FACTOR MODAL
// ═══════════════════════════════════════
let customType = 'yes';

document.getElementById('custom-btn').addEventListener('click', () => {
  document.getElementById('custom-modal').classList.add('open');
});
document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('custom-modal').classList.remove('open');
});
document.getElementById('custom-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

document.getElementById('type-yes').addEventListener('click', () => {
  customType = 'yes';
  document.getElementById('type-yes').classList.add('selected');
  document.getElementById('type-no').classList.remove('selected');
});
document.getElementById('type-no').addEventListener('click', () => {
  customType = 'no';
  document.getElementById('type-no').classList.add('selected');
  document.getElementById('type-yes').classList.remove('selected');
});

document.getElementById('modal-add').addEventListener('click', () => {
  const emoji = document.getElementById('custom-emoji').value || '⭐';
  const label = document.getElementById('custom-label').value || 'Custom factor';
  let weight = parseInt(document.getElementById('custom-weight').value) || 10;
  if (customType === 'no') weight = -Math.abs(weight);
  else weight = Math.abs(weight);

  const id = `custom-${Date.now()}`;
  const factor = { emoji, label, weight, id };
  customFactors.push(factor);

  const col = customType === 'yes'
    ? document.getElementById('yes-column')
    : document.getElementById('no-column');

  col.appendChild(createCard(factor, customType));

  // reset modal
  document.getElementById('custom-emoji').value = '';
  document.getElementById('custom-label').value = '';
  document.getElementById('custom-weight').value = '10';
  document.getElementById('custom-modal').classList.remove('open');

  requestAnimationFrame(() => drawLines());

  // Update boundary selectors if open
  if (boundaryOpen) {
    populateBoundarySelectors();
    requestBoundaryRender();
  }
});

// ═══════════════════════════════════════
// RESET
// ═══════════════════════════════════════
function resetAll() {
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.factor-card').forEach(card => {
    card.classList.remove('active', 'combo-active');
  });
  document.querySelectorAll('.slider-card').forEach(card => {
    card.classList.remove('active');
  });
  document.querySelectorAll('.slider-track').forEach(s => { s.value = 0; });
  document.querySelectorAll('[id^="sv-"]').forEach(el => el.textContent = '0');

  activeToggles.clear();
  Object.keys(sliderValues).forEach(k => sliderValues[k] = 0);
  activeComboName = '';

  score = BASE_SCORE;
  currentZone = 4;
  updateOrb();
  updateFace();
  updateEasterEgg();
  updateMoodRing();
  drawLines();

  const verdictEl = document.getElementById('verdict');
  const orbEl = document.getElementById('neuron-orb');
  verdictEl.className = 'verdict zone-4';
  orbEl.className = 'neuron-orb zone-4';
  verdictEl.textContent = zones[4].label;

  document.getElementById('combo-banner').textContent = '';
  document.getElementById('combo-banner').classList.remove('active');
  requestBoundaryRender();
}

document.getElementById('reset-btn').addEventListener('click', resetAll);

// ═══════════════════════════════════════
// DECISION BOUNDARY VISUALIZER
// ═══════════════════════════════════════
const DECISION_THRESHOLD = 70;
const BOUNDARY_RES = 100;
let boundaryAnimId = null;
let boundaryOpen = false;

function getAllFactorOptions() {
  const options = [];
  yesFactors.forEach(f => options.push({ id: f.id, label: f.label, type: 'toggle', weight: f.weight }));
  yesSliders.forEach(s => options.push({ id: s.id, label: s.label, type: 'slider', min: s.min, max: s.max }));
  noFactors.forEach(f => options.push({ id: f.id, label: f.label, type: 'toggle', weight: f.weight }));
  noSliders.forEach(s => options.push({ id: s.id, label: s.label, type: 'slider', min: s.min, max: s.max }));
  customFactors.forEach(f => options.push({ id: f.id, label: f.label, type: 'toggle', weight: f.weight }));
  return options;
}

function populateBoundarySelectors() {
  const xSel = document.getElementById('boundary-x-axis');
  const ySel = document.getElementById('boundary-y-axis');
  const options = getAllFactorOptions();
  if (options.length < 2) return;

  const prevX = xSel.value;
  const prevY = ySel.value;

  xSel.innerHTML = '';
  ySel.innerHTML = '';

  options.forEach(opt => {
    const ox = document.createElement('option');
    ox.value = opt.id;
    ox.textContent = opt.label;
    xSel.appendChild(ox);

    const oy = document.createElement('option');
    oy.value = opt.id;
    oy.textContent = opt.label;
    ySel.appendChild(oy);
  });

  // Restore previous or default: first yes for X, first no for Y
  if (prevX && options.find(o => o.id === prevX)) {
    xSel.value = prevX;
  } else {
    const firstYes = options.find(o => o.weight > 0 || o.min > 0);
    if (firstYes) xSel.value = firstYes.id;
  }

  if (prevY && options.find(o => o.id === prevY)) {
    ySel.value = prevY;
  } else {
    const firstNo = options.find(o => (o.weight && o.weight < 0) || (o.max && o.max < 0));
    if (firstNo) ySel.value = firstNo.id;
    else if (options.length > 1) ySel.value = options[1].id;
  }
}

function getFactorInfo(id) {
  const all = getAllFactorOptions();
  return all.find(o => o.id === id) || null;
}

function getFactorContribution(id, pct) {
  const info = getFactorInfo(id);
  if (!info) return 0;
  if (info.type === 'toggle') {
    return pct >= 0.5 ? info.weight : 0;
  }
  // slider
  return info.min + (info.max - info.min) * pct;
}

function getCurrentFactorPct(id) {
  const info = getFactorInfo(id);
  if (!info) return 0;
  if (info.type === 'toggle') {
    return activeToggles.has(id) ? 1.0 : 0.0;
  }
  // slider
  const sliderEl = document.querySelector(`input[type="range"][data-id="${id}"]`);
  return sliderEl ? parseInt(sliderEl.value) / 100 : 0;
}

function computeScoreForAxes(xId, yId, xPct, yPct, baselineScore) {
  // baseline already excludes x and y contributions
  return baselineScore + getFactorContribution(xId, xPct) + getFactorContribution(yId, yPct);
}

function scoreToColor(s) {
  // 5-stop pink gradient: deep plum -> dark rose -> dusty pink -> hot pink -> magenta
  const stops = [
    { s: 0,   r: 44,  g: 18,  b: 48  },  // deep plum
    { s: 30,  r: 140, g: 58,  b: 90  },  // dark rose
    { s: 50,  r: 217, g: 140, b: 184 },  // dusty pink
    { s: 70,  r: 255, g: 105, b: 180 },  // hot pink
    { s: 100, r: 255, g: 20,  b: 147 },  // deep pink/magenta
  ];

  s = Math.max(0, Math.min(100, s));

  for (let i = 0; i < stops.length - 1; i++) {
    if (s <= stops[i + 1].s) {
      const t = (s - stops[i].s) / (stops[i + 1].s - stops[i].s);
      const smooth = t * t * (3 - 2 * t); // smoothstep
      return {
        r: Math.round(stops[i].r + (stops[i + 1].r - stops[i].r) * smooth),
        g: Math.round(stops[i].g + (stops[i + 1].g - stops[i].g) * smooth),
        b: Math.round(stops[i].b + (stops[i + 1].b - stops[i].b) * smooth),
      };
    }
  }
  const last = stops[stops.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}

function marchingSquaresSegments(grid, w, h, threshold) {
  const segments = [];
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = grid[y * w + x] >= threshold ? 1 : 0;
      const tr = grid[y * w + x + 1] >= threshold ? 1 : 0;
      const br = grid[(y + 1) * w + x + 1] >= threshold ? 1 : 0;
      const bl = grid[(y + 1) * w + x] >= threshold ? 1 : 0;
      const caseIndex = (tl << 3) | (tr << 2) | (br << 1) | bl;

      if (caseIndex === 0 || caseIndex === 15) continue;

      const vtl = grid[y * w + x];
      const vtr = grid[y * w + x + 1];
      const vbr = grid[(y + 1) * w + x + 1];
      const vbl = grid[(y + 1) * w + x];

      const lerp = (a, b) => (threshold - a) / (b - a);

      const top = { x: x + lerp(vtl, vtr), y };
      const right = { x: x + 1, y: y + lerp(vtr, vbr) };
      const bottom = { x: x + lerp(vbl, vbr), y: y + 1 };
      const left = { x, y: y + lerp(vtl, vbl) };

      const cases = {
        1:  [[left, bottom]],
        2:  [[bottom, right]],
        3:  [[left, right]],
        4:  [[top, right]],
        5:  [[top, left], [bottom, right]],
        6:  [[top, bottom]],
        7:  [[top, left]],
        8:  [[top, left]],
        9:  [[top, bottom]],
        10: [[top, right], [bottom, left]],
        11: [[top, right]],
        12: [[left, right]],
        13: [[bottom, right]],
        14: [[left, bottom]],
      };

      if (cases[caseIndex]) {
        cases[caseIndex].forEach(seg => segments.push(seg));
      }
    }
  }
  return segments;
}

function drawContourLine(ctx, segments, w, h, canvasW, canvasH) {
  const sx = canvasW / w;
  const sy = canvasH / h;

  ctx.save();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  segments.forEach(([a, b]) => {
    ctx.moveTo(a.x * sx, a.y * sy);
    ctx.lineTo(b.x * sx, b.y * sy);
  });
  ctx.stroke();
  ctx.restore();
}

function drawCrosshair(ctx, xPct, yPct, canvasW, canvasH) {
  const px = xPct * canvasW;
  const py = (1 - yPct) * canvasH; // y is inverted (0 at bottom)

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;

  // vertical line
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, canvasH);
  ctx.stroke();

  // horizontal line
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.lineTo(canvasW, py);
  ctx.stroke();

  ctx.setLineDash([]);

  // dot
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function renderBoundaryHeatmap() {
  if (!boundaryOpen) return;

  const canvas = document.getElementById('boundary-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const xId = document.getElementById('boundary-x-axis').value;
  const yId = document.getElementById('boundary-y-axis').value;
  if (!xId || !yId) return;

  // Update axis labels
  const xInfo = getFactorInfo(xId);
  const yInfo = getFactorInfo(yId);
  document.getElementById('boundary-x-label').textContent = xInfo ? xInfo.label : '';
  document.getElementById('boundary-y-label').textContent = yInfo ? yInfo.label : '';

  // Set canvas resolution
  const wrapper = document.getElementById('boundary-canvas-wrapper');
  const size = Math.min(wrapper.clientWidth - 40, 500);
  canvas.width = size;
  canvas.height = size;

  // Compute baseline score excluding the two axis factors
  let baseline = BASE_SCORE;
  document.querySelectorAll('.factor-card input[type="checkbox"]:checked').forEach(cb => {
    const id = cb.dataset.id;
    if (id !== xId && id !== yId) baseline += parseInt(cb.dataset.weight);
  });
  Object.entries(sliderValues).forEach(([id, v]) => {
    if (id !== xId && id !== yId) baseline += v;
  });

  // Compute score grid
  const grid = new Float64Array(BOUNDARY_RES * BOUNDARY_RES);
  for (let gy = 0; gy < BOUNDARY_RES; gy++) {
    for (let gx = 0; gx < BOUNDARY_RES; gx++) {
      const xPct = gx / (BOUNDARY_RES - 1);
      const yPct = 1 - gy / (BOUNDARY_RES - 1); // flip Y so 0 is bottom
      grid[gy * BOUNDARY_RES + gx] = computeScoreForAxes(xId, yId, xPct, yPct, baseline);
    }
  }

  // Render heatmap
  const imgData = ctx.createImageData(BOUNDARY_RES, BOUNDARY_RES);
  for (let i = 0; i < BOUNDARY_RES * BOUNDARY_RES; i++) {
    const color = scoreToColor(grid[i]);
    imgData.data[i * 4] = color.r;
    imgData.data[i * 4 + 1] = color.g;
    imgData.data[i * 4 + 2] = color.b;
    imgData.data[i * 4 + 3] = 255;
  }

  // Draw to offscreen canvas, then scale up
  const offscreen = document.createElement('canvas');
  offscreen.width = BOUNDARY_RES;
  offscreen.height = BOUNDARY_RES;
  offscreen.getContext('2d').putImageData(imgData, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0, size, size);

  // Draw contour line at threshold
  const segments = marchingSquaresSegments(grid, BOUNDARY_RES, BOUNDARY_RES, DECISION_THRESHOLD);
  drawContourLine(ctx, segments, BOUNDARY_RES, BOUNDARY_RES, size, size);

  // Draw crosshair at current position
  const curX = getCurrentFactorPct(xId);
  const curY = getCurrentFactorPct(yId);
  drawCrosshair(ctx, curX, curY, size, size);
}

function requestBoundaryRender() {
  if (!boundaryOpen) return;
  if (boundaryAnimId) cancelAnimationFrame(boundaryAnimId);
  boundaryAnimId = requestAnimationFrame(() => {
    boundaryAnimId = null;
    renderBoundaryHeatmap();
  });
}

function initBoundaryToggle() {
  const toggle = document.getElementById('boundary-toggle');
  const content = document.getElementById('boundary-content');
  const icon = document.getElementById('boundary-toggle-icon');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    boundaryOpen = !boundaryOpen;
    content.classList.toggle('open', boundaryOpen);
    icon.innerHTML = boundaryOpen ? '&#9660;' : '&#9654;';
    if (boundaryOpen) {
      populateBoundarySelectors();
      requestBoundaryRender();
    }
  });
}

function initBoundarySelectors() {
  const xSel = document.getElementById('boundary-x-axis');
  const ySel = document.getElementById('boundary-y-axis');
  if (!xSel || !ySel) return;

  xSel.addEventListener('change', () => requestBoundaryRender());
  ySel.addEventListener('change', () => requestBoundaryRender());
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
const yesCol = document.getElementById('yes-column');
const noCol = document.getElementById('no-column');

yesFactors.forEach(f => yesCol.appendChild(createCard(f, 'yes')));
yesSliders.forEach(s => yesCol.appendChild(createSliderCard(s, 'yes')));
noFactors.forEach(f => noCol.appendChild(createCard(f, 'no')));
noSliders.forEach(s => noCol.appendChild(createSliderCard(s, 'no')));

updateFace();
updateEasterEgg();
renderHistory();

initBoundaryToggle();
initBoundarySelectors();

requestAnimationFrame(() => {
  requestAnimationFrame(() => drawLines());
});
window.addEventListener('resize', drawLines);
