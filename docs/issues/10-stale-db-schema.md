---
id: 10
title: "db/schema.sql no longer describes the database"
priority: P1
area: docs
effort: S
status: open
---

## Problem

`db/schema.sql` calls itself "the canonical place to add indexes/migrations
later," but it has drifted from what the code actually creates. It documents one
table; production has three.

## Evidence

Missing from `schema.sql`:

- **The `dev` column on `runs`.** `api/_lib/runsTable.js` adds it in place
  (`alter table ... add column if not exists`), and it is load-bearing — every
  aggregation in `api/stats.js` filters on `dev is not true`, as does
  `api/leaderboard.js`. `schema.sql:28` documents the same in-place pattern for
  `game_version` but was never updated for `dev`.
- **The `profiles` table** — created lazily by `api/save.js`. Holds the jsonb
  save blob and the player's email.
- **The `feedback` table** — created lazily by `api/feedback.js`.
- **Indexes** — `runsTable.js` creates four; the file lists four but they may not
  match the current set.

Nothing is broken: every endpoint creates and migrates its own tables on first
call (`ensureRunsTable` caches the promise), which is why the drift is invisible
in normal operation.

## Why it matters

Two real costs, both of which bite at the worst time:

1. **You can't see the shape of your own data.** `schema.sql` is where you'd look
   before writing an analytics query or debugging a production issue, and it will
   mislead you — the extensive example query block at the bottom of the file
   (lines 42–146) is genuinely useful and makes the file *more* likely to be
   trusted.
2. **No migration story.** With schema spread across three endpoints' DDL and no
   canonical record, adding a column means finding the right `ensure*` function.
   Issue 08 needs a `blocked` column and issue 07 may need a rate-limit table —
   both land better against an accurate baseline.

## Suggested fix

- Add `create table if not exists` for `profiles` and `feedback`, matching the
  DDL in `api/save.js` and `api/feedback.js` exactly.
- Add `alter table runs add column if not exists dev boolean`, with a comment
  explaining that null/false means a real run and true means Dev-tool test data
  excluded from stats.
- Verify the four index definitions against `ensureRunsTable`.
- Update the header comment: the file documents three tables, all created lazily
  by their endpoints.
- Add a note stating which endpoint owns each table's DDL, so the next person
  knows where the real definition lives.

Optional but valuable: a `npm run db:verify` script that diffs live schema
against this file, so drift is caught rather than discovered.

## Acceptance criteria

- [ ] All three tables and every current column present in `schema.sql`
- [ ] `dev` column documented with its semantics
- [ ] Running the file against an empty database produces a schema the endpoints accept without further migration
- [ ] Each table annotated with the endpoint that owns its DDL
