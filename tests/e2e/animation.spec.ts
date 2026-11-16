import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

const how = (page: Page) => page.locator('section#how');
const stage = (page: Page) => page.locator('[data-stage]');
const still = (page: Page, n: number) => page.locator(`#how ol[data-stills] > li[data-step="${n}"]`);
const scrollTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

/** Brings the section near, waits for the script, returns the pinned range in px. */
async function ready(page: Page): Promise<[number, number]> {
  await how(page).scrollIntoViewIfNeeded();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  return how(page).evaluate((s) => [Number(s.dataset.start), Number(s.dataset.end)]);
}

test('the scene pins and its captions advance through all five steps', async ({ page }) => {
  await page.goto('/');
  const [start, end] = await ready(page);
  expect(end - start).toBeGreaterThan(2 * page.viewportSize()!.height);
  for (let n = 1; n <= 5; n++) {
    await scrollTo(page, start + ((end - start) * (n - 0.5)) / 5);
    const text = await still(page, n).locator('[data-caption]').textContent();
    await expect(stage(page).locator('[data-caption]')).toHaveText(text!);
    await expect(stage(page).locator('[data-counter]')).toHaveText((await still(page, n).locator('[data-counter]').textContent())!);
    await expect(stage(page)).toBeInViewport({ ratio: 0.9 });
  }
});

test('scrolling back returns to step 1', async ({ page }) => {
  await page.goto('/');
  const [start, end] = await ready(page);
  await scrollTo(page, end - 10);
  await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, 5).locator('[data-caption]').textContent())!);
  await scrollTo(page, start - 200);
  await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, 1).locator('[data-caption]').textContent())!);
  for (const hook of ['data-van', 'data-world']) {
    const want = await still(page, 1).locator(`[${hook}]`).getAttribute('transform');
    await expect(stage(page).locator(`[${hook}]`)).toHaveAttribute('transform', want!);
  }
  await expect(stage(page).locator('[data-night]')).toHaveAttribute('opacity', '0');
});

test('deep link below the animation does not jump', async ({ page }) => {
  await page.goto('/#traceability');
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1); // the script did load above the reader
  const top = () => page.locator('#traceability').evaluate((e) => e.getBoundingClientRect().top);
  // 72 = scroll-margin-top under the sticky header (Task 5)
  await expect.poll(async () => Math.abs((await top()) - 72) <= 4, { timeout: 3000 }).toBe(true);
  await page.waitForTimeout(500); // a late correction would show up here
  expect(Math.abs((await top()) - 72)).toBeLessThanOrEqual(4);
});

const sectionTop = (page: Page, id: string) => page.locator(`#${id}`).evaluate((e) => e.getBoundingClientRect().top);
/** Pixels between a section and the place a link to it should leave it: under the sticky header
 *  (72 = scroll-margin-top, Task 5), or as high as the end of the page lets it go (Contact is last). */
const offTarget = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((e) => {
    const top = e.getBoundingClientRect().top;
    const reachable = top + scrollY - (document.documentElement.scrollHeight - innerHeight);
    return Math.abs(top - Math.max(72, reachable));
  });

