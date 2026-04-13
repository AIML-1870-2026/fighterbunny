/* ============================================================
   API Key — in-memory only
   ============================================================ */
let storedApiKey = '';

const apiKeyInput  = document.getElementById('api-key-input');
const keyStatus    = document.getElementById('key-status');
const envFileInput = document.getElementById('env-file-input');
const clearKeyBtn  = document.getElementById('clear-key-btn');

function parseEnvFile(text) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key === 'OPENAI_API_KEY') {
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return null;
}

function setKey(val) {
  storedApiKey = val || '';
  apiKeyInput.value = storedApiKey;
  if (storedApiKey.startsWith('sk-') && storedApiKey.length > 20) {
    keyStatus.textContent = '✓';
    keyStatus.style.color = 'var(--success)';
  } else if (storedApiKey.length > 0) {
    keyStatus.textContent = '?';
    keyStatus.style.color = 'var(--warn)';
  } else {
    keyStatus.textContent = '';
  }
}

apiKeyInput.addEventListener('input', () => setKey(apiKeyInput.value.trim()));

envFileInput.addEventListener('change', () => {
  const file = envFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const key = parseEnvFile(e.target.result);
    if (key) {
      setKey(key);
    } else {
      keyStatus.textContent = '✗';
      keyStatus.style.color = 'var(--danger)';
    }
    envFileInput.value = '';
  };
  reader.readAsText(file);
});

clearKeyBtn.addEventListener('click', () => setKey(''));

/* ============================================================
   Model Data
   ============================================================ */
const MODEL_FAMILIES = {
  gpt4o: {
    label: 'GPT-4o',
    models: [
      { value: 'gpt-4o',      label: 'gpt-4o' },
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    ],
  },
  gpt4turbo: {
    label: 'GPT-4 Turbo',
    models: [
      { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
    ],
  },
  gpt35: {
    label: 'GPT-3.5',
    models: [
      { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
    ],
  },
};

/* ============================================================
   Sentiment Mapping
   ============================================================ */
const SENTIMENT_MAP = {
  '-2': { label: 'Very Negative', cls: 'very-neg', trackCls: 'val-very-neg' },
  '-1': { label: 'Negative',      cls: 'neg',      trackCls: 'val-neg'      },
   '0': { label: 'Neutral',       cls: 'neutral',  trackCls: 'val-neutral'  },
   '1': { label: 'Positive',      cls: 'pos',      trackCls: 'val-pos'      },
   '2': { label: 'Very Positive', cls: 'very-pos', trackCls: 'val-very-pos' },
};

const SENTIMENT_WORDS = { '-2': 'very negative', '-1': 'negative', '0': 'neutral', '1': 'positive', '2': 'very positive' };
const LENGTH_WORDS    = { short: '~100 words', medium: '~250 words', long: '~500 words' };

const SENTIMENT_ALL_TRACK_CLASSES = Object.values(SENTIMENT_MAP).map(s => s.trackCls);
const SENTIMENT_ALL_LABEL_CLASSES = Object.values(SENTIMENT_MAP).map(s => s.cls);

/* ============================================================
   DOM References
   ============================================================ */
const modelFamilySelect = document.getElementById('model-family');
const modelSelect       = document.getElementById('model-select');
const generateBtn       = document.getElementById('generate-btn');
const copyBtn           = document.getElementById('copy-btn');
const outputArea        = document.getElementById('output-area');
const loadingBar        = document.getElementById('loading-bar');

const sliders = {
  overall:   document.getElementById('sentiment-overall'),
  price:     document.getElementById('sentiment-price'),
  features:  document.getElementById('sentiment-features'),
  usability: document.getElementById('sentiment-usability'),
};

const sliderLabels = {
  overall:   document.getElementById('label-overall'),
  price:     document.getElementById('label-price'),
  features:  document.getElementById('label-features'),
  usability: document.getElementById('label-usability'),
};

/* ============================================================
   Model Family Cascade
   ============================================================ */
function populateModels(familyKey) {
  const family = MODEL_FAMILIES[familyKey];
  modelSelect.innerHTML = '';
  if (!family) return;
  family.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });
}

modelFamilySelect.addEventListener('change', () => populateModels(modelFamilySelect.value));
populateModels(modelFamilySelect.value);

/* ============================================================
   Sentiment Sliders
   ============================================================ */
