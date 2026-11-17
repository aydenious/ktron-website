import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { VIEW_W, WORLD_W, camera } from '../../src/components/scene/layout';
import { stateAt } from '../../src/components/scene/steps';

const first = parse(readFileSync('dist/index.html', 'utf8')).querySelector('#how ol[data-stills] svg.scene')!;
const puffs = first.querySelectorAll('[data-amb="smoke"]').map((c) => ({ cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')), r: Number(c.getAttribute('r')) }));
// Where a puff ends up: scene.css's scene-smoke keyframes, read here so a change there moves the guards with it.
const [, dx, dy, grow] = readFileSync('src/components/scene/scene.css', 'utf8').match(/@keyframes scene-smoke[^}]*\}\s*to \{[^}]*translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/)!.map(Number);
const halo = Number(first.querySelector('[data-sun] circle[fill="url(#scene-sun-halo)"]')!.getAttribute('r'));

describe('chimney smoke (world coordinates) against the camera and the sun (view coordinates)', () => {
  it('finds the puffs and the animation it measures', () => {
    expect(puffs).toHaveLength(3);
    expect([dx, dy, grow].every(Number.isFinite) && grow > 1 && halo > 0).toBe(true);
  });
  it('no puff, at its biggest and furthest, reaches the camera maximum: nothing of it shows at the left edge there', () => {
    for (const p of puffs) expect(p.cx + grow * p.r + dx, `puff at ${p.cx},${p.cy}`).toBeLessThan(WORLD_W - VIEW_W);
  });
  it('the sun, its halo included, never meets the smoke, whatever the camera does', () => {
    const left = Math.min(...puffs.flatMap((p) => [p.cx - p.r, p.cx + dx - grow * p.r]));
    const right = Math.max(...puffs.flatMap((p) => [p.cx + p.r, p.cx + dx + grow * p.r]));
    const top = Math.min(...puffs.flatMap((p) => [p.cy - p.r, p.cy + dy - grow * p.r]));
    const bottom = Math.max(...puffs.flatMap((p) => [p.cy + p.r, p.cy + dy + grow * p.r]));
    const hits: string[] = [];
    for (let t = 0; t <= 5.0001; t += 0.05) {
      const s = stateAt(t);
      const view = { left: left - camera(s.vanX), right: right - camera(s.vanX) };
      const nearestX = Math.min(Math.max(s.sunX, view.left), view.right);
      const nearestY = Math.min(Math.max(s.sunY, top), bottom);
      if (Math.hypot(s.sunX - nearestX, s.sunY - nearestY) <= halo) hits.push(t.toFixed(2));
    }
    expect(hits).toEqual([]);
  });
});
