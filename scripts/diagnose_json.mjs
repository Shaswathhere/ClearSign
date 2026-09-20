import * as fs from 'fs';
import Groq from 'groq-sdk';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const groq = new Groq({ apiKey: env.LLM_API_KEY });
const docText = fs.readFileSync('samples/gym-membership-pdf-text.txt', 'utf-8');

// Test with response_format json_object or json_schema
try {
  const res = await groq.chat.completions.create({
    model: env.LLM_MODEL,
    messages: [
      { role: 'system', content: 'You are a legal contract analyzer. Return a valid JSON object matching the requested schema.' },
      { role: 'user', content: 'Analyze this text and return JSON:\n\n' + docText.slice(0, 3000) }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096,
  });
  console.log('JSON object test succeeded!');
  console.log('Output preview:', res.choices[0]?.message?.content?.slice(0, 300));
} catch (e) {
  console.log('JSON object test error:');
  console.log('Message:', e.message);
  console.log('Status:', e.status);
  console.log('Code:', e.code);
  console.log('Type:', e.type);
  console.log('Full error:', JSON.stringify(e, null, 2));
}
