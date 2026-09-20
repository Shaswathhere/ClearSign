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
const models = await groq.models.list();
console.log(models.data.map(m => m.id).sort().join('\n'));
