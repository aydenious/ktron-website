import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADDRESS, CONTACT, COMPANY } from '../../src/site';

describe('contact constants (gate 4)', () => {
  it('are exact', () => {
    expect(CONTACT.whatsapp).toBe('https://wa.me/60105454173');
    expect(CONTACT.tel).toBe('tel:+60105454173');
    expect(CONTACT.phoneShown).toBe('010-545 4173');
    expect(CONTACT.mailto).toBe('mailto:sales@ktron.my');
    expect(CONTACT.email).toBe('sales@ktron.my');
    expect(CONTACT.address).toBe('Jalan Paprika 5, Taman Pulai Hijauan, 81300 Skudai, Johor');
    expect(COMPANY.line).toBe('Ktron Engineering Enterprise (JM0870519-U)');
  });
  it('the directions link is built from the address', () => {
    expect(CONTACT.directions).toBe(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CONTACT.address)}`);
    expect(new URL(CONTACT.directions).searchParams.get('destination')).toBe(CONTACT.address);
  });
  it('the address parts join to the one-line address', () => {
    expect(`${ADDRESS.street}, ${ADDRESS.postalCode} ${ADDRESS.locality}, ${ADDRESS.region}`).toBe(CONTACT.address);
  });
});

describe('Chinese type outside a Chinese page', () => {
  it('the body of a zh page and any element marked zh get the Chinese font and line height', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).toMatch(/(?:^|\n)body:lang\(zh\), \[lang\^="zh"\]\s*\{[^}]*--font-zh[^}]*line-height:\s*1\.75/);
  });
  it('the rule does not match headings: no bare :lang(zh) selector sets a line height', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/line-height/.test(body)) expect(sel.split(',').map((s) => s.trim()), sel).not.toContain(':lang(zh)');
    }
  });
});
