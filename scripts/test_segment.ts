import * as fs from 'fs';

function testSegmentation(rawText: string) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Boundary regex:
  // Look for clause starts:
  // - Numbered clauses like 1., 1.1, 1.1.1, 3.3, 10.2
  // - Parenthesized like (a), (b), (1), (i)
  // - Numbered with paren like 1), 2)
  // - Article / Clause / Section headings
  // - Double newlines
  // We match boundaries that either follow a newline, two or more spaces, or sentence end (.!?)
  const pattern = /(?:\n\s*\n|(?<=[\n\r]|\.\s+|;\s+|\s{2,})(?=(?:[0-9]+(?:\.[0-9]+)+|[0-9]+[.)]|\([a-zA-Z0-9]+\)|(?:Clause|Article|Section|Schedule)\s+[0-9A-Za-z]+)\s+))/gi;

  const splitPoints = new Set<number>([0, text.length]);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > 0 && match.index < text.length) {
      splitPoints.add(match.index);
    }
  }

  const sortedPoints = Array.from(splitPoints).sort((a, b) => a - b);
  const slices: { start: number; end: number; text: string }[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const start = sortedPoints[i];
    const end = sortedPoints[i + 1];
    if (end > start) {
      slices.push({ start, end, text: text.slice(start, end) });
    }
  }

  console.log('Total raw slices:', slices.length);
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const preview = s.text.trim().replace(/\s+/g, ' ').slice(0, 60);
    console.log(`[C${i+1}] (${s.end - s.start} chars): ${preview}`);
  }

  // Check coverage invariant
  const reconstructed = slices.map(s => s.text).join('');
  console.log('Coverage match:', reconstructed === text);
}

const docText = fs.readFileSync('samples/gym-membership-pdf-text.txt', 'utf-8');
testSegmentation(docText);
