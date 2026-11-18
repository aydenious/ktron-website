import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addedSinceBase, auditProblems, parseAllowlist } from '../../scripts/audit.mjs';

const url = (id: string) => `https://github.com/advisories/${id}`;
const adv = (severity: string, id: string) => ({ source: 1, name: 'pkg', title: `title ${id}`, url: url(id), severity });
// The shape `npm audit --json` writes: package names as strings, advisories as objects, the same
// advisory repeated under every package it reaches.
const report = (...via: object[]) => ({
  auditReportVersion: 2,
  vulnerabilities: {
    picomatch: { name: 'picomatch', severity: 'high', via },
    astro: { name: 'astro', severity: 'high', via: ['picomatch', ...via] },
  },
});
const A = 'GHSA-aaaa-bbbb-cccc';
const B = 'GHSA-dddd-eeee-ffff';

describe('the accepted-advisory list', () => {
  it('lets a listed high advisory pass, however many packages report it', () => {
    expect(auditProblems(report(adv('high', A)), `${A}  build-time globs only`)).toEqual([]);
  });

  it('fails an unlisted high advisory, and names it', () => {
    const [problem, ...rest] = auditProblems(report(adv('high', A)), '');
    expect(rest).toEqual([]);
    expect(problem).toContain(A);
  });

  it('fails an unlisted critical advisory', () => {
    expect(auditProblems(report(adv('critical', A)), '')).toHaveLength(1);
  });

  it('ignores an unlisted moderate or low advisory, as --audit-level=high did', () => {
    expect(auditProblems(report(adv('moderate', A), adv('low', B)), '')).toEqual([]);
  });

  it('fails a listed id that is no longer reported, so the entry gets deleted', () => {
    const [problem, ...rest] = auditProblems(report(adv('high', A)), `${A}  why\n${B}  gone`);
    expect(rest).toEqual([]);
    expect(problem).toContain(B);
    expect(problem).toMatch(/stale|delete/i);
  });

  it('keeps a listed id that now reports below high stale, because it no longer needs accepting', () => {
    expect(auditProblems(report(adv('moderate', A)), `${A}  why`)).toHaveLength(1);
  });

  it('reports one line per problem', () => {
    const problems = auditProblems(report(adv('high', A), adv('critical', B)), `GHSA-gggg-hhhh-iiii  gone`);
    expect(problems).toHaveLength(3);
    for (const p of problems) expect(p).not.toContain('\n');
  });

  it('fails a report that is not an npm audit result', () => {
    expect(auditProblems({ error: { code: 'ENOTFOUND', summary: 'request failed' } }, '')[0]).toMatch(/ENOTFOUND|request failed/);
    expect(auditProblems({ message: 'connect ECONNREFUSED', error: { summary: '', detail: '' } }, '')[0]).toContain('ECONNREFUSED');
    expect(auditProblems({}, '')).toHaveLength(1);
  });
});

describe('parseAllowlist', () => {
  it('reads ids and reasons, skipping comments and blank lines', () => {
    const text = `# header\n\n${A}  the reason\n   \n  # indented comment\n${B} another reason\n`;
    expect(parseAllowlist(text)).toEqual({ ids: [A, B], problems: [] });
  });

  it.each([
    ['no reason', A],
    ['a lowercase prefix', `ghsa-aaaa-bbbb-cccc  why`],
    ['a short id', 'GHSA-aaaa-bbbb  why'],
    ['no id', 'just words'],
  ])('fails a malformed line: %s', (_name, line) => {
    const { problems } = parseAllowlist(`${line}\n`);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('line 1');
  });

  it('fails an id listed twice', () => {
    expect(parseAllowlist(`${A}  one\n${A}  two\n`).problems).toHaveLength(1);
  });

  it('turns a malformed line into a problem from auditProblems too', () => {
    expect(auditProblems(report(adv('high', A)), `${A}  ok\nnonsense`)).toHaveLength(1);
  });
});

// A pull request may not accept an advisory for itself: the list is read from the branch it merges into.
describe('addedSinceBase', () => {
  it('fails an id the base list does not have', () => {
    const [problem, ...rest] = addedSinceBase(`${A}  reason`, `${A}  reason\n${B}  slipped in`);
    expect(rest).toEqual([]);
    expect(problem).toContain(B);
  });

  it('lets the list shrink or stay the same', () => {
    expect(addedSinceBase(`${A}  reason\n${B}  reason`, `${A}  reason`)).toEqual([]);
    expect(addedSinceBase(`${A}  reason`, `${A}  reworded reason`)).toEqual([]);
  });

  it('skips the check when the base has no list yet (the one PR that adds the file)', () => {
    expect(addedSinceBase(null, `${A}  reason`)).toEqual([]);
  });
});

describe('the real list and its wiring', () => {
  it('audit-allowlist.txt parses with no problems and starts with the picomatch advisory', () => {
    const { ids, problems } = parseAllowlist(readFileSync('audit-allowlist.txt', 'utf8'));
    expect(problems).toEqual([]);
    expect(ids[0]).toBe('GHSA-fc5q-39xc-vjpf');
  });

  it('package.json has an audit script that runs the gate', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.audit).toBe('node scripts/audit.mjs');
  });

  it('the CI quality job runs the gate, not a bare npm audit', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('- run: node scripts/audit.mjs --base "origin/$BASE_REF"');
    expect(ci).not.toMatch(/npm audit/);
  });
});