test('deep link stays put on a slow CPU (4x throttle on Chromium)', async ({ page, browserName }) => {
  if (browserName === 'chromium') {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto('/#contact');
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await expect.poll(async () => (await offTarget(page, 'contact')) <= 4, { timeout: 8000 }).toBe(true);
  await page.waitForTimeout(500); // a late correction would show up here
  expect(await offTarget(page, 'contact')).toBeLessThanOrEqual(4);
});

test('a stale hash does not pull the reader back down when they scroll up to the scene', async ({ page }) => {
  await page.goto('/');
  // The hash is left over from an earlier visit; the reader is down at Contact and the scene has not loaded.
  await page.evaluate(() => {
    history.replaceState(null, '', '#contact');
    window.scrollTo({ top: document.getElementById('contact')!.offsetTop - 72, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThan(2000);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(0);
  // Contact only ever moves away as the reader scrolls up; a hijack would snap it back to the header.
  await page.evaluate(() => {
    const w = window as unknown as { tops: number[] };
    w.tops = [];
    addEventListener('scroll', () => w.tops.push(document.getElementById('contact')!.getBoundingClientRect().top));
  });
  // The reader scrolls up with the keyboard (it works in every browser, mobile WebKit included, and the
  // page counts a key press as the reader taking over). One page up per poll, until the scene is near:
  // bounded by the poll's timeout, paced by the page.
  await expect.poll(async () => {
    const near = await how(page).evaluate((e) => e.getBoundingClientRect().top > -200);
    if (!near) await page.keyboard.press('PageUp');
    return near;
  }, { timeout: 20000, intervals: [100] }).toBe(true);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  // The reader is where they scrolled to: at the scene, not thrown down to Contact.
  await expect(how(page)).toBeInViewport();
  expect(await sectionTop(page, 'contact')).toBeGreaterThan(page.viewportSize()!.height);
  const tops = await page.evaluate(() => (window as unknown as { tops: number[] }).tops);
  expect(tops.length).toBeGreaterThan(2);
  tops.forEach((t, i) => { if (i > 0) expect(t, `scroll event ${i}`).toBeGreaterThanOrEqual(tops[i - 1] - 50); });
});

test('a reader who scrolls away while the animation script downloads is not thrown back to the deep link', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let held!: () => void;
  const requested = new Promise<void>((r) => { held = r; });
  await page.route(/\/animate\.[^/]*\.js$/, async (route) => {
    held();
    await gate;
    await route.continue();
  });
  await page.goto('/#contact');
  await requested; // the scene's script was asked for, and is held
  await expect.poll(async () => (await offTarget(page, 'contact')) <= 4, { timeout: 8000 }).toBe(true);
  // The reader takes over with the keyboard and moves away from Contact, one page up per poll.
  await expect.poll(async () => {
    await page.keyboard.press('PageUp');
    return sectionTop(page, 'contact');
  }, { intervals: [100] }).toBeGreaterThan(page.viewportSize()!.height);
  release();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  // The reader stays where they scrolled to; the script's late arrival must not pull them to Contact.
  expect(await sectionTop(page, 'contact')).toBeGreaterThan(page.viewportSize()!.height);
});

// 'jump' stands in for browsers that reach the target without a smooth scroll (the scene is not met on the way).
for (const mode of ['smooth', 'jump']) test(`a header link clicked from the top lands on its target and is not treated as a deep link (${mode})`, async ({ page }) => {
  await page.goto('/');
  if (mode === 'jump') await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const nav = page.viewportSize()!.width >= 768 ? page.locator('nav.desk a[href="#contact"]') : null;
  if (nav) await nav.click();
  else {
    await page.locator('details.menu summary').click();
    await page.locator('details.menu a[href="#contact"]').click();
  }
  await expect.poll(async () => (await offTarget(page, 'contact')) <= 4, { timeout: 8000 }).toBe(true);
  await page.waitForTimeout(500); // a late correction would show up here
  expect(await offTarget(page, 'contact')).toBeLessThanOrEqual(4);
  // Whether the scene was built on the way depends on how the browser scrolls (some jump straight
  // there), so it is not asserted yet. Scrolling back up by key must build it and must not pull the
  // reader down to Contact again.
  await expect.poll(async () => {
    const near = await how(page).evaluate((e) => e.getBoundingClientRect().top > -200);
    if (!near) await page.keyboard.press('PageUp');
    return near;
  }, { timeout: 20000, intervals: [100] }).toBe(true);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await expect(how(page)).toBeInViewport();
  expect(await sectionTop(page, 'contact')).toBeGreaterThan(page.viewportSize()!.height);
});

test('a malformed hash does not break the scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#%E0%A4%A');
  await ready(page);
  await expect(stage(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('no horizontal scroll at 320 px once the scene is built', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const [start, end] = await ready(page);
  for (const y of [start, (start + end) / 2, end]) {
    await scrollTo(page, y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
});

test('resizing after the scene is built moves the pinned range and the captions still advance', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const range = () => how(page).evaluate((s) => [Number(s.dataset.start), Number(s.dataset.end)]);
  const before = await range();
  const h = page.viewportSize()!.height;
  await page.setViewportSize({ width: page.viewportSize()!.width, height: h - 200 });
  await expect.poll(async () => (await range())[1] - (await range())[0]).not.toBe(before[1] - before[0]);
  const [start, end] = await range();
  await scrollTo(page, end - 10);
  await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, 5).locator('[data-caption]').textContent())!);
  await scrollTo(page, start + 10);
  await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, 1).locator('[data-caption]').textContent())!);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('shows the five still pictures and pins nothing', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => { if (/\/animate\.[^/]*\.js$/.test(new URL(r.url()).pathname)) scripts.push(r.url()); });
    await page.goto('/');
    await how(page).scrollIntoViewIfNeeded();
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    expect(scripts, 'the animation chunk is never requested').toEqual([]);
    await expect(stage(page)).toHaveCount(0);
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    for (let n = 1; n <= 5; n++) {
      await still(page, n).scrollIntoViewIfNeeded();
      await expect(still(page, n).locator('svg.scene')).toBeVisible();
    }
  });
});

test('the animation loads only near the section and its script is at most 150 KB', async ({ page }) => {
  const late: Promise<number>[] = [];
  let armed = false;
  page.on('response', (r) => {
    if (armed && new URL(r.url()).pathname.endsWith('.js')) {
      late.push(r.body().then((b) => gzipSync(b).length, () => 0));
    }
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('section#how[data-ready]')).toHaveCount(0);
  armed = true;
  await ready(page);
  const sizes = await Promise.all(late);
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(150 * 1024);
});
