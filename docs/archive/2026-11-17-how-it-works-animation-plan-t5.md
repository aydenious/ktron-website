# Task 5 — scroll starts a step, the step plays to its end

Part of the plan `docs/plans/2026-11-17-how-it-works-animation-plan.md`. Read its "Global Constraints" and
"Shared reference" sections first; they apply here. Spec: `docs/plans/2026-11-17-how-it-works-animation-design.md`
§2 (the scroll model; binding) and §8 (tests), with plan rulings R16 (flick 2.1 bands) and R18 (snap direction).

### Task 5: The play module, the new pin and snap, and the browser tests

**Files:**
- Create: src/components/scene/play.ts
- Modify: `src/components/scene/animate.ts` (the scrubbed `gsap.to` and `render` go; `play` takes over;
  arrival code unchanged)
- Create: tests/e2e/helpers.ts (the helpers both e2e files share, moved out of the old file)
- Create: tests/e2e/steps.spec.ts (the §8 "one scroll plays one whole step" guard)
- Modify: `tests/e2e/animation.spec.ts` (imports the helpers; the caption tests move to settle points)

**Interfaces:**
- Consumes (Task 1, `src/components/scene/scroll.ts`): `committedStep(y, start, B, current, direction)`,
  `playPlan(clock, target)` → `{ from, to, seconds }[]`, `snapProgress(progress, committed, direction)`,
  `bandPx(innerHeight)`, `PIN_BANDS`. Task 2's `painter(root)` from src/components/scene/paint.ts;
  `stateAt` from `src/components/scene/steps.ts`.
- Produces:

```ts
export interface Words { counter: string; caption: string }
export interface PlayOptions {
  section: HTMLElement;   // gets data-step, data-t, data-start, data-end, data-band
  stage: HTMLElement;     // pinned; holds [data-counter] and [data-caption]
  words: readonly Words[]; // index k − 1 for step k
  paint: (t: number) => void;
  header: () => number;   // the sticky header's height, px
}
/** Pins the stage and plays the scene clock to each committed step. Returns nothing; ScrollTrigger owns it. */
export function play(o: PlayOptions): void;
```

#### How play works (spec §2)

```ts
export function play({ section, stage, words, paint, header }: PlayOptions): void {
  const counter = stage.querySelector('[data-counter]')!;
  const caption = stage.querySelector('[data-caption]')!;
  const clock = { t: 0 };
  let committed = -1; // nothing committed yet: the first commit is an arrival and jumps
  let running: gsap.core.Timeline | null = null;
  let B = bandPx(innerHeight);
  const draw = () => { paint(clock.t); section.dataset.t = clock.t.toFixed(3); };

  const commit = (n: number) => {
    const arriving = committed < 0;
    committed = n;
    section.dataset.step = String(n);
    const w = words[Math.max(n, 1) - 1];
    counter.textContent = w.counter;
    caption.textContent = w.caption;
    running?.kill();
    running = null;
    if (arriving) { clock.t = n; draw(); return; }
    const tl = gsap.timeline({ onUpdate: draw, onComplete: () => { running = null; } });
    for (const seg of playPlan(clock.t, n)) tl.to(clock, { t: seg.to, duration: seg.seconds, ease: 'none' });
    running = tl;
  };

  ScrollTrigger.create({
    trigger: stage,
    pin: true,
    start: () => `top ${header()}px`,
    end: () => `+=${Math.round(PIN_BANDS * B)}`,
    invalidateOnRefresh: true,
    snap: {
      snapTo: (p, self) => snapProgress(p, committed, self && self.direction < 0 ? -1 : 1),
      duration: { min: 0.2, max: 0.5 },
      delay: 0.1,
      inertia: false,
      ease: 'power1.inOut',
    },
    onUpdate: (st) => {
      const n = committedStep(st.scroll(), st.start, B, Math.max(committed, 0), st.direction < 0 ? -1 : 1);
      if (n !== committed) commit(n);
    },
    onRefreshInit: () => { B = bandPx(innerHeight); },
    onRefresh: (st) => {
      section.dataset.start = String(Math.round(st.start));
      section.dataset.end = String(Math.round(st.end));
      section.dataset.band = String(Math.round(B));
      if (committed < 0) commit(committedStep(st.scroll(), st.start, B, 0, 1));
    },
  });
}
```

