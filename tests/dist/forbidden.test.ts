import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanFiles } from '../helpers/forbidden';
import { DIST } from './dist';

describe('forbidden words in the build (gate 5)', () => {
  it('no built file name or text holds the name', () => {
    const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name));
    expect(scanFiles(files)).toEqual([]);
  }, 120_000);
});
