# Dawn run — 2026-08-16

**Branch:** `dawn/2026-08-16` · **Issue picked:** [15 — No unit tests over ~100KB
of game logic](docs/issues/15-unit-tests-game-logic.md), which also closed
[09](docs/issues/09-merge-runseed-dedupe-bug.md).

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

**Unit tests 84 → 391.** All seven coverage targets the issue names are now
done, not just the six the acceptance criteria required. One commit per file.

| Commit | File | Tests | Covers |
|---|---|---|---|
| `02d653d` | `test/deck.test.js` | 32 | the 44-card deck, the low-ten kit, the tier ceiling and ace-tier volume escalation, `applyMonsterMods`, seeded `shuffle`, the curated tutorial deck |
| `ca501a9` | `test/themes.test.js` | 31 | band selection, the 0.4 no-repeat rule across 50 seeded full runs, **both** fallback tiers, `resolveThemeChildren`, `getActiveThemes` |
| `721e28a` | `test/combat.test.js` | 78 | damage arithmetic *and its ordering*, weapon binding, durability, `applyHpLoss`, the potion limit, tool cards, monster traits, refill and victory |
| `e88745c` | `test/sanctuary.test.js` | 37 | the Forge edit batch, the rank cap, the 0.4 inscribe-then-upgrade invariant, `pickBoon` |
| `db0b8f7` | `test/dedupeKeys.test.js` | 40 | all four run-dedupe implementations agree; `mergeProfiles` end to end |
| `37ec809` | `test/lifecycle.test.js` | 56 | `createRun`, `descend`, `endDescentVictory` and sigil accrual, `endDescentDeath`, `retireRun`, `fleeRoom`, `getAscensionEffects` |
| `98be685` | `test/history.test.js` | 33 | `buildRunRecord` at `RECORD_VERSION = 7`, `leaderboardName` clamping, paused-time arithmetic, `computeLifetimeStats` |

`test/support/state.js` holds the shared fixtures: a seeded mulberry32 rng, a
scripted rng for pinning one probability branch, and the descent / sanctuary
state factories. The combat tests deliberately play through the real entry
points (`playCard`, `playCardBare`, `applyHpLoss`) rather than the private
damage helper, so the *order* of the reductions is covered as well as each one.

## Two bugs the tests turned up

**Issue 09 — the merge dedupe key, now closed.** `api/_lib/merge.js` keyed a run
on `accountId:startedAt` alone while the other three implementations folded in
`runSeed`. Two guest runs started in the same millisecond on two devices — the
exact case `runSeed` exists for — collapsed into one and a real run vanished
from synced history. I fixed it rather than writing a test that documents the
divergence, because issue 15's fifth acceptance criterion is an *agreement*
test and it cannot honestly pass while the keys disagree.

**`setRunMode` accepted a junk mode string.** Its guard was
`if (!getMode(modeId)) return state`, but `getMode` falls back to the default
mode and so never reports an unknown id. An unrecognized mode was stored on the
run and stamped into its history record. Guards on `MODES` now, with the test in
the same commit (`37ec809`).

## Decisions you might have made differently

- **I did not collapse the four dedupe-key copies into one shared module,**
  which issue 09 floats as the better fix. The client cannot import from `api/`,
  and the four are not the same string anyway — `historyStore.js`'s bucket key
  legitimately omits `accountId` because its buckets are already per-account.
  Each is exported instead, and the test asserts the property that matters: all
  four make the same same-run / different-run call. Moving the function into a
  tree both can reach is still the tidier end state.
- **I closed issue 09 inside issue 15's run** rather than leaving it open with a
  failing test. It is a one-line fix; the alternative was a criterion I could
  not tick.
- **I did not widen CI's branch filter.** `ci.yml` runs unit tests on push and
  PR, but only for `main` / `master` / `develop` — so nothing on this branch has
  been exercised by CI. Pre-existing, and widening it belongs with issue 24.

## Test results

- `npm run test:unit` — **391 passed**, 12 files, sub-second.
- `npm run lint` — clean.
- `npm run build` — clean.
- `npm run test:e2e` — **started but not confirmed.** A `--project=dev` run was
  launched in the background and had not reported by the time this was written,
  so treat the e2e half as unverified. Nothing on this branch touches the UI —
  the only non-test source changes are `merge.js`'s key, `cloudSync` /
  `historyStore` export keywords, and the `setRunMode` guard — so the risk is
  low, but it is genuinely unchecked. **Run `npm test` before merging.**

## What is left

Issue 15 is genuinely done: all six acceptance criteria are met and all seven of
its suggested targets have tests. Nothing is scaffolded-but-empty.

The obvious next items, unchanged by this run:

- **08** (moderation) is still the stated risk before inviting strangers.
- **13** is still the pre-launch gate, and now carries one more item: confirm no
  already-synced profile lost a run to the issue 09 bug before it was fixed.
  That needs the production database, which an unattended run must not touch.

## One more thing

The `sigil-issue` skill that `dawn-run` defers to for its real procedure **does
not exist on disk** — `~/.claude/skills/` holds only `dawn-run` and
`limit-window`. I followed `docs/issues/README.md`'s own "How to work an issue"
and testing-convention sections instead, which appear to cover the same ground.
Worth either writing the skill or dropping the reference.
