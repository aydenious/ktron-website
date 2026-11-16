import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAVY, PICKS, WHITE, toMono } from '../../scripts/pick-logo.mjs';

const PALETTE = new Set(['#0b2545', '#13315c', '#c9a227', '#ffffff', 'none', 'currentcolor']);
const concepts = PICKS.map((id) => ({ id, svg: readFileSync(`src/brand/concepts/logo-${id}.svg`, 'utf8') }));
const paints = (svg: string) => [...svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toUpperCase());
const count = (svg: string, what: RegExp) => svg.match(what)?.length ?? 0;

describe('the one-colour derivation every concept goes through', () => {
  it.each(concepts)('concept $id keeps the brand-test rules and one colour', ({ svg }) => {
    for (const [colour, mono] of [[NAVY, toMono(svg, NAVY)], [WHITE, toMono(svg, WHITE)]] as const) {
      expect(mono).toMatch(/<svg[^>]*\bviewBox="[\d.\s-]+"/);
      expect(mono).not.toMatch(/<(text|image|script|foreignObject)\b/);
      expect(mono).not.toMatch(/\bstyle=|<style\b/);
      expect(new Set(paints(mono).filter((c) => c !== 'NONE'))).toEqual(new Set([colour]));
      for (const c of paints(mono)) expect(PALETTE).toContain(c.toLowerCase());
    }
  });

  it('cuts a white knockout into a hole instead of merging it with the artwork', () => {
    const [c] = concepts.filter((x) => x.id === 'c');
    expect(count(c.svg, /<circle\b/g)).toBe(5);
    expect(count(toMono(c.svg, NAVY), /<circle\b/g)).toBe(4);
    expect(count(toMono(c.svg, NAVY), /fill-rule="evenodd"/g)).toBe(count(c.svg, /fill-rule="evenodd"/g) + 1);
  });

  it("cuts concept C's ring to the exact radii: outer r + width/2, inner r - width/2", () => {
    const [c] = concepts.filter((x) => x.id === 'c');
    const ring = c.svg.match(/<circle\b[^>]*fill="#FFFFFF"[^>]*\/>/i)![0];
    const attr = (name: string) => Number(ring.match(new RegExp(`\\b${name}="([\\d.]+)"`))![1]);
    const [r, width] = [attr('r'), attr('stroke-width')];
    const d = toMono(c.svg, NAVY).match(/<path fill="#0B2545" fill-rule="evenodd" d="(M[^"]*a[^"]*)"\/>(?![\s\S]*fill-rule="evenodd" d="M[^"]*a)/)?.[1] ?? '';
    const radii = d.split('M').filter(Boolean).map((sub) => Number(sub.match(/a([\d.]+) /)![1]));
    expect(radii).toEqual([r + width / 2, r - width / 2]);
  });

  const WHITES = [
    '<path fill="#FFFFFF" d="M0 0H4V4Z"/>',
    '<rect fill="#ffffff" width="4" height="4"/>',
    '<polygon fill="#FFFFFF" points="0,0 4,0 4,4"/>',
    '<path fill="#fff" d="M0 0H4V4Z"/>',
    '<path fill="white" d="M0 0H4V4Z"/>',
    '<path fill="WHITE" d="M0 0H4V4Z"/>',
    "<path fill='#FFFFFF' d='M0 0H4V4Z'/>",
    '<path fill = "#FFFFFF" d="M0 0H4V4Z"/>',
    '<path style="fill:#FFFFFF" d="M0 0H4V4Z"/>',
    '<path style="stroke: #fff; fill: none" d="M0 0H4V4Z"/>',
    '<path fill="none" stroke="#FFFFFF" d="M0 0H4V4Z"/>',
    "<path fill='none' stroke='white' d='M0 0H4V4Z'/>",
  ];
  it.each(WHITES)('stops on a white shape, however it is written: %s', (shape) => {
    expect(() => toMono(`<svg viewBox="0 0 8 8">${shape}</svg>`, NAVY)).toThrow(/white/);
  });

  it.each(['fill="#FFFFFF"', "fill='#fff'", 'fill = "white"', 'style="fill:#FFFFFF"'])('cuts a stroked white circle written as %s', (fill) => {
    const mono = toMono(`<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" ${fill} stroke="#C9A227" stroke-width="2"/></svg>`, NAVY);
    expect(mono).toMatch(/fill-rule="evenodd"/);
    expect(mono).not.toMatch(/<circle/);
  });

  it('writes nothing when a concept cannot be derived', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pick-'));
    mkdirSync(join(dir, 'src/brand/concepts'), { recursive: true });
    writeFileSync(join(dir, 'src/brand/concepts/logo-a.svg'), '<svg viewBox="0 0 8 8"><path fill="#FFFFFF" d="M0 0H4V4Z"/></svg>');
    writeFileSync(join(dir, 'src/brand/concepts/icon-a.svg'), '<svg viewBox="0 0 8 8"/>');
    expect(() => execFileSync(process.execPath, [resolve('scripts/pick-logo.mjs'), 'a'], { cwd: dir, stdio: 'pipe' })).toThrow();
    expect(readdirSync(join(dir, 'src/brand')).sort()).toEqual(['concepts']);
  });

  it('stops on a white shape it cannot cut', () => {
    expect(() => toMono('<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#FFFFFF"/></svg>', NAVY)).toThrow(/white shape|no stroke/);
  });
});

describe('the list of concepts', () => {
  const ids = (prefix: string) => readdirSync('src/brand/concepts').filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length, -'.svg'.length)).sort();
  it('has a logo file for every pick and no other', () => expect(ids('logo-')).toEqual([...PICKS].sort()));
  it('has an icon file for every pick and no other', () => expect(ids('icon-')).toEqual([...PICKS].sort()));
});

describe('the committed brand files follow the recorded pick', () => {
  const read = (f: string) => readFileSync(`src/brand/${f}`, 'utf8');
  const { pick } = JSON.parse(read('pick.json')) as { pick: string };

  it('records a known concept', () => expect(PICKS).toContain(pick));
  it('logo.svg is the picked logo', () => expect(read('logo.svg')).toBe(read(`concepts/logo-${pick}.svg`)));
  it('icon.svg is the picked icon', () => expect(read('icon.svg')).toBe(read(`concepts/icon-${pick}.svg`)));
  it('logo-navy.svg is the derived navy logo', () => expect(read('logo-navy.svg')).toBe(toMono(read('logo.svg'), NAVY)));
  it('logo-white.svg is the derived white logo', () => expect(read('logo-white.svg')).toBe(toMono(read('logo.svg'), WHITE)));
});
