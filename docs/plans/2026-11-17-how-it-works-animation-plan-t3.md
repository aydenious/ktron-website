# Task 3 — people and houses

Part of the plan `docs/plans/2026-11-17-how-it-works-animation-plan.md`. Read its "Global Constraints" and
"Shared reference" sections first; they apply here. Spec: `docs/plans/2026-11-17-how-it-works-animation-design.md`
§4. Shapes: `docs/plans/assets/2026-11-17-scene-mockup.py` functions `head`, `torso`, `legs`, `person`, `bust`,
`window`, `house` (copy their coordinates; replace every colour with the `--scene-*` or brand token named
below through a class in src/components/scene/scene.css).

### Task 3: Person, Bust and House parts; residents and the driver in the scene

**Files:**
- Create: src/components/scene/parts/looks.ts (the five looks as class-name sets)
- Create: src/components/scene/parts/Head.astro, Person.astro, Bust.astro, House.astro
- Modify: src/components/scene/scene.css (skin, shirt, trousers, hair, house classes)
- Modify: `src/components/scene/Scene.astro` (old houses replaced by four `House`; four resident `Person`s and
  the driver `Person` drawn after the buildings and before the van)
- Test: tests/dist/scene.test.ts (extend), tests/unit/looks.test.ts

**Interfaces:**
- Consumes (Task 2): `bind`; scene.css; Defs ids `scene-clip-window-0…3`, `scene-lit-glow`; Task 1 layout
  `HOUSE_X`, `WALK_Y`, `DOOR`, `KERB`, `HINGE_DX`; `SceneState.residents[i]`, `driver`, `houseCrates`, `lit`.
- Produces (Task 4 consumes `Bust` and `LOOKS.qc`):
  - `interface Look { skin: string; shirt: string; trousers: string; hair: 'short' | 'scarf' | 'bun' | 'cap'; coat?: boolean; print?: boolean }`
    where `skin`, `shirt`, `trousers` are class names (`sc-skin-1`, `sc-shirt-2`, `sc-trousers-driver`, …).
  - `LOOKS: { residents: readonly [Look, Look, Look, Look]; driver: Look; qc: Look }`:
    residents = (skin-1, shirt-1, trousers-1, short), (skin-2, shirt-2, trousers-2, scarf),
    (skin-3, shirt-3, trousers-3, bun), (skin-4, shirt-4, trousers-1, short);
    driver = (skin-driver, `sc-navy-2`, trousers-driver, cap, print: true);
    qc = (skin-qc, `sc-white`, trousers-1, short, coat: true).
  - `Person.astro` props `{ who: 'driver' | 'resident'; i?: number; look: Look; s: SceneState }`.
  - `Bust.astro` props `{ look: Look; x: number; y: number; scale: number }` (static; no hooks).
  - `House.astro` props `{ i: 0 | 1 | 2 | 3; s: SceneState }`.

#### Drawing rules

- **Head** (mockup `head(look, cy)`; prop `cy`, default −40): neck, face circle, hair by style (short: ink
  cap of hair; scarf: `sc-scarf` hood with the face ellipse over it; bun: ink bun and hair; cap: gold dome,
  gold brim, `sc-cap-peak` shade). Eyes and mouth go in their own group; Person puts the face hook on that
  group only, so the eyes look the way the person walks (`view.face` shifts them by 1.5).
- **Person** (scale 1.35 inside the walker group, feet at y 0; ruling R17):

```astro
<g {...bind(`${who}`, s, i)}>
  <g {...bind(`${who}-show`, s, i)}>
    <g transform="scale(1.35)">
      <g transform="translate(-3.4 -16)"><g {...bind(`${who}-leg-a`, s, i)}><!-- leg: rect x -2.6 y 0 w 5.2 h 15 rx 2; shoe ellipse cx -0.2 cy 15.4 rx 3.6 ry 1.6 --></g></g>
      <g transform="translate(3.4 -16)"><g {...bind(`${who}-leg-b`, s, i)}><!-- the same leg --></g></g>
      <!-- torso (mockup torso: shirt rect, collar; driver: gold KTRON print class text-shirt; qc: coat outline and placket) -->
      <g {...bind(`${who}-arms`, s, i)}><!-- mockup person pose 'stand' arms and hands --></g>
      <g {...bind(`${who}-crate`, s, i)}><!-- mockup person pose 'carry': crate, raised arms, hands --></g>
      <Head look={look} face={bind(`${who}-face`, s, i)} />
    </g>
  </g>
</g>
```

  (Template literals stand for the literal hook names; write `'driver-leg-a'` etc. or a typed helper, since
  `bind` takes the `Hook` union. A helper `const h = (part: string) => \`${who}-${part}\` as Hook` needs `Hook`
  exported from `src/components/scene/view.ts`; export it.) The hip translate makes `rotate` swing each leg
  about the hip. The driver's walker index is 0.
- **Bust** (mockup `bust`): a static seated person (torso moved down 17, arms to the table, head at cy −23),
  wrapped in `translate(x y) scale(scale)`.
