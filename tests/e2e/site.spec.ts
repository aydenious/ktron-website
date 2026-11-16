import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const HOMES = ['/', '/zh/'];
const isPhone = (name: string) => name !== 'desktop';
/** Every viewport the Review Focus names, plus 1000 px where the five-column Numbers grid is tightest. */
const WIDTHS = [320, 390, 768, 960, 1000, 1024, 1440];
/** The two rendered widths the contrast and focus checks run at. */
const SIZES = [390, 1440];

/** Elements whose right edge passes the viewport, outside any box that scrolls or clips sideways. */
const overflowing = (page: Page) => page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const clipped = (el: Element | null): boolean => {
    for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
      if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  return [...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > w + 0.5 && !clipped(el) && getComputedStyle(el).position !== 'fixed')
    .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
});

for (const home of HOMES) {
  test.describe(home, () => {
    for (const width of WIDTHS) {
      test(`no horizontal scroll at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(home);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await overflowing(page)).toEqual([]);
      });
    }

    test('no console errors from top to bottom', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(home);
      await page.locator('#contact').scrollIntoViewIfNeeded();
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });

    test('floating WhatsApp button on phones only', async ({ page }, info) => {
      await page.goto(home);
      if (isPhone(info.project.name)) await expect(page.locator('a.float-wa')).toBeVisible();
      else await expect(page.locator('a.float-wa')).toBeHidden();
    });

    test('the questions open and close', async ({ page }) => {
      await page.goto(home);
      const first = page.locator('#faq details').first();
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open', '');
      await first.locator('summary').click();
      await expect(first).not.toHaveAttribute('open', '');
    });

    for (const width of SIZES) {
      test(`axe finds no WCAG 2 AA violation at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(home);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const found = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        expect(found, found.join('\n')).toEqual([]);
        expect([...result.passes, ...result.incomplete].map((r) => r.id), 'the color-contrast rule ran').toContain('color-contrast');
      });

      test(`every focusable element shows a focus ring with 3:1 contrast at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(home);
        const seen = await tabThrough(page);
        expect(seen.length).toBeGreaterThan(10);
        const missing = seen.filter((s) => !hasIndicator(s));
        expect(missing.map((s) => `${s.index}: outline ${s.outlineStyle} ${s.outlineWidth}, box-shadow ${s.boxShadow}`)).toEqual([]);
        const weak = seen.filter((s) => contrast(ringColour(s), s.background) < 3);
        expect(weak.map((s) => `${s.index}: ${ringColour(s)} on ${s.background} = ${contrast(ringColour(s), s.background).toFixed(2)}:1`)).toEqual([]);
      });
    }
  });
}

test('every control meets its target size', async ({ page }, info) => {
  // 44 by 44 on a touch screen (the repo's rule, WCAG 2.5.5); 24 by 24, WCAG 2.5.8 AA, with a mouse.
  const min = isPhone(info.project.name) ? 44 : 24;
  // The one exception: the skip link is parked off-screen until a keyboard user focuses it, so it is
  // not a tap target. Every other visible a, button and summary must reach the minimum.
  for (const home of HOMES) {
    await page.goto(home);
    const small = await page.evaluate((size) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('a[href], button, summary')) {
        if (!el.checkVisibility() || el.matches('a.skip')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // An inline link inside a paragraph wraps with the text: only its height is fixed.
        const inlineInParagraph = el.tagName === 'A' && el.closest('p') !== null;
        const label = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
        if (r.height < size || (!inlineInParagraph && r.width < size)) out.push(label);
      }
      return out;
    }, min);
    expect(small, `${home} at ${min} px`).toEqual([]);
  }
});

test.describe('works without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const home of HOMES) {
    test(home, async ({ page }) => {
      await page.goto(home);
      await expect(page.locator('h1')).toBeVisible();
      const stills = page.locator('#how ol[data-stills] > li[data-step]');
      await expect(stills).toHaveCount(5);
      for (const li of await stills.all()) {
        await li.scrollIntoViewIfNeeded();
        await expect(li.locator('svg.scene')).toBeVisible();
        await expect(li.locator('[data-caption]')).toBeVisible();
      }
      await expect(page.locator('#contact a[href^="https://wa.me/"]').first()).toBeVisible();
      await expect(page.locator('#contact a[href^="tel:"]')).toBeVisible();
      await expect(page.locator('#contact a[href^="mailto:"]')).toBeVisible();
    });
  }
});

test('missing page shows the bilingual 404', async ({ page }) => {
  const res = await page.goto('/zh/servics');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '找不到页面' })).toBeVisible();
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/\/zh\/$/);
});

test('the language switch keeps the section', async ({ page }) => {
  await page.goto('/#traceability');
  await page.locator('a.lang').click();
  await expect(page).toHaveURL(/\/zh\/#traceability$/);
  await expect(page.locator('#traceability h2')).toBeInViewport();
  const top = await page.locator('#traceability').evaluate((e) => e.getBoundingClientRect().top);
  expect(top, 'the section starts below the sticky header').toBeGreaterThanOrEqual(64);
});

test('the phone menu closes after a tap and goes to the section', async ({ page }, info) => {
  await page.goto('/');
  if (isPhone(info.project.name)) {
    const menu = page.locator('details.menu');
    await menu.locator('summary').click();
    await menu.locator('a[href="#services"]').click();
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(page).toHaveURL(/#services$/);
    await expect(page.locator('#services h2')).toBeInViewport();
  } else {
    // The desktop shows the same links in the header instead of the menu.
    await expect(page.locator('header .desk')).toBeVisible();
    await expect(page.locator('details.menu')).toBeHidden();
  }
});

type Focused = {
  index: number;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  boxShadow: string;
  background: string;
};

const FOCUSABLE = 'a[href], button, summary, [tabindex]:not([tabindex="-1"])';

/** Tabs through every tabbable element and records its focus ring and the page behind it. */
async function tabThrough(page: Page) {
  const expected = await page.evaluate((selector) => {
    // A closed <details> keeps its content out of the tab order in every browser; its summary stays.
    const els = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      if (!el.checkVisibility() || el.tabIndex < 0) return false;
      const closed = el.closest('details:not([open])');
      return !closed || closed.querySelector(':scope > summary') === el;
    });
    els.forEach((el, i) => { el.dataset.t9 = String(i); });
    return els.length;
  }, FOCUSABLE);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: Focused[] = [];
  for (let i = 0; i < expected; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el.dataset.t9 === undefined) return null;
      const style = getComputedStyle(el);
      const opaque = (colour: string) => {
        const parts = colour.match(/rgba?\(([^)]+)\)/)?.[1].split(/[,/ ]+/).filter(Boolean).map(Number);
        return parts !== undefined && (parts.length < 4 || parts[3] === 1);
      };
      let background = 'rgb(255, 255, 255)';
      for (let p = el.parentElement; p; p = p.parentElement) {
        const colour = getComputedStyle(p).backgroundColor;
        if (opaque(colour)) { background = colour; break; }
      }
      return { index: Number(el.dataset.t9), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor, boxShadow: style.boxShadow, background };
    });
    expect(info, `Tab ${i + 1} did not land on a marked element`).not.toBeNull();
    if (!info) break;
    seen.push(info);
  }
  expect(seen.map((s) => s.index), 'Tab visits every focusable element once, in DOM order').toEqual([...Array(expected).keys()]);
  return seen;
}

const hasIndicator = (s: Focused) =>
  (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';

/** The focus ring: the outline, or the first box-shadow ring (the floating button draws a halo). */
const ringColour = (s: Focused) => {
  if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) return s.outlineColor;
  return s.boxShadow.match(/rgba?\([^)]+\)/)?.[0] ?? 'rgba(0, 0, 0, 0)';
};

/** A colour as sRGB, composited over `under` when it has alpha. */
function rgba(colour: string, under: string): [number, number, number] {
  const parse = (c: string) => (c.match(/rgba?\(([^)]+)\)/)?.[1] ?? '0,0,0').split(/[,/ ]+/).filter(Boolean).map(Number);
  const [r, g, b, a = 1] = parse(colour);
  const [ur, ug, ub] = parse(under);
  return [r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a)];
}

const luminance = ([r, g, b]: [number, number, number]) => {
  const [lr, lg, lb] = [r, g, b].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

function contrast(ring: string, background: string) {
  const [hi, lo] = [luminance(rgba(ring, background)), luminance(rgba(background, background))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
