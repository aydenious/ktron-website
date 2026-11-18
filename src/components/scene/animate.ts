import { painter } from './paint';
import { play } from './play';
import { stateAt } from './steps';

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

/** Turns the five stills of section#how into one scene that plays on its own, once, with a pause control and step dots. */
export function setup(section: HTMLElement, arrival: Arrival): void {
  const list = section.querySelector<HTMLElement>('ol[data-stills]')!;
  const stills = [...list.querySelectorAll('li[data-step]')];
  const words = stills.map((li) => ({
    counter: li.querySelector('[data-counter]')!.textContent ?? '',
    caption: li.querySelector('[data-caption]')!.textContent ?? '',
  }));

  // Review Focus 3: whatever the reader is looking at below this section must not move.
  // While the section changes height, the browser's own scroll anchoring and global.css's smooth scrolling
  // are both off, so the corrections below are instant, ordered and the only scrolls there are.
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto';
  root.style.overflowAnchor = 'none';
  // setup runs after the script has downloaded: the reader may have acted since the loader decided.
  const deepLink = arrival.arriving() ? arrival.deepLink : null;
  const linkTarget = arrival.linkTarget();
  // A deep link's own scroll is still running here and the change in height below would abort it, leaving the
  // reader short of the target. Finish it first, at once.
  if (deepLink && deepLink.getBoundingClientRect().top > innerHeight) deepLink.scrollIntoView({ behavior: 'instant', block: 'start' });
  const readerIsBelow = section.getBoundingClientRect().top < 0;
  // A clicked header link's smooth scroll was aimed before the change; aim it again afterwards.
  const reaim = !!linkTarget && linkTarget.getBoundingClientRect().top > 0;
  // The section's own bottom edge measures the change in height (five stills become one stage): everything below it moves by that much.
  // (section.nextElementSibling is Astro's script tag, which has no box to measure.)
  const before = section.getBoundingClientRect().bottom;

  const controls = section.querySelector<HTMLTemplateElement>('template[data-controls]')!;
  const view = document.createElement('div');
  view.className = 'view';
  view.dataset.view = '';
  view.setAttribute('aria-hidden', 'true'); // the same words are in the visually hidden list
  view.append(stills[0].querySelector('figure')!.cloneNode(true));
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.dataset.stage = '';
  stage.append(view, controls.content.cloneNode(true));
  list.after(stage);
  list.classList.add('visually-hidden');

  const paint = painter(view.querySelector<SVGSVGElement>('svg.scene')!);
  play({ section, stage, words, paint: (t) => paint(stateAt(t)) });

  if (readerIsBelow) {
    const shift = section.getBoundingClientRect().bottom - before;
    if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: 'instant' });
  }
  if (deepLink) {
    // The browser's smooth scroll can still deliver a last frame measured before the change. Whenever a
    // scroll ends while the reader is still arriving, put the target back (a no-op once it is there).
    const settle = () => deepLink.scrollIntoView({ behavior: 'instant', block: 'start' });
    addEventListener('scrollend', settle);
    arrival.whenOver(() => removeEventListener('scrollend', settle));
  }
  requestAnimationFrame(() => {
    root.style.removeProperty('overflow-anchor');
    root.style.removeProperty('scroll-behavior');
    // The change above aborted the link's own scroll, and a scroll started while the two styles were still set dies
    // within a frame (a scrollend there lands short), so the link is followed again only now, one frame later.
    if (reaim) requestAnimationFrame(() => linkTarget.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });
  section.dataset.ready = '';
}
