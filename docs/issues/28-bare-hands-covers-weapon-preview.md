---
id: 28
title: "BUG the bare-hands button covers the weapon preview it asks you to compare against"
priority: P1
area: bug
effort: S
status: done
---

## Problem

A monster card offers one decision: swing with the weapon, or punch it. The card
face prints the first outcome ("take 3") in the preview line at its foot, and the
bare-hands button prints the second ("Bare hands · take 8").

The button is absolutely positioned over the bottom of the card, so it sat on top
of the preview line. The player could see the cost of punching but not the cost
of swinging — half of the choice was hidden behind the other half.

Measured before the fix: **17px of overlap** on desktop, more on mobile, plus the
label wrapping to two lines at 320px, which pushed the button further up the card
still.

## Fix

`src/games/scoundrel/components/cardSlot.jsx`.

The face gives up a fixed strip at its foot whenever the button is drawn
(`BARE_RESERVE`), rather than the button being moved out of the card. Moving it
below the card would have been the obvious fix and was rejected: it adds ~44px
per card row, and the mobile suite's whole premise is that a descent fits the
viewport without scrolling.

For that reserve to hold, the button has to have a height the face can predict —
hence `h-9` and a `whitespace-nowrap` label at `text-[10px] sm:text-xs`. A label
that wrapped would grow the button back over the preview.

The modern face additionally shrinks its art (`w-[54%]` → `w-[30%]`, tighter
margins) and drops the rules copy a size when the button is present. The art is
the one element on that face carrying nothing the player needs for the decision,
so it gives up the room instead of the rules text, which otherwise clipped
mid-sentence.

## Testing

`visual/bare-hands-layout.spec.js`, 7 tests. It seeds a descent straight into the
save slot — weapon equipped, four monsters, one plain and three with traits so
both faces are exercised — because playing into that position is slow and the
room roll is random.

Assertions are on bounding boxes: the preview and the button must not overlap, in
both layouts, at mobile and desktop, and the button must stay one line at 320px.
All five box tests fail on the pre-fix tree.

Two traps worth knowing if you extend it:

- **Escape opens the pause menu** during a descent (`index.jsx`), so it cannot be
  used to dismiss the theme intro. Space does the same job with no side effect.
  Bounding boxes are unperturbed by an overlay, so the spec asserts the pause
  menu is absent rather than assuming it.
- An **armored** monster gets no bare-hands button at all — armored means weapons
  do nothing, so there is no choice to present. Don't put one in a fixture and
  expect four buttons.

## Acceptance criteria

- [x] The weapon preview is fully visible whenever the bare-hands button is drawn
- [x] Holds in both card layouts, at 320px through desktop
- [x] The button label never wraps
- [x] Modern-face rules copy still fits rather than clipping mid-sentence
- [x] No new vertical scrolling in a descent (`mobile-responsive.spec.js` green)
