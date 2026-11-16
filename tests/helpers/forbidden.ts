import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// SHA-256 of forbidden lower-case words. Never write the words themselves in this repo.
export const FORBIDDEN: ReadonlySet<string> = new Set([
  '7ff26ca7636fecde95757c88c79117cd5733344dce935994ba0683bd8ae30471',
]);

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const MIN_PART = 4;
const MAX_PART = 16;

/** Candidates to hash: tokens, joins of 2-3 adjacent tokens, and every 4-16 character slice of those. */
function candidates(text: string, seen: Set<string>): Set<string> {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const whole = new Set(tokens);
  tokens.forEach((_, i) => {
    if (i + 1 < tokens.length) whole.add(tokens[i] + tokens[i + 1]);
    if (i + 2 < tokens.length) whole.add(tokens[i] + tokens[i + 1] + tokens[i + 2]);
  });
  const all = new Set(whole);
  for (const w of whole) {
    for (let len = MIN_PART; len <= Math.min(MAX_PART, w.length - 1); len++) {
      for (let at = 0; at + len <= w.length; at++) all.add(w.slice(at, at + len));
    }
  }
  for (const c of all) if (seen.has(c)) all.delete(c);
  for (const c of all) seen.add(c);
  return all;
}

/**
 * The hashes of forbidden words found in `text`, as `sha:<first 8 hex>` (never the word).
 * Text is NFKC-normalised and lower-cased; a tag is removed (so a name split by a tag rejoins)
 * and also turned into a space (so separate words stay separate); both readings are checked.
 */
export function forbiddenHits(text: string, hashes: ReadonlySet<string> = FORBIDDEN): string[] {
  const plain = text.normalize('NFKC');
  const found = new Set<string>();
  const seen = new Set<string>();
  for (const view of [plain.replace(/<[^>]*>/g, ''), plain.replace(/<[^>]*>/g, ' '), plain]) {
    for (const cand of candidates(view, seen)) {
      const h = sha(cand);
      if (hashes.has(h)) found.add(`sha:${h.slice(0, 8)}`);
    }
  }
  return [...found];
}

/** Text of a file, or null when it is binary (a NUL byte in the first 8 KB). */
export function textOf(file: string): string | null {
  const buf = readFileSync(file);
  return buf.subarray(0, 8192).includes(0) ? null : buf.toString('utf8');
}
