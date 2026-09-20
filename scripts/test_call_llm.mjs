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
console.log('Sending chat completion request...');
const start = Date.now();
try {
  const res = await groq.chat.completions.create({
    model: env.LLM_MODEL,
    messages: [
      { role: "system", content: "You are ClearSign. Respond ONLY with valid JSON conforming to schema: { docType: string, summary: string[], traps: [] }" },
      { role: "user", content: "Document text:\nFitPlus Wellness & Health Club agreement. No refund. Auto renewal." }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096,
  });
  console.log(`Done in ${Date.now() - start}ms`);
  console.log('Result:', res.choices[0]?.message?.content);
} catch (e) {
  console.log(`Failed in ${Date.now() - start}ms:`, e);
}
