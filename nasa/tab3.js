/* ===== TAB 3: OBJECT DETAIL ===== */

(function () {
  let currentNeo = null;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('detail-id-submit').addEventListener('click', () => {
      const id = document.getElementById('detail-id-input').value.trim();
      if (id) loadDetailById(id);
    });
    document.getElementById('detail-id-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const id = e.target.value.trim();
        if (id) loadDetailById(id);
      }
    });
    document.getElementById('show-planets').addEventListener('change', () => {
      if (currentNeo) drawOrbit(currentNeo);
    });
    document.getElementById('jump-next-approach').addEventListener('click', jumpToNextApproach);
  });

  // ---- EXPOSED GLOBALLY ----
  window.loadDetailById = async function (id) {
    switchTab('detail');
    document.getElementById('detail-id-input').value = id;
    document.getElementById('detail-empty').hidden = true;
    document.getElementById('detail-main').hidden = true;

    // Spinner
    const content = document.getElementById('detail-content');
    let spinner = document.getElementById('detail-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'detail-spinner';
      spinner.className = 'skeleton';
      spinner.style.cssText = 'height:200px;margin-bottom:16px;';
      content.appendChild(spinner);
    }
    spinner.hidden = false;
    setApiStatus(null);

    try {
      let data = State.tab3Cache.get(id);
      if (!data) {
        data = await apiFetch(`/neo/${id}`);
        State.tab3Cache.set(id, data);
      }
      setApiStatus(true);
      spinner.hidden = true;
      currentNeo = data;
      renderDetail(data);
      window.rerenderDetail = () => renderDetail(currentNeo);
    } catch (err) {
      setApiStatus(false);
      spinner.hidden = true;
      document.getElementById('detail-empty').hidden = false;
      document.getElementById('detail-empty').textContent = `Error: ${err.message}`;
    }
  };

  window.rerenderDetail = function () {
    if (currentNeo) renderDetail(currentNeo);
  };

  // ---- RENDER DETAIL ----
  function renderDetail(neo) {
    document.getElementById('detail-main').hidden = false;
    document.getElementById('detail-empty').hidden = true;

    // Identity
    document.getElementById('detail-name').textContent = neo.name;
    const jplLink = document.getElementById('detail-jpl-link');
    jplLink.href = neo.nasa_jpl_url || '#';
    jplLink.textContent = `View on NASA JPL →`;

    const badges = document.getElementById('detail-badges');
    badges.innerHTML = '';
    if (neo.is_potentially_hazardous_asteroid) {
      badges.insertAdjacentHTML('beforeend', '<span class="hazard-badge">⚠ POTENTIALLY HAZARDOUS</span>');
    }
    if (neo.is_sentry_object) {
      badges.insertAdjacentHTML('beforeend', '<span class="hazard-badge" style="border-color:var(--danger);color:var(--danger);">SENTRY OBJECT</span>');
    }

    const meta = document.getElementById('detail-meta');
    meta.innerHTML = `
      <span>ABSOLUTE MAGNITUDE (H): ${neo.absolute_magnitude_h ?? '—'}</span>
      <span>NEO ID: ${neo.id}</span>
      <span>DESIGNATION: ${escHtml(neo.designation || neo.name)}</span>
    `;

    // Star button in detail view
    const existing = document.getElementById('detail-star-btn');
    if (existing) existing.remove();
    const starBtn = document.createElement('button');
    starBtn.id = 'detail-star-btn';
    starBtn.className = `star-btn ${isFavorited(neo.id) ? 'starred' : ''}`;
    starBtn.dataset.id = neo.id;
    starBtn.setAttribute('aria-label', isFavorited(neo.id) ? 'Remove from favorites' : 'Add to favorites');
    starBtn.textContent = '★';
    starBtn.style.cssText = 'font-size:20px;position:static;margin-bottom:10px;';
    starBtn.addEventListener('click', () => toggleFavorite(neo.id, neo.name, neo.is_potentially_hazardous_asteroid));
    meta.after(starBtn);

    // Size visualization
    drawSizeViz(neo);

    // Orbital diagram
    drawOrbit(neo);

    // Approach timeline
    buildApproachTimeline(neo);

    // Orbital data panel
    buildOrbitalReadout(neo);

    // Similar asteroids
    buildSimilarAsteroids(neo);
  }

  // ---- SIZE VIZ ----
  function drawSizeViz(neo) {
    const dMax = parseFloat(neo.estimated_diameter?.meters?.estimated_diameter_max || 0);
    const svg = document.getElementById('size-svg');
    const W = 300, H = 150;
    const NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';

    // References: football field = 91m, Eiffel Tower = 330m, Empire State = 443m
    const refs = [
      { name: 'Football field', size: 91 },
      { name: 'Eiffel Tower', size: 330 },
      { name: 'Empire State', size: 443 },
    ];
    const maxSize = Math.max(dMax, 443);
    const scale = (H - 30) / maxSize;

    // Draw reference bar (football field)
    const ref = refs[0];
    const refH = ref.size * scale;
    const refEl = document.createElementNS(NS, 'rect');
    refEl.setAttribute('x', '20'); refEl.setAttribute('y', H - 20 - refH);
    refEl.setAttribute('width', '30'); refEl.setAttribute('height', refH);
    refEl.setAttribute('fill', 'rgba(107,122,153,0.4)');
    svg.appendChild(refEl);
    const refLbl = document.createElementNS(NS, 'text');
    refLbl.setAttribute('x', '35'); refLbl.setAttribute('y', H - 22 - refH);
    refLbl.setAttribute('text-anchor', 'middle');
    refLbl.setAttribute('fill', 'var(--muted)');
    refLbl.setAttribute('font-size', '8');
    refLbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
    refLbl.textContent = ref.name;
    svg.appendChild(refLbl);

    // Draw asteroid circle
    const r = Math.max(Math.min(dMax * scale / 2, 60), 4);
    const cx = 160, cy = H / 2;
    const isHaz = neo.is_potentially_hazardous_asteroid;
    const col = isHaz ? 'var(--danger)' : 'var(--accent)';
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', col);
    circle.setAttribute('opacity', '0.7');
    circle.setAttribute('filter', `drop-shadow(0 0 6px ${col})`);
    svg.appendChild(circle);

    const lbl = document.getElementById('size-label');
    const dispDiam = State.unit === 'mi' ? `${mToFt(dMax).toFixed(0)} ft` : `${dMax.toFixed(0)} m diameter`;
    lbl.textContent = `Est. diameter: ${dispDiam} (max) vs ${ref.name} (${ref.size}m)`;
  }

  // ---- ORBITAL DIAGRAM ----
  function drawOrbit(neo) {
    const svg = document.getElementById('orbital-svg');
    const NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    const W = 500, H = 500, cx = W / 2, cy = H / 2;
    const showPlanets = document.getElementById('show-planets').checked;

    // Background
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('fill', 'var(--bg)'); bg.setAttribute('rx', '4');
    svg.appendChild(bg);

    // Sun
    const sun = document.createElementNS(NS, 'circle');
    sun.setAttribute('cx', cx); sun.setAttribute('cy', cy);
    sun.setAttribute('r', '8');
    sun.setAttribute('fill', '#ffd700');
    sun.setAttribute('filter', 'drop-shadow(0 0 8px #ffd700)');
    svg.appendChild(sun);

    const od = neo.orbital_data || {};
    const a_AU = parseFloat(od.semi_major_axis || 1.5);
    const ecc = parseFloat(od.eccentricity || 0.2);

    // Scale: 1 AU = ~120px
    const AU = 80;
    const scale = AU;

    // Inner planets
    if (showPlanets) {
      const planets = [
        { name: 'Mercury', a: 0.387, color: '#b5b5b5' },
        { name: 'Venus', a: 0.723, color: '#e8c84e' },
        { name: 'Earth', a: 1.0, color: '#3399ff' },
        { name: 'Mars', a: 1.524, color: '#cc4400' },
      ];
      planets.forEach(p => {
        const r = p.a * scale;
        const ellipse = document.createElementNS(NS, 'circle');
        ellipse.setAttribute('cx', cx); ellipse.setAttribute('cy', cy);
        ellipse.setAttribute('r', r);
        ellipse.setAttribute('fill', 'none');
        ellipse.setAttribute('stroke', p.color);
        ellipse.setAttribute('stroke-opacity', '0.3');
        ellipse.setAttribute('stroke-width', '1');
        svg.appendChild(ellipse);

        const dotR = p.name === 'Earth' ? 4 : 3;
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', cx + r);
        dot.setAttribute('cy', cy);
        dot.setAttribute('r', dotR);
        dot.setAttribute('fill', p.color);
        dot.setAttribute('opacity', '0.8');
        svg.appendChild(dot);

        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', cx + r + 6);
        lbl.setAttribute('y', cy + 4);
        lbl.setAttribute('fill', p.color);
        lbl.setAttribute('opacity', '0.7');
        lbl.setAttribute('font-size', '9');
        lbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
        lbl.textContent = p.name;
        svg.appendChild(lbl);
      });
    }

    // Asteroid orbit
    const a_px = Math.min(a_AU * scale, 220);
    const b_px = a_px * Math.sqrt(1 - ecc * ecc);
    const focus = a_px * ecc;
    const isHaz = neo.is_potentially_hazardous_asteroid;
    const orbitCol = isHaz ? 'var(--danger)' : 'var(--accent)';

    const orbit = document.createElementNS(NS, 'ellipse');
    orbit.setAttribute('cx', cx - focus);
    orbit.setAttribute('cy', cy);
    orbit.setAttribute('rx', a_px);
    orbit.setAttribute('ry', b_px);
    orbit.setAttribute('fill', 'none');
    orbit.setAttribute('stroke', orbitCol);
    orbit.setAttribute('stroke-opacity', '0.8');
    orbit.setAttribute('stroke-width', '1.5');
    orbit.setAttribute('stroke-dasharray', '4 2');
    svg.appendChild(orbit);

    // Perihelion / Aphelion labels
    const periX = cx - focus + a_px;
    const aphX = cx - focus - a_px;
    [{ x: periX, label: 'PERI' }, { x: aphX, label: 'APH' }].forEach(({ x, label }) => {
      if (x > 10 && x < W - 10) {
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', x);
        lbl.setAttribute('y', cy - 8);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('fill', orbitCol);
        lbl.setAttribute('font-size', '8');
        lbl.setAttribute('font-family', 'IBM Plex Mono, monospace');
        lbl.setAttribute('opacity', '0.7');
        lbl.textContent = label;
        svg.appendChild(lbl);
      }
    });

    // Animated dot traveling the orbit
    const animDot = document.createElementNS(NS, 'circle');
    animDot.setAttribute('r', '5');
    animDot.setAttribute('fill', orbitCol);
    animDot.setAttribute('filter', `drop-shadow(0 0 4px ${orbitCol})`);
    svg.appendChild(animDot);

    let t = 0;
    function animateOrbitDot() {
      t = (t + 0.002) % 1;
      const angle = t * Math.PI * 2;
      const x = cx - focus + a_px * Math.cos(angle);
      const y = cy + b_px * Math.sin(angle);
      animDot.setAttribute('cx', x);
      animDot.setAttribute('cy', y);
      requestAnimationFrame(animateOrbitDot);
    }
    animateOrbitDot();
  }

  // ---- APPROACH TIMELINE ----
  let approachData = [];

  function buildApproachTimeline(neo) {
    approachData = neo.close_approach_data || [];
    const scrubber = document.getElementById('approach-scrubber');
    const chart = document.getElementById('approach-bar-chart');
    const info = document.getElementById('approach-scrubber-info');

    if (approachData.length === 0) {
      chart.innerHTML = '<span style="font-family:var(--font-mono);color:var(--muted);font-size:12px;">No approach data available.</span>';
      return;
    }

    scrubber.min = 0;
    scrubber.max = approachData.length - 1;
    scrubber.value = 0;

    const distances = approachData.map(a => parseFloat(a.miss_distance?.lunar || 0));
    const maxDist = Math.max(...distances) || 1;
    const now = new Date().toISOString().slice(0, 10);

    chart.innerHTML = approachData.map((a, i) => {
      const d = parseFloat(a.miss_distance?.lunar || 0);
      const pct = Math.max((d / maxDist) * 100, 2);
      const isClose = d < 5;
      const isFuture = a.close_approach_date >= now;
      const color = isClose ? 'var(--danger)' : 'var(--accent)';
      return `<div class="approach-bar ${isFuture ? 'future' : ''}" data-idx="${i}"
        style="height:${pct}%;background:${color};opacity:${isFuture ? 1 : 0.5};"
        title="${a.close_approach_date}: ${d.toFixed(2)} LD"></div>`;
    }).join('');

    // Sync scrubber and chart hover
    chart.querySelectorAll('.approach-bar').forEach(bar => {
      bar.addEventListener('click', () => {
        scrubber.value = bar.dataset.idx;
        updateScrubberInfo(parseInt(bar.dataset.idx));
      });
    });

    scrubber.addEventListener('input', () => updateScrubberInfo(parseInt(scrubber.value)));
    updateScrubberInfo(0);
  }

  function updateScrubberInfo(idx) {
    const a = approachData[idx];
    if (!a) return;
    const ld = parseFloat(a.miss_distance?.lunar || 0);
    const vel = parseFloat(a.relative_velocity?.kilometers_per_second || 0);
    const info = document.getElementById('approach-scrubber-info');
    info.textContent = `${a.close_approach_date} | ${fmtDist(parseFloat(a.miss_distance?.kilometers || 0))} (${ld.toFixed(2)} LD) | ${fmtVel(vel)}`;
    // Highlight active bar
    document.querySelectorAll('.approach-bar').forEach((bar, i) => {
      bar.style.outline = i === idx ? '2px solid var(--accent)' : 'none';
    });
  }

  function jumpToNextApproach() {
    const now = new Date().toISOString().slice(0, 10);
    const idx = approachData.findIndex(a => a.close_approach_date >= now);
    if (idx !== -1) {
      const scrubber = document.getElementById('approach-scrubber');
      scrubber.value = idx;
      updateScrubberInfo(idx);
    }
  }

  // ---- ORBITAL READOUT ----
  function buildOrbitalReadout(neo) {
    const od = neo.orbital_data || {};
    const oc = od.orbit_class || {};
    const orbitClassDescs = {
      AMO: 'Amor — approaches Earth but never crosses orbit',
      APO: 'Apollo — Earth-crossing with semi-major axis > 1 AU',
      ATE: 'Aten — Earth-crossing with semi-major axis < 1 AU',
      IEO: 'Inner-Earth Object — orbit entirely inside Earth\'s',
      MCA: 'Mars-crossing asteroid',
      IMB: 'Inner main-belt asteroid',
      MBA: 'Main-belt asteroid',
      OMB: 'Outer main-belt asteroid',
    };
    const classCode = oc.orbit_class_type || '';
    const classDesc = orbitClassDescs[classCode] || oc.orbit_class_description || classCode;

    const fields = [
      ['ORBIT ID', od.orbit_id || '—'],
      ['ORBIT DET. DATE', od.orbit_determination_date?.slice(0, 10) || '—'],
      ['FIRST OBSERVED', od.first_observation_date || '—'],
      ['LAST OBSERVED', od.last_observation_date || '—'],
      ['OBSERVATIONS USED', od.observations_used || '—'],
      ['ORBITAL PERIOD (days)', od.orbital_period ? parseFloat(od.orbital_period).toFixed(2) : '—'],
      ['PERIHELION DIST. (AU)', od.perihelion_distance ? parseFloat(od.perihelion_distance).toFixed(4) : '—'],
      ['APHELION DIST. (AU)', od.aphelion_distance ? parseFloat(od.aphelion_distance).toFixed(4) : '—'],
      ['SEMI-MAJOR AXIS', od.semi_major_axis ? parseFloat(od.semi_major_axis).toFixed(4) + ' AU' : '—'],
      ['ECCENTRICITY', od.eccentricity || '—'],
      ['INCLINATION', od.inclination ? od.inclination + '°' : '—'],
      ['ORBIT CLASS', `${classCode} — ${classDesc}`],
    ];

    const readout = document.getElementById('orbital-readout');
    readout.innerHTML = fields.map(([k, v]) => `
      <div class="orbital-row">
        <span class="orbital-key">${escHtml(k)}</span>
        <span class="orbital-val">${escHtml(String(v))}</span>
      </div>
    `).join('');
  }

  // ---- SIMILAR ASTEROIDS ----
  function buildSimilarAsteroids(neo) {
    const od = neo.orbital_data || {};
    const classType = od.orbit_class?.orbit_class_type;
    const similarTitle = document.getElementById('similar-title');
    const similarList = document.getElementById('similar-list');

    similarTitle.textContent = classType ? `OTHER ${classType} ASTEROIDS` : 'OTHER ASTEROIDS';

    const candidates = State.browseCache.filter(a => {
      if (a.id === neo.id) return false;
      const aOd = a.orbital_data || {};
      return aOd.orbit_class?.orbit_class_type === classType;
    }).slice(0, 5);

    if (candidates.length === 0) {
      similarList.innerHTML = `
        <div style="font-family:var(--font-mono);color:var(--muted);font-size:12px;padding:12px 0;">
          No similar asteroids in cache.
          <button id="load-similar" style="margin-left:12px;background:none;border:1px solid var(--accent);color:var(--accent);font-family:var(--font-mono);font-size:11px;padding:4px 10px;cursor:pointer;border-radius:3px;">LOAD SIMILAR</button>
        </div>`;
      document.getElementById('load-similar')?.addEventListener('click', () => loadSimilar(neo, classType));
      return;
    }

    renderSimilarCards(candidates);
  }

  async function loadSimilar(neo, classType) {
    const similarList = document.getElementById('similar-list');
    similarList.innerHTML = '<div class="skeleton" style="height:60px;"></div>';
    try {
      const data = await apiFetch('/neo/browse', { page: 0, size: 20 });
      const neos = data.near_earth_objects || [];
      neos.forEach(a => {
        if (!State.browseCache.find(x => x.id === a.id)) State.browseCache.push(a);
      });
      const candidates = State.browseCache.filter(a => {
        if (a.id === neo.id) return false;
        return (a.orbital_data?.orbit_class?.orbit_class_type === classType);
      }).slice(0, 5);
      if (candidates.length) renderSimilarCards(candidates);
      else similarList.innerHTML = '<div style="font-family:var(--font-mono);color:var(--muted);font-size:12px;">No similar asteroids found.</div>';
    } catch (err) {
      showError(similarList, err.message);
    }
  }

  function renderSimilarCards(candidates) {
    const similarList = document.getElementById('similar-list');
    similarList.innerHTML = candidates.map(a => {
      const isNeo = a.is_potentially_hazardous_asteroid;
      const dMax = parseFloat(a.estimated_diameter?.meters?.estimated_diameter_max || 0).toFixed(0);
      const ca = (a.close_approach_data || []).sort((x, y) =>
        parseFloat(x.miss_distance?.lunar || 0) - parseFloat(y.miss_distance?.lunar || 0))[0];
      const closest = ca ? `${parseFloat(ca.miss_distance?.lunar || 0).toFixed(2)} LD` : '—';
      return `<div class="similar-card" data-id="${a.id}" tabindex="0" role="button" aria-label="Inspect ${escHtml(a.name)}">
        <div class="similar-name">${escHtml(a.name)}</div>
        <div class="similar-meta">
          ${isNeo ? '<span class="hazard-badge" style="font-size:9px;padding:1px 6px;">HAZARDOUS</span>' : ''}
          Dia: ${fmtDiam(dMax)} | Closest: ${closest}
        </div>
      </div>`;
    }).join('');

    similarList.querySelectorAll('.similar-card').forEach(card => {
      card.addEventListener('click', () => loadDetailById(card.dataset.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') loadDetailById(card.dataset.id); });
    });
  }
})();
