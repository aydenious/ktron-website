# KTRON website

The static English and Chinese marketing site for KTRON Engineering Enterprise (ktron.my), covering its outsourced
post-molding work: one page per language (`/`, `/zh/`) built with Astro, with every visible string kept in
`src/i18n/`.

```bash
npm ci
npm run dev                 # http://localhost:4321
npm run check               # astro check (types)
npm run build               # dist/
npm test                    # vitest: tests/unit + tests/dist (needs dist/)
npx playwright test         # tests/e2e against `astro preview` on :4321
npx lhci autorun            # Lighthouse gates on dist/
npm run quality             # harness counts vs scripts/quality-baseline.json (may only fall)
npm run verify              # check + build + test + quality, the same commands CI runs
```

Spec and plan live in the KTRON system repo, `docs/plans/2026-11-16-ktron-website-*.md`.
