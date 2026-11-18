// Runs the real gate the way CI does: node scripts/audit.mjs, in a throwaway git repo, with a stub `npm`
// first on PATH that prints a fixture instead of calling the registry.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/audit.mjs');
const A = 'GHSA-aaaa-bbbb-cccc';
const B = 'GHSA-dddd-eeee-ffff';
const LIST = (...ids: string[]) => `${ids.map((id) => `${id}  build-time globs only, no fixed release`).join('\n')}\n`;
const advisory = (id: string) => ({ severity: 'high', title: `title ${id}`, url: `https://github.com/advisories/${id}` });
const report = (...ids: string[]) => JSON.stringify({ auditReportVersion: 2, vulnerabilities: { pkg: { name: 'pkg', severity: 'high', via: ids.map(advisory) } } });

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]) {
  execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', ...args], { cwd: dir, stdio: 'ignore' });
}

/** A repo with a stub npm. `base` is the list committed as HEAD (undefined: HEAD has no list), `list` the working copy. */
function repo({ list, base, stdout = report(A), exit = 0 }: { list: string; base?: string; stdout?: string; exit?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-cli-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'npm-audit.out'), stdout);
  writeFileSync(join(dir, 'bin/npm'), `#!/bin/sh\ncat "${dir}/npm-audit.out"\nexit ${exit}\n`);
  chmodSync(join(dir, 'bin/npm'), 0o755);
  git(dir, 'init', '-q');
  writeFileSync(join(dir, 'README'), 'fixture\n');
  if (base !== undefined) writeFileSync(join(dir, 'audit-allowlist.txt'), base);
  git(dir, 'add', 'README', ...(base === undefined ? [] : ['audit-allowlist.txt']));
  git(dir, 'commit', '-q', '-m', 'base');
  writeFileSync(join(dir, 'audit-allowlist.txt'), list);
  return dir;
}

function run(dir: string, ...args: string[]) {
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` };
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('audit CLI', () => {
  it('exits 0 and names what it accepted', () => {
    const r = run(repo({ list: LIST(A) }));
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`audit ok (1 accepted: ${A})`);
  });

  it('exits 1 on an advisory the list does not name', () => {
    const r = run(repo({ list: LIST(), stdout: report(A) }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(A);
  });

  it('exits 1 on a stale entry', () => {
    const r = run(repo({ list: LIST(A, B) }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${B} is on audit-allowlist.txt`);
  });

  describe('arguments: only --base <ref> is accepted', () => {
    it.each([
      ['--base=HEAD', ['--base=HEAD']],
      ['an unknown argument', ['--bse', 'HEAD']],
      ['a stray argument', ['HEAD']],
      ['--base with no value', ['--base']],
      ['--base with an option as its value', ['--base', '--foo']],
      ['--base twice', ['--base', 'HEAD', '--base', 'HEAD']],
    ])('exits 1 on %s, and runs no check', (_name, args) => {
      const r = run(repo({ list: LIST(A), base: LIST(A) }), ...args);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('--base <ref>');
      expect(r.stdout).toBe('');
    });
  });

  it('says a bad ref is not a commit, with no stack trace', () => {
    const r = run(repo({ list: LIST(A), base: LIST(A) }), '--base', 'origin/nope');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--base origin/nope is not a commit in this repository');
    expect(r.stderr).not.toMatch(/TypeError|\n\s+at /);
  });

  it('fails every entry when the base commit has no list', () => {
    const r = run(repo({ list: LIST(A) }), '--base', 'HEAD');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${A} is not on audit-allowlist.txt`);
    expect(r.stderr).toContain('(HEAD has no audit-allowlist.txt)');
  });

  it('passes when the base has the same list', () => {
    const r = run(repo({ list: LIST(A), base: LIST(A) }), '--base', 'HEAD');
    expect(r.status, r.stderr).toBe(0);
  });

  it('fails an entry added since the base, and says who merges it', () => {
    const r = run(repo({ list: LIST(A, B), base: LIST(A), stdout: report(A, B) }), '--base', 'HEAD');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${B} is not on audit-allowlist.txt`);
    expect(r.stderr).toContain('only the owner merges');
    expect(r.stderr).not.toContain(`${A} is not on`);
  });

  it('exits 1 when npm prints something that is not JSON', () => {
    const r = run(repo({ list: LIST(A), stdout: '<html>502 Bad Gateway</html>', exit: 1 }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('npm audit failed');
  });

  it('exits 1 when npm audit reports an error', () => {
    const r = run(repo({ list: LIST(A), stdout: JSON.stringify({ error: { code: 'ENOTFOUND', summary: 'request failed' } }), exit: 1 }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ENOTFOUND');
  });
});
