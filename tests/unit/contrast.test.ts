import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenValue } from '../../src/styles/token';
import { markupOf, read, rulesOf, SOURCES, type Rule } from '../helpers/css';

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

// Every foreground/background pair the CSS uses (tokens.css points here). The last describe
// parses the CSS actually shipped and fails on any pair, dark section or light-on-light colour
// that is not covered. This static guard is the fast first line; Task 9 adds the rendered axe check.
type Pair = [name: string, fg: string, bg: string];
const TEXT: Pair[] = [
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
  ['hero text', 'white', 'navy'],
  ['hero sub-line', 'gold-soft', 'navy'],
  ['body text on a white section', 'slate', 'white'],
  ['headings on a white section', 'navy', 'white'],
  ['link on a white section', 'navy-2', 'white'],
  ['text on a paper card in a white section', 'slate', 'paper'],
  ['numbers value', 'gold', 'navy'],
  ['numbers label', 'grey-1', 'navy'],
];
const NON_TEXT: Pair[] = [
  ['focus ring on the page', 'navy', 'paper'],
  ['focus ring on the header', 'navy', 'paper-glass'],
  ['focus ring on the contact section', 'navy', 'gold-soft'],
  ['focus ring on a white section', 'navy', 'white'],
  ['focus ring on a dark section (hero, numbers, footer)', 'paper', 'navy'],
  ['gold button boundary on the page', 'navy', 'paper'],
  ['gold button boundary on the contact section', 'navy', 'gold-soft'],
  ['gold button boundary on a white section', 'navy', 'white'],
  ['gold button border against its own fill', 'navy', 'gold'],
  ['gold button boundary on a dark section (hero)', 'gold', 'navy'],
  ['marker: FAQ triangle on a white section', 'navy', 'white'],
  ['marker: list bullets on the page', 'navy', 'paper'],
  ['floating WhatsApp glyph on its button', 'navy', 'whatsapp'],
  ['floating WhatsApp focus halo (paper) on a dark section', 'paper', 'navy'],
  ['floating WhatsApp focus ring (navy) on a light section', 'navy', 'paper'],
  ['floating WhatsApp focus ring (navy) on the contact section', 'navy', 'gold-soft'],
  ['floating WhatsApp focus ring (navy) on a white section', 'navy', 'white'],
];
// The one rule whose colour on its background is a glyph, not text.
const GRAPHIC_RULES = ['.float-wa'];
// Navy backgrounds that do not carry `.on-dark`, with the reason each is safe.
const NAVY_WITHOUT_ON_DARK: [file: string, selector: string, reason: string][] = [
  ['src/components/Header.astro', '.skip', 'the skip link is a small navy box over the paper header; its ring sits outside it, on paper'],
  ['src/pages/brand.astro', '.tile.navy', 'brand preview page, removed at launch; a logo swatch, not a control'],
];
// Decorative edges: the text or shape beside them, not the line, identifies the thing.
const DECORATIVE_EDGE_TOKENS = ['grey-1', 'grey-2']; // dividers and pill outlines
const DECORATIVE_EDGE_RULES = [['src/components/WhyOutsource.astro', '.close']]; // gold accent bar beside bold text
// Light or mid colours that are only text on a dark section (they are < 4.5:1 on paper and white).
const DARK_ONLY_TEXT = ['gold', 'gold-soft', 'whatsapp', 'grey-1', 'grey-2', 'grey-3', 'white', 'paper'];

const tokenOf = (v: string | undefined) => v?.match(/^var\(--([\w-]+)\)$/)?.[1];
const varsIn = (v: string) => [...v.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1]).filter((n) => { try { colour(n); return true; } catch { return false; } });
const inTable = (a: string, b: string, tables: Pair[]) => tables.some(([, f, g]) => f === a && g === b);
const bgOf = (r: Rule) => tokenOf(r.decl['background-color'] ?? r.decl.background);
const edgesOf = (r: Rule) => Object.entries(r.decl).filter(([k]) => /^(border|outline|box-shadow)/.test(k)).flatMap(([, v]) => varsIn(v));

