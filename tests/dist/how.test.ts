import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { page } from './dist';

describe.each([['/', en], ['/zh/', zh]] as const)('%s how it works stills', (path, s) => {
  const steps = page(path).querySelectorAll('#how ol[data-stills] > li[data-step]');
  const shown = (i: number, sel: string) =>
    steps[i].querySelectorAll(sel).filter((e) => e.getAttribute('visibility') === 'visible').length;
  const attr = (i: number, sel: string, a: string) => steps[i].querySelector(sel)?.getAttribute(a);

  it('five stills, each with its counter and caption as page text', () => {
    expect(steps).toHaveLength(5);
    steps.forEach((li, i) => {
      expect(li.getAttribute('data-step')).toBe(String(i + 1));
      expect(li.querySelector('[data-counter]')?.text).toBe(s['how.counter'].replace('{n}', String(i + 1)));
      expect(li.querySelector('[data-caption]')?.text).toBe(s[`how.${i + 1}` as keyof typeof s]);
      expect(li.querySelector('svg.scene')).not.toBeNull();
    });
  });
  it('the drawing labels the factory and the van, never the captions', () => {
    const svg = steps[0].querySelector('svg')!.text;
    expect(svg).toContain(s['scene.factory']);
    expect(svg).toContain('KTRON');
    for (const n of [1, 2, 3, 4, 5]) expect(svg).not.toContain(s[`how.${n}` as keyof typeof s]);
  });
  it('each still shows its moment', () => {
    expect(shown(0, '[data-van-crate]')).toBe(4);
    expect(shown(1, '[data-house-crate]')).toBe(4);
    expect(attr(2, '[data-night]', 'opacity')).toBe('0.85');
    expect(attr(3, '[data-lens]', 'opacity')).toBe('1');
    expect(attr(3, '[data-world]', 'transform')).toBe('translate(-240 0)');
    expect(shown(4, '[data-factory-crate]')).toBe(4);
  });
});
