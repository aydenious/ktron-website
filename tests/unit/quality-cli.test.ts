// Runs the real gate the way a user does: node scripts/quality.mjs, in a throwaway repo.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { PATTERNS } from '../../scripts/quality.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(REPO, 'scripts/quality.mjs');
const METRICS = [...Object.keys(PATTERNS), 'size.files_over_400_lines', 'tools.jscpd_clones', 'tools.knip_findings'];
const SKIP_TOOLS = { ...process.env, QUALITY_SKIP_TOOLS: '1' };
const CLONE = Array.from({ length: 12 }, (_, i) => `export const value${i} = ${i} + 1; // line ${i}`).join('\n');

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const zeroBaseline = () => ({ metrics: Object.fromEntries(METRICS.map((m) => [m, 0])), history: [] });

function repo({ baseline = zeroBaseline(), files = {} }: { baseline?: object; files?: Record<string, string> } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'quality-cli-'));
  dirs.push(dir);
  const write = (rel: string, text: string) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  write('package.json', JSON.stringify({ name: 'fixture', private: true, type: 'module', scripts: { test: 'vitest run' } }));
  write('docs/x.md', '# Fixture\n');
  write('src/a.astro', '<p>clean</p>\n');
  write('scripts/quality-baseline.json', `${JSON.stringify(baseline, null, 2)}\n`);
  for (const [rel, text] of Object.entries(files)) write(rel, text);
  return { dir, write };
}

function git(dir: string, ...args: string[]) {
  execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', ...args], { cwd: dir, stdio: 'ignore' });
}

function run(dir: string, args: string[], env: Record<string, string | undefined> = SKIP_TOOLS, script = SCRIPT) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: dir,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('quality CLI', () => {
  it('exits 0 on a clean repo', () => {
    const r = run(repo().dir, []);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('quality ok');
  });
  it('exits 1 after a raw colour is planted', () => {
    const r = run(repo({ files: { 'src/a.astro': '<p style="color: #fff">x</p>\n' } }).dir, []);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('rose: pattern.hex_colour_outside_tokens');
  });
  it('--allow-increase writes the reason into the history', () => {
    const fixture = repo({ files: { 'src/a.astro': '<p style="color: #fff">x</p>\n' } });
    const r = run(fixture.dir, ['--allow-increase', 'brand colour']);
    expect(r.status, r.stderr).toBe(0);
    const saved = JSON.parse(readFileSync(join(fixture.dir, 'scripts/quality-baseline.json'), 'utf8'));
    expect(saved.history.at(-1)).toMatchObject({ reason: 'brand colour' });
    expect(saved.history.at(-1).change).toMatch(/^pattern\.hex_colour_outside_tokens:/);
  });
  it('--update locks a fall in', () => {
    const fixture = repo({ baseline: { metrics: { ...zeroBaseline().metrics, 'pattern.console_in_src': 1 }, history: [] } });
    const r = run(fixture.dir, ['--update']);
    expect(r.status, r.stderr).toBe(0);
    const saved = JSON.parse(readFileSync(join(fixture.dir, 'scripts/quality-baseline.json'), 'utf8'));
    expect(saved.metrics['pattern.console_in_src']).toBe(0);
  });
  it('fails on an it.skip planted under tests/dist', () => {
    const r = run(repo({ files: { 'tests/dist/x.test.ts': "it.skip('x', f);\n" } }).dir, []);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('rose: pattern.test_skip');
  });
  it('still runs the gate when invoked through a symlink', () => {
    const fixture = repo({ files: { 'src/a.astro': '<p style="color: #fff">x</p>\n' } });
    const link = join(fixture.dir, 'quality-link.mjs');
    symlinkSync(SCRIPT, link);
    expect(run(fixture.dir, [], SKIP_TOOLS, link).status).toBe(1);
  });
  it('counts a clone planted under tests/dist with the real jscpd', () => {
    const fixture = repo({
      files: {
        '.gitignore': 'node_modules/\n/dist/\n',
        'src/a.ts': `${CLONE}\n`,
        'tests/dist/x.test.ts': `${CLONE}\n`,
        'knip.json': JSON.stringify({ entry: ['src/a.ts', 'tests/dist/x.test.ts'], project: ['src/**/*.ts', 'tests/**/*.ts'] }),
      },
    });
    symlinkSync(join(REPO, 'node_modules'), join(fixture.dir, 'node_modules'), 'dir');
    const printed = run(fixture.dir, ['--print'], process.env);
    expect(printed.status, printed.stderr).toBe(0);
    const metrics = JSON.parse(printed.stdout);
    fixture.write('scripts/quality-baseline.json', `${JSON.stringify({ metrics: { ...metrics, 'tools.jscpd_clones': 0 }, history: [] })}\n`);
    const r = run(fixture.dir, [], process.env);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('rose: tools.jscpd_clones');
  });
  it('--base fails when the head baseline edits the history it inherited', () => {
    const fixture = repo();
    const saved = JSON.parse(readFileSync(join(fixture.dir, 'scripts/quality-baseline.json'), 'utf8'));
    saved.history = [{ date: '2026-01-01', change: 'pattern.hex_colour_outside_tokens: new → 0', reason: 'first baseline' }];
    fixture.write('scripts/quality-baseline.json', JSON.stringify(saved, null, 2) + '\n');
    git(fixture.dir, 'init', '-q');
    git(fixture.dir, 'add', '-A');
    git(fixture.dir, 'commit', '-q', '-m', 'base');
    saved.history[0].reason = 'rewritten';
    fixture.write('scripts/quality-baseline.json', JSON.stringify(saved, null, 2) + '\n');
    const r = run(fixture.dir, ['--base', 'HEAD']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('history entry 1');
  });
  it('--base says so when the ref has no baseline file', () => {
    const fixture = repo();
    git(fixture.dir, 'init', '-q');
    git(fixture.dir, 'add', '-A');
    git(fixture.dir, 'commit', '-q', '-m', 'base');
    git(fixture.dir, 'rm', '-q', '--cached', 'scripts/quality-baseline.json');
    git(fixture.dir, 'commit', '-q', '-m', 'drop the baseline');
    const r = run(fixture.dir, ['--base', 'HEAD']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('has no scripts/quality-baseline.json');
  });
  it('never sets QUALITY_SKIP_TOOLS in CI or npm run quality', () => {
    expect(readFileSync(join(REPO, 'package.json'), 'utf8')).not.toContain('QUALITY_SKIP_TOOLS');
    expect(readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8')).not.toContain('QUALITY_SKIP_TOOLS');
    expect(existsSync(SCRIPT)).toBe(true);
  });
});
