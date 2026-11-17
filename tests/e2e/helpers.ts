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
export const scrollTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

/** Brings the section near, waits for the script, returns the pinned range in px. */
export async function ready(page: Page): Promise<[number, number]> {
  await how(page).scrollIntoViewIfNeeded();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  return how(page).evaluate((s) => [Number(s.dataset.start), Number(s.dataset.end)]);
}

/** The section's state: committed step, scene clock, settle point of step 1, band, pin end. */
export const state = (page: Page) =>
  how(page).evaluate((s) => ({ step: Number(s.dataset.step), t: s.dataset.t, start: Number(s.dataset.start), B: Number(s.dataset.band), end: Number(s.dataset.end) }));
/** A scroll of dy px the way a finger or wheel makes one (mobile WebKit has no mouse.wheel). */
export const nudge = (page: Page, dy: number) => page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), dy);
/** Waits until a step has finished playing and the page has settled on its settle point. */
export async function settled(page: Page, n: number) {
  await expect.poll(async () => (await state(page)).step, { timeout: 15000 }).toBe(n);
  await expect.poll(async () => (await state(page)).t, { timeout: 15000 }).toBe(`${n}.000`);
  const { start, B } = await state(page);
  const P = start + Math.max(n - 1, 0) * B;
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThanOrEqual(P - 2);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeLessThanOrEqual(P + 2);
}
