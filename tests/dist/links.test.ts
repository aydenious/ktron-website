import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { distFiles, page } from './dist';

const pages = distFiles().filter((f) => f.endsWith('.html')).map((f) => `/${f.replaceAll('\\', '/')}`);
const toFile = (url: string) => {
  const path = decodeURI(url.split(/[?#]/)[0]);
  return `dist${path.endsWith('/') ? `${path}index.html` : path}`;
};

describe('links, anchors, images (every page in dist)', () => {
  it('finds the pages', () => {
    expect(pages).toEqual(expect.arrayContaining(['/index.html', '/zh/index.html', '/404.html']));
  });
  describe.each(pages)('%s', (path) => {
    const doc = page(path);
    it('ids are unique', () => {
      const ids = doc.querySelectorAll('[id]').map((e) => e.id);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });
    it('every #anchor lands on an element', () => {
      for (const a of doc.querySelectorAll('a[href^="#"]')) {
        const id = a.getAttribute('href')!.slice(1);
        expect(doc.getElementById(id), `#${id}`).not.toBeNull();
      }
    });
    it('every local link, image and script exists in dist', () => {
      const urls = [
        ...doc.querySelectorAll('[href]').map((e) => e.getAttribute('href')!),
        ...doc.querySelectorAll('[src]').map((e) => e.getAttribute('src')!),
        ...doc.querySelectorAll('[srcset]').flatMap((e) => e.getAttribute('srcset')!.split(',').map((s) => s.trim().split(/\s+/)[0])),
      ].filter((u) => u.startsWith('/') && !u.startsWith('//'));
      for (const u of urls) expect(existsSync(toFile(u)), u).toBe(true);
    });
    it('the share image exists', () => {
      const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og) expect(existsSync(toFile(new URL(og).pathname)), og).toBe(true);
    });
    it('every image has an alt attribute', () => {
      for (const img of doc.querySelectorAll('img')) expect(img.hasAttribute('alt'), img.toString().slice(0, 80)).toBe(true);
    });
    it('links that open a new tab do not hand over the page', () => {
      for (const a of doc.querySelectorAll('a[target="_blank"]')) expect(a.getAttribute('rel') ?? '').toMatch(/noopener/);
    });
  });
});
