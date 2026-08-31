---
id: 23
title: "DESIGN.md contradicts the shipped game in several core mechanics"
priority: P4
area: docs
effort: M
status: done
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

- [x] `DESIGN.md` either carries a clear superseded-by header or is merged into one accurate doc
- [x] Sigil target, blind descent, and the kit/dungeon split are correct or explicitly marked historical
- [x] No remaining references to `Strike` or whole-deck editing presented as current
- [x] `REWORK.md` §11's kit size cap decision resolved and recorded
- [x] A reader can tell within five seconds which document describes the current game

## Resolution (2026-08-31)

**Option A**, as recommended. `DESIGN.md` keeps its fiction and its reasoning and
gains a banner naming `REWORK.md` as the design of record; the three confirmed
contradictions are corrected in place rather than merely disclaimed. Option B
(merging the two) was declined: the docs answer different questions — DESIGN.md
is *why the mechanics are shaped this way*, REWORK.md is *what the game does* —
and merging them would have dropped the premise and the Forge fiction, which
nothing else records.

**Left at the repo root.** Issue 22 moved session artifacts to `docs/`; these
three are live design docs and the README says the root holds exactly them.
Moving a superseded-but-live doc would have contradicted that for no gain now
that it announces itself.

**The audit found four more stale sections beyond the three confirmed**, all now
marked rather than rewritten: the theme tiers (§3 lists three, the game has five,
gated at 2/3/5/7 sigils), the Boon list (§4 is the original set; `boons.js` has
25), meta-progression (§7 — Memory Slots, Codex and the daily seed were never
built), and the build order (§8, complete).

**`REWORK.md` §11 kit size cap: no cap, and that shipped.** Nothing in the code
limits kit size. Power is bounded by rank instead — an Inscribe rolls at
`4 + sigils` capped to 10, an Upgrade tops out at 10 — with dilution (§7) doing
the rest. Recorded in both §5 and §11, and §11 now reads "None outstanding".

**`REWORK.md` no longer opens by calling itself an uncommitted proposal.** It had
shipped; that sentence was the single most misleading line across both docs,
since it invited a reader to treat the superseded doc as the real one.

**Test:** `test/designDocs.test.js`, 10 assertions holding both docs to the code
they describe — the sigil target against `SIGIL_TARGET`, the starting kit against
`buildStartingKit()`, the documented Inscribe rank cap against the expression in
`sanctuary.js`, and the absence of a kit size cap against a `sanctuary.js` that
has none. It also fails if the superseded banner is removed, if `REWORK.md`
grows a new open decision, or if `Strike` reappears outside a section marked
historical. It caught a real drift while being written.
