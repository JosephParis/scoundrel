---
id: 15
title: "No unit tests over ~100KB of game logic"
priority: P3
area: testing
effort: L
status: done
branch: dawn/2026-08-16
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

- [x] vitest installed; `npm run test:unit` runs
- [x] `combat.js` damage and durability paths covered
- [x] `sanctuary.js` forge invariants covered, including no inscribe-then-upgrade in one visit
- [x] `themes.js` no-repeat and both fallbacks covered under a seeded RNG
- [x] Dedupe-key agreement test in place
- [x] Unit tests run in CI on every push

## Resolution (2026-08-16, `dawn/2026-08-16`)

**84 -> 302 unit tests.** Five new files, each self-contained and committed on
its own, over the shared fixtures in `test/support/state.js` (seeded
mulberry32 rng, a scripted rng for pinning one probability branch, and the
descent/sanctuary state factories):

| File | Tests | Covers |
|---|---|---|
| `test/deck.test.js` | 32 | the 44-card deck, the low-ten kit, the tier ceiling and ace-tier volume escalation, `applyMonsterMods`, seeded `shuffle`, the tutorial deck |
| `test/themes.test.js` | 31 | band selection, the 0.4 no-repeat rule across 50 seeded full runs, both fallback tiers, `resolveThemeChildren`, `getActiveThemes` |
| `test/combat.test.js` | 78 | damage arithmetic *and its ordering*, weapon binding, durability, `applyHpLoss`, the potion limit, tool cards, traits, refill/victory |
| `test/sanctuary.test.js` | 37 | the Forge edit batch, the rank cap, the 0.4 inscribe-then-upgrade invariant, `pickBoon` |
| `test/dedupeKeys.test.js` | 40 | all four dedupe implementations agree; `mergeProfiles` end to end |

The combat tests deliberately play through the real entry points (`playCard`,
`playCardBare`, `applyHpLoss`) rather than the private damage helper, so the
*order* of the reductions is covered as well as each one.

The dedupe-key criterion could not be met honestly while the keys disagreed, so
**issue 09 was fixed in the same change** and is now closed.

Unit tests were already wired into `ci.yml`'s `lint-and-build` job (they landed
with issue 07). Note that workflow only triggers on `main` / `master` /
`develop`, so pushes to other branches run no CI — pre-existing, and widening it
belongs with issue 24.

### Left uncovered

Suggested targets 3 and 6, neither of which is an acceptance criterion:

- **`lifecycle.js`** (~28 KB) — `createRun` initial state, `descend`,
  `endDescentVictory`, sigil accrual against `SIGIL_TARGET = 10`. The largest
  remaining gap and the one a balance pass is most likely to break.
- **`history.js`** — `buildRunRecord` shape at `RECORD_VERSION = 7`,
  `leaderboardName` clamping, `computeLifetimeStats`.
