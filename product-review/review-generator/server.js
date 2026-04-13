require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

function getOpenAI(apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('No API key provided. Paste your key or upload a .env file in the UI.');
  }
  return new OpenAI({ apiKey: key });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SENTIMENT_LABELS = {
  '-2': 'very negative',
  '-1': 'negative',
   '0': 'neutral',
   '1': 'positive',
   '2': 'very positive',
};

const LENGTH_WORDS = {
  short: '~100 words',
  medium: '~250 words',
  long: '~500 words',
};

function buildPrompt({ productName, category, length, style, comments, sentimentAspects }) {
  const wordCount = LENGTH_WORDS[length] || '~250 words';

  const aspectLines = [];
  const aspectMap = {
    overall: 'Overall',
    price: 'Price/Value',
    features: 'Features',
    usability: 'Usability',
  };

  for (const [key, label] of Object.entries(aspectMap)) {
    const val = sentimentAspects[key];
    if (val !== undefined && val !== 0 && val !== '0') {
      const word = SENTIMENT_LABELS[String(val)] || 'neutral';
      aspectLines.push(`- ${label}: ${word}`);
    }
  }

  let prompt = `Write a ${wordCount} product review for "${productName}" in the ${category} category.\n\n`;
  prompt += `Style: ${style}\n`;

  if (comments && comments.trim()) {
    prompt += `Additional comments from reviewer: ${comments.trim()}\n`;
  }

  if (aspectLines.length > 0) {
    prompt += `\nSentiment guidance (scale: -2 = very negative, -1 = negative, 0 = neutral, +1 = positive, +2 = very positive):\n`;
    prompt += aspectLines.join('\n') + '\n';
  }

  prompt += '\nWrite only the review text. Do not include any labels, headers, or meta-commentary.';
  return prompt;
}

app.post('/generate', async (req, res) => {
  const { productName, category, length, style, comments, model, sentimentAspects, apiKey } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ error: 'Product name is required.' });
  }

  const prompt = buildPrompt({ productName, category, length, style, comments, sentimentAspects });

  try {
    const completion = await getOpenAI(apiKey).chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const review = completion.choices[0]?.message?.content || '';
    res.json({ review });
  } catch (err) {
    const message = err?.error?.message || err?.message || 'OpenAI request failed.';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Review Generator running at http://localhost:${PORT}`);
});
