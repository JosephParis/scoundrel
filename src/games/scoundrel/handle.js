/**
 * What a leaderboard handle is allowed to be.
 *
 * Split out of settings.js because three modules now need these two and only
 * these two: settings.js (which stores a typed handle), assignedName.js (which
 * generates one that has to fit), and history.js (which clamps the value on its
 * way into a stored record, and previously kept its own copy of the length with
 * a comment asking the reader to keep the two in sync). One definition rather
 * than two that can disagree.
 *
 * settings.js re-exports both, so `from './settings'` keeps working.
 */

// The public leaderboard credits runs to a handle. Kept deliberately narrow so
// nothing resembling contact details can be typed in — no '@', no dots, no
// slashes.
//
// The length is a judgement, not a constraint, and it is worth being honest
// about which. Nothing technical requires a number here: `handles.name` and
// `name_key` are both plain `text`, playerName rides inside the run record's
// JSON, and the board row has carried Tailwind's `truncate` since it was
// written — an overlong name ellipsises, it does not break the layout. The
// comment here used to claim the cap was what kept a row intact. It never was.
//
// What the cap actually buys is that the board holds NAMES rather than
// MESSAGES. Given thirty characters somebody writes a sentence in the ranking.
// That is the property being defended, and 24 is where it was set on
// 2026-09-06 — up from 16, which had been inherited from the days when a handle
// was typed and opt-in rather than assigned to everybody.
//
// Nothing here is ever derived from the player's Google profile. A handle is
// either typed by its owner or assigned at random (assignedName.js); neither
// route can leak who they are.
export const MAX_HANDLE_LENGTH = 24

/**
 * Normalize a typed handle: drop anything outside letters, digits, spaces,
 * hyphens and underscores, collapse runs of whitespace, and clamp the length.
 * Returns '' for a handle that is empty or made entirely of rejected
 * characters, which readers treat as "this player has typed no name" — not as
 * "keep this run off the board", which is now a separate, explicit choice
 * (settings.anonymous).
 *
 * Leading whitespace is dropped but a single trailing space is kept: this runs
 * on every keystroke of a controlled input, and trimming the end would eat the
 * space the moment it is typed, making a two-word handle impossible to enter.
 * Readers trim before storing or displaying, and since a leading space can
 * never survive, no handle can consist only of whitespace.
 */
export function sanitizeHandle(raw) {
  return String(raw ?? '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MAX_HANDLE_LENGTH)
}
