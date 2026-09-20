import * as fs from 'fs';
import Groq from 'groq-sdk';
import { SYSTEM_ANALYSIS_PROMPT, buildUserAnalysisPrompt } from '../lib/prompts';
import { formatClausesForPrompt, segmentDocument } from '../lib/segment';
import { runRuleEngine } from '../lib/rules';

const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: {
      type: "string",
      enum: ["rental", "loan", "subscription", "insurance", "employment", "terms_of_service", "other"]
    },
    currency: { type: "string" },
    summary: {
      type: "array",
      items: { type: "string" }
    },
    traps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          clauseId: { type: "string" },
          quote: { type: "string" },
          category: {
            type: "string",
            enum: [
              "auto_renewal", "lock_in_termination", "penalty_fee", "unilateral_change",
              "refund_deposit", "interest_rate", "liability_indemnity", "arbitration_jurisdiction",
              "data_privacy", "exclusion_coverage", "non_compete_ip", "hidden_charges",
              "vague_terms", "other"
            ]
          },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          why: { type: "string" },
          action: { type: "string" },
          question: { anyOf: [{ type: "string" }, { type: "null" }] }
        },
        required: ["clauseId", "quote", "category", "severity", "why", "action", "question"]
      }
    },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          clauseId: { type: "string" },
          quote: { type: "string" },
          label: { type: "string" },
          absoluteDate: { anyOf: [{ type: "string" }, { type: "null" }] },
          relative: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  n: { type: "number" },
                  unit: { type: "string", enum: ["day", "week", "month", "year"] },
                  direction: { type: "string", enum: ["before", "after"] },
                  anchor: { type: "string", enum: ["start_date", "renewal_date", "end_date", "signing_date", "other"] }
                },
                required: ["n", "unit", "direction", "anchor"]
              },
              { type: "null" }
            ]
          }
        },
        required: ["clauseId", "quote", "label", "absoluteDate", "relative"]
      }
    },
    terms: {
      type: "object",
      additionalProperties: false,
      properties: {
        loan: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                principal: { type: "number" },
                annualRatePct: { type: "number" },
                tenureMonths: { type: "number" },
                processingFeePct: { anyOf: [{ type: "number" }, { type: "null" }] },
                prepaymentPenaltyPct: { anyOf: [{ type: "number" }, { type: "null" }] }
              },
              required: ["principal", "annualRatePct", "tenureMonths", "processingFeePct", "prepaymentPenaltyPct"]
            },
            { type: "null" }
          ]
        },
        subscription: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                price: { type: "number" },
                billingPeriodMonths: { type: "number" },
                autoRenews: { type: "boolean" },
                cancelNoticeDays: { anyOf: [{ type: "number" }, { type: "null" }] },
                earlyExitFee: { anyOf: [{ type: "number" }, { type: "null" }] }
              },
              required: ["price", "billingPeriodMonths", "autoRenews", "cancelNoticeDays", "earlyExitFee"]
            },
            { type: "null" }
          ]
        },
        rental: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                monthlyRent: { type: "number" },
                deposit: { anyOf: [{ type: "number" }, { type: "null" }] },
                lockInMonths: { anyOf: [{ type: "number" }, { type: "null" }] },
                noticeMonths: { anyOf: [{ type: "number" }, { type: "null" }] },
                annualEscalationPct: { anyOf: [{ type: "number" }, { type: "null" }] }
              },
              required: ["monthlyRent", "deposit", "lockInMonths", "noticeMonths", "annualEscalationPct"]
            },
            { type: "null" }
          ]
        }
      },
      required: ["loan", "subscription", "rental"]
    },
    questions: {
      type: "array",
      items: { type: "string" }
    },
    missing: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "string" },
          why: { type: "string" }
        },
        required: ["item", "why"]
      }
    }
  },
  required: ["docType", "currency", "summary", "traps", "deadlines", "terms", "questions", "missing"]
};

async function main() {
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
  const rawText = fs.readFileSync('samples/gym-membership-pdf-text.txt', 'utf-8');
  const clauses = segmentDocument(rawText);
  const { hints } = runRuleEngine(clauses);
  const userPrompt = buildUserAnalysisPrompt(formatClausesForPrompt(clauses), hints);

  console.log('Sending strict json_schema to Groq with model: qwen/qwen3.8-27b');
  const start = Date.now();
  try {
    const res = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: "system", content: SYSTEM_ANALYSIS_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "contract_analysis",
          strict: true,
          schema: ANALYSIS_JSON_SCHEMA
        }
      },
      temperature: 0.1,
      max_tokens: 4096,
    });
    console.log(`Success in ${Date.now() - start}ms!`);
    const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    console.log('docType:', parsed.docType);
    console.log('traps count:', parsed.traps.length);
    console.log('summary:', parsed.summary);
    console.log('terms:', parsed.terms);
  } catch (err) {
    console.error(`Failed in ${Date.now() - start}ms:`, err);
  }
}

main();
