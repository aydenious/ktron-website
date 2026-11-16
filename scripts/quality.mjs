// The harness count gate (docs/HARNESS.md sections 4 and 5). A count may only fall.
//   npm run quality                              fail on a rise, or on a fall not locked in
//   npm run quality -- --update                  lock in falls (refused while any count rose)
//   npm run quality -- --allow-increase "<why>"  accept rises; the reason stays in the history
//   npm run quality -- --print                   print the counts, change nothing
// Hard rules, no baseline: docs at most 600 lines (CLAUDE.md 200), docs name only real paths
// and npm scripts, components and layouts never import pages.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASELINE = 'scripts/quality-baseline.json';
const CODE_DIRS = ['src', 'scripts', 'tests'];
const CODE_EXT = /\.(astro|ts|mjs|css)$/;
const SELF = ['scripts/quality.mjs', 'tests/unit/quality.test.ts'];

export const PATTERNS = {
  'pattern.hex_colour_outside_tokens': { dirs: ['src'], re: /#[0-9a-fA-F]{3,8}\b/g, skip: (p) => p === 'src/styles/tokens.css' },
  'pattern.set_html': { dirs: ['src'], re: /set:html/g },
  'pattern.console_in_src': { dirs: ['src'], re: /\bconsole\./g },
  'pattern.swallowed_error': { dirs: CODE_DIRS, re: /=>\s*\{\s*\}|catch\s*(\([^)]*\))?\s*\{\s*\}/g },
  'pattern.type_escape': { dirs: CODE_DIRS, re: /:\s*any\b|\bas any\b|<any>|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable/g },
  'pattern.test_skip': { dirs: ['tests'], re: /\.(skip|only)\(|\b(xit|xdescribe)\(/g },
};

const lineCount = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []).flatMap((e) =>
  e.isDirectory() ? (['node_modules', 'dist', '.astro'].includes(e.name) ? [] : walk(join(dir, e.name))) : [join(dir, e.name)]);

export function countPatterns(files) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const [name, { dirs, re, skip = () => false }] of Object.entries(PATTERNS)) {
    out[name] = files
      .filter((f) => dirs.some((d) => f.path.startsWith(`${d}/`)) && !skip(f.path) && !SELF.includes(f.path))
      .reduce((n, f) => n + (f.text.match(re)?.length ?? 0), 0);
  }
  out['size.files_over_400_lines'] = files.filter((f) => lineCount(f.text) > 400).length;
  return out;
}

export function hardRules({ docs, code, scripts, exists }) {
  const errors = [];
  for (const d of docs) {
    const cap = d.path === 'CLAUDE.md' ? 200 : 600;
    if (lineCount(d.text) > cap) errors.push(`${d.path}: ${lineCount(d.text)} lines; the cap is ${cap}`);
    if (d.path === 'docs/HARNESS.md') continue; // verbatim copy: its paths are other repos' examples
    for (const [, p] of d.text.matchAll(/`((?:src|scripts|tests|docs|public|\.github)\/[\w./-]*\.\w+)`/g))
      if (!exists(p)) errors.push(`${d.path} names ${p}, which does not exist`);
    for (const [, s] of d.text.matchAll(/npm run ([\w:-]+)/g))
      if (!scripts.includes(s)) errors.push(`${d.path} names npm run ${s}, which package.json does not define`);
  }
  for (const f of code)
    if (/^src\/(components|layouts)\//.test(f.path) && /from\s+['"][^'"]*\/pages\//.test(f.text))
      errors.push(`${f.path} imports from src/pages/`);
  return errors;
}

export function compare(baseline, current) {
  const rose = [];
  const fell = [];
  for (const [k, v] of Object.entries(current)) {
    if (baseline[k] === undefined || v > baseline[k]) rose.push(`${k}: ${baseline[k] ?? 'new'} → ${v}`);
    else if (v < baseline[k]) fell.push(`${k}: ${baseline[k]} → ${v}`);
  }
  for (const k of Object.keys(baseline)) if (!(k in current)) fell.push(`${k}: ${baseline[k]} → gone`);
  return { rose, fell };
}

export function knipCount(report) {
  let n = report.files?.length ?? 0;
  for (const issue of report.issues ?? [])
    for (const [k, v] of Object.entries(issue))
      if (k !== 'file' && k !== 'owners') n += Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
  return n;
}

function jscpdClones() {
  const out = mkdtempSync(join(tmpdir(), 'jscpd-'));
  try {
    execFileSync('npx', ['--no-install', 'jscpd', '--silent', '--min-lines', '10', '--min-tokens', '70',
      '--formats-exts', 'typescript:ts;javascript:mjs;css:css;markup:astro', '--reporters', 'json',
      '--output', out, ...CODE_DIRS.filter((d) => existsSync(d))], { stdio: 'ignore' });
    return JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8')).statistics.total.clones;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const knipFindings = () =>
  knipCount(JSON.parse(execFileSync('npx', ['--no-install', 'knip', '--reporter', 'json', '--no-exit-code'], { encoding: 'utf8' })));

function fail(messages) {
  for (const m of messages) console.error(m);
  process.exit(1);
}

function main(argv) {
  const at = argv.indexOf('--allow-increase');
  const reason = at >= 0 ? argv[at + 1]?.trim() : undefined;
  if (at >= 0 && !reason) fail(['--allow-increase needs a reason']);
  const read = (path) => ({ path, text: readFileSync(path, 'utf8') });
  const code = CODE_DIRS.flatMap(walk).filter((p) => CODE_EXT.test(p)).map(read);
  const docs = [...readdirSync('.').filter((f) => f.endsWith('.md')), ...walk('docs').filter((p) => p.endsWith('.md') && !p.startsWith('docs/archive/'))].map(read);
  const scripts = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts);
  const errors = hardRules({ docs, code, scripts, exists: existsSync });
  const current = { ...countPatterns(code), 'tools.jscpd_clones': jscpdClones(), 'tools.knip_findings': knipFindings() };
  if (argv.includes('--print')) return console.log(JSON.stringify(current, null, 2));
  if (errors.length) fail(errors);
  const saved = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { metrics: {}, history: [] };
  const { rose, fell } = compare(saved.metrics, current);
  if (rose.length && !reason) fail([...rose.map((r) => `rose: ${r}`), 'Fix the rise, or record why with --allow-increase "<reason>".']);
  if (fell.length && !reason && !argv.includes('--update')) fail([...fell.map((f) => `fell: ${f}`), 'Lock the fall in with --update in this commit.']);
  if (rose.length || fell.length) {
    const date = new Date().toISOString().slice(0, 10);
    const history = [...saved.history, ...rose.map((change) => ({ date, change, reason }))];
    writeFileSync(BASELINE, `${JSON.stringify({ metrics: current, history }, null, 2)}\n`);
    console.log(`${BASELINE} updated`);
  }
  console.log('quality ok');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
