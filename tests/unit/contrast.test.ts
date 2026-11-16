import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenValue } from '../../src/styles/token';

const css = readFileSync('src/styles/tokens.css', 'utf8');

type Rgb = [number, number, number];
/** A token as sRGB; `rgb(r g b / a)` (paper-glass) is blended over navy, the darkest thing behind it. */
function colour(name: string): Rgb {
  const v = tokenValue(css, name);
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb;
  const fn = v.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
  if (!fn) throw new Error(`--${name}: cannot read ${v}`);
  const under = colour('navy');
  return [1, 2, 3].map((i) => Number(fn[i]) * Number(fn[4]) + under[i - 1] * (1 - Number(fn[4]))) as Rgb;
}
const lum = (c: Rgb) => {
  const [r, g, b] = c.map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(colour(a)), lum(colour(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Every foreground/background pair the CSS uses (tokens.css points here). A colour used in
// `color`, `background` or `outline` that is not in a pair here fails the last test.
const TEXT: [string, string, string][] = [
  ['body text', 'slate', 'paper'],
  ['body text in the contact section', 'slate', 'gold-soft'],
  ['headings', 'navy', 'paper'],
  ['headings in the contact section', 'navy', 'gold-soft'],
  ['link', 'navy-2', 'paper'],
  ['link in the contact section', 'navy-2', 'gold-soft'],
  ['header link', 'slate', 'paper-glass'],
  ['language switch and menu', 'navy', 'paper-glass'],
  ['phone menu link', 'slate', 'paper'],
  ['footer text', 'paper', 'navy'],
  ['footer link', 'gold-soft', 'navy'],
  ['skip link', 'paper', 'navy'],
  ['gold button text', 'navy', 'gold'],
];
const NON_TEXT: [string, string, string][] = [
  ['focus ring on the page', 'navy', 'paper'],
  ['focus ring on the header', 'navy', 'paper-glass'],
  ['focus ring on the contact section', 'navy', 'gold-soft'],
  ['focus ring on the footer', 'paper', 'navy'],
  ['gold button boundary on the page', 'navy', 'paper'],
  ['gold button boundary on the contact section', 'navy', 'gold-soft'],
  ['floating WhatsApp glyph on its button', 'navy', 'whatsapp'],
];

describe('contrast (WCAG 2.2 AA)', () => {
  it.each(TEXT)('text: %s is at least 4.5:1', (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it.each(NON_TEXT)('non-text: %s is at least 3:1', (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));

  it('the CSS applies the pairs: navy focus ring, paper ring on navy, bordered gold button, navy glyph', () => {
    const read = (f: string) => readFileSync(f, 'utf8');
    expect(read('src/styles/global.css')).toMatch(/:focus-visible\s*\{\s*outline:\s*3px solid var\(--navy\);\s*outline-offset:\s*2px/);
    expect(read('src/styles/global.css')).toMatch(/\.on-dark :focus-visible\s*\{\s*outline-color:\s*var\(--paper\)/);
    expect(read('src/components/Footer.astro')).toMatch(/class="[^"]*\bon-dark\b/);
    expect(read('src/components/WhatsAppButton.astro')).toMatch(/\.gold\s*\{[^}]*border:\s*1px solid var\(--navy\)/);
    expect(read('src/components/FloatingWhatsApp.astro')).toMatch(/\.float-wa\s*\{[^}]*\bcolor:\s*var\(--navy\)/);
  });

  it('every colour the CSS paints with is in a pair above', () => {
    const declared = new Set([...TEXT, ...NON_TEXT].flatMap(([, a, b]) => [a, b]));
    const files = ['src/styles/global.css', ...readdirRecursive('src/components'), ...readdirRecursive('src/pages'), 'src/layouts/Base.astro'];
    const used = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:^|[;{\s])(?:color|background|background-color|outline|outline-color)\s*:[^;}]*var\(--([\w-]+)\)/g)) used.add(m[1]);
    }
    expect([...used].filter((t) => !declared.has(t))).toEqual([]);
  });
});

function readdirRecursive(dir: string): string[] {
  return readdirSync(dir, { recursive: true }).map((f) => `${dir}/${f}`).filter((f) => /\.(astro|css)$/.test(f));
}
