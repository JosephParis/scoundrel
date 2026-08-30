---
id: 14
title: "BUG: UI promises handle-less runs post as Anonymous, but the server excludes them entirely"
priority: P2
area: bug
effort: S
status: done
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

- [x] No UI text or placeholder implies handle-less runs appear as "Anonymous"
- [x] Handle field copy states that a name is required to appear on the board
- [x] Stale comments in `settings.js` and `history.js` corrected
- [ ] Verified live: handle-less victory does not appear; named victory does
      (needs production — pair with issue 13)

## Resolution (2026-08-22)

Server behavior kept; the client now describes it. Nothing claims an anonymous
listing exists, because it does not.

- `modals.jsx` — placeholder `"Anonymous"` → `"Not listed"`. The paragraph
  under the field already read "your runs stay off the leaderboard entirely" and
  was left alone; the placeholder was the half that contradicted it.
- `modals.jsx`, `settings.js` (x3), `history.js` — stale comments rewritten.
  `leaderboardName()`'s docstring now states that null means absent from the
  board, not shown without a name.
- `OutcomeView.jsx` — new `LeaderboardNudge`, shown only on a victory with no
  handle: "This victory isn't on the leaderboard: it only lists runs that carry
  a name. **Set one in Settings**", wired through `index.jsx` to open the
  Settings modal in one click. Not shown on death — only victories are ranked.
  `useHandle()` is called unconditionally; gating it behind `won &&` would
  change hook order between the two outcome screens.

Covered by `visual/copy-accuracy.spec.js` (8 tests for this issue): placeholder
is not "Anonymous", the word appears nowhere in Settings, the nudge appears on an
unlisted victory and opens Settings, and is absent for a named victory, a death,
and present for a whitespace-only handle.

**Not verified in production.** The last acceptance box needs a real
handle-less and named victory against sigildeck.com — do it with issue 13.

## Superseded (2026-08-25, `b9ad068`)

**The resolution above was reversed, and this file was not updated at the time.**
Read it as history, not as current behaviour.

The 08-22 fix kept the server rule (no handle, no listing) and removed the
promise from the copy. `b9ad068` took the alternative this file had argued
against: the board now lists a nameless victory as Anonymous, because a player
who never opened Settings could win a record-fast run and silently not place.
`api/leaderboard.js` drops the handle filter and sends `playerName: null`; the
client renders the stand-in via `entryDisplayName`. The opt-in property is
weaker than the 08-22 reasoning wanted, and that was accepted deliberately —
nothing identifying travels with an unnamed row.

So the copy went back to promising an Anonymous listing, and
`visual/copy-accuracy.spec.js` was inverted to assert the old claim is gone.
The `anonymous-victory nudge` block is the current expectation; the
`unlisted-victory nudge` wording quoted above no longer exists.

Merging issue 08 (2026-08-30) hit this: that branch predated `b9ad068` and its
screened-handle copy still said a rejected name kept the run off the board. It
does not — a screened run places as Anonymous. See the note in
`docs/issues/README.md` under the issue 08 paragraph.
