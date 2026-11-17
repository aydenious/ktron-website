# Task 2 — tokens, Defs, Sky, Ground, Factory, generic painter

Part of the plan `docs/plans/2026-11-17-how-it-works-animation-plan.md`. Read its "Global Constraints" and
"Shared reference" sections first; they apply here. Spec: `docs/plans/2026-11-17-how-it-works-animation-design.md`
§4–§5. Shapes: `docs/plans/assets/2026-11-17-scene-mockup.py` (functions `sky`, `hills`, `palm`, `palms`,
`ground`, `factory`, `crate`, `stars`).

### Task 2: Scene tokens, shared defs, sky, ground, factory and the generic painter

**Files:**
- Modify: `src/styles/tokens.css` (one commented `--scene-*` block)
- Create: src/components/scene/scene.css (every scene class; global, imported once)
- Create: src/components/scene/parts/Defs.astro, Sky.astro, Ground.astro, Factory.astro
- Create: src/components/scene/paint.ts (the generic painter)
- Modify: `src/components/scene/layout.ts` (add `DOCK_SLOTS`)
- Modify: `src/components/scene/Scene.astro` (use the new parts; old sky, road and factory removed; houses,
  inspection and van stay for now but switch their hooks to `bind`)
- Modify: `src/components/HowItWorks.astro` (render `<Defs />` once, before the `ol`)
- Modify: `src/components/scene/animate.ts` (replace the old `painter` with `painter` from paint.ts)
- Modify: `tests/unit/contrast.test.ts` (scene folder exemption; scene text classes)
- Test: `tests/dist/how.test.ts`, new tests/dist/scene.test.ts

**Interfaces:**
- Consumes: `bind`, `HOOKS` (`src/components/scene/view.ts`); `stateAt`, `STILLS`, `STILL_T`, `SceneState`
  (`src/components/scene/steps.ts`); layout constants.
- Produces:
  - `DOCK_SLOTS: readonly (readonly [x: number, y: number])[]` = `[[132, 281], [154, 281], [143, 268], [143, 255]]`
    (crate k's top-left corner on the dock, world units; crates are 20 × 13).
  - `painter(root: Root): (s: SceneState) => void` in paint.ts, where
    `interface El { getAttribute(n: string): string | null; setAttribute(n: string, v: string): void }` and
    `interface Root { querySelectorAll(selector: string): Iterable<El> }` (a DOM `SVGSVGElement` and a
    node-html-parser element both fit).
  - Ids in Defs (exactly these): `scene-sky-day`, `scene-sky-sunset`, `scene-sky-night`, `scene-sky-dawn`,
    `scene-sun-halo`, `scene-moon-halo`, `scene-lit-glow`, `scene-lens-glow`, `scene-headlight`,
    `scene-clip-window-0` … `scene-clip-window-3`, `scene-clip-qc`.
  - Scene props stay `{ state: SceneState; lang: Lang }`.

#### Colour tokens (add to `src/styles/tokens.css`, one block, headed by a comment saying these are artwork
colours, never text colours, used only by the scene)

| Token | Value | Token | Value |
|---|---|---|---|
| --scene-sky-day-1 | #CFE0EE | --scene-wall-1 | #F6EEDC |
| --scene-sky-day-2 | #E9F0F4 | --scene-wall-2 | #DDE8F0 |
| --scene-sky-day-3 | #F6F2E4 | --scene-wall-3 | #E4EEDF |
| --scene-sky-sunset-1 | #1E3A66 | --scene-wall-4 | #F7E1D3 |
| --scene-sky-sunset-2 | #8A4F7D | --scene-curtain-1 | #E8B4A0 |
| --scene-sky-sunset-3 | #E9875B | --scene-curtain-2 | #9DB8D2 |
| --scene-sky-sunset-4 | #F7C873 | --scene-curtain-3 | #B9CFA0 |
| --scene-sky-night-1 | #06172E | --scene-curtain-4 | #E3C27A |
| --scene-sky-night-3 | #1B3A63 | --scene-roof | #A9472F |
| --scene-sky-dawn-1 | #2E4A78 | --scene-roof-line | #8A3A26 |
| --scene-sky-dawn-2 | #B98BA6 | --scene-glass | #A9C4DA |
| --scene-sky-dawn-3 | #F2B98C | --scene-lit | #FFD27A |
| --scene-sky-dawn-4 | #FCE3B6 | --scene-door | #7A5230 |
| --scene-sun | #F7D774 | --scene-door-panel | #6A4628 |
| --scene-sun-low | #FBD38D | --scene-pot | #B5683F |
| --scene-hill-day | #B7C9B0 | --scene-leaf | #5E8C61 |
| --scene-hill-dusk | #7B5C7A | --scene-leaf-2 | #6FA06F |
| --scene-hill-night | #132B4A | --scene-table | #7A5A3A |
| --scene-palm-day | #4E7D57 | --scene-ink | #2B2F36 |
| --scene-palm-dusk | #3E5E4A | --scene-cap-peak | #A8861D |
| --scene-palm-night | #0E2238 | --scene-scarf | #5E548E |
| --scene-trunk | #6E5A43 | --scene-skin-1 … -4 | #C68B59, #8D5524, #E0AC69, #A86B3C |
| --scene-verge | #8DB07F | --scene-skin-driver | #E3B48A |
| --scene-road | #5B6672 | --scene-skin-qc | #7A4A2A |
| --scene-grass | #9DBF8C | --scene-shirt-1 … -4 | #3F7CAC, #C8553D, #6A994E, #8E6C8A |
| | | --scene-trousers-1 … -3 | #3B4250, #4A3B30, #33415C |
| | | --scene-trousers-driver | #2B3440 |

