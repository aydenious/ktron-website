// The storyboard as keyframe tables, one per moving thing. t is the scene clock: step k runs from
// k − 1 to k. Spec: docs/plans/2026-11-17-how-it-works-animation-design.md §3.
import { DOCK_X, FACTORY_X, FRONT_X, INSPECT_X, LOAD_X, STOP_X, cabX } from './layout';

export type Key = readonly [t: number, value: number];

const smooth = (f: number) => f * f * (3 - 2 * f);

/** Index of the last key at or before t, or -1 before the first. Of two keys at the same t, the later wins (a jump). */
function keyAt(keys: readonly Key[], t: number): number {
  let i = -1;
  while (i + 1 < keys.length && keys[i + 1][0] <= t) i++;
  return i;
}

/** A track's value: held before the first key and after the last, smoothstep-eased between two keys. */
export function track(keys: readonly Key[], t: number): number {
  const i = keyAt(keys, t);
  if (i < 0) return keys[0][1];
  if (i === keys.length - 1) return keys[i][1];
  const [t0, v0] = keys[i];
  const [t1, v1] = keys[i + 1];
  return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
}

/** A stepped track: the value of the last key at or before t. */
export const held = (keys: readonly Key[], t: number): number => keys[Math.max(0, keyAt(keys, t))][1];

/** Distance travelled along a track from its first key to t (the van's odometer turns its wheels). */
export function distance(keys: readonly Key[], t: number): number {
  const i = keyAt(keys, t);
  let d = 0;
  for (let k = 1; k <= i; k++) d += Math.abs(keys[k][1] - keys[k - 1][1]);
  return i < 0 ? 0 : d + Math.abs(track(keys, t) - keys[i][1]);
}

/** Direction of travel at t: +1, −1, or 0 while the track is standing still. */
export function heading(keys: readonly Key[], t: number): -1 | 0 | 1 {
  const i = keyAt(keys, t);
  if (i < 0 || i === keys.length - 1) return 0;
  return Math.sign(keys[i + 1][1] - keys[i][1]) as -1 | 0 | 1;
}

const SWING = 24; // degrees each leg swings from upright
const HALF_STRIDE = 10; // world units walked per leg swing
/**
 * Leg swing in degrees, derived from the distance walked in the current segment. Each walk is a whole number of
 * half strides, so it starts and ends with both feet down, and anyone standing has a stride of 0.
 * `scale` turns a track's units into world units (a resident's `out` runs 0–1 along a short path).
 */
export function stride(keys: readonly Key[], t: number, scale = 1): number {
  const i = keyAt(keys, t);
  if (i < 0 || i === keys.length - 1) return 0;
  const [t0, v0] = keys[i];
  const [t1, v1] = keys[i + 1];
  const walk = Math.abs(v1 - v0) * scale;
  if (walk === 0) return 0;
  const halves = Math.max(1, Math.round(walk / HALF_STRIDE));
  return SWING * Math.sin(Math.PI * halves * smooth((t - t0) / (t1 - t0)));
}

// ---- Step 2 and 3 slots -------------------------------------------------------------------------
/** Step 2: house i's slot starts here (drive 0.10, door + walk out, hand-over, in, light). */
const DELIVER = [1, 1.25, 1.5, 1.75] as const;
/** Step 3: house i's slot starts here; the van collects from house 4 back to house 1. */
const COLLECT = [2.925, 2.75, 2.575, 2.4] as const;

// ---- Van ----------------------------------------------------------------------------------------
export const VAN_X: readonly Key[] = [
  [0, FACTORY_X], [0.8, FACTORY_X], [1, STOP_X[0]], // 1: loaded at the dock, pulls off to house 1
  ...[1, 2, 3].flatMap((i): Key[] => [[DELIVER[i], STOP_X[i - 1]], [DELIVER[i] + 0.1, STOP_X[i]]]), // 2
  ...[3, 2, 1].flatMap((i): Key[] => [[COLLECT[i] + 0.075, STOP_X[i]], [COLLECT[i - 1], STOP_X[i - 1]]]), // 3
  [3.04, STOP_X[0]], [3.6, INSPECT_X], // 4: past every house to the inspection house
  [4.05, INSPECT_X], [4.55, FACTORY_X], // 5: back to the factory
];
/** The van turns round only while standing: at house 4 before collecting, at house 1, and at inspection. */
export const VAN_FACING: readonly Key[] = [[0, 1], [2.4, -1], [3.02, 1], [4.02, -1]];
export const HEADLIGHTS: readonly Key[] = [[1.6, 0], [1.65, 1], [2.1, 1], [2.15, 0]];

// ---- Sky (the sky is fixed to the view; x and y are view coordinates) ---------------------------
export const SUNSET: readonly Key[] = [[1.1, 0], [1.95, 1], [2.15, 1], [2.2, 0]];
export const NIGHT: readonly Key[] = [[2, 0], [2.15, 1], [2.3, 1], [2.4, 0]];
export const DAWN: readonly Key[] = [[2.3, 0], [2.4, 1], [2.55, 0]];
export const MOON: readonly Key[] = [[2, 0], [2.15, 1], [2.3, 1], [2.4, 0]];
// The sun sets at the right, crosses below the ground in the dark, and rises at the left (east).
export const SUN_X: readonly Key[] = [
  [0, 520], [1, 600], [2, 770], [2.2, 770], [2.2, 40], [2.4, 60], [2.55, 170], [3, 220], [4, 300], [5, 360],
];
export const SUN_Y: readonly Key[] = [
  [0, 70], [1, 84], [2, 262], [2.1, 330], [2.3, 330], [2.4, 250], [2.55, 120], [3, 96], [4, 72], [5, 60],
];

