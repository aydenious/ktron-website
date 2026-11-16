import { describe, expect, it } from 'vitest';
import { compare, countPatterns, hardRules, knipCount } from '../../scripts/quality.mjs';

const file = (path: string, text: string) => ({ path, text });
const lines = (n: number) => 'x\n'.repeat(n);

describe('quality gate', () => {
  it('counts raw colours outside tokens.css only', () => {
    const c = countPatterns([file('src/components/A.astro', 'color: #0B2545; a { color: #fff }'), file('src/styles/tokens.css', '--navy: #0B2545;')]);
    expect(c['pattern.hex_colour_outside_tokens']).toBe(2);
  });
  it('does not take an anchor for a colour', () => {
    expect(countPatterns([file('src/a.astro', '<a href="#deflashing">#faq')])['pattern.hex_colour_outside_tokens']).toBe(0);
  });
  it('counts swallowed errors', () => {
    const c = countPatterns([file('src/a.ts', "p.catch(() => {}); try { f() } catch {} try { g() } catch (e) { }")]);
    expect(c['pattern.swallowed_error']).toBe(3);
  });
  it('counts type escapes and skipped tests', () => {
    const c = countPatterns([file('src/a.ts', 'let a: any; // @ts-ignore'), file('tests/unit/b.test.ts', 'it.skip(); it.only()')]);
    expect(c['pattern.type_escape']).toBe(2);
    expect(c['pattern.test_skip']).toBe(2);
  });
  it('counts files over 400 lines, not at 400', () => {
    const c = countPatterns([file('src/a.ts', lines(400)), file('src/b.ts', lines(401))]);
    expect(c['size.files_over_400_lines']).toBe(1);
  });
  it('compare finds rises, new metrics and falls', () => {
    const { rose, fell } = compare({ a: 1, b: 2, gone: 1 }, { a: 2, b: 1, c: 0 });
    expect(rose).toEqual(['a: 1 → 2', 'c: new → 0']);
    expect(fell).toEqual(['b: 2 → 1', 'gone: 1 → gone']);
  });
  it('hard rules: doc caps, real paths, real scripts, no page imports in components', () => {
    const errors = hardRules({
      docs: [file('docs/x.md', lines(601)), file('CLAUDE.md', '`src/nope.ts` `src/yes.ts` npm run nope npm run test\n' + lines(200))],
      code: [file('src/components/A.astro', "import B from '../pages/index.astro';")],
      scripts: ['test'],
      exists: (p: string) => p === 'src/yes.ts',
    });
    expect(errors).toEqual([
      'docs/x.md: 601 lines; the cap is 600',
      'CLAUDE.md: 201 lines; the cap is 200',
      'CLAUDE.md names src/nope.ts, which does not exist',
      'CLAUDE.md names npm run nope, which package.json does not define',
      'src/components/A.astro imports from src/pages/',
    ]);
  });
  it('knipCount adds files, arrays and object keys', () => {
    expect(knipCount({ files: ['a.ts'], issues: [{ file: 'b.ts', owners: [], exports: [{}, {}], enumMembers: { E: [] } }] })).toBe(4);
  });
});
