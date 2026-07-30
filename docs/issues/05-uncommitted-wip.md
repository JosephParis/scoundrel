---
id: 05
title: "Commit or shelve the 4-file uncommitted working tree"
priority: P0
area: process
effort: S
status: open
---

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

- [ ] `git status` clean
- [ ] `npm run lint` and `npm run build` clean
- [ ] `npm run test` passes
- [ ] Explicit decision recorded on whether `GAME_VERSION` was bumped, and why
