import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addedSinceBase, auditProblems, parseAllowlist } from '../../scripts/audit.mjs';

const url = (id: string) => `https://github.com/advisories/${id}`;
const adv = (severity: string, id: string) => ({ source: 1, name: 'pkg', title: `title ${id}`, url: url(id), severity });
// The shape `npm audit --json` writes: package names as strings, advisories as objects, the same
// advisory repeated under every package it reaches.
// A package's severity is the highest of the advisories behind it, as npm writes it.
const report = (...via: { severity?: string; title?: string; url?: string }[]) => {
  const severity = ['critical', 'high', 'moderate', 'low'].find((s) => via.some((v) => v.severity === s)) ?? 'high';
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      picomatch: { name: 'picomatch', severity, via },
      astro: { name: 'astro', severity, via: ['picomatch', ...via] },
    },
  };
};
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
    const [problem, ...rest] = auditProblems(report(adv('high', A)), `${A}  why it is accepted\n${B}  gone for good`);
    expect(rest).toEqual([]);
    expect(problem).toContain(B);
    expect(problem).toMatch(/stale|delete/i);
  });

  it('keeps a listed id that now reports below high stale, because it no longer needs accepting', () => {
    expect(auditProblems(report(adv('moderate', A)), `${A}  why it is accepted`)).toHaveLength(1);
  });

  it('reports one line per problem', () => {
    const problems = auditProblems(report(adv('high', A), adv('critical', B)), `GHSA-gggg-hhhh-iiii  gone for good`);
    expect(problems).toHaveLength(3);
    for (const p of problems) expect(p).not.toContain('\n');
  });

  it('collapses a newline in an advisory title, so a problem stays one line', () => {
    const noisy = { ...adv('high', A), title: 'first\n  second\nthird' };
    const [problem] = auditProblems(report(noisy), '');
    expect(problem).toContain('first second third');
    expect(problem).not.toMatch(/\s\s|\n/);
  });

  it('passes a listed id that is reported at critical under one package', () => {
    const one = { auditReportVersion: 2, vulnerabilities: { solo: { name: 'solo', severity: 'critical', via: [adv('critical', A)] } } };
    expect(auditProblems(one, `${A}  build-time globs only`)).toEqual([]);
  });

  it('fails a report that is not an npm audit result', () => {
    expect(auditProblems({ error: { code: 'ENOTFOUND', summary: 'request failed' } }, '')[0]).toMatch(/ENOTFOUND|request failed/);
    expect(auditProblems({ message: 'connect ECONNREFUSED', error: { summary: '', detail: '' } }, '')[0]).toContain('ECONNREFUSED');
    expect(auditProblems({}, '')).toHaveLength(1);
  });
});

describe('severity fails closed', () => {
  const noSeverity = { title: 'no severity', url: url(A) };
  it.each([
    ['upper case', { ...adv('High', A) }],
    ['a missing severity', noSeverity],
    ['an unknown severity', adv('severe', A)],
  ])('gates an advisory with %s', (_name, via) => {
    expect(auditProblems(report(via), '')).toHaveLength(1);
  });

  it('keeps the highest severity for an id, whichever order npm lists them', () => {
    expect(auditProblems(report(adv('high', A), adv('low', A)), '')).toHaveLength(1);
    expect(auditProblems(report(adv('low', A), adv('high', A)), '')).toHaveLength(1);
  });

  it('does not let two advisories without a url hide each other', () => {
    const bare = (severity: string, title: string) => ({ severity, title });
    expect(auditProblems(report(bare('high', 'one'), bare('low', 'two')), '')).toHaveLength(1);
    expect(auditProblems(report(bare('low', 'two'), bare('high', 'one')), '')).toHaveLength(1);
    expect(auditProblems(report({ severity: 'high' }, { severity: 'low' }), '')[0]).toContain('unknown advisory in');
  });

  it('fails a high vulnerability that reaches no high advisory object', () => {
    const lone = (via: unknown[]) => ({ vulnerabilities: { p: { name: 'p', severity: 'high', via } } });
    expect(auditProblems(lone([]), '')[0]).toContain('p');
    expect(auditProblems(lone(['q']), '')[0]).toContain('p');
    expect(auditProblems(lone([adv('low', A)]), '')[0]).toContain('p');
  });

  it('follows package names through vulnerabilities to the advisory, and survives a cycle', () => {
    const chain = {
      vulnerabilities: {
        astro: { name: 'astro', severity: 'high', via: ['vite'] },
        vite: { name: 'vite', severity: 'high', via: ['astro', 'picomatch'] },
        picomatch: { name: 'picomatch', severity: 'high', via: [adv('high', A)] },
      },
    };
    expect(auditProblems(chain, `${A}  build-time globs only`)).toEqual([]);
    const loop = { vulnerabilities: { a: { name: 'a', severity: 'high', via: ['b'] }, b: { name: 'b', severity: 'high', via: ['a'] } } };
    expect(auditProblems(loop, '')).toHaveLength(2);
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
    ['a one-letter reason', `${A}  x`],
    ['a reason under 10 characters', `${A}  too short`],
    ['a reason with no letter', `${A}  ----------`],
  ])('fails a malformed line: %s', (_name, line) => {
    const { problems } = parseAllowlist(`${line}\n`);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('line 1');
  });

  it('fails an id listed twice', () => {
    expect(parseAllowlist(`${A}  the first reason\n${A}  the second reason\n`).problems).toHaveLength(1);
  });

  it('turns a malformed line into a problem from auditProblems too', () => {
    expect(auditProblems(report(adv('high', A)), `${A}  an accepted reason\nnonsense`)).toHaveLength(1);
  });
});

// A pull request may not accept an advisory for itself: the list is read from the branch it merges into.
describe('addedSinceBase', () => {
  it('fails an id the base list does not have', () => {
    const [problem, ...rest] = addedSinceBase(`${A}  the reason`, `${A}  the reason\n${B}  slipped in`);
    expect(rest).toEqual([]);
    expect(problem).toContain(B);
  });

  it('lets the list shrink or stay the same', () => {
    expect(addedSinceBase(`${A}  the reason\n${B}  the reason`, `${A}  the reason`)).toEqual([]);
    expect(addedSinceBase(`${A}  the reason`, `${A}  reworded reason`)).toEqual([]);
  });

  it('fails every entry when the base has no list: nothing is accepted there yet', () => {
    const problems = addedSinceBase('', `${A}  the reason\n${B}  the reason`, 'origin/old has no audit-allowlist.txt');
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('origin/old has no audit-allowlist.txt');
  });

  it('says that only the owner merges an added entry, past the check', () => {
    expect(addedSinceBase('', `${A}  the reason`)[0]).toMatch(/only the owner merges/);
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
