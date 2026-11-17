import { describe, expect, it } from 'vitest';
import { stateAt } from '../../src/components/scene/steps';
import { HOOKS } from '../../src/components/scene/view';

const bindings = Object.entries(HOOKS) as [string, (typeof HOOKS)[keyof typeof HOOKS]][];

describe('what the painter writes (view.ts header)', () => {
  it('every hook writes only transform, opacity or visibility', () => {
    for (const [name, b] of bindings) expect(['transform', 'opacity', 'visibility'], name).toContain(b.attr);
  });
  it('visibility is the one discrete attribute: it is only ever visible or hidden, never in between', () => {
    const seen = new Set<string>();
    for (let t = 0; t <= 5; t += 0.05)
      for (const [name, b] of bindings.filter(([, x]) => x.attr === 'visibility'))
        for (let i = 0; i < 4; i++) seen.add(`${name}=${b.value(stateAt(t), i)}`);
    expect([...seen].filter((v) => !/=(visible|hidden)$/.test(v))).toEqual([]);
    expect(seen.size).toBeGreaterThan(0);
  });
});
