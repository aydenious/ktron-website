import { describe, expect, it } from 'vitest';
import { page } from './dist';

describe.each(['/', '/zh/'])('%s contact links', (path) => {
  const doc = page(path);
  const hrefs = doc.querySelectorAll('a[href]').map((a) => a.getAttribute('href')!);
  it('every WhatsApp, phone and email link is exact', () => {
    const wa = hrefs.filter((h) => /wa\.me|whatsapp/i.test(h));
    expect(wa.length).toBeGreaterThanOrEqual(2); // contact + floating; Task 7 raises it to 3 (hero)
    expect(new Set(wa)).toEqual(new Set(['https://wa.me/60105454173']));
    expect(new Set(hrefs.filter((h) => h.startsWith('tel:')))).toEqual(new Set(['tel:+60105454173']));
    expect(new Set(hrefs.filter((h) => h.startsWith('mailto:')))).toEqual(new Set(['mailto:sales@ktron.my']));
  });
  it('shows the number, address and registration line', () => {
    const text = doc.querySelector('#contact')!.text;
    expect(text).toContain('010-545 4173');
    expect(text).toContain('Jalan Paprika 5, Taman Pulai Hijauan, 81300 Skudai, Johor');
    expect(text).toContain('Ktron Engineering Enterprise (JM0870519-U)');
  });
});
