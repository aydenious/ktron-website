import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';

const pages = (readdirSync('dist', { recursive: true }) as string[]).filter((f) => f.endsWith('.html'));

describe('security (no third-party code, no inline handlers)', () => {
  it('finds pages', () => expect(pages.length).toBeGreaterThan(0));
  it.each(pages)('%s loads scripts only from this site', (p) => {
    const doc = parse(readFileSync(`dist/${p}`, 'utf8'));
    for (const s of doc.querySelectorAll('script[src]')) expect(s.getAttribute('src')).toMatch(/^\/(?!\/)/);
  });
  it.each(pages)('%s has no inline event handlers', (p) => {
    const doc = parse(readFileSync(`dist/${p}`, 'utf8'));
    for (const el of doc.querySelectorAll('*')) expect(Object.keys(el.attributes).filter((a) => /^on/i.test(a)), p).toEqual([]);
  });
  it('_headers sets the security headers and caches /_astro/', () => {
    const h = readFileSync('dist/_headers', 'utf8');
    for (const line of ['X-Content-Type-Options: nosniff', 'Referrer-Policy: strict-origin-when-cross-origin',
      'Permissions-Policy: camera=(), microphone=(), geolocation=()', 'X-Frame-Options: DENY',
      'Cache-Control: public, max-age=31536000, immutable']) expect(h).toContain(line);
  });
});
