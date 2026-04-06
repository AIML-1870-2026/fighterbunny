/* =========================================================
   Drug Safety Explorer — App Logic
   ========================================================= */

// ---- CONFIG ----
const OPENFDA_BASE = 'https://api.fda.gov';
const CACHE_TTL    = 24 * 60 * 60 * 1000; // 24h
const MAX_CACHE    = 10;
const MAX_HISTORY  = 20;
const DEBOUNCE_MS  = 300;

// ---- STATE ----
const state = {
  currentDrug: null,
  comparedDrugs: [null, null, null, null],
  rawEffectsVisible: false,
};

// ---- LOCALSTORAGE HELPERS ----
function getHistory() {
  try { return JSON.parse(localStorage.getItem('dse_search_history') || '[]'); }
  catch { return []; }
}

function saveHistory(arr) {
  localStorage.setItem('dse_search_history', JSON.stringify(arr.slice(0, MAX_HISTORY)));
}

function addToHistory(drug) {
  let h = getHistory().filter(d => d.toLowerCase() !== drug.toLowerCase());
  h.unshift(drug);
  saveHistory(h);
}

function removeFromHistory(drug) {
  saveHistory(getHistory().filter(d => d !== drug));
  renderHistoryChips();
}

function getCachedDrugs() {
  try { return JSON.parse(localStorage.getItem('dse_cached_drugs') || '{}'); }
  catch { return {}; }
}

function cacheDrug(name, data) {
  let cache = getCachedDrugs();
  const keys = Object.keys(cache);
  if (keys.length >= MAX_CACHE) {
    // evict oldest
    const oldest = keys.sort((a,b) => cache[a].cached_at - cache[b].cached_at)[0];
    delete cache[oldest];
  }
  cache[name.toLowerCase()] = { ...data, cached_at: Date.now() };
  localStorage.setItem('dse_cached_drugs', JSON.stringify(cache));
}

function getCachedDrug(name) {
  const cache = getCachedDrugs();
  const entry = cache[name.toLowerCase()];
  if (!entry) return null;
  if (Date.now() - entry.cached_at > CACHE_TTL) return null;
  return entry;
}

// ---- OPENFDA API ----
async function fdaFetch(endpoint, params) {
  const url = new URL(OPENFDA_BASE + endpoint);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error('network_error');
  return res.json();
}

async function searchDrugs(query) {
  const sanitized = encodeURIComponent(query);
  const [brandRes, genericRes] = await Promise.allSettled([
    fdaFetch('/drug/label.json', { search: `openfda.brand_name:"${sanitized}"`, limit: 5 }),
    fdaFetch('/drug/label.json', { search: `openfda.generic_name:"${sanitized}"`, limit: 5 }),
  ]);

  const results = [];
  const seen = new Set();

  const addResult = (item, type) => {
    const brand   = item?.openfda?.brand_name?.[0]   || '';
    const generic = item?.openfda?.generic_name?.[0] || '';
    const key = (brand + generic).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push({ brand, generic, type, raw: item });
  };

  if (brandRes.status === 'fulfilled' && brandRes.value?.results) {
    brandRes.value.results.forEach(r => addResult(r, 'brand'));
  }
  if (genericRes.status === 'fulfilled' && genericRes.value?.results) {
    genericRes.value.results.forEach(r => addResult(r, 'generic'));
  }

  return results.slice(0, 10);
}

async function fetchDrugLabel(drugName) {
  const sanitized = encodeURIComponent(drugName);
  const res = await fdaFetch('/drug/label.json', {
    search: `(openfda.brand_name:"${sanitized}"+openfda.generic_name:"${sanitized}")`,
    limit: 1,
  });
  if (res?.results?.[0]) return res.results[0];
  // fallback: try broader search
  const fallback = await fdaFetch('/drug/label.json', {
    search: `openfda.brand_name:${sanitized}`,
    limit: 1,
  });
  return fallback?.results?.[0] || null;
}

async function fetchAdverseEvents(drugName) {
  const sanitized = encodeURIComponent(drugName);
  return fdaFetch('/drug/event.json', {
    search: `patient.drug.medicinalproduct:"${sanitized}"`,
    count: 'patient.reaction.reactionmeddrapt.exact',
    limit: 20,
  });
}

async function fetchRecalls(drugName) {
  const sanitized = encodeURIComponent(drugName);
  return fdaFetch('/drug/enforcement.json', {
    search: `product_description:${sanitized}`,
    sort: 'report_date:desc',
    limit: 10,
  });
}

