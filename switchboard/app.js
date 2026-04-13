'use strict';

/* =============================================================
   CONSTANTS
   ============================================================= */

const FALLBACK_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4-5-20251001'
];

const SCHEMA_TEMPLATES = {
  science_concept: {
    schema: { concept:'string', one_line_summary:'string', key_principles:['string'], real_world_applications:['string'], common_misconceptions:['string'], difficulty_level:'beginner | intermediate | advanced', related_concepts:['string'] },
    examplePrompt: 'Break down the concept of entropy in thermodynamics.'
  },
  track_analysis: {
    schema: { title:'string', artist:'string', genre:'string', key:'string', tempo_bpm:'number', time_signature:'string', mood:'string', chord_progression:'string', notable_techniques:['string'], influences:['string'] },
    examplePrompt: "Analyze 'Clair de Lune' by Claude Debussy using this schema."
  },
  game_design_mini: {
    schema: { title:'string', genre:'string', core_loop:'string', player_goal:'string', mechanics:['string'], progression_system:'string', target_audience:'string', unique_selling_point:'string', estimated_scope:'jam | indie | AA | AAA' },
    examplePrompt: 'Design a minimal roguelike game about a jazz musician traveling through time.'
  },
  math_solution: {
    schema: { problem_statement:'string', problem_type:'string', difficulty:'easy | medium | hard', steps:[{step_number:'number', description:'string', expression:'string'}], final_answer:'string', key_concepts_used:['string'] },
    examplePrompt: 'Solve: A ball is thrown upward at 20 m/s from a height of 5 m. When does it hit the ground?'
  },
  npc_sheet: {
    schema: { name:'string', race:'string', class_or_role:'string', backstory:'string', personality_traits:['string'], motivations:['string'], flaws:['string'], signature_ability:'string', dialogue_style:'string' },
    examplePrompt: 'Create an NPC who is a retired speedrunner turned dungeon guide in a fantasy MMO world.'
  }
};

const EXAMPLE_PROMPTS = {
  science: [
    { label:'Fourier Transforms for Musicians', text:"Explain the intuition behind Fourier transforms as if I'm a musician who understands waveforms but has never taken a math class." },
    { label:'Infinitely Many Primes', text:'Walk me through a proof that there are infinitely many prime numbers. Use plain language for each logical step, then show the formal version at the end.' },
    { label:'Guitar String Physics', text:'A guitar string vibrates at 440 Hz for an A4 note. What is the physics behind why pressing a fret changes the pitch, and how does string tension affect harmonics?' },
    { label:'Dice Probability Puzzle', text:'I roll two fair six-sided dice. What is the probability that the sum is a prime number? Show your reasoning.' }
  ],
  music: [
    { label:'Circle of Fifths Deep Dive', text:'Explain the circle of fifths and how I can use it to write chord progressions that feel emotionally satisfying. Give me three example progressions in the key of D minor.' },
    { label:'Jazz vs Blues Analysis', text:"What makes a piece of music feel 'jazz' vs 'blues'? Break down the key harmonic, rhythmic, and structural differences with concrete examples." },
    { label:'Lo-Fi Hip Hop Composition', text:"I'm writing a lo-fi hip hop track at 85 BPM. Suggest a chord progression, a sample type to chop, and a drum pattern feel that would work well together." },
    { label:'Minor Seventh Chord Sound', text:'Describe what a minor seventh chord sounds like in emotional terms, and give me three famous songs where that chord creates a defining moment.' }
  ],
  gaming: [
    { label:'Roguelike Class Designer', text:"I'm designing a roguelike dungeon crawler. Suggest a set of 5 unique character classes with distinct playstyles, a signature ability for each, and how they might synergize in a 4-player co-op mode." },
    { label:'AI God Creation Myth', text:'Write the creation myth for a fantasy world where the gods are ancient video game AIs that achieved consciousness. Keep it under 300 words and make it feel epic.' },
    { label:'Card Game Tempo Explained', text:"Explain the metagame concept of 'tempo' in card games like Magic: The Gathering or Hearthstone. When should I sacrifice card advantage to gain tempo, and when is that a mistake?" },
    { label:'Speedrun Sequence Breaking', text:'Explain why sequence breaking works in many classic games from a technical standpoint. What types of programming assumptions do speedrunners typically exploit?' }
  ]
};

/* =============================================================
   STATE
   ============================================================= */

const state = {
  apiKey: null,
  mode: 'freetext',
  models: [],
  selectedModel: '',
  abortController: null,
  retryCountdown: null,
  promptLibrary: [],
  editingEntryId: null,
  savingType: 'prompt',
  saveTags: [],
  selectMode: false,
  selectedEntries: new Set(),
  activeTags: new Set(),
  activeType: 'all',
  searchQuery: '',
  sortOrder: 'newest',
  searchDebounce: null,
  lastAutoSystemPrompt: ''
};

/* =============================================================
   DOM HELPERS
   ============================================================= */

const $ = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =============================================================
   INIT
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  setupExamplePrompts();
  loadSeedEntries();
  renderLibrary();
  setupEventListeners();
  setupKeyboardShortcuts();
  updateModeUI();
});