function updateSlider(key) {
  const slider  = sliders[key];
  const labelEl = sliderLabels[key];
  const val     = String(slider.value);
  const info    = SENTIMENT_MAP[val];

  labelEl.textContent = info.label;
  SENTIMENT_ALL_LABEL_CLASSES.forEach(c => labelEl.classList.remove(c));
  labelEl.classList.add(info.cls);

  SENTIMENT_ALL_TRACK_CLASSES.forEach(c => slider.classList.remove(c));
  slider.classList.add(info.trackCls);
}

Object.keys(sliders).forEach(key => {
  updateSlider(key);
  sliders[key].addEventListener('input', () => updateSlider(key));
});

/* ============================================================
   Prompt Builder (client-side)
   ============================================================ */
function buildPrompt({ productName, category, length, style, comments, sentimentAspects }) {
  const wordCount = LENGTH_WORDS[length] || '~250 words';

  const aspectMap = { overall: 'Overall', price: 'Price/Value', features: 'Features', usability: 'Usability' };
  const aspectLines = [];
  for (const [key, label] of Object.entries(aspectMap)) {
    const val = sentimentAspects[key];
    if (val !== 0) {
      aspectLines.push(`- ${label}: ${SENTIMENT_WORDS[String(val)]}`);
    }
  }

  let prompt = `Write a ${wordCount} product review for "${productName}" in the ${category} category.\n\n`;
  prompt += `Style: ${style}\n`;
  if (comments) prompt += `Additional comments from reviewer: ${comments}\n`;
  if (aspectLines.length) {
    prompt += `\nSentiment guidance (scale: -2 = very negative to +2 = very positive):\n`;
    prompt += aspectLines.join('\n') + '\n';
  }
  prompt += '\nWrite only the review text. Do not include any labels, headers, or meta-commentary.';
  return prompt;
}

/* ============================================================
   Generate Review — calls OpenAI directly from the browser
   ============================================================ */
function getFormValues() {
  const productName = document.getElementById('product-name').value.trim();
  const category    = document.getElementById('category').value;
  const style       = document.getElementById('style').value;
  const comments    = document.getElementById('comments').value.trim();
  const model       = modelSelect.value;
  const lengthEl    = document.querySelector('input[name="length"]:checked');
  const length      = lengthEl ? lengthEl.value : 'medium';
  const sentimentAspects = {
    overall:   Number(sliders.overall.value),
    price:     Number(sliders.price.value),
    features:  Number(sliders.features.value),
    usability: Number(sliders.usability.value),
  };
  return { productName, category, length, style, comments, model, sentimentAspects };
}

function setLoadingState(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading ? 'Generating…' : 'Generate Review';
  if (isLoading) {
    loadingBar.classList.remove('hidden');
    outputArea.classList.add('loading');
    copyBtn.classList.add('hidden');
  } else {
    loadingBar.classList.add('hidden');
    outputArea.classList.remove('loading');
  }
}

function showResult(text) {
  outputArea.textContent = text;
  outputArea.classList.remove('appeared');
  void outputArea.offsetWidth;
  outputArea.classList.add('appeared');
  copyBtn.classList.remove('hidden');
}

function showError(message) {
  outputArea.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'output-error';
  p.textContent = `Error: ${message}`;
  outputArea.appendChild(p);
  copyBtn.classList.add('hidden');
}

generateBtn.addEventListener('click', async () => {
  const values = getFormValues();

  if (!values.productName) {
    const input = document.getElementById('product-name');
    input.focus();
    input.style.borderColor = 'var(--danger)';
    setTimeout(() => { input.style.borderColor = ''; }, 1800);
    return;
  }

  if (!storedApiKey) {
    apiKeyInput.focus();
    apiKeyInput.style.borderColor = 'var(--danger)';
    setTimeout(() => { apiKeyInput.style.borderColor = ''; }, 1800);
    showError('Please enter your OpenAI API key at the top of the page.');
    return;
  }

  setLoadingState(true);
  outputArea.innerHTML = '<p class="output-placeholder">Generating review…</p>';

  const prompt = buildPrompt(values);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storedApiKey}`,
      },
      body: JSON.stringify({
        model: values.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data?.error?.message || `OpenAI error (${res.status})`);
    } else {
      showResult(data.choices[0]?.message?.content || '');
    }
  } catch (err) {
    showError(err.message || 'Network error.');
  } finally {
    setLoadingState(false);
  }
});

/* ============================================================
   Copy to Clipboard
   ============================================================ */
copyBtn.addEventListener('click', async () => {
  const text = outputArea.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copy to Clipboard';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
  }
});
