# "How it works" animation redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** five scrolls play the five steps of the "How it works" story, and the scene gets the approved richer
drawing (day → sunset → night → dawn, houses with residents, driver, factory, QC house).

**Architecture:** one pure model (`src/components/scene/steps.ts` with its layout, timeline, view and scroll
helpers) feeds both the server-drawn stills and the browser painter, so the two match by construction. The
drawing becomes a composition of parts in a new folder, src/components/scene/parts/. A generic painter writes
every `data-<hook>` attribute from the `HOOKS` table in `src/components/scene/view.ts`. A new play module turns
committed steps into clock tweens and snaps the page to settle points.

**Tech Stack:** Astro 7.4.4 (strict TS), GSAP 3.15.0 + ScrollTrigger, vitest (unit + dist), Playwright
(projects `phone` = Pixel 7, `desktop` = 1440×900, `iphone` = iPhone 13 / WebKit), node-html-parser in tests.

**Spec:** `docs/plans/2026-11-17-how-it-works-animation-design.md` (approved: "build it"). Shapes and
coordinates come from `docs/plans/assets/2026-11-17-scene-mockup.py` (reference only, never run by CI).

Per-task files (each is one task's full brief):

| Task | File | What |
|---|---|---|
| 1 | this file, below | the model (done) |
| 2 | 2026-11-17-how-it-works-animation-plan-t2.md (this folder) | tokens, scene.css, Defs, Sky, Ground, Factory, generic painter, contrast guard |
| 3 | 2026-11-17-how-it-works-animation-plan-t3.md | Head, Torso, Person, Bust, House; residents and driver |
| 4 | 2026-11-17-how-it-works-animation-plan-t4.md | Inspection, Van, `scene.qc`, final composition, weight guards |
| 5 | 2026-11-17-how-it-works-animation-plan-t5.md | play module, snap, section state, e2e "one scroll, one step" |
| 6 | 2026-11-17-how-it-works-animation-plan-t6.md | ambient loops, no-filter and ambient guards, docs |

## Global Constraints

- Node 24 only: `export PATH=$HOME/.nvm/versions/node/v24.22.3/bin:$PATH` before any npm or npx command.
- `npm run verify` (check + build + test + quality) and `npm run quality` stay green after every task; no count
  in `scripts/quality-baseline.json` may rise (hex colours outside tokens 0, colour functions 0, set_html 1,
  console 0, swallowed errors 0, risky DOM 0, type escapes 0, skipped tests 0, files over 400 lines 0, jscpd
  clones 0, knip findings 0).
- Raw colour lives only in `src/styles/tokens.css`; every scene colour is a `--scene-*` token (Task 2 table).
- Every file stays under 400 lines; docs under 600 lines; a backticked path in a doc must exist.
- No SVG `filter`, `feGaussianBlur` or `mask` in the scene. Glows are radial gradients with opacity.
- Element ids are unique per page (`tests/dist/links.test.ts`): gradients and clipPaths live once, in the Defs
  part, never inside a Scene (the five stills and the stage clone would repeat them).
- Text never goes inside the van body's flip group (`data-van-body`).
- The customer is never named anywhere (forbidden-word gate). No real people, logos, prices or part numbers.
- Magnification is 10x only (`tests/helpers/facts.ts`).
- Export only what another module or test consumes (knip counts test files as usage).
- Commits end with the two trailer lines: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_016aPAvo9gnQA8yTyuqJ3ZMS`.
- Implementers never dispatch subagents.

## Review Focus

1. A phone's momentum carries a swipe across a band while a clip plays: the page must still end at a settle
   point and the clock at that step's end (Task 5: "a scroll during a clip ends at the latest commit").
2. Page Down or Space (about 1.8 bands at once) from step 1: steps 2 and 3 play, 2 at 4×, and the page settles
   at P_3 (Task 5: keyboard variant of the flick test, desktop).
3. The viewport resizes or rotates while pinned: the committed step stays, and the page settles at the new
   P_k (Task 5: extend the existing resize test with a `data-step` check).
4. A deep link to a section below "How it works": the scene lands on step 5 with `data-t` 5.000 and plays
   nothing (Task 5: assert `data-t` straight after `data-ready` in the deep-link test).
5. The painter and the server drawing disagree for some hook (a missed index, a rounding difference): painting
   `stateAt(STILL_T[k])` onto still 1 must give exactly still k+1's attributes (Task 2 dist test, extended as
   parts land in Tasks 3–4).

## Shared reference

### Rulings (coordinator decisions; spec wins where these are silent)

- R1. Step 1's driver walks LOAD → cab from 0.65 to 0.72; the driver's marks are `DOCK_X` 196, `LOAD_X` 226,
  `FRONT_X` 190 (`src/components/scene/layout.ts`).
- R2. Each house has its own door state (`HOUSE_DOOR` in `src/components/scene/timeline.ts`).
- R3. `committedStep` takes the scroll direction as a fifth argument (keeps a position between bands stable).
- R4. Clip sub-timings stay as in the spec; tuning is the owner's call after seeing it.
- R5. The branch stays green after every task: old drawing pieces stay until the task that replaces them.
- R6. Gradients and clipPaths are drawn once per page by the Defs part (rendered by HowItWorks.astro outside
  the stills list, in a visually hidden 0×0 svg, never `display: none`, which stops gradients painting in
  some browsers). Scenes reference them with `url(#scene-…)`.
- R7. Still 2 (t = 2) shows all four windows lit, by design; the old dist assertion "no lit windows outside
  still 3" changes on purpose (Task 2, when `data-lit` starts following `s.lit[i]`).
- R8. One generic painter: for each `HOOKS` entry, every element carrying `data-<hook>="<i>"` gets
  `HOOKS[hook].attr` = `HOOKS[hook].value(s, i)`, written only when it changed.
- R9. The night wash is per building: each building part draws its own `data-wash="<i>"` silhouette after its
  body and before its lit windows (houses 0–3, factory 4, inspection 5, van 6). One full-world wash would dim
  the moon and stars or leave a visible edge in the sky.
- R10. The van's label and rack crates sit outside the flip group, so they move with a new hook `van-load`
  (Task 4): `translate((1 − facing) · 5, 0)`, keeping them centred on the box whichever way the van faces.
- R11. The dawn sky has no mockup colours; Task 2's tokens define it (`--scene-sky-dawn-1…4`).
- R12. Spec §8 "the stills contain no ambient-loop classes" is enforced as: every CSS rule with `animation`
  is scoped under `[data-stage]`, and ambient targets are marked `data-amb` (inert in the stills); no element
  carries both `data-amb` and a hook (Task 6).
- R13. Scene text classes are `text-…`; the contrast guard maps each to a TEXT pair (Task 2).
- R14. The section exposes `data-band` (B in px) besides `data-start`/`data-end`, so browser tests read B
  instead of re-deriving it (Task 5).
- R15. The moon is one crescent path (two arcs), not a disc covered by a sky-coloured disc, so it reads over
  the changing sky.
- R16. Spec §8's flick test scrolls 2.1 bands, not 2.2: 2.2 bands from P_1 lands exactly on step 4's commit
  threshold (P_3 + 0.2B), so a one-pixel rounding would decide the result.
- R17. Everyone is drawn at scale 1.35 throughout (the mockup's 1.5 for the last frame needs a hook for no
  visible gain).
- R18. `snapProgress` takes the scroll direction: coming back up from below the pin, the end holds until 0.2
  band short of it, then P_5 (otherwise a small upward scroll from the end snaps back down).

### Hooks (from `src/components/scene/view.ts`) and the part that draws each

| Part | Hooks it writes with `bind(hook, s, i)` |
|---|---|
| Sky (fixed to the view, outside `data-world`) | `sunset`, `dawn`, `night`, `sun`, `dusk` (index 2: low-sun disc), `moon`, `moon-rise`, `stars` |
| Scene (the world group) | `world` |
| Ground (in the world) | `dusk` 0 (hills), `dusk` 1 (palms), `dark` 0 (hills), `dark` 1 (palms) |
| Factory | `factory-door`, `dock-crate` 0–3, `wash` 4 |
| House i | `house-door` i, `house-crate` i, `lit` i, `wash` i |
| Person (resident i / driver) | `resident`, `resident-show`, `resident-face`, `resident-crate`, `resident-arms`, `resident-leg-a`, `resident-leg-b` (index i); `driver`, `driver-show`, `driver-face`, `driver-crate`, `driver-arms`, `driver-leg-a`, `driver-leg-b` (index 0) |
| Inspection | `qc-glow`, `lens`, `tick`, `wash` 5 |
| Van | `van`, `van-body`, `wheel` 0–1, `headlight`, `van-crate` 0–3, `van-load` (Task 4), `wash` 6 |

`bind` returns `{ 'data-<hook>': String(i), <attr>: String(value) }`, so a part writes
`<g {...bind('house-door', s, i)}>`. Never write a hooked attribute by hand.

### Draw order (the final Scene, Task 4)

1. Sky (view coordinates). 2. `<g data-world>`: Ground, Factory, House ×4, Inspection, residents ×4, driver,
Van. People are drawn before the van so the driver disappears behind it when climbing into the cab.

### Where colours go

All scene classes live in one global stylesheet, src/components/scene/scene.css, imported once by
`src/components/scene/Scene.astro` (and by the Defs part for stop colours). Class names start `sc-`
(fills: `.sc-wall-1 { fill: var(--scene-wall-1); }`; strokes `.sc-stroke-…`; stops `.sc-stop-…` with
`stop-color`). Text classes start `text-`. Markup carries no `fill="#…"`, no `style` colours.

## Task 1: Scene model (done by the coordinator; reviewed as a task)

**Files:**
- Create: `src/components/scene/layout.ts` (world size, stops, the driver's marks, door and kerb, `camera`)
- Create: `src/components/scene/timeline.ts` (keyframe tables, `track`, `held`, `distance`, `heading`,
  `stride`, crate `TRANSFERS` and `holding`)
- Create: `src/components/scene/view.ts` (`view`, `HOOKS`, `bind`)
- Create: `src/components/scene/scroll.ts` (`CLIP`, `PIN_BANDS`, `bandPx`, `committedStep`, `playPlan`,
  `snapProgress`)
- Modify: `src/components/scene/steps.ts` (`SceneState`, `stateAt`, `stepOf`, `MAX_SPEED`, `STILL_T`,
  `STILLS`; re-exports layout and `view`)
- Modify: `src/components/scene/Scene.astro`, `src/components/scene/animate.ts` (old drawing and scrub patched
  to the new model so the branch stays green; replaced by Tasks 2–5)
- Test: `tests/unit/steps.test.ts`, `tests/unit/choreography.test.ts`, `tests/unit/scroll.test.ts`,
  `tests/dist/how.test.ts`

**Interfaces produced** (later tasks consume these exactly):
- `stateAt(t: number): SceneState`; `STILL_T = [0.55, 2, 2.25, 4, 5]`; `STILLS = STILL_T.map(stateAt)`.
- `SceneState`: `vanX`, `facing: 1 | -1`, `vanCrates`, `wheel`, `headlights`, `sunset`, `night`, `dawn`,
  `sunX`, `sunY`, `moon`, `door`, `dockCrates`, `driver: Walker`, `residents: Resident[4]`,
  `houseCrates: boolean[4]`, `lit: number[4]`, `qcGlow`, `lens`, `tick`.
- `HOOKS` (38 entries) and `bind(hook, s, i = 0)`; layout constants `WORLD_W 1040`, `VIEW_W 800`, `VIEW_H 400`,
  `ROAD_Y 344`, `WALK_Y 316`, `FACTORY_X 270`, `HOUSE_X [350, 470, 590, 710]`, `INSPECT_X 880`,
  `ROLLER_TOP 236`, `DOOR`, `KERB`, `HINGE_DX 4`.
- `committedStep(y, start, B, current, direction)`, `playPlan(clock, target)`, `snapProgress(progress,
  committed, direction)`, `bandPx(innerHeight)`, `PIN_BANDS 4.6`, `CLIP [3, 4, 5, 3, 3.5]`.

**Tests (all passing):** spec §8's kept and updated unit tests; the choreography rules over t = 0…5 in 0.005
steps (crate conservation, hand-overs between standing holders at one place, driver shown only while the van
stands at the factory, lit means inside, zero stride when still, speed limit); `committedStep` hysteresis
both ways and the 0/5 edges; `playPlan` speeds 1×, 2× back, 4× skipped; `snapProgress` end release.

- [x] Step 1: write the model and its tests; `npm run verify` green (423 tests; 21 desktop animation e2e).
- [ ] Step 2: commit (`feat(scene): one model for the five-step story and the scroll rules`).
