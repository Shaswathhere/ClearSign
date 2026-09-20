import * as fs from 'fs';
import { segmentDocument } from '../lib/segment';

const text = fs.readFileSync('samples/gym-membership.txt', 'utf-8');
const clauses = segmentDocument(text);
for (const c of clauses) {
  const preview = c.text.trim().replace(/\s+/g, ' ').slice(0, 80);
  console.log(`${c.id}: ${preview}`);
}
