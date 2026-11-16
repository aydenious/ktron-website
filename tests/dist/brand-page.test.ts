import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { PICKS } from '../../scripts/pick-logo.mjs';
import { describe, expect, it } from 'vitest';

describe('brand page', () => {
  const doc = parse(readFileSync('dist/brand/index.html', 'utf8'));
  const { pick } = JSON.parse(readFileSync('src/brand/pick.json', 'utf8')) as { pick: string };
  const headings = doc.querySelectorAll('h2').map((h) => h.text.trim());

  it('names the recorded pick in the final-set heading', () => {
    expect(headings.find((h) => h.startsWith('Final set'))).toMatch(new RegExp(`\\(${pick.toUpperCase()},`));
  });
  it('shows every concept once, the pick first, then the rest in order', () => {
    const letters = headings.filter((h) => /^[A-Z]\. \S/.test(h)).map((h) => h[0]);
    expect(headings.join('\n')).not.toMatch(/undefined/);
    expect(letters).toEqual([pick.toUpperCase(), ...PICKS.filter((c) => c !== pick).map((c) => c.toUpperCase())]);
  });
});
