# Harness plan — ktron-website

> **Status (2026-11-16):** adopted in Task 1b on `feat/brand` (PR 1): the playbook copy, CLAUDE.md,
> the count gate, the review rubric, `npm audit` and gitleaks. Next: Tasks 2–11 of the website plan
> add the browser, weight and Lighthouse gates.

## Measured

Every number below is from `git ls-files` on 2026-11-16, `package-lock.json` excluded (it is 7,278
generated lines). `npm run quality -- --print` gave the counts in the Gates table.

| Area | Files | Lines |
|---|---|---|
| Production: `src/` (one page, two stylesheets) | 3 | 53 |
| Production: `scripts/` (the count gate) | 1 | 125 |
| Production: config and CI (package.json, ci.yml, astro/vitest/knip config, .gitignore, .nvmrc, .npmrc, PR template) | 10 | 126 |
| Generated: `scripts/quality-baseline.json` | 1 | 60 |
| Tests: `tests/unit/` | 3 | 79 |
| Tests: `tests/dist/` | 1 | 17 |
| Docs: HARNESS, CLAUDE.md, README | 3 | 217 |
| **Hand-written production total** | 14 | **304** |

Five biggest files: package-lock.json (7,278, generated), `docs/HARNESS.md` (168), `scripts/quality.mjs`
(125), `scripts/quality-baseline.json` (60, generated), `tests/unit/quality.test.ts` (51).

CI time, first green run (PR 1, GitHub-hosted ubuntu-24.04): `site` 23 s, `quality` 21 s, run in
parallel, so about 25 s from push to result.

## Size judgement

At this point the repo is a scaffold: 304 hand-written production lines, 96 test lines, 217 doc
lines, no application logic beyond one placeholder page. The plan expects roughly 3–4k lines of
components, styles, scene and tests for the finished bilingual page, which is a reasonable size for
a static site with a scroll-driven animation and two languages; the harness should hold that
estimate, not a smaller one.

Hotspots to watch when they arrive (none exists yet): the scene script and its step data, the five
"How it works" stills, and the two i18n JSON files. Nothing may pass 400 lines — the size ratchet
counts files, so a big scene file has to be split rather than baselined.

## Gates

| Gate | Here | Command | Mode | Today |
|---|---|---|---|---|
| Size | files over 400 lines in src, scripts, tests | `npm run quality` | ratchet | 0 |
| Duplication | jscpd 4.3.0, 10 lines / 70 tokens | `npm run quality` | ratchet | 0 |
| Dead code | knip 5.88.1 (Astro plugin) | `npm run quality` | ratchet | 0 |
| Pattern | raw colours outside `src/styles/tokens.css`, `set:html`, `console.` in src, type escapes, skipped tests | `npm run quality` | ratchet | 0 each |
| Architecture | components and layouts never import pages | `npm run quality` | gate | 0 |
| Security as tests | forbidden customer name (Task 4), scripts only from this site and no inline handlers, `_headers` values (Task 5) | `npm test` | gate | 1 page clean (2 checks) |
| Error handling | empty `catch`, `() => {}` | `npm run quality` | ratchet | 0 |
| Failure paths | no JavaScript, reduced motion, failed lazy load leaves the stills (Tasks 9–10) | `npx playwright test` | gate | not yet: Playwright lands in Task 9 |
| Edge cases | the plan index's Review Focus, one test each | `npm test`, Playwright | gate | not yet: Tasks 9–10 |
| Stress | not applicable: no server, no input; the first-load weight and Lighthouse budgets stand in (Task 9) | `npx lhci autorun` | gate | not yet: Task 9 |
| Secrets | gitleaks 8.30.1, full history | CI `quality` job | gate | 0 |
| Dependencies | `npm audit --audit-level=high` | CI `quality` job | gate | 0 (one moderate Astro advisory, below the gate) |
| Risky patterns | `set:html` counted above; semgrep not installed (owner decision) | `npm run quality` | ratchet | 0 |
| Docs truth and size | 600-line cap (CLAUDE.md 200), named paths and npm scripts exist | `npm run quality` | gate | 0 |
| LLM calls | not applicable: the site makes no model calls | — | — | — |
| CI matches local | every `npm run verify` command is a CI step | `npm test` (`tests/unit/ci.test.ts`) | gate | 1 test passing |

Two adoption decisions worth knowing:

- **knip flags no dependency today.** Task 1 installed `sharp` and `simple-icons`, which nothing
  imported yet; both were removed so the dead-code ratchet starts at zero. The first task to
  import each installs it with `--save-exact`: sharp in Task 3 (the icon script), simple-icons in
  Task 5 (the footer icons).
- **one narrow knip ignore:** `jscpd` in `knip.json`, because the gate runs it as
  `npx --no-install jscpd`, a string knip cannot resolve. It is a false positive of the tool, not a
  baselined finding.

## Order of work

Tasks 2–11 of the website plan, in its order; there is no ratchet debt to pay down (every count is
zero). The first two pull requests:

1. **PR 1, Brand** (Tasks 1, 1b, 2, 3): logo concepts (owner stop), the logo set and icons. The only
   expected rise is `set:html` and raw SVG colours in the logo files, each recorded with
   `--allow-increase "<reason>"` in that task's commit.
2. **PR 2, Site** (Tasks 4–9): strings, layout, photos, sections, scene stills, then the browser,
   weight and Lighthouse gates. This is where failure-path and edge-case tests arrive; new counts
   are locked in with `--update`, and any rise carries its reason.

## CI speed

GitHub-hosted `ubuntu-24.04` runners, so playbook section 9's runner rules do not apply here (no
self-hosted runner, nothing to schedule). Two jobs run in parallel: `site` (check, build, test,
quality) and `quality` (npm audit, gitleaks). Playwright and Lighthouse join the `site` job in Task 9;
if that job then passes about five minutes, split the browser tests into their own job and cache the
Playwright browsers, since both reuse the same build. Nothing needs a database, a fixed port or a
shared temp folder, so the jobs can stay parallel.

