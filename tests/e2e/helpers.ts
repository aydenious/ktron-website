import { expect, type Page } from '@playwright/test';

export const how = (page: Page) => page.locator('section#how');
export const stage = (page: Page) => page.locator('[data-stage]');
export const still = (page: Page, n: number) => page.locator(`#how ol[data-stills] > li[data-step="${n}"]`);
/** One page up by key, then wait until the keyboard's animated scroll has stopped (two equal reads, a frame apart). */
export async function pageUp(page: Page) {
  await page.keyboard.press('PageUp');
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((done) => {
    const y = scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => done(scrollY === y)));
  })), { timeout: 5000 }).toBe(true);
}
/**
 * Holds the animation script's download until release() is called. isHeld() says whether it has been asked for:
 * that happens when the scene comes near the viewport, which a deep link's scroll may or may not do (mobile
 * WebKit jumps straight to the target), so a test must bring the scene near itself rather than wait for it.
 */
export async function holdChunk(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let held = false;
  await page.route(/\/animate\.[^/]*\.js$/, async (route) => {
    held = true;
    await gate;
    await route.continue();
  });
  return { release, isHeld: () => held };
}
/** Brings the section near, waits for the script, and leaves the stage where it is (it plays when 60 % of it is on screen). */
export async function ready(page: Page) {
  await how(page).scrollIntoViewIfNeeded();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
}

/** Builds the scene with its stage still below the viewport: it waits at the opening frame, as a reader arriving from below leaves it. */
export async function buildIdle(page: Page) {
  await how(page).evaluate((e) => scrollTo({ top: e.getBoundingClientRect().top + scrollY - innerHeight + 40, behavior: 'instant' }));
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await expect(stage(page).locator('button')).toHaveCount(6); // the five dots and the play button, for the checks that walk the page
}

/** Puts the whole stage in the middle of the viewport, instantly. */
export const showStage = (page: Page) => stage(page).evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

/** The section's state: the step on the counter, the scene clock (3 decimals) and play | idle | playing | paused | done. */
export const state = (page: Page) =>
  how(page).evaluate((s) => ({ step: Number(s.dataset.step), t: s.dataset.t!, play: s.dataset.play! }));
export const clock = async (page: Page) => Number((await state(page)).t);
export const toggle = (page: Page) => stage(page).locator('button[data-toggle]');
export const dot = (page: Page, n: number) => stage(page).locator(`button[data-dot="${n}"]`);
/** A scroll of dy px the way a finger or wheel makes one (mobile WebKit has no mouse.wheel). */
export const nudge = (page: Page, dy: number) => page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), dy);
/** Plays `seconds` of the page's own time at once (page.clock must have been installed before the page loaded). */
export const fast = (page: Page, seconds: number) => page.clock.runFor(seconds * 1000);
