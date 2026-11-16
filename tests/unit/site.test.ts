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
  it('the address parts join to the one-line address', () => {
    expect(`${ADDRESS.street}, ${ADDRESS.postalCode} ${ADDRESS.locality}, ${ADDRESS.region}`).toBe(CONTACT.address);
  });
});

describe('Chinese type outside a Chinese page', () => {
  it('any element in Chinese gets the Chinese font and line height, not only the body of a zh page', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).toMatch(/(?:^|\n):lang\(zh\)\s*\{[^}]*--font-zh[^}]*line-height:\s*1\.75/);
  });
});
