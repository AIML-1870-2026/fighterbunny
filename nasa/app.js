/* ===== GLOBAL STATE ===== */
const State = {
  unit: localStorage.getItem('neo_unit') || 'km',     // 'km' | 'mi'
  theme: localStorage.getItem('neo_theme') || 'dark', // 'dark' | 'light'
  favorites: JSON.parse(localStorage.getItem('neo_favorites') || '[]'),
  activeTab: 'threat',
  tab2Cache: {},       // page -> data
  tab3Cache: new Map(),// id -> data
  browseCache: [],     // flat array of all loaded NEOs for similar-asteroid matching
};

function saveFavorites() {
  localStorage.setItem('neo_favorites', JSON.stringify(State.favorites));
}

function toggleFavorite(id, name, isHazardous) {
  const idx = State.favorites.findIndex(f => f.id === id);
  if (idx === -1) {
    State.favorites.push({ id, name, is_hazardous: isHazardous });
  } else {
    State.favorites.splice(idx, 1);
  }
  saveFavorites();
  renderFavoritesDrawer();
  updateFavBadge();
  // update all star buttons with this id
  document.querySelectorAll(`.star-btn[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('starred', State.favorites.some(f => f.id === id));
    btn.setAttribute('aria-label', State.favorites.some(f => f.id === id) ? 'Remove from favorites' : 'Add to favorites');
  });
}

function isFavorited(id) {
  return State.favorites.some(f => f.id === id);
}

/* ===== UNIT HELPERS ===== */
function kmToMi(km) { return km * 0.621371; }
function kmToFt(km) { return km * 3280.84; }
function mToFt(m) { return m * 3.28084; }

function fmtDist(km) {
  if (State.unit === 'mi') return `${kmToMi(parseFloat(km)).toFixed(2)} mi`;
  return `${parseFloat(km).toFixed(2)} km`;
}
function fmtVel(kmps) {
  if (State.unit === 'mi') return `${kmToMi(parseFloat(kmps)).toFixed(2)} mi/s`;
  return `${parseFloat(kmps).toFixed(2)} km/s`;
}
function fmtDiam(m) {
  if (State.unit === 'mi') return `${mToFt(parseFloat(m)).toFixed(0)} ft`;
  return `${parseFloat(m).toFixed(0)} m`;
}

/* ===== DATE HELPERS ===== */
function todayUTC() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()} — ${days[d.getUTCDay()]}`;
}

/* ===== API ===== */
async function apiFetch(endpoint, params = {}) {
  const url = new URL(CONFIG.BASE_URL + endpoint);
  url.searchParams.set('api_key', CONFIG.API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

function setApiStatus(ok) {
  const dot = document.getElementById('api-dot');
  const lbl = document.getElementById('api-label');
  if (ok === null) { dot.className = 'status-dot'; lbl.textContent = 'CONNECTING'; }
  else if (ok) { dot.className = 'status-dot ok'; lbl.textContent = 'ONLINE'; }
  else { dot.className = 'status-dot err'; lbl.textContent = 'ERROR'; }
}

/* ===== TICKER (count-up) ===== */
function animateTicker(el, target, suffix = '') {
  const start = 0;
  const duration = 600;
  const startTime = performance.now();
  const isFloat = target % 1 !== 0;
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const val = start + (target - start) * t;
    el.textContent = isFloat ? val.toFixed(2) + suffix : Math.round(val) + suffix;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ===== SPLASH ===== */
function initSplash() {
  const splash = document.getElementById('splash');
  const skipBtn = document.getElementById('splash-skip');
  const titleEl = document.getElementById('splash-title');
  const statusEl = document.getElementById('splash-status');
  const progressBar = document.getElementById('splash-progress-bar');
  const canvas = document.getElementById('splash-stars');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Draw stars
  const stars = Array.from({ length: 200 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.5 + 0.3,
    a: Math.random() * 0.8 + 0.2,
  }));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fill();
  });

  // Type-out title
  const title = 'NEO WATCH';
  let i = 0;
  const typeInterval = setInterval(() => {
    titleEl.textContent = title.slice(0, ++i);
    if (i >= title.length) clearInterval(typeInterval);
  }, 80);

  // Progress bar
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 3, 90);
    progressBar.style.width = progress + '%';
  }, 60);

  skipBtn.addEventListener('click', dismissSplash);
  skipBtn.focus();

  // The actual first fetch happens in tab1 init; we resolve after 3s max or signal
  window._splashResolve = (ok) => {
    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    statusEl.textContent = ok ? 'SYSTEMS ONLINE' : 'SYSTEMS READY';
    setTimeout(dismissSplash, 500);
  };

  setTimeout(() => { if (splash && !splash.classList.contains('dissolve')) window._splashResolve(true); }, 3500);
}

function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash || splash.classList.contains('dissolve')) return;
  splash.classList.add('dissolve');
  document.getElementById('dashboard').hidden = false;
  setTimeout(() => splash.remove(), 700);
}

/* ===== UTC CLOCK ===== */
function startClock() {
  const el = document.getElementById('utc-clock');
  function update() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    el.textContent = `${h}:${m}:${s} UTC`;
  }
  update();
  setInterval(update, 1000);
}

