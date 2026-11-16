import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenValue } from '../../src/styles/token';
import { page } from './dist';

const PAGES = ['/', '/zh/', '/404.html'];
const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

describe.each(PAGES)('%s accessible names', (path) => {
  const doc = page(path);
  it('an aria-label contains the visible text of its link or button (WCAG 2.5.3)', () => {
    const bad = doc.querySelectorAll('a[aria-label], button[aria-label]')
      .filter((el) => squash(el.text) !== '' && !squash(el.getAttribute('aria-label')!).includes(squash(el.text)))
      .map((el) => `${squash(el.text)} -> ${el.getAttribute('aria-label')}`);
    expect(bad).toEqual([]);
  });
  it('the logo is inline, with paths and the name KTRON, and no extra request', () => {
    const logos = doc.querySelectorAll('svg[aria-label="KTRON"]');
    expect(logos.length).toBeGreaterThanOrEqual(path === '/404.html' ? 1 : 2); // header + footer
    for (const svg of logos) expect(svg.querySelectorAll('path').length).toBeGreaterThan(3);
    expect(doc.querySelectorAll('img[src*="logo"]')).toHaveLength(0);
  });
});

describe.each(['/', '/zh/'])('%s language switch', (path) => {
  it('the header and the footer switch are named by their visible text and keep the hash', () => {
    const links = page(path).querySelectorAll('a[hreflang]');
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a.getAttribute('aria-label')).toBeUndefined();
      expect(a.getAttribute('lang')).toBe(a.getAttribute('hreflang'));
      expect(a.hasAttribute('data-keep-hash')).toBe(true);
    }
  });
});

describe('theme-color', () => {
  it('is the navy token', () => {
    const navy = tokenValue(readFileSync('src/styles/tokens.css', 'utf8'), 'navy');
    for (const path of PAGES) expect(page(path).querySelector('meta[name=theme-color]')?.getAttribute('content')).toBe(navy);
  });
});
