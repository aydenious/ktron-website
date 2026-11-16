import { describe, expect, it } from 'vitest';
import { srcsetTooWide } from '../helpers/images';

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