/* =============================================================
   API KEY
   ============================================================= */

function handleKeyInput(key) {
  key = (key || '').trim();
  if (!key) return;
  state.apiKey = key;
  hideKeyError();
  $('api-key-input').style.borderColor = 'var(--success)';
  fetchModels(key);
}

function handleKeyFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const match = text.match(/ANTHROPIC_API_KEY\s*=\s*([^\s\n\r]+)/) || text.match(/(sk-ant-[^\s\n\r]+)/);
    const key = match ? match[1].trim() : text.trim();
    if (key) {
      $('api-key-input').value = key;
      handleKeyInput(key);
    } else {
      showKeyError("Couldn't find an API key in that file. Try pasting it directly.");
    }
  };
  reader.readAsText(file);
}

function clearKey() {
  state.apiKey = null;
  state.models = [];
  state.selectedModel = '';
  $('api-key-input').value = '';
  $('api-key-input').style.borderColor = '';
  $('api-key-input').disabled = false;
  hideKeyError();
  resetModelSelect();
}

function showKeyError(msg) {
  const el = $('key-error');
  el.querySelector('span').textContent = msg || "That key doesn't seem to be valid. Double-check for extra spaces or missing characters.";
  el.classList.remove('valid');
  show(el);
  $('api-key-input').style.borderColor = 'var(--danger)';
}

function hideKeyError() {
  hide($('key-error'));
}

function resetModelSelect() {
  const sel = $('model-select');
  sel.innerHTML = '<option value="">— Enter an API key first —</option>';
  sel.disabled = true;
  hide($('model-warning'));
  hide($('model-spinner'));
}

/* =============================================================
   MODEL DISCOVERY
   ============================================================= */

async function fetchModels(key) {
  const spinner = $('model-spinner');
  const sel = $('model-select');
  const warning = $('model-warning');

  show(spinner);
  sel.disabled = true;
  sel.innerHTML = '<option>Discovering models…</option>';
  hide(warning);

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });

    if (res.status === 401) {
      showKeyError();
      resetModelSelect();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const models = (data.data || []).map(m => m.id).sort((a, b) => b.localeCompare(a));
    state.models = models.length ? models : FALLBACK_MODELS;
    if (!models.length) show(warning);
    populateModelSelect(state.models);
  } catch {
    state.models = FALLBACK_MODELS;
    populateModelSelect(FALLBACK_MODELS);
    show(warning);
  } finally {
    hide(spinner);
  }
}

function populateModelSelect(models) {
  const sel = $('model-select');
  sel.innerHTML = '';
  models.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    sel.appendChild(opt);
  });
  sel.disabled = false;
  state.selectedModel = models[0] || '';
}

/* =============================================================
   MODE
   ============================================================= */

function setMode(mode) {
  state.mode = mode;
  updateModeUI();
}

function updateModeUI() {
  const app = document.getElementById('app');
  const isStructured = state.mode === 'structured';

  app.classList.toggle('mode-structured', isStructured);
  app.classList.toggle('mode-freetext', !isStructured);

  const schemaArea = $('schema-area');
  const savePromptBtn = $('save-prompt-btn');
  const savePairBtn = $('save-pair-btn');

  if (isStructured) {
    show(schemaArea);
    hide(savePromptBtn);
    show(savePairBtn);
    $('mode-left')?.classList.remove('active');
    $('mode-right')?.classList.add('active');
  } else {
    hide(schemaArea);
    show(savePromptBtn);
    hide(savePairBtn);
    $('mode-left')?.classList.add('active');
    $('mode-right')?.classList.remove('active');
  }

  // Reset output area on mode change
  $('output-area').innerHTML = '<p class="output-placeholder">Your response will appear here.</p>';
  hide($('copy-btn'));
  hide($('switch-to-free-btn'));
  hide($('json-fallback'));
}

/* =============================================================
   SCHEMA TEMPLATES
   ============================================================= */

function onSchemaSelect(value) {
  if (!value || value === 'custom') return;
  const tpl = SCHEMA_TEMPLATES[value];
  if (!tpl) return;
  $('schema-input').value = JSON.stringify(tpl.schema, null, 2);
  autoFillSystemPrompt();
}

function autoFillSystemPrompt() {
  if (state.mode !== 'structured') return;
  const schema = $('schema-input').value.trim();
  if (!schema) return;
  const instruction = `You are a helpful assistant. Respond ONLY with a valid JSON object that matches this schema exactly. Do not include any explanation, markdown fences, or extra text — only the JSON object:\n\n${schema}`;
  const sysEl = $('system-prompt');
  // Only auto-fill if blank or previously auto-filled
  if (!sysEl.value.trim() || sysEl.value === state.lastAutoSystemPrompt) {
    sysEl.value = instruction;
    state.lastAutoSystemPrompt = instruction;
  }
}

/* =============================================================
   SEND PROMPT
   ============================================================= */

