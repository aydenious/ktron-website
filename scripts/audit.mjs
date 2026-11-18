// The dependency gate: `npm audit` for high and critical advisories, minus the accepted list.
//   npm run audit        fail on a high or critical advisory that audit-allowlist.txt does not name,
//                        on a listed id that npm no longer reports at high or above (delete the entry),
//                        on a malformed list line, and on an `npm audit` that could not run
// The list: one `GHSA-xxxx-xxxx-xxxx  <reason>` per line, `#` comments, and it may only shrink.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWLIST = 'audit-allowlist.txt';
const GATED = new Set(['high', 'critical']);
const ENTRY = /^(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\s+(\S.*)$/;

export function parseAllowlist(text) {
  const ids = [];
  const problems = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = ENTRY.exec(line);
    if (!m) problems.push(`${ALLOWLIST} line ${i + 1}: expected "GHSA-xxxx-xxxx-xxxx  <reason>", got "${line}"`);
    else if (ids.includes(m[1])) problems.push(`${ALLOWLIST} line ${i + 1}: ${m[1]} is listed twice`);
    else ids.push(m[1]);
  });
  return { ids, problems };
}

// Every advisory (the objects in `via`; strings are package names) mapped id -> {severity, title}.
function advisories(audit) {
  const found = new Map();
  for (const vuln of Object.values(audit.vulnerabilities ?? {}))
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      const id = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? via.url ?? via.title ?? 'unknown advisory';
      found.set(id, { severity: via.severity, title: via.title ?? '' });
    }
  return found;
}

/** (npm audit --json result, allowlist text) -> one message per problem; none means the gate passes. */
export function auditProblems(audit, allowText) {
  if (audit?.error)
    return [`npm audit failed: ${[audit.error.code, audit.error.summary, audit.message].filter(Boolean).join(' ') || 'no detail'}`];
  if (!audit?.vulnerabilities) return ['npm audit gave no vulnerabilities field: not an audit report'];
  const { ids, problems } = parseAllowlist(allowText);
  const gated = new Map([...advisories(audit)].filter(([, a]) => GATED.has(a.severity)));
  for (const [id, { severity, title }] of gated)
    if (!ids.includes(id)) problems.push(`${severity} advisory ${id} is not accepted: ${title}. Update or replace the package.`);
  for (const id of ids)
    if (!gated.has(id)) problems.push(`${id} is on ${ALLOWLIST} but npm no longer reports it at high or above: delete the stale entry`);
  return problems;
}

function main() {
  const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let audit;
  try {
    audit = JSON.parse(run.stdout);
  } catch (error) {
    audit = { error: { code: run.error?.code ?? `exit ${run.status}`, summary: `no JSON from npm audit (${error.message}) ${run.stderr ?? ''}`.trim() } };
  }
  const problems = auditProblems(audit, readFileSync(ALLOWLIST, 'utf8'));
  if (problems.length) {
    for (const p of problems) console.error(p.replace(/\s*\n\s*/g, ' '));
    process.exit(1);
  }
  const { ids } = parseAllowlist(readFileSync(ALLOWLIST, 'utf8'));
  console.log(`audit ok (${ids.length} accepted: ${ids.join(', ') || 'none'})`);
}

// realpathSync: same entry-script check as scripts/quality.mjs.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
