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

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('shows the five still pictures and pins nothing', async ({ page }) => {
    await page.goto('/');
    await how(page).scrollIntoViewIfNeeded();
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
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