async function sendPrompt() {
  if (!state.apiKey) { showOutputMsg('Enter an API key first.'); return; }
  if (!state.selectedModel) { showOutputMsg('Select a model first.'); return; }

  const userPrompt = $('user-prompt').value.trim();
  if (!userPrompt) { showOutputMsg('Enter a prompt first.'); return; }

  if (state.abortController) state.abortController.abort();
  if (state.retryCountdown) { clearInterval(state.retryCountdown); state.retryCountdown = null; }

  const systemPrompt = buildSystemPrompt();
  const body = {
    model: state.selectedModel,
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }]
  };
  if (systemPrompt) body.system = systemPrompt;

  showProgress(true);
  $('output-area').innerHTML = '<p class="output-placeholder">Generating response…</p>';
  hide($('copy-btn'));
  hide($('switch-to-free-btn'));
  hide($('json-fallback'));
  $('send-btn').disabled = true;

  state.abortController = new AbortController();
  const timeoutId = setTimeout(() => state.abortController?.abort('timeout'), 30000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body),
      signal: state.abortController.signal
    });

    clearTimeout(timeoutId);
    if (!res.ok) { await handleAPIError(res); return; }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

    if (state.mode === 'structured') {
      renderStructuredOutput(text);
    } else {
      renderFreetextOutput(text);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      showTimeoutError();
    } else {
      showNetworkError();
    }
  } finally {
    showProgress(false);
    state.abortController = null;
    $('send-btn').disabled = false;
  }
}

function buildSystemPrompt() {
  if (state.mode === 'structured') {
    const schema = $('schema-input').value.trim();
    if (schema) {
      const manual = $('system-prompt').value.trim();
      if (manual && manual !== state.lastAutoSystemPrompt) return manual;
      return `You are a helpful assistant. Respond ONLY with a valid JSON object that matches this schema exactly. Do not include any explanation, markdown fences, or extra text — only the JSON object:\n\n${schema}`;
    }
  }
  return $('system-prompt').value.trim();
}

/* =============================================================
   OUTPUT
   ============================================================= */

function renderFreetextOutput(text) {
  const area = $('output-area');
  area.textContent = text;
  show($('copy-btn'));
  $('copy-btn').textContent = 'Copy';
  $('copy-btn').onclick = () => copyToClipboard(text, $('copy-btn'), 'Copy');
}

function renderStructuredOutput(rawText) {
  const area = $('output-area');
  hide($('json-fallback'));

  // Strip markdown code fences if present
  let jsonStr = rawText.trim();
  const fence = jsonStr.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) jsonStr = fence[1];

  try {
    const parsed = JSON.parse(jsonStr);
    area.innerHTML = `<code class="json-output">${syntaxHighlightJSON(parsed)}</code>`;
    show($('copy-btn'));
    $('copy-btn').textContent = 'Copy JSON';
    $('copy-btn').onclick = () => {
      const pretty = JSON.stringify(parsed, null, 2);
      copyToClipboard(pretty, $('copy-btn'), 'Copy JSON');
    };
  } catch {
    area.innerHTML = '<p class="output-placeholder">Invalid JSON response — see below.</p>';
    hide($('copy-btn'));
    $('json-fallback-raw').textContent = rawText;
    show($('json-fallback'));
    show($('switch-to-free-btn'));
    $('switch-to-free-btn').onclick = () => {
      $('mode-toggle').checked = false;
      setMode('freetext');
      renderFreetextOutput(rawText);
    };
  }
}

function syntaxHighlightJSON(obj) {
  const str = JSON.stringify(obj, null, 2)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return str.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    match => {
      let cls = 'json-number';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
      else if (/true|false/.test(match)) cls = 'json-boolean';
      else if (match === 'null') cls = 'json-null';
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function copyToClipboard(text, btn, resetLabel) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = resetLabel; }, 1500);
  }).catch(() => showToast('Copy failed — try Ctrl+C'));
}

function showOutputMsg(msg) {
  $('output-area').innerHTML = `<p class="output-placeholder">${escapeHTML(msg)}</p>`;
}

function showProgress(on) {
  if (on) show($('progress-bar')); else hide($('progress-bar'));
}

/* =============================================================
   ERROR HANDLING
   ============================================================= */

async function handleAPIError(res) {
  let body = {};
  try { body = await res.json(); } catch {}

  if (res.status === 401) {
    showKeyError();
    resetModelSelect();
    setErrOutput(`
      <p>Invalid API key. Double-check for extra spaces or missing characters.</p>
      <div class="retry-row">
        <button class="secondary-btn" id="retry-btn">Re-enter Key</button>
      </div>`);
    $('retry-btn')?.addEventListener('click', () => { clearKey(); $('api-key-input').focus(); });

  } else if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '0') || null;
    showRateLimitError(retryAfter);

  } else if (res.status === 403) {
    setErrOutput(`
      <p>Your account may have reached its usage limit or has a billing issue.</p>
      <div class="retry-row">
        <a href="https://console.anthropic.com" target="_blank" rel="noopener" class="secondary-btn" style="text-decoration:none;display:inline-block">Visit Anthropic Console ↗</a>
      </div>`);

  } else {
    const msg = body.error?.message || `HTTP ${res.status}`;
    setErrOutput(`
      <p>API error: ${escapeHTML(msg)}</p>
      <div class="retry-row">
        <button class="secondary-btn" id="retry-btn">Retry</button>
      </div>`);
    $('retry-btn')?.addEventListener('click', sendPrompt);
  }
}

