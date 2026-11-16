import en from './en.json';
import zh from './zh.json';

export type Lang = 'en' | 'zh';
export type Key = keyof typeof en;

const DICT: Record<Lang, Record<Key, string>> = { en, zh };

export const LANGS = {
  en: { path: '/', htmlLang: 'en', label: 'EN' },
  zh: { path: '/zh/', htmlLang: 'zh-Hans', label: '中文' },
} as const satisfies Record<Lang, { path: string; htmlLang: string; label: string }>;

export function t(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  return DICT[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'zh' : 'en');
