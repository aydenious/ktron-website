import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { magnificationHits } from '../helpers/facts';
import { distFiles } from './dist';

// Owner ruling 2026-11-17: 10x only
describe('the built pages claim no magnification but 10x', () => {
  const pages = distFiles().filter((f) => f.endsWith('.html'));
  it('finds pages', () => expect(pages.length).toBeGreaterThan(0));
  it.each(pages)('%s: visible text, alt text and meta content', (page) => {
    const doc = parse(readFileSync(`dist/${page}`, 'utf8'));
    for (const el of doc.querySelectorAll('style, script:not([type="application/ld+json"])')) el.remove();
    const attrs = doc.querySelectorAll('[alt], [title], [aria-label], meta[content]')
      .flatMap((el) => [el.getAttribute('alt'), el.getAttribute('title'), el.getAttribute('aria-label'), el.getAttribute('content')])
      .filter((v): v is string => !!v);
    expect(magnificationHits([doc.text, ...attrs].join('\n')), page).toEqual([]);
  });
});
