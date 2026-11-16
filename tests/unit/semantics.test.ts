import { describe, expect, it } from 'vitest';
import { markupOf, rulesOf, SOURCES } from '../helpers/css';

const astro = SOURCES.filter((f) => f.endsWith('.astro'));

describe('semantics that CSS can remove', () => {
  it('a list styled with list-style: none keeps role="list" on every list in that file (Safari drops the semantics)', () => {
    const bad = astro
      .filter((f) => rulesOf(f).some((r) => /^none$/.test(r.decl['list-style'] ?? r.decl['list-style-type'] ?? '')))
      .filter((f) => [...markupOf(f).matchAll(/<(?:ul|ol)\b([^>]*)>/g)].some((m) => !/\brole="list"/.test(m[1])));
    expect(bad).toEqual([]);
  });
  it('a box that scrolls sideways is focusable, so a keyboard user can scroll it', () => {
    const bad: string[] = [];
    for (const f of astro) {
      for (const r of rulesOf(f).filter((x) => /^(auto|scroll)$/.test(x.decl['overflow-x'] ?? x.decl.overflow ?? ''))) {
        const cls = r.selector.match(/^\.([\w-]+)$/)?.[1];
        const tag = cls && markupOf(f).match(new RegExp(`<\\w+\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`))?.[0];
        if (!tag || !/\btabindex="0"/.test(tag)) bad.push(`${f} ${r.selector}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
