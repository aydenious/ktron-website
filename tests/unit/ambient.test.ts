import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rulesOf } from '../helpers/css';

const file = 'src/components/scene/scene.css';
const css = readFileSync(file, 'utf8');
const animates = (decl: Record<string, string>) => 'animation' in decl || 'animation-name' in decl;

describe('rulesOf sees rules inside @media', () => {
  it('returns the rules of a media block and not the block itself', () => {
    const rules = rulesOf('x.css', '@media (a) { .a { animation: x 1s; } .b { color: red; } } .c { top: 0; }');
    expect(rules.map((r) => r.selector)).toEqual(['.a', '.b', '.c']);
    expect(rules[0].decl.animation).toBe('x 1s');
  });
});

describe('ambient loops (spec §3, §7; ruling R12)', () => {
  it('every rule that runs an animation is scoped to the playing stage', () => {
    const animated = rulesOf(file).filter((r) => animates(r.decl));
    expect(animated.length).toBeGreaterThan(0);
    for (const r of animated) expect(r.selector, r.selector).toMatch(/^\[data-stage\]\[data-playing\] /);
  });
  it('keyframes move only opacity and transform', () => {
    const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)].map((m) => m[1]);
    expect(frames).toHaveLength(3);
    for (const body of frames)
      for (const [, prop] of body.matchAll(/([\w-]+)\s*:/g)) expect(['opacity', 'transform']).toContain(prop);
  });
  it('runs the loops only when motion is allowed', () => {
    const m = css.match(/@media \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\n\}/);
    expect(m, 'a no-preference media block').not.toBeNull();
    for (const r of rulesOf(file).filter((x) => animates(x.decl))) expect(m![1], r.selector).toContain(r.selector);
  });
});

describe('scene.css reaches only the scene', () => {
  it('every selector starts from a scene class or id prefix, the stage or a keyframe step, never a bare element', () => {
    const own = /^(\.sc-[\w-]+|\.text-[\w-]+|\.scene \S.*|symbol\[id\^='scene-'\]( text)?|\[data-stage\].*|from|to)$/;
    const bare = rulesOf(file).flatMap((r) => r.selector.split(',').map((x) => x.trim())).filter((x) => !own.test(x));
    expect(bare).toEqual([]);
  });
});
