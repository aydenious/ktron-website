import { describe, expect, it } from 'vitest';
import { CONTACT, COMPANY } from '../../src/site';

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
});