// ---- SEVERITY SCORING ----
function computeSeverity(eventsData) {
  if (!eventsData?.results) return 'unknown';
  const total = eventsData.results.reduce((s, r) => s + (r.count || 0), 0);
  if (total > 50000) return 'high';
  if (total > 5000)  return 'mid';
  return 'low';
}

const SEVERITY_CONFIG = {
  low:     { icon: '🟢', label: 'Low',      cssClass: 'low',  pulseClass: 'pulse-low',  desc: 'This drug has a relatively low number of reported side effects.' },
  mid:     { icon: '🟡', label: 'Moderate', cssClass: 'mid',  pulseClass: 'pulse-mid',  desc: 'This drug has a moderate number of reported side effects compared to similar medications.' },
  high:    { icon: '🔴', label: 'High',     cssClass: 'high', pulseClass: 'pulse-high', desc: 'This drug has a higher number of reported side effects. Review all warnings carefully.' },
  unknown: { icon: '⚪', label: 'Unknown',  cssClass: 'low',  pulseClass: 'pulse-low',  desc: 'Severity data is not available for this drug.' },
};

// ---- INTERACTION DETECTION ----
const AVOID_KEYWORDS    = ['contraindicated', 'do not use', 'must not be used'];
const CAUTION_KEYWORDS  = ['avoid', 'avoid concomitant', 'should not be used'];
const MONITOR_KEYWORDS  = ['may increase risk', 'use with caution', 'monitor closely', 'monitor patients'];

function detectInteractionTier(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (AVOID_KEYWORDS.some(k => t.includes(k)))   return 'avoid';
  if (CAUTION_KEYWORDS.some(k => t.includes(k))) return 'caution';
  if (MONITOR_KEYWORDS.some(k => t.includes(k))) return 'monitor';
  return null;
}

// ---- DEBOUNCE ----
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ---- TOOLTIP ----
const tooltip = document.getElementById('tooltip');

document.querySelectorAll('[data-tooltip]').forEach(btn => {
  btn.addEventListener('mouseenter', e => {
    tooltip.textContent = btn.dataset.tooltip;
    tooltip.hidden = false;
    positionTooltip(e);
  });
  btn.addEventListener('mousemove', positionTooltip);
  btn.addEventListener('mouseleave', () => { tooltip.hidden = true; });
});

function positionTooltip(e) {
  tooltip.style.left = (e.clientX + 12) + 'px';
  tooltip.style.top  = (e.clientY + 12) + 'px';
}

// ---- TAB NAVIGATION ----
const tabLinks = document.querySelectorAll('.tab-link');
const tabPanels = document.querySelectorAll('.tab-panel');

function activateTab(hash) {
  const target = hash.split('?')[0];
  tabLinks.forEach(link => {
    const active = link.getAttribute('href').startsWith(target);
    link.classList.toggle('active', active);
    link.setAttribute('aria-selected', active);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle('active', '#' + panel.id === target);
  });
}

tabLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const href = link.getAttribute('href');
    history.pushState(null, '', href);
    activateTab(href);
  });
});

window.addEventListener('popstate', () => {
  activateTab(location.hash || '#facts');
});

// ---- URL PARAMS ----
function parseUrlParams() {
  const hash = location.hash || '#facts';
  const [panel, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  return { panel, drug: params.get('drug'), drugs: params.get('drugs') };
}

// ---- SEARCH HISTORY RENDERING ----
function renderHistoryChips() {
  const history = getHistory();
  const panel = document.getElementById('search-history-panel');
  const container = document.getElementById('history-chips');

  if (!history.length) { panel.hidden = true; return; }

  panel.hidden = false;
  container.innerHTML = history.map(d =>
    `<span class="history-chip" data-drug="${escapeHtml(d)}">
      ${escapeHtml(d)}
      <button class="remove-chip" data-drug="${escapeHtml(d)}" aria-label="Remove ${escapeHtml(d)} from history">✕</button>
    </span>`
  ).join('');

  container.querySelectorAll('.history-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.classList.contains('remove-chip')) {
        removeFromHistory(e.target.dataset.drug);
      } else {
        loadDrug(chip.dataset.drug);
        document.getElementById('global-search').value = chip.dataset.drug;
        document.getElementById('search-history-panel').hidden = true;
      }
    });
  });
}

document.getElementById('clear-history-btn').addEventListener('click', () => {
  saveHistory([]);
  renderHistoryChips();
});

