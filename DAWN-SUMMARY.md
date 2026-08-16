# Dawn run — 2026-08-16

**Branch:** `dawn/2026-08-16` · **Issue picked:** [15 — No unit tests over ~100KB
of game logic](docs/issues/15-unit-tests-game-logic.md)

## Why this one

It is the only **L** in the backlog and the standing pick in
`~/.claude/projects.json`. It is also the only remaining item that is genuinely
interruption-safe: every test file that lands green is real progress that stands
on its own, so being killed mid-run costs at most one file. The alternatives
were disqualified rather than merely lower-value:

- **08** (moderation) needs a `blocked` column, i.e. a live schema change —
  exactly the half-finished state the run must not leave behind.
- **13** (verify `/api/stats` in prod) can only be done against production.
- **10**, **14**, **27** are all **S**; knocking out a handful of small items
  would waste the window this run exists to spend.

## What changed

**+187 unit tests, 84 → 302 total.** Every test lands green; each test file is
its own commit.

| Commit | File | Tests | Covers |
|---|---|---|---|
| `02d653d` | `test/deck.test.js` | 32 | the 44-card deck, the low-ten kit, the tier ceiling and ace-tier volume escalation, `applyMonsterMods`, seeded `shuffle`, the curated tutorial deck |
| `ca501a9` | `test/themes.test.js` | 31 | `pickThemeId` band selection, the 0.4 no-repeat rule across 50 seeded full runs, **both** fallback tiers, `resolveThemeChildren`, `getActiveThemes` |
| `721e28a` | `test/combat.test.js` | 78 | damage arithmetic and its ordering, weapon binding, durability, `applyHpLoss` (Numb / Twin Souls / Second Wind / death), the potion limit, tool cards, monster traits, refill and victory |
| `e88745c` | `test/sanctuary.test.js` | 37 | the Forge edit batch, the rank cap, the 0.4 inscribe-then-upgrade invariant, `pickBoon` |
| `db0b8f7` | `test/dedupeKeys.test.js` | 40 | all four run-dedupe implementations agree; `mergeProfiles` end to end |

`test/support/state.js` holds the shared fixtures: a seeded mulberry32 rng, a
scripted rng for pinning one probability branch, and the descent / sanctuary
state factories.

### A bug fixed along the way — issue 09, now closed

Issue 15's fifth acceptance criterion is a dedupe-key agreement test, and that
test cannot honestly pass while the keys disagree. `api/_lib/merge.js` keyed a
run on `accountId:startedAt` alone while the other three implementations folded
in `runSeed`, so two guest runs started in the same millisecond on two devices
— the exact case `runSeed` exists for — collapsed into one and a real run
vanished from synced history. Fixed, stale comment corrected, and the test
lands in the same commit per the project convention.

I did **not** collapse the four copies into one shared module, which issue 09
floats as the better fix. The client cannot import from `api/`, and the four
are not the same string anyway — `historyStore.js`'s bucket key legitimately
omits `accountId` because its buckets are already per-account. Each is now
exported instead, and the test asserts the property that matters: all four make
the same same-run / different-run call. **You might have decided differently
here** and moved the function into a tree both can reach.

## Test results

- `npm run test:unit` — **302 passed**, 10 files, sub-second.
- `npm run lint` — clean.
- `npm run build` — clean.
- `npm run test:e2e` — **not run.** Playwright needs browsers and a dev server;
  nothing on this branch touches the UI, so the risk of a change here breaking
  it is close to nil, but it is genuinely unverified.

## Issue 15 acceptance criteria

- [x] vitest installed; `npm run test:unit` runs — already true, landed with issue 07
- [x] `combat.js` damage and durability paths covered
- [x] `sanctuary.js` forge invariants, including no inscribe-then-upgrade in one visit
- [x] `themes.js` no-repeat and both fallbacks under a seeded RNG
- [x] Dedupe-key agreement test in place
- [x] Unit tests run in CI on every push — already wired into `ci.yml`'s
  `lint-and-build` job. **Caveat:** that workflow only triggers on `main`,
  `master` and `develop`, so a push to a `dawn/*` branch runs no CI at all.
  Pre-existing, and widening it belongs with issue 24.

## What is left

Two of the issue's seven suggested targets have no tests yet. Neither is an
acceptance criterion, so **15 is marked `done`** — but if you want the coverage:

- **`lifecycle.js`** (~28 KB) — `createRun` initial state, `descend`,
  `endDescentVictory`, sigil accrual against `SIGIL_TARGET = 10`. The biggest
  remaining gap, and the one a balance pass is most likely to break.
- **`history.js`** — `buildRunRecord` shape at `RECORD_VERSION = 7`,
  `leaderboardName` clamping, `computeLifetimeStats`.

Obvious next step is `test/lifecycle.test.js`, which `test/support/state.js` is
already set up for.

## One more thing

The `sigil-issue` skill that `dawn-run` defers to for the real procedure **does
not exist on disk** — `~/.claude/skills/` holds only `dawn-run` and
`limit-window`. I followed `docs/issues/README.md`'s own "How to work an issue"
and testing-convention sections instead, which appear to cover the same ground.
Worth either writing the skill or dropping the reference.
