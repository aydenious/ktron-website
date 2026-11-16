// Usage: node scripts/import-photo.mjs <id> <downloaded-file> <source-url> <author> <licence>
// Re-encodes the download (which drops EXIF, GPS, XMP and IPTC), caps the width at 2000 px,
// records the credit, and rewrites CREDITS.md from credits.json.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const IDS = ['hero', 'trimming', 'deflashing', 'inspection', 'sorting', 'rework', 'quality'];
const [id, file, source, author, licence] = process.argv.slice(2);
if (!IDS.includes(id) || !file || !source || !author || !licence) {
  console.error('usage: import-photo.mjs <id> <file> <source-url> <author> <licence>');
  process.exit(2);
}
const input = sharp(file, { failOn: 'error', limitInputPixels: 60_000_000 });
const { width, format } = await input.metadata();
if (!['jpeg', 'png', 'webp'].includes(format)) throw new Error(`${file}: ${format} is not a photo format`);
if (width < 1200) throw new Error(`${file}: ${width} px wide; need at least 1200`);
await input.rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true })
  .toFile(`src/assets/photos/${id}.jpg`);

const path = 'src/assets/photos/credits.json';
const credits = JSON.parse(await readFile(path, 'utf8'));
credits[id] = { source, author, licence };
const sorted = Object.fromEntries(IDS.filter((k) => credits[k]).map((k) => [k, credits[k]]));
await writeFile(path, JSON.stringify(sorted, null, 2) + '\n');

const rows = Object.entries(sorted).map(([k, c]) => `| \`${k}.jpg\` | ${c.author} | [source](${c.source}) | ${c.licence} |`);
await writeFile('CREDITS.md', [
  '# Credits', '',
  'Photos on ktron.my. Each is used under the licence named; none shows a customer, a worker or a part number.', '',
  '| File | Author | Source | Licence |', '|---|---|---|---|', ...rows, '',
  'Logo, icons and illustrations: KTRON, all rights reserved.', '',
].join('\n'));
console.log(`${id}: imported (${width} px source)`);
