import { parse, type HTMLElement } from 'node-html-parser';

const widths = (srcset: string | undefined) => (srcset ?? '').split(',').map((e) => Number(e.trim().match(/\s(\d+)w$/)?.[1])).filter(Boolean);

/** Every srcset entry (on an img or its sibling source) wider than the real pixel width of its photo, keyed by alt text. */
export function srcsetTooWide(root: HTMLElement | string, realWidth: Record<string, number>): { checked: number; tooWide: string[] } {
  const doc = typeof root === 'string' ? parse(root) : root;
  const tooWide: string[] = [];
  let checked = 0;
  for (const img of doc.querySelectorAll('img')) {
    const alt = img.getAttribute('alt') ?? '';
    const max = realWidth[alt];
    if (max === undefined) throw new Error(`alt "${alt}" maps to no photo`);
    for (const el of [img, ...(img.parentNode?.querySelectorAll('source') ?? [])]) {
      for (const w of widths(el.getAttribute('srcset'))) {
        checked++;
        if (w > max) tooWide.push(`${alt}: ${w}w > ${max}`);
      }
    }
  }
  return { checked, tooWide };
}
