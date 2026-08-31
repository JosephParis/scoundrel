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
// slashes — and short enough to sit in a board row without truncation.
//
// Nothing here is ever derived from the player's Google profile. A handle is
// either typed by its owner or assigned at random (assignedName.js); neither
// route can leak who they are.
export const MAX_HANDLE_LENGTH = 16

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
