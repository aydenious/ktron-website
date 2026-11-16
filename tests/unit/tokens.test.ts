import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenValue } from '../../src/styles/token';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string) => tokenValue(css, name);

describe('colour tokens (PRD §7)', () => {
  it.each([
    ['navy', '#0B2545'], ['navy-2', '#13315C'], ['gold', '#C9A227'], ['gold-soft', '#F3E7B3'],
    ['paper', '#FAFAF7'], ['slate', '#1F2933'], ['whatsapp', '#25D366'],
    ['grey-1', '#E4E7EB'], ['grey-2', '#C9D3DD'], ['grey-3', '#9AA5B1'],
  ])('--%s is %s', (name, value) => {
    expect(token(name)?.toUpperCase()).toBe(value);
  });

  it('Chinese text uses the system Simplified Chinese fonts (Ruling 1)', () => {
    expect(token('font-zh')).toContain('"PingFang SC"');
    expect(token('font-zh')).toContain('"Microsoft YaHei"');
  });

  it('tokenValue returns the declared value and throws for a missing token', () => {
    expect(tokenValue(':root { --navy: #0B2545; }', 'navy')).toBe('#0B2545');
    expect(() => tokenValue(':root { --gold: #C9A227; }', 'navy')).toThrow(/navy/);
  });
});
