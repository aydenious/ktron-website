import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forbiddenHits, textOf } from '../helpers/forbidden';
import { DIST } from './dist';

describe('forbidden words in the build (gate 5)', () => {
  it('no built file name or text holds the name', () => {
    const offenders: string[] = [];
    for (const rel of readdirSync(DIST, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name))) {
      const found = [...forbiddenHits(rel).map((h) => `name ${h}`)];
      const text = textOf(rel);
      if (text !== null) found.push(...forbiddenHits(text).map((h) => `text ${h}`));
      if (found.length) offenders.push(`${rel}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  }, 120_000);
});
