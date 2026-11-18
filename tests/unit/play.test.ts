import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { play } from '../../src/components/scene/play';

type Handler = () => void;
/** The few parts of an element that play.ts touches. */
function fake() {
  const handlers = new Map<string, Handler>();
  const attrs = new Map<string, string>();
  return {
    textContent: '',
    dataset: {} as Record<string, string>,
    attrs,
    addEventListener: (type: string, f: Handler) => { handlers.set(type, f); },
    click: () => handlers.get('click')!(),
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
    removeAttribute: (k: string) => { attrs.delete(k); },
    toggleAttribute: (k: string, on: boolean) => { if (on) attrs.set(k, ''); else attrs.delete(k); },
  };
}

let notify!: (entries: object[]) => void;
let options!: IntersectionObserverInit;
let queue: Map<number, FrameRequestCallback>;
let now = 0;
let nextId = 1;

beforeEach(() => {
  queue = new Map();
  now = 1000;
  nextId = 1;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: typeof notify, o: IntersectionObserverInit) { notify = cb; options = o; }
    observe() {}
  });
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { queue.set(nextId, f); return nextId++; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue.delete(id); });
  vi.stubGlobal('performance', { now: () => now });
});
afterEach(() => vi.unstubAllGlobals());

/** The page's frames: `seconds` of 60 fps. */
function run(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60) && queue.size > 0; i++) {
    now += 1000 / 60;
    const frames = [...queue.values()];
    queue.clear();
    for (const f of frames) f(now);
  }
}
const entry = (ratio: number, intersecting = ratio > 0) => ({ intersectionRatio: ratio, isIntersecting: intersecting, intersectionRect: { height: ratio * 400 }, rootBounds: { height: 800 } });

function mount() {
  const section = fake(), stage = fake(), counter = fake(), caption = fake(), view = fake(), toggle = fake();
  const dots = [1, 2, 3, 4, 5].map(() => fake());
  const painted: number[] = [];
  Object.assign(stage, {
    querySelector: (s: string) => ({ '[data-counter]': counter, '[data-caption]': caption, '[data-view]': view, '[data-toggle]': toggle })[s],
    querySelectorAll: () => dots,
  });
  const words = [1, 2, 3, 4, 5].map((n) => ({ counter: `Step ${n}`, caption: `Caption ${n}` }));
  play({ section: section as unknown as HTMLElement, stage: stage as unknown as HTMLElement, words, paint: (t) => painted.push(t) });
  return { section, stage, counter, caption, view, toggle, dots, painted, state: () => `${section.dataset.play} ${section.dataset.t} ${section.dataset.step}` };
}

describe('play.ts drives the scene from a clock (spec §2)', () => {
  it('starts at the opening frame, idle, with step 1 shown and nothing running', () => {
    const s = mount();
    expect(s.state()).toBe('idle 0.000 1');
    expect(s.counter.textContent).toBe('Step 1');
    expect(s.caption.textContent).toBe('Caption 1');
    expect(s.painted).toEqual([0]);
    expect(queue.size).toBe(0);
  });

  it('plays when the stage is first 60 % on screen, not before, and the counter moves as each step starts', () => {
    const s = mount();
    expect(options.threshold).toContain(0.6);
    notify([entry(0.5)]);
    expect(s.state()).toBe('idle 0.000 1');
    notify([entry(0.6)]);
    expect(s.section.dataset.play).toBe('playing');
    run(2.9);
    expect(s.counter.textContent).toBe('Step 1');
    run(0.2);
    expect(s.counter.textContent).toBe('Step 2');
    expect(s.caption.textContent).toBe('Caption 2');
    expect(s.dots.map((d) => d.attrs.get('aria-current'))).toEqual([undefined, 'step', undefined, undefined, undefined]);
  });

  it('plays 18.5 s to t 5, stops there, and never starts again by itself', () => {
    const s = mount();
    notify([entry(1)]);
    run(18.3);
    expect(s.section.dataset.play).toBe('playing');
    run(0.5);
    expect(s.state()).toBe('done 5.000 5');
    expect(queue.size).toBe(0);
    notify([entry(0)]);
    notify([entry(1)]);
    expect(s.state()).toBe('done 5.000 5');
    expect(queue.size).toBe(0);
  });

  it('pauses where it is while off screen and resumes from there', () => {
    const s = mount();
    notify([entry(1)]);
    run(1);
    notify([entry(0.3)]);
    const held = s.section.dataset.t;
    expect(s.section.dataset.play).toBe('paused');
    run(2);
    expect(s.section.dataset.t).toBe(held);
    notify([entry(0.8)]);
    expect(s.section.dataset.play).toBe('playing');
    run(0.5);
    expect(Number(s.section.dataset.t)).toBeGreaterThan(Number(held));
  });

  it('goes by the last entry of a batch, for the clock and for the ambient loops', () => {
    const s = mount();
    notify([entry(1), entry(0)]);
    expect(s.section.dataset.play).toBe('idle');
    expect(s.stage.attrs.has('data-playing')).toBe(false);
    notify([entry(0), entry(1)]);
    expect(s.section.dataset.play).toBe('playing');
    expect(s.stage.attrs.has('data-playing')).toBe(true);
  });

  it('ignores a long gap between frames (a hidden tab) instead of jumping ahead', () => {
    const s = mount();
    notify([entry(1)]);
    now += 60_000;
    run(1 / 60);
    expect(Number(s.section.dataset.t)).toBeLessThan(0.05);
  });

  it('the button pauses and plays; a pause by the button survives the stage leaving and returning', () => {
    const s = mount();
    notify([entry(1)]);
    run(1);
    s.toggle.click();
    expect(s.section.dataset.play).toBe('paused');
    const held = s.section.dataset.t;
    run(1);
    expect(s.section.dataset.t).toBe(held);
    notify([entry(0)]);
    notify([entry(1)]);
    expect(s.section.dataset.play).toBe('paused');
    s.toggle.click();
    expect(s.section.dataset.play).toBe('playing');
  });

  it('a tap on the scene does what the button does, and replays a finished scene from 0', () => {
    const s = mount();
    notify([entry(1)]);
    run(1);
    s.view.click();
    expect(s.section.dataset.play).toBe('paused');
    s.view.click();
    run(19);
    expect(s.section.dataset.play).toBe('done');
    s.view.click();
    expect(s.section.dataset.play).toBe('playing');
    expect(s.section.dataset.t).toBe('0.000');
    expect(s.counter.textContent).toBe('Step 1');
    run(19);
    expect(s.state()).toBe('done 5.000 5');
  });

  it('the first press of Play, before the autoplay, starts the scene', () => {
    const s = mount();
    s.toggle.click();
    expect(s.state()).toBe('playing 0.000 1');
  });

  it('dot k sets the clock to k − 1 and plays on to 5, from a finished scene too', () => {
    const s = mount();
    notify([entry(1)]);
    s.dots[2].click();
    expect(s.state()).toBe('playing 2.000 3');
    expect(s.counter.textContent).toBe('Step 3');
    run(30);
    expect(s.state()).toBe('done 5.000 5');
    s.dots[1].click();
    expect(s.state()).toBe('playing 1.000 2');
    run(2);
    expect(Number(s.section.dataset.t)).toBeGreaterThan(1.4);
    expect(Number(s.section.dataset.t)).toBeLessThan(1.6);
  });
});