- **House i** (mockup `house(x, i, lit, door, worker)` with x = `HOUSE_X[i]`, L = x − 60), in this order:
  1. Walls `sc-wall-(i+1)` (L, 212, 120 × 88); roof `sc-roof` path; 17 tile lines `sc-stroke-roof-line`
     (opacity 0.35); white fascia; navy-2 porch canopy path.
  2. Window frame (white), glass `sc-glass`, both curtains `sc-curtain-(i+1)`, white sill. No mullion or bars.
  3. Door frame: the open doorway (slate rect x+4, 256, 26 × 44), then the door leaf
     `<g {...bind('house-door', s, i)}>` = wood rect, panel rect (x+8, 261, 18 × 15, rx 1), gold knob.
     `view.houseDoor` narrows it about the hinge (x + `HINGE_DX`).
  4. Plant pot and two leaf circles (`sc-pot`, `sc-leaf`, `sc-leaf-2`); the white plinth band (opacity
     0.55); the house number `<text class="text-house-no" …>{12 + i * 2}</text>` (opacity 0.6).
  5. Wash: `<path class="sc-night-1" d="M{L-6} 216 L{x} 176 L{L+126} 216 H{L+120} V300 H{L} V216 Z" {...bind('wash', s, i)}/>`.
  6. The lit group `<g {...bind('lit', s, i)}>`: glow rect (window ± 10, `url(#scene-lit-glow)`), lit glass
     `sc-lit` (x−50, 230, 46 × 36), then `<g clip-path="url(#scene-clip-window-{i})">` holding the resident's
     `Bust` (look `LOOKS.residents[i]`, x − 27, 259, scale 0.9), the table (`sc-table`, x−50, 257, 46 × 3), two
     slate part pieces, and the crate on the table `<rect class="sc-gold" … {...bind('house-crate', s, i)}/>`
     (x − 24, 253, 9 × 4.5, rx 0.8); then both curtains again and the sill, so they sit over the light.
  The lit group comes after the wash, so a lit window is never dimmed (ruling R9).
- **In Scene.astro**: four `House` in place of the old houses; after the inspection house (still the old
  one until Task 4) draw `Person who="resident" i={k} look={LOOKS.residents[k]}` for k 0–3, then the driver,
  then the van. Remove the old house markup and its classes.

- [ ] **Step 1: Write the failing tests.** In tests/unit/looks.test.ts: every class named in `LOOKS` has a
  rule in src/components/scene/scene.css (read with `rulesOf` from `tests/helpers/css.ts`) whose `fill` is a
  `var(--scene-…)` or brand token; the five looks are pairwise different in skin. Extend tests/dist/scene.test.ts:

```ts
it('draws four houses with their own door, lit window and table crate, and five walkers', () => {
  const svg = stills(file)[0];
  for (const h of ['house-door', 'lit', 'house-crate', 'resident', 'resident-show', 'resident-face', 'resident-crate', 'resident-arms', 'resident-leg-a', 'resident-leg-b'])
    expect(svg.querySelectorAll(`[data-${h}]`).map((el) => el.getAttribute(`data-${h}`)).sort(), h).toEqual(['0', '1', '2', '3']);
  for (const h of ['driver', 'driver-show', 'driver-face', 'driver-crate', 'driver-arms', 'driver-leg-a', 'driver-leg-b'])
    expect(svg.querySelectorAll(`[data-${h}]`), h).toHaveLength(1);
  expect(svg.querySelectorAll('[data-wash]').map((el) => el.getAttribute('data-wash')).sort()).toEqual(['0', '1', '2', '3', '4']);
});
it('shows the driver carrying a crate in front of the factory in the last still', () => {
  const last = stills(file)[4];
  expect(last.querySelector('[data-driver-show]')!.getAttribute('visibility')).toBe('visible');
  expect(last.querySelector('[data-driver-crate]')!.getAttribute('visibility')).toBe('visible');
  expect(last.querySelector('[data-driver]')!.getAttribute('transform')).toBe('translate(190 316)');
});
```

- [ ] **Step 2: Run to see them fail.** `npm run build && npx vitest run tests/dist/scene.test.ts tests/unit/looks.test.ts`.
- [ ] **Step 3: Write looks.ts, Head, Person, Bust, House and the scene.css classes.** Export `Hook` from
  view.ts. Keep each .astro part under 120 lines; repeated markup (a leg, a curtain pair) is a small inline
  component or a `.map` over data, never copied (jscpd must stay at 0 clones).
- [ ] **Step 4: Compose in Scene.astro** as described above.
- [ ] **Step 5: Run everything.** `npm run verify` — PASS, quality counts unchanged. Check the "painting a
  still's moment onto still 1" test passes: every new hook is painted. Look at the stills in a browser
  (`npx astro preview`; stop it by pid): still 2 (t = 2) shows four lit windows with a person at a table in
  each; no bars in any window; residents hidden while their doors are shut.
- [ ] **Step 6: Commit** `feat(scene): houses with residents, the driver, and seated people in the windows`.
