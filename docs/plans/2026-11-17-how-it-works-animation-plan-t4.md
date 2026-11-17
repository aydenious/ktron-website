# Task 4 — inspection house, van, final composition

Part of the plan `docs/plans/2026-11-17-how-it-works-animation-plan.md`. Read its "Global Constraints" and
"Shared reference" sections first; they apply here. Spec: `docs/plans/2026-11-17-how-it-works-animation-design.md`
§4 and §7 (weight). Shapes: `docs/plans/assets/2026-11-17-scene-mockup.py` functions `inspection`, `van`,
`crate`.

### Task 4: Inspection and Van parts, the QC sign text, the finished Scene and its weight

**Files:**
- Create: src/components/scene/parts/Inspection.astro, Van.astro
- Modify: `src/components/scene/view.ts` (add the `van-load` hook)
- Modify: `src/components/scene/Scene.astro` (final composition; every old drawing piece gone)
- Modify: src/components/scene/scene.css
- Modify: `src/i18n/en.json`, `src/i18n/zh.json` (add `scene.qc`)
- Test: `tests/unit/steps.test.ts` (van-load), tests/dist/scene.test.ts (extend), `tests/dist/how.test.ts`

**Interfaces:**
- Consumes: `bind`, `Hook`; `Bust` and `LOOKS.qc` (Task 3, src/components/scene/parts/looks.ts); Defs ids
  `scene-clip-qc`, `scene-lens-glow`, `scene-headlight` (Task 2); `t(lang, key)` from `src/i18n`.
- Produces: `HOOKS['van-load']` = `at('transform', (s) => \`translate(${(1 - s.facing) * 5} 0)\`)` (ruling R10);
  i18n key `scene.qc`: en "QC 10x", zh "质检 10x"; the final draw order (plan index, "Draw order").

#### Drawing rules

- **Inspection** (world; I = `INSPECT_X` 880), in this order:
  1. White body (815, 206, 130 × 94); navy roof bar (808, 198, 144 × 10); the sign
     `<text class="text-qc" x="880" y="222" text-anchor="middle" font-size="8" font-weight="800">{t(lang, 'scene.qc')}</text>`.
  2. The room `<g clip-path="url(#scene-clip-qc)">`: glass rect (826, 228, 72 × 44); `<Bust look={LOOKS.qc}
     x={850} y={261} scale={1.05} />`; desk `sc-table` (826, 258, 72 × 4); the navy microscope (base rect 866,
     254, 14 × 4 rx 1; column `M873 254 v-10` stroke 2.6; tube `M869 242 l8 -6` stroke 4 round; grey-2
     eyepiece 871, 244, 5 × 3); the inspector's white forearm `M856 248 L866 244` stroke 3.6 round; a crate at
     (884, 245) (gold 20 × 13 rx 1.6 with the navy band, like the dock crates).
  3. White frame rect (824, 226, 76 × 48, stroke 2.5, no fill); navy-2 door (908, 256, 26 × 44).
  4. Wash `<path class="sc-night-1" d="M808 198 H952 V208 H945 V300 H815 V208 H808 Z" {...bind('wash', s, 5)}/>`.
  5. The magnifier sign: navy-2 pole (878, 150, 4 × 48); glow `<circle cx="880" cy="128" r="36"
     fill="url(#scene-lens-glow)" {...bind('qc-glow', s)}/>`; ring circle (880, 128) r 18 navy-2 fill with a
     gold stroke 6; handle `M893 141 L906 154` gold stroke 7 round; the lens glass `<circle cx="880" cy="128"
     r="14" class="sc-gold-soft" {...bind('lens', s)}/>` (the sign lights up while inspecting).
  6. Tick `<g transform="translate(920 104)"><g {...bind('tick', s)}>` gold circle r 11, white check
     `M-5 0 l4 4 l7 -8` stroke 2.6 round `</g></g>` (`view.tick` scales it about its centre).