// ---- GLOBAL SEARCH ----
const globalSearch = document.getElementById('global-search');
const suggestions  = document.getElementById('search-suggestions');

const debouncedSearch = debounce(async query => {
  if (query.length < 2) { suggestions.hidden = true; return; }
  try {
    const results = await searchDrugs(query);
    renderSuggestions(results, suggestions, name => {
      globalSearch.value = name;
      suggestions.hidden = true;
      document.getElementById('search-history-panel').hidden = true;
      loadDrug(name);
    });
  } catch { suggestions.hidden = true; }
}, DEBOUNCE_MS);

globalSearch.addEventListener('input', () => {
  debouncedSearch(globalSearch.value.trim());
});

globalSearch.addEventListener('focus', () => {
  if (!globalSearch.value.trim()) {
    renderHistoryChips();
    const panel = document.getElementById('search-history-panel');
    const history = getHistory();
    if (history.length) panel.hidden = false;
  }
});

globalSearch.addEventListener('blur', () => {
  setTimeout(() => {
    suggestions.hidden = true;
    document.getElementById('search-history-panel').hidden = true;
  }, 200);
});

globalSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = globalSearch.value.trim();
    if (val) { loadDrug(val); suggestions.hidden = true; }
  }
});

document.querySelector('.search-btn').addEventListener('click', () => {
  const val = globalSearch.value.trim();
  if (val) loadDrug(val);
});

function renderSuggestions(results, container, onSelect) {
  if (!results.length) { container.hidden = true; return; }
  container.innerHTML = results.map(r => {
    const display = r.brand || r.generic;
    const sub     = r.brand && r.generic ? r.generic : '';
    return `<li role="option" data-name="${escapeHtml(display)}">
      ${escapeHtml(display)}
      ${sub ? `<span class="drug-type-tag">${escapeHtml(sub)}</span>` : ''}
    </li>`;
  }).join('');
  container.hidden = false;
  container.querySelectorAll('li').forEach(li => {
    li.addEventListener('mousedown', () => onSelect(li.dataset.name));
  });
}

// ---- LOAD DRUG (main entry point) ----
async function loadDrug(name) {
  if (!name) return;
  addToHistory(name);

  // Switch to facts tab
  activateTab('#facts');
  history.pushState(null, '', `#facts?drug=${encodeURIComponent(name)}`);

  const drugCard   = document.getElementById('drug-card');
  const factsEmpty = document.getElementById('facts-empty');
  factsEmpty.hidden = true;
  drugCard.hidden   = false;

  // Check cache first
  const cached = getCachedDrug(name);

  let labelData, eventsData, recallsData;

  if (cached) {
    labelData  = cached.label;
    eventsData = cached.events;
    recallsData = cached.recalls;
    renderDrugCard(name, labelData, eventsData, recallsData);
    return;
  }

  // Show loading state in header
  document.getElementById('dc-brand-name').textContent = name;
  document.getElementById('dc-generic-name').textContent = 'Loading…';
  resetCardToLoading();

  try {
    [labelData, eventsData, recallsData] = await Promise.all([
      fetchDrugLabel(name),
      fetchAdverseEvents(name).catch(() => null),
      fetchRecalls(name).catch(() => null),
    ]);

    if (!labelData) {
      showDrugNotFound(name);
      return;
    }

    renderDrugCard(name, labelData, eventsData, recallsData);

    // Cache after render
    cacheDrug(name, { label: labelData, events: eventsData, recalls: recallsData });

  } catch (err) {
    if (err.message === 'rate_limited') {
      showError('Too many requests — please wait a moment.', true);
    } else {
      showError('Unable to load drug data. Check your connection and try again.');
    }
  }
}

function resetCardToLoading() {
  document.getElementById('dc-recall-badge').hidden = true;
  document.getElementById('dc-drug-class').textContent = '';
  document.getElementById('severity-badge').className = 'severity-badge';
  document.getElementById('severity-icon').textContent = '';
  document.getElementById('severity-label').textContent = '';
  document.getElementById('severity-description').textContent = '';
  document.getElementById('side-effects-content').innerHTML = '<div class="loading-inline">Loading…</div>';
  document.getElementById('dosage-content').innerHTML = '<div class="loading-inline">Loading…</div>';
  document.getElementById('populations-content').innerHTML = '<div class="loading-inline">Loading…</div>';
  document.getElementById('recalls-content').innerHTML = '<div class="loading-inline">Loading…</div>';
}

