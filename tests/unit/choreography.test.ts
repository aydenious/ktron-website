// Sweeps of the storyboard at 0.005 of a step: who may be where, and who may hold what (spec §8).
import { describe, expect, it } from 'vitest';
import { DOCK_X, FACTORY_X, KERB_PATH, LOAD_X, STOP_X } from '../../src/components/scene/layout';
import * as T from '../../src/components/scene/timeline';
import { stateAt } from '../../src/components/scene/steps';

const ts = Array.from({ length: 1001 }, (_, i) => i / 200);
const HOUSES = [0, 1, 2, 3];
const HOLDERS: T.Holder[] = ['dock', 'van', 'driver', ...HOUSES.flatMap((i): T.Holder[] => [`resident-${i}`, `house-${i}`])];
const firstBad = (check: (t: number) => boolean) => ts.find((t) => !check(t));
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

describe('choreography (spec §8)', () => {
  it('every keyframe table runs forward in time', () => {
    const tables = [T.VAN_X, T.DRIVER_X, T.SUN_X, T.SUN_Y, T.FACTORY_DOOR, ...T.HOUSE_DOOR, ...T.RESIDENT_OUT, ...T.LIT];
    for (const keys of tables) keys.slice(1).forEach(([t], i) => expect(t).toBeGreaterThanOrEqual(keys[i][0]));
  });
  it('4 crates, never a negative holding', () => {
    expect(firstBad((t) => HOLDERS.reduce((n, h) => n + T.holding(h, t), 0) === 4)).toBeUndefined();
    expect(firstBad((t) => HOLDERS.every((h) => T.holding(h, t) >= 0))).toBeUndefined();
  });
  it('a resident is outside only while their door is open and the van stands at their stop', () => {
    for (const i of HOUSES) {
      expect(firstBad((t) => {
        const s = stateAt(t);
        return s.residents[i].out === 0 || (s.residents[i].door > 0 && s.vanX === STOP_X[i]);
      }), `house ${i}`).toBeUndefined();
    }
  });
  it('a lit window means the resident is inside with the door shut', () => {
    for (const i of HOUSES) {
      expect(firstBad((t) => {
        const s = stateAt(t);
        return s.lit[i] === 0 || (s.residents[i].out === 0 && s.residents[i].door === 0);
      }), `house ${i}`).toBeUndefined();
    }
  });
  it('the driver is shown only while the van stands at the factory, and never holds a crate in the cab', () => {
    expect(firstBad((t) => !stateAt(t).driver.shown || stateAt(t).vanX === FACTORY_X)).toBeUndefined();
    expect(firstBad((t) => stateAt(t).driver.shown || !stateAt(t).driver.carrying)).toBeUndefined();
  });
  it('the van only turns round while standing, and never drives backwards', () => {
    for (const [t] of T.VAN_FACING.slice(1)) {
      expect([T.heading(T.VAN_X, t), T.heading(T.VAN_X, t - 1e-6)], `turn at ${t}`).toEqual([0, 0]);
    }
    expect(firstBad((t) => [0, T.held(T.VAN_FACING, t)].includes(T.heading(T.VAN_X, t)))).toBeUndefined();
  });
  it('crates change hands only between standing holders at the same place', () => {
    for (const m of T.TRANSFERS) {
      const parties = [m.from, m.to];
      const at = `${m.from} → ${m.to} at ${m.t}`;
      if (parties.includes('van')) expect(T.heading(T.VAN_X, m.t), at).toBe(0);
      if (parties.includes('driver')) {
        expect(T.heading(T.DRIVER_X, m.t), at).toBe(0);
        expect(T.held(T.DRIVER_SHOWN, m.t), at).toBe(1);
        const mark = parties.includes('dock') ? DOCK_X : LOAD_X;
        expect(near(T.track(T.DRIVER_X, m.t), mark), at).toBe(true);
      }
      if (parties.includes('van') && parties.includes('driver')) expect(T.track(T.VAN_X, m.t), at).toBe(FACTORY_X);
      const resident = parties.find((p) => p.startsWith('resident'));
      const i = Number(resident?.split('-')[1]);
      if (resident && parties.includes('van')) {
        expect(T.track(T.RESIDENT_OUT[i], m.t), at).toBe(1);
        expect(near(T.track(T.VAN_X, m.t), STOP_X[i]), at).toBe(true);
      }
      if (resident && parties.some((p) => p.startsWith('house'))) {
        expect(T.track(T.RESIDENT_OUT[i], m.t), at).toBe(0);
        expect(T.track(T.HOUSE_DOOR[i], m.t), at).toBeGreaterThan(0);
      }
    }
  });
  it('anyone standing has a stride of 0, and every walk ends with both feet down', () => {
    expect(firstBad((t) => T.heading(T.DRIVER_X, t) !== 0 || stateAt(t).driver.stride === 0)).toBeUndefined();
    for (const [t] of T.DRIVER_X) expect(Math.abs(T.stride(T.DRIVER_X, t))).toBeLessThan(1e-9);
    for (const i of HOUSES) {
      expect(firstBad((t) => T.heading(T.RESIDENT_OUT[i], t) !== 0 || stateAt(t).residents[i].stride === 0)).toBeUndefined();
    }
  });
  it('people walk no faster than the van drives', () => {
    const peak = (keys: readonly T.Key[], scale = 1) => Math.max(...keys.slice(1).map(([t, v], k) => {
      const dt = t - keys[k][0];
      return dt > 0 ? (1.5 * Math.abs(v - keys[k][1]) * scale) / dt : 0;
    }));
    expect(peak(T.DRIVER_X)).toBeLessThanOrEqual(1850);
    for (const i of HOUSES) expect(peak(T.RESIDENT_OUT[i], KERB_PATH)).toBeLessThanOrEqual(1850);
  });
});
