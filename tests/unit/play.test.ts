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

// What the clock decides is pinned in clock.test.ts and the e2e specs; this is the wiring: which element does what,
// one frame loop at a time, and what the observer feeds it.
describe('play.ts wires the clock to the page (spec §2)', () => {
  it('starts at the opening frame, idle, with step 1 shown and no frame requested; the observer reports every 2 %', () => {
    const s = mount();
    expect(s.state()).toBe('idle 0.000 1');
    expect(s.counter.textContent).toBe('Step 1');
    expect(queue.size).toBe(0);
    expect(options.threshold).toContain(0.6);
    expect(options.threshold).toHaveLength(51);
  });

  it('plays once the stage is 60 % on screen, the counter moves as each step starts, and the ambient loops follow data-play', () => {
    const s = mount();
    notify([entry(0.5)]);
    expect(s.state()).toBe('idle 0.000 1');
    expect(s.stage.attrs.has('data-playing')).toBe(false);
    notify([entry(0.6)]);
    expect(s.stage.attrs.has('data-playing')).toBe(true);
    run(3.1);
    expect(s.counter.textContent).toBe('Step 2');
    expect(s.caption.textContent).toBe('Caption 2');
    expect(s.dots.map((d) => d.attrs.get('aria-current'))).toEqual([undefined, 'step', undefined, undefined, undefined]);
    s.toggle.click();
    expect(s.stage.attrs.has('data-playing')).toBe(false);
  });

  it('plays to 5, then stops: no frame left, the loops off, and the scene does not start again by itself', () => {
    const s = mount();
    notify([entry(1)]);
    run(19);
    expect(s.state()).toBe('done 5.000 5');
    expect(queue.size).toBe(0);
    expect(s.stage.attrs.has('data-playing')).toBe(false);
    notify([entry(0)]);
    notify([entry(1)]);
    expect(s.state()).toBe('done 5.000 5');
  });

  it('goes by the last entry of a batch', () => {
    const s = mount();
    notify([entry(1), entry(0)]);
    expect(s.section.dataset.play).toBe('idle');
    notify([entry(0), entry(1)]);
    expect(s.section.dataset.play).toBe('playing');
  });

  it('leaving the screen pauses where it is; a Play pressed below 60 % is not undone by the next scroll', () => {
    const s = mount();
    notify([entry(1)]);
    run(1);
    notify([entry(0.3)]);
    expect(s.section.dataset.play).toBe('paused');
    s.toggle.click();
    notify([entry(0.25)]);
    notify([entry(0.3)]);
    expect(s.section.dataset.play).toBe('playing');
    notify([entry(0)]);
    expect(s.section.dataset.play).toBe('paused');
  });

  it('ignores a long gap between frames (a hidden tab) instead of jumping ahead', () => {
    const s = mount();
    notify([entry(1)]);
    now += 60_000;
    run(1 / 60);
    expect(Number(s.section.dataset.t)).toBeLessThan(0.05);
  });

  it('the button and a tap on the scene both press; the dots jump; one frame loop at a time', () => {
    const s = mount();
    s.toggle.click();
    expect(s.state()).toBe('playing 0.000 1');
    s.view.click();
    expect(s.section.dataset.play).toBe('paused');
    expect(queue.size).toBe(0);
    s.dots[2].click();
    s.dots[3].click();
    expect(s.state()).toBe('playing 3.000 4');
    expect(queue.size).toBe(1);
  });
});
