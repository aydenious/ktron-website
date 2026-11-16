import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';

describe('brand page', () => {
  const doc = parse(readFileSync('dist/brand/index.html', 'utf8'));
  const { pick } = JSON.parse(readFileSync('src/brand/pick.json', 'utf8')) as { pick: string };
  const headings = doc.querySelectorAll('h2').map((h) => h.text.trim());

  it('names the recorded pick in the final-set heading', () => {
    expect(headings.find((h) => h.startsWith('Final set'))).toMatch(new RegExp(`\\(${pick.toUpperCase()},`));
  });
  it('shows concept D first, then A, B and C', () => {
    expect(headings.filter((h) => /^[A-D]\. /.test(h)).map((h) => h[0])).toEqual(['D', 'A', 'B', 'C']);
  });
});
