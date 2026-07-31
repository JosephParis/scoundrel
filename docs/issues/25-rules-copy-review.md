---
id: 25
title: "Review player-facing rules copy against the post-rework game"
priority: P4
area: docs
effort: S
status: open
---

## Partly resolved by the rename

The specific line this issue opened on is fixed. `rules.jsx:120` now reads
**"Knell, a roguelike of one bad night."** — the game was renamed from Scoundrel
to Knell, which forced the question and settled it: the "44-card" claim is gone,
and the lineage nod moved off the tagline.

**The rest of this issue still stands.** The broader audit of `rules.jsx` for
pre-rework framing — whole-deck editing, `Strike`, any implication that the next
theme is known before descending — was not done, and should still happen
alongside issue 12 when the parked tabs come back.

Note `deck.js:32`'s "base 44-card Scoundrel deck" comment is **correct** and was
deliberately left: it describes the source deck this game descends from, which is
still 44 cards internally. Likewise the boon **"Scoundrel's Cloak"** was kept — a
scoundrel is a character archetype, not the game's title.

## Problem

`src/games/scoundrel/components/rules.jsx:120` describes the game to the player
as:

> Scoundrel, the 44-card roguelike.

Post-rework this is at best misleading. The player now owns and edits a **kit**
(weapons/potions/tools); the dungeon owns a **per-descent rolled monster pool**,
merged and shuffled fresh each descent. There is no single 44-card deck the player
interacts with.

## Nuance — this one needs a judgment call, not a mechanical fix

The number isn't simply wrong. `src/games/scoundrel/logic/deck.js:32` still
reads:

```js
// The base 44-card Scoundrel deck: monster half + full tool half.
export function buildBaseDeck() {
```

So a 44-card base deck genuinely still exists internally as the source pool. The
comment is accurate. The question is whether "the 44-card roguelike" is still a
useful *description of the experience* when the player never sees or manipulates
those 44 cards as a unit.

Argument for keeping it: it's a nod to the original Scoundrel card game, which the
whole design descends from, and "44-card" signals a tight, bounded roguelike.

Argument against: a new player reads it as a promise about the mechanics, then
encounters a kit of ten and a dungeon pool that changes every descent, and the
framing has taught them the wrong model.

Recommendation: reword to describe the kit/dungeon loop, and credit the original
Scoundrel explicitly elsewhere (the credits modal already exists and is the right
home for the lineage).

## Scope

This is a copy *review*, not a single edit. While in `rules.jsx`, check the rest
of the tab content for pre-rework framing — whole-deck editing, `Strike`, or any
suggestion that the next theme is known before descending (`REWORK.md` §8: you
descend fully blind). Same drift as issue 23, one layer closer to the player.

Related copy issues tracked separately:

- Issue 14 — the "Anonymous" handle placeholder, a genuine functional mismatch
- Issue 12 — the Boons/Trials/Card library tabs are commented out; their content
  needs the same audit before being re-enabled, so **do these together**
- Issue 23 — `DESIGN.md`, the same staleness at the design-doc layer

## Acceptance criteria

- [ ] Line 120 either reworded or a deliberate decision recorded to keep it
- [ ] Original Scoundrel credited somewhere player-visible if "44-card" is dropped
- [ ] Remaining `rules.jsx` content contains no pre-rework mechanics
- [ ] No player-facing text implies theme foreknowledge
- [ ] Audited alongside issue 12's re-enabled tabs
