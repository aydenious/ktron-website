import { expect, test, type Page } from '@playwright/test';
import { buildIdle, clock, dot, fast, holdChunk, how, nudge, ready, showStage, stage, state, still, toggle } from './helpers';

// The scene plays on its own, once, with a pause control and step dots; the page scrolls as if it were a still image.
// Spec §2. The page's clock is faked and stopped once the page has loaded: the scene moves only when a test runs it
// (fast), so 18.5 s of playback take a moment and nothing moves between two reads.
const START = new Date('2026-11-18T00:00:00Z');
test.beforeEach(async ({ page }) => { await page.clock.install({ time: START }); });
async function open(page: Page, url = '/') {
  await page.goto(url);
  await page.clock.pauseAt(new Date(START.getTime() + 60_000));
}

const playing = (page: Page) => expect(how(page)).toHaveAttribute('data-play', 'playing');
const caption = (page: Page) => stage(page).locator('[data-caption]');
const farAway = (page: Page) => page.locator('#contact').evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));

/** The stage in view and playing, the clock a little way in. */
async function underway(page: Page) {
  await open(page);
  await ready(page);
  await showStage(page);
  await playing(page);
  await fast(page, 1);
}

test('waits at the opening frame until 60 % of the stage is on screen, then plays by itself from 0', async ({ page }) => {
  await open(page);
  await buildIdle(page);
  expect(await state(page)).toEqual({ step: 1, t: '0.000', play: 'idle' });
  await expect(toggle(page)).toHaveAccessibleName('Play');
  // Half of the stage is on screen: not enough.
  const box = (await stage(page).boundingBox())!;
  await nudge(page, box.y - page.viewportSize()!.height + 0.5 * box.height);
  await fast(page, 2);
  await page.waitForTimeout(400); // an observer callback would have come by now
  expect(await state(page)).toEqual({ step: 1, t: '0.000', play: 'idle' });
  // 70 %: it plays, and it started at 0.
  await nudge(page, 0.2 * box.height);
  await playing(page);
  expect(await clock(page)).toBeLessThan(0.5);
});

test('plays t 0 → 5 with the counter and caption changing as each step starts, then stops on the last scene', async ({ page }) => {
  await open(page);
  await ready(page);
  await showStage(page);
  await playing(page);
  const seen = new Set<number>();
  for (let i = 0; i < 40 && (await state(page)).play !== 'done'; i++) {
    const { step } = await state(page);
    seen.add(step);
    await expect(stage(page).locator('[data-counter]')).toHaveText((await still(page, step).locator('[data-counter]').textContent())!);
    await expect(caption(page)).toHaveText((await still(page, step).locator('[data-caption]').textContent())!);
    await fast(page, 0.5);
  }
  expect([...seen]).toEqual([1, 2, 3, 4, 5]);
  expect(await state(page)).toEqual({ step: 5, t: '5.000', play: 'done' });
  await expect(toggle(page)).toHaveAccessibleName('Replay');
  // The last still, attribute for attribute where it matters.
  for (const hook of ['data-van', 'data-world'])
    await expect(stage(page).locator(`[${hook}]`)).toHaveAttribute('transform', (await still(page, 5).locator(`[${hook}]`).getAttribute('transform'))!);
});

test('a finished scene stays finished after the reader scrolls away and back', async ({ page }) => {
  await underway(page);
  await fast(page, 19);
  expect((await state(page)).play).toBe('done');
  await farAway(page);
  await expect(stage(page)).not.toBeInViewport();
  await fast(page, 2);
  await showStage(page);
  await fast(page, 2);
  await page.waitForTimeout(400);
  expect(await state(page)).toEqual({ step: 5, t: '5.000', play: 'done' });
});

test('the button pauses the clock and plays it on from the same moment', async ({ page }) => {
  await underway(page);
  await expect(toggle(page)).toHaveAccessibleName('Pause');
  await toggle(page).click();
  await expect(how(page)).toHaveAttribute('data-play', 'paused');
  await expect(toggle(page)).toHaveAccessibleName('Play');
  const held = await clock(page);
  await fast(page, 3);
  expect(await clock(page)).toBe(held);
  await toggle(page).click();
  await playing(page);
  await fast(page, 1);
  expect(await clock(page)).toBeGreaterThan(held);
  await expect(toggle(page)).toHaveAccessibleName('Pause');
});

test('off screen the clock pauses where it is; back on screen it resumes from there', async ({ page }) => {
  await underway(page);
  await farAway(page);
  await expect(how(page)).toHaveAttribute('data-play', 'paused');
  const held = await clock(page);
  expect(held).toBeGreaterThan(0.2);
  await fast(page, 3);
  expect(await clock(page)).toBe(held);
  await showStage(page);
  await playing(page);
  await fast(page, 1);
  expect(await clock(page)).toBeGreaterThan(held);
});

test('a scene the reader paused does not resume by itself when it comes back on screen', async ({ page }) => {
  await underway(page);
  await toggle(page).click();
  await farAway(page);
  await showStage(page);
  await fast(page, 2);
  await page.waitForTimeout(400);
  expect((await state(page)).play).toBe('paused');
});

test('a click or tap on the scene does what the button does, and replays a finished scene from 0', async ({ page }, info) => {
  const hasTouch = !!info.project.use.hasTouch;
  const touch = () => stage(page).locator('svg.scene').tap();
  const press = () => (hasTouch ? touch() : stage(page).locator('svg.scene').click());
  await underway(page);
  await expect(stage(page).locator('[data-view]')).toHaveCSS('cursor', 'pointer');
  await press();
  await expect(how(page)).toHaveAttribute('data-play', 'paused');
  await press();
  await playing(page);
  await fast(page, 19);
  expect((await state(page)).play).toBe('done');
  await press();
  await playing(page);
  expect(await clock(page)).toBeLessThan(0.5);
  await expect(caption(page)).toHaveText((await still(page, 1).locator('[data-caption]').textContent())!);
  await fast(page, 19);
  expect((await state(page)).play).toBe('done');
});

