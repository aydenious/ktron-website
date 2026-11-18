// Clock → scene: plays the scene clock on its own once the stage is on screen, and wires the controls. Spec §2.
import { jump, onScreen, press, seen, start, tick, type Run } from './clock';
import { stepOf } from './steps';

interface Words {
  counter: string;
  caption: string;
}

interface PlayOptions {
  /** Gets data-step, data-t and data-play. */
  section: HTMLElement;
  /** Holds [data-counter], [data-caption], [data-view] (the scene, tapped to replay), [data-toggle] and the five [data-dot]. */
  stage: HTMLElement;
  /** Index k − 1 for step k. */
  words: readonly Words[];
  paint: (t: number) => void;
}

/** A frame that arrives later than this (a hidden tab, a stalled page) moves the clock by this much, not by the gap. */
const MAX_FRAME_S = 0.1;
/** The observer reports every 2 % of the stage, so the 60 % line (and a tall stage's) is seen as it is crossed. */
const THRESHOLDS = Array.from({ length: 51 }, (_, i) => i / 50);

/** Starts the clock at the opening frame. It plays by itself the first time the stage is on screen. */
export function play({ section, stage, words, paint }: PlayOptions): void {
  const counter = stage.querySelector('[data-counter]')!;
  const caption = stage.querySelector('[data-caption]')!;
  const dots = [...stage.querySelectorAll('[data-dot]')];
  let run: Run = start;
  let shown = 0; // the step on the counter now
  let frame = 0;
  let last = 0;

  const draw = () => {
    paint(run.t);
    section.dataset.t = run.t.toFixed(3);
    section.dataset.play = run.mode;
    const n = stepOf(run.t);
    if (n === shown) return;
    shown = n;
    section.dataset.step = String(n);
    counter.textContent = words[n - 1].counter;
    caption.textContent = words[n - 1].caption;
    dots.forEach((d, i) => (i + 1 === n ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current')));
  };
  const onFrame = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, MAX_FRAME_S);
    last = now;
    set(tick(run, dt));
    if (run.mode === 'playing') frame = requestAnimationFrame(onFrame);
  };
  const set = (next: Run) => {
    const was = run.mode;
    run = next;
    draw();
    if (was !== 'playing' && next.mode === 'playing') {
      last = performance.now();
      frame = requestAnimationFrame(onFrame);
    } else if (was === 'playing' && next.mode !== 'playing') cancelAnimationFrame(frame);
  };

  draw();
  const toggle = () => set(press(run));
  stage.querySelector('[data-view]')!.addEventListener('click', toggle);
  stage.querySelector('[data-toggle]')!.addEventListener('click', toggle);
  dots.forEach((d, i) => d.addEventListener('click', () => set(jump(run, i + 1))));

  // The clock runs only while the stage is on screen; the ambient loops (scene.css) go by any part of it.
  new IntersectionObserver((entries) => {
    const e = entries.at(-1)!;
    stage.toggleAttribute('data-playing', e.isIntersecting);
    set(seen(run, onScreen(e)));
  }, { threshold: THRESHOLDS }).observe(stage);
}
