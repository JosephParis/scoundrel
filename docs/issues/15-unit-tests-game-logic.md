---
id: 15
title: "No unit tests over ~100KB of game logic"
priority: P3
area: testing
effort: L
status: open
---

## Problem

There is no unit test runner in the project — no vitest, no jest, nothing in
`package.json` scripts. `npm run test` runs Playwright. Every existing test is a
screenshot comparison or a responsive-layout assertion:

- `visual/screens.spec.js` — 6 screenshots (one skipped)
- `visual/mobile-responsive-simple.spec.js` — 12 layout tests
- `visual/mobile-responsive.spec.js`
- `visual/tutorial-walkthrough.spec.js`

Meanwhile the rules engine is entirely uncovered:

| File | Size |
|---|---|
| `src/games/scoundrel/logic/combat.js` | ~37 KB |
| `src/games/scoundrel/logic/lifecycle.js` | ~28 KB |
| `src/games/scoundrel/logic/sanctuary.js` | ~22 KB |
| `src/games/scoundrel/logic/deck.js` | ~12 KB |
| `src/games/scoundrel/history.js`, `themes.js`, `boons.js`, `ascensions.js` | — |

A rules regression — wrong damage, a boon that stops applying, a forge edit that
corrupts the kit — ships completely invisibly. A screenshot test will not catch
any of it.

## Why this is the highest-value item after the P0s

Three reasons specific to where this project is:

1. **The code is already built for it.** The `logic/` modules are pure functions
   with injected RNG (`shuffle(arr, rng = Math.random)` is the pattern
   throughout). No React, no storage, no mocking required. `history.js`'s own
   docstring advertises this: "No React, no storage, no side effects: easy to
   test."
2. **You are about to change balance repeatedly.** Issue 13 opens a measurement
   window whose whole purpose is retuning numbers. Retuning without tests means
   each balance pass risks a silent rules break, and you won't be able to tell a
   balance change from a bug in the resulting data.
3. **Several other issues in this backlog want tests as their acceptance
   criteria** — issue 09 (the dedupe key divergence) is the clearest case: one
   test asserting all four key implementations agree would have caught it.

## Suggested fix

Add vitest — it shares Vite's config and transform pipeline, so setup is near
zero for this project.

```
npm i -D vitest
```

Add `"test:unit": "vitest run"` and `"test:watch": "vitest"`, keeping
`"test"` as Playwright or making it run both.

Priority order for coverage — highest risk-per-line first:

1. **`combat.js`** — damage resolution, weapon durability, trait interactions,
   inscribed frame effects. Largest file, most rules, most arithmetic.
2. **`logic/sanctuary.js`** — forge batch generation and `applyForgeEdit`. Just
   received the `forgeInscribedIds` fix in issue 05; that invariant (a card
   minted this visit can't be upgraded this visit) is exactly a unit test.
3. **`lifecycle.js`** — `createRun` initial state, `descend`, `endDescentVictory`,
   sigil accrual against `SIGIL_TARGET = 10`.
4. **`themes.js`** — `pickThemeId` no-repeat behavior and both fallback tiers
   (also new in issue 05). Feed it a seeded RNG and assert no run-level repeat,
   plus that it always returns *something* when the pool is exhausted.
5. **`deck.js`** — `buildBaseDeck` (44 cards), `buildStartingKit` (the "low ten"),
   `shuffle` determinism under a seeded RNG.
6. **`history.js`** — `buildRunRecord` shape at `RECORD_VERSION = 7`,
   `leaderboardName` clamping, `computeLifetimeStats` aggregation.
7. **The dedupe keys** — one test across `merge.js`, `runsTable.js`,
   `historyStore.js`, `cloudSync.js` (issue 09).

Then wire `test:unit` into `.github/workflows/ci.yml` (see issue 24, which
untangles the duplicated workflows).

Don't chase a coverage number. Target the arithmetic and the state transitions —
that's where a silent regression actually costs you.

## Acceptance criteria

- [ ] vitest installed; `npm run test:unit` runs
- [ ] `combat.js` damage and durability paths covered
- [ ] `sanctuary.js` forge invariants covered, including no inscribe-then-upgrade in one visit
- [ ] `themes.js` no-repeat and both fallbacks covered under a seeded RNG
- [ ] Dedupe-key agreement test in place
- [ ] Unit tests run in CI on every push
