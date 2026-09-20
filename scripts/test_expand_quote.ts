import * as fs from 'fs';
import { segmentDocument } from '../lib/segment';
import { stripSectionHeadings } from '../lib/rules';
import { truncateWordSafely } from '../lib/schema';

const text = fs.readFileSync('samples/gym-membership.txt', 'utf-8');
const clauses = segmentDocument(text);

export function expandQuoteToSentence(quote: string, clauseText: string): string {
  const qClean = quote.trim();
  const idx = clauseText.toLowerCase().indexOf(qClean.toLowerCase());
  if (idx === -1) {
    return stripSectionHeadings(clauseText).trim();
  }

  // Find sentence start (look backward for sentence terminators that are not decimal numbers)
  let start = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = clauseText[i];
    if (ch === '\n') {
      start = i + 1;
      break;
    }
    if ((ch === '.' || ch === '!' || ch === '?') && i + 1 < clauseText.length) {
      // Check if period is inside a number like 4.2
      const prevChar = i > 0 ? clauseText[i - 1] : '';
      const nextChar = clauseText[i + 1];
      const isDecimal = /\d/.test(prevChar) && /\d/.test(nextChar);
      if (!isDecimal && (/\s/.test(nextChar) || nextChar === '"' || nextChar === '”')) {
        start = i + 1;
        break;
      }
    }
  }

  // Find sentence end
  let end = clauseText.length;
  for (let i = idx + qClean.length; i < clauseText.length; i++) {
    const ch = clauseText[i];
    if (ch === '\n') {
      end = i;
      break;
    }
    if (ch === '.' || ch === '!' || ch === '?') {
      const prevChar = i > 0 ? clauseText[i - 1] : '';
      const nextChar = i + 1 < clauseText.length ? clauseText[i + 1] : ' ';
      const isDecimal = /\d/.test(prevChar) && /\d/.test(nextChar);
      if (!isDecimal) {
        end = i + 1;
        break;
      }
    }
  }

  let sentence = clauseText.slice(start, end).trim();
  sentence = stripSectionHeadings(sentence);
  return truncateWordSafely(sentence, 400);
}

const c4_2 = clauses.find(c => c.text.includes('registered post'));
console.log('Clause 4.2 ID:', c4_2?.id);
console.log('Expanded:');
console.log(expandQuoteToSentence("registered post or speed post only", c4_2!.text));