/** Problems found in a set of rules; empty when the CSS is covered by the tables above. */
function contrastProblems(rules: Rule[], markup: (file: string) => string): string[] {
  const out: string[] = [];
  const darkFile = (f: string) => /class(?::list)?=[^>]*\bon-dark\b/.test(markup(f));
  for (const f of new Set(rules.map((r) => r.file)).values()) {
    if (!darkFile(f)) continue;
    // A dark file is dark from its first element to its last, so the whole-file exemption stays sound.
    const m = markup(f);
    if ((m.match(/\bon-dark\b/g) ?? []).length !== 1 || !/^\s*<[a-z][^>]*\bon-dark\b/i.test(m)) out.push(`${f}: on-dark must be on the root element, once`);
    // Headings take the global navy colour, so each one used in a dark file needs its own light colour.
    for (const tag of new Set([...m.matchAll(/<(h[1-3])\b/g)].map((x) => x[1]))) {
      const light = rules.some((r) => r.file === f && new RegExp(`(^|[\\s,>])${tag}(?![\\w-])`).test(r.selector) && inTable(tokenOf(r.decl.color) ?? '', 'navy', TEXT));
      if (!light) out.push(`${f}: <${tag}> in a dark section has no light colour (it would inherit navy)`);
    }
  }
  for (const r of rules) {
    const where = `${r.file} ${r.selector}`;
    const fg = tokenOf(r.decl.color);
    const bg = bgOf(r);
    if (fg && bg) {
      const graphic = GRAPHIC_RULES.includes(r.selector);
      if (!inTable(fg, bg, graphic ? NON_TEXT : TEXT)) out.push(`${where}: ${fg} on ${bg} is not a ${graphic ? 'graphic' : 'text'} pair`);
    }
    if (bg && !fg && ![...TEXT, ...NON_TEXT].some(([, , b]) => b === bg)) out.push(`${where}: background ${bg} is in no pair`);
    if (bg && (bg === 'navy' || bg === 'navy-2') && !r.selector.includes('.on-dark')) {
      const cls = r.selector.match(/\.([\w-]+)/)?.[1];
      const carried = cls && new RegExp(`class(?::list)?=["{][^"}]*\\b${cls}\\b[^"}]*\\bon-dark\\b|class(?::list)?=["{][^"}]*\\bon-dark\\b[^"}]*\\b${cls}\\b`).test(markup(r.file));
      if (!carried && !NAVY_WITHOUT_ON_DARK.some(([f, s]) => f === r.file && s === r.selector)) out.push(`${where}: navy background without on-dark`);
    }
    if (fg && !bg && (darkFile(r.file) || r.selector.includes('.on-dark')) && !inTable(fg, 'navy', TEXT)) {
      out.push(`${where}: ${fg} text on a dark section is not a pair on navy`);
    }
    if (fg && r.selector.includes('::marker') && !NON_TEXT.some(([n, f]) => /^marker/.test(n) && f === fg)) out.push(`${where}: marker colour ${fg} is in no marker pair`);
    if (fg && DARK_ONLY_TEXT.includes(fg) && !r.selector.includes('.on-dark') && !darkFile(r.file) && !(bg && inTable(fg, bg, TEXT))) {
      out.push(`${where}: ${fg} text outside a dark section`);
    }
    for (const e of edgesOf(r)) {
      if (DECORATIVE_EDGE_TOKENS.includes(e) || DECORATIVE_EDGE_RULES.some(([f, s]) => f === r.file && s === r.selector)) continue;
      if (bg ? !(inTable(e, bg, TEXT) || inTable(e, bg, NON_TEXT)) : ![...TEXT, ...NON_TEXT].some(([, f]) => f === e)) out.push(`${where}: edge ${e}${bg ? ` on ${bg}` : ''} is in no pair`);
    }
  }
  return out;
}

