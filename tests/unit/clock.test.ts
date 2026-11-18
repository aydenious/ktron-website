import { describe, expect, it } from 'vitest';
import { CLIP, DURATION, advance, jump, levelOf, press, seen, start, tick, type Run } from '../../src/components/scene/clock';
import { stepOf } from '../../src/components/scene/steps';

const at = (t: number, mode: Run['mode'], held = false): Run => ({ t, mode, held });

describe('the scene clock (spec §2)', () => {
  it('step k lasts CLIP[k − 1] seconds at normal speed, 18.5 s in all', () => {
    expect(CLIP).toEqual([3.0, 4.0, 5.0, 3.0, 3.5]);
    expect(DURATION).toBe(18.5);
  });

  it('advance runs each step at its own clip length', () => {
    expect(advance(0, 1.5)).toBeCloseTo(0.5, 9); // step 1: 3 s
    expect(advance(1, 2)).toBeCloseTo(1.5, 9); // step 2: 4 s
    expect(advance(2, 2.5)).toBeCloseTo(2.5, 9); // step 3: 5 s
    expect(advance(0, 3)).toBeCloseTo(1, 9);
  });
  it('advance carries leftover time over a step boundary, and stops at 5', () => {
    expect(advance(0.5, 1.5 + 2)).toBeCloseTo(1.5, 9); // 1.5 s finish step 1, 2 s are half of step 2
    expect(advance(0, 18.5)).toBe(5);
    expect(advance(4.5, 99)).toBe(5);
    expect(advance(3, 0)).toBe(3);
  });
  it('the counter and caption change as each step starts: the step is k at t = k − 1', () => {
    expect([0, 1, 2, 3, 4].map((t) => stepOf(t))).toEqual([1, 2, 3, 4, 5]);
    expect(stepOf(advance(0, 3))).toBe(2);
    expect(stepOf(advance(0, 2.99))).toBe(1);
  });

  describe('tick', () => {
    it('moves a playing clock and finishes it at 5', () => {
      expect(tick(at(0, 'playing'), 1.5)).toEqual(at(0.5, 'playing'));
      expect(tick(at(4.9, 'playing'), 10)).toEqual(at(5, 'done'));
    });
    it('leaves a clock that is not playing where it is', () => {
      for (const mode of ['idle', 'paused', 'done'] as const) expect(tick(at(2, mode), 1)).toEqual(at(2, mode));
    });
  });

  describe('the button and a tap on the scene (rule 4)', () => {
    it('starts a scene that has not played (the button reads Play)', () => {
      expect(press(start)).toEqual(at(0, 'playing'));
    });
    it('pauses while playing, and play resumes from the same t', () => {
      expect(press(at(2.5, 'playing'))).toEqual(at(2.5, 'paused', true));
      expect(press(at(2.5, 'paused', true))).toEqual(at(2.5, 'playing'));
    });
    it('plays a clock that is paused because it left the screen', () => {
      expect(press(at(2.5, 'paused'))).toEqual(at(2.5, 'playing'));
    });
    it('replays a finished scene from 0', () => {
      expect(press(at(5, 'done'))).toEqual(at(0, 'playing'));
    });
  });

  describe('on screen and off screen (rules 2, 3, 9)', () => {
    it('autoplays the first time the stage is on screen, from 0', () => {
      expect(seen(start, 'full', 'gone')).toEqual(at(0, 'playing'));
      expect(seen(start, 'partly', 'gone')).toEqual(start);
      expect(seen(start, 'gone', 'full')).toEqual(start);
    });
    it('pauses where it is when the stage leaves the 60 %, and resumes from there when it is back', () => {
      const away = seen(at(2.5, 'playing'), 'partly', 'full');
      expect(away).toEqual(at(2.5, 'paused', false));
      expect(seen(at(2.5, 'playing'), 'gone', 'full')).toEqual(away);
      expect(seen(away, 'full', 'partly')).toEqual(at(2.5, 'playing'));
    });
    it('a Play pressed while the stage is below 60 % keeps playing until the stage next leaves', () => {
      const pressed = press(at(2.5, 'paused'));
      expect(seen(pressed, 'partly', 'partly')).toEqual(pressed); // the next scroll does not undo it
      expect(seen(pressed, 'gone', 'partly')).toEqual(at(2.5, 'paused')); // but leaving the screen does
      expect(seen(pressed, 'partly', 'full')).toEqual(at(2.5, 'paused')); // and so does dropping below 60 % after being on
    });
    it('does not resume a scene the reader paused', () => {
      expect(seen(at(2.5, 'paused', true), 'full', 'gone')).toEqual(at(2.5, 'paused', true));
      expect(seen(at(2.5, 'paused', true), 'gone', 'full')).toEqual(at(2.5, 'paused', true));
    });
    it('never plays a finished scene again by itself', () => {
      expect(seen(at(5, 'done'), 'full', 'gone')).toEqual(at(5, 'done'));
      expect(seen(at(5, 'done'), 'gone', 'full')).toEqual(at(5, 'done'));
    });
  });

  describe('the step dots (rule 5)', () => {
    it('dot k sets the clock to k − 1 and plays on, from any state', () => {
      for (const from of [start, at(2.5, 'playing'), at(2.5, 'paused', true), at(5, 'done')])
        expect([1, 2, 3, 4, 5].map((k) => jump(k))).toEqual([0, 1, 2, 3, 4].map((t) => at(t, 'playing')));
    });
    it('a jumped clock plays on to 5 and stops', () => {
      expect(tick(jump(5), 99)).toEqual(at(5, 'done'));
      expect(tick(jump(3), DURATION)).toEqual(at(5, 'done'));
    });
  });

  describe('the visibility rule', () => {
    const entry = (ratio: number, rect: number, root: number, hit = ratio > 0) => ({ intersectionRatio: ratio, isIntersecting: hit, intersectionRect: { height: rect }, rootBounds: { height: root } });
    it('on screen from 60 % of the stage; partly while some of it shows; gone otherwise', () => {
      expect(levelOf(entry(0.6, 240, 800))).toBe('full');
      expect(levelOf(entry(0.59, 236, 800))).toBe('partly');
      expect(levelOf(entry(0, 0, 800))).toBe('gone');
    });
    it('a stage taller than the viewport counts once it fills 60 % of the viewport', () => {
      expect(levelOf(entry(0.5, 480, 800))).toBe('full');
      expect(levelOf(entry(0.5, 470, 800))).toBe('partly');
      expect(levelOf({ intersectionRatio: 0.5, isIntersecting: true, intersectionRect: { height: 500 }, rootBounds: null })).toBe('partly');
    });
  });
});
