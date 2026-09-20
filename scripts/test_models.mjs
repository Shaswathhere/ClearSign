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

const modelsToTest = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];

for (const model of modelsToTest) {
  console.log(`\n--- Testing ${model} ---`);
  const start = Date.now();
  try {
    const res = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are ClearSign. Respond ONLY with valid JSON conforming to: { \"docType\": \"subscription\", \"summary\": [\"line 1\"] }" },
        { role: "user", content: "Analyze this text: FitPlus Gym Agreement. No refund." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1024,
    });
    console.log(`Success in ${Date.now() - start}ms:`, res.choices[0]?.message?.content);
  } catch (e) {
    console.log(`Error in ${Date.now() - start}ms:`, e.status, e.message);
    if (e.error) console.log('Details:', JSON.stringify(e.error));
  }
}
