// The dependency gate: `npm audit` for high and critical advisories, minus the accepted list.
//   npm run audit        fail on a high or critical advisory that audit-allowlist.txt does not name,
//                        on a listed id that npm no longer reports at high or above (delete the entry),
//                        on a malformed list line, and on an `npm audit` that could not run
//   npm run audit -- --base origin/main   also fail on an entry that ref's list does not have (a ref
//                        with no list has none): a pull request may not accept an advisory for itself,
//                        so only the owner merges an added entry, past this check (CI passes the PR's base)
// The only argument is `--base <ref>`. Severity fails closed: anything but info, low or moderate is gated.
// The list: one `GHSA-xxxx-xxxx-xxxx  <reason>` per line, `#` comments, and it may only shrink.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWLIST = 'audit-allowlist.txt';
const ORDER = ['info', 'low', 'moderate', 'high', 'critical'];
const NOT_GATED = 3; // a rank below this (info, low, moderate) passes; an unknown severity ranks above critical
const NPM_TIMEOUT_MS = 120_000;
const severityOf = (value) => String(value ?? '').toLowerCase();
const rank = (severity) => (ORDER.includes(severity) ? ORDER.indexOf(severity) : ORDER.length);
const isGated = (severity) => rank(severityOf(severity)) >= NOT_GATED;
const MIN_REASON = 10;
const ENTRY = /^(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\s+(\S.*)$/;

export function parseAllowlist(text) {
  const ids = [];
  const problems = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = ENTRY.exec(line);
    if (!m) problems.push(`${ALLOWLIST} line ${i + 1}: expected "GHSA-xxxx-xxxx-xxxx  <reason>", got "${line}"`);
    else if (m[2].length < MIN_REASON || !/\p{L}/u.test(m[2]))
      problems.push(`${ALLOWLIST} line ${i + 1}: the reason for ${m[1]} needs at least ${MIN_REASON} characters, with a letter`);
    else if (ids.includes(m[1])) problems.push(`${ALLOWLIST} line ${i + 1}: ${m[1]} is listed twice`);
    else ids.push(m[1]);
  });
  return { ids, problems };
}

// Every advisory (the objects in `via`; strings are package names) mapped key -> {severity, title}, highest severity kept.
function advisories(audit) {
  const found = new Map();
  for (const [pkg, vuln] of Object.entries(audit.vulnerabilities ?? {}))
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      const key = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? via.url ?? via.title ?? `unknown advisory in ${pkg}`;
      const severity = severityOf(via.severity) || 'unknown';
      if (!found.has(key) || rank(severity) > rank(found.get(key).severity)) found.set(key, { severity, title: via.title ?? '' });
    }
  return found;
}

// Does this package reach a gated advisory object, following `via` package names through `vulnerabilities`?
function reachesGated(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return false;
  seen.add(name);
  return (vulnerabilities[name]?.via ?? []).some((via) =>
    typeof via === 'string' ? reachesGated(via, vulnerabilities, seen) : typeof via === 'object' && via !== null && isGated(via.severity),
  );
}

/** (npm audit --json result, allowlist text) -> one line per problem; none means the gate passes. */
export function auditProblems(audit, allowText) {
  if (audit?.error)
    return [`npm audit failed: ${[audit.error.code, audit.error.summary, audit.message].filter(Boolean).join(' ') || 'no detail'}`];
  if (!audit?.vulnerabilities) return ['npm audit gave no vulnerabilities field: not an audit report'];
  const { ids, problems } = parseAllowlist(allowText);
  const gated = new Map([...advisories(audit)].filter(([, a]) => isGated(a.severity)));
  for (const [id, { severity, title }] of gated)
    if (!ids.includes(id)) problems.push(`${severity} advisory ${id} is not accepted: ${title}. Update or replace the package.`);
  for (const id of ids)
    if (!gated.has(id)) problems.push(`${id} is on ${ALLOWLIST} but npm no longer reports it at high or above: delete the stale entry`);
  for (const [pkg, vuln] of Object.entries(audit.vulnerabilities))
    if (isGated(vuln.severity) && !reachesGated(pkg, audit.vulnerabilities))
      problems.push(`${pkg} is reported at ${severityOf(vuln.severity) || 'an unknown severity'} but no high or critical advisory is behind it: not a report this gate understands`);
  return problems.map((p) => p.replace(/\s*\n\s*/g, ' '));
}

/** (the list on the branch merged into, this branch's list, a note on the base) -> one message per added id. */
export function addedSinceBase(baseText, headText, note = '') {
  const before = new Set(parseAllowlist(baseText).ids);
  return parseAllowlist(headText)
    .ids.filter((id) => !before.has(id))
    .map((id) => `${id} is not on ${ALLOWLIST} in the branch this merges into${note ? ` (${note})` : ''}: a pull request may not accept an advisory for itself (only the owner merges an added entry, past this check)`);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// The list as `baseRef` has it ('' with a note when the ref has none), or an error to print.
function baseList(baseRef) {
  try {
    git('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`);
  } catch {
    return { error: `--base ${baseRef} is not a commit in this repository` };
  }
  try {
    if (!git('ls-tree', '--name-only', baseRef, '--', ALLOWLIST).trim()) return { text: '', note: `${baseRef} has no ${ALLOWLIST}` };
    return { text: git('show', `${baseRef}:${ALLOWLIST}`), note: '' };
  } catch (error) {
    return { error: `could not read ${ALLOWLIST} at ${baseRef}: ${error.message}` };
  }
}

function fail(...messages) {
  for (const m of messages) console.error(m);
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  const given = argv.length > 0;
  if (given && !(argv.length === 2 && argv[0] === '--base' && argv[1].trim() && !argv[1].startsWith('-')))
    fail(`unexpected arguments "${argv.join(' ')}": the only argument is --base <ref>, a ref that does not start with "-"`);
  const base = given ? baseList(argv[1].trim()) : { text: null };
  if (base.error) fail(base.error);
  const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: NPM_TIMEOUT_MS });
  let audit;
  try {
    audit = JSON.parse(run.stdout);
  } catch (error) {
    const why = run.error?.code === 'ETIMEDOUT' ? `timed out after ${NPM_TIMEOUT_MS / 1000} s` : `no JSON from npm audit (${error.message}) ${run.stderr ?? ''}`;
    audit = { error: { code: run.error?.code ?? `exit ${run.status}`, summary: why.trim() } };
  }
  const head = readFileSync(ALLOWLIST, 'utf8');
  const problems = [...(base.text === null ? [] : addedSinceBase(base.text, head, base.note)), ...auditProblems(audit, head)];
  if (problems.length) fail(...problems);
  const { ids } = parseAllowlist(head);
  console.log(`audit ok (${ids.length} accepted: ${ids.join(', ') || 'none'})`);
}

// realpathSync: same entry-script check as scripts/quality.mjs.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