Notes the implementer must keep:
- The arrival rule (spec §2 "Arriving mid-section"): the first commit after setup sets the clock straight to
  the committed step's end and plays nothing. `onRefresh` runs once before any scroll, so a deep link, a
  restored scroll or a reader already below the section lands on the right frame with no clip.
- Above the pin (step 0) the counter and caption read step 1 and the clock goes to 0 (the opening frame).
- A new commit during a clip kills the running timeline and plans from the current clock: nothing queues.
- `committed` is passed to `snapTo` as it is at snap time, which is after the last `onUpdate`.
- `section.dataset.t` is the only place the clock is published; tests read it.
- If `self` is not passed to `snapTo` by this GSAP version (3.15.0 passes `(value, self)`), keep the last
  `st.direction` from `onUpdate` in a variable instead; do not guess, check
  node_modules/gsap/types/scroll-trigger.d.ts.

In `src/components/scene/animate.ts`, the `const clock`, `gsap.to(...)`, `render` and `screens` go. After the
stage is built: `play({ section, stage, words, paint: (t) => paint(stateAt(t)), header })`, then
`ScrollTrigger.refresh()` and the fonts refresh as today. The arrival block (deep link, re-aim, `readerIsBelow`
shift, the `scrollend` settle) stays exactly as it is. The stage's own `data-step` is no longer updated (the
section's is the one tests read); remove it from the stage if nothing in CSS reads it (grep for it first).

#### Tests

tests/e2e/helpers.ts exports `how`, `stage`, `still`, `pageUp`, `holdChunk`, `scrollTo`, `ready` moved verbatim
from `tests/e2e/animation.spec.ts`, plus:

```ts
/** The section's state: committed step, scene clock, settle point of step 1, band, pin end. */
export const state = (page: Page) =>
  how(page).evaluate((s) => ({ step: Number(s.dataset.step), t: s.dataset.t, start: Number(s.dataset.start), B: Number(s.dataset.band), end: Number(s.dataset.end) }));
/** A scroll of dy px the way a finger or wheel makes one (mobile WebKit has no mouse.wheel). */
export const nudge = (page: Page, dy: number) => page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), dy);
/** Waits until a step has finished playing and the page has settled on its settle point. */
export async function settled(page: Page, n: number) {
  await expect.poll(async () => (await state(page)).step, { timeout: 15000 }).toBe(n);
  await expect.poll(async () => (await state(page)).t, { timeout: 15000 }).toBe(`${n}.000`);
  const { start, B } = await state(page);
  const P = start + Math.max(n - 1, 0) * B;
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThanOrEqual(P - 2);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeLessThanOrEqual(P + 2);
}
```

Stills 2, 4 and 5 are drawn at their step's end (t 2, 4, 5), so after those steps the playing scene must
match the still exactly. For every step, the van must also be still for 500 ms after `settled` (no clip
running).

tests/e2e/steps.spec.ts:

