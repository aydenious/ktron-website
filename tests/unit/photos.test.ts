import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import credits from '../../src/assets/photos/credits.json';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { PHOTO_IDS } from '../../src/assets/photos';

const DIR = 'src/assets/photos';
const LICENCES = ['Unsplash License', 'Pexels License', 'Pixabay Content License', "Owner's own photo"];
/** The host each licence must come from; the owner's own photo has no host requirement. */
const LICENCE_HOST: Record<string, string | null> = {
  'Unsplash License': 'unsplash.com',
  'Pixabay Content License': 'pixabay.com',
  'Pexels License': 'pexels.com',
  "Owner's own photo": null,
};
const jpgs = readdirSync(DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/\.jpg$/, '')).sort();

/** Offset of a JPEG COM segment (0xFF 0xFE) before the first SOS (0xFF 0xDA), or -1. */
function jpegCommentOffset(bytes: Buffer): number {
  let i = 2; // after SOI (0xFF 0xD8)
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) break; // entropy-coded data starts; no comment can follow
    if (marker === 0xfe) return i;
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return -1;
}

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
  it('CREDITS.md and credits.json agree in both directions', () => {
    const inMd = new Set([...readFileSync('CREDITS.md', 'utf8').matchAll(/https:\/\/[^\s)|]+/g)].map((m) => m[0]));
    const inJson = new Set(Object.values(credits).map((c) => c.source));
    expect([...inMd].sort(), 'CREDITS.md URLs missing from credits.json').toEqual([...inJson].sort());
  });
  it('the licence label matches the source host', () => {
    for (const [id, c] of Object.entries(credits)) {
      expect(Object.keys(LICENCE_HOST), id).toContain(c.licence);
      const want = LICENCE_HOST[c.licence];
      if (want !== null) expect(new URL(c.source).hostname.replace(/^www\./, ''), id).toBe(want);
    }
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
    expect(m.icc).toBeUndefined();
  });
  it.each(PHOTO_IDS)('%s carries no JPEG comment segment', (id) => {
    expect(jpegCommentOffset(readFileSync(`${DIR}/${id}.jpg`))).toBe(-1);
  });
});
