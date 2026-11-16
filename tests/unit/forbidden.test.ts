import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { forbiddenHits, textOf } from '../helpers/forbidden';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
// A stand-in for the forbidden name: the real one is never written in this repo.
const STAND_IN = new Set([sha('zorblax')]);
const hits = (text: string) => forbiddenHits(text, STAND_IN);

describe('forbidden-word detector (gate 5)', () => {
  it.each([
    ['plain', 'we thank zorblax today'],
    ['upper case', 'ZORBLAX'],
    ['mixed case', 'ZorBlax'],
    ['inside a longer token', 'myzorblaxfactory'],
    ['with a digit suffix', 'zorblax2'],
    ['two parts joined by a hyphen', 'zor-blax'],
    ['two parts joined by an underscore', 'zor_blax'],
    ['two parts joined by a space', 'Zor Blax Ltd'],
    ['two parts joined by a slash', 'img/zor/blax.png'],
    ['three parts', 'zo r blax'],
    ['split by a tag', '<b>zor</b>blax'],
    ['full-width letters', 'ｚｏｒｂｌａｘ'],
  ])('finds the name: %s', (_label, text) => {
    expect(hits(text)).not.toEqual([]);
  });

  it('finds nothing in ordinary copy', () => {
    expect(hits('Trimming, deflashing and microscope inspection near Kulai. <p>Call 010-545 4173</p>')).toEqual([]);
  });

  it('does not print the name it found', () => {
    expect(hits('zorblax').join(' ')).not.toMatch(/zorblax/);
  });
});

describe('forbidden words in the repo (gate 5)', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

  it('no tracked file name or text holds the name', () => {
    const offenders: string[] = [];
    for (const file of tracked) {
      const found = [...forbiddenHits(file).map((h) => `name ${h}`)];
      const text = textOf(file);
      if (text !== null) found.push(...forbiddenHits(text).map((h) => `text ${h}`));
      if (found.length) offenders.push(`${file}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  }, 120_000);

  it('no commit message holds the name', () => {
    const log = execFileSync('git', ['log', '--format=%B'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(forbiddenHits(log)).toEqual([]);
  });
});
