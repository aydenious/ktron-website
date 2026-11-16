import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAVY, WHITE, toMono } from '../../scripts/pick-logo.mjs';

const PALETTE = new Set(['#0b2545', '#13315c', '#c9a227', '#ffffff', 'none', 'currentcolor']);
const concepts = ['a', 'b', 'c', 'd'].map((id) => ({ id, svg: readFileSync(`src/brand/concepts/logo-${id}.svg`, 'utf8') }));
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

  it('stops on a white path, rect or polygon, which would merge with the artwork', () => {
    for (const shape of ['<path fill="#FFFFFF" d="M0 0H4V4Z"/>', '<rect fill="#ffffff" width="4" height="4"/>', '<polygon fill="#FFFFFF" points="0,0 4,0 4,4"/>']) {
      expect(() => toMono(`<svg viewBox="0 0 8 8">${shape}</svg>`, NAVY)).toThrow(/white/);
    }
  });

  it('stops on a white shape it cannot cut', () => {
    expect(() => toMono('<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#FFFFFF"/></svg>', NAVY)).toThrow(/white shape|no stroke/);
  });
});

describe('the committed brand files follow the recorded pick', () => {
  const read = (f: string) => readFileSync(`src/brand/${f}`, 'utf8');
  const { pick } = JSON.parse(read('pick.json')) as { pick: string };

  it('records a known concept', () => expect(['a', 'b', 'c', 'd']).toContain(pick));
  it('logo.svg is the picked logo', () => expect(read('logo.svg')).toBe(read(`concepts/logo-${pick}.svg`)));
  it('icon.svg is the picked icon', () => expect(read('icon.svg')).toBe(read(`concepts/icon-${pick}.svg`)));
  it('logo-navy.svg is the derived navy logo', () => expect(read('logo-navy.svg')).toBe(toMono(read('logo.svg'), NAVY)));
  it('logo-white.svg is the derived white logo', () => expect(read('logo-white.svg')).toBe(toMono(read('logo.svg'), WHITE)));
});
