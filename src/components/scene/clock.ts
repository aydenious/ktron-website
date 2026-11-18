// The scene clock: what plays, when, and what the one button does. Pure functions; play.ts wires them to the page.
// Spec §2 (2026-11-18): the scene plays once on its own, tap to replay.
import { STEPS } from './layout';

/** Seconds each step's clip lasts at normal speed, steps 1–5 (spec §3). */
export const CLIP = [3.0, 4.0, 5.0, 3.0, 3.5] as const;
/** The whole story, seconds. */
export const DURATION = CLIP.reduce((a, b) => a + b, 0);
/** The scene plays while at least this much of the stage is on screen. */
const SHOWN = 0.6;

export type Mode = 'idle' | 'playing' | 'paused' | 'done';
export interface Run {
  /** The scene clock in step units, 0 … 5. */
  t: number;
  mode: Mode;
  /** Paused by the reader (the button): it does not resume by itself when the stage comes back. */
  held: boolean;
}
/** The opening frame, before the first autoplay. */
export const start: Run = { t: 0, mode: 'idle', held: false };

/** The clock after `dt` seconds of normal-speed playback from `t`. */
export function advance(t: number, dt: number): number {
  let at = t;
  for (let left = dt; left > 0 && at < STEPS; ) {
    const k = Math.floor(at);
    const rest = (k + 1 - at) * CLIP[k]; // seconds to the end of this step
    if (left >= rest) {
      left -= rest;
      at = k + 1;
    } else {
      at += left / CLIP[k];
      left = 0;
    }
  }
  return Math.min(at, STEPS);
}

/** One frame: a playing clock moves on and stops at 5; anything else stays. */
export function tick(run: Run, dt: number): Run {
  if (run.mode !== 'playing') return run;
  const t = advance(run.t, dt);
  return t >= STEPS ? { t: STEPS, mode: 'done', held: false } : { ...run, t };
}

/** The button, or a tap anywhere on the scene. */
export function press(run: Run): Run {
  switch (run.mode) {
    case 'playing': return { ...run, mode: 'paused', held: true };
    case 'paused': return { ...run, mode: 'playing', held: false };
    default: return { t: 0, mode: 'playing', held: false }; // idle: Play; done: Replay
  }
}

/** What the button says (and shows) in each state. */
export const labelOf = (mode: Mode) => (mode === 'playing' ? 'pause' : mode === 'done' ? 'replay' : 'play') as 'play' | 'pause' | 'replay';

/** The stage came on screen or left it. The first time on screen starts the scene; a finished one never starts again. */
export function seen(run: Run, onScreen: boolean): Run {
  if (run.mode === 'idle' && onScreen) return { t: 0, mode: 'playing', held: false };
  if (run.mode === 'playing' && !onScreen) return { ...run, mode: 'paused' };
  if (run.mode === 'paused' && !run.held && onScreen) return { ...run, mode: 'playing' };
  return run;
}

/** Dot k: the clock goes to the start of step k and plays on to the end. */
export const jump = (_run: Run, k: number): Run => ({ t: k - 1, mode: 'playing', held: false });

interface Seen {
  intersectionRatio: number;
  intersectionRect: { height: number };
  rootBounds: { height: number } | null;
}
/**
 * Is the stage on screen for the clock? 60 % of it is in the viewport, or (for a stage taller than the
 * viewport, a phone held sideways) it fills 60 % of the viewport, since the first can never be reached.
 */
export const onScreen = (e: Seen) =>
  e.intersectionRatio >= SHOWN || (e.rootBounds !== null && e.intersectionRect.height >= SHOWN * e.rootBounds.height);
