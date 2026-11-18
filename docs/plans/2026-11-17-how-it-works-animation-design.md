# "How it works" animation redesign — design

> **Status (2026-11-18):** the storyboard and the look (mockup v2) are approved by the owner. The scroll model
> of 2026-11-17 was replaced on 2026-11-18 by autoplay (§2). The implementation plans are in `docs/archive/`.

## 1. What the owner asked for

- **Scroll in step with the story** (2026-11-17; replaced by §2 on 2026-11-18). On a phone, one swipe left the van
  halfway down the street, and a second swipe finished the delivery. The section says "5 steps", so five
  scrolls should have shown five complete steps.
- **A richer scene.**
  - The day turns: sunset while the van delivers, then moon and stars at night, then sunrise when it comes
    back to collect.
  - Better houses, with people at the door who take the parcel in and bring it out again the next day.
  - The van drives past every house.
  - A better factory.
  - The driver, in a cap, is seen at the factory at the end.

**Cause of the sync problem:** `src/components/scene/animate.ts` scrubs one linear clock across 3 screens on a
phone (4 on a desktop). Each step therefore gets 0.6 of a screen, and step 2's frames run until t 1.85. Most
swipes end part-way through a step.

## 2. Playback: plays once on its own; tap to replay

*2026-11-18: this replaced the scroll model of 2026-11-17 (pin, settle points, committed steps, snap) at the
owner's request. They asked "how difficult is it to split the animation from page scrolling?", were offered
autoplay, step dots and a pause button, and answered: "make it play once, and replay if clicked or tapped". The
scroll model is in git history (PR #8, ef4b166).*

The page scrolls exactly as if the section were a still image. A clock drives the scene, not the scroll.

- **No scroll-jacking.** No pin, no snap, no ScrollTrigger, no wheel or touch listener that changes the scroll.
  The stage is its figure and its controls, as tall as they are. `tests/unit/no-scroll-jacking.test.ts` fails if
  any file in `src` brings one back; changing that test is how it would come back on purpose.
- **Autoplay, once.** The scene waits at clock 0 (the opening frame). The first time at least 60 % of the stage is
  in the viewport it plays t 0 → 5 at normal speed, each step k lasting `CLIP[k − 1]` (§3). The counter and
  caption change as each step starts (at t = k − 1). At t = 5 it stops on the final scene and never plays again
  by itself, not even after the reader scrolls away and back. (A stage taller than the viewport, a phone held
  sideways, counts as on screen once it fills 60 % of the viewport, since 60 % of it can never show.)
- **Off screen is paused.** If the stage drops below 60 % while playing, the clock pauses where it is and resumes
  from there when the stage is back. The ambient loops keep their own on-screen rule (`data-playing`).
- **One control.** A real button in the stage's bottom-right corner, outside any `aria-hidden` part, at least
  44 × 44 px. Its label and icon follow the state: **Pause** while playing, **Play** while paused by the button
  (and before the first autoplay, when it starts the scene), **Replay** when finished (restarts from t 0). A click
  or tap anywhere on the scene does what the button does; the scene has `cursor: pointer`. A scene the reader
  paused does not resume by itself when it comes back on screen. This is the pause WCAG 2.2.2 asks for (moving
  content longer than 5 s).
- **Step dots.** Five buttons under the scene, each a 44 × 44 tap target with a smaller visible dot, named "Step k"
  ("第k步"), `aria-current="step"` on the current one. Dot k sets the clock to k − 1 and plays on to t 5, then stops
  as above. Keyboard-reachable with the page's focus ring.
- **Reduced motion and no JS** are unchanged (§6): the five stills, no stage, no controls.
- **The page does not jump.** The stage replaces five stacked stills, so the section changes height when setup
  runs. Setup turns scroll anchoring and smooth scrolling off for that moment, scrolls a reader who is below the
  section by the change in height so what they look at does not move, finishes a deep link's own scroll first and
  puts the target back if a late scroll frame lands short, and follows a header link clicked while the script
  downloaded again afterwards. A reader who arrives below the section has not seen the scene: it waits at t 0 and
  plays the first time it is 60 % on screen.
- **State for tests.** The section carries `data-step` (1–5), `data-t` (3 decimals) and `data-play`
  (`idle`, `playing`, `paused` or `done`).

The pure part is `src/components/scene/clock.ts` (clip lengths, `advance`, what the button and the dots do in each
state, when the stage counts as on screen); `src/components/scene/play.ts` wires it to one `requestAnimationFrame`
loop over `performance.now()`. A frame later than 0.1 s after the last (a hidden tab) moves the clock by 0.1 s,
so a stalled page never jumps ahead.

## 3. Storyboard

The clock t runs from 0 to 5 in steps, as today. Step k is t from k − 1 to k. Clip lengths are constants that
can be tuned after the owner sees it.

Clips run 3–5 s, longer than the 2–3 s first mentioned, because steps 2 and 3 each visit four houses. The whole
story takes about 18 s.

| Step | t | Clip | Sky | What happens |
|---|---|---|---|---|
| 1 | 0–1 | 3.0 s | afternoon | The van stands at the factory dock facing right, empty, with the roller door open, 4 crates on the dock and the driver (cap, KTRON shirt) beside them. **0.05–0.65:** four trips of 0.15. The driver picks up a crate, walks to the van's rear, the crate appears on the van, and the driver walks back. **0.65–0.72:** the driver walks to the cab and gets in. **0.65–0.80:** the roller door closes. **0.80–1.00:** the van pulls off to house 1's stop. Chimney smoke drifts the whole time. |
| 2 | 1–2 | 4.0 s | afternoon → sunset | The sun sinks to the right-hand hills. For each house i, starting at b = 1 + 0.25·i: **b–b+0.10** the van drives to the house's stop (it is already there for house 1). **+0.10–0.13** the door opens and the resident walks out to the kerb. **+0.13–0.15** the crate passes from the van to the resident's hands. **+0.15–0.20** the resident walks in and the door closes. **+0.20–0.25** the window lights up and the resident is seen at the table. Headlights come on from t 1.6. |
| 3 | 2–3 | 5.0 s | night → sunrise → morning | **2.00–2.15:** night falls, the moon rises at the left, and the stars come out and twinkle. **2.15–2.30:** full night, with four lit windows and a worker at each table with a gold crate and parts. The van stands at house 4 with its headlights off. **2.30–2.40:** sunrise in the east (left), and the dawn sky fades to morning by 2.55. **2.40–3.00:** the van collects from house 4 back to house 1. At each house (0.075) the resident comes out carrying the crate (0.03), hands it over (0.015) and goes back in (0.03), and the window goes dark. Between houses the van drives for 0.10 (4 × 0.075 + 3 × 0.10 = 0.60). The van turns to face left while standing, at 2.40. |
| 4 | 3–4 | 3.0 s | morning | **3.00–3.04:** the van turns to face right while standing. **3.04–3.60:** it drives right past every house to the inspection house. **3.60–3.75:** the QC window glows, with the inspector in a white coat at the 10x microscope and crates beside the desk. **3.75–3.85:** the lens sign glows. **3.85–3.95:** a tick pops in. |
| 5 | 4–5 | 3.5 s | late morning | **4.00–4.05:** the van turns to face left. **4.05–4.55:** it drives back to the factory and the camera pans with it. **4.55–4.60:** the driver gets out. **4.55–4.65:** the roller door opens. **4.60–4.95:** four trips of 0.0875. On the first three, the driver takes a crate from the van and sets it on the dock. On the fourth, the driver carries the last crate to the front of the factory and stops there, facing the viewer. **End frame:** 3 crates on the dock, the driver carrying the 4th, the van empty and facing left. There is no thumbs-up (the owner's revision). |

Ambient loops run only while the stage is on screen and never in reduced motion. They are not part of the
clock and never appear in a still:

- star twinkle;
- chimney smoke drifting up;
- a soft pulse on the lit-window glow.

Walking people swing their legs from a stride value the model derives from the distance walked, so a person
standing still always stands with both feet down. Van wheels turn by distance / radius.

## 4. Look (mockup v2, approved)

Reference: `docs/plans/assets/2026-11-17-scene-mockup.png` shows the steps 2–5 frames. Its generator is next to
it, as `2026-11-17-scene-mockup.py` in the same folder. It is reference only: it is never built or run by CI,
and it is the source to copy shapes and coordinates from.

- **Layout.** The world stays 1040 × 400 and the view 800 × 400.
  - The factory spans x 20–230.
  - A 60 px gap separates it from the terrace, which starts at x 290.
  - House centres: `HOUSE_X = [350, 470, 590, 710]`.
  - The inspection house is at x 880, as today.
  - The van's stops: house i at HOUSE_X[i] − 40, the inspection house at 880, the factory dock at
    `FACTORY_X = 270` (in both directions).
- **Factory.**
  - Sawtooth roof with glazing, a chimney with a gold band, and smoke.
  - A navy fascia carrying the "Your factory" sign (`scene.factory`).
  - Three windows, a roller door (open or closed), and a dock plate where crates stack two down and one on top.
- **Houses.**
  - Four wall colours, a tiled roof with a white fascia, and a navy door awning.
  - A wooden door that swings open.
  - A potted plant and the house number.
  - The window has a white frame, coloured curtains and a sill, and no bars (the owner's ruling). At night
    the glass is lit, the window glows, and the worker sits at a table.
- **People.** Every figure uses the full style:
  - hair (short, scarf, bun or cap), eyes, smile, a collared shirt, arms and hands;
  - four resident looks;
  - the driver: cap, navy KTRON shirt, light skin (the owner's ruling: not darkened);
  - the QC inspector: white coat.

  Residents seen at a window are busts at a table holding a gold crate and parts.
- **Sky.** Day, sunset, night and dawn gradients.
  - Sun: afternoon, then setting, then rising at the left, then morning.
  - Moon: a crescent with a halo.
  - Stars: 16.
  - Hills that change colour with the sky, and two palms.
  - At night a dark wash dims every building except the lit windows. This fixes the old "buildings stay bright
    at night" look.
- **Van.**
  - A white body with a navy cab window, a navy and gold stripe, and "KTRON" on the side.
  - Turning wheels, a roof rack showing its crates, a ground shadow, and headlights from dusk until it parks
    at night.
- **Text in the drawing.** Text stays outside the van body's flip group, as today.
  - "Your factory" (`scene.factory`, translated).
  - "KTRON".
  - "QC 10x": a new key, `scene.qc`, "QC 10x" / "质检 10x". The 10x fact guard applies.
  - House numbers: decorative.
- **No SVG filters.** Glows are radial gradients with opacity. The mockup's blur filter costs too much while
  animating on a phone.

## 5. Architecture

The current split stays: one pure model, `stateAt(t)`, feeds both the server drawing and the browser painter.
A clock only moves `t` (§2). This keeps the no-JS stills and the animation identical by construction, and keeps
the choreography testable without a browser.

**Model** (`src/components/scene/steps.ts`, split as it grows; every file stays under 400 lines):

- The constants above, and `stepOf`, `camera` and `STILLS` as today.
- Per-entity keyframe tables in a new file next to it (scene timeline). Values are interpolated; positions are
  smoothstep-eased inside each segment, so the van speeds up and slows down.
- `SceneState` grows to:
  - van: x, facing, crates, wheel angle, headlights;
  - sky: sunset, night and dawn layer opacities (`night` stays the night value), sun position, moon rise;
  - factory: door (0–1), dock crates;
  - driver: x, shown, carrying, stride, facing;
  - residents: out (0 inside … 1 at the kerb), carrying, stride, for each of 4;
  - house crates, and lit (0–1) for each of 4;
  - QC glow, lens, tick.
- `factoryCrates` becomes `dockCrates`, and `driver.carrying` holds the 4th crate at the end.
- `view` (the attribute strings) moves to its own file, and `steps.ts` re-exports it so imports keep working.
- The clock's helpers live next to the model, as pure functions in `src/components/scene/clock.ts`: `advance`
  (the clock after dt seconds), `tick`, `press`, `seen`, `jump` and `onScreen`.

**Drawing.** `src/components/scene/Scene.astro` becomes a composition of parts in a new scene/parts folder:

- Sky
- Ground (road, verge, palms, hills)
- Factory
- House (one house, used ×4)
- Person (look + pose)
- Bust (a seated figure at a window or desk)
- Inspection
- Van

Every part takes the state and writes the hooks (`data-*`) the painter updates.

**Painter and player.** `src/components/scene/animate.ts` keeps the loader contract and the arrival handling.

- The attribute painter moves to a new paint module. It writes only attributes whose value changed since the
  last frame.
- The clock and its controls live in a new play module (§2).
- The loader in `src/components/HowItWorks.astro` (the reduced-motion check, the IntersectionObserver and the
  input listeners) is unchanged.

**Colours.** The gate keeps raw colour in `src/styles/tokens.css` only (`pattern.hex_colour_outside_tokens` is
0).

- About 50 scene colours become `--scene-*` tokens in one commented block: walls, curtains, roof, glass, lit
  glass, skins, shirts, trousers, hair, sky stops, sun, moon, hills, palms, grass, road, verge, door wood,
  pot, plants and table.
- Gradient stops take their colour by class (`stop-color: var(--scene-…)`).
- Artwork colours are not text colours. The scene's three text pairs go into the TEXT table of
  `tests/unit/contrast.test.ts`: white on navy (factory sign), navy on white (van), navy-2 on white (QC sign).
  If its CSS parser does not see `fill` on SVG text, the plan extends it.

**No dependencies.** The clock is a `requestAnimationFrame` loop; GSAP and ScrollTrigger were dropped on 2026-11-18.

## 6. Stills, reduced motion and no JS

The five stills stay: the ordered list of figures with the counter and the caption, used for no JS and reduced
motion, with step 1's figure cloned into the stage, as today. Each still is the step's defining moment:

| Still | t | Shows |
|---|---|---|
| 1 | 0.55 | The driver carrying the 4th crate to the van; 3 already on the rack; the factory door open |
| 2 | 2 | Dusk; all four windows lit; the van empty at house 4 |
| 3 | 2.25 | Night, moon and stars; four workers at their tables; the only still at night |
| 4 | 4 | Morning; the van at the inspection house; the lens glowing; the tick |
| 5 | 5 | The driver carrying the last crate in front of the factory; 3 on the dock; the van empty, facing left |

Still 1 has the same van and world transforms as clock 0, so a scene at its opening frame matches it.

## 7. Weight and speed

- **Measured 2026-11-17.**
  - The four mockup frames are 19–26 KB each as raw SVG, and 5.3 KB gzipped all together.
  - Today's home HTML is 73.7 KB raw and 9.5 KB gzipped.
  - First load is 146 KB against the 500 KB budget in `tests/e2e/weight.spec.ts`.
- **Estimate.** Five full stills add about 100 KB raw and about 8 KB gzipped. That is well inside the budget,
  so the stills keep full copies and nothing is shared through `<use>`. If the gzipped HTML passes 30 KB, the
  plan shares the static parts.
- **Painting.** About 60 hooks change per frame at most, with no filters and only changed attributes written.
  The ambient CSS loops animate `opacity` and `transform` only.

## 8. Tests

Kept unchanged:

- the night value at 2, 2.25 and 2.5;
- crate conservation of 4 (now counting dock, van, resident hands, house and driver);
- `MAX_SPEED` ≤ 1850 and the jump limit. `MAX_SPEED` becomes the eased peak speed (smoothstep peaks at 1.5× the
  segment's average). The fastest drive is step 5's: 610 units in 0.50, a peak of 1830. A house-to-house drive is
  120 units in 0.10, a peak of 1800. Those two durations are the floor for any later tuning;
- facing and "only turns while standing";
- camera margins 60;
- `stepOf`;
- still facings [1, 1, 1, 1, −1];
- `view.night(STILLS[2])` 0.85, `vanBody(4.5)`, `world(stateAt(4))`;
- only still 3 at night;
- lens per still [0, 0, 0, 1, 0];
- no text inside the van body;
- the deep-link, stale-hash, nav-click and WebKit tests.

Updated, each on purpose:

- `stateAt(0)` (the van is empty, 4 crates on the dock, the driver shown);
- house 1's stop is HOUSE_X[0] − 40;
- step 2 hand-overs are at the new times;
- step 5 ends with dock 3 and the driver carrying;
- `STILLS` times [0.55, 2, 2.25, 4, 5];
- still 1 has 3 crates on the van and 1 carried;
- still 5 has 3 on the dock and 1 carried;
- the e2e caption check reads the stage's counter and caption against the still of the current step.

New guards. Each covers a whole class of failure, not just this one:

- **The clock** (unit, `tests/unit/clock.test.ts`, `tests/unit/play.test.ts`):
  - step k lasts `CLIP[k − 1]`, 18.5 s in all, and the counter changes at t = k − 1;
  - what the button, a tap on the scene, the stage leaving or returning, and dot k do in each state;
  - the 60 % rule, and the taller-than-the-viewport case.
- **The scene plays once** (e2e, `tests/e2e/autoplay.spec.ts`; desktop, phone and iPhone): no autoplay before 60 %
  is on screen; it plays 1 → 5 and stops at `data-t` 5.000 / `data-play` done, staying there after scrolling away
  and back; Pause and Play; off screen pauses and on screen resumes; a pause by the button survives that; a tap
  replays from 0; Enter and Space; dot 3; a reader who arrives below finds it waiting at 0. The page's clock is
  faked and stopped (`page.clock`), so 18.5 s run in a moment.
- **No scroll-jacking** (unit, `tests/unit/no-scroll-jacking.test.ts`): no ScrollTrigger, pin, snap or wheel
  listener in `src`; and e2e: the page moves exactly as far as it is scrolled and nothing pulls it back.
- **Choreography rules over t = 0…5 in 0.005 steps** (unit):
  - a resident is outside only while their door is open and the van stands at their stop;
  - a crate changes hands only between two standing holders at the same place;
  - the driver is shown only while the van stands at the factory;
  - a lit window means the resident is inside;
  - stride is 0 whenever a person is not moving;
  - nobody and no crate moves faster than the van's limit.
- **No SVG filter** anywhere in the built scene, and the stills contain no ambient-loop classes (dist).

`npm run verify` and `npm run quality` stay green. No count may rise, and `files_over_400_lines` stays 0.

## 9. Risks

| Risk | Answer |
|---|---|
| A reader scrolls past the scene fast and starts it for a moment | Accepted: it pauses where it is when the stage leaves and resumes from there (§2). Nothing is lost. |
| A reader never taps the scene and misses the dots | The five stills stay as the page's text for readers who skip the animation, and the button names itself Play, Pause or Replay. |
| 18 s of story feels long | Clip lengths are constants. The owner tunes them after seeing it. |
| Paint cost on old phones | No filters, changed attributes only, and the loops use compositor-only properties. If needed, the plan's last task measures one frame on the 4× slowed CPU run. |
| The model grows past 400 lines | The split is planned in §5. The count gate fails before a reviewer would notice. |
| A people drawing reads wrong at phone size (the old "middle finger") | The owner reviews the five stills on a phone before merge. |
