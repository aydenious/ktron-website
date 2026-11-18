import { expect, test, type Page } from '@playwright/test';
import { stateAt } from '../../src/components/scene/steps';
import { how, ready, showStage, stage } from './helpers';

// The scene's drawing as the browser paints it. The clock is held at the start of a step: dot k, then the button, in one go.
async function holdAtStart(page: Page, k: number) {
  await page.goto('/');
  await ready(page);
  await showStage(page);
  await stage(page).evaluate((el, n) => {
    el.querySelector<HTMLElement>(`[data-dot="${n}"]`)!.click();
    el.querySelector<HTMLElement>('[data-toggle]')!.click();
  }, k);
  await expect(how(page)).toHaveAttribute('data-play', 'paused');
  await expect(how(page)).toHaveAttribute('data-t', `${k - 1}.000`);
}

test('a person whose door has not opened is hidden with the arms and crate they carry', async ({ page }) => {
  // The arms and crate say visibility="visible" for themselves; only the group they sit in hides them.
  await holdAtStart(page, 2); // t 1: the van is at the first house
  const hidden = stateAt(1).residents.map((r, k) => ({ k, shown: r.door > 0 })).filter((r) => !r.shown);
  expect(hidden.length, 'some resident is still indoors at t 1').toBeGreaterThan(0);
  for (const { k } of hidden)
    for (const part of ['arms', 'crate']) {
      const el = stage(page).locator(`[data-resident-${part}="${k}"]`);
      expect(await el.evaluate((e) => getComputedStyle(e).visibility), `resident ${k} ${part}`).toBe('hidden');
    }
});

test('a shared symbol is not clipped to the 800 px view: at t 2 the road and grass still reach the right edge of the card', async ({ page }) => {
  await holdAtStart(page, 3); // the camera is at its far end, so world x 800–1040 is in view
  const hit = await stage(page).locator('svg.scene').evaluate((svg) => {
    const b = svg.getBoundingClientRect();
    return document.elementFromPoint(b.right - 4, b.top + b.height * 0.97)?.tagName;
  });
  expect(hit).toBe('use');
});

test('the ambient loops run only while the stage is on screen', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await showStage(page);
  await expect(stage(page)).toHaveAttribute('data-playing', '');
  const star = stage(page).locator('[data-amb="twinkle"]').first();
  await expect.poll(() => star.evaluate((e) => getComputedStyle(e).animationName)).toBe('scene-twinkle');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(stage(page)).not.toHaveAttribute('data-playing', '');
  await expect(page.locator('#how ol[data-stills] [data-amb="twinkle"]').first()).toHaveCSS('animation-name', 'none');
  await showStage(page); // and they start again on the way back (the observer's last entry decides)
  await expect(stage(page)).toHaveAttribute('data-playing', '');
  await expect.poll(() => star.evaluate((e) => getComputedStyle(e).animationName)).toBe('scene-twinkle');
});

/** How far section#how's top is from where a link to it puts it (its scroll-margin-top), px. */
const off = (page: Page) => how(page).evaluate((e) => Math.abs(e.getBoundingClientRect().top - (parseFloat(getComputedStyle(e).scrollMarginTop) || 0)));

test('the hero link clicked before the scene is built still lands on the section, and stays there', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section#how[data-ready]')).toHaveCount(0);
  await page.locator('a.how').click();
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  await expect.poll(() => off(page), { timeout: 8000 }).toBeLessThanOrEqual(4);
  await page.waitForTimeout(600); // a late re-aim would move it
  expect(await off(page)).toBeLessThanOrEqual(4);
});
