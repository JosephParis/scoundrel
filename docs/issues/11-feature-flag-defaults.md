---
id: 11
title: "Decide feature flag defaults for batch 1 (6 of 7 currently off)"
priority: P2
area: product
effort: S
status: open
---

## Problem

`src/games/scoundrel/flags.js` ships these defaults:

```js
DEFAULTS = {
  modes: false,
  library: false,
  ascensions: false,
  wounds: false,
  customCards: true,
  bosses: false,
  specialMonsters: false,
}
```

So a first-batch player gets: default mode only, Ascension 0 only, no wounds, no
bosses, no special monsters, no card library. Six of seven systems are built,
tested, and unreachable.

These read as inherited development defaults rather than a launch decision — and
nobody has made the launch decision yet.

## Why it matters for batch 1

Two competing risks, and the answer isn't obvious:

- **Too little content**: batch 1 sees a thinner game than you've built, gives
  feedback on a subset, and may bounce before finding the depth. Bosses and
  special monsters in particular are the kind of thing that makes a roguelike
  feel like it has secrets.
- **Too much content**: unlocking everything at once means any balance signal
  mixes systems, and `WINRATE_TARGETS.md` targets ~20% winrate for
  **default-mode A0** specifically. Turn on modes and ascensions and your ~1,500
  run go point fragments across combinations you can't compare.

## Recommendation

Split the difference along the "does it fragment the dataset?" line:

- **Turn on** `bosses` and `specialMonsters` — they add texture *within*
  default-mode A0, so runs stay comparable and the game gets more interesting.
- **Turn on** `library` — that's issue 12, and it's a pure information win with
  no balance effect.
- **Leave off** `modes` and `ascensions` — these split the population across
  rulesets and directly undermine the winrate measurement in issue 13. They're
  also natural "batch 2" content, which gives returning players something new.
- **Decide** `wounds`: it changes the difficulty curve, so if it goes on it must
  go on *before* the measurement window starts, not during.

The critical constraint: **whatever you choose, don't change it mid-window.**
Flipping a gameplay flag partway through invalidates the runs on both sides of
the change unless you also bump `GAME_VERSION`.

## Acceptance criteria

- [ ] Explicit decision recorded for all 7 flags with reasoning
- [ ] `DEFAULTS` updated to match
- [ ] Any flag affecting difficulty is settled before the issue 13 measurement window opens
- [ ] If defaults change after runs are recorded, `GAME_VERSION` is bumped
- [ ] `?flag-<id>=1` override still works for your own testing
