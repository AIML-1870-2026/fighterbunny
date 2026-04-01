/* ===== TAB 1: THREAT WINDOW ===== */

(function () {
  let feedData = null;         // raw API response
  let allAsteroids = [];       // flat array for the week
  let refreshTimer = null;
  let refreshCountdown = 300;  // seconds until next refresh
  let radarAnimFrame = null;
  let radarAngle = 0;

  // ---- INIT ----
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('threat-sort').addEventListener('change', renderTab1);
    document.getElementById('hazard-filter').addEventListener('change', renderTab1);
    loadFeed();
  });

  // ---- DATA FETCHING ----
  async function loadFeed() {
    const start = todayUTC();
    const end = addDaysUTC(start, 7);
    const timeline = document.getElementById('threat-timeline');
    const summaryBar = document.getElementById('summary-bar');
    summaryBar.querySelectorAll('.stat-val').forEach(v => { v.textContent = '—'; });
    timeline.innerHTML = skeletonCards(6);
    setApiStatus(null);

    try {
      feedData = await apiFetch('/feed', { start_date: start, end_date: end });
      allAsteroids = [];
      const near = feedData.near_earth_objects || {};
      for (const date of Object.keys(near).sort()) {
        for (const neo of near[date]) {
          const ca = neo.close_approach_data[0] || {};
          allAsteroids.push({
            id: neo.id,
            name: neo.name,
            hazardous: neo.is_potentially_hazardous_asteroid,
            date,
            approach_time: ca.close_approach_date_full || date,
            miss_km: parseFloat(ca.miss_distance?.kilometers || 0),
            miss_ld: parseFloat(ca.miss_distance?.lunar || 0),
            vel_kmps: parseFloat(ca.relative_velocity?.kilometers_per_second || 0),
            vel_kmph: parseFloat(ca.relative_velocity?.kilometers_per_hour || 0),
            diam_min: parseFloat(neo.estimated_diameter?.meters?.estimated_diameter_min || 0),
            diam_max: parseFloat(neo.estimated_diameter?.meters?.estimated_diameter_max || 0),
          });
        }
      }

      setApiStatus(true);
      document.getElementById('last-updated').textContent =
        `LAST UPDATED: ${new Date().toUTCString().slice(17, 25)} UTC`;

      renderTab1();
      if (typeof window._splashResolve === 'function') window._splashResolve(true);

      // Add browse cache data for tab3 similar asteroids
      if (typeof State !== 'undefined') {
        allAsteroids.forEach(a => {
          if (!State.browseCache.find(x => x.id === a.id)) State.browseCache.push(a);
        });
      }

      startAutoRefresh();
    } catch (err) {
      setApiStatus(false);
      showError(timeline, err.message, loadFeed);
      if (typeof window._splashResolve === 'function') window._splashResolve(false);
    }
  }

  function startAutoRefresh() {
    clearInterval(refreshTimer);
    refreshCountdown = 300;
    refreshTimer = setInterval(() => {
      refreshCountdown--;
      const el = document.getElementById('refresh-countdown');
      const m = Math.floor(refreshCountdown / 60);
      const s = refreshCountdown % 60;
      el.textContent = `REFRESH IN ${m}:${String(s).padStart(2, '0')}`;
      if (refreshCountdown <= 0) loadFeed();
    }, 1000);
  }

  // ---- RENDER ----
  window.renderTab1 = function () {
    if (!allAsteroids.length) return;

    const sort = document.getElementById('threat-sort').value;
    const hazardOnly = document.getElementById('hazard-filter').checked;

    let filtered = hazardOnly ? allAsteroids.filter(a => a.hazardous) : [...allAsteroids];

    filtered.sort((a, b) => {
      if (sort === 'distance') return a.miss_ld - b.miss_ld;
      if (sort === 'velocity') return b.vel_kmps - a.vel_kmps;
      return a.approach_time < b.approach_time ? -1 : 1;
    });

    // Summary stats
    const hazCount = allAsteroids.filter(a => a.hazardous).length;
    const closest = allAsteroids.reduce((m, a) => a.miss_ld < m ? a.miss_ld : m, Infinity);
    const fastest = allAsteroids.reduce((m, a) => a.vel_kmps > m ? a.vel_kmps : m, 0);
    const totalEl = document.querySelector('#stat-total .stat-val');
    const hazEl = document.querySelector('#stat-hazardous .stat-val');
    const closestEl = document.querySelector('#stat-closest .stat-val');
    const fastestEl = document.querySelector('#stat-fastest .stat-val');
    animateTicker(totalEl, allAsteroids.length);
    animateTicker(hazEl, hazCount);
    animateTicker(closestEl, closest, ' LD');
    animateTicker(fastestEl, fastest, State.unit === 'mi' ? ' mi/s' : ' km/s');

    // Group by date
    const byDate = {};
    filtered.forEach(a => {
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });

    const timeline = document.getElementById('threat-timeline');
    timeline.innerHTML = '';

    if (filtered.length === 0) {
      timeline.innerHTML = '<div class="error-card" style="border-color:var(--muted);"><div class="error-msg">No asteroids match the current filter.</div></div>';
    }

    Object.keys(byDate).sort().forEach((date, di) => {
      const group = document.createElement('div');
      group.className = 'day-group';
      const cards = byDate[date];
      group.innerHTML = `
        <div class="day-header" role="button" aria-expanded="true" tabindex="0">
          <span class="day-label">${fmtDateLabel(date)}</span>
          <span class="day-count">${cards.length} OBJECT${cards.length !== 1 ? 'S' : ''}</span>
          <span class="day-toggle">▾</span>
        </div>
        <div class="day-cards"></div>
      `;
      const header = group.querySelector('.day-header');
      const dayCards = group.querySelector('.day-cards');

      header.addEventListener('click', () => toggleDayGroup(header, dayCards));
      header.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleDayGroup(header, dayCards); });

      cards.forEach((a, ci) => {
        const card = buildAsteroidCard(a, di * 5 + ci);
        dayCards.appendChild(card);
      });

      timeline.appendChild(group);
    });

    // Radar
    drawRadar(filtered);
  };

  function toggleDayGroup(header, cards) {
    const open = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', !open);
    header.querySelector('.day-toggle').textContent = open ? '▸' : '▾';
    cards.style.display = open ? 'none' : '';
  }

  function buildAsteroidCard(a, delay) {
    const card = document.createElement('div');
    card.className = `asteroid-card${a.hazardous ? ' hazardous' : ''}`;
    card.style.animationDelay = `${delay * 50}ms`;
    const starred = isFavorited(a.id);
    const diamPct = Math.min((a.diam_max / 1000) * 100, 100);

    card.innerHTML = `
      <div class="card-name">${escHtml(a.name)}</div>
      ${a.hazardous ? '<div class="hazard-badge">⚠ POTENTIALLY HAZARDOUS</div>' : ''}
      <button class="star-btn ${starred ? 'starred' : ''}" data-id="${a.id}"
        aria-label="${starred ? 'Remove from favorites' : 'Add to favorites'}">★</button>
      <div class="card-row">
        <span class="card-lbl">MISS DISTANCE</span>
        <span class="card-val mono">${a.miss_ld.toFixed(2)} LD / ${fmtDist(a.miss_km)}</span>
      </div>
      <div class="card-row">
        <span class="card-lbl">DIAMETER (EST.)</span>
        <span class="card-val mono">${fmtDiam(a.diam_min)} – ${fmtDiam(a.diam_max)}</span>
      </div>
      <div class="diameter-bar-wrap"><div class="diameter-bar" style="width:${diamPct.toFixed(1)}%"></div></div>
      <div class="card-row">
        <span class="card-lbl">VELOCITY</span>
        <span class="card-val mono">${fmtVel(a.vel_kmps)}</span>
      </div>
      <div class="card-row">
        <span class="card-lbl">APPROACH DATE</span>
        <span class="card-val mono">${escHtml(a.approach_time)}</span>
      </div>
      <button class="inspect-btn" data-id="${a.id}">INSPECT →</button>
    `;

    card.querySelector('.star-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(a.id, a.name, a.hazardous);
    });
    card.querySelector('.inspect-btn').addEventListener('click', () => loadDetailById(a.id));
    return card;
  }

  // ---- RADAR ----
  function drawRadar(asteroids) {
    if (radarAnimFrame) cancelAnimationFrame(radarAnimFrame);
    const svg = document.getElementById('radar-svg');
    svg.innerHTML = '';
    const W = 400, H = 400, cx = W / 2, cy = H / 2, R = 170;
    const NS = 'http://www.w3.org/2000/svg';

    // Background
    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', cx); bg.setAttribute('cy', cy);
    bg.setAttribute('r', R + 10);
    bg.setAttribute('fill', 'var(--surface)');
    svg.appendChild(bg);

    // Grid rings
    [1, 2, 3, 4].forEach(i => {
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', cx); ring.setAttribute('cy', cy);
      ring.setAttribute('r', R * i / 4);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', 'rgba(107,122,153,0.25)');
      ring.setAttribute('stroke-width', '1');
      svg.appendChild(ring);
      // LD label
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', cx + 4);
      lbl.setAttribute('y', cy - R * i / 4 + 4);
      lbl.setAttribute('fill', 'rgba(107,122,153,0.6)');
      lbl.setAttribute('font-size', '9');
      lbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
      lbl.textContent = `${i * 10} LD`;
      svg.appendChild(lbl);
    });

    // Moon ring (reference ~1 LD radius from Earth at ~384400 km)
    const moonRing = document.createElementNS(NS, 'circle');
    moonRing.setAttribute('cx', cx); moonRing.setAttribute('cy', cy);
    moonRing.setAttribute('r', R / 4);
    moonRing.setAttribute('fill', 'none');
    moonRing.setAttribute('stroke', 'rgba(200,208,224,0.3)');
    moonRing.setAttribute('stroke-dasharray', '4 4');
    moonRing.setAttribute('stroke-width', '1');
    svg.appendChild(moonRing);

    // Cross hairs
    [[cx, cy - R + 5, cx, cy + R - 5], [cx - R + 5, cy, cx + R - 5, cy]].forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'rgba(107,122,153,0.2)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    });

    // Sweep group (will be animated)
    const sweepGroup = document.createElementNS(NS, 'g');
    sweepGroup.id = 'radar-sweep';
    const sweepPath = document.createElementNS(NS, 'path');
    sweepPath.setAttribute('fill', 'url(#sweepGrad)');
    sweepGroup.appendChild(sweepPath);

    // Gradient for sweep
    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'radialGradient');
    grad.id = 'sweepGrad';
    grad.setAttribute('cx', '50%'); grad.setAttribute('cy', '50%');
    grad.setAttribute('r', '50%');
    const stop1 = document.createElementNS(NS, 'stop');
    stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', 'rgba(0,255,157,0.25)');
    const stop2 = document.createElementNS(NS, 'stop');
    stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', 'rgba(0,255,157,0)');
    grad.appendChild(stop1); grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(sweepGroup);

    // Earth dot
    const earth = document.createElementNS(NS, 'circle');
    earth.setAttribute('cx', cx); earth.setAttribute('cy', cy);
    earth.setAttribute('r', '6');
    earth.setAttribute('fill', '#3399ff');
    earth.setAttribute('filter', 'drop-shadow(0 0 4px #3399ff)');
    svg.appendChild(earth);

    // Asteroid dots
    const MAX_LD = 40;
    const dotEls = asteroids.map(a => {
      const normDist = Math.min(a.miss_ld / MAX_LD, 1);
      const r_dot = normDist * R;
      // Place at a random angle based on name hash for reproducibility
      const hash = a.id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
      const angle = ((hash % 360) / 360) * Math.PI * 2;
      const x = cx + r_dot * Math.cos(angle);
      const y = cy + r_dot * Math.sin(angle);
      const col = a.hazardous ? 'var(--danger)' : 'var(--accent)';

      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', col);
      dot.setAttribute('opacity', '0.9');
      dot.setAttribute('style', 'cursor:pointer;');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-label', `${a.name}: ${a.miss_ld.toFixed(2)} LD, ${a.approach_time}`);
      svg.appendChild(dot);

      // Tooltip events
      dot.addEventListener('mouseenter', e => showRadarTooltip(a, x, y));
      dot.addEventListener('mouseleave', () => { document.getElementById('radar-tooltip').hidden = true; });
      dot.addEventListener('click', () => loadDetailById(a.id));
      dot.addEventListener('keydown', e => { if (e.key === 'Enter') loadDetailById(a.id); });
      return { dot, x, y, angle, r_dot };
    });

    // Animate sweep
    function animateSweep(ts) {
      radarAngle = (radarAngle + 0.5) % 360;
      const rad = (radarAngle * Math.PI) / 180;
      const spread = Math.PI / 6; // 30 degree sweep
      const x1 = cx + R * Math.cos(rad);
      const y1 = cy + R * Math.sin(rad);
      const x2 = cx + R * Math.cos(rad - spread);
      const y2 = cy + R * Math.sin(rad - spread);
      sweepPath.setAttribute('d', `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 0 ${x2} ${y2} Z`);

      // Pulse dots that are "near" the sweep angle
      dotEls.forEach(({ dot, angle }) => {
        let a = angle;
        let sweep = (radarAngle * Math.PI) / 180;
        let diff = Math.abs(((sweep - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        dot.setAttribute('r', diff < 0.3 ? '7' : '5');
      });

      radarAnimFrame = requestAnimationFrame(animateSweep);
    }
    radarAnimFrame = requestAnimationFrame(animateSweep);
  }

  function showRadarTooltip(a, x, y) {
    const tooltip = document.getElementById('radar-tooltip');
    tooltip.hidden = false;
    tooltip.textContent = `${a.name} | ${a.miss_ld.toFixed(2)} LD | ${a.approach_time}`;
    const radarWrap = document.getElementById('radar-wrap');
    const rect = radarWrap.getBoundingClientRect();
    const svgEl = document.getElementById('radar-svg');
    const svgRect = svgEl.getBoundingClientRect();
    const scale = svgRect.width / 400;
    tooltip.style.left = (svgRect.left - rect.left + x * scale + 10) + 'px';
    tooltip.style.top = (svgRect.top - rect.top + y * scale - 24) + 'px';
  }

  // Expose loadFeed for external use
  window.reloadFeed = loadFeed;
})();
