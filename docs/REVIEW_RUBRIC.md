# Review rubric

The fixed checklist an independent reviewer (an agent or person who did not write the change)
applies to every pull request, from `docs/HARNESS.md` section 6. Answer each item yes or no, with
the file and line for every "no". **Verdict: zero findings, or blocked.** The verdict comment
reads `Reviewed <short sha>. Verdict: zero findings.` and names the head commit it reviewed. A
reviewer who finds a new class of problem adds a line here and a check to CI.

1. **Net lines stated.** Does the PR body give net lines added and removed, with a reason if positive?
2. **Nothing like it exists.** Was `src/components`, `src/styles` and `src/i18n` searched before adding a component, style or helper?
3. **Nothing copied.** No block of 10 or more lines repeated; the jscpd count not raised?
4. **Dead code deleted.** Are exports, files, styles and strings this change made unused removed, and the knip count not raised?
5. **Tokens and strings.** Do colours come from `src/styles/tokens.css` and every visible string from both i18n files (`en.json`, `zh.json`), with no raw colour added outside a recorded reason?
6. **No customer, no people.** Is the customer unnamed everywhere, with no worker name or face, price, client logo, testimonial or real system screenshot?
7. **Facts and contacts exact.** Do numbers and contact values match the plan index's Global Constraints character for character?
8. **Works without the extras.** Does the page read, and every contact link work, with JavaScript off and with reduced motion?
9. **Errors are not swallowed.** Does every `catch` or failure callback leave a visible fallback, with a comment saying which?
10. **Tests fail without the change.** Does the PR add or change a test that fails on the old code, named in the PR, with no `.skip` or `.only`?
11. **Edges named.** Does the PR body list the edge cases it meets (320 px, Chinese wrapping, deep links, no JavaScript) and the test for each?
12. **No secrets, no third-party code.** No key, token or `.env` value committed; no script, font or tracker loaded from another site?
13. **Pinned.** Is every new dependency an exact version, and every action a major tag?
14. **CI green on the reviewed commit.** Are `site` and `quality` green on the exact head sha in the verdict?
