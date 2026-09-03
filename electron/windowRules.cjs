/**
 * How large the desktop window opens, as a pure function of the display.
 *
 * Split out of main.cjs so it can be tested without launching Electron: the
 * interesting behaviour here is arithmetic against a work area, and the rule it
 * enforces is one the game's CSS cares about but nothing else would catch.
 *
 * See docs/STEAM.md, S04.
 */

/**
 * The height below which the game switches to its compact layout.
 *
 * `short:` in src/index.css is `@media (max-height: 760px)`, and under it the
 * room's cards clamp to 155px against 240px above. That threshold was written
 * for phones and for the itch embed, where it is the right answer. In a desktop
 * window it means a default height chosen carelessly serves a desktop player
 * the phone layout inside a full-size window -- which looks like a bug and is
 * not one. docs/itch/PAGE.md hit exactly this with the itch viewport, which is
 * why the embed there is 820 tall and not the conventional 720.
 *
 * It is deliberately NOT a minimum. On a 1366x768 laptop the work area is under
 * 760 tall, and a hard minimum would force a window taller than the screen.
 * Below the threshold the compact layout is a graceful degradation, and it is
 * the same one the web build has always had.
 */
const COMFORTABLE_HEIGHT = 760

/** Preferred size, before it is clamped to whatever display is actually there. */
const PREFERRED = { width: 1280, height: 900 }

/** Small enough for a half-screen window, large enough that nothing collides. */
const MINIMUM = { width: 960, height: 600 }

/**
 * Margins, so the window does not sit edge-to-edge with the taskbar on a
 * display only just large enough for the preferred size.
 */
const MARGIN = { width: 80, height: 60 }

/**
 * Fit the preferred window into a display's work area.
 *
 * The one non-obvious rule: when the margin is the only thing pushing the
 * window under COMFORTABLE_HEIGHT, the margin loses. Trading 60px of breathing
 * room for the full-size card layout is worth it; trading it for nothing, on a
 * display that was never going to clear the threshold anyway, is not.
 */
function fitBounds(workArea) {
  const width = clamp(workArea.width - MARGIN.width, MINIMUM.width, PREFERRED.width)

  const margined = clamp(workArea.height - MARGIN.height, MINIMUM.height, PREFERRED.height)
  const full = clamp(workArea.height, MINIMUM.height, PREFERRED.height)
  const height = margined < COMFORTABLE_HEIGHT && full >= COMFORTABLE_HEIGHT ? full : margined

  return { width, height }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

module.exports = { COMFORTABLE_HEIGHT, PREFERRED, MINIMUM, MARGIN, fitBounds }
