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

// Test json_schema with strict: true
try {
  const res = await groq.chat.completions.create({
    model: env.LLM_MODEL,
    messages: [
      { role: "system", content: "You are ClearSign." },
      { role: "user", content: "Analyze: gym agreement" }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "test_schema",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            score: { type: "number" }
          },
          required: ["summary", "score"],
          additionalProperties: false
        }
      }
    }
  });
  console.log('json_schema success:', res.choices[0]?.message?.content);
} catch (e) {
  console.log('json_schema error:', e.status, e.message);
  if (e.error) console.log('Details:', JSON.stringify(e.error, null, 2));
}