function showDrugNotFound(name) {
  document.getElementById('dc-brand-name').textContent = name;
  document.getElementById('dc-generic-name').textContent = "We couldn't find this drug in the FDA database. Try the generic name, or check the spelling.";
}

function showError(msg, autoRetry = false) {
  document.getElementById('dc-generic-name').textContent = msg;
  if (autoRetry) {
    setTimeout(() => {
      const val = globalSearch.value.trim();
      if (val) loadDrug(val);
    }, 5000);
  }
}

// ---- RENDER DRUG CARD ----
function renderDrugCard(name, label, events, recalls) {
  const openfda = label?.openfda || {};
  const brand   = openfda.brand_name?.[0]   || name;
  const generic = openfda.generic_name?.[0] || '';
  const drugClass = openfda.pharm_class_epc?.[0] || openfda.pharm_class_moa?.[0] || '';

  // Header
  document.getElementById('dc-brand-name').textContent    = brand;
  document.getElementById('dc-generic-name').textContent  = generic ? `Generic: ${generic}` : '';
  document.getElementById('dc-drug-class').textContent    = drugClass;
  document.getElementById('dc-drug-class').hidden         = !drugClass;

  // Recall badge
  const recentRecall = checkRecentRecall(recalls);
  document.getElementById('dc-recall-badge').hidden = !recentRecall;

  // Severity
  const severity = computeSeverity(events);
  const sc = SEVERITY_CONFIG[severity];
  const badge = document.getElementById('severity-badge');
  badge.className = `severity-badge ${sc.cssClass}`;
  document.getElementById('severity-icon').textContent = sc.icon;
  document.getElementById('severity-label').textContent = sc.label;
  document.getElementById('severity-description').textContent = sc.desc;
  const pulse = document.getElementById('severity-pulse');
  pulse.className = `pulse-ring ${sc.pulseClass}`;

  // Side Effects
  renderSideEffects(events);

  // Dosage
  renderDosage(label);

  // Special Populations
  renderPopulations(label);

  // Recalls
  renderRecalls(recalls);

  // Share button
  document.getElementById('share-drug-btn').onclick = () => {
    const url = location.origin + location.pathname + `#facts?drug=${encodeURIComponent(name)}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!'));
  };

  state.currentDrug = { name, label, events, recalls };
}

function checkRecentRecall(recalls) {
  if (!recalls?.results?.length) return false;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return recalls.results.some(r => {
    const d = parseRecallDate(r.report_date);
    return d && d > oneYearAgo;
  });
}

function parseRecallDate(str) {
  if (!str) return null;
  const s = String(str);
  if (s.length === 8) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
  }
  return new Date(str);
}

// ---- SIDE EFFECTS ----
function renderSideEffects(events) {
  const container = document.getElementById('side-effects-content');
  if (!events?.results?.length) {
    container.innerHTML = '<p style="color:var(--gray-500);font-size:.88rem;">No adverse event reports found. This may mean the drug is newer or less commonly reported.</p>';
    return;
  }
  const top10 = events.results.slice(0, 10);
  container.innerHTML = top10.map(e => {
    const term = e.term || '';
    const plain = toPlainTerm(term);
    return `<span class="effect-pill" data-raw="${escapeHtml(term)}" data-plain="${escapeHtml(plain)}">
      ${escapeHtml(plain)}
      <span class="effect-count">${formatCount(e.count)}</span>
    </span>`;
  }).join('');
  state.rawEffectsVisible = false;

  document.getElementById('toggle-raw-effects').addEventListener('click', toggleRawEffects);
}

function toggleRawEffects() {
  state.rawEffectsVisible = !state.rawEffectsVisible;
  document.querySelectorAll('.effect-pill').forEach(pill => {
    if (state.rawEffectsVisible) {
      pill.childNodes[0].textContent = pill.dataset.raw + ' ';
    } else {
      pill.childNodes[0].textContent = pill.dataset.plain + ' ';
    }
  });
  document.getElementById('toggle-raw-effects').textContent =
    state.rawEffectsVisible ? 'Show plain English terms' : 'Show raw FDA terms';
}

function toPlainTerm(term) {
  // Normalize common FDA MedDRA terms to readable labels
  return term
    .replace(/ NOS$/i, '')
    .replace(/ NEC$/i, '')
    .replace(/\bNOS\b/gi, '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatCount(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'k';
  return String(n);
}

// ---- DOSAGE ----
function renderDosage(label) {
  const container = document.getElementById('dosage-content');
  const sections = [
    { key: 'indications_and_usage',     title: 'Indications & Usage' },
    { key: 'dosage_and_administration', title: 'Dosage & Administration' },
    { key: 'warnings_and_cautions',     title: 'Warnings & Precautions' },
    { key: 'warnings',                  title: 'Warnings' },
  ];

  let html = '';
  const available = sections.filter(s => label?.[s.key]?.[0]);

  if (!available.length) {
    container.innerHTML = '<p style="color:var(--gray-500);font-size:.88rem;">Label information not available for this drug.</p>';
    return;
  }

  available.forEach(s => {
    const rawText = label[s.key][0];
    const truncated = rawText.length > 800 ? rawText.slice(0, 800) + '…' : rawText;
    html += `<div class="dosage-section">
      <div class="dosage-section-title">${escapeHtml(s.title)}</div>
      <pre class="dosage-raw visible" id="raw-${s.key}">${escapeHtml(truncated)}</pre>
    </div>`;
  });

  container.innerHTML = html;
}

// ---- SPECIAL POPULATIONS ----
function renderPopulations(label) {
  const container = document.getElementById('populations-content');
  const pops = [
    { key: 'pregnancy',          icon: '🤰', title: 'Pregnancy' },
    { key: 'pediatric_use',      icon: '👶', title: 'Children' },
    { key: 'geriatric_use',      icon: '👴', title: 'Older Adults' },
    { key: 'nursing_mothers',    icon: '🤱', title: 'Breastfeeding' },
  ];

  const available = pops.filter(p => label?.[p.key]?.[0]);

  if (!available.length) {
    container.innerHTML = '<p style="color:var(--gray-500);font-size:.88rem;">Special population data not available for this drug.</p>';
    return;
  }

  container.innerHTML = `<div class="population-callouts">
    ${available.map(p => {
      const text = label[p.key][0].slice(0, 400);
      return `<div class="population-callout">
        <div class="population-callout-title">${p.icon} ${escapeHtml(p.title)}</div>
        <p>${escapeHtml(text)}${label[p.key][0].length > 400 ? '…' : ''}</p>
      </div>`;
    }).join('')}
  </div>`;
}

// ---- RECALL HISTORY ----
function renderRecalls(recalls) {
  const container = document.getElementById('recalls-content');
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  const recentRecalls = recalls?.results?.filter(r => {
    const d = parseRecallDate(r.report_date);
    return d && d > threeYearsAgo;
  }) || [];

  if (!recentRecalls.length) {
    container.innerHTML = `<div class="no-recalls">✅ No recalls found for this drug in the past 3 years.</div>`;
    return;
  }

  container.innerHTML = `<div class="recall-list">
    ${recentRecalls.slice(0, 5).map(r => {
      const dateStr = formatRecallDate(r.report_date);
      const cls = (r.classification || '').toLowerCase().includes('class i') ? 'class-i'
                : (r.classification || '').toLowerCase().includes('class ii') ? 'class-ii' : 'class-iii';
      const classLabel = r.classification || 'Unknown Class';
      const reason = (r.reason_for_recall || 'Reason not specified').slice(0, 300);
      return `<div class="recall-item">
        <div class="recall-item-header">
          <span class="recall-date">${escapeHtml(dateStr)}</span>
          <span class="recall-class-badge ${cls}">${escapeHtml(classLabel)}</span>
        </div>
        <p class="recall-reason" id="recall-reason-${escapeHtml(r.recall_number || dateStr)}">${escapeHtml(reason)}</p>
        <p class="recall-status">Status: ${escapeHtml(r.status || 'Unknown')}</p>
      </div>`;
    }).join('')}
  </div>`;
}

function formatRecallDate(str) {
  if (!str) return 'Unknown date';
  const s = String(str);
  if (s.length === 8) {
    return `${s.slice(4,6)}/${s.slice(6,8)}/${s.slice(0,4)}`;
  }
  return str;
}

// ---- CLAUDE SUMMARY (Drug Facts) ----
async function generateAndRenderSummary(name, label, force = false) {
  const el = document.getElementById('claude-summary-content');
  const cached = getCachedDrug(name);
  if (!force && cached?.claude_summary) {
    el.textContent = cached.claude_summary;
    return;
  }

  el.innerHTML = shimmerHTML();

  const indications = label?.indications_and_usage?.[0]?.slice(0, 600) || '';
  const warnings    = label?.warnings?.[0]?.slice(0, 400)              || '';
  const brand       = label?.openfda?.brand_name?.[0]   || name;
  const generic     = label?.openfda?.generic_name?.[0] || '';

  const prompt = `Write a 3-5 sentence plain-English summary for the drug "${brand}"${generic ? ` (${generic})` : ''}.
Include: what it is, what it treats, and its most important safety consideration.
Use only the following FDA data:\n\nIndications: ${indications}\n\nWarnings: ${warnings}`;

  const summary = await callClaude(prompt);
  if (el) {
    el.textContent = summary || `${brand}${generic ? ` (${generic})` : ''} — Plain-English summary unavailable. See the FDA label sections below for full details.`;
    if (!summary) el.insertAdjacentHTML('afterend', '<small style="color:var(--gray-500);display:block;margin-top:4px;">Plain-English summary unavailable. Showing raw FDA data.</small>');

    // Update cache
    if (summary) {
      const current = getCachedDrug(name) || {};
      cacheDrug(name, { ...current, claude_summary: summary });
    }
  }
}

// ---- PILL IDENTIFIER ----
document.getElementById('pill-search-btn').addEventListener('click', async () => {
  const color   = document.getElementById('pill-color').value.trim();
  const shape   = document.getElementById('pill-shape').value.trim();
  const imprint = document.getElementById('pill-imprint').value.trim();
  const drug    = state.currentDrug?.name || '';
  const results = document.getElementById('pill-results');

  if (!color && !shape && !imprint) {
    results.innerHTML = '<p style="color:var(--gray-500);font-size:.85rem;">Enter at least one field to search.</p>';
    return;
  }

  results.innerHTML = '<p style="color:var(--gray-500);font-size:.85rem;">Searching…</p>';

  let searchQuery = `openfda.brand_name:${encodeURIComponent(drug || '*')}`;
  if (color) searchQuery += `+AND+color:${encodeURIComponent(color)}`;
  if (shape) searchQuery += `+AND+shape:${encodeURIComponent(shape)}`;

  try {
    const res = await fdaFetch('/drug/label.json', { search: searchQuery, limit: 10 });
    if (!res?.results?.length) {
      results.innerHTML = '<p style="color:var(--gray-500);font-size:.85rem;">No matching pills found. Try adjusting your search.</p>';
      return;
    }
    results.innerHTML = res.results.map(r => {
      const name  = r.openfda?.brand_name?.[0]   || r.openfda?.generic_name?.[0] || 'Unknown';
      const strength = r.openfda?.strength?.[0] || '';
      const mfr   = r.openfda?.manufacturer_name?.[0] || '';
      return `<div class="pill-card">
        <div class="pill-card-name">${escapeHtml(name)}</div>
        ${strength ? `<div class="pill-card-detail">Strength: ${escapeHtml(strength)}</div>` : ''}
        ${mfr ? `<div class="pill-card-detail">Mfr: ${escapeHtml(mfr)}</div>` : ''}
      </div>`;
    }).join('');
  } catch {
    results.innerHTML = '<p style="color:var(--gray-500);font-size:.85rem;">Search failed. Please try again.</p>';
  }
});

// ---- COMPARE TAB ----
const slots = Array.from(document.querySelectorAll('.compare-slot'));

slots.forEach((slot, index) => {
  const input  = slot.querySelector('.slot-search');
  const suggs  = slot.querySelector('.slot-suggestions');
  const selectedEl = slot.querySelector('.slot-selected');

  const debouncedSlotSearch = debounce(async query => {
    if (query.length < 2) { suggs.hidden = true; return; }
    try {
      const results = await searchDrugs(query);
      renderSuggestions(results, suggs, name => {
        input.value = '';
        suggs.hidden = true;
        selectDrugInSlot(index, name, slot, input, selectedEl);
      });
    } catch { suggs.hidden = true; }
  }, DEBOUNCE_MS);

  input.addEventListener('input', () => debouncedSlotSearch(input.value.trim()));
  input.addEventListener('blur', () => setTimeout(() => { suggs.hidden = true; }, 200));
});

function selectDrugInSlot(index, name, _slot, input, selectedEl) {
  state.comparedDrugs[index] = name;
  selectedEl.innerHTML = `${escapeHtml(name)} <button class="slot-clear-btn" aria-label="Remove ${escapeHtml(name)}">✕</button>`;
  selectedEl.hidden = false;
  input.style.display = 'none';
  selectedEl.querySelector('.slot-clear-btn').addEventListener('click', () => {
    state.comparedDrugs[index] = null;
    selectedEl.hidden = true;
    input.style.display = '';
    input.value = '';
    updateCompareButton();
  });
  updateCompareButton();
}

function updateCompareButton() {
  const filled = state.comparedDrugs.filter(Boolean).length;
  const btn = document.getElementById('compare-btn');
  btn.disabled = filled < 2;
  const label = document.getElementById('compare-count-label');
  label.textContent = filled >= 2 ? `(${filled} drugs)` : '(need at least 2)';
}

document.getElementById('compare-btn').addEventListener('click', runComparison);

async function runComparison() {
  const drugNames = state.comparedDrugs.filter(Boolean);
  if (drugNames.length < 2) return;

  const resultsEl = document.getElementById('comparison-results');
  const tableEl   = document.getElementById('comparison-table');
  resultsEl.hidden = false;
  tableEl.innerHTML = '<div class="loading-inline" style="padding:24px;">Loading comparison data…</div>';
  document.getElementById('interaction-check-banner').hidden = true;
  document.getElementById('share-compare-btn').hidden = false;

  try {
    const drugData = await Promise.all(drugNames.map(async name => {
      const cached = getCachedDrug(name);
      if (cached) return { name, ...cached };
      const [label, events, recalls] = await Promise.all([
        fetchDrugLabel(name),
        fetchAdverseEvents(name).catch(() => null),
        fetchRecalls(name).catch(() => null),
      ]);
      if (label) cacheDrug(name, { label, events, recalls });
      return { name, label, events, recalls };
    }));

    renderComparisonTable(drugData);

    // Interaction check
    checkInteractions(drugData);

    // Share button
    document.getElementById('share-compare-btn').onclick = () => {
      const url = location.origin + location.pathname + `#compare?drugs=${drugNames.map(encodeURIComponent).join(',')}`;
      navigator.clipboard.writeText(url).then(() => alert('Comparison link copied!'));
    };

  } catch (err) {
    tableEl.innerHTML = '<p style="color:var(--red);padding:24px;">Failed to load comparison data. Please try again.</p>';
  }
}

