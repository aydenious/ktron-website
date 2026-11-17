import { readFileSync } from 'node:fs';
import { parse, type HTMLElement } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { painter } from '../../src/components/scene/paint';
import { STILLS } from '../../src/components/scene/steps';
import { HOOKS } from '../../src/components/scene/view';

const pages = ['dist/index.html', 'dist/zh/index.html'];
const stills = (file: string) => parse(readFileSync(file, 'utf8')).querySelectorAll('#how ol[data-stills] svg.scene');
const hooked = (svg: HTMLElement) =>
  Object.keys(HOOKS).flatMap((h) => svg.querySelectorAll(`[data-${h}]`).map((el) => [h, el] as const));
const written = (svg: HTMLElement) =>
  hooked(svg).map(([h, el]) => `${h}${el.getAttribute(`data-${h}`)}=${el.getAttribute(HOOKS[h as keyof typeof HOOKS].attr)}`);

describe.each(pages)('%s scene', (file) => {
  it('draws each gradient and clip once, outside the stills, and every url(#…) resolves', () => {
    const html = readFileSync(file, 'utf8');
    const root = parse(html);
    expect(root.querySelectorAll('#how ol[data-stills] [id]')).toHaveLength(0);
    for (const ref of new Set([...html.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]))) expect(root.querySelectorAll(`#${ref}`), ref).toHaveLength(1);
  });
  it('every hooked attribute in every still is the model value at that still', () => {
    stills(file).forEach((svg, k) => {
      for (const [h, el] of hooked(svg)) {
        const b = HOOKS[h as keyof typeof HOOKS];
        expect(el.getAttribute(b.attr), `${h}=${el.getAttribute(`data-${h}`)} in still ${k + 1}`).toBe(String(b.value(STILLS[k], Number(el.getAttribute(`data-${h}`)))));
      }
    });
  });
  it("painting a still's moment onto still 1 gives that still, attribute for attribute", () => {
    const all = stills(file);
    STILLS.forEach((s, k) => {
      const copy = parse(all[0].outerHTML).querySelector('svg')!;
      painter(copy)(s);
      expect(written(copy)).toEqual(written(all[k]));
    });
  });
  it('has the sky layers, the factory door and the dock crates', () => {
    for (const h of ['sunset', 'dawn', 'night', 'sun', 'moon', 'moon-rise', 'stars', 'factory-door', 'wash']) expect(stills(file)[0].querySelectorAll(`[data-${h}]`).length, h).toBeGreaterThan(0);
    expect(stills(file)[0].querySelectorAll('[data-dock-crate]')).toHaveLength(4);
  });
});
