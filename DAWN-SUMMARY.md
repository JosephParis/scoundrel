# Dawn run — 2026-08-16

**Branch:** `dawn/2026-08-16` · **Issue picked:** [15 — No unit tests over ~100KB
of game logic](docs/issues/15-unit-tests-game-logic.md)

## Why this one

It is the only **L** in the backlog and the standing pick in
`~/.claude/projects.json`. It is also the only remaining item that is genuinely
interruption-safe: every test file that lands green is real progress that stands
on its own, so being killed mid-run costs at most one file. The alternatives
were disqualified rather than merely lower-value:

- **08** (moderation) needs a `blocked` column, i.e. a live schema change —
  exactly the half-finished state the run must not leave behind.
- **13** (verify `/api/stats` in prod) can only be done against production.
- **09**, **10**, **14**, **27** are all **S**; knocking out a handful of small
  items would waste the window this run exists to spend.

## Status

_In progress — this file is updated as work lands._

## What changed

(see commits on this branch)

## Left to do

(see below)
