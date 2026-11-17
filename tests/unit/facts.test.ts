import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import zh from '../../src/i18n/zh.json';
import { magnificationHits } from '../helpers/facts';

// Owner ruling 2026-11-17: 10x only
describe('the magnification claim (a corrected fact must not come back)', () => {
  it.each(['30x', '30倍', '30 ×', '20X', '5x', '1.5x', '100倍', 'under 30x microscopes', '10x and 30x'])('the detector flags %s', (text) => {
    expect(magnificationHits(text), text).not.toEqual([]);
  });
  it.each(['10x', '10X', '10 x', '10×', '10倍', '10 倍', 'Checked under 10x microscopes', '0x1F', '010-545 4173', '2–3 working days'])(
    'the detector lets %s through',
    (text) => {
      expect(magnificationHits(text), text).toEqual([]);
    },
  );
  it('no string in the English or the Chinese text claims any other magnification', () => {
    const bad = Object.entries({ en, zh }).flatMap(([lang, strings]) =>
      Object.entries(strings).flatMap(([key, value]) => magnificationHits(value).map((hit) => `${lang} ${key}: ${hit}`)));
    expect(bad).toEqual([]);
  });
  it('the inspection copy says 10x', () => {
    expect(en['services.inspection.text']).toContain('10x');
    expect(zh['services.inspection.text']).toContain('10倍');
  });
});