```ts
import { expect, test, type Page } from '@playwright/test';
import { nudge, ready, scrollTo, settled, stage, state, still } from './helpers';

const AT_STEP_END = [2, 4, 5]; // stills drawn at their step's end
async function finished(page: Page, n: number) {
  await settled(page, n);
  const van = stage(page).locator('[data-van]');
  const a = await van.getAttribute('transform');
  await page.waitForTimeout(500);
  expect(await van.getAttribute('transform'), `step ${n} has finished playing`).toBe(a);
  await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, Math.max(n, 1)).locator('[data-caption]').textContent())!);
  if (AT_STEP_END.includes(n))
    for (const hook of ['data-van', 'data-world'])
      await expect(stage(page).locator(`[${hook}]`)).toHaveAttribute('transform', (await still(page, n).locator(`[${hook}]`).getAttribute('transform'))!);
}
async function atStep(page: Page, n: number) {
  const [start] = await ready(page);
  await scrollTo(page, start + (n - 1) * (await state(page)).B);
  await finished(page, n);
}

test('one small scroll down plays exactly one whole step, from every settle point', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 1);
  for (let n = 1; n < 5; n++) {
    await nudge(page, 0.3 * (await state(page)).B);
    await finished(page, n + 1);
  }
});

test('one small scroll up plays exactly one step back, from every settle point', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 5);
  for (let n = 5; n > 1; n--) {
    await nudge(page, -0.3 * (await state(page)).B);
    await finished(page, n - 1);
  }
});

test('a flick of 2.1 bands from step 1 ends on step 3, fully played (ruling R16)', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 1);
  await nudge(page, 2.1 * (await state(page)).B);
  await finished(page, 3);
});

test('a scroll during a clip ends at the latest commit', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 1);
  await nudge(page, 0.3 * (await state(page)).B);
  await expect.poll(async () => Number((await state(page)).t)).toBeGreaterThan(1.1);
  expect(Number((await state(page)).t)).toBeLessThan(1.9); // step 2 is still playing
  await nudge(page, (await state(page)).B);
  await finished(page, 3);
});

test('past step 5 the page unpins and carries on, and a small scroll back up is not pulled down', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 5);
  const { end, B, start } = await state(page);
  await nudge(page, 0.5 * B);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThanOrEqual(end - 2);
  await nudge(page, -0.1 * B); // within the 0.2 band hold (R18): the page goes back to the end
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThanOrEqual(end - 2);
  await nudge(page, -0.3 * B); // past the hold: the page settles on P_5, not pulled down to the end
  await settled(page, 5);
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(start + 4 * B + 2);
});

test('a deep link below the section lands on the finished scene, with nothing playing', async ({ page }) => {
  await page.goto('/#traceability');
  await expect.poll(async () => {
    const near = await page.locator('section#how').evaluate((e) => e.getBoundingClientRect().top > -200);
    if (!near) await page.keyboard.press('PageUp');
    return near;
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  expect((await state(page)).t).toBe('5.000');
});
```

(The deep-link case reads `data-t` straight after `data-ready`: below the section the arrival commit is
step 5 and jumps, so `5.000` at once proves nothing played. If the reader paged up into the pin before
`data-ready`, the arrival step is lower; the poll stops while the section top is still above the viewport's
top, which keeps the reader below the pin end on every project — if a project disagrees, assert the step's
own `n.000` instead and say so in the report.)

`tests/e2e/animation.spec.ts` changes, each on purpose (spec §8 "updated"):
- "the scene pins and its captions advance": scroll to each settle point `start + (n − 1)·B` (B from
  `data-band`) instead of band midpoints; keep `end − start > 2 × viewport`.
- "scrolling back returns to step 1": the clock now plays back (about 5.4 s from step 5 to 0), so the transform
  expectations take `{ timeout: 15000 }`. The night hook may have changed in Task 2 (the sky layers); compare
  with still 1's own value for each hook rather than a literal.
- "resizing…": after the resize, scroll to settle points and wait for `data-band` to change, not band midpoints.
- Every other test is unchanged except for importing the helpers.

- [ ] **Step 1: Move the helpers** to tests/e2e/helpers.ts and import them in `tests/e2e/animation.spec.ts`;
  run `npx playwright test tests/e2e/animation.spec.ts --project=desktop` — PASS (pure move).
- [ ] **Step 2: Write tests/e2e/steps.spec.ts and the settle-point changes** to the old file; run
  `npm run build && npx playwright test tests/e2e/steps.spec.ts --project=desktop` — FAIL (no data-step yet).
- [ ] **Step 3: Write play.ts and rewire animate.ts.**
- [ ] **Step 4: Run all three projects:** `npx playwright test --project=phone --project=desktop --project=iphone`
  — PASS. If WebKit (iphone) snaps differently, read the failure before touching code: the snap must wait for
  scroll end, and `nudge` must be followed by `settled`, never a fixed sleep.
- [ ] **Step 5: `npm run verify`** — PASS, quality counts unchanged, no file over 400 lines.
- [ ] **Step 6: Commit** `feat(scene): each scroll starts a step and the step plays to its end`.
