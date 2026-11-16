import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';

// Values that are the same in both languages on purpose (numbers, the company name).
const SAME_OK = new Set(['footer.rights', 'numbers.since.value', 'numbers.workers.value', 'numbers.turnaround.value']);

describe('i18n strings (gate 2)', () => {
  it('English and Chinese have the same keys', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
  it('no value is empty', () => {
    for (const [k, v] of [...Object.entries(en), ...Object.entries(zh)]) expect(v.trim(), k).not.toBe('');
  });
  it('Chinese is translated, not copied', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) if (!SAME_OK.has(k)) expect(zh[k], k).not.toBe(en[k]);
  });
  it('placeholders match', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(zh[k].match(/\{\w+\}/g) ?? [], k).toEqual(en[k].match(/\{\w+\}/g) ?? []);
    }
  });
});
