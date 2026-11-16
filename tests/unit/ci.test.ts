import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('every command in npm run verify is a CI step', () => {
  const verify: string = JSON.parse(readFileSync('package.json', 'utf8')).scripts.verify;
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const cmd of verify.split('&&').map((s) => s.trim())) expect(ci, cmd).toContain(`- run: ${cmd}`);
});
