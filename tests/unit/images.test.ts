import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PHOTO_IDS } from '../../src/assets/photos';
import { SOURCES } from '../helpers/css';
import { srcsetTooWide, widthsTooWide } from '../helpers/images';

describe('the srcset width check', () => {
  const html = (w: number) => `<picture><source srcset="/a-480.avif 480w, /a-${w}.avif ${w}w"><img alt="Hero" srcset="/a-${w}.jpg ${w}w"></picture>`;
  it('flags a width above the real photo width, on a source or an img', () => {
    expect(srcsetTooWide(html(1600), { Hero: 1280 }).tooWide).toEqual(['Hero: 1600w > 1280', 'Hero: 1600w > 1280']);
  });
  it('accepts widths at or below it', () => {
    expect(srcsetTooWide(html(1280), { Hero: 1280 })).toEqual({ checked: 3, tooWide: [] });
  });
  it('refuses an image whose alt maps to no photo', () => {
    expect(() => srcsetTooWide(html(800), {})).toThrow(/maps to no photo/);
  });
});

describe('the literal widths check', () => {
  const real = { hero: 1280, quality: 2000 };
  const one = (tag: string) => [{ file: 'src/components/X.astro', text: tag }];
  it('flags a widths array above its photo, named or dynamic', () => {
    expect(widthsTooWide(one('<Picture src={photos.hero} widths={[480, 1600]} />'), real).tooWide)
      .toEqual(['src/components/X.astro: widths up to 1600w > 1280']);
    expect(widthsTooWide(one('<Picture src={photos[id]} widths={[400, 2000]} />'), real).tooWide)
      .toEqual(['src/components/X.astro: widths up to 2000w > 1280']);
  });
  it('accepts widths at or below the photo width', () => {
    expect(widthsTooWide(one('<Picture src={photos.quality} widths={[480, 1200]} />'), real)).toEqual({ checked: 1, tooWide: [] });
  });
  it('every literal widths array in src/components is at most its photo width', async () => {
    const realWidths = Object.fromEntries(await Promise.all(PHOTO_IDS.map(async (id) =>
      [id, (await sharp(`src/assets/photos/${id}.jpg`).metadata()).width!])));
    const sources = SOURCES.filter((f) => f.endsWith('.astro')).map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));
    const { checked, tooWide } = widthsTooWide(sources, realWidths);
    expect(checked).toBeGreaterThanOrEqual(3);
    expect(tooWide).toEqual([]);
  });
});
