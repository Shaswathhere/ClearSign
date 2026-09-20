import * as fs from 'fs';

const text = fs.readFileSync('samples/gym-membership-pdf-text.txt', 'utf-8').replace(/\r\n/g, "\n").replace(/\r/g, "\n");

// We want split points.
// A clause boundary occurs at:
// 1. Double newlines \n\s*\n
// 2. Headings/numbers preceded by newline, period+space, or double space:
//    - e.g. "1.", "1.1", "10.2", "3.3", "(a)", "Clause 4"
const splitPoints = new Set([0, text.length]);

// Delimited regex
const regex = /(?:\n\s*\n|(?:\n|\.\s+|\s{2,})(?=([0-9]+(?:\.[0-9]+)+|[0-9]+[.)]|\([a-z0-9]+\)|(?:Clause|Article|Section|Schedule)\s+[0-9A-Za-z]+)\s+))/gi;

let match;
while ((match = regex.exec(text)) !== null) {
  // If match starts with delimiter, split after the delimiter (e.g. at the start of the clause number)
  // For \n\s*\n, split at match.index or match.index + match[0].length
  const full = match[0];
  if (full.startsWith('\n')) {
    splitPoints.add(match.index);
  } else if (full.startsWith('.')) {
    // split after the dot + space
    splitPoints.add(match.index + full.length);
  } else {
    // whitespace
    splitPoints.add(match.index + full.length);
  }
}

const sorted = Array.from(splitPoints).sort((a, b) => a - b);
const rawSlices = [];
for (let i = 0; i < sorted.length - 1; i++) {
  if (sorted[i + 1] > sorted[i]) {
    rawSlices.push({ start: sorted[i], end: sorted[i + 1], text: text.slice(sorted[i], sorted[i + 1]) });
  }
}

console.log('Raw slices count:', rawSlices.length);
rawSlices.forEach((s, i) => {
  console.log(`[${i+1}] ${s.text.trim().replace(/\s+/g, ' ').slice(0, 50)}`);
});