async function renderComparisonTable(drugData) {
  const tableEl = document.getElementById('comparison-table');

  // Collect shared side effects
  const effectSets = drugData.map(d => {
    if (!d.events?.results) return new Set();
    return new Set(d.events.results.slice(0, 20).map(e => toPlainTerm(e.term)));
  });

  const sharedEffects = effectSets.length > 1
    ? [...effectSets[0]].filter(e => effectSets.slice(1).every(s => s.has(e)))
    : [];

  const n = drugData.length;
  const gridStyle = `grid-template-columns: repeat(${n}, 1fr)`;

  let html = '';

  // --- Overview ---
  html += `<div class="comparison-section">
    <div class="comparison-section-header">Overview</div>
    <div class="comparison-grid" style="${gridStyle}">
      ${drugData.map(d => {
        const uses = d.label?.indications_and_usage?.[0]?.slice(0, 300) || 'No overview available.';
        return `<div class="comparison-col">
          <div class="comparison-col-header">${escapeHtml(d.name)}</div>
          <p>${escapeHtml(uses)}${d.label?.indications_and_usage?.[0]?.length > 300 ? '…' : ''}</p>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // --- Shared Side Effects ---
  html += `<div class="comparison-section">
    <div class="comparison-section-header">Shared Side Effects</div>
    <div style="padding:16px 20px;">
      ${sharedEffects.length
        ? sharedEffects.map(e => `<span class="effect-pill shared" title="Both drugs may cause this — overlapping effects can be stronger together">${escapeHtml(e)}</span>`).join('')
        : '<p style="color:var(--green);font-weight:600;">No shared side effects detected among these drugs.</p>'
      }
    </div>
  </div>`;

  // --- Severity ---
  html += `<div class="comparison-section">
    <div class="comparison-section-header">Severity Scores</div>
    <div class="comparison-grid" style="${gridStyle}">
      ${drugData.map(d => {
        const sev = computeSeverity(d.events);
        const sc = SEVERITY_CONFIG[sev];
        return `<div class="comparison-col">
          <div class="comparison-col-header">${escapeHtml(d.name)}</div>
          <span style="font-size:1.5rem;">${sc.icon}</span>
          <strong>${sc.label}</strong>
          <p style="font-size:.8rem;color:var(--gray-500);">${sc.desc}</p>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // --- Special Populations ---
  html += `<div class="comparison-section">
    <div class="comparison-section-header">Special Population Warnings</div>
    <div class="comparison-grid" style="${gridStyle}">
      ${drugData.map(d => {
        const pops = ['pregnancy','pediatric_use','geriatric_use','nursing_mothers'];
        const flags = pops.filter(p => d.label?.[p]?.[0]);
        return `<div class="comparison-col">
          <div class="comparison-col-header">${escapeHtml(d.name)}</div>
          ${flags.length ? flags.map(p => `<span class="effect-pill">${escapeHtml(p.replace(/_/g,' '))}</span>`).join('') : '<p style="color:var(--gray-500);">No data</p>'}
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // --- Recall Status ---
  html += `<div class="comparison-section">
    <div class="comparison-section-header">Recall Status</div>
    <div class="comparison-grid" style="${gridStyle}">
      ${drugData.map(d => {
        const recent = checkRecentRecall(d.recalls);
        return `<div class="comparison-col">
          <div class="comparison-col-header">${escapeHtml(d.name)}</div>
          ${recent
            ? '<span class="recall-badge" style="display:inline-flex;">⚠️ Recently Recalled</span>'
            : '<span style="color:var(--green);font-weight:600;">✅ No recent recalls</span>'
          }
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // --- Dosage Summary ---
  html += `<div class="comparison-section">
    <div class="comparison-section-header">Dosage Summary</div>
    <div class="comparison-grid" style="${gridStyle}">
      ${drugData.map(d => {
        const dosage = d.label?.dosage_and_administration?.[0]?.slice(0, 200) || 'Not available.';
        return `<div class="comparison-col">
          <div class="comparison-col-header">${escapeHtml(d.name)}</div>
          <p>${escapeHtml(dosage)}${d.label?.dosage_and_administration?.[0]?.length > 200 ? '…' : ''}</p>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  tableEl.innerHTML = html;
}

