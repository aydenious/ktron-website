import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { widthsFor } from '../../src/assets/photos';
import { SOURCES } from '../helpers/css';
import { picturesWithoutWidthsFor, srcsetTooWide } from '../helpers/images';

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

describe('widthsFor', () => {
  const photo = (width: number) => ({ src: '/x.jpg', width, height: width, format: 'jpg' as const });
  it('keeps steps at or below the photo width', () => {
    expect(widthsFor(photo(2000), [480, 800, 1200])).toEqual([480, 800, 1200]);
  });
  it('caps wider steps at the photo width and drops the duplicates', () => {
    expect(widthsFor(photo(918), [480, 800, 1200])).toEqual([480, 800, 918]);
    expect(widthsFor(photo(389), [400, 800])).toEqual([389]);
  });
});

describe('every Picture takes its widths from widthsFor', () => {
  const one = (tag: string) => [{ file: 'src/components/X.astro', text: tag }];
  it('flags a literal widths array and a missing one', () => {
    expect(picturesWithoutWidthsFor(one('<Picture src={photos.hero} widths={[480, 1600]} />')).bad)
      .toEqual(['src/components/X.astro: <Picture src={photos.hero} widths={[480, 1600]} />']);
    expect(picturesWithoutWidthsFor(one('<Picture src={photos.hero} />')).bad).toHaveLength(1);
  });
  it('accepts widthsFor, on one line or several', () => {
    expect(picturesWithoutWidthsFor(one('<Picture src={photos[id]}\n  widths={widthsFor(photos[id], [400, 800])} />')))
      .toEqual({ checked: 1, bad: [] });
  });
  it('holds for every Picture in src/', () => {
    const sources = SOURCES.filter((f) => f.endsWith('.astro')).map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));
    const { checked, bad } = picturesWithoutWidthsFor(sources);
    expect(checked).toBeGreaterThanOrEqual(3);
    expect(bad).toEqual([]);
  });
});
