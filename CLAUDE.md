# KTRON website

The marketing site for Ktron Engineering Enterprise at `ktron.my`: Astro, static output, English
at `/` and Chinese at `/zh/`, built and served by Cloudflare Pages. The spec and the plan live in
the private KTRON system repo (`docs/plans/2026-11-16-ktron-website-*.md` there).

## Harness (read first)

The owner's standing rules for how AI agents write code here are in `docs/HARNESS.md`. Read it
before planning or writing code. In short: a rule that matters is a check in CI, not a sentence;
counts only go down (`npm run quality`, counts in `scripts/quality-baseline.json`); every PR
states its net lines; every fix also adds a guard against its whole class. The gate map is
`docs/plans/2026-11-16-harness-plan.md`; the reviewer's checklist is `docs/REVIEW_RUBRIC.md`.

## Commands

npm ci · npm run dev · npm run check · npm run build · npm test · npm run quality · npm run verify

Run npm on Node 24, the version in `.nvmrc` and CI (`nvm use`, or put `~/.nvm/versions/node/v24.*/bin` first on
PATH). `.npmrc` sets `engine-strict`, so npm on another Node refuses to install: a lockfile written by another
npm fails `npm ci` in CI.

## Rules

- Never name a customer anywhere: pages, alt text, file names, commits, PR text.
- No real system screenshots, worker names or faces, prices, client logos or testimonials.
- This repo is public: no secrets, no `.env` values, and no self-hosted CI runner (HARNESS section 9).
- A task that adds a file a rule here should name adds the rule in the same commit.
- Merging is the owner's call. Merge with `gh pr merge <n> --squash --delete-branch --match-head-commit <sha>`
  only when no check is outside SUCCESS and the review verdict names that sha.
