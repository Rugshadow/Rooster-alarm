#!/usr/bin/env node
// Run once to auto-translate en.json into all supported languages.
// Usage: ANTHROPIC_API_KEY=sk-... node scripts/translate.js
// Re-run whenever you add new strings to en.json.

const fs = require('fs');
const path = require('path');
const https = require('https');

const LANGUAGES = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese (Simplified Mandarin)',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  bn: 'Bengali',
  ru: 'Russian',
  pt: 'Portuguese (Brazilian)',
  id: 'Indonesian',
  fil: 'Filipino (Tagalog)',
  vi: 'Vietnamese',
};

const enPath = path.join(__dirname, '../locales/en.json');
const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable not set');

  const body = JSON.stringify({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { reject(new Error(parsed.error.message)); return; }
            const text = parsed.content[0].text;
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) { reject(new Error('No JSON object found in response')); return; }
            resolve(JSON.parse(match[0]));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translate(langCode, langName) {
  const prompt = `Translate the string values in this JSON from English to ${langName}.

Rules:
- Keep all JSON keys exactly as-is (do not translate keys)
- Only translate string values
- Do not translate the app name "Peace Alarm"
- Keep interpolation placeholders exactly as-is: {{count}}, {{search}}, {{listeners}}, {{genre}}
- For arrays (like months and day_labels), translate each element
- Return only valid JSON with no explanation, markdown, or code fences

JSON to translate:
${JSON.stringify(enJson, null, 2)}`;

  return callClaude(prompt);
}

async function main() {
  const localesDir = path.join(__dirname, '../locales');
  const langs = Object.entries(LANGUAGES);

  for (const [code, name] of langs) {
    const outPath = path.join(localesDir, `${code}.json`);
    process.stdout.write(`Translating → ${name} (${code})... `);
    try {
      const translated = await translate(code, name);
      fs.writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n');
      console.log('✓');
    } catch (e) {
      console.log(`✗ (${e.message})`);
    }
    // 1 second between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\nDone! Run `npx expo run:android` to see translations.');
}

main().catch((e) => { console.error(e); process.exit(1); });
