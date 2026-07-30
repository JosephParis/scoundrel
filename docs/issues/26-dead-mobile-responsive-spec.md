---
id: 26
title: "All 25 tests in mobile-responsive.spec.js are dead and burn 12.5 minutes failing"
priority: P1
area: testing
effort: M
status: open
---

## Problem

Every test in `visual/mobile-responsive.spec.js` fails. All 25 of them, 100% of
the time, each on a 30-second timeout — **12.5 minutes to produce nothing but
failures.**

They all die on the same line:

```js
await page.getByRole('button', { name: /Begin/i }).click()
```

There is no "Begin" button anywhere in `src/`. The spec was written against an
older opening flow and was never updated. `/Begin/i` appears 22 times in this one
file, so the breakage is total rather than incidental.

## Evidence

Sample failure, repeated 25 times:

```
Test timeout of 30000ms exceeded.
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Begin/i })
   at visual/mobile-responsive.spec.js:24:56
```

Grep confirms the selector has no counterpart in the app:

- `/Begin/` — 22 occurrences in `visual/mobile-responsive.spec.js`, 1 in
  `visual/MOBILE_TESTS_README.md`, **0 in `src/`**
- `"Skip tutorial"` (the next line in each test) does still exist, at
  `src/games/scoundrel/components/SanctuaryView.jsx:209`

So the tests are only half-stale: the tutorial step is still valid, the entry
point is not.

## Why this is P1 rather than a testing chore

1. **It hides the state of the suite.** `npm run test` appears to hang. It isn't
   hanging — it is grinding through 25 sequential 30s timeouts. Anyone running
   the full suite gives up before it finishes, which means *nobody runs the full
   suite*, which means the tests that do work aren't protecting anything either.
2. **CI is almost certainly red on main.** `.github/workflows/ci.yml` has an
   `all-tests` job restricted to main/master. If it runs the full `testDir`, it
   has been failing on every push to main. If it has been green, that is worth
   understanding — it would mean the job isn't running what it claims to.
3. **It makes the "write the test alongside the fix" workflow unworkable.** If
   the suite can't be run to completion in reasonable time, per-issue test
   additions can't be validated against it.

## Suggested fix

Decide between repair and deletion — do not leave it as-is.

**Repair** (preferred if the assertions are still meaningful): these 25 tests
cover real things — no vertical scrollbar during descent, room cards visible
without scrolling, kit modal open/Escape/click-outside, PhaseRail hidden on
mobile, flee button reachable, sanctuary header compaction. That is good coverage
of exactly what a first batch of mobile users will hit. Replace the opening
sequence with whatever currently starts a run, and consider seeding state
directly via `addInitScript` the way `visual/screens.spec.js:19` does with
`seedOutcome()` — far more robust than driving the UI through several clicks.

**Delete** if the coverage is genuinely redundant against
`mobile-responsive-simple.spec.js` (12 tests, all passing). Deleting 25 dead
tests is strictly better than keeping them.

Either way:

- Drop the per-test timeout for this file, or add `test.setTimeout()`, so a
  future break fails fast instead of costing 30s per case.
- Update `visual/MOBILE_TESTS_README.md`, which documents the `/Begin/` flow.
- Re-check `.github/workflows/ci.yml`'s `all-tests` job against reality (issue 24
  consolidates those workflows).

## Acceptance criteria

- [ ] `npx playwright test` completes without any 30s selector timeouts
- [ ] Every remaining test in `visual/` either passes or is explicitly `test.skip` with a reason
- [ ] `mobile-responsive.spec.js` is repaired or removed, with the decision recorded
- [ ] `MOBILE_TESTS_README.md` matches the tests that actually exist
- [ ] Confirmed whether CI's `all-tests` job has been failing, and for how long