function showTimeoutError() {
  setErrOutput(`
    <p>The request timed out after 30 seconds. The model may be under high load — try again in a moment, or try a shorter prompt.</p>
    <div class="retry-row">
      <button class="secondary-btn" id="retry-btn">Retry</button>
    </div>`);
  $('retry-btn')?.addEventListener('click', sendPrompt);
}

function showNetworkError() {
  document.querySelector('.cors-info-box')?.setAttribute('open', '');
  setErrOutput(`
    <p>Couldn't reach the API. This may be a network issue or a browser security restriction (CORS). See the info box above for details.</p>
    <p style="font-size:0.82rem;color:var(--text-muted);margin-top:0.4rem">If you're running this locally, try using a simple local proxy or the Anthropic CLI.</p>
    <div class="retry-row">
      <button class="secondary-btn" id="retry-btn">Retry</button>
    </div>`);
  $('retry-btn')?.addEventListener('click', sendPrompt);
}

function showRateLimitError(retryAfter) {
  if (state.retryCountdown) clearInterval(state.retryCountdown);

  const render = (secs) => {
    const countdownHtml = secs > 0 ? ` Retrying in <span class="countdown-badge">${secs}s</span>` : '';
    setErrOutput(`
      <p>You've hit the rate limit for this model.${countdownHtml}</p>
      <div class="retry-row">
        <button class="secondary-btn" id="retry-btn">Retry Now</button>
      </div>`);
    $('retry-btn')?.addEventListener('click', () => {
      if (state.retryCountdown) { clearInterval(state.retryCountdown); state.retryCountdown = null; }
      sendPrompt();
    });
  };

  if (retryAfter > 0) {
    let secs = retryAfter;
    render(secs);
    state.retryCountdown = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(state.retryCountdown);
        state.retryCountdown = null;
        sendPrompt();
      } else {
        render(secs);
      }
    }, 1000);
  } else {
    render(0);
  }
}

function setErrOutput(html) {
  $('output-area').innerHTML = `<div class="output-error">${html}</div>`;
}

/* =============================================================
   EXAMPLE PROMPTS
   ============================================================= */

function setupExamplePrompts() {
  renderChips('examples-science', EXAMPLE_PROMPTS.science);
  renderChips('examples-music', EXAMPLE_PROMPTS.music);
  renderChips('examples-gaming', EXAMPLE_PROMPTS.gaming);
}

function renderChips(containerId, prompts) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = '';
  prompts.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'example-chip';
    btn.textContent = p.label;
    btn.title = p.text;
    btn.addEventListener('click', () => {
      $('user-prompt').value = p.text;
      $('user-prompt').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      $('user-prompt').focus();
    });
    container.appendChild(btn);
  });
}

/* =============================================================
   LIBRARY — DATA
   ============================================================= */

function loadSeedEntries() {
  if (state.promptLibrary.length > 0) return;
  const now = new Date().toISOString();
  state.promptLibrary.push(
    {
      id: crypto.randomUUID(), type: 'prompt', title: 'Fourier Transforms for Musicians',
      description: 'Bridges music intuition and math', tags: ['science', 'music', 'explainer'],
      mode: 'freetext', systemPrompt: '',
      userPrompt: "Explain the intuition behind Fourier transforms as if I'm a musician who understands waveforms but has never taken a math class.",
      savedAt: now, lastUsedAt: null, seeded: true
    },
    {
      id: crypto.randomUUID(), type: 'schema', title: 'Track Analysis Schema',
      description: 'Structured analysis for any song or track', tags: ['music', 'structured', 'analysis'],
      schemaJSON: JSON.stringify(SCHEMA_TEMPLATES.track_analysis.schema, null, 2),
      pairedPrompt: "Analyze 'Clair de Lune' by Claude Debussy using this schema.",
      savedAt: now, lastUsedAt: null, seeded: true
    },
    {
      id: crypto.randomUUID(), type: 'prompt', title: 'Roguelike Class Designer',
      description: 'Generate balanced character classes for a dungeon crawler', tags: ['gaming', 'design', 'creative'],
      mode: 'freetext', systemPrompt: '',
      userPrompt: "I'm designing a roguelike dungeon crawler. Suggest a set of 5 unique character classes with distinct playstyles, a signature ability for each, and how they might synergize in a 4-player co-op mode.",
      savedAt: now, lastUsedAt: null, seeded: true
    }
  );
}

