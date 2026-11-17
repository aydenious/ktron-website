// Scroll → scene clock: which step the scroll position commits, how the clock plays to it, and where the
// page settles. Pure functions; play.ts wires them to ScrollTrigger. Spec §2.
import { STEPS } from './layout';

/** Seconds each step's clip lasts at normal speed, steps 1–5 (spec §3). */
export const CLIP = [3.0, 4.0, 5.0, 3.0, 3.5] as const;
/** Scrolling this fraction of a band past a settle point commits the next step. */
const HYSTERESIS = 0.2;
/** The pin covers four bands between P_1 and P_5, then 0.6 of a band to let the page go. */
export const PIN_BANDS = STEPS - 1 + 0.6;
/** Speeds: steps crossed on the way, the last step forward, the last step back. */
const SKIP = 4, FORWARD = 1, BACK = 2;

/** One band of scrolling, in px: half the viewport, at least 300. */
export const bandPx = (innerHeight: number) => Math.max(300, 0.5 * innerHeight);

/**
 * The step the scroll position y commits, given the step committed now (0 = the opening frame) and the way the
 * page is scrolling. Going down commits a later step once y is 0.2 band past a settle point; going up commits an
 * earlier one once y is 0.2 band short of the next. The direction keeps a position between two bands from
 * flipping back and forth. On arrival (deep link, restored scroll) pass current 0 and direction 1.
 */
export function committedStep(y: number, start: number, B: number, current: number, direction: 1 | -1): number {
  if (y < start - HYSTERESIS * B) return 0;
  const next =
    direction > 0
      ? Math.max(current, 1 + Math.ceil((y - start - HYSTERESIS * B) / B))
      : Math.min(current, 1 + Math.floor((y - start + HYSTERESIS * B) / B));
  return Math.min(Math.max(next, 1), STEPS);
}

interface Segment {
  from: number;
  to: number;
  seconds: number;
}

/** The clock's path from `clock` to the end of step `target` (0 for the opening frame), split at step ends. */
export function playPlan(clock: number, target: number): Segment[] {
  const plan: Segment[] = [];
  const dir = Math.sign(target - clock);
  for (let a = clock; dir !== 0 && a !== target; ) {
    const b = dir > 0 ? Math.min(Math.floor(a) + 1, target) : Math.max(Math.ceil(a) - 1, target);
    const step = dir > 0 ? Math.floor(a) + 1 : Math.ceil(a); // the step this piece of clock belongs to
    const last = b === target;
    const speed = !last ? SKIP : dir > 0 ? FORWARD : BACK;
    plan.push({ from: a, to: b, seconds: (CLIP[step - 1] * Math.abs(b - a)) / speed });
    a = b;
  }
  return plan;
}

/**
 * ScrollTrigger snap: the committed step's settle point, or the pin's end once the page has gone 0.2 band past P_5
 * going down. Coming back up from below, the end holds until the page is 0.2 band short of it, then P_5 takes over,
 * so a small upward scroll from the end is never pulled back down.
 */
export function snapProgress(progress: number, committed: number, direction: 1 | -1): number {
  const release = direction > 0 ? STEPS - 1 + HYSTERESIS : PIN_BANDS - HYSTERESIS;
  if (progress * PIN_BANDS > release) return 1;
  return Math.max(0, committed - 1) / PIN_BANDS;
}
