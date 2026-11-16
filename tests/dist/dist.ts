import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';

export const DIST = 'dist';
if (!existsSync(DIST)) throw new Error('Run `npm run build` before the dist tests.');

/** '/zh/' → dist/zh/index.html, '/404.html' → dist/404.html */
export function page(path: string): HTMLElement {
  const file = path.endsWith('.html') ? join(DIST, path) : join(DIST, path, 'index.html');
  return parse(readFileSync(file, 'utf8'));
}

export const distFiles = () => readdirSync(DIST, { recursive: true }).map(String);
