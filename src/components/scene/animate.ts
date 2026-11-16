import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { STEPS, stateAt, stepOf, view, type SceneState } from './steps';

gsap.registerPlugin(ScrollTrigger);

/** Returns a function that paints one moment of the scene into a drawing made by Scene.astro. */
function painter(svg: SVGSVGElement): (s: SceneState) => void {
  const one = (hook: string) => svg.querySelector(`[data-${hook}]`)!;
  const indexed = (hook: string) =>
    [...svg.querySelectorAll(`[data-${hook}]`)].map((el) => [el, Number(el.getAttribute(`data-${hook}`))] as const);
  const world = one('world'), van = one('van'), body = one('van-body');
  const sun = one('sun'), night = one('night'), lens = one('lens');
  const dark = [one('stars'), ...svg.querySelectorAll('[data-lit]')];
  const houseCrates = indexed('house-crate'), vanCrates = indexed('van-crate'), factoryCrates = indexed('factory-crate');
  return (s) => {
    world.setAttribute('transform', view.world(s));
    van.setAttribute('transform', view.van(s));
    body.setAttribute('transform', view.vanBody(s));
    sun.setAttribute('opacity', String(view.sun(s)));
    night.setAttribute('opacity', String(view.night(s)));
    lens.setAttribute('opacity', String(view.lens(s)));
    for (const el of dark) el.setAttribute('opacity', String(view.dark(s)));
    for (const [el, i] of houseCrates) el.setAttribute('visibility', view.houseCrate(s, i));
    for (const [el, j] of vanCrates) el.setAttribute('visibility', view.vanCrate(s, j));
    for (const [el, j] of factoryCrates) el.setAttribute('visibility', view.factoryCrate(s, j));
  };
}

/** Turns the five stills of section#how into one pinned scene scrubbed by scrolling. */
export function setup(section: HTMLElement): void {
  const list = section.querySelector<HTMLElement>('ol[data-stills]')!;
  const stills = [...list.querySelectorAll('li[data-step]')];
  const words = stills.map((li) => ({
    counter: li.querySelector('[data-counter]')!.textContent ?? '',
    caption: li.querySelector('[data-caption]')!.textContent ?? '',
  }));

  // Review Focus 3: whatever the reader is looking at below this section must not move.
  // The browser's own scroll anchoring is switched off so the correction below is the only one.
  const root = document.documentElement;
  // A deep link's own scroll is still running here (global.css makes it smooth) and the growth
  // below would abort it, leaving the reader short of the target. Finish it first, at once.
  const linked = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  const jumped = !!linked && linked.getBoundingClientRect().top > innerHeight;
  if (jumped) linked.scrollIntoView({ behavior: 'instant', block: 'start' });
  const readerIsBelow = section.getBoundingClientRect().top < 0;
  // The section's own bottom edge measures the growth: everything below it moves by that much.
  // (section.nextElementSibling is Astro's script tag, which has no box to measure.)
  const before = section.getBoundingClientRect().bottom;
  root.style.overflowAnchor = 'none';

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

  if (readerIsBelow) {
    const shift = section.getBoundingClientRect().bottom - before;
    if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: 'instant' });
    ScrollTrigger.update();
    // The smooth scroll interrupted above commits its last frame after this one; hold the
    // reader where the correction put them, so that frame cannot move the page under them.
    if (jumped) {
      const restored = scrollY;
      requestAnimationFrame(() => {
        if (Math.abs(scrollY - restored) > 0.5) window.scrollBy({ top: restored - scrollY, behavior: 'instant' });
        ScrollTrigger.update();
      });
    }
  }
  requestAnimationFrame(() => root.style.removeProperty('overflow-anchor'));
  section.dataset.ready = '';
}
