import * as fs from 'fs';
import { segmentDocument, formatClausesForPrompt } from '../lib/segment';
import { runRuleEngine } from '../lib/rules';
import { SYSTEM_ANALYSIS_PROMPT, buildUserAnalysisPrompt } from '../lib/prompts';
import { callLLMJson } from '../lib/llm';
import { Analysis } from '../lib/schema';

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }

  const rawText = fs.readFileSync('samples/gym-membership-pdf-text.txt', 'utf-8');
  console.log('Doc length:', rawText.length);

  const clauses = segmentDocument(rawText);
  console.log('Segmented clauses count:', clauses.length);

  const { hints } = runRuleEngine(clauses);
  const formatted = formatClausesForPrompt(clauses);
  const userPrompt = buildUserAnalysisPrompt(formatted, hints);

  console.log('Calling LLM with model:', process.env.LLM_MODEL);
  try {
    const result = await callLLMJson(
      SYSTEM_ANALYSIS_PROMPT,
      userPrompt,
      (raw) => {
        const res = Analysis.safeParse(raw);
        if (!res.success) {
          return { success: false, error: res.error.format() };
        }
        return { success: true, data: res.data };
      }
    );
    console.log('LLM SUCCESS! docType:', result.docType);
    console.log('Traps count:', result.traps.length);
    console.log('Summary:', result.summary);
  } catch (err) {
    console.error('LLM FAILED WITH ERROR:');
    console.error(err);
  }
}

main();
