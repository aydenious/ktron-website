import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { pngsToIco } from '../../scripts/ico.mjs';

describe('pngsToIco', () => {
  it('writes an ICO header, one entry per image and the PNG bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const ico = pngsToIco([{ size: 16, data: png }, { size: 32, data: png }]);
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 2, 0]);
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt32LE(6 + 8)).toBe(4);
    expect(ico.readUInt32LE(6 + 12)).toBe(6 + 32);
    expect(ico.length).toBe(6 + 32 + 8);
  });
});

describe('generated icons', () => {
  it.each([
    ['public/favicon-32.png', 32],
    ['public/apple-touch-icon.png', 180],
    ['public/icon-512.png', 512],
  ])('%s is %i px square', async (file, size) => {
    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([size, size]);
  });

  it.each(['public/apple-touch-icon.png', 'public/icon-512.png'])('%s is full-bleed, so iOS paints no black corners', async (file) => {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + info.channels - 1];
    for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) expect(alphaAt(x, y)).toBe(255);
  });

  it('favicon-32.png is the current icon.svg rendered at 32 px', async () => {
    const raw = (input: string | Buffer) => sharp(input, { density: 512 }).resize(32, 32).ensureAlpha().raw().toBuffer();
    const [fresh, saved] = await Promise.all([raw(readFileSync('src/brand/icon.svg')), raw('public/favicon-32.png')]);
    expect(fresh.length).toBe(saved.length);
    let worst = 0;
    for (let i = 0; i < fresh.length; i++) worst = Math.max(worst, Math.abs(fresh[i] - saved[i]));
    expect(worst).toBeLessThanOrEqual(8);
  });

  it('favicon.ico holds 16, 32 and 48 px images', () => {
    const ico = readFileSync('public/favicon.ico');
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([0, 1, 2].map((i) => ico.readUInt8(6 + i * 16))).toEqual([16, 32, 48]);
  });

  it('favicon.svg is the brand icon', () => {
    expect(readFileSync('public/favicon.svg', 'utf8')).toBe(readFileSync('src/brand/icon.svg', 'utf8'));
  });

  it('the one-colour logos use one colour', () => {
    const fills = (f: string) => new Set([...readFileSync(f, 'utf8').matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()));
    expect(fills('src/brand/logo-navy.svg')).toEqual(new Set(['#0B2545']));
    expect(fills('src/brand/logo-white.svg')).toEqual(new Set(['#FFFFFF']));
  });
});

