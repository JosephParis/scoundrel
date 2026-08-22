# Dawn run 2026-08-22 — issues 21, 20, 22

**Status: in progress.** (This file is updated as the run goes; if it still says
"in progress" the run was killed before it could finish.)

## What I picked and why

The chain **21 → 20 → 22**: `.gitignore` secrets trap, then README/LICENSE/
`.env.example`, then archiving the nine session-artifact docs out of the repo root.

Alternatives considered and rejected:

- **Issue 15** (the skill's standing default) is already **done** — the unit
  suite went 84 → 391. The default no longer applies.
- **Issue 08** (moderation) is the highest-value open item and the stated risk
  before widening access. Rejected: it needs a `blocked` column in the live Neon
  database. Dawn-run rules disqualify database migrations outright, and it is
  also blocked by issue 10, still open.
- **Issue 23** (DESIGN.md is stale) is the other `M`. Comparable value, but it
  stands alone, whereas 20 unblocks 21 and 22 — three issues off the board
  instead of one.

20 is `M`, the largest effort available once L and the migrations are out.
All three are docs/config only: no gameplay, no live data, nothing to leave
half-broken if I am killed mid-step.

## What changed

_(updated as each step lands)_

## Test results

_(pending)_

## What is left

_(pending)_