function getFilteredEntries() {
  let entries = [...state.promptLibrary];

  if (state.activeType !== 'all') {
    entries = entries.filter(e => e.type === state.activeType);
  }

  if (state.activeTags.size > 0) {
    entries = entries.filter(e =>
      [...state.activeTags].every(t => (e.tags || []).includes(t))
    );
  }

  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    entries = entries.filter(e => {
      const blob = [e.title, e.description || '', ...(e.tags || []), e.userPrompt || '', e.schemaJSON || ''].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }

  switch (state.sortOrder) {
    case 'oldest':  entries.sort((a, b) => a.savedAt.localeCompare(b.savedAt)); break;
    case 'lastused': entries.sort((a, b) => (b.lastUsedAt || b.savedAt).localeCompare(a.lastUsedAt || a.savedAt)); break;
    case 'az':      entries.sort((a, b) => a.title.localeCompare(b.title)); break;
    default:        entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  return entries;
}

function saveEntry(entry) {
  state.promptLibrary.push(entry);
  renderLibrary();
  showToast('✓ Saved to library');
  // Pulse count badge
  const badge = $('library-count');
  badge.classList.remove('pulse');
  void badge.offsetWidth;
  badge.classList.add('pulse');
  // Draw attention to panel if collapsed
  if ($('library-panel').classList.contains('collapsed')) {
    const btn = $('library-toggle-btn');
    btn.style.transition = 'background 0.4s';
    btn.style.background = 'var(--accent-light)';
    setTimeout(() => { btn.style.background = ''; }, 800);
  }
}

function updateEntry(id, updates) {
  const idx = state.promptLibrary.findIndex(e => e.id === id);
  if (idx === -1) return;
  state.promptLibrary[idx] = { ...state.promptLibrary[idx], ...updates };
  renderLibrary();
}

function deleteEntry(id) {
  const card = document.querySelector(`.entry-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('removing');
    card.addEventListener('animationend', () => {
      state.promptLibrary = state.promptLibrary.filter(e => e.id !== id);
      state.selectedEntries.delete(id);
      renderLibrary();
    }, { once: true });
  } else {
    state.promptLibrary = state.promptLibrary.filter(e => e.id !== id);
    state.selectedEntries.delete(id);
    renderLibrary();
  }
}

function loadEntry(id) {
  const entry = state.promptLibrary.find(e => e.id === id);
  if (!entry) return;

  // Update lastUsedAt
  const idx = state.promptLibrary.findIndex(e => e.id === id);
  state.promptLibrary[idx].lastUsedAt = new Date().toISOString();

  if (entry.type === 'schema') {
    $('mode-toggle').checked = true;
    setMode('structured');
    $('schema-input').value = entry.schemaJSON || '';
    $('schema-select').value = 'custom';
    autoFillSystemPrompt();
    if (entry.pairedPrompt) showSuggestedPrompt(entry.pairedPrompt);
  } else {
    const mode = entry.mode || 'freetext';
    $('mode-toggle').checked = mode === 'structured';
    setMode(mode);
    $('system-prompt').value = entry.systemPrompt || '';
    $('user-prompt').value = entry.userPrompt || '';
    if (mode === 'structured' && entry.schemaJSON) {
      $('schema-input').value = entry.schemaJSON;
      $('schema-select').value = 'custom';
    }
  }

  showLoadedBanner(entry.title);
  $('prompt-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderLibrary();
}

function showLoadedBanner(title) {
  const banner = $('loaded-banner');
  banner.innerHTML = `Loaded: <strong>${escapeHTML(title)}</strong>
    <button id="dismiss-banner" aria-label="Dismiss">✕</button>`;
  show(banner);
  $('dismiss-banner').addEventListener('click', () => hide(banner));
}

function showSuggestedPrompt(prompt) {
  let hint = $('suggested-prompt-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'suggested-prompt-hint';
    hint.className = 'suggested-prompt-hint';
    $('schema-area').insertAdjacentElement('afterend', hint);
  }
  const preview = prompt.length > 80 ? prompt.slice(0, 80) + '…' : prompt;
  hint.innerHTML = `💡 Suggested prompt: <em>"${escapeHTML(preview)}"</em>
    <button id="use-suggested" class="link-btn">Use it</button>`;
  show(hint);
  $('use-suggested').addEventListener('click', () => {
    $('user-prompt').value = prompt;
    hide(hint);
  });
}

/* =============================================================
   LIBRARY — RENDER
   ============================================================= */

function renderLibrary() {
  const list = $('library-list');
  const entries = getFilteredEntries();
  $('library-count').textContent = state.promptLibrary.length;
  updateTagChips();

  if (entries.length === 0) {
    const empty = state.promptLibrary.length === 0;
    list.innerHTML = `
      <div class="library-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <p>${empty
          ? 'Nothing saved yet. Run a prompt and hit <strong>Save to Library</strong> to start your collection.'
          : `No matches for "${escapeHTML(state.searchQuery || 'your filters')}". Try different keywords or clear the filters.`
        }</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  entries.forEach(entry => list.appendChild(buildEntryCard(entry)));
}

function buildEntryCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card' + (state.selectedEntries.has(entry.id) ? ' selected' : '');
  card.dataset.id = entry.id;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'listitem');

  const icon = entry.type === 'schema' ? '{}' : '📝';
  const time = relativeTime(entry.lastUsedAt || entry.savedAt);
  const preview = (entry.type === 'schema' ? entry.schemaJSON : entry.userPrompt) || '';
  const tagsHtml = (entry.tags || []).map(t => {
    const c = tagColor(t);
    return `<span class="tag-chip" style="background:${c.bg};color:${c.fg};border-color:${c.border}">${escapeHTML(t)}</span>`;
  }).join('');

  card.innerHTML = `
    ${state.selectMode ? `<input type="checkbox" class="entry-card-checkbox" ${state.selectedEntries.has(entry.id) ? 'checked' : ''}>` : ''}
    <div class="entry-card-header">
      <span class="entry-type-icon">${icon}</span>
      <span class="entry-title" title="${escapeHTML(entry.title)}">${escapeHTML(entry.title)}</span>
      <span class="entry-time">${time}</span>
    </div>
    ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ''}
    <div class="entry-preview">${escapeHTML(preview.slice(0, 80))}${preview.length > 80 ? '…' : ''}</div>
    ${entry.seeded ? '<div class="entry-seeded-label">Starter example — edit or delete freely.</div>' : ''}
    <div class="entry-actions" data-id="${entry.id}">
      <button class="secondary-btn small-btn" data-action="load">↩ Load</button>
      <button class="secondary-btn small-btn" data-action="edit">✏ Edit</button>
      <button class="danger-btn small-btn" data-action="delete">🗑 Delete</button>
    </div>
  `;

  card.querySelector('.entry-actions').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = entry.id;
    if (btn.dataset.action === 'load') loadEntry(id);
    else if (btn.dataset.action === 'edit') openEditDialog(id);
    else if (btn.dataset.action === 'delete') confirmDelete(id, card);
  });

  card.querySelector('.entry-card-checkbox')?.addEventListener('change', e => {
    if (e.target.checked) state.selectedEntries.add(entry.id);
    else state.selectedEntries.delete(entry.id);
    card.classList.toggle('selected', e.target.checked);
  });

  card.addEventListener('keydown', e => { if (e.key === 'Enter') loadEntry(entry.id); });

  return card;
}