- **Van** (`view.van` puts it at the van's x on `ROAD_Y`):

```astro
<g {...bind('van', s)}>
  <g {...bind('van-body', s)}>
    <!-- shadow: ellipse cx 10 cy 2 rx 52 ry 4, class sc-ink, opacity 0.18 -->
    <!-- mockup van body: box rect, cab path, navy-2 window, navy and gold stripes, grey-1 lamp, grey-3 rack -->
    <!-- wheels, k = 0 at x −22 and k = 1 at x 42: -->
    <g transform="translate(-22 -6)"><g {...bind('wheel', s, 0)}><!-- slate r 9; grey-2 hub r 3.6; one slate notch rect x -0.6 y -3.6 w 1.2 h 2.4, so the turn shows --></g></g>
    <path class="sc-night-1" d="M-40 -54 H30 V-42 H46 L58 -24 V-8 H-40 Z" {...bind('wash', s, 6)} />
    <path d="M58 -18 L130 -30 L130 2 Z" fill="url(#scene-headlight)" {...bind('headlight', s)} />
  </g>
  <g {...bind('van-load', s)}>
    <!-- four rack crates, k = 0…3, each <g {...bind('van-crate', s, k)}>: gold rect x −36 + 16k, y −66, 14 × 12 rx 1.5 + navy band y −61 h 2 opacity 0.3 -->
    <text class="text-van" x="-5" y="-30" text-anchor="middle" font-size="14" font-weight="800">KTRON</text>
  </g>
</g>
```

  The label and crates stay outside the flip group (text is never mirrored); `van-load` keeps them centred on
  the box whichever way the van faces. "KTRON" is the company's own name and stays untranslated.
- **Scene.astro**: Sky; then `<g {...bind('world', s)}>` with Ground, Factory, four Houses, Inspection, four
  residents, the driver, Van. Nothing from the old drawing remains (no old classes, no `FACTORY_CRATES`).

- [ ] **Step 1: Write the failing tests.**
  - `tests/unit/steps.test.ts`: `HOOKS['van-load'].value(stateAt(0.5), 0)` is `translate(0 0)` and at t = 2.6
    (facing −1) is `translate(10 0)`.
  - tests/dist/scene.test.ts:

```ts
it('draws the inspection house, the van and its load, and every wash', () => {
  const svg = stills(file)[0];
  for (const h of ['qc-glow', 'lens', 'tick', 'van', 'van-body', 'headlight', 'van-load']) expect(svg.querySelectorAll(`[data-${h}]`), h).toHaveLength(1);
  expect(svg.querySelectorAll('[data-wheel]')).toHaveLength(2);
  expect(svg.querySelectorAll('[data-van-crate]')).toHaveLength(4);
  expect(svg.querySelectorAll('[data-wash]').map((el) => el.getAttribute('data-wash')).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  expect(svg.querySelector('[data-van-body] text')).toBeNull();
});
it('uses at most 60 hooked elements per scene and no filter or mask', () => {
  const svg = stills(file)[0];
  expect(svg.querySelectorAll('*').filter((el) => Object.keys(el.attributes).some((a) => a.startsWith('data-') && a.slice(5) in HOOKS)).length).toBeLessThanOrEqual(60);
  expect(svg.querySelectorAll('filter, mask, [filter], [mask]')).toHaveLength(0);
});
it('stays light: the gzipped page is at most 30 KB', () => {
  expect(gzipSync(readFileSync(file)).length).toBeLessThanOrEqual(30 * 1024);
});
```

  (import `gzipSync` from `node:zlib`). Expected count: 39 hook names, about 58 hooked elements. If it
  passes 60, do not raise the cap; report the count and the hooks that repeat most, and stop (status
  DONE_WITH_CONCERNS) so the controller rules on which to merge.
  - `tests/dist/how.test.ts`: the van-crate count per still follows the model (`STILLS[k].vanCrates`); the
    QC sign reads "QC 10x" (en) and "质检 10x" (zh) in every still.
- [ ] **Step 2: Run to see them fail.** `npm run build && npx vitest run tests/dist tests/unit/steps.test.ts`.
- [ ] **Step 3: Add `van-load` to HOOKS and the `scene.qc` strings** (both languages, next to
  `scene.factory`).
- [ ] **Step 4: Draw Inspection and Van; finish Scene.astro.**
- [ ] **Step 5: Run everything.** `npm run verify` — PASS, quality counts unchanged; then
  `npx playwright test tests/e2e/weight.spec.ts --project=desktop` — PASS. If the gzipped page passes 30 KB,
  move the static repeated drawings (the busts, the palms) into Defs as `<symbol id="scene-…">` and draw
  them with `<use href="#scene-…">`; hooks never go inside a symbol. Look at all five stills in a browser at
  phone width (`npx astro preview`; stop it by pid): van label readable both ways, the sign's lens lit only in
  still 4, the tick in still 4, the driver with a crate in front of the factory in still 5.
- [ ] **Step 6: Commit** `feat(scene): inspection house and van; the finished scene`.
