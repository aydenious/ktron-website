import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { STILLS } from '../../src/components/scene/steps';
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
    expect(shown(0, '[data-van-crate]')).toBe(3);
    expect(shown(1, '[data-house-crate]')).toBe(4);
    expect(attr(2, '[data-night]', 'opacity')).toBe('0.85');
    expect(attr(3, '[data-lens]', 'opacity')).toBe('1');
    expect(attr(3, '[data-world]', 'transform')).toBe('translate(-240 0)');
    expect(shown(4, '[data-dock-crate]')).toBe(3);
  });
  it('each still shows what its model state says and nothing else', () => {
    STILLS.forEach((state, i) => {
      expect(shown(i, '[data-van-crate]'), `still ${i + 1} van crates`).toBe(state.vanCrates);
      expect(shown(i, '[data-house-crate]'), `still ${i + 1} house crates`).toBe(state.houseCrates.filter(Boolean).length);
      expect(shown(i, '[data-dock-crate]'), `still ${i + 1} dock crates`).toBe(state.dockCrates);
    });
  });
  it('only the third still is at night, and the windows are lit as the model says (still 2 has all four lit)', () => {
    for (const i of [0, 1, 3, 4]) {
      expect(attr(i, '[data-night]', 'opacity'), `still ${i + 1}`).toBe('0');
      expect(attr(i, '[data-stars]', 'opacity'), `still ${i + 1}`).toBe('0');
    }
    expect(attr(2, '[data-stars]', 'opacity')).toBe('1');
    const lit = (i: number) => steps[i].querySelectorAll('[data-lit]').filter((e) => e.getAttribute('opacity') === '1').length;
    STILLS.forEach((state, i) => expect(lit(i), `still ${i + 1} lit windows`).toBe(state.lit.filter((v) => v === 1).length));
    expect(lit(1)).toBe(4);
    expect(steps.map((_, i) => attr(i, '[data-lens]', 'opacity'))).toEqual(['0', '0', '0', '1', '0']);
  });
  it('the van body faces as the model says, and the KTRON name is never inside the flipped group', () => {
    STILLS.forEach((_, i) => {
      expect(steps[i].querySelectorAll('[data-van-body] text'), `still ${i + 1} text in the van body`).toHaveLength(0);
      expect(steps[i].querySelector('[data-van] > text')?.text, `still ${i + 1} van name`).toBe('KTRON');
    });
  });
});
