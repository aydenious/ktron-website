import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const site = ci.slice(ci.indexOf('\n  site:'), ci.indexOf('\n  quality:'));
const at = (step: string) => site.indexOf(`- run: ${step}`);

// GitHub pastes a `${{ }}` expression into the shell script before it runs, so a value with shell
// syntax in it becomes code. Every expression a step needs goes through `env:` instead.
it('no run step has a ${{ }} expression in its script', () => {
  const scripts = ci.split('\n').reduce<{ out: string[]; indent: number }>(
    (acc, line) => {
      const indent = line.search(/\S/);
      if (acc.indent >= 0 && indent > acc.indent) acc.out.push(line);
      else acc.indent = -1;
      const m = /^(\s*)(- )?run:(.*)$/.exec(line);
      if (m) {
        acc.out.push(m[3]);
        acc.indent = m[1].length + (m[2] ? 2 : 0);
      }
      return acc;
    },
    { out: [], indent: -1 },
  ).out;
  expect(scripts.length).toBeGreaterThan(5);
  expect(scripts.filter((l) => l.includes('${{'))).toEqual([]);
});

it('every command in npm run verify is a CI step', () => {
  const verify: string = JSON.parse(readFileSync('package.json', 'utf8')).scripts.verify;
  for (const cmd of verify.split('&&').map((s) => s.trim())) expect(ci, cmd).toContain(`- run: ${cmd}`);
});

describe('the browser and Lighthouse gates run in CI, after the build', () => {
  const STEPS = ['npm run build', 'npx playwright install --with-deps chromium webkit', 'npx playwright test', 'npx lhci autorun'];
  it.each(STEPS)('the site job has the step: %s', (step) => expect(at(step), step).toBeGreaterThan(-1));
  it('in order: build, then install, then the Playwright suite, then Lighthouse', () => {
    const order = STEPS.map(at);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('the Playwright step runs every project (no --project filter, so WebKit runs on CI)', () => {
    expect(site).not.toMatch(/playwright test[^\n]*--project/);
  });
  it('a failed run uploads the reports, including the hidden .lighthouseci folder', () => {
    const upload = site.slice(site.indexOf('actions/upload-artifact@v4'));
    expect(site).toMatch(/- if: failure\(\)\n\s+uses: actions\/upload-artifact@v4/);
    expect(upload).toContain('.lighthouseci/');
    expect(upload).toContain('playwright-report/');
    expect(upload).toContain('include-hidden-files: true');
  });
});
