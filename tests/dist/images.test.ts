import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PHOTO_IDS } from '../../src/assets/photos';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { srcsetTooWide } from '../helpers/images';
import { page } from './dist';

describe.each([['/', en], ['/zh/', zh]] as const)('%s image widths', (path, s) => {
  it('no srcset asks for more pixels than its photo has', async () => {
    const real = Object.fromEntries(await Promise.all(PHOTO_IDS.map(async (id) => [s[`photo.${id}.alt`], (await sharp(`src/assets/photos/${id}.jpg`).metadata()).width!])));
    const { checked, tooWide } = srcsetTooWide(page(path).querySelector('main')!, real);
    expect(checked).toBeGreaterThan(20);
    expect(tooWide).toEqual([]);
  });
});
