---
id: 08
title: "No moderation path for handles, leaderboard rows, or feedback"
priority: P1
area: security
effort: M
status: open
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

- [ ] An admin can delete a specific leaderboard row from `/admin`
- [ ] An admin can block an `accountId` so its rows stop appearing publicly
- [ ] An admin can delete a feedback entry
- [ ] Handle denylist enforced server-side, not only in the client
- [ ] All new endpoints require `ADMIN_TOKEN`; none are reachable unauthenticated
