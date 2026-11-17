// Scene state → SVG attribute values. Every moving part of the drawing carries a `data-<hook>="<index>"`
// attribute; the server drawing writes its first value with `bind`, and the painter rewrites it from HOOKS.
import { camera, DOOR, HINGE_DX, HOUSE_X, KERB, ROAD_Y, ROLLER_TOP, WALK_Y } from './layout';
import type { SceneState } from './steps';

const r = (n: number, d = 1) => Number(n.toFixed(d)) || 0;
const shown = (on: boolean) => (on ? 'visible' : 'hidden');
const opacity = (n: number) => r(n, 2);

export const view = {
  world: (s: SceneState) => `translate(${-r(camera(s.vanX))} 0)`,
  van: (s: SceneState) => `translate(${r(s.vanX)} ${ROAD_Y})`,
  vanBody: (s: SceneState) => `scale(${s.facing} 1)`,
  wheel: (s: SceneState) => `rotate(${s.wheel})`,
  /** The label and the rack crates stay outside the flip group; this keeps them over the box's centre. */
  vanLoad: (s: SceneState) => `translate(${r((1 - s.facing) * 5)} 0)`,
  vanCrate: (s: SceneState, j: number) => shown(j < s.vanCrates),
  /** The night sky layer; 0.85 at full night so the stars and moon read against it. */
  night: (s: SceneState) => opacity(s.night * 0.85),
  /** Night colours of the hills and palms. */
  dark: (s: SceneState) => opacity(s.night),
  /** Warm colours of the hills, palms and sun at sunset and at dawn. */
  dusk: (s: SceneState) => opacity(Math.max(s.sunset, s.dawn)),
  /** The dark wash over every building at night (the lit windows sit above it). */
  wash: (s: SceneState) => opacity(s.night * 0.5),
  sun: (s: SceneState) => `translate(${r(s.sunX)} ${r(s.sunY)})`,
  moonRise: (s: SceneState) => `translate(0 ${r((1 - s.moon) * 80)})`,
  /** The roller door's shutter, scaled up into the fascia as the door opens. */
  factoryDoor: (s: SceneState) => {
    const k = r(1 - s.door, 3);
    return `matrix(1 0 0 ${k} 0 ${r(ROLLER_TOP * (1 - k), 2)})`;
  },
  dockCrate: (s: SceneState, k: number) => shown(k < s.dockCrates),
  driver: (s: SceneState) => `translate(${r(s.driver.x)} ${WALK_Y})`,
  resident: (s: SceneState, i: number) => {
    const out = s.residents[i].out;
    return `translate(${r(HOUSE_X[i] + DOOR.dx + (KERB.dx - DOOR.dx) * out, 2)} ${r(DOOR.y + (KERB.y - DOOR.y) * out, 2)})`;
  },
  /** A house door swings open on its hinge (seen edge-on, it narrows to about a quarter). */
  houseDoor: (s: SceneState, i: number) => {
    const k = r(1 - 0.73 * s.residents[i].door, 3);
    return `matrix(${k} 0 0 1 ${r((HOUSE_X[i] + HINGE_DX) * (1 - k), 2)} 0)`;
  },
  face: (facing: -1 | 0 | 1) => `translate(${facing * 1.5} 0)`,
  leg: (stride: number, sign: 1 | -1) => `rotate(${r(sign * stride) || 0})`,
  houseCrate: (s: SceneState, i: number) => shown(s.houseCrates[i]),
  lit: (s: SceneState, i: number) => opacity(s.lit[i]),
  lens: (s: SceneState) => opacity(s.lens),
  tick: (s: SceneState) => `scale(${r(s.tick, 3)})`,
};

type Attr = 'transform' | 'opacity' | 'visibility';
interface Binding {
  attr: Attr;
  value: (s: SceneState, i: number) => string | number;
}
const at = (attr: Attr, value: Binding['value']): Binding => ({ attr, value });

/** Every hook the painter updates. The index after `data-<hook>=` is the house, crate or wheel number. */
export const HOOKS = {
  world: at('transform', view.world),
  van: at('transform', view.van),
  'van-body': at('transform', view.vanBody),
  wheel: at('transform', view.wheel),
  headlight: at('opacity', (s) => opacity(s.headlights)),
  'van-load': at('transform', view.vanLoad),
  'van-crate': at('visibility', view.vanCrate),
  sunset: at('opacity', (s) => opacity(s.sunset)),
  night: at('opacity', view.night),
  dawn: at('opacity', (s) => opacity(s.dawn)),
  dusk: at('opacity', view.dusk),
  dark: at('opacity', view.dark),
  wash: at('opacity', view.wash),
  stars: at('opacity', view.dark),
  sun: at('transform', view.sun),
  moon: at('opacity', (s) => opacity(s.moon)),
  'moon-rise': at('transform', view.moonRise),
  'factory-door': at('transform', view.factoryDoor),
  'dock-crate': at('visibility', view.dockCrate),
  driver: at('transform', view.driver),
  'driver-show': at('visibility', (s) => shown(s.driver.shown)),
  'driver-face': at('transform', (s) => view.face(s.driver.facing)),
  'driver-crate': at('visibility', (s) => shown(s.driver.carrying)),
  'driver-arms': at('visibility', (s) => shown(!s.driver.carrying)),
  'driver-leg-a': at('transform', (s) => view.leg(s.driver.stride, 1)),
  'driver-leg-b': at('transform', (s) => view.leg(s.driver.stride, -1)),
  resident: at('transform', view.resident),
  'resident-show': at('visibility', (s, i) => shown(s.residents[i].door > 0)),
  'resident-face': at('transform', (s, i) => view.face(s.residents[i].facing)),
  'resident-crate': at('visibility', (s, i) => shown(s.residents[i].carrying)),
  'resident-arms': at('visibility', (s, i) => shown(!s.residents[i].carrying)),
  'resident-leg-a': at('transform', (s, i) => view.leg(s.residents[i].stride, 1)),
  'resident-leg-b': at('transform', (s, i) => view.leg(s.residents[i].stride, -1)),
  'house-door': at('transform', view.houseDoor),
  'house-crate': at('visibility', view.houseCrate),
  lit: at('opacity', view.lit),
  'qc-glow': at('opacity', (s) => opacity(s.qcGlow)),
  lens: at('opacity', view.lens),
  tick: at('transform', view.tick),
} satisfies Record<string, Binding>;

export type Hook = keyof typeof HOOKS;

/** The attributes a drawing part spreads onto a hooked element: `<g {...bind('van', s)}>`. */
export function bind(hook: Hook, s: SceneState, i = 0): Record<string, string> {
  const b: Binding = HOOKS[hook];
  return { [`data-${hook}`]: String(i), [b.attr]: String(b.value(s, i)) };
}
