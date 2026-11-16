// Usage: npm run build && node scripts/make-og.mjs && npm run build
// Screenshots /og/en/ and /og/zh/ into public/og/. Run it on a machine with a Simplified
// Chinese font; CI never runs it. Re-run whenever hero.title or hero.sub changes.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const families = execFileSync('fc-list', [':lang=zh-cn', 'family'], { encoding: 'utf8' });
if (!/Noto Sans CJK SC|Source Han Sans SC/.test(families)) {
  console.error('No Noto Sans CJK SC or Source Han Sans SC on this machine: the Chinese image would use a fallback font.');
  process.exit(1);
}

const BASE = 'http://localhost:4330';
// --ignore-lock keeps the preview in the foreground: an agent-run `astro preview` otherwise
// background itself, so this script could neither wait for it nor stop it. The server is its
// own process group (detached), so `finally` stops astro and anything it started, not just a wrapper.
const server = spawn('node_modules/.bin/astro', ['preview', '--ignore-lock', '--port', '4330'], { stdio: 'ignore', detached: true });
try {
  for (let i = 0; ; i++) {
    // A refused connection means the server is not up yet; an OK reply means it serves the page.
    const ready = await fetch(`${BASE}/og/en/`).then((r) => r.ok, () => false);
    if (ready) break;
    if (i === 50) throw new Error('astro preview did not start on :4330');
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  mkdirSync('public/og', { recursive: true });
  for (const lang of ['en', 'zh']) {
    await page.goto(`${BASE}/og/${lang}/`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `public/og/${lang}.png` });
    console.log(`public/og/${lang}.png`);
  }
  await browser.close();
} finally {
  process.kill(-server.pid, 'SIGTERM'); // the whole group
}
