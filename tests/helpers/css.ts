import { readdirSync, readFileSync } from 'node:fs';

export type Rule = { file: string; selector: string; decl: Record<string, string> };
const walkFiles = (dir: string) => readdirSync(dir, { recursive: true }).map((f) => `${dir}/${f}`).filter((f) => /\.(astro|css)$/.test(f));
/** Every .css and .astro file under src. */
export const SOURCES = walkFiles('src');
export const read = (f: string) => readFileSync(f, 'utf8');

/** The rules of a source file: its .css text, or every <style> block of an .astro file. */
export function rulesOf(file: string, text = read(file)): Rule[] {
  const blocks = file.endsWith('.css') ? [text] : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  return blocks.flatMap((b) => [...b.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
    file, selector: sel.trim(),
    decl: Object.fromEntries(body.split(';').map((d) => d.split(/:(.*)/s).map((x) => x?.trim())).filter(([k, v]) => k && v)),
  })));
}
/** An .astro file without its frontmatter and style blocks. */
export const markupOf = (file: string) => read(file).replace(/^---[\s\S]*?\n---/, '').replace(/<style[\s\S]*?<\/style>/g, '');
