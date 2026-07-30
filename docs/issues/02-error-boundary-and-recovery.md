---
id: 02
title: "Add an error boundary and an always-available save reset"
priority: P0
area: launch-blocker
effort: M
status: done
---

## Resolution

`src/ErrorBoundary.jsx`, wired in `main.jsx` **inside** the PostHog provider (so
crashes can be reported) and **outside** `BrowserRouter` (so it also catches a
failed lazy route import, which `Suspense` does not).

Recovery screen offers three actions:

- **Reload** — the usual fix.
- **Discard the current run** — removes `scoundrel:save` only. Run history, the
  leaderboard handle, settings and the sign-in session are deliberately kept: a
  corrupt run is the likely cause, and wiping history to fix a crash would be a
  worse outcome than the crash. The screen says so explicitly.
- **Send a crash report** — POSTs message, stack and component stack to
  `/api/feedback` as `kind: 'bug'` via the existing `submitFeedback`. Done this
  way because `FeedbackModal` lives inside the tree that just crashed and cannot
  be relied on to open.

The error message is rendered on screen so a player can quote it.

### Correction to this issue's original claim

The write-up said to "wrap the `loadSavedGame()` body in try/catch". **It already
was** — `index.jsx` guards the whole body and returns `null`, so malformed JSON
has always been handled and never reaches the boundary. The real gap is a save
that *parses* and then throws during **render**. That case is covered, and there
is a concrete instance: `SanctuaryView` computes
`!game.boonChosen && game.boonOffers.length` unguarded, so a non-opening save
with `boonOffers: null` throws. That shape is now a test fixture.

### Test hook

`?crash=1` gives the boundary a deterministic trigger, gated behind
`isCrashTestRequested()` in `flags.js`, which requires `isDevToolsEnabled()` —
the same gate as the dev panel. A test asserts an ordinary production visitor
with `?crash=1` gets the game, not the recovery screen. Shipping a small gated
hook was preferred over leaving the boundary verifiable only by hand.

### PostHog reporting

`componentDidCatch` captures `app_crashed` with message, stack, component stack
and path. Because PostHog is imported lazily past `window.load`, a crash during
startup can happen before the client exists; `componentDidUpdate` retries once the
provider supplies it, so early crashes are not silently lost. `console.error` runs
unconditionally regardless.

**Not covered by an automated test.** No `VITE_PUBLIC_POSTHOG_TOKEN` is set for
the test build, so the client never initialises and `capture()` is correctly
skipped — there is nothing to assert against. The test asserts the unconditional
console record instead. Verifying the capture leg would mean building the prod
test server with a throwaway token and intercepting the request; that changes the
harness for every `prod` spec and is not worth it for this.

### Follow-up (not done here)

**No save reset outside the crash path.** If a run gets *stuck* without throwing,
the boundary never fires and the player still has no escape hatch — `HomeView` has
no Settings entry, and Retire needs a live run. Adding a confirm-gated reset to
`SettingsModal` would close that, and is the more common case of the two. Left out
to keep this change to the crash path; worth its own issue.

### Verified

Full suite: **60 passed, 1 skipped, 1.8 minutes.** `npm run lint` and
`npm run build` clean. 8 new tests in `visual/error-boundary.prod.spec.js`.

Two of those tests initially failed for reasons worth recording, both test bugs
rather than product bugs:

1. `addInitScript` re-runs on **every** navigation, so seeding the save that way
   resurrected it the instant Discard reloaded the page. Keys a test mutates must
   be set imperatively with `page.evaluate` after the first load.
2. `locator.count()` does not wait, so branching on it raced whichever outcome
   rendered. Replaced with `expect(a.or(b).first()).toBeVisible()`.

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

- [x] A deliberate throw inside the game tree renders the fallback, not a white screen
- [x] Fallback offers reload, report, and discard-save
- [x] A corrupt `scoundrel:save` value does not prevent the app from loading (both malformed JSON and parses-then-throws)
- [~] Caught errors reach PostHog — implemented with a late retry for the deferred client, but **not** covered by an automated test (no token in the test build; see above)
