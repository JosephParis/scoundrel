---
id: 02
title: "Add an error boundary and an always-available save reset"
priority: P0
area: launch-blocker
effort: M
status: open
---

## Problem

Two related gaps that both end in "the user is stuck":

1. **No error boundary anywhere.** Neither `src/main.jsx` nor `src/App.jsx` wraps
   the tree. A single render throw produces a permanent white screen with no
   message and no recovery path.
2. **No unconditional save reset.** Retire requires a live run; "Begin Again"
   requires a terminal phase. A player whose save deserializes into a state the
   UI can't render has no in-app way out — they'd have to clear localStorage by
   hand, which a batch-1 user will not do.

## Evidence

- `src/main.jsx` — `PostHogContext.Provider` → `BrowserRouter` → routes, no boundary.
- `src/App.jsx` — lazy routes, no boundary.
- `src/games/scoundrel/index.jsx` — `loadSavedGame()` does version backfill but
  has no "save is unusable, discard it" branch.

## Why it blocks batch 1

This is the difference between "I hit a bug, reloaded, kept playing" and "the
game is broken, I'm done". With a small invited cohort you get one shot per
person. It also protects the feedback channel: a boundary can surface the error
and point at `FeedbackModal`, turning a crash into a bug report.

## Suggested fix

- Add an error boundary component (class component with
  `getDerivedStateFromError` / `componentDidCatch`) wrapping the routes in
  `App.jsx`. Render a readable fallback with: the error message, a Reload
  button, a "Report this" button that opens feedback, and a "Discard save and
  restart" button.
- Report the caught error to PostHog so crashes are visible without waiting for
  someone to write in.
- Wrap the `loadSavedGame()` body in try/catch; on throw, drop
  `scoundrel:save` and start fresh rather than propagating.
- Consider surfacing the same reset in Settings so it doesn't require a crash to
  reach (relates to issue 05's note that `HomeView` has no Settings entry).

## Acceptance criteria

- [ ] A deliberate throw inside the game tree renders the fallback, not a white screen
- [ ] Fallback offers reload, report, and discard-save
- [ ] A corrupt `scoundrel:save` value does not prevent the app from loading
- [ ] Caught errors reach PostHog
