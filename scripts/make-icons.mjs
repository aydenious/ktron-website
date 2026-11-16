// Renders src/brand/icon.svg into the favicon set in public/. Run after changing the icon:
//   node scripts/make-icons.mjs
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { pngsToIco } from './ico.mjs';

const svg = await readFile('src/brand/icon.svg');
const png = (size) => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();

await writeFile('public/favicon-32.png', await png(32));
await writeFile('public/apple-touch-icon.png', await png(180));
await writeFile('public/icon-512.png', await png(512));
const icoImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
await writeFile('public/favicon.ico', pngsToIco(icoImages));
await copyFile('src/brand/icon.svg', 'public/favicon.svg');

