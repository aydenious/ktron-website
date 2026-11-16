// The "How it works" scene as data: stateAt(t) for t in step units 0–5. The server drawing
// (Scene.astro) and the animation (animate.ts, Task 10) both read attributes from `view`.

export const WORLD_W = 1040;
export const VIEW_W = 800;
export const VIEW_H = 400;
export const ROAD_Y = 332;
export const FACTORY_X = 150;
export const HOUSE_X = [330, 450, 570, 690] as const;
export const INSPECT_X = 880;
export const STEPS = 5;

export interface SceneState {
  vanX: number;
  facing: 1 | -1;
  night: number;
  vanCrates: number;
  houseCrates: boolean[];
  lens: boolean;
  factoryCrates: number;
}

interface Frame { t: number; x: number; night: number; facing: 1 | -1; van: number; houses: number; lens: boolean; done: number }
const F = (t: number, x: number, facing: 1 | -1, van: number, houses: number, opts: Partial<Frame> = {}): Frame =>
  ({ t, x, facing, van, houses, night: 0, lens: false, done: 0, ...opts });

// `houses` = how many houses, counted from the first, hold a crate.
const FRAMES: Frame[] = [
  // 1: loaded van leaves the factory
  F(0, FACTORY_X, 1, 4, 0), F(0.3, FACTORY_X, 1, 4, 0),
  // 2: stop at each house in turn, drop a crate
  ...HOUSE_X.flatMap((x, i) => [F(1 + i * 0.25, x, 1, 4 - i, i), F(1.1 + i * 0.25, x, 1, 3 - i, i + 1)]),
  // 3: night, morning, then collect from the last house back to the first
  F(2, HOUSE_X[3], 1, 0, 4), F(2.25, HOUSE_X[3], 1, 0, 4, { night: 1 }),
  // (the first collect frame, t 2.5 at the last house, is also where morning arrives)
  ...[3, 2, 1, 0].flatMap((i, k) => [F(2.5 + k * 0.125, HOUSE_X[i], -1, k, i + 1), F(2.56 + k * 0.125, HOUSE_X[i], -1, k + 1, i)]),
  // 4: drive to the inspection house, the lens glows
  F(3, HOUSE_X[0], -1, 4, 0), F(3.05, HOUSE_X[0], 1, 4, 0), F(3.75, INSPECT_X, 1, 4, 0),
  F(3.85, INSPECT_X, 1, 4, 0, { lens: true }),
  // 5: back to the factory, unload
  F(4.05, INSPECT_X, -1, 4, 0), F(4.8, FACTORY_X, -1, 4, 0), F(4.9, FACTORY_X, -1, 0, 0, { done: 4 }),
  F(5, FACTORY_X, -1, 0, 0, { done: 4 }),
];

/** The fastest the van ever drives, in world units per step (the quickest hop between two frames). */
export const MAX_SPEED = Math.max(...FRAMES.slice(1).map((b, i) => Math.abs(b.x - FRAMES[i].x) / (b.t - FRAMES[i].t)));

const r = (n: number, d = 1) => Number(n.toFixed(d));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function stateAt(t: number): SceneState {
  const c = Math.min(Math.max(t, 0), STEPS);
  let i = 0;
  while (i < FRAMES.length - 2 && FRAMES[i + 1].t <= c) i++;
  const a = FRAMES[i];
  const b = FRAMES[i + 1];
  const k = Math.min(1, (c - a.t) / (b.t - a.t));
  return {
    vanX: r(lerp(a.x, b.x, k)),
    facing: a.facing,
    night: r(lerp(a.night, b.night, k), 3),
    vanCrates: a.van,
    houseCrates: HOUSE_X.map((_, h) => h < a.houses),
    lens: a.lens,
    factoryCrates: a.done,
  };
}

export const stepOf = (t: number) => Math.min(STEPS, Math.floor(t) + 1) as 1 | 2 | 3 | 4 | 5;
export const camera = (vanX: number) => Math.min(Math.max(vanX - VIEW_W / 2, 0), WORLD_W - VIEW_W);

/** One still per step: departure, crates delivered, night, inspection, return. */
export const STILLS: SceneState[] = [0, 2, 2.25, 4, 5].map(stateAt);

const shown = (on: boolean) => (on ? 'visible' : 'hidden');
export const view = {
  world: (s: SceneState) => `translate(${-r(camera(s.vanX))} 0)`,
  van: (s: SceneState) => `translate(${r(s.vanX)} ${ROAD_Y})`,
  vanBody: (s: SceneState) => `scale(${s.facing} 1)`,
  night: (s: SceneState) => r(s.night * 0.85, 2),
  dark: (s: SceneState) => r(s.night, 2),
  sun: (s: SceneState) => r(1 - s.night, 2),
  lens: (s: SceneState) => (s.lens ? 1 : 0),
  houseCrate: (s: SceneState, i: number) => shown(s.houseCrates[i]),
  vanCrate: (s: SceneState, j: number) => shown(j < s.vanCrates),
  factoryCrate: (s: SceneState, j: number) => shown(j < s.factoryCrates),
};
