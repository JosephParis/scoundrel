---
id: 05
title: "Commit or shelve the 4-file uncommitted working tree"
priority: P0
area: process
effort: S
status: done
---

## Resolution

Landed as two commits on `leaderboard-fastest-times`, in the order this issue
specified (gameplay first, since the DevModal override depends on the new
`createRun` shape):

- `5992cab` — `themes.js`, `logic/lifecycle.js`, `logic/sanctuary.js`, `constants.js`
- `0706ccd` — `components/modals.jsx`

**`GAME_VERSION` was bumped to `0.4`** (appended to `VERSION_HISTORY`, with a
comment recording why). Both gameplay changes alter the distribution of what a
run faces — run-level theme no-repeat changes which Trials appear, and blocking
inscribe-then-upgrade removes a power play — so runs before and after are not
comparable. `constants.js` explicitly instructs appending on "a retuned theme,"
which this is. Reversible if it turns out to be over-cautious: remove the entry.

Verified: `git status` clean, `npm run lint` clean, `npm run build` clean, and
`visual/mobile-responsive-simple.spec.js` + `visual/screens.spec.js` passing
(18 passed, 1 pre-existing skip: `card-library`, see issue 12).

## Problem

Four files carry uncommitted changes (~88 insertions / 29 deletions). All four
look complete and correct, but launching from a dirty tree means the deployed
build doesn't match any commit — and if one of these is reverted by accident, the
bug it fixes comes back silently.

**Do this first.** Every other issue in this backlog edits code, and unrelated
WIP in the tree makes those changes hard to review or revert independently.

## Evidence

Changed files and what they do:

1. **`src/games/scoundrel/themes.js`** — `pickThemeId(rng, sigils, exclude)` now
   takes an array of every theme faced this run, giving run-level no-repeat. Has
   a relaxed fallback (never the theme just played) and a final fallback to the
   full pool, so it can't fail to return a theme.
2. **`src/games/scoundrel/logic/lifecycle.js`** — passes `state.themesFaced`
   into `pickThemeId`; adds `forgeInscribedIds: []` to `createRun` and resets it
   in `endDescentVictory`. (Verified: `descend()` pushes the theme *before*
   `endDescentVictory` reads it, so the ordering is right.)
3. **`src/games/scoundrel/logic/sanctuary.js`** — threads a `freshInscribes` /
   `exclude` list through `upgradeCandidates`, `rollForgeChoices`, and
   `initForgeBatch`; `applyForgeEdit` records each newly inscribed card's id so a
   single sanctuary visit can't mint a card and then immediately upgrade it.
4. **`src/games/scoundrel/components/modals.jsx`** — `DevModal` Long Night
   children move to a single `children` array with `seedChildren` / `setChildAt`
   that **swap** rather than duplicate. This fixes a real bug: a duplicated Tier 3
   child doubled every summed theme field (e.g. Blood Moon applied twice read as
   max HP −8). Dedupes via `[...new Set(...)]` and adds `forgeInscribedIds: []`
   to the applied override.

## Suggested fix

Split into two commits so they can be reverted independently — they are unrelated
changes that happen to share a tree:

- **Commit A** (gameplay): `themes.js`, `logic/lifecycle.js`,
  `logic/sanctuary.js` — run-level theme no-repeat + no inscribe-then-upgrade in
  one visit.
- **Commit B** (dev tool fix): `components/modals.jsx` — Long Night child
  duplication.

Note that `modals.jsx` also needs `forgeInscribedIds` in its override to stay
consistent with the new `createRun` shape, so commit A must land first.

Both change balance-relevant behavior, so consider whether `GAME_VERSION` in
`src/games/scoundrel/constants.js` should be bumped (`VERSION_HISTORY` is
currently `['0.1','0.2','0.3']`) — otherwise pre- and post-fix runs pool together
in `/api/stats`.

## Acceptance criteria

- [x] `git status` clean
- [x] `npm run lint` and `npm run build` clean
- [x] Playwright `screens` + `mobile-responsive-simple` pass (18 passed, 1 known skip)
- [x] Explicit decision recorded on whether `GAME_VERSION` was bumped, and why
