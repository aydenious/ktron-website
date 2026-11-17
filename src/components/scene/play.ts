// Scroll → scene: pins the stage and plays the scene clock to each committed step. Spec §2.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PIN_BANDS, bandPx, committedStep, playPlan, snapProgress } from './scroll';

interface Words {
  counter: string;
  caption: string;
}

interface PlayOptions {
  /** Gets data-step, data-t, data-start, data-end and data-band. */
  section: HTMLElement;
  /** Pinned; holds [data-counter] and [data-caption]. */
  stage: HTMLElement;
  /** Index k − 1 for step k. */
  words: readonly Words[];
  paint: (t: number) => void;
  /** The sticky header's height, px. */
  header: () => number;
  /** True while the page's own scroll (a clicked header link) is still landing: the snap leaves it alone. */
  holdSnap?: () => boolean;
}

/** Pins the stage and plays the scene clock to each committed step. Returns nothing; ScrollTrigger owns it. */
export function play({ section, stage, words, paint, header, holdSnap }: PlayOptions): void {
  const counter = stage.querySelector('[data-counter]')!;
  const caption = stage.querySelector('[data-caption]')!;
  const clock = { t: 0 };
  let committed = -1; // nothing committed yet: the first commit is an arrival and jumps
  let running: gsap.core.Timeline | null = null;
  let B = bandPx(innerHeight);
  let kept = -1; // the step to keep through a refresh (a resize, a font landing): commits wait until the page is back on it
  const root = document.documentElement;
  // The page's CSS scrolls smoothly, which would turn each frame of the snap into a new, slower scroll.
  const instant = () => root.style.setProperty('scroll-behavior', 'auto');
  const smooth = () => root.style.removeProperty('scroll-behavior');
  const draw = () => {
    paint(clock.t);
    section.dataset.t = clock.t.toFixed(3);
  };

  const commit = (n: number) => {
    const arriving = committed < 0;
    committed = n;
    section.dataset.step = String(n);
    const w = words[Math.max(n, 1) - 1];
    counter.textContent = w.counter;
    caption.textContent = w.caption;
    running?.kill();
    running = null;
    if (arriving) {
      clock.t = n;
      draw();
      return;
    }
    const tl = gsap.timeline({ onUpdate: draw, onComplete: () => { running = null; } });
    for (const seg of playPlan(clock.t, n)) tl.to(clock, { t: seg.to, duration: seg.seconds, ease: 'none' });
    running = tl;
  };

  const st = ScrollTrigger.create({
    trigger: stage,
    pin: true,
    start: () => `top ${header()}px`,
    end: () => `+=${Math.round(PIN_BANDS * B)}`,
    invalidateOnRefresh: true,
    snap: {
      snapTo: (p, self) => (holdSnap?.() ? p : snapProgress(p, committed, self && self.direction < 0 ? -1 : 1)),
      duration: { min: 0.2, max: 0.5 },
      delay: 0.1,
      inertia: false,
      ease: 'power1.inOut',
      onStart: instant,
      onComplete: smooth,
      onInterrupt: smooth,
    },
    onUpdate: (st) => {
      if (kept >= 0) return;
      const n = committedStep(st.scroll(), st.start, B, Math.max(committed, 0), st.direction < 0 ? -1 : 1);
      if (n !== committed) commit(n);
    },
    onRefreshInit: () => {
      B = bandPx(innerHeight);
      kept = committed;
    },
    onRefresh: (st) => {
      section.dataset.start = String(Math.round(st.start));
      section.dataset.end = String(Math.round(st.end));
      section.dataset.band = String(Math.round(B));
      if (committed < 0) commit(committedStep(st.scroll(), st.start, B, 0, 1));
    },
  });

  // After every refresh the page goes back to the committed step's settle point: a resize or a late font
  // moves the pin, and the step the reader is on must stay (Review Focus 3). Readers above or below it are left alone.
  ScrollTrigger.addEventListener('refresh', () => {
    const k = kept;
    kept = -1;
    if (k < 1 || st.scroll() < st.start - 1 || st.scroll() > st.end) return;
    const at = Math.round(st.start + (k - 1) * B);
    if (Math.abs(st.scroll() - at) > 1) scrollTo({ top: at, behavior: 'instant' });
  });

  // The ambient loops (scene.css) run only while the stage is on screen.
  new IntersectionObserver(([e]) => stage.toggleAttribute('data-playing', e.isIntersecting)).observe(stage);
}
