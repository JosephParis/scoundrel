---
id: 08
title: "No moderation path for handles, leaderboard rows, or feedback"
priority: P1
area: security
effort: M
status: done
branch: issue-08-moderation
---

## Problem

You are about to publish a board that displays user-authored text, with no way to
remove anything from it.

- **Handles aren't screened for content.** `sanitizeHandle` in
  `src/games/scoundrel/settings.js` restricts the character set to
  `[A-Za-z0-9 _-]`, collapses whitespace, and clamps to
  `MAX_HANDLE_LENGTH = 16`. That stops injection and layout breakage; it does
  nothing about slurs or impersonation, both of which fit comfortably in 16
  alphanumeric characters.
- **`/admin` is read-only.** `AdminDashboard.jsx`, `tables.jsx`, `bands.js`, and
  `feedback.jsx` render aggregates and recent feedback. There is no delete, no
  hide, no ban — not in the UI and not as an endpoint.
- No way to block a repeat offender's `accountId`.

Combined with issue 07 (anyone can POST a run with any `playerName`), one person
can put arbitrary text on your public leaderboard and you currently have no
response short of a manual SQL session against production.

## Suggested fix

Minimum viable moderation — this does not need to be elegant, it needs to exist
before the link goes out:

- **`DELETE /api/runs/:runKey`**, admin-token gated, reusing the `ADMIN_TOKEN`
  bearer check already implemented in `api/stats.js`. Wire a delete button into
  the admin leaderboard table.
- **A blocklist**: either a `blocked` boolean on `profiles` or a small
  `blocked_accounts` table, checked in `api/leaderboard.js` alongside the
  existing `dev is not true` filter. Blocking should hide the player's rows
  without deleting their save.
- **Feedback delete** in the admin feedback view, so spam can be cleared.
- **A denylist check in `sanitizeHandle`.** Even a modest word list plus
  leetspeak normalization catches most of it, and it runs client-side *and*
  should be re-applied server-side in `api/runs.js` — client-side alone is
  bypassable by construction (issue 07).

Longer term, a "reported" flag and a review queue, but not for batch 1.

## Acceptance criteria

- [x] An admin can delete a specific leaderboard row from `/admin`
- [x] An admin can block an `accountId` so its rows stop appearing publicly
- [x] An admin can delete a feedback entry
- [x] Handle denylist enforced server-side, not only in the client
- [x] All new endpoints require `ADMIN_TOKEN`; none are reachable unauthenticated

## Resolution

Branch `issue-08-moderation`. Five commits; issue 10 was closed first, since the
blocklist table needed a documented home.

**What exists now**

- `api/moderation.js` — one admin route, `ADMIN_TOKEN` bearer gated:
  `GET` lists blocked accounts, `GET ?rows=1` lists every run that published a
  handle (newest first, with the run key and a `blocked` flag), `POST` blocks an
  account, `DELETE ?accountId=` unblocks, `DELETE ?runKey=` deletes one run,
  `DELETE ?feedbackId=` deletes one feedback note.
- `api/_lib/moderation.js` — `adminAuthorized()` (moved out of `api/stats.js`,
  which now imports it) and the `blocked_accounts` table.
- `api/leaderboard.js` — subtracts blocked accounts *inside* the ranked
  subquery, so a block leaves no gap in the ranking, and the caller's-own-rank
  query is filtered by the same fragment.
- `src/games/scoundrel/handleDenylist.js` — shared by the client and
  `api/runs.js`, the way `api/_lib/validate.js` already shares `constants.js`.
- `src/admin/moderation.jsx` — the panel; `src/admin/feedback.jsx` — per-note
  delete.

**Decisions worth knowing about**

- **One admin route, not `DELETE /api/runs/:runKey`.** The issue proposed
  hanging delete off the runs endpoint. Everything mutating lives in
  `/api/moderation` instead: the whole admin surface is one file to read and one
  path to grep for in a log, and no admin branch shares a file with a path
  unauthenticated callers can reach. The cost is a less RESTful URL.
- **A screened handle is stripped, not rejected.** `/api/runs` stores the run
  with `playerName: null` rather than 400ing. The run is real analytics either
  way, the board already lists only runs that carry a name, and a rejection
  tells the author exactly which words to try next.
- **The client still accepts the text.** Refusing to store `nazi` also refuses
  the fourth keystroke of `Nazir`, so the Settings field keeps working and the
  copy changes instead — it says the name will not be listed.
- **`guest` cannot be blocked.** Every guest run carries that account id, so a
  block would empty half the board; the endpoint 400s and the panel does not
  offer the button. Guest rows are deleted individually.
- **The word lists are a floor.** Two tiers (substring after leetspeak folding
  and repeat collapsing; whole-word for terms with innocent hosts) plus an
  allowlist, so `Nazir`, `Nigerian`, `Scunthorpe` and `Cassandra` still play.
  A determined person will still get something through — that is what the
  blocklist and the row delete are for. Extend the lists when something lands.
- **No review queue, no reported flag.** Out of scope for batch 1, as the issue
  said.

**Tests** — `test/moderation.handler.test.js` (24), `test/handleDenylist.test.js`
(41), `test/leaderboard.handler.test.js` (11), six new cases in
`test/runs.handler.test.js`, four in `visual/copy-accuracy.spec.js`.

**Not verifiable locally.** There is no `/api` in `vite dev` or `vite preview`,
so the panel has never issued a real request. Pushed onto issue 13's checklist:
the endpoints, the blocklist round trip, and the fact that `blocked_accounts` is
created on first call.
