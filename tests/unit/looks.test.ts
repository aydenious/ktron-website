import { describe, expect, it } from 'vitest';
import { LOOKS, type Look } from '../../src/components/scene/parts/looks';
import { read, rulesOf } from '../helpers/css';

const rules = rulesOf('src/components/scene/scene.css');
const BRAND = ['gold', 'gold-soft', 'navy', 'navy-2', 'white', 'slate', 'grey-1', 'grey-2', 'grey-3'];
const all: Look[] = [...LOOKS.residents, LOOKS.driver, LOOKS.qc];

describe('the looks', () => {
  it('names only classes that scene.css fills from a --scene-* or brand token', () => {
    for (const look of all) {
      for (const cls of [look.skin, look.shirt, look.trousers]) {
        const fill = rules.find((r) => r.selector === `.${cls}`)?.decl.fill;
        const name = fill?.match(/^var\(--([\w-]+)\)$/)?.[1];
        expect(name, `.${cls} in scene.css`).toBeDefined();
        expect(name!.startsWith('scene-') || BRAND.includes(name!), `.${cls} uses --${name}`).toBe(true);
      }
    }
  });
  it('gives every person a different skin', () => {
    expect(new Set(all.map((l) => l.skin)).size).toBe(all.length);
  });
  it('dresses the driver in a cap with the shirt print, the inspector in a coat, and the residents in neither', () => {
    expect(LOOKS.driver).toMatchObject({ hair: 'cap', print: true });
    expect(LOOKS.qc.coat).toBe(true);
    for (const l of LOOKS.residents) expect([l.coat, l.print]).toEqual([undefined, undefined]);
    expect(LOOKS.residents.map((l) => l.hair)).toEqual(['short', 'scarf', 'bun', 'short']);
  });
  it('hides everything inside a hidden group, so a hidden walker keeps no arms or crate showing', () => {
    expect(rules.find((r) => r.selector === ".scene [visibility='hidden'] *")?.decl.visibility).toBe('hidden');
  });
  it('has no hex colour in scene.css', () => {
    expect(read('src/components/scene/scene.css')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
