/** Measures positions again once web fonts have loaded, if they had not when the first measure was taken. */
export function refreshWhenFontsSettle(fonts: { status: string; ready: Promise<unknown> }, refresh: () => void): void {
  if (fonts.status === 'loaded') return;
  void fonts.ready.then(refresh);
}
