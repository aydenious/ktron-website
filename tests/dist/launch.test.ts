import { describe, expect, it } from 'vitest';
import { distFiles } from './dist';

describe('launch', () => {
  it('the logo preview page is gone', () => {
    expect(distFiles().filter((f) => f.replaceAll('\\', '/').startsWith('brand/'))).toEqual([]);
  });
});
