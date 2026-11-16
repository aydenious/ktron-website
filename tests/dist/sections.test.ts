import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { page } from './dist';

const ORDER = ['top', 'why', 'services', 'traceability', 'numbers', 'quality', 'area', 'faq', 'contact'];
const SERVICES = ['trimming', 'deflashing', 'inspection', 'sorting', 'rework'] as const;

describe.each([['/', en], ['/zh/', zh]] as const)('%s sections', (path, s) => {
  const doc = page(path);
  const text = (sel: string) => doc.querySelectorAll(sel).map((e) => e.text.trim());
  it('sections are in PRD order', () => {
    expect(doc.querySelectorAll('main > section[id]').map((e) => e.id)).toEqual(ORDER);
  });
  it('one h1, the headline', () => {
    expect(text('h1')).toEqual([s['hero.title']]);
  });
  it('five service cards with their names', () => {
    expect(text('#services h3')).toEqual(SERVICES.map((k) => s[`services.${k}.name`]));
    expect(doc.querySelectorAll('#services img')).toHaveLength(5);
  });
  it('every image has alt text in this language, width and height', () => {
    const alts = Object.entries(s).filter(([k]) => /^photo\..+\.alt$/.test(k)).map(([, v]) => v);
    const imgs = doc.querySelectorAll('main img');
    expect(imgs.length).toBeGreaterThanOrEqual(7);
    for (const img of imgs) {
      expect(alts).toContain(img.getAttribute('alt'));
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
    }
  });
  it('only the hero photo loads eagerly', () => {
    const eager = doc.querySelectorAll('main img').filter((i) => i.getAttribute('loading') !== 'lazy');
    expect(eager.map((i) => i.getAttribute('alt'))).toEqual([s['photo.hero.alt']]);
  });
  it('five numbers, four questions, eight places, directions', () => {
    expect(doc.querySelectorAll('#numbers li')).toHaveLength(5);
    expect(text('#faq summary')).toEqual([1, 2, 3, 4].map((n) => s[`faq.${n}.q` as keyof typeof s]));
    expect(doc.querySelectorAll('#area li')).toHaveLength(8);
    expect(doc.querySelector('#area a[href^="https://www.google.com/maps/"]')?.text.trim()).toBe(s['area.directions']);
  });
  it('the lot record says its data is made up', () => {
    expect(doc.querySelector('#traceability figcaption')?.text).toContain(s['trace.mock.caption']);
  });
});
