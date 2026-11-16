import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAVY, WHITE, toMono } from '../../scripts/pick-logo.mjs';

const PALETTE = new Set(['#0b2545', '#13315c', '#c9a227', '#ffffff', 'none', 'currentcolor']);
const concepts = ['a', 'b', 'c'].map((id) => ({ id, svg: readFileSync(`src/brand/concepts/logo-${id}.svg`, 'utf8') }));
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

  it('stops on a white shape it cannot cut', () => {
    expect(() => toMono('<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#FFFFFF"/></svg>', NAVY)).toThrow(/white shape|no stroke/);
  });
});