// ---- Factory ------------------------------------------------------------------------------------
export const FACTORY_DOOR: readonly Key[] = [[0, 1], [0.65, 1], [0.8, 0], [4.55, 0], [4.65, 1]];

// ---- Driver -------------------------------------------------------------------------------------
const TRIP_1 = (j: number) => 0.05 + 0.15 * j; // step 1: trip j starts (dock → van)
const TRIP_5 = (j: number) => 4.6 + 0.0875 * j; // step 5: trip j starts (van → dock; the 4th → the front)
const WALK_5 = 0.03375; // step 5: one walk between the van and the dock
export const DRIVER_X: readonly Key[] = [
  [0, DOCK_X],
  ...[0, 1, 2, 3].flatMap((j): Key[] => {
    const s = TRIP_1(j);
    const there: Key[] = [[s + 0.02, DOCK_X], [s + 0.07, LOAD_X]];
    return j < 3 ? [...there, [s + 0.09, LOAD_X], [s + 0.14, DOCK_X]] : there;
  }),
  [0.65, LOAD_X], [0.72, cabX(1)], // into the cab
  [4.56, cabX(1)], [4.56, cabX(-1)], [4.6, LOAD_X], // out of the cab, now at the van's left end
  ...[0, 1, 2].flatMap((j): Key[] => {
    const s = TRIP_5(j);
    return [[s + 0.01, LOAD_X], [s + 0.01 + WALK_5, DOCK_X], [s + 0.02 + WALK_5, DOCK_X], [s + 0.0875, LOAD_X]];
  }),
  [TRIP_5(3) + 0.01, LOAD_X], [4.95, FRONT_X], // the last crate, carried to the front of the factory
];
export const DRIVER_SHOWN: readonly Key[] = [[0, 1], [0.72, 0], [4.56, 1]];
/** From here on the driver stands facing the viewer. */
export const DRIVER_FACES_VIEWER = 4.95;

// ---- Residents (door 0 shut … 1 open; out 0 inside … 1 at the kerb; lit 0 dark … 1 lit) --------
export const HOUSE_DOOR = [0, 1, 2, 3].map((i): readonly Key[] => {
  const b = DELIVER[i], c = COLLECT[i];
  return [[b + 0.1, 0], [b + 0.11, 1], [b + 0.18, 1], [b + 0.2, 0], [c, 0], [c + 0.01, 1], [c + 0.065, 1], [c + 0.075, 0]];
});
export const RESIDENT_OUT = [0, 1, 2, 3].map((i): readonly Key[] => {
  const b = DELIVER[i], c = COLLECT[i];
  return [[b + 0.11, 0], [b + 0.13, 1], [b + 0.15, 1], [b + 0.18, 0], [c + 0.01, 0], [c + 0.03, 1], [c + 0.045, 1], [c + 0.065, 0]];
});
/** The window lights once the resident is back inside, and goes dark as they get up to bring the crate out. */
export const LIT = [0, 1, 2, 3].map((i): readonly Key[] => {
  const b = DELIVER[i], c = COLLECT[i];
  return [[b + 0.2, 0], [b + 0.25, 1], [c - 0.03, 1], [c, 0]];
});

// ---- Inspection ---------------------------------------------------------------------------------
export const QC_GLOW: readonly Key[] = [[3.6, 0], [3.75, 1], [4.05, 1], [4.15, 0]];
export const LENS: readonly Key[] = [[3.75, 0], [3.85, 1], [4.05, 1], [4.15, 0]];
export const TICK: readonly Key[] = [[3.85, 0], [3.92, 1.15], [3.95, 1], [4.05, 1], [4.15, 0]];

// ---- Crates: every move of one of the four, in time order ---------------------------------------
export type Holder = 'dock' | 'van' | 'driver' | `resident-${number}` | `house-${number}`;
interface Transfer { t: number; from: Holder; to: Holder }
const move = (t: number, from: Holder, to: Holder): Transfer => ({ t, from, to });
const START_HOLDINGS: Readonly<Partial<Record<Holder, number>>> = { dock: 4 };
export const TRANSFERS: readonly Transfer[] = [
  ...[0, 1, 2, 3].flatMap((j) => [move(TRIP_1(j) + 0.01, 'dock', 'driver'), move(TRIP_1(j) + 0.08, 'driver', 'van')]),
  ...[0, 1, 2, 3].flatMap((i) => [
    move(DELIVER[i] + 0.14, 'van', `resident-${i}`),
    move(DELIVER[i] + 0.185, `resident-${i}`, `house-${i}`),
  ]),
  ...[3, 2, 1, 0].flatMap((i) => [
    move(COLLECT[i] + 0.005, `house-${i}`, `resident-${i}`),
    move(COLLECT[i] + 0.0375, `resident-${i}`, 'van'),
  ]),
  ...[0, 1, 2].flatMap((j) => [move(TRIP_5(j) + 0.005, 'van', 'driver'), move(TRIP_5(j) + 0.015 + WALK_5, 'driver', 'dock')]),
  move(TRIP_5(3) + 0.005, 'van', 'driver'),
].sort((a, b) => a.t - b.t);

/** How many crates `who` holds at t. */
export function holding(who: Holder, t: number): number {
  let n = START_HOLDINGS[who] ?? 0;
  for (const m of TRANSFERS) {
    if (m.t > t) break;
    if (m.to === who) n++;
    if (m.from === who) n--;
  }
  return n;
}
