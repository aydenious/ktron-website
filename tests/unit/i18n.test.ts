import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';

// Values that are the same in both languages on purpose (numbers, the company name).
const SAME_OK = new Set(['footer.rights', 'numbers.since.value', 'numbers.turnaround.value']);

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
  it('Chinese spacing: one space around Latin letters, none around digits', () => {
    const HAN = '\\p{Script=Han}';
    const bad = [
      new RegExp(`(?<=${HAN})(?=[A-Za-z])|(?<=[A-Za-z])(?=${HAN})`, 'u'), // Han touching Latin
      new RegExp(`(?<=${HAN})\\s{2,}(?=[A-Za-z])|(?<=[A-Za-z])\\s{2,}(?=${HAN})`, 'u'), // more than one space
      new RegExp(`(?<=${HAN})\\s+(?=\\d)|(?<=\\d)\\s+(?=${HAN})`, 'u'), // space between Han and a digit
    ];
    const offenders = Object.entries(zh)
      .map(([k, v]) => [k, v.replace(/\{\w+\}/g, '0')] as const) // a placeholder stands for a number
      .filter(([, v]) => bad.some((re) => re.test(v)))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });
  it('Chinese copy rulings', () => {
    expect(en['numbers.since.label']).toBe('the year we started');
    expect(zh['numbers.since.label']).toBe('创立年份');
    expect(zh['numbers.workers.value']).toBe('20–25名');
    expect(zh['numbers.workers.label']).toBe('熟练居家工人');
    expect(zh['faq.3.q']).toBe('如果我们把批次退回给贵公司呢？');
    expect(zh['trace.mock.control']).toBe('控制编号');
    expect(zh['nav.trace']).toBe('批次追溯');
    // Retired terms: one word per idea across the whole page.
    const RETIRED = ['手工具', '控制号'];
    const hits = Object.entries(zh).filter(([, v]) => RETIRED.some((t) => v.includes(t))).map(([k]) => k);
    expect(hits).toEqual([]);
  });
});
