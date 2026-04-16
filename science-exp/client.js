'use strict';

/* ============================
   STATE
   ============================ */

let apiKey = null;
let lastResult = '';

/* ============================
   DOM REFERENCES
   ============================ */

const apiKeyInput    = document.getElementById('api-key-input');
const envFileInput   = document.getElementById('env-file-input');
const keyBadge       = document.getElementById('key-status-badge');
const gradeSelect    = document.getElementById('grade-level');
const suppliesInput  = document.getElementById('supplies');
const modelSelect    = document.getElementById('model');
const submitBtn      = document.getElementById('submit-btn');
const form           = document.getElementById('experiment-form');
const outputSection  = document.getElementById('output-section');
const outputArea     = document.getElementById('output-area');
const copyBtn        = document.getElementById('copy-btn');
const againBtn       = document.getElementById('again-btn');
const errorSection   = document.getElementById('error-section');
const errorMessage   = document.getElementById('error-message');

/* ============================
   API KEY — manual input
   ============================ */

apiKeyInput.addEventListener('input', () => {
  const val = apiKeyInput.value.trim();
  if (val) {
    apiKey = val;
    showKeyBadge('ok', '✓ Key ready');
  } else {
    apiKey = null;
    keyBadge.className = 'key-status-badge';
    keyBadge.style.display = 'none';
  }
  checkReady();
});

/* ============================
   API KEY — .env file upload
   ============================ */

envFileInput.addEventListener('change', () => {
  const file = envFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const match = text.match(/OPENAI_API_KEY\s*=\s*["']?([^"'\s\n\r]+)["']?/);
    const key = match ? match[1].trim() : null;
    if (key) {
      apiKey = key;
      apiKeyInput.value = key;
      showKeyBadge('ok', '✓ Key loaded from file');
    } else {
      showKeyBadge('err', 'No OPENAI_API_KEY found in file');
    }
    envFileInput.value = '';
    checkReady();
  };
  reader.readAsText(file);
});

function showKeyBadge(type, msg) {
  keyBadge.textContent = msg;
  keyBadge.className = 'key-status-badge ' + type;
}

/* ============================
   FORM VALIDATION
   ============================ */

function checkReady() {
  submitBtn.disabled = !(
    apiKey &&
    gradeSelect.value &&
    suppliesInput.value.trim() &&
    modelSelect.value
  );
}

[gradeSelect, suppliesInput, modelSelect].forEach(el => {
  el.addEventListener('change', checkReady);
  el.addEventListener('input', checkReady);
});

/* ============================
   FORM SUBMIT
   ============================ */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  hideOutput();
  setLoading(true);

  const systemPrompt =
    'You are a science curriculum assistant. Generate grade-appropriate science experiments ' +
    'using only the materials provided. Format your response in Markdown with clear sections.';

  const userMessage =
    `Grade level: ${gradeSelect.value}\n` +
    `Available supplies: ${suppliesInput.value.trim()}\n\n` +
    'Generate one complete science experiment including: experiment title, learning objective, ' +
    'materials needed, step-by-step instructions, expected results with a science explanation, ' +
    'and an optional extension activity.';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelSelect.value,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  }
        ]
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error?.message || `API error ${res.status}`;
      if (res.status === 401) {
        showKeyBadge('err', '✗ Invalid API key');
        showError('Your API key was rejected. Double-check it and try again.');
      } else {
        showError(msg);
      }
      return;
    }

    const result = data.choices?.[0]?.message?.content || '';
    showOutput(result);

  } catch (err) {
    showError('Network error — check your connection and try again.');
  } finally {
    setLoading(false);
  }
});

/* ============================
   LOADING STATE
   ============================ */

function setLoading(on) {
  if (on) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Generating...';
  } else {
    submitBtn.innerHTML = 'Generate Experiment';
    checkReady();
  }
}

/* ============================
   OUTPUT
   ============================ */

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

/* ============================
   COPY TO CLIPBOARD
   ============================ */

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastResult);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
  } catch {
    copyBtn.textContent = 'Copy failed';
  }
});

/* ============================
   GENERATE ANOTHER
   ============================ */

againBtn.addEventListener('click', () => {
  hideOutput();
  hideError();
  gradeSelect.value = '';
  suppliesInput.value = '';
  modelSelect.value = '';
  checkReady();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ============================
   ERROR
   ============================ */

function showError(msg) {
  errorMessage.textContent = msg;
  errorSection.classList.remove('hidden');
  errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideError() {
  errorSection.classList.add('hidden');
  errorMessage.textContent = '';
}
