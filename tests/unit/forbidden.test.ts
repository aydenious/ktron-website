import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { forbiddenHits, scanFiles, scanText } from '../helpers/forbidden';

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
    ['only in an alt attribute', '<img src="/a.jpg" alt="Zorblax workers">'],
    ['only in an href attribute', '<a href="/img/zorblax/">Home</a>'],
    ['only in a meta content attribute', '<meta property="og:title" content="About zorblax">'],
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

describe('forbidden-word scope (gate 5)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scope-'));
  const put = (name: string, body: string | Buffer) => {
    const file = join(dir, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, body);
    return file;
  };
  const scan = (...files: string[]) => scanFiles(files, STAND_IN).map((o) => o.replace(dir, ''));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('finds a name in a file name', () => {
    expect(scan(put('img/zorblax-logo.svg', '<svg/>'))).toEqual(['/img/zorblax-logo.svg: name sha:' + [...STAND_IN][0].slice(0, 8)]);
  });
  it('reads an extensionless file such as _headers', () => {
    expect(scan(put('_headers', '/*\n  X-Note: zorblax\n'))).toHaveLength(1);
  });
  it('reads a .map file', () => {
    expect(scan(put('app.js.map', '{"sources":["zorblax.ts"]}'))).toHaveLength(1);
  });
  it('checks the name of a binary file but not its bytes', () => {
    const out = scan(put('photo-zorblax.png', Buffer.concat([Buffer.from([0x89, 0, 0, 0]), Buffer.from('zorblax')])));
    expect(out).toEqual(['/photo-zorblax.png: name sha:' + [...STAND_IN][0].slice(0, 8)]);
  });
  it('says nothing about clean files', () => {
    expect(scan(put('ok.txt', 'Trimming and inspection'))).toEqual([]);
  });
  it('finds a name in commit-message text', () => {
    expect(scanText('commit messages', 'fix: thank zorblax', STAND_IN)).toHaveLength(1);
    expect(scanText('commit messages', 'fix: tidy the footer', STAND_IN)).toEqual([]);
  });
});

describe('forbidden words in the repo (gate 5)', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

  it('no tracked file name or text holds the name', () => {
    expect(scanFiles(tracked)).toEqual([]);
  }, 120_000);

  it('no commit message holds the name', () => {
    const log = execFileSync('git', ['log', '--format=%B'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(scanText('commit messages', log)).toEqual([]);
  });
});
