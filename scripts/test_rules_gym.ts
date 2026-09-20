import * as fs from 'fs';
import { segmentDocument } from '../lib/segment';
import { normalizeText } from '../lib/verify';

const rawText = fs.readFileSync('samples/gym-membership.txt', 'utf-8');
const clauses = segmentDocument(rawText);

console.log('Total clauses:', clauses.length);

// Check definitions false positive
const c1_1 = clauses.find(c => c.text.includes('Renewal Term'));
console.log('Clause containing Renewal Term:', c1_1?.id, c1_1?.text.slice(0, 80));

const r1_pattern = /\b(?:auto(?:matically)?[- ]?renew(?:s|ed|ing|al)?|renew(?:s|ed|ing|al)?\s+automatically|automatically\s+renew(?:s|ed|ing|al)?|evergreen\s+clause)\b/i;
console.log('R1 matches C3 (1.1)?', c1_1 ? r1_pattern.test(c1_1.text) : false);

// Check 4.1
const c4_1 = clauses.find(c => c.text.includes('4.1'));
console.log('R1 matches C15 (4.1)?', c4_1 ? r1_pattern.test(c4_1.text) : false);

// Check 4.2
const c4_2 = clauses.find(c => c.text.includes('4.2'));
console.log('C4.2 found?', c4_2?.id, c4_2?.text.slice(0, 100));