function confirmDelete(id, card) {
  const actions = card.querySelector('.entry-actions');
  actions.innerHTML = `
    <span class="entry-delete-confirm">
      Delete this entry?
      <button class="danger-btn small-btn" data-yes>Yes</button>
      <button class="secondary-btn small-btn" data-no>No</button>
    </span>`;
  actions.querySelector('[data-yes]').addEventListener('click', () => deleteEntry(id));
  actions.querySelector('[data-no]').addEventListener('click', () => renderLibrary());
}

function updateTagChips() {
  const container = $('library-tags');
  const allTags = [...new Set(state.promptLibrary.flatMap(e => e.tags || []))].sort();
  container.innerHTML = '';
  allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'library-tag-chip' + (state.activeTags.has(tag) ? ' active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      if (state.activeTags.has(tag)) state.activeTags.delete(tag);
      else state.activeTags.add(tag);
      renderLibrary();
    });
    container.appendChild(btn);
  });
}

/* =============================================================
   TAG UTILITIES
   ============================================================= */

function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return { bg: `hsl(${hue},55%,90%)`, fg: `hsl(${hue},50%,30%)`, border: `hsl(${hue},45%,75%)` };
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  if (d < 172800) return 'yesterday';
  return `${Math.floor(d/86400)}d ago`;
}

/* =============================================================
   SAVE DIALOG
   ============================================================= */

function openSaveDialog(type) {
  state.savingType = type;
  state.editingEntryId = null;
  state.saveTags = [];

  const titles = { prompt: 'Save Prompt', schema: 'Save Schema', pair: 'Save Prompt + Schema' };
  $('save-dialog-title').textContent = titles[type] || 'Save to Library';

  const userPrompt = $('user-prompt').value.trim();
  $('save-title').value = userPrompt ? userPrompt.slice(0, 50) : '';
  $('save-description').value = '';
  renderSaveTagChips();
  $('save-tags-input').value = '';
  $('save-include-system').checked = !!$('system-prompt').value.trim();

  $('include-system-row').style.display = (type === 'schema') ? 'none' : '';
  hide($('save-as-new-btn'));
  $('save-confirm-btn').textContent = 'Save';

  show($('save-dialog'));
  setTimeout(() => $('save-title').focus(), 30);
}

function openEditDialog(id) {
  const entry = state.promptLibrary.find(e => e.id === id);
  if (!entry) return;

  state.editingEntryId = id;
  state.savingType = entry.type;
  state.saveTags = [...(entry.tags || [])];

  $('save-dialog-title').textContent = 'Edit Entry';
  $('save-title').value = entry.title;
  $('save-description').value = entry.description || '';
  renderSaveTagChips();
  $('save-tags-input').value = '';
  $('save-include-system').checked = true;

  $('include-system-row').style.display = (entry.type === 'schema') ? 'none' : '';
  show($('save-as-new-btn'));
  $('save-confirm-btn').textContent = 'Update';

  show($('save-dialog'));
  setTimeout(() => $('save-title').focus(), 30);
}

function closeSaveDialog() {
  hide($('save-dialog'));
  state.editingEntryId = null;
  state.saveTags = [];
}

