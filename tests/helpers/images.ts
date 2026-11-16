import { parse, type HTMLElement } from 'node-html-parser';

const widths = (srcset: string | undefined) => (srcset ?? '').split(',').map((e) => Number(e.trim().match(/\s(\d+)w$/)?.[1])).filter(Boolean);

type Source = { file: string; text: string };

/**
 * Every `<Picture>` whose literal `widths={[...]}` asks for more pixels than its photo has.
 * The cause (not the built output, where Astro silently drops over-wide steps): a dynamic
 * `src={photos[expr]}` is held to the narrowest photo in the repo.
 */
export function widthsTooWide(sources: Source[], realWidth: Record<string, number>): { checked: number; tooWide: string[] } {
  const tooWide: string[] = [];
  const narrowest = Math.min(...Object.values(realWidth));
  let checked = 0;
  for (const { file, text } of sources) {
    for (const [tag] of text.matchAll(/<Picture\b[\s\S]*?\/>/g)) {
      const literal = tag.match(/widths=\{\[([^\]]*)\]\}/)?.[1];
      if (literal === undefined) continue;
      const max = Math.max(...(literal.match(/\d+/g) ?? []).map(Number));
      const named = tag.match(/src=\{photos\.(\w+)\}/)?.[1];
      const limit = named !== undefined && realWidth[named] !== undefined ? realWidth[named] : narrowest;
      checked += 1;
      if (max > limit) tooWide.push(`${file}: widths up to ${max}w > ${limit}`);
    }
  }
  return { checked, tooWide };
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
