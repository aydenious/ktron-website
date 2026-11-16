import { describe, expect, it } from 'vitest';
import { checkAgainstBase, compare, countPatterns, hardRules, knipCount } from '../../scripts/quality.mjs';

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
  it('skips id="#fee" but not a colour in an attribute that merely ends in id', () => {
    const c = countPatterns([file('src/a.astro', '<p id="#fee" data-id="#fff" grid="#0B2545">x</p>')]);
    expect(c['pattern.hex_colour_outside_tokens']).toBe(2);
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
  it('counts json, js and svg files for the size ratchet, never svg colours', () => {
    const c = countPatterns([
      file('src/data.json', lines(401)),
      file('scripts/tool.js', 'export const x = 1;'),
      file('public/logo.svg', 'fill="#fff"'),
      file('src/logo.svg', 'fill="#0B2545"'),
    ]);
    expect(c['size.files_over_400_lines']).toBe(1);
    expect(c['pattern.hex_colour_outside_tokens']).toBe(0);
  });
  it.each(['&#169;', '&#8212;', 'url(#bad)', 'href="#add"', 'id="#fee"', '#fee-note', '#deflashing'])(
    'does not take %s for a colour',
    (s) => expect(countPatterns([file('src/a.astro', `x ${s} y`)])['pattern.hex_colour_outside_tokens']).toBe(0),
  );
  it.each(['#fff', '#0B2545', '#0B2545cc'])('counts %s as a colour', (s) =>
    expect(countPatterns([file('src/a.astro', `x ${s} y`)])['pattern.hex_colour_outside_tokens']).toBe(1),
  );
  it('counts colour functions outside tokens.css only', () => {
    const c = countPatterns([
      file('src/a.css', 'a { background: rgb(0 0 0); color: oklch(50% 0.1 20); }'),
      file('src/styles/tokens.css', '--x: rgba(1, 2, 3, 0.5);'),
      file('src/logo.svg', 'fill="rgb(0,0,0)"'),
    ]);
    expect(c['pattern.colour_function_outside_tokens']).toBe(2);
  });
  it('counts comment-only catches and undefined/null/empty arrows as swallowed', () => {
    const c = countPatterns([
      file(
        'src/a.ts',
        'try { f() } catch (e) { /* ignore */ }\n' +
          'try { g() } catch { // noop\n}\n' +
          'const a = () => undefined;\nconst b = () => null;\nconst c = () => {};\n' +
          'const d = () => { /* nothing */ };',
      ),
    ]);
    expect(c['pattern.swallowed_error']).toBe(6);
  });
  it('counts risky DOM writes and eval', () => {
    const c = countPatterns([
      file('src/a.ts', 'el.innerHTML = h; el.outerHTML = h; el.insertAdjacentHTML("beforeend", h); document.write(h); eval(s); new Function("x")'),
      file('scripts/b.mjs', 'el.innerHTML = h;'),
    ]);
    expect(c['pattern.risky_dom']).toBe(7);
  });
  it('counts every skip form', () => {
    const c = countPatterns([
      file('tests/unit/a.test.ts', 'it.skipIf(true)("x", f); it.todo("y"); test.fixme("z"); xit("a", f); xtest("b", f); xdescribe("c", f);'),
    ]);
    expect(c['pattern.test_skip']).toBe(6);
  });
});

describe('checkAgainstBase', () => {
  const history = [{ date: '2026-01-01', change: 'a: new → 0', reason: 'first baseline' }];
  const base = { metrics: { a: 0 }, history };

  it('accepts a rise whose history entry was added in the pull request', () => {
    const head = { metrics: { a: 1 }, history: [...history, { date: '2026-02-02', change: 'a: 0 → 1', reason: 'why it rose' }] };
    expect(checkAgainstBase(base, head)).toEqual([]);
  });
  it('rejects a hand-raised metric and a new metric with no history entry', () => {
    const errors = checkAgainstBase(base, { metrics: { a: 1, b: 0 }, history });
    expect(errors.join('\n')).toContain('a rose from 0 to 1');
    expect(errors.join('\n')).toContain('b rose from new to 0');
  });
  it('rejects a rise whose history entry has no reason', () => {
    const head = { metrics: { a: 1 }, history: [...history, { date: '2026-02-02', change: 'a: 0 → 1', reason: ' ' }] };
    expect(checkAgainstBase(base, head).join('\n')).toContain('has no reason');
  });
  it('rejects an edited base history entry', () => {
    const head = { metrics: { a: 0 }, history: [{ date: '2026-01-01', change: 'a: new → 0', reason: 'because' }] };
    expect(checkAgainstBase(base, head).join('\n')).toContain('history entry 1');
  });
  it('rejects a dropped base history entry', () => {
    expect(checkAgainstBase(base, { metrics: { a: 0 }, history: [] }).join('\n')).toContain('history entry 1');
  });
});
