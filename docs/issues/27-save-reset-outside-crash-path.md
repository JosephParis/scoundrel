---
id: 27
title: "No save reset for a run that gets stuck without crashing"
priority: P2
area: product
effort: S
status: done
---

## Problem

Issue 02 added a "Discard the current run" button, but it only exists on the error
boundary's recovery screen — which requires the app to actually **throw**.

A run that becomes *unwinnable or unplayable without crashing* has no escape
hatch:

- **Retire** requires a live run (`phase` of `sanctuary` or `descent`).
- **Begin Again** requires a terminal phase (`victory` / `gameover`).
- `HomeView` has no Settings entry at all — menu items are Resume, How to play,
  Run history, Leaderboard, Tutorial, Credits.
- `SettingsModal` has no reset: it covers card layout, music/sfx volume, and the
  leaderboard handle.

So a player stuck in a state the UI renders but cannot advance — a phase the
buttons don't handle, a forge batch that won't clear, a descent with no legal move
— has to clear localStorage by hand. A batch-1 user will not do that; they will
close the tab.

This is the more likely of the two failure modes. A hard crash is loud and
obvious; a soft stick is quiet and just looks like the game is broken.

## Suggested fix

Add a confirm-gated reset to `SettingsModal`:

- Two-step, since it is destructive: a "Discard current run" button that swaps to
  "Are you sure? This cannot be undone" before acting.
- Clear `scoundrel:save` only, matching `ErrorBoundary`'s scope — history, handle,
  settings and session preserved. Say so in the copy, as the recovery screen does.
- Then either reload, or call the same fresh-run path `freshRun()` provides so the
  player lands in a new opening sanctuary without a page load.

Also worth fixing while here: **`HomeView` has no route to Settings**, so on
mobile the reset would only be reachable from the in-run overflow menu. Add
Settings (and probably Send feedback) to the home menu — both are currently
reachable only from `TopBar`.

Reuse the existing helper rather than duplicating the key: consider exporting the
discard logic from one place so `ErrorBoundary` and `SettingsModal` cannot drift
about which keys they clear.

## Testing

Per the project convention, land the test with the fix. This one does **not** need
a production build, so it belongs in a `dev`-project spec:

- Seed a save, open Settings, confirm the two-step, assert `scoundrel:save` is
  gone and unrelated keys (`scoundrel:handle`, `scoundrel:tutorialCompleted`)
  survive.
- Assert the first click alone does **not** clear anything.
- Assert Settings is reachable from `HomeView`.

Note that a test which mutates a localStorage key must set it via
`page.evaluate` after the first load, not `addInitScript` — the latter re-runs on
every navigation and will resurrect the key after a reload.

## Acceptance criteria

- [x] A reset exists in `SettingsModal`, behind a confirm step
- [x] It clears only `scoundrel:save`; history, handle, settings and sign-in survive
- [x] Settings is reachable from `HomeView`
- [x] Discard-key logic shared with `ErrorBoundary` rather than duplicated
- [x] Tests land in the same change

## Resolution (branch `dawn/2026-08-27`)

`src/utils/discardRun.js` now owns `SAVE_KEY` and `discardSavedRun()`;
`ErrorBoundary` and the new `DiscardRunSection` in `SettingsModal` both call it,
so they cannot disagree about what a discard clears.

The reset **reloads** rather than calling `freshRun()`. The modal has no handle
on game state, and a reload also clears whatever in-memory state was part of the
stick — which is the failure mode this exists for. One consequence worth knowing
for anyone testing it: the app writes a fresh opening-sanctuary save on load, so
`scoundrel:save` is repopulated within the same tick. The assertion that means
anything is that the stored phase is no longer the stuck run's, not that the key
is absent. `visual/save-reset.spec.js` is written that way.

`HomeView` gained **Settings** and **Send feedback**. Feedback is gated on
`IS_STANDALONE`, matching `TopBar` — it posts to `/api`, which the standalone
build cannot reach. Settings is offered unconditionally.

No balance change, so `GAME_VERSION` stays `0.4`.
