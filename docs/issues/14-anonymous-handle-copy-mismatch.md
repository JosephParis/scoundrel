---
id: 14
title: "BUG: UI promises handle-less runs post as Anonymous, but the server excludes them entirely"
priority: P2
area: bug
effort: S
status: open
---

## Problem

The client tells players that leaving the handle field empty posts their runs
anonymously. The server drops those runs from the leaderboard altogether. A
player who reads the UI, wins a run, and checks the board finds nothing — and has
no way to know why.

## Evidence

**Server — handle-less runs are filtered out**, `api/leaderboard.js:89`:

```sql
and btrim(coalesce(r.record->>'playerName', '')) <> ''
```

**Client — promises an Anonymous listing:**

- `src/games/scoundrel/components/modals.jsx:45` — `placeholder="Anonymous"` on
  the handle input. This is the load-bearing one: it's live UI, not a comment,
  and a placeholder reading "Anonymous" is a direct statement about what happens
  if you leave it blank.
- `src/games/scoundrel/components/modals.jsx:26` — "a run is posted as Anonymous
  unless the player types something here"
- `src/games/scoundrel/settings.js:20` — empty "means 'post my runs as Anonymous'"
- `src/games/scoundrel/settings.js:122` — "Empty string = post as Anonymous"
- `src/games/scoundrel/history.js:60-66` — `leaderboardName()` returns `null`,
  documented as meaning "Anonymous"

So five places say Anonymous and the SQL says excluded. The comments are stale
(the board was changed to require a handle in commit `9cd92c1`), but the
placeholder is a user-visible bug.

## Why it matters

It converts a deliberate, good privacy design into a confusing one. The intent —
nobody reaches the public board without explicitly opting in by typing a name —
is sound and worth keeping. It's the *communication* that's wrong: "you'll show
as Anonymous" and "you won't appear at all" are very different promises, and only
one of them is true.

Expect this as batch-1 feedback in the form "the leaderboard is broken, I won and
I'm not on it."

## Suggested fix

Keep the server behavior; fix the client to describe it.

- Change the placeholder from `"Anonymous"` to something accurate — e.g.
  `"Enter a name to appear on the leaderboard"` (or a shorter
  `"Not shown"` / `"Set a name to appear"` if the field is narrow).
- Rewrite the surrounding copy in `modals.jsx` to state the real rule: a handle
  is required to appear, no handle means your runs stay private.
- Update the stale comments in `settings.js:20`, `settings.js:122`, and
  `history.js:60-66` so the next reader isn't misled again.
- Consider surfacing this at the moment it matters: on the victory screen, if the
  player has no handle, a one-line "Set a name in Settings to post this to the
  leaderboard" turns a silent omission into an invitation.

Alternatively, genuinely support anonymous listings by allowing empty
`playerName` and rendering "Anonymous" in the board — but that weakens the opt-in
property, so the copy fix is the better call.

## Acceptance criteria

- [ ] No UI text or placeholder implies handle-less runs appear as "Anonymous"
- [ ] Handle field copy states that a name is required to appear on the board
- [ ] Stale comments in `settings.js` and `history.js` corrected
- [ ] Verified live: handle-less victory does not appear; named victory does
