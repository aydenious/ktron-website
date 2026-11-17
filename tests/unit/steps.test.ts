import { describe, expect, it } from 'vitest';
import {
  DOCK_X, FACTORY_X, FRONT_X, HOUSE_X, INSPECT_X, MAX_SPEED, STEPS, STILLS, STILL_T, STOP_X, VIEW_W, WORLD_W,
  camera, stateAt, stepOf, view,
} from '../../src/components/scene/steps';
import { HOOKS, bind } from '../../src/components/scene/view';

const samples = Array.from({ length: 1001 }, (_, i) => i / 200); // 0.000 … 5.000
const crates = (t: number) => {
  const s = stateAt(t);
  const residents = s.residents.filter((r) => r.carrying).length;
  return s.dockCrates + s.vanCrates + s.houseCrates.filter(Boolean).length + residents + Number(s.driver.carrying);
};

describe('scene model (spec §3)', () => {
  it('step 1 opens with the van empty at the dock, 4 crates on the dock and the driver beside them', () => {
    const s = stateAt(0);
    expect([s.vanX, s.facing, s.vanCrates, s.dockCrates, s.door]).toEqual([FACTORY_X, 1, 0, 4, 1]);
    expect(s.driver).toEqual({ x: DOCK_X, shown: true, carrying: false, stride: 0, facing: 0 });
    expect([s.night, s.sunset, s.dawn, s.moon, s.headlights, s.lens, s.tick]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(s.houseCrates).toEqual([false, false, false, false]);
  });
  it('step 1 ends with the van loaded at house 1, the driver in the cab and the roller door shut', () => {
    const s = stateAt(1);
    expect([s.vanX, s.vanCrates, s.dockCrates, s.door, s.driver.shown]).toEqual([STOP_X[0], 4, 0, 0, false]);
    expect(STOP_X[0]).toBe(HOUSE_X[0] - 40);
  });
  it('step 2: each house takes its crate at its own time, and the windows light up', () => {
    expect(stateAt(1.139).houseCrates[0]).toBe(false);
    expect(stateAt(1.141).residents[0].carrying).toBe(true);
    expect(stateAt(1.185).houseCrates).toEqual([true, false, false, false]);
    expect(stateAt(1.435).houseCrates).toEqual([true, true, false, false]);
    expect(stateAt(2).houseCrates).toEqual([true, true, true, true]);
    expect(stateAt(2).vanCrates).toBe(0);
    expect(stateAt(2).lit).toEqual([1, 1, 1, 1]);
  });
  it('step 3: night falls, then morning, then every crate is collected', () => {
    expect([2, 2.25, 2.5].map((t) => stateAt(t).night)).toEqual([0, 1, 0]);
    expect(stateAt(2.25).moon).toBe(1);
    expect(stateAt(3).vanCrates).toBe(4);
    expect(stateAt(3).houseCrates).toEqual([false, false, false, false]);
    expect(stateAt(3).lit).toEqual([0, 0, 0, 0]);
  });
  it('step 4: the van drives to the inspection house and the lens shows', () => {
    expect(stateAt(4).vanX).toBe(INSPECT_X);
    expect([stateAt(4).lens, stateAt(4).tick, stateAt(4).qcGlow]).toEqual([1, 1, 1]);
  });
  it('step 5 ends with 3 crates on the dock and the driver carrying the 4th in front of the factory', () => {
    const s = stateAt(5);
    expect([s.vanX, s.facing, s.vanCrates, s.dockCrates, s.door]).toEqual([FACTORY_X, -1, 0, 3, 1]);
    expect(s.driver).toEqual({ x: FRONT_X, shown: true, carrying: true, stride: 0, facing: 0 });
  });
  it('4 crates exist at every moment, wherever they are', () => {
    for (const t of samples) expect(crates(t), `t=${t}`).toBe(4);
  });
  it('clamps outside 0–5', () => {
    expect(stateAt(-1)).toEqual(stateAt(0));
    expect(stateAt(9)).toEqual(stateAt(STEPS));
  });
  it('the van never drives faster than the jump test allows (eased peak)', () => {
    expect(MAX_SPEED).toBeLessThanOrEqual(1850);
    for (let i = 1; i < samples.length; i++) {
      const jump = Math.abs(stateAt(samples[i]).vanX - stateAt(samples[i - 1]).vanX);
      expect(jump, `t=${samples[i]}`).toBeLessThanOrEqual(MAX_SPEED * 0.005 + 0.2);
    }
  });
  it('the camera keeps the van 60 units inside the view and the world inside its bounds', () => {
    for (const t of samples) {
      const s = stateAt(t);
      const x = s.vanX - camera(s.vanX);
      expect(x, `t=${t}`).toBeGreaterThanOrEqual(60);
      expect(x, `t=${t}`).toBeLessThanOrEqual(VIEW_W - 60);
      expect(camera(s.vanX)).toBeLessThanOrEqual(WORLD_W - VIEW_W);
    }
  });
  it('stepOf maps the clock to the counter', () => {
    expect([0, 0.99, 1, 4.99, 5].map(stepOf)).toEqual([1, 1, 2, 5, 5]);
  });
});

describe('stills (spec §6)', () => {
  it('are taken at each step\'s defining moment', () => {
    expect(STILL_T).toEqual([0.55, 2, 2.25, 4, 5]);
    STILLS.forEach((s, i) => expect(s).toEqual(stateAt(STILL_T[i])));
  });
  it('face right until the last, which faces left', () => {
    expect(STILLS.map((s) => s.facing)).toEqual([1, 1, 1, 1, -1]);
  });
  it('only still 3 is at night', () => {
    expect(STILLS.map((s) => s.night > 0)).toEqual([false, false, true, false, false]);
    expect(view.night(STILLS[2])).toBe(0.85);
  });
  it('only still 4 shows the lens', () => {
    expect(STILLS.map((s) => s.lens)).toEqual([0, 0, 0, 1, 0]);
  });
  it('still 1 has 3 crates on the van and the driver carrying the 4th; still 5 has 3 on the dock', () => {
    expect([STILLS[0].dockCrates, STILLS[0].vanCrates, STILLS[0].driver.carrying, STILLS[0].door]).toEqual([0, 3, true, 1]);
    expect([STILLS[4].dockCrates, STILLS[4].vanCrates, STILLS[4].driver.carrying]).toEqual([3, 0, true]);
  });
  it('still 1 has the same van and world as clock 0', () => {
    expect(view.van(STILLS[0])).toBe(view.van(stateAt(0)));
    expect(view.world(STILLS[0])).toBe(view.world(stateAt(0)));
  });
});

describe('view', () => {
  it('writes the attribute strings the drawing and the painter share', () => {
    expect(view.vanBody(stateAt(4.5))).toBe('scale(-1 1)');
    expect(view.world(stateAt(4))).toBe('translate(-240 0)');
    expect(view.van(stateAt(0))).toBe(`translate(${FACTORY_X} 344)`);
    expect(view.factoryDoor(stateAt(0))).toBe('matrix(1 0 0 0 0 236)');
    expect(view.factoryDoor(stateAt(2))).toBe('matrix(1 0 0 1 0 0)');
    expect(view.leg(0, -1)).toBe('rotate(0)');
  });
});

describe('hooks', () => {
  it('bind gives a drawing part its hook index and its first attribute value', () => {
    expect(bind('van', stateAt(0))).toEqual({ 'data-van': '0', transform: `translate(${FACTORY_X} 344)` });
    expect(bind('house-crate', stateAt(2), 3)).toEqual({ 'data-house-crate': '3', visibility: 'visible' });
  });
  it('the van load keeps its centre over the box whichever way the van faces (ruling R10)', () => {
    expect(HOOKS['van-load'].value(stateAt(0.5), 0)).toBe('translate(0 0)');
    expect(HOOKS['van-load'].value(stateAt(2.6), 0)).toBe('translate(10 0)');
  });
  it('every hook writes a clean value at every moment: no NaN, undefined or −0', () => {
    for (const t of samples) {
      const s = stateAt(t);
      for (const hook of Object.keys(HOOKS) as (keyof typeof HOOKS)[]) {
        for (const i of [0, 1, 2, 3]) {
          const value = Object.values(bind(hook, s, i))[1];
          expect(value, `${hook}[${i}] at t=${t}`).not.toMatch(/NaN|undefined|-0(?![.\d])/);
        }
      }
    }
  });
});
