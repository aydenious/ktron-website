import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { refreshWhenFontsSettle } from './fonts';
import { painter } from './paint';
import { STEPS, stateAt, stepOf } from './steps';

gsap.registerPlugin(ScrollTrigger);

/** How the reader got here, decided by the loader before the script was fetched. */
interface Arrival {
  /** The fragment target of the page load, if this was a fresh navigation (null for back, reload or a typed-in page). */
  deepLink: Element | null;
  /** The target of a header link clicked and not yet followed by any input, read when setup runs (null otherwise). */
  linkTarget: () => Element | null;
  /** True while the reader has done nothing since the load and the page's own scroll may still be landing. */
  arriving: () => boolean;
  /** Runs the callback once arriving() has turned false (the first input, or the time limit). */
  whenOver: (done: () => void) => void;
}

/** Turns the five stills of section#how into one pinned scene scrubbed by scrolling. */
export function setup(section: HTMLElement, arrival: Arrival): void {
  const list = section.querySelector<HTMLElement>('ol[data-stills]')!;
  const stills = [...list.querySelectorAll('li[data-step]')];
  const words = stills.map((li) => ({
    counter: li.querySelector('[data-counter]')!.textContent ?? '',
    caption: li.querySelector('[data-caption]')!.textContent ?? '',
  }));

  // Review Focus 3: whatever the reader is looking at below this section must not move.
  // While the section grows, the browser's own scroll anchoring and global.css's smooth scrolling
  // are both off, so the corrections below are instant, ordered and the only scrolls there are.
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto';
  root.style.overflowAnchor = 'none';
  // setup runs after the script has downloaded: the reader may have acted since the loader decided.
  const deepLink = arrival.arriving() ? arrival.deepLink : null;
  const linkTarget = arrival.linkTarget();
  // A deep link's own scroll is still running here and the growth below would abort it, leaving the
  // reader short of the target. Finish it first, at once.
  if (deepLink && deepLink.getBoundingClientRect().top > innerHeight) deepLink.scrollIntoView({ behavior: 'instant', block: 'start' });
  const readerIsBelow = section.getBoundingClientRect().top < 0;
  // A clicked header link's smooth scroll was aimed before the growth; aim it again afterwards.
  const reaim = !!linkTarget && linkTarget.getBoundingClientRect().top > 0;
  // The section's own bottom edge measures the growth: everything below it moves by that much.
  // (section.nextElementSibling is Astro's script tag, which has no box to measure.)
  const before = section.getBoundingClientRect().bottom;

  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.dataset.stage = '';
  stage.dataset.step = '1';
  stage.setAttribute('aria-hidden', 'true');
  stage.append(stills[0].querySelector('figure')!.cloneNode(true));
  list.after(stage);
  list.classList.add('visually-hidden');

  const paint = painter(stage.querySelector<SVGSVGElement>('svg.scene')!);
  const counter = stage.querySelector('[data-counter]')!;
  const caption = stage.querySelector('[data-caption]')!;
  const render = (t: number) => {
    paint(stateAt(t));
    const n = stepOf(t);
    if (String(n) !== stage.dataset.step) {
      stage.dataset.step = String(n);
      counter.textContent = words[n - 1].counter;
      caption.textContent = words[n - 1].caption;
    }
  };

  const header = () => document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;
  const screens = () => (matchMedia('(min-width: 768px)').matches ? 4 : 3);
  const clock = { t: 0 };
  gsap.to(clock, {
    t: STEPS,
    ease: 'none',
    onUpdate: () => render(clock.t),
    scrollTrigger: {
      trigger: stage,
      pin: true,
      start: () => `top ${header()}px`,
      end: () => `+=${Math.round(innerHeight * screens())}`,
      scrub: 0.4,
      invalidateOnRefresh: true,
      onRefresh: (st) => {
        section.dataset.start = String(Math.round(st.start));
        section.dataset.end = String(Math.round(st.end));
      },
    },
  });
  ScrollTrigger.refresh();
  refreshWhenFontsSettle(document.fonts, () => ScrollTrigger.refresh());

  if (readerIsBelow) {
    const shift = section.getBoundingClientRect().bottom - before;
    if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: 'instant' });
    ScrollTrigger.update();
  }
  if (deepLink) {
    // The browser's smooth scroll can still deliver a last frame measured before the growth. Whenever a
    // scroll ends while the reader is still arriving, put the target back (a no-op once it is there).
    const settle = () => deepLink.scrollIntoView({ behavior: 'instant', block: 'start' });
    addEventListener('scrollend', settle);
    arrival.whenOver(() => removeEventListener('scrollend', settle));
  }
  if (reaim) linkTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  requestAnimationFrame(() => {
    root.style.removeProperty('overflow-anchor');
    root.style.removeProperty('scroll-behavior');
  });
  section.dataset.ready = '';
}
