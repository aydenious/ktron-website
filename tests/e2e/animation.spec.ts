import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { holdChunk, how, pageUp, ready, scrollTo, settled, stage, state, still } from './helpers';

test('the scene pins and its captions advance through all five steps', async ({ page }) => {
  await page.goto('/');
  const [start, end] = await ready(page);
  expect(end - start).toBeGreaterThan(2 * page.viewportSize()!.height);
  const { B } = await state(page);
  for (let n = 1; n <= 5; n++) {
    await scrollTo(page, start + (n - 1) * B);
    await settled(page, n);
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
  // The clock plays back from step 5 to the opening frame: about 5.4 s.
  for (const hook of ['van', 'world', 'night']) {
    const el = stage(page).locator(`[data-${hook}]`);
    const attr = hook === 'night' ? 'opacity' : 'transform';
    await expect(el).toHaveAttribute(attr, (await still(page, 1).locator(`[data-${hook}]`).getAttribute(attr))!, { timeout: 15000 });
  }
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

/**
 * Opens a deep link and checks what holds in every browser. Whether the fragment load passes the scene
 * (so that it is built on the way) depends on the browser and on timing: mobile WebKit jumps straight
 * there, and its observer sometimes fires at load. So the page's own observer, with the loader's options,
 * says whether the scene was brought near; the scene must be built exactly then.
 */
async function followDeepLink(page: Page, hash: string, id: string, mode: 'smooth' | 'instant', slow = false) {
  if (slow) {
    try {
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } catch (error) {
      // CPU throttling is a Chromium feature: elsewhere there is no CDP session, the run is unthrottled
      // and says so in its report. Every expectation is the same either way.
      test.info().annotations.push({ type: 'cpu', description: `unthrottled: ${String(error)}` });
    }
  }
  await page.addInitScript((instant) => {
    document.addEventListener('DOMContentLoaded', () => {
      const section = document.querySelector('section#how')!;
      new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) (window as unknown as { crossed: boolean }).crossed = true;
      }, { rootMargin: '200px 0px' }).observe(section);
      if (instant) {
        const css = document.createElement('style');
        css.textContent = 'html { scroll-behavior: auto !important; }';
        document.head.append(css);
      }
    });
  }, mode === 'instant');
  await page.goto(hash);
  // The target lands under the sticky header (or as high as the page end allows) and stays there.
  await expect.poll(async () => (await offTarget(page, id)) <= 4, { timeout: 8000 }).toBe(true);
  await page.waitForTimeout(500); // a late correction would show up here
  expect(await offTarget(page, id)).toBeLessThanOrEqual(4);
  // The scene is built exactly when the browser brought it near, and what was built is complete.
  const crossed = await page.evaluate(() => !!(window as unknown as { crossed?: boolean }).crossed);
  await expect(page.locator('section#how[data-ready]'), crossed ? 'the browser passed the scene' : 'the browser did not pass the scene')
    .toHaveCount(crossed ? 1 : 0);
  if (crossed) {
    await expect(stage(page)).toHaveCount(1);
    await expect(page.locator('.pin-spacer')).toHaveCount(1);
    await expect(how(page)).toHaveAttribute('data-end', /^\d+$/);
    expect(await offTarget(page, id)).toBeLessThanOrEqual(4); // still there once it is built
  }
  // The reader scrolls back up to the scene: it is built, and the target is not pulled again.
  await expect.poll(async () => {
    const near = await how(page).evaluate((e) => e.getBoundingClientRect().top > -200);
    if (!near) await pageUp(page);
    return near;
  }, { timeout: 30000, intervals: [100] }).toBe(true);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await expect(how(page)).toBeInViewport();
  expect(await sectionTop(page, id)).toBeGreaterThan(page.viewportSize()!.height);
}

for (const mode of ['smooth', 'instant'] as const) {
  test(`deep link below the animation does not jump (${mode})`, async ({ page }) => {
    await followDeepLink(page, '/#traceability', 'traceability', mode);
  });
  test(`deep link to the last section stays put on a slow CPU (${mode}; 4x throttle on Chromium)`, async ({ page }) => {
    await followDeepLink(page, '/#contact', 'contact', mode, true);
  });
}

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
    if (!near) await pageUp(page);
    return near;
  }, { timeout: 30000, intervals: [100] }).toBe(true);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  // The reader is where they scrolled to: at the scene, not thrown down to Contact.
  await expect(how(page)).toBeInViewport();
  expect(await sectionTop(page, 'contact')).toBeGreaterThan(page.viewportSize()!.height);
  const tops = await page.evaluate(() => (window as unknown as { tops: number[] }).tops);
  expect(tops.length).toBeGreaterThan(2);
  tops.forEach((t, i) => { if (i > 0) expect(t, `scroll event ${i}`).toBeGreaterThanOrEqual(tops[i - 1] - 50); });
});

