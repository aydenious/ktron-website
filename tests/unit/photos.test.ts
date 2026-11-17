import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import credits from '../../src/assets/photos/credits.json';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { PHOTO_IDS, PHOTO_POSITION } from '../../src/assets/photos';

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

/** Offset of a JPEG COM segment (0xFF 0xFE) before the first SOS (0xFF 0xDA), or -1. Throws on a malformed file. */
function jpegCommentOffset(bytes: Buffer): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a JPEG: no SOI');
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) return -1; // entropy-coded data starts; no comment can follow
    if (marker === 0xfe) return i;
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error('JPEG segments are malformed: SOS was never reached');
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
  // 380, not 1200: the owner's photos are 1248 px sheets, and two card photos are panels cut from one of
  // them. widthsFor keeps every srcset step at or below a photo's real width, so none is upscaled.
  it.each(PHOTO_IDS)('%s is a clean JPEG, 380–2000 px wide, with no metadata', async (id) => {
    const m = await sharp(`${DIR}/${id}.jpg`).metadata();
    expect(m.format).toBe('jpeg');
    expect(m.width).toBeGreaterThanOrEqual(380);
    expect(m.width).toBeLessThanOrEqual(2000);
    expect(m.exif).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(m.iptc).toBeUndefined();
    expect(m.icc).toBeUndefined();
  });
  it.each(PHOTO_IDS)('%s carries no JPEG comment segment', (id) => {
    expect(jpegCommentOffset(readFileSync(`${DIR}/${id}.jpg`))).toBe(-1);
  });
  it('the comment scan fails on a malformed file instead of passing it', () => {
    expect(() => jpegCommentOffset(Buffer.from('not a jpeg at all'))).toThrow(/SOI/);
    expect(() => jpegCommentOffset(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0x12, 0x34]))).toThrow(/SOS/);
    expect(jpegCommentOffset(Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x61, 0x62]))).toBe(2);
  });
  it('a photo taller than 4:3 says where its card crop sits', async () => {
    for (const id of PHOTO_IDS) {
      const m = await sharp(`${DIR}/${id}.jpg`).metadata();
      if (m.width! / m.height! < 4 / 3) expect(PHOTO_POSITION[id], `${id} needs a position`).toMatch(/^\d+% \d+%$/);
    }
  });
});
