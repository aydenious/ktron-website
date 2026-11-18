> Canonical copy: ~/harness/HARNESS-PLAYBOOK.md on the owner's machine. Keep this file in sync.

# Harness playbook

The owner's standing rules for how AI agents write code in this repo. They apply to every model and every provider.
Read this before planning or writing code. It replaces a long discussion; do not ask the owner to repeat it.

## 1. Why this exists

Every repo built with AI ends up "workable but unreasonable" when a stronger model reviews it: copies, dead code,
rules kept in one place and forgotten in another, code two or three times larger than it needs to be, errors
swallowed and edges never tried. Each session optimises the task it can see, and nothing says no. More agents with
different roles do not fix it. The **harness** does: the tests, CI gates, review and audits that decide which code
may merge, built around an **oracle**, an objective way to tell right from wrong.

## 2. The core rule: a rule that matters is a test, not a sentence

A paragraph in a doc is advice; agents skim it and forget it. A failing CI check is a law; agents obey it every time.
When the owner decides something ("one confirm dialog", "writes go through the service", "no raw colours"), turn it
into a check that fails. Every audit or review finding is fixed **and** turned into a check that stops its whole class
from coming back. This is the definition of done for any fix.

**Test the check itself.** A gate that never fails proves nothing. Give each security gate a self-test in CI
that runs the real tool, not a stand-in, on throwaway input: one case per known bypass that must fail, and one
clean case that must pass. A fake of the tool only tests what you already believed about it; one repo's fakes
passed while the real scanner read an ignore file the gate thought it had replaced. Test it the way it really runs,
too: the exact command from the docs, not the function behind it. One repo's release check, run as documented,
reported success when it could not read its own script, and its unit tests all passed.

**Test the tests the same way.** Breaking the code on purpose shows whether the tests catch anything, but the score
can lie. Require the tests to pass unbroken first: one repo's run scored 42 of 42 because a test was already failing,
and the real score was 41. Require each run to prove it ran the tests you meant: a selector in the same repo matched
nothing, so no tests ran and the run reported success. Count only the broken versions that compile: one that does not
tells you nothing about the tests. State how the tests ran: a test there caught a removed guard in 9 of 10 rounds
in one process, but in only 2 of 19 separate processes.

## 3. CI: the referee

CI runs every check on every pull request, on a clean machine, before anything can merge. Nobody can skip it, and
"works on my machine" cannot sneak in. Merge only when every check is green, and only the exact commit that was
reviewed. Every new rule in this playbook becomes one more step in the repo's CI workflow.

## 4. Ratchets: start from today's mess, allow only improvement

Most new checks find problems that already exist. Requiring zero at once forces a risky big-bang cleanup; doing
nothing lets the count grow. A **ratchet** sits in between:

- a script counts each problem type and compares the count with a committed baseline file;
- CI **fails if a count goes up** (the output names the file that grew);
- CI also **fails if a count goes down but the baseline was not lowered**, so a gain is locked in and cannot be quietly spent;
- raising a baseline needs an explicit `--allow-increase "<reason>"`, visible in the PR diff.

Ratchet what a reviewer cannot judge in a diff (big files, long functions, copies, dead code, bad patterns). Do
**not** ratchet total lines or lines per module: every feature raises them, so each PR needs an
`--allow-increase` and the reasons become a rubber stamp (one repo collected 17 in four days). Print those
counts on every run and let the PR's net-lines line (section 6) hold size.

Pass/fail rules that cannot be counted (secrets, architecture boundaries, security rules) use an explicit allow-list
of existing violations, each with a reason. The list may only shrink.

A gate reads its policy (baseline, allow-list, ignore file, config) from the branch the pull request merges
into, not from the pull request. Otherwise the change being judged can allow itself.

## 5. The gate catalogue (adapt each one to the repo's stack)

**Each repo's plan maps every row to its own stack:** the tool, the exact command, the mode (ratchet, allow-list or
gate) and today's count, or "not applicable" with the reason. The rule is the "Catches" column; the tools are
examples. Use the stack's own idiom: one repo ratchets `except Exception` in its Django backend and `console.log` in
its React frontend from one script, another counts `try?` in Swift.