/* ===== TABS ===== */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    btn.addEventListener('keydown', e => {
      const tabs = [...document.querySelectorAll('.tab-btn')];
      const idx = tabs.indexOf(btn);
      if (e.key === 'ArrowRight') tabs[(idx + 1) % tabs.length].focus();
      if (e.key === 'ArrowLeft') tabs[(idx + tabs.length - 1) % tabs.length].focus();
    });
  });
}

function switchTab(name) {
  State.activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `tab-${name}`);
  });
}

/* ===== UNIT TOGGLE ===== */
function initUnitToggle() {
  const btn = document.getElementById('unit-toggle');
  btn.textContent = State.unit.toUpperCase();
  btn.addEventListener('click', () => {
    State.unit = State.unit === 'km' ? 'mi' : 'km';
    btn.textContent = State.unit.toUpperCase();
    localStorage.setItem('neo_unit', State.unit);
    if (typeof renderTab1 === 'function') renderTab1();
    if (typeof rerenderCatalog === 'function') rerenderCatalog();
    if (typeof rerenderDetail === 'function') rerenderDetail();
  });
}

/* ===== THEME TOGGLE ===== */
function initThemeToggle() {
  document.documentElement.setAttribute('data-theme', State.theme);
  const btn = document.getElementById('theme-toggle');
  btn.textContent = State.theme === 'dark' ? '☀' : '☾';
  btn.addEventListener('click', () => {
    State.theme = State.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', State.theme);
    btn.textContent = State.theme === 'dark' ? '☀' : '☾';
    localStorage.setItem('neo_theme', State.theme);
  });
}

/* ===== FAVORITES ===== */
function initFavorites() {
  updateFavBadge();
  document.getElementById('favorites-btn').addEventListener('click', () => {
    document.getElementById('fav-drawer').hidden = false;
    document.getElementById('fav-overlay').hidden = false;
    renderFavoritesDrawer();
  });
  document.getElementById('fav-drawer-close').addEventListener('click', closeFavDrawer);
  document.getElementById('fav-overlay').addEventListener('click', closeFavDrawer);
  document.getElementById('fav-clear').addEventListener('click', () => {
    State.favorites = [];
    saveFavorites();
    renderFavoritesDrawer();
    updateFavBadge();
    document.querySelectorAll('.star-btn.starred').forEach(b => {
      b.classList.remove('starred');
      b.setAttribute('aria-label', 'Add to favorites');
    });
  });
}

function closeFavDrawer() {
  document.getElementById('fav-drawer').hidden = true;
  document.getElementById('fav-overlay').hidden = true;
}

function updateFavBadge() {
  const badge = document.getElementById('fav-badge');
  const count = State.favorites.length;
  badge.textContent = Math.min(count, 99);
  badge.hidden = count === 0;
}

function renderFavoritesDrawer() {
  const list = document.getElementById('fav-list');
  if (State.favorites.length === 0) {
    list.innerHTML = '<div class="fav-empty">No favorites yet.<br/>Star an asteroid to save it here.</div>';
    return;
  }
  list.innerHTML = State.favorites.map(f => `
    <div class="fav-item">
      <div class="fav-item-info">
        <div class="fav-item-name">${escHtml(f.name)}</div>
        ${f.is_hazardous ? '<span class="hazard-badge">HAZARDOUS</span>' : ''}
      </div>
      <button class="fav-go-btn" data-id="${f.id}" aria-label="Go to detail for ${escHtml(f.name)}">INSPECT</button>
      <button class="fav-rm-btn" data-id="${f.id}" aria-label="Remove ${escHtml(f.name)} from favorites">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.fav-go-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeFavDrawer();
      loadDetailById(btn.dataset.id);
    });
  });
  list.querySelectorAll('.fav-rm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      State.favorites = State.favorites.filter(f => f.id !== id);
      saveFavorites();
      renderFavoritesDrawer();
      updateFavBadge();
      document.querySelectorAll(`.star-btn[data-id="${id}"]`).forEach(b => {
        b.classList.remove('starred');
        b.setAttribute('aria-label', 'Add to favorites');
      });
    });
  });
}

/* ===== HELPERS ===== */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(container, message, retryFn) {
  container.innerHTML = `
    <div class="error-card">
      <div class="error-title">ERROR</div>
      <div class="error-msg">${escHtml(message)}</div>
      ${retryFn ? '<button class="retry-btn">RETRY</button>' : ''}
    </div>`;
  if (retryFn) container.querySelector('.retry-btn').addEventListener('click', retryFn);
}

function skeletonCards(n = 4) {
  return Array.from({ length: n }, () => `<div class="skeleton skeleton-card"></div>`).join('');
}
function skeletonRows(n = 6) {
  return Array.from({ length: n }, () => `<div class="skeleton skeleton-row"></div>`).join('');
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  startClock();
  initTabs();
  initUnitToggle();
  initThemeToggle();
  initFavorites();

  // tab modules initialize themselves after DOM ready
});
