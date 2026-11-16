import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { page } from './dist';

const PAGES = [
  { path: '/', lang: 'en', s: en, canonical: 'https://ktron.my/' },
  { path: '/zh/', lang: 'zh-Hans', s: zh, canonical: 'https://ktron.my/zh/' },
] as const;

describe.each(PAGES)('$path search data', ({ path, lang, s, canonical }) => {
  const doc = page(path);
  const attr = (sel: string, a: string) => doc.querySelector(sel)?.getAttribute(a);
  it('language, title, description', () => {
    expect(attr('html', 'lang')).toBe(lang);
    expect(doc.querySelector('title')?.text).toBe(s['meta.title']);
    expect(attr('meta[name=description]', 'content')).toBe(s['meta.description']);
    expect(doc.querySelector('meta[name=robots]')).toBeNull();
  });
  it('canonical and hreflang', () => {
    expect(attr('link[rel=canonical]', 'href')).toBe(canonical);
    expect(attr('link[hreflang=en]', 'href')).toBe('https://ktron.my/');
    expect(attr('link[hreflang=zh-Hans]', 'href')).toBe('https://ktron.my/zh/');
    expect(attr('link[hreflang=x-default]', 'href')).toBe('https://ktron.my/');
  });
  it('share image and icons', () => {
    expect(attr('meta[property="og:image"]', 'content')).toBe(`https://ktron.my/og/${lang === 'en' ? 'en' : 'zh'}.png`);
    expect(attr('meta[property="og:url"]', 'content')).toBe(canonical);
    expect(attr('link[rel=icon][type="image/svg+xml"]', 'href')).toBe('/favicon.svg');
    expect(attr('link[rel=apple-touch-icon]', 'href')).toBe('/apple-touch-icon.png');
  });
  it('LocalBusiness data', () => {
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.text);
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld.legalName).toBe('Ktron Engineering Enterprise');
    expect(ld.identifier).toBe('JM0870519-U');
    expect(ld.telephone).toBe('+60105454173');
    expect(ld.address.postalCode).toBe('81300');
    expect(ld.areaServed).toHaveLength(8);
    expect(ld).not.toHaveProperty('openingHours');
  });
});

describe('site files', () => {
  it('404 is not indexed and links both home pages', () => {
    const doc = page('/404.html');
    expect(doc.querySelector('meta[name=robots]')?.getAttribute('content')).toContain('noindex');
    const hrefs = doc.querySelectorAll('a').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/zh/']));
  });
  it('sitemap lists both pages and nothing else', () => {
    const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(['https://ktron.my/', 'https://ktron.my/zh/']);
  });
  it('robots.txt points to the sitemap', () => {
    expect(readFileSync('dist/robots.txt', 'utf8')).toContain('Sitemap: https://ktron.my/sitemap-index.xml');
  });
});
