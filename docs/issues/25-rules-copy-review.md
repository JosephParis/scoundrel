---
id: 25
title: "Review player-facing rules copy against the post-rework game"
priority: P4
area: docs
effort: S
status: done
---

## Partly resolved by the rename

The specific line this issue opened on is fixed. The "44-card" claim is gone,
settled by the rename from Scoundrel (via a short-lived Knell).

**Superseded 2026-08-10 on the lineage half.** This issue recorded that "the
lineage nod moved off the tagline"; that was reversed deliberately, not lost.
The tagline is now **"Forge your kit, take a Boon, face the Trial"** with
**"a roguelike deckbuilder after Scoundrel"** carrying the lineage, on the
reasoning that the Scoundrel audience is the one group who already understand
the mechanic and are worth naming for. Full attribution — Zach Gage and Kurt
Bieg, 2011 — now has a **"Based on"** section at the top of the Credits modal,
which it did not have at all before: the game named its icon, music and SFX
sources but not the design it descends from.

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

- [x] Line 120 either reworded or a deliberate decision recorded to keep it
- [x] Original Scoundrel credited somewhere player-visible if "44-card" is dropped
- [x] Remaining `rules.jsx` content contains no pre-rework mechanics
- [x] No player-facing text implies theme foreknowledge
- [ ] Audited alongside issue 12's re-enabled tabs — **transferred to issue 12**

## Resolution (2026-08-22)

The audit of the live rules content is done. The parked-tab half transfers to
issue 12, which is where those tabs come back.

**The real defect found: three places promised a Trial preview the game never
gives.** `REWORK.md` §8 decided you descend fully blind, and the code agrees —
`SanctuaryView.jsx` never reads `state.nextTheme`, and the only player-visible
reveal is `ThemeIntroOverlay`, which fires on arrival, after you have committed.
The copy still taught DESIGN.md's dropped "see the theme, spend your Boon as
counterplay" loop:

- `rules.jsx` brief panel — "the next Trial is shown before you commit" → now
  "You descend blind: the Trial below is named as you arrive, never before, so
  build for anything rather than for one known threat."
- `rules.jsx` long-form sanctuary loop — "Next descent's rules previewed before
  you commit" → "Not shown here. You descend blind and the Trial is named as you
  arrive, so your kit is a standing answer, not a counter."
- `rules.jsx` `ThemesGlossary` — "You see it before you descend, so spend your
  Boon as counterplay" → rewritten for resilience. Parked behind issue 12, fixed
  now so re-enabling the tab cannot put the old promise back in front of players.

Checked and found clean: no `Strike` in player-facing copy, no "44-card" claim
(settled by the rename), and the kit/dungeon framing in "The deck" already
matches the post-rework model.

Covered by `visual/copy-accuracy.spec.js` (4 tests for this issue), including
one asserting the inline opening panel and the modal tell the same story — the
inline panel is the copy most players actually read.

### Left open, deliberately: the Forge cadence

`ascensions.js` defaults `forgeSigils: [1,2,3,4,5,6,7]` with the comment "the
default covers all of them, so the Forge opens after every descent". That was
true when the target was 7 sigils. `SIGIL_TARGET` is now **10**, so the Forge
does not open on returns 8 and 9, and the rules copy ("Forge — After each
descent") is false for those two visits.

Not touched here: extending the default to `[1..10]` is a balance change and
belongs to whoever owns the difficulty curve, not to a copy pass. Fix the data
or reword the rules — but one of the two has to move.
