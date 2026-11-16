// Renders src/brand/icon.svg into the favicon set in public/. Run after changing the icon:
//   node scripts/make-icons.mjs
// The apple-touch icon and icon-512 are flattened onto navy (iOS paints transparent corners black);
// the favicons stay transparent. renderIcons is what the tests compare the committed files with.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { pngsToIco } from './ico.mjs';

const NAVY = '#0B2545';

/**
 * Renders the icon into every generated file.
 * @param {Buffer} svg the icon drawing
 * @returns {Promise<Record<string, Buffer>>} file path under the repo root to its bytes
 */
export async function renderIcons(svg) {
  const png = (size, flatten = false) => {
    const image = sharp(svg, { density: 512 }).resize(size, size);
    return (flatten ? image.flatten({ background: NAVY }) : image).png().toBuffer();
  };
  const icoImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
  return {
    'public/favicon-32.png': await png(32),
    'public/apple-touch-icon.png': await png(180, true),
    'public/icon-512.png': await png(512, true),
    'public/favicon.ico': pngsToIco(icoImages),
    'public/favicon.svg': svg,
  };
}

async function main() {
  const files = await renderIcons(await readFile('src/brand/icon.svg'));
  for (const [path, data] of Object.entries(files)) await writeFile(path, data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
