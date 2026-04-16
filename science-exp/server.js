'use strict';

require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');

/* Key set at runtime via the UI (overrides .env) */
let runtimeKey = null;

/* ============================
   INLINE HTML
   ============================ */

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Science Experiment Generator</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #fff0f5;
      --surface: #ffffff;
      --border: #f9c6d8;
      --text: #3b1a2e;
      --muted: #a0637c;
      --accent: #e0447c;
      --accent-hover: #c93670;
      --accent-light: #fff0f5;
      --accent2: #f472a8;
      --danger: #c0392b;
      --radius: 14px;
      --shadow: 0 4px 18px rgba(224,68,124,0.10);
      --font: 'Nunito', 'Segoe UI', system-ui, sans-serif;
    }

    body {
      font-family: var(--font);
      background: var(--bg);
      background-image:
        radial-gradient(circle at 15% 20%, #ffd6e8 0%, transparent 35%),
        radial-gradient(circle at 85% 75%, #fce4f0 0%, transparent 35%);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .page {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* --- Header --- */
    .site-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem 0 0.5rem;
    }
    .header-icon { font-size: 2.8rem; line-height: 1; filter: drop-shadow(0 2px 4px rgba(224,68,124,0.25)); }
    .site-header h1 {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #e0447c 0%, #f472a8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle { color: var(--muted); font-size: 0.95rem; margin-top: 0.2rem; font-weight: 600; }

    /* --- Card --- */
    .card {
      background: var(--surface);
      border: 1.5px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      box-shadow: var(--shadow);
    }

    /* --- Form --- */
    form { display: flex; flex-direction: column; gap: 1.25rem; }

    .field-group { display: flex; flex-direction: column; gap: 0.4rem; }

    label { font-size: 0.9rem; font-weight: 700; color: var(--accent); }

    select, textarea {
      width: 100%;
      padding: 0.65rem 0.9rem;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      font-family: var(--font);
      font-size: 0.95rem;
      color: var(--text);
      background: #fff8fb;
      transition: border-color 0.15s, box-shadow 0.15s;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23e0447c' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.85rem center;
      padding-right: 2.4rem;
    }
    textarea { background-image: none; padding-right: 0.9rem; resize: vertical; background: #fff8fb; }
    select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(224,68,124,0.15);
      background: #ffffff;
    }
    .field-hint { font-size: 0.82rem; color: var(--muted); }

    /* --- Buttons --- */
    .primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #e0447c 0%, #f472a8 100%);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.75rem;
      font-size: 0.95rem;
      font-weight: 800;
      font-family: var(--font);
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(224,68,124,0.30);
      transition: transform 0.12s, box-shadow 0.12s, opacity 0.15s;
      align-self: flex-start;
    }
    .primary-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(224,68,124,0.38);
    }
    .primary-btn:active:not(:disabled) { transform: translateY(0); }
    .primary-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

    .secondary-btn {
      background: var(--surface);
      color: var(--accent);
      border: 1.5px solid var(--border);
      border-radius: 8px;
      padding: 0.5rem 1.1rem;
      font-size: 0.88rem;
      font-weight: 700;
      font-family: var(--font);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .secondary-btn:hover {
      background: var(--accent-light);
      border-color: var(--accent);
      transform: translateY(-1px);
    }

    /* --- Output --- */
    .output-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1.5px solid var(--border);
    }
    .output-header h2 { font-size: 1.1rem; font-weight: 800; color: var(--accent); }
    .output-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    #output-area { line-height: 1.8; }
    #output-area h1 {
      font-size: 1.4rem; font-weight: 800; margin-bottom: 0.75rem;
      color: var(--accent);
    }
    #output-area h2 {
      font-size: 1.05rem; font-weight: 800;
      margin-top: 1.5rem; margin-bottom: 0.5rem;
      color: var(--accent2);
      border-bottom: 1.5px solid var(--border);
      padding-bottom: 0.25rem;
    }
    #output-area p { margin-bottom: 0.75rem; }
    #output-area ul, #output-area ol { padding-left: 1.4rem; margin-bottom: 0.75rem; }
    #output-area li { margin-bottom: 0.35rem; }
    #output-area strong { font-weight: 700; color: var(--accent); }

    /* --- API Key upload card --- */
    .key-card { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .key-card label.upload-label {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--accent-light); color: var(--accent);
      border: 1.5px solid var(--border); border-radius: 8px;
      padding: 0.5rem 1rem; font-size: 0.88rem; font-weight: 700;
      font-family: var(--font);
      cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .key-card label.upload-label:hover {
      background: #ffd6e8; border-color: var(--accent); transform: translateY(-1px);
    }
    .key-status-badge {
      font-size: 0.85rem; font-weight: 700; padding: 0.3rem 0.85rem;
      border-radius: 20px; display: none;
    }
    .key-status-badge.ok  { display: inline-block; background: #fce4f0; color: var(--accent); border: 1px solid var(--border); }
    .key-status-badge.err { display: inline-block; background: #fef2f2; color: var(--danger); border: 1px solid #fca5a5; }
    .key-hint { font-size: 0.82rem; color: var(--muted); font-weight: 600; }

    /* --- Error --- */
    .error-card { border-color: #fca5a5; background: #fef2f2; }
    .error-card p { color: var(--danger); font-size: 0.95rem; font-weight: 600; }

    /* --- Spinner --- */
    .spinner {
      display: inline-block;
      width: 1em; height: 1em;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .hidden { display: none !important; }

    @media (max-width: 520px) {
      .output-header { flex-direction: column; align-items: flex-start; }
      .site-header h1 { font-size: 1.4rem; }
    }
  </style>
</head>
<body>
  <div class="page">

    <header class="site-header">
      <div class="header-icon">🧪</div>
      <div>
        <h1>Science Experiment Generator</h1>
        <p class="subtitle">Get a custom experiment based on your grade level and available supplies.</p>
      </div>
    </header>

    <section class="card key-card">
      <label class="upload-label" for="env-file-input">
        &#128196; Upload .env file
      </label>
      <input type="file" id="env-file-input" accept=".env,.txt" style="display:none">
      <span id="key-status-badge" class="key-status-badge"></span>
      <span class="key-hint">Reads <code>OPENAI_API_KEY</code> from your .env file. Key stays on this machine.</span>
    </section>

    <main class="card">
      <form id="experiment-form" novalidate>

        <div class="field-group">
          <label for="grade-level">Grade Level</label>
          <select id="grade-level" required>
            <option value="" disabled selected>Select a grade level</option>
            <option>Kindergarten</option>
            <option>1st Grade</option>
            <option>2nd Grade</option>
            <option>3rd Grade</option>
            <option>4th Grade</option>
            <option>5th Grade</option>
            <option>6th Grade</option>
            <option>7th Grade</option>
            <option>8th Grade</option>
            <option>9th Grade</option>
            <option>10th Grade</option>
            <option>11th Grade</option>
            <option>12th Grade</option>
          </select>
        </div>

        <div class="field-group">
          <label for="supplies">Available Supplies</label>
          <textarea
            id="supplies"
            rows="4"
            required
            placeholder="e.g., baking soda, vinegar, balloons, string, paper towels, food coloring"
          ></textarea>
          <p class="field-hint">Enter items you have on hand or can easily acquire, separated by commas.</p>
        </div>

        <div class="field-group">
          <label for="model">Model</label>
          <select id="model" required>
            <option value="" disabled selected>Select a model</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4-turbo">gpt-4-turbo</option>
          </select>
        </div>

        <button type="submit" id="submit-btn" class="primary-btn" disabled>
          Generate Experiment
        </button>

      </form>
    </main>

    <section id="output-section" class="card hidden">
      <div class="output-header">
        <h2>Your Experiment</h2>
        <div class="output-actions">
          <button id="copy-btn" class="secondary-btn">Copy to Clipboard</button>
          <button id="again-btn" class="secondary-btn">Generate Another</button>
        </div>
      </div>
      <div id="output-area"></div>
    </section>

    <section id="error-section" class="card error-card hidden">
      <p id="error-message"></p>
    </section>

  </div>

  <script>
    const gradeSelect  = document.getElementById('grade-level');
    const suppliesInput = document.getElementById('supplies');
    const modelSelect  = document.getElementById('model');
    const submitBtn    = document.getElementById('submit-btn');
    const form         = document.getElementById('experiment-form');
    const outputSection = document.getElementById('output-section');
    const outputArea   = document.getElementById('output-area');
    const copyBtn      = document.getElementById('copy-btn');
    const againBtn     = document.getElementById('again-btn');
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');

    let lastResult = '';

    /* --- .env file upload --- */
    const envFileInput  = document.getElementById('env-file-input');
    const keyBadge      = document.getElementById('key-status-badge');

    envFileInput.addEventListener('change', () => {
      const file = envFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const match = text.match(/OPENAI_API_KEY\\s*=\\s*["']?([^"'\\s\\n\\r]+)["']?/);
        const key = match ? match[1].trim() : null;
        if (!key) {
          keyBadge.textContent = 'No OPENAI_API_KEY found in file';
          keyBadge.className = 'key-status-badge err';
          return;
        }
        try {
          const res = await fetch('/api/set-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
          });
          if (res.ok) {
            keyBadge.textContent = '&#10003; API key loaded';
            keyBadge.className = 'key-status-badge ok';
            keyBadge.innerHTML = '&#10003; API key loaded';
          } else {
            keyBadge.textContent = 'Failed to set key';
            keyBadge.className = 'key-status-badge err';
          }
        } catch {
          keyBadge.textContent = 'Could not reach server';
          keyBadge.className = 'key-status-badge err';
        }
        envFileInput.value = '';
      };
      reader.readAsText(file);
    });

    function checkReady() {
      submitBtn.disabled = !(gradeSelect.value && suppliesInput.value.trim() && modelSelect.value);
    }

    [gradeSelect, suppliesInput, modelSelect].forEach(el => {
      el.addEventListener('change', checkReady);
      el.addEventListener('input', checkReady);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();
      hideOutput();
      setLoading(true);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gradeLevel: gradeSelect.value,
            supplies: suppliesInput.value.trim(),
            model: modelSelect.value
          })
        });

        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Something went wrong. Please try again.'); return; }
        showOutput(data.result);
      } catch {
        showError('Could not reach the server. Make sure it is running and try again.');
      } finally {
        setLoading(false);
      }
    });

    function setLoading(on) {
      if (on) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Generating...';
      } else {
        submitBtn.innerHTML = 'Generate Experiment';
        checkReady();
      }
    }

    function showOutput(markdown) {
      lastResult = markdown;
      outputArea.innerHTML = marked.parse(markdown);
      outputSection.classList.remove('hidden');
      outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      copyBtn.textContent = 'Copy to Clipboard';
    }

    function hideOutput() {
      outputSection.classList.add('hidden');
      outputArea.innerHTML = '';
      lastResult = '';
    }

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lastResult);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
    });

    againBtn.addEventListener('click', () => {
      hideOutput();
      hideError();
      gradeSelect.value = '';
      suppliesInput.value = '';
      modelSelect.value = '';
      checkReady();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function showError(msg) {
      errorMessage.textContent = msg;
      errorSection.classList.remove('hidden');
      errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function hideError() {
      errorSection.classList.add('hidden');
      errorMessage.textContent = '';
    }
  </script>
</body>
</html>`;

/* ============================
   EXPRESS APP
   ============================ */

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* GET / — serve the full inline page */
app.get('/', (req, res) => {
  res.send(html);
});

/* POST /api/set-key — store key in memory for this session */
app.post('/api/set-key', (req, res) => {
  const { key } = req.body;
  if (!key || typeof key !== 'string' || !key.trim()) {
    return res.status(400).json({ error: 'No key provided.' });
  }
  runtimeKey = key.trim();
  return res.status(200).json({ ok: true });
});

/* POST /api/generate — call OpenAI and return result */
app.post('/api/generate', async (req, res) => {
  const { gradeLevel, supplies, model } = req.body;

  if (!gradeLevel || !supplies || !model) {
    return res.status(400).json({ error: 'All fields are required: gradeLevel, supplies, model.' });
  }

  const apiKey = runtimeKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No API key found. Upload your .env file or add OPENAI_API_KEY to .env and restart.' });
  }

  const client = new OpenAI({ apiKey });

  const systemPrompt =
    'You are a science curriculum assistant. Generate grade-appropriate science experiments ' +
    'using only the materials provided. Format your response in Markdown with clear sections.';

  const userMessage =
    `Grade level: ${gradeLevel}\n` +
    `Available supplies: ${supplies}\n\n` +
    'Generate one complete science experiment including: experiment title, learning objective, ' +
    'materials needed, step-by-step instructions, expected results with a science explanation, ' +
    'and an optional extension activity.';

  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  }
      ]
    });

    const result = response.choices[0].message.content;
    return res.status(200).json({ result });

  } catch (err) {
    console.error('OpenAI error:', err);
    return res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
  }
});

app.listen(PORT, () => {
  console.log(`Science Experiment Generator running at http://localhost:${PORT}`);
});
