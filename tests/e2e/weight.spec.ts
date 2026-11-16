import { expect, test } from '@playwright/test';

const LIMIT = 500 * 1024;

for (const home of ['/', '/zh/']) {
  test(`first load of ${home} is at most 500 KB`, async ({ page }) => {
    const sizes = new Map<string, number>();
    const reads: Promise<void>[] = [];
    page.on('response', (r) => {
      // Redirects have no body: an empty buffer, so the error is handled rather than swallowed.
      reads.push(r.body().catch(() => Buffer.alloc(0)).then((body) => { if (body.length > 0) sizes.set(r.url(), body.length); }));
    });
    await page.goto(home, { waitUntil: 'networkidle' });
    await Promise.all(reads); // every body is read before the sum, so a late response cannot be missed
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    const list = [...sizes].sort((a, b) => b[1] - a[1]).map(([u, n]) => `${Math.round(n / 1024)} KB ${u}`);
    expect(total, list.join('\n')).toBeLessThanOrEqual(LIMIT);
  });
}
