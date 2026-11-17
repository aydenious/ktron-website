import { expect, test, type Page } from '@playwright/test';
import { stateAt } from '../../src/components/scene/steps';
import { nudge, ready, scrollTo, settled, stage, state, still } from './helpers';

const AT_STEP_END = [2, 4, 5]; // stills drawn at their step's end
async function finished(page: Page, n: number) {
  await settled(page, n);
  const van = stage(page).locator('[data-van]');
  const a = await van.getAttribute('transform');
  await page.waitForTimeout(500);
  expect(await van.getAttribute('transform'), `step ${n} has finished playing`).toBe(a);
  await expect(stage(page).locator('[data-caption]')).toHaveText((await still(page, Math.max(n, 1)).locator('[data-caption]').textContent())!);
  if (AT_STEP_END.includes(n))
    for (const hook of ['data-van', 'data-world'])
      await expect(stage(page).locator(`[${hook}]`)).toHaveAttribute('transform', (await still(page, n).locator(`[${hook}]`).getAttribute('transform'))!);
}
async function atStep(page: Page, n: number) {
  const [start] = await ready(page);
  await scrollTo(page, start + (n - 1) * (await state(page)).B);
  await finished(page, n);
}

test('one small scroll down plays exactly one whole step, from every settle point', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 1);
  for (let n = 1; n < 5; n++) {
    await nudge(page, 0.3 * (await state(page)).B);
    await finished(page, n + 1);
  }
});

test('one small scroll up plays exactly one step back, from every settle point', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 5);
  for (let n = 5; n > 1; n--) {
    await nudge(page, -0.3 * (await state(page)).B);
    await finished(page, n - 1);
  }
});

test('a flick of 2.1 bands from step 1 ends on step 3, fully played (ruling R16)', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 1);
  await nudge(page, 2.1 * (await state(page)).B);
  await finished(page, 3);
});

test('a scroll during a clip ends at the latest commit', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 1);
  await nudge(page, 0.3 * (await state(page)).B);
  await expect.poll(async () => Number((await state(page)).t)).toBeGreaterThan(1.1);
  expect(Number((await state(page)).t)).toBeLessThan(1.9); // step 2 is still playing
  await nudge(page, (await state(page)).B);
  await finished(page, 3);
});

test('past step 5 the page unpins and carries on, and a small scroll back up is not pulled down', async ({ page }) => {
  await page.goto('/');
  await atStep(page, 5);
  const { end, B, start } = await state(page);
  await nudge(page, 0.5 * B);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThanOrEqual(end - 2);
  await nudge(page, -0.1 * B); // within the 0.2 band hold (R18): the page goes back to the end
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThanOrEqual(end - 2);
  await nudge(page, -0.3 * B); // past the hold: the page settles on P_5, not pulled down to the end
  await settled(page, 5);
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(start + 4 * B + 2);
});

test('a deep link below the section lands on the finished scene, with nothing playing', async ({ page }) => {
  await page.goto('/#traceability');
  await expect.poll(async () => {
    const near = await page.locator('section#how').evaluate((e) => e.getBoundingClientRect().top > -200);
    if (!near) await page.keyboard.press('PageUp');
    return near;
  }, { timeout: 30000, intervals: [300] }).toBe(true);
  await expect(page.locator('section#how[data-ready]')).toHaveCount(1);
  expect((await state(page)).t).toBe('5.000');
});

test('a person whose door has not opened is hidden with the arms and crate they carry', async ({ page }) => {
  // The arms and crate say visibility="visible" for themselves; only the group they sit in hides them.
  const hidden = stateAt(1).residents.map((r, k) => ({ k, shown: r.door > 0 })).filter((r) => !r.shown);
  expect(hidden.length, 'some resident is still indoors at step 1').toBeGreaterThan(0);
  await page.goto('/');
  await atStep(page, 1);
  for (const { k } of hidden)
    for (const part of ['arms', 'crate']) {
      const el = stage(page).locator(`[data-resident-${part}="${k}"]`);
      expect(await el.evaluate((e) => getComputedStyle(e).visibility), `resident ${k} ${part}`).toBe('hidden');
    }
});