test('Enter and Space on the focused button work', async ({ page }) => {
  await underway(page);
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(how(page)).toHaveAttribute('data-play', 'paused');
  await page.keyboard.press('Space');
  await playing(page);
  await dot(page, 2).focus();
  await page.keyboard.press('Enter');
  expect((await state(page)).step).toBe(2);
});

test('dot 3 sets the clock to 2, plays on to 5 and stops; the dots name their steps and mark the current one', async ({ page }) => {
  await underway(page);
  await expect(dot(page, 3)).toHaveAttribute('aria-label', 'Step 3');
  await dot(page, 3).click();
  expect(await clock(page)).toBeGreaterThanOrEqual(2);
  expect(await clock(page)).toBeLessThan(2.5);
  expect((await state(page)).step).toBe(3);
  await expect(dot(page, 3)).toHaveAttribute('aria-current', 'step');
  await expect(stage(page).locator('[aria-current="step"]')).toHaveCount(1);
  await expect(caption(page)).toHaveText((await still(page, 3).locator('[data-caption]').textContent())!);
  await fast(page, 19);
  expect(await state(page)).toEqual({ step: 5, t: '5.000', play: 'done' });
  await dot(page, 1).click();
  expect((await state(page)).step).toBe(1);
  await expect(dot(page, 1)).toHaveAttribute('aria-current', 'step');
});

test('the controls are real buttons outside any aria-hidden part, each at least 44 px on a touch screen', async ({ page }, info) => {
  await open(page);
  await buildIdle(page);
  const hidden = await stage(page).locator('button').evaluateAll((els) => els.map((e) => e.closest('[aria-hidden="true"]') !== null));
  expect(hidden).toEqual(Array(6).fill(false));
  if (!info.project.use.hasTouch) return;
  for (const b of await stage(page).locator('button').all()) {
    const box = (await b.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});

test('the controls speak the page language in Chinese', async ({ page }) => {
  await open(page, '/zh/');
  await buildIdle(page);
  await expect(toggle(page)).toHaveAccessibleName('播放');
  await expect(dot(page, 3)).toHaveAttribute('aria-label', '第3步');
  await showStage(page);
  await playing(page);
  await expect(toggle(page)).toHaveAccessibleName('暂停');
  await fast(page, 19);
  await expect(toggle(page)).toHaveAccessibleName('重播');
});

test('the page scrolls freely through the section: nothing pins and nothing snaps', async ({ page }, info) => {
  await open(page);
  await ready(page);
  await showStage(page);
  await page.waitForTimeout(300);
  expect(await page.locator('.pin-spacer').count()).toBe(0);
  expect(await stage(page).evaluate((e) => getComputedStyle(e).position)).toBe('static');
  const h = page.viewportSize()!.height;
  expect(await how(page).evaluate((e) => e.getBoundingClientRect().height), 'the section is as tall as its figure and controls').toBeLessThan(1.3 * h);
  // The page moves exactly as far as it is told to, and the stage moves with it; nothing pulls it back afterwards.
  const top = async () => (await stage(page).boundingBox())!.y;
  for (const dy of [0.3 * h, -0.45 * h, 0.2 * h].map(Math.round)) { // whole pixels: WebKit rounds a fractional scroll
    const [y0, t0] = [await page.evaluate(() => scrollY), await top()];
    await nudge(page, dy);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => scrollY) - y0, `a scroll of ${dy} px`).toBeCloseTo(dy, 0);
    expect(t0 - (await top())).toBeCloseTo(dy, 0);
  }
  await page.waitForTimeout(800); // a snap would settle within 0.6 s
  const rest = await page.evaluate(() => scrollY);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => scrollY)).toBe(rest);
  // The browser's own wheel scroll is the same inside the section as outside it (Chromium; WebKit has no mouse.wheel).
  if (info.project.name === 'iphone') return;
  const wheel = async () => {
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(40, h / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0);
    await page.waitForTimeout(500);
    return (await page.evaluate(() => scrollY)) - y0;
  };
  await showStage(page);
  const inside = await wheel();
  await page.locator('#faq').evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
  expect(inside).toBe(await wheel());
});

test('a reader who arrives below the section finds the scene waiting at 0, and it plays the first time it is on screen', async ({ page }) => {
  // The script is held while the page lands on its deep link, so the scene is built after the page's own scroll is over.
  const { release, isHeld } = await holdChunk(page);
  await page.goto('/#traceability');
  await page.clock.pauseAt(new Date(START.getTime() + 60_000));
  await expect.poll(() => page.evaluate(() => Math.abs(document.getElementById('traceability')!.getBoundingClientRect().top - 72)), { timeout: 8000 }).toBeLessThanOrEqual(4);
  // The reader scrolls up until the section is just above the screen; the script is asked for there.
  await how(page).evaluate((e) => scrollTo({ top: scrollY + e.getBoundingClientRect().bottom + 100, behavior: 'instant' }));
  await expect.poll(isHeld).toBe(true);
  release();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await fast(page, 3);
  await page.waitForTimeout(400);
  expect(await state(page)).toEqual({ step: 1, t: '0.000', play: 'idle' });
  await showStage(page);
  await playing(page);
  expect(await clock(page)).toBeLessThan(0.5);
  await fast(page, 19);
  expect((await state(page)).play).toBe('done');
});
