import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parse, type HTMLElement } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { painter } from '../../src/components/scene/paint';
import { CLIP } from '../../src/components/scene/scroll';
import { STILLS, stateAt } from '../../src/components/scene/steps';
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
  it('draws four houses with their own door, lit window and table crate, and five walkers', () => {
    const svg = stills(file)[0];
    for (const h of ['house-door', 'lit', 'house-crate', 'resident', 'resident-show', 'resident-face', 'resident-crate', 'resident-arms', 'resident-leg-a', 'resident-leg-b'])
      expect(svg.querySelectorAll(`[data-${h}]`).map((el) => el.getAttribute(`data-${h}`)).sort(), h).toEqual(['0', '1', '2', '3']);
    for (const h of ['driver', 'driver-show', 'driver-face', 'driver-crate', 'driver-arms', 'driver-leg-a', 'driver-leg-b'])
      expect(svg.querySelectorAll(`[data-${h}]`), h).toHaveLength(1);
  });
  it('shows the driver carrying a crate in front of the factory in the last still', () => {
    const last = stills(file)[4];
    expect(last.querySelector('[data-driver-show]')!.getAttribute('visibility')).toBe('visible');
    expect(last.querySelector('[data-driver-crate]')!.getAttribute('visibility')).toBe('visible');
    expect(last.querySelector('[data-driver]')!.getAttribute('transform')).toBe('translate(190 316)');
  });
  it('draws one glow rect per house and puts no hook on it', () => {
    const svg = stills(file)[0];
    for (const el of svg.querySelectorAll('rect[fill="url(#scene-lit-glow)"]')) expect(Object.keys(el.attributes).filter((a) => a.startsWith('data-') && a.slice(5) in HOOKS)).toEqual([]);
    expect(svg.querySelectorAll('rect[fill="url(#scene-lit-glow)"]')).toHaveLength(4);
  });
  it('has the sky layers, the factory door and the dock crates', () => {
    for (const h of ['sunset', 'dawn', 'night', 'sun', 'moon', 'moon-rise', 'stars', 'factory-door', 'wash']) expect(stills(file)[0].querySelectorAll(`[data-${h}]`).length, h).toBeGreaterThan(0);
    expect(stills(file)[0].querySelectorAll('[data-dock-crate]')).toHaveLength(4);
  });
  it('draws the inspection house, the van and its load, and every wash', () => {
    const svg = stills(file)[0];
    for (const h of ['qc-glow', 'lens', 'tick', 'van', 'van-body', 'headlight', 'van-load']) expect(svg.querySelectorAll(`[data-${h}]`), h).toHaveLength(1);
    expect(svg.querySelectorAll('[data-wheel]')).toHaveLength(2);
    expect(svg.querySelectorAll('[data-van-crate]')).toHaveLength(4);
    expect(svg.querySelectorAll('[data-wash]').map((el) => el.getAttribute('data-wash')).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    expect(svg.querySelector('[data-van-body] text')).toBeNull();
  });
  it('writes at most 60 attributes in any 60 fps frame and uses no filter or mask', () => {
    const svg = stills(file)[0];
    let writes = 0;
    const paint = painter({
      querySelectorAll: (q: string) =>
        svg.querySelectorAll(q).map((el) => ({
          getAttribute: (a: string) => el.getAttribute(a),
          setAttribute: (a: string, v: string) => {
            writes++;
            el.setAttribute(a, v);
          },
        })),
    });
    paint(stateAt(0));
    for (let step = 0; step < 5; step++)
      for (let f = 1, n = Math.round(CLIP[step] * 60); f <= n; f++) {
        writes = 0;
        paint(stateAt(step + f / n));
        expect(writes, `t ${(step + f / n).toFixed(3)}`).toBeLessThanOrEqual(60);
      }
    expect(svg.querySelectorAll('filter, mask, [filter], [mask]')).toHaveLength(0);
  });
  it('has no SVG filter, mask or blur anywhere on the page', () => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/<filter\b|<mask\b|feGaussianBlur|\bfilter\s*[:=]|\bmask\s*[:=]/);
  });
  it('keeps ambient markers and hooks on different elements (R12)', () => {
    for (const svg of stills(file))
      for (const el of svg.querySelectorAll('[data-amb]'))
        expect(Object.keys(el.attributes).filter((a) => a.startsWith('data-') && a.slice(5) in HOOKS), el.toString().slice(0, 80)).toEqual([]);
  });
  it('marks the stars, the smoke and the four lit glows for the ambient loops, all inline in every still', () => {
    for (const svg of stills(file)) {
      expect(svg.querySelectorAll('[data-amb="twinkle"]')).toHaveLength(16);
      expect(svg.querySelectorAll('[data-amb="smoke"]')).toHaveLength(3);
      expect(svg.querySelectorAll('[data-amb="pulse"]')).toHaveLength(4);
    }
  });
  it('stays light: the gzipped page is at most 30 KB', () => {
    expect(gzipSync(readFileSync(file)).length).toBeLessThanOrEqual(30 * 1024);
  });
  it('shares static drawing through symbols: every <use href> names a symbol on the page and no hook sits in a symbol', () => {
    const root = parse(readFileSync(file, 'utf8'));
    const symbols = root.querySelectorAll('symbol');
    expect(symbols.length).toBeGreaterThan(0);
    const ids = symbols.map((el) => el.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
    const uses = root.querySelectorAll('use');
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) expect(ids, use.outerHTML.slice(0, 80)).toContain(use.getAttribute('href')?.replace(/^#/, ''));
    for (const sym of symbols) {
      const marked = [sym, ...sym.querySelectorAll('*')].filter((el) => Object.keys(el.attributes).some((a) => a.startsWith('data-')));
      expect(marked.map((el) => el.outerHTML.slice(0, 60)), `data attributes inside #${sym.getAttribute('id')}`).toEqual([]);
    }
  });
});