| Gate | Catches | Typical tools |
|---|---|---|
| Size ratchet | files and functions over a limit (lines per module are printed, not ratcheted: section 4) | a small script (count lines from `git ls-files`; functions via the language's parser) |
| Duplication ratchet | copy-paste blocks | `jscpd` (most languages) |
| Dead-code ratchet | unused files, exports, functions, dependencies | `knip` (TS/JS), `vulture` (Python), `periphery` (Swift) |
| Pattern ratchet | the repo's own known bad patterns: raw colours, hard-coded UI text, native dialogs, copied style strings | a custom counting script, like InFlow's `frontend/scripts/quality-ratchet.mjs` |
| Architecture rules | layer and module boundaries (UI never touches the DB, packages never import apps) | `import-linter` (Python), ESLint `no-restricted-imports` or boundaries (TS), Swift module structure |
| Security rules as tests | one test per security finding class (writes through the service layer, server-owned fields read-only, no outbound fetch outside the SSRF-safe helper, …) | the repo's test framework |
| Error handling | errors swallowed or turned into crashes: an empty or catch-all handler, an ignored error value, a forced unwrap or cast. Each failure must end handled, shown to the user, or as a crash on purpose | Swift: `try?`, `try!`, `as!`, empty `catch`, `!` (a counting script, SwiftLint `force_unwrapping`); Python/Django: bare `except`, `except Exception`, `pass` in a handler (ruff `E722`, `BLE001`, `S110`); TypeScript: empty `catch`, `.catch(() => {})`, unawaited promises (ESLint `no-empty`, `no-empty-function`, `@typescript-eslint/no-floating-promises`); Go: `errcheck` |
| Failure paths | a call to the network, disk, database, queue or another process with no test where it fails: timeout, refusal, a malformed reply, a full disk, a killed process | a fake that fails on demand, in the repo's test framework: Swift: a `URLProtocol` stub; Django: `responses` or `requests-mock`, a mocked `DatabaseError`; TypeScript: `msw` or `nock` |
| Edge cases | inputs no test tries: empty, one, the limit and one past it, the first run, an old server or schema, concurrent calls, cancellation, Unicode, time zones | the PR body names its edges and the test for each; parameterized tests (Swift `@Test(arguments:)`) and property tests where input varies (Hypothesis, fast-check); a fuzzer on parsers of outside input (Atheris, Jazzer.js, libFuzzer); breaking the code on purpose (section 2) to see that tests notice a moved boundary |
| Stress and growth | what breaks only at size or under load: a ten or a hundred times larger input, many concurrent callers, a long session, a busy machine | each cost test run at two sizes, the cost required flat (Django `assertNumQueries`, a counting fake in Swift or TypeScript); a concurrency test with many tasks; waits in tests bounded by time, never by a count of turns; long soaks only on real hardware (section 10) |
| Secrets | committed keys and tokens | `gitleaks` |
| Dependencies | known-vulnerable packages | `pip-audit`, `npm`/`pnpm audit`, `osv-scanner` |
| Risky patterns | `eval`, `pickle`, raw SQL from strings, unsafe HTML | `semgrep` with repo rules |
| Docs truth and size | docs that name files or symbols that no longer exist; docs too long to keep true; plans and specs untouched for 60 days (finished or abandoned: delete or archive); a number written in two places (a summary count and an index row) that disagree | a docs-check script; line caps per doc; an allow-list with reasons for old docs |
| LLM calls | model calls nobody declared; no output cap (`max_tokens`); prompt changes shipped with no evaluation | a test: requests only from declared sites, a cap per call under a ceiling that may only fall, a register of prompt versions or hashes, each naming its evaluation |
| CI matches local | a check that runs before push but not in CI, or the reverse | a test comparing the local verify script or pre-push hook with the CI steps |

A dependency gate that must tolerate an advisory with no fixed release keeps an accepted list (`audit-allowlist.txt` here): each entry has a reason, the list may only shrink, and a new high advisory means update or replace the package, never add an entry without the owner.

Rules for adding tools:
- dev-only dependencies with pinned versions;
- run them inside the existing CI workflow;
- no paid plans or new services without the owner;
- do not add formatters the owner has banned in that repo.

## 6. The review gate (before merge)

- **The PR body states net lines added or removed.** A positive number needs a one-line reason. AI's default failure is adding: a new helper, wrapper or copy. Deleting is a first-class result.
- **An independent reviewer** (an agent that did not write the change) checks the PR against a fixed rubric in `docs/REVIEW_RUBRIC.md`, with a verdict of zero findings or blocked. The rubric asks:
  - Does something like this already exist?
  - Is anything copied?
  - What can be deleted?
  - Are strings translated?
  - Is access control declared?
  - Do the tests fail without the change?
  - What can fail here, and does each failure end handled, shown or crashing on purpose, with a test?
  - Which edges does it name, and which test covers each?
  - What does it cost the hardware, and does everything that grows have a limit?
  - Does a fix come with the guard that stops its class (section 2)?
  - Is every raised counter or new allow-list entry justified, and every fallen counter locked in?
- **The verdict is a PR comment naming the head commit** (`Reviewed abc1234. Verdict: zero findings.`). A push after the review needs a new one.
- **Merge through a script, not the button,** when the host cannot enforce it (no branch protection on a free private repo): the script checks that the required CI jobs succeeded on the head commit, the body states net lines and a verdict names that commit, then merges with the head pinned (`gh pr merge --match-head-commit`).
- **The merge script decides "green" from a count, not from reading output.** Ask the host for the checks as JSON and merge only when the number not in a success state is zero (pending counts as not green). One repo merged two red PRs in a day: one by mistake, and in the other a helper's pipeline lost the failed checks when the command listing them exited non-zero.

## 7. Calibration

- **Full audit** (quality, duplication, dependencies, security) after each new model generation, or monthly. Every finding goes through "fix + guard", so each round finds less.
- **Half a day of senior human review** every quarter. Their comments become rubric lines or guards. This anchors the bar to real human taste.

## 8. Order of work when adopting this in a repo

1. **Measure:** production lines per module, tests, docs; the CI time per job; the cost of the heaviest journeys on the target hardware.
2. **Put the cheap gates in CI first,** in ratchet mode: size, duplication, dead code, secrets.
3. **Lean phase:** delete dead code, merge duplicates, trim docs. Every cut is locked in by the ratchets. Judge it
   by total production lines going **down**: one repo's lean phase moved code into new helpers and ended 221 lines
   larger. Each lean PR states a negative net-lines number. Merging near-copies often shows they behaved
   differently (a limit counted in characters in one copy and bytes in the other): pick one behaviour and list
   each change in the PR body.
4. **Add the repo-specific pattern, architecture and security gates** as findings appear.
5. **New features** only through all gates.

Keep the plan current: a status line at the top (what is done, what is next), "Done (#PR)" in each gate row, and a
dated entry for every decision that changes a gate.

## 9. Fast CI on a self-hosted machine

- **More runners.** Several runners on the same machine let jobs run in parallel. Each job must use its own database, ports and temp folders.
- **Parallel tests.** Split the test suite across cores (`pytest-xdist`, vitest threads, `swift test --parallel`).
- **Path filters.** Skip suites a PR cannot affect; a docs-only PR runs only the docs check. Worth it only when the full run is slow; add a final gate job that every path depends on, so a skipped job still yields one required check.
- **Persistent tool caches.** Keep virtualenvs and package stores on the machine instead of re-downloading them.
- **Runner safety.** Keep the repo private while a self-hosted runner is attached. Run runners as a low-privilege user where possible.
- **Cap what an agent's run may use.** Agents run test suites unattended on the same machine. Give each run a memory ceiling (a cgroup or container limit) and start one only when the machine has room for it. One repo's test run with background tasks executed in-process grew to 19 GB and killed the whole session.

## 10. The hardware is part of the spec

Every gate above judges the code. None of them judges what the code costs the machine it runs on, so a clean,
well-tested codebase can still run out of memory, fill the disk or drain the battery. One repo had every gate green
while a 3 GB upload used 3.2 GB of memory and a killed upload could leave gigabytes on disk for good. Treat each
resource as a requirement, and hold it to the core rule: a check, not a sentence. Keep the rows that apply: a server
has no battery.

| Resource | What goes wrong | Check that needs no hardware | Check on the real hardware |
|---|---|---|---|
| CPU | hitches, slow start, heat | count the work per action; no heavy work on the UI thread | frame hitches or latency, start time, CPU while idle |
| Memory | the system kills the process | cost stays flat as the input grows; caches have limits | peak memory on the heaviest journeys |
| Storage | the disk fills up | capped caches, a sweep for orphaned files, the disk-full path tested | size on disk and bytes written after a long session |
| Battery and heat | drain, throttling | background work is bounded and honours low power | energy and heat over a long run |
| Network | data costs, dropped transfers | cost rules tested with a fake network; interrupted transfers tested | real switches between networks |
| GPU and media hardware | frame budget missed, formats that will not decode | format choice tested | playback of each format on the target device |

The rules:

- **Name the target, and pick the weakest hardware you support:** the oldest phone, the smallest server, the cheap laptop that opens your web app. The best machine you own hides problems. A simulator, an emulator or a CI box borrows its host's CPU, memory and disk, so it can prove logic but not cost.
- **In CI, count; do not time.** Time is noisy on a shared machine and counts are exact: decodes per scroll, queries per page, requests per screen, bytes held. These are ordinary tests. To catch waste, grow the input and require the cost to stay flat, and pin each count in a test so cost cannot creep up between releases.
- **Everything that grows has a limit, and reaching the limit is a tested path:** caches, queues, temporary files, the local database. So are the states the hardware imposes: low memory, a full disk, low power, throttling.
- **Time only on real hardware, before against after.** Same device, release build, repeated runs, with the charge, heat, power mode and data size recorded. Measure the noise first, fail only beyond it, and keep baselines per device model. Derive budgets from the hardware: 120 Hz leaves 8.3 ms a frame.
- **Tie the hardware run to the release.** Hardware is not always attached, so it cannot gate every pull request. A pull request that touches a hot path says so and reports its numbers. A release is refused without a report for its exact commit.
- **Read the field.** Use what the platform already reports from real devices before building your own, and stay inside the product's privacy promise.