function confirmSave(asNew = false) {
  const title = $('save-title').value.trim();
  if (!title) { $('save-title').focus(); showToast('Title is required.'); return; }

  const now = new Date().toISOString();
  const id = asNew ? crypto.randomUUID() : (state.editingEntryId || crypto.randomUUID());
  const base = {
    id, title,
    description: $('save-description').value.trim().slice(0, 120),
    tags: [...state.saveTags],
    savedAt: now,
    lastUsedAt: null
  };

  let entry;
  if (state.savingType === 'schema') {
    entry = { ...base, type: 'schema', schemaJSON: $('schema-input').value.trim(), pairedPrompt: $('user-prompt').value.trim() || null };
  } else {
    entry = {
      ...base, type: 'prompt', mode: state.mode,
      systemPrompt: $('save-include-system').checked ? $('system-prompt').value.trim() : '',
      userPrompt: $('user-prompt').value.trim(),
      ...(state.savingType === 'pair' ? { schemaJSON: $('schema-input').value.trim() } : {})
    };
  }

  if (!asNew && state.editingEntryId) {
    updateEntry(state.editingEntryId, entry);
    showToast('✓ Entry updated');
  } else {
    saveEntry(entry);
  }

  closeSaveDialog();
}

function addSaveTag(raw) {
  const tag = raw.trim().toLowerCase().replace(/[,;]+/g, '');
  if (!tag || state.saveTags.includes(tag)) return;
  state.saveTags.push(tag);
  renderSaveTagChips();
}

function removeSaveTag(tag) {
  state.saveTags = state.saveTags.filter(t => t !== tag);
  renderSaveTagChips();
}

function renderSaveTagChips() {
  const container = $('save-tags-chips');
  container.innerHTML = '';
  state.saveTags.forEach(tag => {
    const c = tagColor(tag);
    const chip = document.createElement('span');
    chip.className = 'tag-chip removable';
    chip.style.cssText = `background:${c.bg};color:${c.fg};border-color:${c.border}`;
    chip.innerHTML = `${escapeHTML(tag)} <span class="tag-chip-remove">✕</span>`;
    chip.querySelector('.tag-chip-remove').addEventListener('click', () => removeSaveTag(tag));
    container.appendChild(chip);
  });
}

/* =============================================================
   EXPORT / IMPORT
   ============================================================= */

function exportLibrary() {
  if (!state.promptLibrary.length) { showToast('Library is empty.'); return; }
  const blob = new Blob([JSON.stringify(state.promptLibrary, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `switchboard-library-${new Date().toISOString().slice(0,10)}.json`
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast('✓ Library exported');
}

async function importLibrary(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error();

    const valid = data.filter(e => e.id && e.type && e.title);
    if (!valid.length) throw new Error();

    const existingIds = new Set(state.promptLibrary.map(e => e.id));
    const dups = valid.filter(e => existingIds.has(e.id));
    let toAdd = valid;

    if (dups.length) {
      const replace = confirm(`${dups.length} entr${dups.length === 1 ? 'y' : 'ies'} already exist.\n\nOK = Replace existing\nCancel = Skip duplicates, only add new ones`);
      if (replace) {
        state.promptLibrary = state.promptLibrary.filter(e => !dups.find(d => d.id === e.id));
      } else {
        toAdd = valid.filter(e => !existingIds.has(e.id));
      }
    }

    state.promptLibrary.push(...toAdd);
    renderLibrary();

    const p = toAdd.filter(e => e.type === 'prompt').length;
    const s = toAdd.filter(e => e.type === 'schema').length;
    showToast(`✓ Imported ${toAdd.length} entries (${p} prompts, ${s} schemas)`);
  } catch {
    showToast("That file doesn't look like a valid Switchboard library.");
  }
}

/* =============================================================
   TOAST
   ============================================================= */

let _toastTimer = null;
function showToast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg;
  show(t);
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => hide(t), ms);
}

/* =============================================================
   KEYBOARD SHORTCUTS
   ============================================================= */

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      $('library-panel').classList.toggle('collapsed');
      return;
    }
    if (mod && e.key === 's') {
      e.preventDefault();
      openSaveDialog(state.mode === 'structured' ? 'pair' : 'prompt');
      return;
    }
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      sendPrompt();
      return;
    }
    if (e.key === 'Escape') {
      if (!$('save-dialog').classList.contains('hidden')) { closeSaveDialog(); return; }
      if (!$('shortcuts-dialog').classList.contains('hidden')) { hide($('shortcuts-dialog')); return; }
      if (state.selectMode) { exitSelectMode(); return; }
    }
    // Arrow nav in library cards
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && document.activeElement?.classList.contains('entry-card')) {
      e.preventDefault();
      const cards = [...$('library-list').querySelectorAll('.entry-card')];
      const idx = cards.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? cards[idx + 1] : cards[idx - 1];
      next?.focus();
    }
  });
}

/* =============================================================
   BULK ACTIONS
   ============================================================= */

function exitSelectMode() {
  state.selectMode = false;
  state.selectedEntries.clear();
  hide($('bulk-action-bar'));
  renderLibrary();
}

/* =============================================================
   EVENT LISTENERS
   ============================================================= */

