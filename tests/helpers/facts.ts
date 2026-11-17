// Owner ruling 2026-11-17: 10x only. KTRON inspects under 10x microscopes; there is no 30x.
const ALLOWED = '10';
// A number, then x or × (English), or then 倍 (Chinese): a magnification claim.
const CLAIM = /(?<![\w.])(\d+(?:\.\d+)?)\s*(?:[x×](?!\w)|倍)/gi;

/** Every magnification claim in `text` other than 10x, as written. */
export function magnificationHits(text: string): string[] {
  return [...text.matchAll(CLAIM)].filter((m) => m[1] !== ALLOWED).map((m) => m[0]);
}
