// Turns one logo concept into the final brand files, then rebuilds the favicon set.
//   npm run brand:pick a      (or b, c, d)
// The pick is recorded in src/brand/pick.json, which the brand page and the tests read.
// The one-colour versions follow one rule for every concept (plan Task 3, Step 4): every fill and
// stroke becomes the one colour, except a white knockout drawn with a stroke, which becomes a hole
// in itself (an inner subpath in the same d, fill-rule="evenodd"); painted flat it would merge with
// the artwork it is meant to stand clear of (concept C's inspection ring on the route).
// A white shape with no stroke has no ring width to cut, so the derivation stops and says so, and so
// does any white shape that is not a circle (a path, rect or polygon): painted flat it would merge.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const NAVY = '#0B2545';
export const WHITE = '#FFFFFF';
const PICKS = ['a', 'b', 'c', 'd'];
const CIRCLE = /<circle\b([^>]*)\/>/g;

/**
 * Paints a logo into one colour.
 * @param {string} svg the full-colour logo
 * @param {string} colour the single colour to keep
 * @returns {string}
 */
export function toMono(svg, colour) {
  const knockouts = [];
  const cut = svg.replace(CIRCLE, (element, attrs) => {
    if (!new RegExp(`\\bfill="${WHITE}"`, 'i').test(attrs)) return element;
    const attr = (name) => Number(attrs.match(new RegExp(`\\b${name}="([\\d.]+)"`))?.[1]);
    const strokeWidth = /\bstroke=/.test(attrs) ? attr('stroke-width') : 0;
    if (!strokeWidth) throw new Error(`pick-logo: ${element.trim()} is white with no stroke; a knockout needs a stroke to cut a hole`);
    const [cx, cy, r] = [attr('cx'), attr('cy'), attr('r')];
    const ring = (radius) => `M${round(cx - radius)} ${round(cy)}a${round(radius)} ${round(radius)} 0 1 0 ${round(2 * radius)} 0a${round(radius)} ${round(radius)} 0 1 0 ${round(-2 * radius)} 0Z`;
    knockouts.push(`<path fill="${WHITE}" fill-rule="evenodd" d="${ring(r + strokeWidth / 2)} ${ring(r - strokeWidth / 2)}"/>`);
    return `<!--knockout-${knockouts.length - 1}-->`;
  });
  const stray = cut.match(/<(?!!)[^>]*\bfill="#FFFFFF"[^>]*>/i);
  if (stray) throw new Error(`pick-logo: ${stray[0].trim()} is white and not a circle; only a stroked white circle can be cut into a hole`);
  return cut.replace(/<!--knockout-(\d+)-->/g, (_, i) => knockouts[i]).replace(/\b(fill|stroke)="(#[0-9A-Fa-f]+)"/g, (_, name) => `${name}="${colour}"`);
}

const round = (n) => Math.round(n * 100) / 100;

async function main() {
  const [pick] = process.argv.slice(2);
  if (!PICKS.includes(pick)) throw new Error(`brand:pick needs ${PICKS.join(', ')}; got ${pick ?? 'nothing'}`);
  const logo = await readFile(`src/brand/concepts/logo-${pick}.svg`, 'utf8');
  await writeFile('src/brand/pick.json', `${JSON.stringify({ pick })}\n`);
  await writeFile('src/brand/logo.svg', logo);
  await writeFile('src/brand/logo-navy.svg', toMono(logo, NAVY));
  await writeFile('src/brand/logo-white.svg', toMono(logo, WHITE));
  await copyFile(`src/brand/concepts/icon-${pick}.svg`, 'src/brand/icon.svg');
  await mkdir('public', { recursive: true });
  execFileSync(process.execPath, ['scripts/make-icons.mjs'], { stdio: 'inherit' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

