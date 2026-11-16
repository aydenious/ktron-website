import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'src/brand';
const ALLOWED = new Set(['#0b2545', '#13315c', '#c9a227', '#ffffff', 'none', 'currentcolor']);
const svgs = readdirSync(ROOT, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.svg'))
  .map((f) => join(ROOT, f));

describe('brand SVGs', () => {
  it('exist', () => expect(svgs.length).toBeGreaterThan(0));

  it.each(svgs)('%s is a clean, palette-only drawing', (file) => {
    const svg = readFileSync(file, 'utf8');
    expect(svg).toMatch(/<svg[^>]*\bviewBox="[\d.\s-]+"/);
    expect(svg).not.toMatch(/<(text|image|script|foreignObject)\b/);
    expect(svg).not.toMatch(/\bstyle=|<style\b/);
    const colours = [...svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toLowerCase());
    for (const c of colours) expect(ALLOWED, `${file}: ${c}`).toContain(c);
  });
});
