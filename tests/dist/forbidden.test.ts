import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// SHA-256 of forbidden lower-case words. Never write the words themselves in this repo.
const FORBIDDEN = new Set(['7ff26ca7636fecde95757c88c79117cd5733344dce935994ba0683bd8ae30471']);
const TEXT = /\.(astro|ts|mjs|js|json|css|md|svg|html|xml|txt|yml)$/;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String).map((f) => join(dir, f));
}

export function forbiddenHits(text: string): string[] {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const hits: string[] = [];
  words.forEach((w, i) => {
    for (const cand of [w, w + (words[i + 1] ?? '')]) if (FORBIDDEN.has(sha(cand))) hits.push(`word ${i}`);
  });
  return hits;
}

describe('forbidden words (gate 5)', () => {
  it('the detector works', () => {
    expect(forbiddenHits('hello world')).toEqual([]);
  });
  const scanned = [...files('src'), ...files('public'), ...files('dist'), 'README.md', 'CREDITS.md']
    .filter((f) => existsSync(f));
  it.each(scanned)('%s is clean', (file) => {
    expect(forbiddenHits(file), 'file name').toEqual([]);
    if (TEXT.test(file)) expect(forbiddenHits(readFileSync(file, 'utf8'))).toEqual([]);
  });
});