Mockup colours that are already tokens: `#0B2545` navy (also the night sky's middle stop), `#13315C` navy-2,
`#C9A227` gold, `#F3E7B3` gold-soft, `#FFFFFF` and `#F4F4F4` white, `#1F2933` slate, `#E4E7EB` grey-1,
`#C9D3DD` grey-2, `#9AA5B1` grey-3. The mockup's `#000` shadow becomes `--scene-ink` at opacity 0.18. The
dawn stops are new (ruling R11). Tasks 3–4 use the person, house and table tokens; define them all now.

#### What each part draws (world units unless marked "view")

- **Defs** (`<svg class="visually-hidden" width="0" height="0" aria-hidden="true" focusable="false"><defs>`):
  - Linear gradients, vertical (`x1=0 y1=0 x2=0 y2=1`), stops evenly spaced: day (day-1, day-2, day-3),
    sunset (sunset-1…4), night (night-1, navy, night-3), dawn (dawn-1…4). Each `<stop>` takes its colour
    from a class (`.sc-stop-day-1 { stop-color: var(--scene-sky-day-1); }`).
  - Radial gradients, each from the colour at stop-opacity 0.9 (centre) to the same colour at 0 (edge):
    sun-halo (sun, centre opacity 0.35), moon-halo (gold-soft, 0.25), lit-glow (lit, 0.6), lens-glow
    (gold-soft, 0.9), headlight (gold-soft, 0.7; `cx="0" cy="0.5" r="1"` so it fans out from the lamp).
  - clipPaths (default `clipPathUnits`, world coordinates): window i = `rect x=HOUSE_X[i]−48 y=232 w=42 h=32`;
    qc = `rect x=826 y=228 w=72 h=44`.
- **Sky** (view coordinates, 800 × 320, drawn before the world group):
  - `rect` 800 × 320 `fill="url(#scene-sky-day)"`; then sunset, dawn and night rects (same size, their
    gradients) carrying `bind('sunset')`, `bind('dawn')`, `bind('night')` in that order.
  - Sun: `<g {...bind('sun', s)}>` containing a halo circle r 42 (`url(#scene-sun-halo)`), a disc r 26
    (`sc-sun`) and the low-sun disc r 26 (`sc-sun-low`) carrying `bind('dusk', s, 2)`.
  - Moon at view (150, 70): `<g {...bind('moon', s)}><g {...bind('moon-rise', s)}>` halo circle r 40
    (`url(#scene-moon-halo)`) and the crescent `<path class="sc-gold-soft" d="M -3.55 -21.72 A 22 22 0 1 0 19.55 10.08 A 20 20 0 0 1 -3.55 -21.72 Z">`
    translated to (150, 70). Check it renders as a crescent opening to the upper right (ruling R15).
  - Stars: `<g {...bind('stars', s)}>` with 16 white circles at view points
    `[[40,40],[130,80],[220,30],[310,70],[420,40],[520,90],[610,35],[700,75],[770,45],[90,125],[660,130],[360,110],[560,140],[470,20],[750,120],[170,130]]`,
    star k radius `1.2 + (k % 3) * 0.6`, opacity `0.6 + (k % 2) * 0.4`. Mark each `data-amb="twinkle"`
    (inert until Task 6).
- **Ground** (world): hills path `M0 262 Q120 212 260 246 T560 236 T860 232 T1040 244 V320 H0 Z` three times
  (`sc-hill-day`; `sc-hill-dusk` with `bind('dusk', s, 0)`; `sc-hill-night` with `bind('dark', s, 0)`);
  palms from mockup `palms()` (trunk `sc-stroke-trunk`, fronds as strokes) three times in the same pattern
  (day; dusk with `bind('dusk', s, 1)`; night with `bind('dark', s, 1)`); then mockup `ground()`: verge y 300
  h 18, road y 316 h 38, white dashes 26 × 3 at y 333 every 52 from x 10, kerb grey-2 y 352 h 7, grass y 359
  h 41, all 1040 wide.
- **Factory** (mockup `factory()` with its offset −20 already applied, so the body spans x 20–230):
  - Smoke: circles (204, 128, r 8, opacity 0.8), (214, 110, r 11, 0.6), (230, 90, r 15, 0.4), white, each
    `data-amb="smoke"`.
  - Chimney grey-3 x 195 y 136 w 16 h 66 with a gold band at y 146 h 6; three sawtooth teeth (navy-2 path
    `M{20+70k} 200 V168 L{90+70k} 200 Z` with a glass strip x 20+70k w 7 y 168 h 32); body grey-1 x 20 y 200
    w 210 h 100; fascia navy x 20 y 200 w 210 h 22; sign `<text class="text-factory" x="125" y="216"
    text-anchor="middle" font-size="13" font-weight="800">{t(lang, 'scene.factory')}</text>`.
  - Three windows (glass x 32+30k y 234 w 22 h 18, white mullion x 42+30k w 1.5).
  - Roller door: the opening x 140 y 236 w 72 h 64 in slate with a grey-2 lintel band h 14; over it the
    shutter `<g {...bind('factory-door', s)}>` = grey-2 rect x 140 y 236 w 72 h 64 plus ten grey-3 slats
    (x 142 w 68 h 1.2 at y 240 + 6k). `view.factoryDoor` scales it up into the fascia (`ROLLER_TOP` 236).
  - Dock plate grey-3 x 130 y 294 w 94 h 8; crates at `DOCK_SLOTS[k]` (mockup `crate()`: gold 20 × 13 rx 1.6
    and a navy band at +5 h 2.4 opacity 0.28) each in `<g {...bind('dock-crate', s, k)}>`.
  - Wash: `<path class="sc-night-1" d="M20 168 H230 V300 H20 Z M195 136 h16 v32 h-16 Z" {...bind('wash', s, 4)}>`
    (or an equivalent outline of chimney, roof and body).
- **Font**: scene text uses `font-family: 'Manrope Variable', system-ui, sans-serif` from scene.css on
  `.scene text`, not per element.

- [ ] **Step 1: Write the failing dist tests.** Create tests/dist/scene.test.ts, reading `dist/index.html`
  and `dist/zh/index.html` with node-html-parser the way `tests/dist/how.test.ts` does:

```ts
import { readFileSync } from 'node:fs';
import { parse, type HTMLElement } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { painter } from '../../src/components/scene/paint';
import { STILLS } from '../../src/components/scene/steps';
import { HOOKS } from '../../src/components/scene/view';

const pages = ['dist/index.html', 'dist/zh/index.html'];
const stills = (file: string) => parse(readFileSync(file, 'utf8')).querySelectorAll('#how ol[data-stills] svg.scene');
const hooked = (svg: HTMLElement) =>
  Object.keys(HOOKS).flatMap((h) => svg.querySelectorAll(`[data-${h}]`).map((el) => [h, el] as const));

describe.each(pages)('%s scene', (file) => {
  it('draws each gradient and clip once, outside the stills, and every url(#…) resolves', () => {
    const html = readFileSync(file, 'utf8');
    const root = parse(html);
    expect(root.querySelectorAll('#how ol[data-stills] [id]')).toHaveLength(0);
    for (const ref of new Set([...html.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]))) expect(root.querySelectorAll(`#${ref}`)).toHaveLength(1);
  });
  it('every hooked attribute in every still is the model value at that still', () => {
    stills(file).forEach((svg, k) => {
      for (const [h, el] of hooked(svg)) {
        const b = HOOKS[h as keyof typeof HOOKS];
        expect(el.getAttribute(b.attr), `${h}=${el.getAttribute(`data-${h}`)} in still ${k + 1}`).toBe(String(b.value(STILLS[k], Number(el.getAttribute(`data-${h}`)))));
      }
    });
  });
  it('painting a still\'s moment onto still 1 gives that still, attribute for attribute', () => {
    const all = stills(file);
    STILLS.forEach((s, k) => {
      const copy = parse(all[0].outerHTML).querySelector('svg')!;
      painter(copy)(s);
      const want = hooked(all[k]).map(([h, el]) => `${h}${el.getAttribute(`data-${h}`)}=${el.getAttribute(HOOKS[h as keyof typeof HOOKS].attr)}`);
      expect(hooked(copy).map(([h, el]) => `${h}${el.getAttribute(`data-${h}`)}=${el.getAttribute(HOOKS[h as keyof typeof HOOKS].attr)}`)).toEqual(want);
    });
  });
  it('has the sky layers, the factory door and the dock crates', () => {
    for (const h of ['sunset', 'dawn', 'night', 'sun', 'moon', 'moon-rise', 'stars', 'factory-door', 'wash']) expect(stills(file)[0].querySelectorAll(`[data-${h}]`).length, h).toBeGreaterThan(0);
    expect(stills(file)[0].querySelectorAll('[data-dock-crate]')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run them to see them fail.** `npm run build && npx vitest run tests/dist/scene.test.ts` —
  expected FAIL (no paint module; old hooks lack indices; no Defs).
- [ ] **Step 3: Add the tokens, scene.css and Defs.** Render `<Defs />` in `src/components/HowItWorks.astro`
  inside `.wrap`, before the `ol` (once per page). Import scene.css in Scene.astro's frontmatter
  (`import './scene.css';`) and in Defs.
- [ ] **Step 4: Write paint.ts** (ruling R8):

```ts
// The browser painter: every element carrying data-<hook>="<i>" gets HOOKS[hook].attr from the model.
// Only changed values are written. The server drawing writes the same values with bind (view.ts).
import type { SceneState } from './steps';
import { HOOKS } from './view';

interface El { getAttribute(name: string): string | null; setAttribute(name: string, value: string): void }
interface Root { querySelectorAll(selector: string): Iterable<El> }

export function painter(root: Root): (s: SceneState) => void {
  const targets = Object.entries(HOOKS).flatMap(([hook, b]) =>
    [...root.querySelectorAll(`[data-${hook}]`)].map((el) => ({ el, b, i: Number(el.getAttribute(`data-${hook}`)), last: el.getAttribute(b.attr) })),
  );
  return (s) => {
    for (const x of targets) {
      const v = String(x.b.value(s, x.i));
      if (v !== x.last) { x.el.setAttribute(x.b.attr, v); x.last = v; }
    }
  };
}
```

  In `src/components/scene/animate.ts` delete the old `painter` and import this one; keep everything else.
- [ ] **Step 5: Draw Sky, Ground and Factory; compose them in Scene.astro.** Sky goes first, outside
  `<g data-world>`; Ground and Factory open the world group. Delete the old sky, night, stars, sun, road,
  route path, factory and `FACTORY_CRATES`. The old houses, inspection house and van stay, but every hook on
  them becomes `bind(…)` with its index (`lit` and `house-crate` per house i, `van-crate` j, `lens`, `van`,
  `van-body`), so the generic painter and tests hold. Their old colour classes move to scene.css.
  Add `DOCK_SLOTS` to `src/components/scene/layout.ts` with a one-line comment.
- [ ] **Step 6: Contrast guard** (`tests/unit/contrast.test.ts`, ruling R13):
  - `GRAPHIC_FILES` becomes a folder rule: `['src/components/scene/', reason]`, matched with
    `r.file.startsWith(dir)`; the staleness test also asserts each folder exists.
  - Add to `TEXT`: `['scene: factory sign', 'white', 'navy']`, `['scene: van name', 'navy', 'white']`,
    `['scene: QC sign', 'navy-2', 'white']`.
  - Add `SCENE_TEXT: [selector: string, pair: string][]` = `[['.text-factory', 'scene: factory sign'],
    ['.text-van', 'scene: van name'], ['.text-qc', 'scene: QC sign']]` and
    `DECORATIVE_SCENE_TEXT = ['.text-house-no', '.text-shirt']` (house numbers, the driver's shirt print;
    each with a one-line reason).
  - New test: every `<text` in a file under src/components/scene/ has a `class` with one `text-…` class; every
    `.text-…` rule in scene.css is in `SCENE_TEXT` or `DECORATIVE_SCENE_TEXT`; for `SCENE_TEXT`, the rule's
    `fill` token equals the pair's foreground; every listed selector has a rule (no stale entries). Add two
    "guard itself" cases: an unlisted `.text-x` rule is flagged; a `.text-factory` with the wrong fill is flagged.
  - Keep the existing self-test for the Scene.astro exemption passing.
- [ ] **Step 7: Update `tests/dist/how.test.ts` on purpose** (ruling R7): the lit-window assertion follows
  the model per still (`view.lit(STILLS[k], i)`), so still 2 has four lit windows. Remove assertions now
  covered by the generic "every hooked attribute" test only if they test nothing else.
- [ ] **Step 8: Run everything.** `npm run verify` — expected PASS, quality counts unchanged (knip 0). Look at
  `dist/index.html` stills in a browser (`npx astro preview`, then stop it by pid) at t = 2 and 2.25: sunset
  sky, night sky with moon and stars, factory door shut at night.
- [ ] **Step 9: Commit** `feat(scene): scene tokens, shared defs, sky, ground and factory; one generic painter`.
