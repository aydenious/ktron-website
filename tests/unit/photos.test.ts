import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import credits from '../../src/assets/photos/credits.json';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { PHOTO_IDS } from '../../src/assets/photos';

const DIR = 'src/assets/photos';
const LICENCES = ['Unsplash License', 'Pexels License', 'Pixabay Content License', "Owner's own photo"];
const jpgs = readdirSync(DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/\.jpg$/, '')).sort();

describe('photos (gate 3 and PRD §4.5)', () => {
  it('there is exactly one file per photo id', () => {
    expect(jpgs).toEqual([...PHOTO_IDS].sort());
  });
  it('every photo has a credit with a source URL and a free licence', () => {
    expect(Object.keys(credits).sort()).toEqual([...PHOTO_IDS].sort());
    for (const [id, c] of Object.entries(credits)) {
      expect(LICENCES, id).toContain(c.licence);
      const site = c.licence === "Owner's own photo" ? /^https:\/\/ktron\.my\// : /^https:\/\/(unsplash\.com|www\.pexels\.com|pixabay\.com)\//;
      expect(c.source, id).toMatch(site);
      expect(c.author.trim(), id).not.toBe('');
    }
  });
  it('CREDITS.md lists every source URL', () => {
    const md = readFileSync('CREDITS.md', 'utf8');
    for (const c of Object.values(credits)) expect(md).toContain(c.source);
  });
  it('every photo has alt text in both languages', () => {
    for (const id of PHOTO_IDS) {
      const key = `photo.${id}.alt` as keyof typeof en;
      expect(en[key]?.trim(), `en ${key}`).toBeTruthy();
      expect(zh[key]?.trim(), `zh ${key}`).toBeTruthy();
    }
  });
  it.each(PHOTO_IDS)('%s is a clean JPEG, 1200–2000 px wide, with no metadata', async (id) => {
    const m = await sharp(`${DIR}/${id}.jpg`).metadata();
    expect(m.format).toBe('jpeg');
    expect(m.width).toBeGreaterThanOrEqual(1200);
    expect(m.width).toBeLessThanOrEqual(2000);
    expect(m.exif).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(m.iptc).toBeUndefined();
  });
});