describe('contrast (WCAG 2.2 AA)', () => {
  it.each(TEXT)('text: %s is at least 4.5:1', (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it.each(NON_TEXT)('non-text: %s is at least 3:1', (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));

  it('the CSS applies the focus rings: navy, paper on dark, and a halo plus ring on the floating button', () => {
    const global = read('src/styles/global.css');
    expect(global).toMatch(/:focus-visible\s*\{\s*outline:\s*3px solid var\(--navy\);\s*outline-offset:\s*2px/);
    expect(global).toMatch(/\.on-dark :focus-visible\s*\{\s*outline-color:\s*var\(--paper\)/);
    const float = rulesOf('src/components/FloatingWhatsApp.astro').find((r) => r.selector === '.float-wa:focus-visible');
    expect(float?.decl.outline).toBe('3px solid var(--navy)');
    expect(float?.decl['box-shadow']).toMatch(/0 0 0 2px var\(--paper\)/);
    expect(rulesOf('src/components/WhatsAppButton.astro').find((r) => r.selector === '.gold')?.decl.border).toBe('1px solid var(--navy)');
  });

  describe('the CSS in src', () => {
    const rules = SOURCES.flatMap((f) => rulesOf(f));
    it('sees the rules', () => expect(rules.length).toBeGreaterThan(50));
    it('has no pair, dark section, light-on-light text or edge outside the tables', () => {
      expect(contrastProblems(rules, markupOf)).toEqual([]);
    });
  });

  describe('the guard itself', () => {
    // `markup` is the attributes of one root element, or a full fragment starting with `<`.
    const fake = (file: string, style: string, attrs = '') => ({
      rules: rulesOf(file, `<style>${style}</style>`),
      markup: () => (attrs.startsWith('<') ? attrs : `<section ${attrs}></section>`),
    });
    const run = (style: string, markup = '', file = 'src/components/X.astro') => {
      const f = fake(file, style, markup);
      return contrastProblems(f.rules, f.markup);
    };
    it('flags a colour pair that is not in the table', () => {
      expect(run('.a { color: var(--gold); background: var(--paper); }', 'class="a"')).not.toEqual([]);
    });
    it('flags a navy section without on-dark, and accepts one that carries it', () => {
      expect(run('.hero { background: var(--navy); color: var(--paper); }', 'class="hero"')).toHaveLength(1);
      expect(run('.hero { background: var(--navy); color: var(--paper); }', 'class="hero on-dark"')).toEqual([]);
    });
    it('flags gold text outside a dark section', () => {
      expect(run('li::marker { color: var(--gold); }', 'class="x"')).not.toEqual([]);
      expect(run('strong { color: var(--gold); }', 'class="x on-dark"')).toEqual([]);
    });
    it('flags dark text in a dark section, and a heading that would inherit navy', () => {
      expect(run('span { color: var(--navy); }', 'class="a on-dark"')).toHaveLength(1);
      expect(run('span { color: var(--grey-1); }', 'class="a on-dark"')).toEqual([]);
      expect(run('h2 { color: var(--white); }', '<section class="a on-dark"><h2>x</h2></section>')).toEqual([]);
      expect(run('p { color: var(--white); }', '<section class="a on-dark"><h2>x</h2></section>')).toHaveLength(1);
    });
    it('flags white or paper text outside a dark section, unless the rule sets a dark background', () => {
      expect(run('p { color: var(--white); }', 'class="a"')).toHaveLength(1);
      expect(run('.skip { color: var(--paper); background: var(--navy); }', 'class="skip on-dark"')).toEqual([]);
    });
    it('a dark file has on-dark once, on its root element', () => {
      expect(run('p { color: var(--white); }', '<section class="a on-dark"><div class="b on-dark"></div></section>')).toHaveLength(1);
      expect(run('p { color: var(--white); }', '<div><section class="a on-dark"></section></div>')).toHaveLength(1);
    });
    it('covers ::marker colours: a marker needs a marker pair', () => {
      expect(run('li::marker { color: var(--navy); }', 'class="x"')).toEqual([]);
      expect(run('li::marker { color: var(--slate); }', 'class="x"')).toHaveLength(1);
    });
    it('flags a border or shadow colour that is in no pair', () => {
      expect(run('.a { border: 1px solid var(--whatsapp); background: var(--paper); }', 'class="a"')).toHaveLength(1);
      expect(run('.a { box-shadow: 0 0 0 2px var(--grey-3); }', 'class="a"')).toHaveLength(1);
    });
    it('flags a background that no pair covers', () => {
      expect(run('.a { background: var(--grey-2); }', 'class="a"')).toHaveLength(1);
    });
  });
});
