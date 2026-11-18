# Task 6 — ambient loops and the closing guards

Part of the plan `docs/plans/2026-11-17-how-it-works-animation-plan.md`. Read its "Global Constraints" and
"Shared reference" sections first; they apply here. Spec: `docs/plans/2026-11-17-how-it-works-animation-design.md`
§3 (last paragraph: ambient loops), §7 (painting) and §8 ("no SVG filter"), with plan ruling R12 (animations
scoped under `[data-stage]`; ambient targets marked `data-amb`; no element has both a hook and `data-amb`).

### Task 6: Star twinkle, chimney smoke, lit-window pulse; guards over the built page

**Files:**
- Modify: src/components/scene/scene.css (keyframes and the three scoped rules)
- Modify: src/components/scene/parts/House.astro (the lit glow rect gets `data-amb="pulse"`)
- Modify: src/components/scene/play.ts (an IntersectionObserver sets `data-playing` on the stage while it is
  on screen)
- Test: tests/dist/scene.test.ts (extend), tests/unit/ambient.test.ts (new), tests/e2e/steps.spec.ts (extend)

**Interfaces:**
- Consumes: Task 2's stars (`data-amb="twinkle"`) and smoke puffs (`data-amb="smoke"`); Task 3's House glow
  rect; Task 5's `play(o)` and the stage element; `rulesOf` from `tests/helpers/css.ts`; `HOOKS` from
  `src/components/scene/view.ts`.
- Produces: the attribute `data-playing` on `[data-stage]` while any of it is in the viewport; the CSS
  contract below. Nothing else depends on it.

#### The CSS

```css
@media (prefers-reduced-motion: no-preference) {
  [data-stage][data-playing] [data-amb='twinkle'] { animation: scene-twinkle 2.4s ease-in-out infinite alternate; }
  [data-stage][data-playing] [data-amb='twinkle']:nth-of-type(3n + 1) { animation-delay: -0.8s; }
  [data-stage][data-playing] [data-amb='twinkle']:nth-of-type(3n + 2) { animation-delay: -1.6s; }
  [data-stage][data-playing] [data-amb='smoke'] { animation: scene-smoke 3.6s linear infinite; transform-box: fill-box; transform-origin: center; }
  [data-stage][data-playing] [data-amb='smoke']:nth-of-type(2) { animation-delay: -1.2s; }
  [data-stage][data-playing] [data-amb='smoke']:nth-of-type(3) { animation-delay: -2.4s; }
  [data-stage][data-playing] [data-amb='pulse'] { animation: scene-pulse 3s ease-in-out infinite alternate; }
}
@keyframes scene-twinkle { from { opacity: 1; } to { opacity: 0.35; } }
@keyframes scene-smoke { from { transform: translate(0, 0) scale(1); opacity: 0.7; } to { transform: translate(6px, -18px) scale(1.6); opacity: 0; } }
@keyframes scene-pulse { from { opacity: 1; } to { opacity: 0.75; } }
```

Only `opacity` and `transform` are animated (spec §7). The stills are outside `[data-stage]`, so they never
animate, and the stage stops animating once it scrolls away. Reduced motion never loads the script, so the
stage never exists; the media query is the second lock.

In play.ts, after `ScrollTrigger.create(...)`:

```ts
new IntersectionObserver(([e]) => { stage.toggleAttribute('data-playing', e.isIntersecting); }).observe(stage);
```

#### Tests

tests/unit/ambient.test.ts:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rulesOf } from '../helpers/css';

const css = readFileSync('src/components/scene/scene.css', 'utf8');

describe('ambient loops (spec §3, §7; ruling R12)', () => {
  it('every rule that runs an animation is scoped to the playing stage', () => {
    const animated = rulesOf(css).filter((r) => /(^|;|\s)animation(-name)?\s*:/.test(r.body) && !/^\s*(from|to|\d+%)/.test(r.selector));
    expect(animated.length).toBeGreaterThan(0);
    for (const r of animated) expect(r.selector, r.selector).toMatch(/^\[data-stage\]\[data-playing\] /);
  });
  it('keyframes move only opacity and transform', () => {
    const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)].map((m) => m[1]);
    expect(frames).toHaveLength(3);
    for (const body of frames)
      for (const [, prop] of body.matchAll(/([\w-]+)\s*:/g)) expect(['opacity', 'transform']).toContain(prop);
  });
});
```

If `rulesOf` returns a different shape (check tests/helpers/css.ts first), adapt the two property names, not
the assertions. If it does not see rules inside `@media`, extend it there (with a self-test in the file that
already tests it), because a guard that skips `@media` would pass on a broken page.

tests/dist/scene.test.ts:

```ts
it('has no SVG filter, mask or blur anywhere on the page', () => {
  const html = readFileSync(file, 'utf8');
  expect(html).not.toMatch(/<filter\b|<mask\b|feGaussianBlur|\bfilter\s*[:=]|\bmask\s*[:=]/);
});
it('keeps ambient markers and hooks on different elements (R12)', () => {
  for (const svg of stills(file))
    for (const el of svg.querySelectorAll('[data-amb]'))
      expect(Object.keys(el.attributes).filter((a) => a.startsWith('data-') && a.slice(5) in HOOKS), el.toString().slice(0, 80)).toEqual([]);
});
it('marks the stars, the smoke and the four lit glows for the ambient loops', () => {
  const svg = stills(file)[0];
  expect(svg.querySelectorAll('[data-amb="twinkle"]').length).toBeGreaterThanOrEqual(10);
  expect(svg.querySelectorAll('[data-amb="smoke"]')).toHaveLength(3);
  expect(svg.querySelectorAll('[data-amb="pulse"]')).toHaveLength(4);
});
```

(Use the star and smoke counts Task 2 drew; read them from Scene's parts before writing the numbers. The CSS
check covers built CSS too: if Astro inlines scene.css into the HTML, the first test reads it there.)

tests/e2e/steps.spec.ts, one more case:

```ts
test('the ambient loops run only while the stage is on screen', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(stage(page)).toHaveAttribute('data-playing', '');
  const star = stage(page).locator('[data-amb="twinkle"]').first();
  await expect.poll(() => star.evaluate((e) => getComputedStyle(e).animationName)).toBe('scene-twinkle');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(stage(page)).not.toHaveAttribute('data-playing', '');
  await expect(page.locator('#how ol[data-stills] [data-amb="twinkle"]').first()).toHaveCSS('animation-name', 'none');
});
```

- [ ] **Step 1: Write the failing tests** above.
- [ ] **Step 2: Run them:** `npm run build && npx vitest run tests/unit/ambient.test.ts tests/dist/scene.test.ts`
  — FAIL on the missing rules and the pulse markers.
- [ ] **Step 3: Add the CSS, the pulse marker and the observer.**
- [ ] **Step 4: Run everything:** `npm run verify`, then
  `npx playwright test --project=phone --project=desktop --project=iphone` — PASS; quality counts unchanged; no
  file over 400 lines; no doc over 600 lines.
- [ ] **Step 5: Look at it.** `npx astro preview` (stop it by pid afterwards), phone width 390 × 844 in the
  Playwright browser: scroll through all five steps one small scroll at a time; record one screenshot per
  settled step to the controller's scratch folder (path given in the dispatch) for the owner. Note anything
  that reads wrong at phone size (people, the van label, the QC sign) in the report; do not restyle on your
  own beyond fixing a clear defect.
- [ ] **Step 6: Commit** `feat(scene): star twinkle, chimney smoke and window glow, only while the stage is on screen`.
