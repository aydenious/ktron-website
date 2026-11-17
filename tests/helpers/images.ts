import { parse, type HTMLElement } from 'node-html-parser';

const widths = (srcset: string | undefined) => (srcset ?? '').split(',').map((e) => Number(e.trim().match(/\s(\d+)w$/)?.[1])).filter(Boolean);

type Source = { file: string; text: string };

/** Each `<Picture ...>` opening tag, self-closing or not, read up to the `>` outside any `{...}` (so `=>` inside one doesn't end it). */
function pictureTags(text: string): string[] {
  const tags: string[] = [];
  for (const m of text.matchAll(/<Picture\b/g)) {
    let depth = 0;
    let i = m.index;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      else if (text[i] === '>' && depth === 0) break;
    }
    tags.push(text.slice(m.index, i + 1));
  }
  return tags;
}

/**
 * Every `<Picture>` whose `widths` is not `widthsFor(<its own src>, ...)`. widthsFor caps each step at
 * the photo's real width; a literal array, a missing widths, or widthsFor of another photo can ask
 * for more pixels than the photo has, which Astro silently drops or upscales.
 */
export function picturesWithoutWidthsFor(sources: Source[]): { checked: number; bad: string[] } {
  const bad: string[] = [];
  let checked = 0;
  for (const { file, text } of sources) {
    for (const tag of pictureTags(text)) {
      checked += 1;
      const src = tag.match(/\ssrc=\{([^}]+)\}/)?.[1].trim();
      const widths = tag.match(/\swidths=\{widthsFor\(([^,]+),/)?.[1].trim();
      if (!src || src !== widths) bad.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
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
