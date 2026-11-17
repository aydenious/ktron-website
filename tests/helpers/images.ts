import { parse, type HTMLElement } from 'node-html-parser';

const widths = (srcset: string | undefined) => (srcset ?? '').split(',').map((e) => Number(e.trim().match(/\s(\d+)w$/)?.[1])).filter(Boolean);

type Source = { file: string; text: string };

/**
 * Every `<Picture>` whose `widths` is not `widthsFor(...)`. widthsFor caps each step at the photo's
 * real width; a literal array (or a step list built some other way) can ask for more pixels than
 * the photo has, which Astro silently drops or upscales.
 */
export function picturesWithoutWidthsFor(sources: Source[]): { checked: number; bad: string[] } {
  const bad: string[] = [];
  let checked = 0;
  for (const { file, text } of sources) {
    for (const [tag] of text.matchAll(/<Picture\b[\s\S]*?\/>/g)) {
      checked += 1;
      if (!/\swidths=\{widthsFor\(/.test(tag)) bad.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
    }
  }
  return { checked, bad };
}

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
