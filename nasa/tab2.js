/* ===== TAB 2: ASTEROID CATALOG ===== */

(function () {
  let currentPage = 0;
  let totalPages = 0;
  let pageData = null;   // current page raw API data
  let selected = [];     // compare: array of max 2 {id, name}
  let searchDebounce = null;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('catalog-prev').addEventListener('click', () => loadPage(currentPage - 1));
    document.getElementById('catalog-next').addEventListener('click', () => loadPage(currentPage + 1));
    document.getElementById('catalog-sort').addEventListener('change', rerenderCatalog);
    document.getElementById('catalog-hazard-filter').addEventListener('change', rerenderCatalog);
    document.getElementById('compare-btn').addEventListener('click', showComparePanel);

    const searchInput = document.getElementById('catalog-search');
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => handleSearch(searchInput.value.trim()), 300);
    });

    loadPage(0);
  });

  // ---- DATA ----
  async function loadPage(page) {
    if (page < 0 || (totalPages > 0 && page >= totalPages)) return;
    const tbody = document.getElementById('catalog-tbody');
    tbody.innerHTML = skeletonRows(10).replace(/skeleton-row/g, 'skeleton-row').replace(/<div/g, '<tr><td colspan="10"><div').replace(/<\/div>/g, '</div></td></tr>');
    document.getElementById('catalog-prev').disabled = true;
    document.getElementById('catalog-next').disabled = true;

    if (State.tab2Cache[page]) {
      pageData = State.tab2Cache[page];
      renderCatalogPage();
      return;
    }

    try {
      setApiStatus(null);
      const data = await apiFetch('/neo/browse', { page, size: 20 });
      setApiStatus(true);
      State.tab2Cache[page] = data;
      pageData = data;
      currentPage = page;
      totalPages = data.page?.total_pages ?? Math.ceil((data.page?.total_elements ?? 0) / 20);
      // Cache for similar asteroid matching
      (data.near_earth_objects || []).forEach(neo => {
        if (!State.browseCache.find(x => x.id === neo.id)) State.browseCache.push(neo);
      });
      renderCatalogPage();
    } catch (err) {
      setApiStatus(false);
      const tbody = document.getElementById('catalog-tbody');
      tbody.innerHTML = `<tr><td colspan="10"><div class="error-card"><div class="error-title">ERROR</div><div class="error-msg">${escHtml(err.message)}</div><button class="retry-btn">RETRY</button></div></td></tr>`;
      tbody.querySelector('.retry-btn').addEventListener('click', () => loadPage(currentPage));
    }
  }

  function renderCatalogPage() {
    if (!pageData) return;
    currentPage = pageData.page?.number ?? currentPage;
    totalPages = pageData.page?.total_pages ?? totalPages;
    document.getElementById('catalog-page-info').textContent =
      `Page ${currentPage + 1} of ${totalPages}`;
    document.getElementById('catalog-prev').disabled = currentPage === 0;
    document.getElementById('catalog-next').disabled = currentPage >= totalPages - 1;
    rerenderCatalog();
  }

  window.rerenderCatalog = function () {
    if (!pageData) return;
    let rows = pageData.near_earth_objects || [];
    const sort = document.getElementById('catalog-sort').value;
    const hazOnly = document.getElementById('catalog-hazard-filter').checked;

    if (hazOnly) rows = rows.filter(r => r.is_potentially_hazardous_asteroid);

    rows = [...rows].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'diameter') {
        const da = a.estimated_diameter?.meters?.estimated_diameter_max || 0;
        const db = b.estimated_diameter?.meters?.estimated_diameter_max || 0;
        return db - da;
      }
      if (sort === 'hazardous') {
        return (b.is_potentially_hazardous_asteroid ? 1 : 0) - (a.is_potentially_hazardous_asteroid ? 1 : 0);
      }
      if (sort === 'observations') {
        const oa = a.orbital_data?.observations_used || 0;
        const ob = b.orbital_data?.observations_used || 0;
        return ob - oa;
      }
      return 0;
    });

    const tbody = document.getElementById('catalog-tbody');
    tbody.innerHTML = rows.map(neo => buildRow(neo)).join('');

    tbody.querySelectorAll('.inspect-td-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); loadDetailById(btn.dataset.id); });
    });
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => loadDetailById(tr.dataset.id));
    });
    tbody.querySelectorAll('.compare-check').forEach(cb => {
      cb.addEventListener('change', () => handleCompareToggle(cb.dataset.id, cb.dataset.name, cb.checked));
    });
    // Restore checked state
    selected.forEach(s => {
      const cb = tbody.querySelector(`.compare-check[data-id="${s.id}"]`);
      if (cb) cb.checked = true;
    });
  };

  function buildRow(neo) {
    const hazardous = neo.is_potentially_hazardous_asteroid;
    const jplId = (neo.nasa_jpl_url || '').split('/').pop();
    const dMin = parseFloat(neo.estimated_diameter?.meters?.estimated_diameter_min || 0);
    const dMax = parseFloat(neo.estimated_diameter?.meters?.estimated_diameter_max || 0);
    const first = neo.orbital_data?.first_observation_date || '—';
    const last = neo.orbital_data?.last_observation_date || '—';
    const obs = neo.orbital_data?.observations_used || '—';
    const sparkSvg = buildSparkline(neo.close_approach_data || []);

    return `<tr data-id="${neo.id}" class="${hazardous ? 'hazard-row' : ''}" style="cursor:pointer;">
      <td class="mono" style="font-size:12px;">${escHtml(neo.name)}</td>
      <td><a class="jpl-link" href="${escHtml(neo.nasa_jpl_url || '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escHtml(jplId)}</a></td>
      <td class="hazard-icon">${hazardous ? '⚠' : '—'}</td>
      <td class="mono" style="font-size:11px;">${fmtDiam(dMin)} – ${fmtDiam(dMax)}</td>
      <td>${sparkSvg}</td>
      <td class="mono" style="font-size:11px;">${escHtml(first)}</td>
      <td class="mono" style="font-size:11px;">${escHtml(last)}</td>
      <td class="mono" style="font-size:11px;">${escHtml(String(obs))}</td>
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="compare-check" data-id="${neo.id}" data-name="${escHtml(neo.name)}" aria-label="Select for comparison" />
      </td>
      <td onclick="event.stopPropagation()">
        <button class="inspect-td-btn" data-id="${neo.id}" style="background:none;border:1px solid var(--accent);color:var(--accent);font-family:var(--font-mono);font-size:10px;padding:4px 10px;cursor:pointer;border-radius:3px;">INSPECT</button>
      </td>
    </tr>`;
  }

  function buildSparkline(approaches) {
    if (!approaches || approaches.length < 2) return '<span style="color:var(--muted);font-size:10px;">—</span>';
    const distances = approaches.map(a => parseFloat(a.miss_distance?.lunar || 0));
    const minD = Math.min(...distances);
    const maxD = Math.max(...distances) || 1;
    const W = 80, H = 24, pad = 2;
    const pts = distances.map((d, i) => {
      const x = pad + (i / (distances.length - 1)) * (W - pad * 2);
      const y = H - pad - ((d - minD) / (maxD - minD)) * (H - pad * 2);
      return `${x},${y}`;
    });
    const color = distances.some(d => d < 5) ? 'var(--danger)' : 'var(--accent)';
    return `<svg class="sparkline-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  }

  // ---- SEARCH ----
  async function handleSearch(query) {
    if (!query) {
      renderCatalogPage();
      return;
    }
    const tbody = document.getElementById('catalog-tbody');
    tbody.innerHTML = `<tr><td colspan="10"><div class="skeleton skeleton-row"></div></td></tr>`;
    try {
      setApiStatus(null);
      // Try numeric ID lookup first
      if (/^\d+$/.test(query)) {
        const data = await apiFetch(`/neo/${query}`);
        setApiStatus(true);
        pageData = { near_earth_objects: [data], page: { number: 0, total_pages: 1 } };
        document.getElementById('catalog-page-info').textContent = 'Search result';
        document.getElementById('catalog-prev').disabled = true;
        document.getElementById('catalog-next').disabled = true;
        rerenderCatalog();
      } else {
        // Client-side filter current page
        if (pageData) {
          const filtered = (pageData.near_earth_objects || []).filter(n =>
            n.name.toLowerCase().includes(query.toLowerCase())
          );
          tbody.innerHTML = filtered.length
            ? filtered.map(n => buildRow(n)).join('')
            : `<tr><td colspan="10" style="font-family:var(--font-mono);color:var(--muted);padding:20px;">No matches found on this page.</td></tr>`;
          setApiStatus(true);
        }
      }
    } catch (err) {
      setApiStatus(false);
      tbody.innerHTML = `<tr><td colspan="10"><div class="error-card"><div class="error-title">NOT FOUND</div><div class="error-msg">${escHtml(err.message)}</div></div></td></tr>`;
    }
  }

  // ---- COMPARE ----
  function handleCompareToggle(id, name, checked) {
    if (checked) {
      if (selected.length >= 2) {
        // Remove oldest
        const oldest = selected.shift();
        const cb = document.querySelector(`.compare-check[data-id="${oldest.id}"]`);
        if (cb) cb.checked = false;
      }
      selected.push({ id, name });
    } else {
      selected = selected.filter(s => s.id !== id);
    }
    updateCompareSticky();
  }

  function updateCompareSticky() {
    const sticky = document.getElementById('compare-sticky');
    const btn = document.getElementById('compare-btn');
    sticky.hidden = selected.length < 2;
    btn.textContent = `COMPARE SELECTED (${selected.length}/2)`;
  }

  async function showComparePanel() {
    if (selected.length < 2) return;
    const panel = document.getElementById('compare-panel');
    panel.hidden = false;
    panel.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
    try {
      const [a, b] = await Promise.all([
        apiFetch(`/neo/${selected[0].id}`),
        apiFetch(`/neo/${selected[1].id}`),
      ]);
      panel.innerHTML = buildComparePanel(a, b);
      panel.querySelector('#close-compare').addEventListener('click', () => { panel.hidden = true; });
      panel.querySelector('#inspect-left').addEventListener('click', () => loadDetailById(selected[0].id));
      panel.querySelector('#inspect-right').addEventListener('click', () => loadDetailById(selected[1].id));
    } catch (err) {
      showError(panel, err.message, showComparePanel);
    }
  }

  function buildComparePanel(a, b) {
    const rows = [
      ['HAZARDOUS', a.is_potentially_hazardous_asteroid ? 'YES' : 'NO', b.is_potentially_hazardous_asteroid ? 'YES' : 'NO', null],
      ['DIAMETER MIN (m)', parseFloat(a.estimated_diameter?.meters?.estimated_diameter_min || 0).toFixed(1), parseFloat(b.estimated_diameter?.meters?.estimated_diameter_min || 0).toFixed(1), 'higher'],
      ['DIAMETER MAX (m)', parseFloat(a.estimated_diameter?.meters?.estimated_diameter_max || 0).toFixed(1), parseFloat(b.estimated_diameter?.meters?.estimated_diameter_max || 0).toFixed(1), 'higher'],
      ['ORBITAL PERIOD (days)', a.orbital_data?.orbital_period || '—', b.orbital_data?.orbital_period || '—', null],
      ['ECCENTRICITY', a.orbital_data?.eccentricity || '—', b.orbital_data?.eccentricity || '—', null],
      ['INCLINATION', a.orbital_data?.inclination || '—', b.orbital_data?.inclination || '—', null],
      ['OBSERVATIONS', a.orbital_data?.observations_used || '—', b.orbital_data?.observations_used || '—', 'higher'],
    ];

    const rowsHtml = rows.map(([label, va, vb, prefer]) => {
      let aClass = '', bClass = '';
      if (prefer && va !== '—' && vb !== '—') {
        const na = parseFloat(va), nb = parseFloat(vb);
        if (prefer === 'higher') {
          if (na > nb) aClass = 'compare-val-better';
          else if (nb > na) bClass = 'compare-val-better';
          else { aClass = 'compare-val-muted'; bClass = 'compare-val-muted'; }
        }
      }
      if (va === vb) { aClass = 'compare-val-muted'; bClass = 'compare-val-muted'; }
      return `
        <div class="compare-cell compare-row-label">${escHtml(label)}</div>
        <div class="compare-cell ${aClass}">${escHtml(String(va))}</div>
        <div class="compare-cell ${bClass}">${escHtml(String(vb))}</div>
      `;
    }).join('');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span class="mono" style="color:var(--accent);font-size:13px;letter-spacing:2px;">COMPARISON</span>
        <button id="close-compare" style="background:none;border:1px solid var(--muted);color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:5px 12px;cursor:pointer;border-radius:3px;">CLOSE</button>
      </div>
      <div class="compare-grid">
        <div class="compare-cell compare-row-label">FIELD</div>
        <div class="compare-cell" style="color:var(--accent);font-family:var(--font-mono);font-size:11px;">${escHtml(a.name)}</div>
        <div class="compare-cell" style="color:var(--accent);font-family:var(--font-mono);font-size:11px;">${escHtml(b.name)}</div>
        ${rowsHtml}
      </div>
      <div style="display:flex;gap:12px;margin-top:16px;">
        <button id="inspect-left" class="inspect-btn" style="flex:1;">INSPECT ${escHtml(a.name)} →</button>
        <button id="inspect-right" class="inspect-btn" style="flex:1;">INSPECT ${escHtml(b.name)} →</button>
      </div>
    `;
  }
})();
