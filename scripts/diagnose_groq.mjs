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

console.log('KEY:', env.LLM_API_KEY ? env.LLM_API_KEY.slice(0, 10) + '...' : 'NONE');
console.log('MODEL:', env.LLM_MODEL);

const groq = new Groq({ apiKey: env.LLM_API_KEY });
try {
  const res = await groq.chat.completions.create({
    model: env.LLM_MODEL,
    messages: [{ role: 'user', content: 'Say hello' }]
  });
  console.log('Success:', res.choices[0]?.message?.content);
} catch (e) {
  console.log('Groq Error Message:', e.message);
  console.log('Groq Error Status:', e.status);
  console.log('Groq Error Code:', e.code);
  console.log('Groq Error Type:', e.type);
  console.log('Groq Error Details:', JSON.stringify(e));
}