async function checkInteractions(drugData) {
  const bannerEl = document.getElementById('interaction-check-banner');
  let hasInteraction = false;
  let interactionDetails = [];

  // Check each drug's label warnings for keywords referencing other drug names
  drugData.forEach((drugA, i) => {
    drugData.slice(i + 1).forEach(drugB => {
      const contraText = [
        drugA.label?.drug_interactions?.[0] || '',
        drugA.label?.contraindications?.[0] || '',
        drugB.label?.drug_interactions?.[0] || '',
        drugB.label?.contraindications?.[0] || '',
      ].join(' ');

      const tier = detectInteractionTier(contraText);
      if (tier) {
        hasInteraction = true;
        interactionDetails.push({ drugA: drugA.name, drugB: drugB.name, tier, text: contraText.slice(0, 500) });
      }
    });
  });

  if (!hasInteraction) {
    bannerEl.className = 'interaction-check-banner safe';
    bannerEl.innerHTML = '✅ No known dangerous interactions found between these drugs. Always confirm with your pharmacist.';
    bannerEl.hidden = false;
    return;
  }

  const details = interactionDetails[0];
  bannerEl.className = 'interaction-check-banner danger';
  bannerEl.innerHTML = `⚠️ Potential interaction detected between ${escapeHtml(details.drugA)} and ${escapeHtml(details.drugB)}. ${getTierLabel(details.tier)}.`;
  bannerEl.hidden = false;
}

function getTierLabel(tier) {
  return { avoid: '🚫 Avoid — Do not use together', caution: '⚠️ Use with Caution', monitor: '👁 Monitor Closely' }[tier] || tier;
}

// ---- URL-BASED AUTO-LOAD ----
function initFromUrl() {
  const { panel, drug, drugs } = parseUrlParams();
  activateTab(panel || '#facts');

  if (drug) {
    globalSearch.value = decodeURIComponent(drug);
    loadDrug(decodeURIComponent(drug));
  }

  if (drugs && panel === '#compare') {
    const names = drugs.split(',').map(decodeURIComponent).slice(0, 4);
    names.forEach((name, i) => {
      if (i < slots.length && name) {
        const slot     = slots[i];
        const input    = slot.querySelector('.slot-search');
        const selEl    = slot.querySelector('.slot-selected');
        selectDrugInSlot(i, name, slot, input, selEl);
      }
    });
    if (names.filter(Boolean).length >= 2) runComparison();
  }
}

// ---- ESCAPE HTML ----
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- INIT ----
renderHistoryChips();
initFromUrl();
