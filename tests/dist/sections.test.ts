import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { PHOTO_POSITION } from '../../src/assets/photos';
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
  it('each service card shows its own photo, with its own alt text', () => {
    const imgs = doc.querySelectorAll('#services li img');
    expect(imgs.map((i) => i.getAttribute('alt'))).toEqual(SERVICES.map((k) => s[`photo.${k}.alt` as keyof typeof s]));
  });
  it('the inspection card keeps the microscope in the crop', () => {
    const img = doc.querySelectorAll('#services li img')[SERVICES.indexOf('inspection')];
    expect(img.getAttribute('style')).toContain(`object-position: ${PHOTO_POSITION.inspection}`);
  });
  it('the hero photo is eager and high priority', () => {
    const img = doc.querySelector('#top img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });
  it('every section is named by its heading (aria-labelledby points at an h1 or h2 inside it)', () => {
    for (const section of doc.querySelectorAll('main > section[id]')) {
      const id = section.getAttribute('aria-labelledby');
      expect(id, section.id).toBeTruthy();
      expect(section.querySelector(`h1#${id}, h2#${id}`), section.id).not.toBeNull();
    }
  });
  it('styled lists keep role="list"', () => {
    for (const sel of ['#why ul', '#services ul', '#numbers ul', '#area ul']) expect(doc.querySelector(sel)?.getAttribute('role'), sel).toBe('list');
  });
  it('the scrolling lot record is a focusable, named region', () => {
    const card = doc.querySelector('#traceability .card')!;
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('role')).toBe('region');
    expect(card.getAttribute('aria-label')).toBe(s['trace.mock.scroll']);
    expect(card.hasAttribute('aria-hidden')).toBe(false);
  });
  it('no leftover class="copy"', () => {
    expect(doc.querySelectorAll('.copy')).toHaveLength(0);
  });
  it('the lot record says its data is made up', () => {
    expect(doc.querySelector('#traceability figcaption')?.text).toContain(s['trace.mock.caption']);
  });
});
