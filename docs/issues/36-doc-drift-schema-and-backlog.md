---
id: 36
title: "Two docs state things that are no longer true: the schema's table count and the backlog's mailbox item"
priority: P4
area: docs
effort: S
status: open
---

## Problem

Two small drifts, both in files that are read when someone needs to be right.

**`db/schema.sql:10`** — the header says "Four tables:" and then lists five,
because `rate_limits` was added without updating the count. There are now six:
`handles` (`db/schema.sql:265`) landed on 2026-08-30 with the leaderboard-name
work and is documented in the body but missing from the header list.

The file's own rule is that it is the readable copy of the DDL the endpoints
create — "the place to look before writing an analytics query or debugging
production." A miscount at the top of that file is the first thing a reader
sees.

**`docs/issues/README.md`** — under "Issue 13 has grown into the real pre-launch
gate", it lists "Create the privacy contact mailbox" as one of two non-optional
items. That was done: `src/privacyContact.js` records
`privacy@sigildeck.com` verified end to end on 2026-08-06, with a message sent
from an outside account and a reply received. The item should be struck, leaving
the 401 check as the one genuinely open non-optional item.

## Why it matters

Both are cheap, and both are the kind of thing that costs someone twenty minutes
at the wrong moment — one while debugging production, the other while deciding
whether launch is blocked.

## Suggested fix

- Update the `db/schema.sql` header to name all six tables and their owning file.
- Strike the mailbox line in the backlog README, noting it was verified
  2026-08-06 (the same way other done items are recorded).
- While in `schema.sql`, confirm every `create table` in `api/` still appears
  there. Today the six agree; the point is to check rather than assume.

## Acceptance criteria

- [ ] `db/schema.sql`'s header lists all six tables with their owning files
- [ ] The mailbox item is no longer listed as open in the backlog README
- [ ] Every `create table` under `api/` appears in `db/schema.sql`