// 'instant' stands in for mobile WebKit, whose fragment load jumps without passing the scene (so nothing is requested on the way).
for (const mode of ['smooth', 'instant']) test(`a reader who scrolls away while the animation script downloads is not thrown back to the deep link (${mode})`, async ({ page }) => {
  const { release, isHeld } = await holdChunk(page);
  if (mode === 'instant') {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const css = document.createElement('style');
        css.textContent = 'html { scroll-behavior: auto !important; }';
        document.head.append(css);
      });
    });
  }
  await page.goto('/#contact');
  // (A key pressed during the fragment scroll would cancel it, so the reader waits to arrive first.)
  await expect.poll(async () => (await offTarget(page, 'contact')) <= 4, { timeout: 8000 }).toBe(true);
  if (mode === 'instant') expect(isHeld(), 'the jump did not pass the scene, as in mobile WebKit').toBe(false);
  // The reader takes over with the keyboard and scrolls up, one page per poll, until the scene is near
  // and its script has been asked for (and is held); then scrolls on while it downloads.
  await expect.poll(async () => {
    if (!isHeld()) await pageUp(page);
    return isHeld();
  }, { timeout: 30000, intervals: [100] }).toBe(true);
  await pageUp(page);
  const away = await sectionTop(page, 'contact'); // where the reader has scrolled to
  expect(away, 'the reader is away from Contact').toBeGreaterThan(200);
  release();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  // The reader stays where they scrolled to (the section only grows below them): the script's late
  // arrival must not pull them back towards Contact.
  expect(await sectionTop(page, 'contact')).toBeGreaterThanOrEqual(away - 4);
});

for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
  test(`a ${type} while the script downloads counts as the reader taking over: no jump to the deep link`, async ({ page }) => {
    const { release, isHeld } = await holdChunk(page);
    await page.goto('/#contact');
    await expect.poll(async () => (await offTarget(page, 'contact')) <= 4, { timeout: 8000 }).toBe(true);
    // Bring the scene near without any input (a script's scroll), so the download starts and is held.
    await how(page).evaluate((e) => e.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await expect.poll(isHeld).toBe(true);
    // The event stands in for the reader's input in any browser.
    await page.evaluate((t) => window.dispatchEvent(new Event(t)), type);
    expect(await sectionTop(page, 'contact'), `${type}: the reader is at the scene`).toBeGreaterThan(page.viewportSize()!.height);
    release();
    await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
    expect(await sectionTop(page, 'contact'), `${type}: jumped back to Contact`).toBeGreaterThan(page.viewportSize()!.height);
  });
}

test('a header link clicked while the script downloads still lands on its target', async ({ page }) => {
  const { release, isHeld } = await holdChunk(page);
  await page.goto('/');
  await how(page).scrollIntoViewIfNeeded(); // the test brings the scene near itself: its script is asked for and held
  await expect.poll(isHeld).toBe(true);
  if (page.viewportSize()!.width >= 768) await page.locator('nav.desk a[href="#contact"]').click();
  else {
    await page.locator('details.menu summary').click();
    await page.locator('details.menu a[href="#contact"]').click();
  }
  release();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await expect.poll(async () => (await offTarget(page, 'contact')) <= 4, { timeout: 8000 }).toBe(true);
  await page.waitForTimeout(500); // a late correction would show up here
  expect(await offTarget(page, 'contact')).toBeLessThanOrEqual(4);
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
    if (!near) await pageUp(page);
    return near;
  }, { timeout: 30000, intervals: [100] }).toBe(true);
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

test('resizing after the scene is built moves the pinned range, keeps the committed step and the captions still advance', async ({ page }) => {
  await page.goto('/');
  const [start0] = await ready(page);
  const before = await state(page);
  await scrollTo(page, start0 + 2 * before.B);
  await settled(page, 3);
  const h = page.viewportSize()!.height;
  await page.setViewportSize({ width: page.viewportSize()!.width, height: h - 200 });
  await expect.poll(async () => (await state(page)).B).not.toBe(before.B);
  await settled(page, 3); // the step stays, and the page settles on the new P_3
  const { start, B } = await state(page);
  for (const n of [5, 1]) {
    await scrollTo(page, start + (n - 1) * B);
    await settled(page, n);
    await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, n).locator('[data-caption]').textContent())!);
  }
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
