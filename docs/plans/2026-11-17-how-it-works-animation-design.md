# "How it works" animation redesign — design

> **Status (2026-11-17):** the scroll model, the storyboard and the look (mockup v2) are approved by the owner.
> This document is waiting for the owner's review. The implementation plan follows it.

## 1. What the owner asked for

- **Scroll in step with the story.** On a phone today, one swipe leaves the van halfway down the street, and a
  second swipe finishes the delivery. The section says "5 steps", so five scrolls should show five complete
  steps.
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

## 2. Scroll model: scrolling starts a step, and the step plays to its end

The owner chose this over plain scrubbing and over "one gesture = one step" scroll hijacking.

- **Settle points.** The stage stays pinned as it is today, over five bands of height B = 0.5 × the viewport
  height (at least 300 px). The settle point of step k is P_k = pin start + (k − 1)·B. The pin ends at
  P_5 + 0.6·B. Total pinned length is 4.6·B = 2.3 viewports, which still meets the e2e floor of more than
  2 viewports.
- **Committing a step.** The scroll position y commits a step, with a hysteresis of 0.2·B in each direction:
  - Going down from step c, the target is 1 + ceil((y − start − 0.2B) / B) when that is more than c.
  - Going up, the target is 1 + floor((y − start + 0.2B) / B) when that is less than c.
  - Otherwise the step stays c.
  - Above start − 0.2B the committed step is 0. That means the opening frame (clock 0), while the counter
    still says step 1.
  - So about 0.2·B of scrolling (about 80 px on a phone, one wheel notch on a desktop) is enough to start the
    next step.
  - This is a pure function, `committedStep(y, start, B, current)`, with unit tests.
- **Playing.** A commit tweens the scene clock to the end of the committed step, `t = k` (0 for step 0):
  - Forward one step plays at the step's clip length (§3).
  - Back one step plays in reverse at double speed.
  - Crossing more than one step (a hard flick, a Page Down, a jump): every step before the last runs at
    4× speed, and the last runs at its normal speed (double speed if going back).
  - A new commit during a clip retargets from the current clock. Nothing queues.
  - The counter and caption change at the moment of the commit.
- **Settling.** ScrollTrigger's `snap` brings the page to P_committed once scrolling has stopped, including
  phone momentum, so the next swipe always starts from a settle point.
  - `snapTo` is a function that returns the committed step's progress. It is not the nearest point.
  - Settling takes 0.2–0.5 s and has no inertia.
  - Past P_5 + 0.2·B, the snap point is the pin's end, so the page unpins and carries on. The section never
    traps the reader.
- **Arriving mid-section.** On a deep link, a nav jump or restored scroll, the first commit after setup sets
  the clock straight to the committed step's end and plays nothing. The existing arrival code keeps its role:
  `scroll-behavior: auto` during setup, re-aiming, and the `scrollend` settle. The stale-hash and
  mid-scroll-click guards stay.
- **Known limit, accepted.** A hard flick on a phone can carry the page across two or three bands. Those steps
  then play quickly one after the other, as the owner's choice describes. Strict one-gesture-one-step would
  need scroll hijacking (GSAP Observer with `preventDefault`), which was rejected.

The section gets `data-step` (committed step) and `data-t` (scene clock, 3 decimals) so the browser tests can
read the state.

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
GSAP only moves the clock. This keeps the no-JS stills and the animation identical by construction, and keeps
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
- New scroll helpers live with the model, as pure functions:
  - `committedStep(y, start, B, current)`;
  - `playPlan(fromT, toStep)`, which returns the segments and durations for §2's speeds.

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
- The commit, tween and snap logic moves to a new play module.
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

**No new dependencies.** GSAP 3.15.0 and ScrollTrigger are already here.

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

Still 1 has the same van and world transforms as clock 0, so "scroll back above the section → step 1" still
matches it.

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
- the e2e caption check moves from band midpoints to settle points.

New guards. Each covers a whole class of failure, not just this one:

- **One scroll plays one whole step** (e2e; desktop, iPhone and WebKit):
  - from each settle point, scrolling 0.3·B down ends with `data-step` n+1, `data-t` exactly n+1, the van's
    transform equal to `view.van(stateAt(n+1))`, and the page at P_{n+1} ±2 px;
  - the same going up;
  - a 2.2·B flick from step 1 ends at step 3 with t = 3;
  - a scroll during a clip ends at the latest commit;
  - past step 5, the page unpins and carries on.
- **`committedStep` and `playPlan`** (unit):
  - hysteresis on both sides;
  - the edges at 0 and 5;
  - speeds of 1×, 2× back and 4× for skipped steps.
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
| The snap fights a finger still on the glass, or momentum, on some phones | The snap waits for scroll end. The WebKit and iPhone e2e runs check it. The owner tries it on a phone after deploy, and one revert undoes it. |
| A flick skips steps | This is accepted behaviour (§2): the skipped steps play at 4×, so nothing is missed. |
| 18 s of story feels long | Clip lengths are constants. The owner tunes them after seeing it. |
| Paint cost on old phones | No filters, changed attributes only, and the loops use compositor-only properties. If needed, the plan's last task measures one frame on the 4× slowed CPU run. |
| The model grows past 400 lines | The split is planned in §5. The count gate fails before a reviewer would notice. |
| A people drawing reads wrong at phone size (the old "middle finger") | The owner reviews the five stills on a phone before merge. |
