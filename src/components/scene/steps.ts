// The "How it works" scene as data: stateAt(t) for t in step units 0–5. The server drawing (Scene.astro and
// parts/) and the browser painter (paint.ts) both read attributes from `view`, so the stills and the animation
// match by construction. Spec: docs/plans/2026-11-17-how-it-works-animation-design.md.
import { KERB_PATH, STEPS } from './layout';
import * as T from './timeline';

export * from './layout';

export interface Walker {
  /** World x of the feet. */
  x: number;
  shown: boolean;
  carrying: boolean;
  /** Leg swing in degrees; 0 while standing. */
  stride: number;
  /** 1 walking right, −1 walking left, 0 facing the viewer. */
  facing: -1 | 0 | 1;
}

export interface Resident {
  /** 0 in the doorway … 1 at the kerb. */
  out: number;
  /** The front door: 0 shut … 1 open. */
  door: number;
  carrying: boolean;
  stride: number;
  facing: -1 | 0 | 1;
}

export interface SceneState {
  vanX: number;
  facing: 1 | -1;
  vanCrates: number;
  /** Wheel turn in degrees, from the distance driven. */
  wheel: number;
  headlights: number;
  sunset: number;
  night: number;
  dawn: number;
  /** The sun's centre in view coordinates (the sky does not scroll with the world). */
  sunX: number;
  sunY: number;
  moon: number;
  /** The factory's roller door: 0 shut … 1 open. */
  door: number;
  dockCrates: number;
  driver: Walker;
  residents: Resident[];
  houseCrates: boolean[];
  /** Each house window's light, 0 … 1. */
  lit: number[];
  qcGlow: number;
  lens: number;
  tick: number;
}

const r = (n: number, d = 1) => Number(n.toFixed(d)) || 0; // `|| 0` turns −0 into 0
const HOUSES = [0, 1, 2, 3] as const;

/** The van's fastest moment, in world units per step: smoothstep peaks at 1.5× a segment's average speed. */
export const MAX_SPEED = Math.max(
  ...T.VAN_X.slice(1).map(([t, x], i) => (t > T.VAN_X[i][0] ? (1.5 * Math.abs(x - T.VAN_X[i][1])) / (t - T.VAN_X[i][0]) : 0)),
);

/** The way a walker last moved at or before t (0 before any move). */
function lastHeading(keys: readonly T.Key[], t: number): -1 | 0 | 1 {
  let h: -1 | 0 | 1 = 0;
  for (let i = 1; i < keys.length && keys[i - 1][0] <= t; i++) {
    const d = Math.sign(keys[i][1] - keys[i - 1][1]) as -1 | 0 | 1;
    if (d !== 0 && keys[i][0] > keys[i - 1][0]) h = d;
  }
  return h;
}

export function stateAt(t: number): SceneState {
  const c = Math.min(Math.max(t, 0), STEPS);
  const tr = (keys: readonly T.Key[], d = 3) => r(T.track(keys, c), d);
  return {
    vanX: tr(T.VAN_X, 1),
    facing: T.held(T.VAN_FACING, c) as 1 | -1,
    vanCrates: T.holding('van', c),
    wheel: r(((T.distance(T.VAN_X, c) / 9) * (180 / Math.PI)) % 360, 1),
    headlights: tr(T.HEADLIGHTS),
    sunset: tr(T.SUNSET),
    night: tr(T.NIGHT),
    dawn: tr(T.DAWN),
    sunX: tr(T.SUN_X, 1),
    sunY: tr(T.SUN_Y, 1),
    moon: tr(T.MOON),
    door: tr(T.FACTORY_DOOR),
    dockCrates: T.holding('dock', c),
    driver: {
      x: tr(T.DRIVER_X, 1),
      shown: T.held(T.DRIVER_SHOWN, c) === 1,
      carrying: T.holding('driver', c) > 0,
      stride: r(T.stride(T.DRIVER_X, c), 1),
      facing: c >= T.DRIVER_FACES_VIEWER ? 0 : T.heading(T.DRIVER_X, c) || lastHeading(T.DRIVER_X, c),
    },
    residents: HOUSES.map((i) => ({
      out: tr(T.RESIDENT_OUT[i]),
      door: tr(T.HOUSE_DOOR[i]),
      carrying: T.holding(`resident-${i}`, c) > 0,
      stride: r(T.stride(T.RESIDENT_OUT[i], c, KERB_PATH), 1),
      facing: T.heading(T.RESIDENT_OUT[i], c),
    })),
    houseCrates: HOUSES.map((i) => T.holding(`house-${i}`, c) > 0),
    lit: HOUSES.map((i) => tr(T.LIT[i])),
    qcGlow: tr(T.QC_GLOW),
    lens: tr(T.LENS),
    tick: tr(T.TICK),
  };
}

export const stepOf = (t: number) => Math.min(STEPS, Math.floor(t) + 1) as 1 | 2 | 3 | 4 | 5;

/** One still per step, each the step's defining moment (spec §6). */
export const STILL_T = [0.55, 2, 2.25, 4, 5] as const;
export const STILLS: SceneState[] = STILL_T.map(stateAt);

export { view } from './view';
