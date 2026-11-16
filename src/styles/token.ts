/** The value declared for `--name` in a CSS file's text; throws when the token is missing. */
export function tokenValue(css: string, name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
  if (value === undefined) throw new Error(`Token --${name} is not declared`);
  return value;
}
