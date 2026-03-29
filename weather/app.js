'use strict';

// ============================================================
// Config
// ============================================================
const API_KEY = 'fa0d357f331d49e046e7b8d647bf5eba';
const BASE    = 'https://api.openweathermap.org/data/2.5';

// ============================================================
// DOM References
// ============================================================
const searchInput    = document.getElementById('search-input');
const searchBtn      = document.getElementById('search-btn');
const errorMsg       = document.getElementById('error-msg');
const loading        = document.getElementById('loading');
const weatherContent = document.getElementById('weather-content');
const bgCanvas       = document.getElementById('bg-canvas');
const ctx            = bgCanvas.getContext('2d');
const lightningEl    = document.getElementById('lightning-overlay');
const mistEl         = document.getElementById('mist-overlay');

// ============================================================
// Animation State
// ============================================================
let animationId      = null;
let lightningTimer   = null;
let particles        = [];
let snowflakeEls     = [];
let starEls          = [];
let currentTheme     = '';

// ============================================================
// Unit Toggle State
// ============================================================
let isCelsius = false;
let rawTemps  = {}; // stores raw °F values for conversion

const unitToggle = document.getElementById('unit-toggle');
const unitLabel  = document.getElementById('unit-label');

function toC(f) { return Math.round((f - 32) * 5 / 9); }

function updateUnitDisplay() {
  if (!rawTemps.temp) return;
  const label = isCelsius ? '°C' : '°F';
  const other = isCelsius ? '°F' : '°C';
  unitLabel.textContent = label;
  unitToggle.textContent = other;

  document.getElementById('temperature').textContent = isCelsius
    ? toC(rawTemps.temp) : Math.round(rawTemps.temp);
  document.getElementById('feels-like').textContent =
    `Feels like ${isCelsius ? toC(rawTemps.feelsLike) : Math.round(rawTemps.feelsLike)}${label}`;
  document.getElementById('temp-minmax').textContent =
    `${isCelsius ? toC(rawTemps.max) : Math.round(rawTemps.max)}° / ${isCelsius ? toC(rawTemps.min) : Math.round(rawTemps.min)}°`;
}

unitToggle.addEventListener('click', () => {
  isCelsius = !isCelsius;
  updateUnitDisplay();
});

// ============================================================
// Utility: compass direction from degrees
// ============================================================
function degToCompass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ============================================================
// Utility: Unix timestamp → local time string
// ============================================================
function unixToTime(unix) {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Utility: round to 1 decimal
// ============================================================
const r1 = n => Math.round(n * 10) / 10;

// ============================================================
// Canvas resize
// ============================================================
function resizeCanvas() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================
// Stop all running animations
// ============================================================
function clearAnimations() {
  cancelAnimationFrame(animationId);
  animationId = null;
  clearInterval(lightningTimer);
  lightningTimer = null;
  particles = [];
  ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

  // Remove CSS snowflakes / stars
  snowflakeEls.forEach(el => el.remove());
  snowflakeEls = [];
  starEls.forEach(el => el.remove());
  starEls = [];

  lightningEl.style.opacity = '0';
  mistEl.style.opacity = '0';

  // Remove all theme classes
  document.body.className = '';
}

// ============================================================
// Rain / Drizzle Animation (canvas)
// ============================================================
function initRain(color = 'rgba(174,214,241,0.55)') {
  const count = 180;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      len: Math.random() * 18 + 8,
      speed: Math.random() * 6 + 8,
      opacity: Math.random() * 0.4 + 0.3,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    particles.forEach(p => {
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.len * 0.2, p.y + p.len);
      ctx.stroke();
      p.y += p.speed;
      p.x -= p.speed * 0.2;
      if (p.y > bgCanvas.height) {
        p.y = -p.len;
        p.x = Math.random() * bgCanvas.width;
      }
    });
    ctx.globalAlpha = 1;
    animationId = requestAnimationFrame(draw);
  }
  draw();
}

// ============================================================
// Lightning
// ============================================================
function startLightning() {
  function flash() {
    lightningEl.style.opacity = '0.9';
    setTimeout(() => { lightningEl.style.opacity = '0'; }, 80);
    setTimeout(() => {
      lightningEl.style.opacity = '0.6';
      setTimeout(() => { lightningEl.style.opacity = '0'; }, 60);
    }, 120);
  }

  function schedule() {
    const delay = Math.random() * 6000 + 4000;
    lightningTimer = setTimeout(() => {
      flash();
      schedule();
    }, delay);
  }
  schedule();
}

