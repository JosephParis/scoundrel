---
id: 23
title: "DESIGN.md contradicts the shipped game in several core mechanics"
priority: P4
area: docs
effort: M
status: in-progress
branch: dawn/2026-08-31
---

## Problem

`DESIGN.md` (20 KB) still describes the pre-rework game. It misstates
fundamentals, not details.

## Confirmed contradictions

| `DESIGN.md` says | Reality | Source of truth |
|---|---|---|
| "seven sigils" to win | `SIGIL_TARGET = 10` | `src/games/scoundrel/constants.js` |
| "The next descent's Theme is revealed" in the sanctuary | You descend **fully blind** | `REWORK.md` §8 |
| Player edits a 44-card deck, including `Strike` | Player owns only a **kit** (weapons/potions/tools); the dungeon owns a per-descent rolled monster pool, merged and shuffled per descent. **`Strike` was removed.** | `REWORK.md`, `src/games/scoundrel/logic/deck.js` |

`REWORK.md` (15.5 KB) is the actual design of record — its §12 build order is
marked complete through step 6, and the rework has shipped. But `DESIGN.md` is
the file whose *name* implies authority, and nothing in it says "superseded."

## Why it matters

Anyone building a mental model of this game from the docs — you in three months,
or any agent picking up an issue from this backlog — will read `DESIGN.md` first
and get the core loop wrong. The sigil count and blind-descent items are
especially costly because they'd lead someone to "fix" correct code to match a
stale spec.

This is a documentation issue, not a gameplay one: the code is right.

## Suggested fix

Either of two approaches — pick one and be decisive:

**Option A (less work, recommended):** Add a prominent header to `DESIGN.md`
stating that it describes the pre-rework design, that `REWORK.md` supersedes it
for anything the two disagree on, and that it's retained for the reasoning behind
mechanics that survived. Then fix just the three contradictions above so it isn't
actively wrong on basics. Consider moving it to `docs/` alongside issue 22's
reorganization.

**Option B (more work, better end state):** Merge `REWORK.md` into `DESIGN.md` to
produce one accurate current-design document, and archive `REWORK.md`. Removes
the two-sources-of-truth problem permanently, but it's a real writing task.

Either way, while in there:

- Note `REWORK.md` §11 leaves the **kit size cap** as an open decision. Check
  whether that got resolved in code; if so, record the answer. If not, it's a
  live design question worth its own issue.
- Audit for other pre-rework references beyond the three confirmed above —
  anything mentioning whole-deck editing, `Strike`, or theme foreknowledge.
- The rules-copy question in issue 25 is downstream of this: player-facing text
  drifted the same way.

## Acceptance criteria

- [ ] `DESIGN.md` either carries a clear superseded-by header or is merged into one accurate doc
- [ ] Sigil target, blind descent, and the kit/dungeon split are correct or explicitly marked historical
- [ ] No remaining references to `Strike` or whole-deck editing presented as current
- [ ] `REWORK.md` §11's kit size cap decision resolved and recorded
- [ ] A reader can tell within five seconds which document describes the current game
