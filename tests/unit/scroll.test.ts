import { describe, expect, it } from 'vitest';
import { CLIP, PIN_BANDS, bandPx, committedStep, playPlan, snapProgress } from '../../src/components/scene/scroll';

const B = 400, start = 1000;
const D = 1 as const, U = -1 as const;
const at = (y: number, current: number, dir: 1 | -1) => committedStep(start + y, start, B, current, dir);
const seconds = (from: number, to: number) => playPlan(from, to).map((s) => Number(s.seconds.toFixed(3)));

describe('committedStep (spec §2)', () => {
  it('is 0 above start − 0.2 band, whatever came before', () => {
    expect([at(-81, 1, U), at(-81, 3, D), at(-80, 0, D)]).toEqual([0, 0, 1]);
  });
  it('commits the next step 0.2 band past a settle point going down, and no sooner', () => {
    expect([at(80, 1, D), at(81, 1, D), at(B + 80, 2, D), at(B + 81, 2, D)]).toEqual([1, 2, 2, 3]);
  });
  it('commits the step before 0.2 band short of the settle point going up, and no sooner', () => {
    expect([at(B - 80, 2, U), at(B - 81, 2, U), at(2 * B - 81, 3, U)]).toEqual([2, 1, 2]);
  });
  it('holds between two bands whichever way the page last moved', () => {
    expect([at(200, 1, U), at(200, 2, D)]).toEqual([1, 2]);
  });
  it('jumps several steps on a flick or a jump, and stays inside 1–5', () => {
    expect([at(3 * B + 100, 1, D), at(99 * B, 5, D), at(10, 5, U)]).toEqual([5, 5, 1]);
  });
  it('on arrival (current 0, direction down) commits the step of the nearest settle point at or above y', () => {
    expect([0, 1, 2, 3, 4].map((k) => at(k * B, 0, D))).toEqual([1, 2, 3, 4, 5]);
    expect([0, 1, 2, 3, 4].map((k) => at(k * B - 10, 0, D))).toEqual([1, 2, 3, 4, 5]);
  });
  it('bands are half the viewport, at least 300 px', () => {
    expect([bandPx(500), bandPx(900)]).toEqual([300, 450]);
  });
});

describe('playPlan (spec §2)', () => {
  it('plays one step forward at its clip length and back at double speed', () => {
    expect(seconds(0, 1)).toEqual([CLIP[0]]);
    expect(seconds(2, 1)).toEqual([CLIP[1] / 2]);
    expect(seconds(1, 0)).toEqual([CLIP[0] / 2]);
  });
  it('runs skipped steps at 4× and the last at its normal speed', () => {
    expect(seconds(1, 4)).toEqual([CLIP[1] / 4, CLIP[2] / 4, CLIP[3]]);
    expect(seconds(4, 1)).toEqual([CLIP[3] / 4, CLIP[2] / 4, CLIP[1] / 2]);
  });
  it('retargets from mid-clip, and plays nothing when already there', () => {
    expect(seconds(2.5, 3)).toEqual([CLIP[2] / 2]);
    expect(seconds(2.5, 2)).toEqual([CLIP[2] / 4]);
    expect(playPlan(3, 3)).toEqual([]);
  });
  it('splits the path at step ends, in order', () => {
    expect(playPlan(0.5, 3).map((s) => [s.from, s.to])).toEqual([[0.5, 1], [1, 2], [2, 3]]);
  });
});

describe('snapProgress (spec §2)', () => {
  it('settles on the committed step, not the nearest point', () => {
    expect([0, 1, 2, 5].map((k) => snapProgress(0.5, k, D))).toEqual([0, 0, 1 / PIN_BANDS, 4 / PIN_BANDS]);
  });
  it('lets the page go past P_5 + 0.2 band going down', () => {
    expect(snapProgress(4.2 / PIN_BANDS, 5, D)).toBe(4 / PIN_BANDS);
    expect(snapProgress(4.21 / PIN_BANDS, 5, D)).toBe(1);
  });
  it('coming back up, holds the end until 0.2 band short of it, then settles on P_5', () => {
    expect(snapProgress(4.41 / PIN_BANDS, 5, U)).toBe(1);
    expect(snapProgress(4.39 / PIN_BANDS, 5, U)).toBe(4 / PIN_BANDS);
    expect(snapProgress(4.3 / PIN_BANDS, 5, U)).toBe(4 / PIN_BANDS);
  });
});