// ============================================================
// Snow Animation (CSS elements)
// ============================================================
function initSnow() {
  const count = 60;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'snowflake';
    el.textContent = '❄';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = (Math.random() * 0.8 + 0.6) + 'rem';
    el.style.opacity = (Math.random() * 0.5 + 0.5).toString();
    const dur = Math.random() * 6 + 6;
    const delay = Math.random() * -12;
    el.style.animation = `snowfall ${dur}s ${delay}s linear infinite`;
    document.body.appendChild(el);
    snowflakeEls.push(el);
  }
}

// ============================================================
// Star Animation (CSS dots)
// ============================================================
function initStars() {
  const count = 120;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'star';
    const size = Math.random() * 2.5 + 1;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = Math.random() * 100 + 'vw';
    el.style.top    = Math.random() * 80 + 'vh';
    const dur   = Math.random() * 3 + 2;
    const delay = Math.random() * -4;
    el.style.animation = `twinkle ${dur}s ${delay}s ease-in-out infinite alternate`;
    document.body.appendChild(el);
    starEls.push(el);
  }
}

// ============================================================
// Drifting Cloud Canvas (clear day / partly cloudy / overcast)
// ============================================================
function initClouds(opacity = 0.18) {
  const cloudCount = 6;
  const clouds = Array.from({ length: cloudCount }, () => ({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height * 0.5,
    r: Math.random() * 60 + 40,
    speed: Math.random() * 0.25 + 0.1,
    opacity: Math.random() * opacity + 0.08,
  }));

  function draw() {
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    clouds.forEach(c => {
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      grad.addColorStop(0, `rgba(255,255,255,${c.opacity})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      c.x += c.speed;
      if (c.x - c.r > bgCanvas.width) {
        c.x = -c.r;
        c.y = Math.random() * bgCanvas.height * 0.5;
      }
    });
    animationId = requestAnimationFrame(draw);
  }
  draw();
}

// ============================================================
// Apply Theme
// ============================================================
function applyTheme(weatherId, isNight) {
  clearAnimations();

  if (weatherId >= 200 && weatherId < 300) {
    // Thunderstorm
    currentTheme = 'thunderstorm';
    document.body.classList.add('theme-thunderstorm');
    initRain('rgba(150,180,200,0.45)');
    startLightning();

  } else if ((weatherId >= 300 && weatherId < 400) || (weatherId >= 500 && weatherId < 600)) {
    // Drizzle / Rain
    currentTheme = 'rain';
    document.body.classList.add('theme-rain');
    initRain();

  } else if (weatherId >= 600 && weatherId < 700) {
    // Snow
    currentTheme = 'snow';
    document.body.classList.add('theme-snow');
    initSnow();

  } else if (weatherId >= 700 && weatherId < 800) {
    // Fog / Mist / Haze / Atmosphere
    currentTheme = 'fog';
    document.body.classList.add('theme-fog');
    mistEl.style.opacity = '1';

  } else if (weatherId === 800) {
    // Clear
    if (isNight) {
      currentTheme = 'clear-night';
      document.body.classList.add('theme-clear-night');
      initStars();
    } else {
      currentTheme = 'clear-day';
      document.body.style.background = 'linear-gradient(135deg, #87CEEB 0%, #FDB813 100%)';
      initClouds(0.12);
    }

  } else if (weatherId === 801 || weatherId === 802) {
    // Partly cloudy
    currentTheme = 'partly-cloudy';
    document.body.classList.add('theme-partly-cloudy');
    initClouds(0.22);

  } else if (weatherId === 803 || weatherId === 804) {
    // Overcast
    currentTheme = 'overcast';
    document.body.classList.add('theme-overcast');
    initClouds(0.35);

  } else {
    // Default: clear day
    document.body.style.background = 'linear-gradient(135deg, #87CEEB 0%, #FDB813 100%)';
    initClouds(0.12);
  }
}

// ============================================================
// Populate UI
// ============================================================
function populateUI(current, forecast, aq) {
  const w   = current.weather[0];
  const m   = current.main;

  // Determine day/night
  const now     = current.dt;
  const sunrise = current.sys.sunrise;
  const sunset  = current.sys.sunset;
  const isNight = now < sunrise || now > sunset;

  // Store raw °F values for unit toggle
  rawTemps = { temp: m.temp, feelsLike: m.feels_like, max: m.temp_max, min: m.temp_min };

  // Hero
  document.getElementById('city-name').textContent    = current.name;
  document.getElementById('country').textContent      = current.sys.country;
  document.getElementById('weather-desc').textContent = w.description;

  const icon = document.getElementById('weather-icon');
  icon.src = `https://openweathermap.org/img/wn/${w.icon}@2x.png`;
  icon.alt = w.description;

  // Render temperatures via shared display function
  updateUnitDisplay();

  // Detail cards
  document.getElementById('humidity').textContent    = `${m.humidity}%`;
  document.getElementById('pressure').textContent    = `${m.pressure} hPa`;

  const windDir = current.wind.deg !== undefined ? degToCompass(current.wind.deg) : '';
  document.getElementById('wind').textContent = `${r1(current.wind.speed)} mph ${windDir}`;

  const visMiles = current.visibility !== undefined
    ? r1(current.visibility / 1609) + ' mi'
    : '—';
  document.getElementById('visibility').textContent = visMiles;
  document.getElementById('clouds').textContent     = `${current.clouds.all}%`;
  document.getElementById('sun-times').textContent  = `${unixToTime(sunrise)} / ${unixToTime(sunset)}`;

  // Air Quality
  const aqiLabels = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
  if (aq && aq.list && aq.list[0]) {
    const aqiCode = aq.list[0].main.aqi;
    document.getElementById('aqi').textContent = aqiLabels[aqiCode] || '—';
  } else {
    document.getElementById('aqi').textContent = '—';
  }

  // 5-day Forecast
  buildForecast(forecast);

  // Apply theme
  applyTheme(w.id, isNight);

  // Show content
  weatherContent.classList.remove('hidden');
}

// ============================================================
// Build Forecast Row
// ============================================================
function buildForecast(data) {
  const row = document.getElementById('forecast-row');
  row.innerHTML = '';

  // Group by calendar day (local)
  const dayMap = {};
  data.list.forEach(entry => {
    const date = new Date(entry.dt * 1000);
    const key  = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const day  = date.toLocaleDateString('en-US', { weekday: 'short' });
    if (!dayMap[key]) dayMap[key] = { day, highs: [], lows: [], icons: [], descs: [] };
    dayMap[key].highs.push(entry.main.temp_max);
    dayMap[key].lows.push(entry.main.temp_min);
    dayMap[key].icons.push(entry.weather[0].icon);
    dayMap[key].descs.push(entry.weather[0].description);
  });

  // Take up to 5 days, skip today if we already have current data
  const days = Object.values(dayMap).slice(0, 5);
  days.forEach(d => {
    const high = Math.round(Math.max(...d.highs));
    const low  = Math.round(Math.min(...d.lows));
    // Most frequent icon
    const icon = d.icons.sort((a, b) =>
      d.icons.filter(v => v === b).length - d.icons.filter(v => v === a).length
    )[0];
    const desc = d.descs[Math.floor(d.descs.length / 2)];

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <p class="forecast-day">${d.day}</p>
      <img class="forecast-icon" src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" />
      <p class="forecast-desc">${desc}</p>
      <p class="forecast-temps">${high}° <span>/ ${low}°</span></p>
    `;
    row.appendChild(card);
  });
}

// ============================================================
// Fetch All Weather Data
// ============================================================
async function fetchWeather(query) {
  setError('');
  loading.classList.remove('hidden');
  weatherContent.classList.add('hidden');

  try {
    // Detect zip vs city
    const isZip = /^\d{5}$/.test(query.trim());
    const currentUrl = isZip
      ? `${BASE}/weather?zip=${query.trim()},us&appid=${API_KEY}&units=imperial`
      : `${BASE}/weather?q=${encodeURIComponent(query.trim())}&appid=${API_KEY}&units=imperial`;

    const currentRes = await fetch(currentUrl);
    if (!currentRes.ok) {
      if (currentRes.status === 404) throw new Error('City not found — try again');
      throw new Error('Something went wrong. Please try again.');
    }
    const current = await currentRes.json();

    const { lat, lon } = current.coord;
    const cityName = current.name;

    // Parallel: forecast, UV (one call), air quality
    const [forecastRes, aqRes] = await Promise.all([
      fetch(`${BASE}/forecast?q=${encodeURIComponent(cityName)}&appid=${API_KEY}&units=imperial`),
      fetch(`${BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
    ]);

    const forecast = forecastRes.ok ? await forecastRes.json() : null;
    const aq       = aqRes.ok       ? await aqRes.json()       : null;

    // Cache last search
    localStorage.setItem('lastCity', query.trim());

    populateUI(current, forecast, aq);

  } catch (err) {
    setError(err.message || 'Something went wrong. Please try again.');
  } finally {
    loading.classList.add('hidden');
  }
}

// ============================================================
// Error helper
// ============================================================
function setError(msg) {
  errorMsg.textContent = msg;
}

// ============================================================
// Event Listeners
// ============================================================
searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q) fetchWeather(q);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) fetchWeather(q);
  }
});

// ============================================================
// Load last city on startup
// ============================================================
window.addEventListener('load', () => {
  const last = localStorage.getItem('lastCity');
  if (last) {
    searchInput.value = last;
    fetchWeather(last);
  }
});
