import { describe, expect, it } from 'vitest';
import {
  FACTORY_X, HOUSE_X, INSPECT_X, MAX_SPEED, STEPS, STILLS, VIEW_W, WORLD_W, camera, stateAt, stepOf, view,
} from '../../src/components/scene/steps';

const samples = Array.from({ length: 501 }, (_, i) => i / 100); // 0.00 … 5.00
const crates = (t: number) => {
  const s = stateAt(t);
  return s.vanCrates + s.houseCrates.filter(Boolean).length + s.factoryCrates;
};

describe('scene model (PRD §6)', () => {
  it('step 1: loaded van at the factory, daytime', () => {
    expect(stateAt(0)).toEqual({
      vanX: FACTORY_X, facing: 1, night: 0, vanCrates: 4,
      houseCrates: [false, false, false, false], lens: false, factoryCrates: 0,
    });
  });
  it('step 2: a crate goes into each house in turn', () => {
    expect(stateAt(1.1).houseCrates).toEqual([true, false, false, false]);
    expect(stateAt(1.1).vanX).toBe(HOUSE_X[0]);
    expect(stateAt(2).houseCrates).toEqual([true, true, true, true]);
    expect(stateAt(2).vanCrates).toBe(0);
  });
  it('step 3: night falls, then morning, then every crate is collected', () => {
    expect(stateAt(2).night).toBe(0);
    expect(stateAt(2.25).night).toBe(1);
    expect(stateAt(2.5).night).toBe(0);
    expect(stateAt(2.999).vanCrates).toBe(4);
    expect(stateAt(2.999).houseCrates).toEqual([false, false, false, false]);
  });
  it('step 4: the van is at the inspection house and the lens glows', () => {
    expect(stateAt(4)).toMatchObject({ vanX: INSPECT_X, lens: true, vanCrates: 4 });
    expect(stateAt(3.5).lens).toBe(false);
  });
  it('step 5: back at the factory, crates unloaded', () => {
    expect(stateAt(5)).toMatchObject({ vanX: FACTORY_X, vanCrates: 0, factoryCrates: 4, lens: false });
  });
  it('clamps outside 0–5', () => {
    expect(stateAt(-1)).toEqual(stateAt(0));
    expect(stateAt(9)).toEqual(stateAt(STEPS));
  });
  it('never loses or invents a crate', () => {
    for (const t of samples) expect(crates(t), `t=${t}`).toBe(4);
  });
  it('the van never jumps: no sample moves further than the fastest segment allows', () => {
    const margin = 0.2; // vanX is rounded to 0.1 at both ends of a step
    const limit = MAX_SPEED * 0.01 + margin;
    for (let i = 1; i < samples.length; i++) {
      expect(Math.abs(stateAt(samples[i]).vanX - stateAt(samples[i - 1]).vanX), `t=${samples[i]}`).toBeLessThanOrEqual(limit);
    }
  });
  it('the van faces the way it drives, and only turns round while standing', () => {
    const x = samples.map((t) => stateAt(t).vanX);
    const face = samples.map((t) => stateAt(t).facing);
    const dir = x.map((v, i) => (i + 1 < x.length ? Math.sign(x[i + 1] - v) : 0));
    for (let i = 0; i < x.length; i++) if (dir[i] !== 0) expect(face[i], `moving at t=${samples[i]}`).toBe(dir[i]);
    for (let a = 0; a < x.length; ) {
      if (dir[a] !== 0) { a++; continue; }
      let b = a;
      while (b + 1 < x.length && dir[b + 1] === 0) b++;
      const before = a > 0 ? Math.sign(x[a] - x[a - 1]) || face[a - 1] : null;
      const after = b + 1 < x.length ? dir[b + 1] : null;
      const run = face.slice(a, b + 1);
      for (const f of run) expect([before, after], `standing at t=${samples[a]}`).toContain(f);
      // at most one turn, from the way it came to the way it goes
      expect(new Set(run).size, `standing at t=${samples[a]}`).toBeLessThanOrEqual(2);
      if (new Set(run).size === 2) expect([run[0], run[run.length - 1]], `turn at t=${samples[a]}`).toEqual([before, after]);
      a = b + 1;
    }
  });
  it('the view keeps the van on screen', () => {
    for (const t of samples) {
      const x = stateAt(t).vanX;
      expect(camera(x)).toBeGreaterThanOrEqual(0);
      expect(camera(x)).toBeLessThanOrEqual(WORLD_W - VIEW_W);
      expect(x - camera(x)).toBeGreaterThanOrEqual(60);
      expect(x - camera(x)).toBeLessThanOrEqual(VIEW_W - 60);
    }
  });
  it('step numbers', () => {
    expect([0, 0.99, 1, 2.5, 4.99, 5].map(stepOf)).toEqual([1, 1, 2, 3, 5, 5]);
  });
  it('five stills, one per step, the third at night', () => {
    expect(STILLS).toEqual([0, 2, 2.25, 4, 5].map(stateAt));
    expect(STILLS[2].night).toBe(1);
    expect(view.night(STILLS[2])).toBe(0.85);
    expect(view.vanBody(stateAt(4.5))).toBe('scale(-1 1)');
    expect(view.world(stateAt(4))).toBe('translate(-240 0)');
  });
});
