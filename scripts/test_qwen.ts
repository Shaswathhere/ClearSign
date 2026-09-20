import * as fs from 'fs';
import Groq from 'groq-sdk';
import { SYSTEM_ANALYSIS_PROMPT, buildUserAnalysisPrompt } from '../lib/prompts';
import { formatClausesForPrompt, segmentDocument } from '../lib/segment';
import { runRuleEngine } from '../lib/rules';

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const env: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  const groq = new Groq({ apiKey: env.LLM_API_KEY });
  const rawText = fs.readFileSync('samples/gym-membership-pdf-text.txt', 'utf-8');
  const clauses = segmentDocument(rawText);
  const { hints } = runRuleEngine(clauses);
  const userPrompt = buildUserAnalysisPrompt(formatClausesForPrompt(clauses), hints);

  for (const model of ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b']) {
    console.log(`\nTesting full prompt on ${model}...`);
    const start = Date.now();
    try {
      const res = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_ANALYSIS_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4096,
      });
      console.log(`${model} done in ${Date.now() - start}ms`);
      const content = res.choices[0]?.message?.content || '{}';
      console.log('Valid JSON?', Boolean(JSON.parse(content)));
      console.log('Keys:', Object.keys(JSON.parse(content)));
    } catch (e: any) {
      console.error(`${model} failed in ${Date.now() - start}ms:`, e.message);
      if (e.error) console.error('Details:', e.error);
    }
  }
}

main();