function setupEventListeners() {
  // API key
  $('api-key-input').addEventListener('change', e => handleKeyInput(e.target.value));
  $('api-key-input').addEventListener('paste', e => setTimeout(() => handleKeyInput(e.target.value), 10));
  $('key-file-input').addEventListener('change', e => { handleKeyFile(e.target.files[0]); e.target.value = ''; });
  $('clear-key-btn').addEventListener('click', clearKey);
  $('try-again-btn').addEventListener('click', () => { clearKey(); $('api-key-input').focus(); });

  // Model
  $('model-select').addEventListener('change', e => { state.selectedModel = e.target.value; });

  // Mode toggle
  $('mode-toggle').addEventListener('change', e => setMode(e.target.checked ? 'structured' : 'freetext'));

  // Schema
  $('schema-select').addEventListener('change', e => onSchemaSelect(e.target.value));
  $('schema-input').addEventListener('input', () => { $('schema-select').value = 'custom'; autoFillSystemPrompt(); });

  // Send
  $('send-btn').addEventListener('click', sendPrompt);

  // Save buttons
  $('save-prompt-btn').addEventListener('click', () => openSaveDialog('prompt'));
  $('save-schema-btn').addEventListener('click', () => openSaveDialog('schema'));
  $('save-pair-btn').addEventListener('click', () => openSaveDialog('pair'));

  // Save dialog
  $('save-confirm-btn').addEventListener('click', () => confirmSave(false));
  $('save-as-new-btn').addEventListener('click', () => confirmSave(true));
  $('save-cancel-btn').addEventListener('click', closeSaveDialog);
  $('save-dialog').addEventListener('click', e => { if (e.target === $('save-dialog')) closeSaveDialog(); });

  // Tag input
  $('save-tags-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSaveTag(e.target.value);
      e.target.value = '';
    } else if (e.key === 'Backspace' && !e.target.value && state.saveTags.length) {
      removeSaveTag(state.saveTags.at(-1));
    }
  });
  $('save-tags-input').addEventListener('blur', e => {
    if (e.target.value.trim()) { addSaveTag(e.target.value); e.target.value = ''; }
  });
  // Click on tag container focuses input
  $('save-tags-container').addEventListener('click', e => {
    if (!e.target.closest('.tag-chip')) $('save-tags-input').focus();
  });

  // Library panel
  $('library-toggle-btn').addEventListener('click', () => $('library-panel').classList.toggle('collapsed'));

  // Library search (debounced 200ms)
  $('library-search').addEventListener('input', e => {
    clearTimeout(state.searchDebounce);
    state.searchDebounce = setTimeout(() => { state.searchQuery = e.target.value; renderLibrary(); }, 200);
  });

  // Library type tabs
  document.querySelectorAll('.type-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeType = btn.dataset.type;
      renderLibrary();
    });
  });

  // Library sort
  $('library-sort').addEventListener('change', e => { state.sortOrder = e.target.value; renderLibrary(); });

  // Export / Import / Clear
  $('export-btn').addEventListener('click', exportLibrary);
  $('import-input').addEventListener('change', e => { importLibrary(e.target.files[0]); e.target.value = ''; });
  $('clear-all-btn').addEventListener('click', () => {
    if (!state.promptLibrary.length) { showToast('Library is already empty.'); return; }
    if (!confirm(`Remove all ${state.promptLibrary.length} entries? This cannot be undone.`)) return;
    state.promptLibrary = [];
    state.selectedEntries.clear();
    renderLibrary();
    showToast('Library cleared.');
  });

  // Bulk actions
  $('library-select-btn').addEventListener('click', () => {
    state.selectMode = !state.selectMode;
    if (state.selectMode) {
      show($('bulk-action-bar'));
      renderLibrary();
    } else {
      exitSelectMode();
    }
  });
  $('bulk-cancel-btn').addEventListener('click', exitSelectMode);
  $('bulk-delete-btn').addEventListener('click', () => {
    if (!state.selectedEntries.size) { showToast('No entries selected.'); return; }
    if (!confirm(`Delete ${state.selectedEntries.size} selected entries?`)) return;
    state.selectedEntries.forEach(id => {
      state.promptLibrary = state.promptLibrary.filter(e => e.id !== id);
    });
    state.selectedEntries.clear();
    exitSelectMode();
  });
  $('bulk-tag-btn').addEventListener('click', () => {
    if (!state.selectedEntries.size) { showToast('No entries selected.'); return; }
    const tag = prompt('Tag to add to selected entries:');
    if (!tag?.trim()) return;
    const cleaned = tag.trim().toLowerCase();
    state.selectedEntries.forEach(id => {
      const e = state.promptLibrary.find(x => x.id === id);
      if (e && !e.tags.includes(cleaned)) e.tags.push(cleaned);
    });
    renderLibrary();
    showToast(`✓ Tagged ${state.selectedEntries.size} entries with "${cleaned}"`);
  });

  // Shortcuts dialog
  $('library-shortcuts-btn').addEventListener('click', () => show($('shortcuts-dialog')));
  $('shortcuts-close-btn').addEventListener('click', () => hide($('shortcuts-dialog')));
  $('shortcuts-dialog').addEventListener('click', e => { if (e.target === $('shortcuts-dialog')) hide($('shortcuts-dialog')); });
}
