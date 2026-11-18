import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The guard for the whole class (owner, 2026-11-18): the page scrolls as if every section were a still image.
// Changing this test is how scroll-jacking comes back on purpose; nothing else should.
const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.(astro|ts|css|mjs)$/.test(f))
  .map((f) => [`src/${f}`, readFileSync(`src/${f}`, 'utf8')] as const);

const BANNED: [what: string, re: RegExp][] = [
  ['an import of ScrollTrigger', /ScrollTrigger|scrollTrigger/],
  ['a pin (gsap pin, pinSpacing, a pin-spacer)', /\bpin(Spacing|Type)?\s*:|pin-spacer/],
  ['scroll snapping (a snap option or CSS scroll-snap)', /\bsnap\s*:|\bsnapTo\b|scroll-snap/],
  ['a wheel or touchmove listener written out by name', /addEventListener\(\s*['"](wheel|touchmove)['"]/],
  ['a preventDefault on a scroll-making event', /(wheel|touchmove)[^;\n]*preventDefault/],
];

describe('no scroll-jacking in src', () => {
  it('sees the source', () => expect(files.length).toBeGreaterThan(30));
  it.each(BANNED)('has no %s', (_what, re) => {
    expect(files.filter(([, text]) => re.test(text)).map(([f]) => f)).toEqual([]);
  });
});
