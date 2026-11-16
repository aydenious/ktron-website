// Renders src/brand/icon.svg into the favicon set in public/. Run after changing the icon:
// the apple-touch icon and icon-512 are flattened onto navy (iOS paints transparent corners black);
// the favicons stay transparent.
//   node scripts/make-icons.mjs
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { pngsToIco } from './ico.mjs';

const svg = await readFile('src/brand/icon.svg');
const NAVY = '#0B2545';
const png = (size, flatten = false) => {
  const image = sharp(svg, { density: 512 }).resize(size, size);
  return (flatten ? image.flatten({ background: NAVY }) : image).png().toBuffer();
};

await writeFile('public/favicon-32.png', await png(32));
await writeFile('public/apple-touch-icon.png', await png(180, true));
await writeFile('public/icon-512.png', await png(512, true));
const icoImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
await writeFile('public/favicon.ico', pngsToIco(icoImages));
await copyFile('src/brand/icon.svg', 'public/favicon.svg');

