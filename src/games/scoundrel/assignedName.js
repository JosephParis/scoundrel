/**
 * The name every player has before they choose one.
 *
 * The board used to list a player who never opened Settings as "Anonymous".
 * That read as a bug rather than a choice, and it was worse than it looked:
 * every unnamed guest shares `account_id 'guest'` and coalesces to the same
 * empty handle, so api/leaderboard.js put all of them in a single bucket and
 * showed one row for the lot. The second-fastest unnamed guest simply did not
 * appear on a board they had earned a place on.
 *
 * So everyone gets a name up front -- "Ashen Vagrant 47" -- drawn from the same
 * vocabulary as the analytics pseudonyms. It is assigned, not asked for: the
 * player is never stopped to fill in a field, and the one who does not care
 * still lands on the board under something in the game's register. Changing it
 * is an edit, not a blank page, which is the whole point.
 *
 * Two properties this deliberately keeps from the old design:
 *
 * - **Nothing is derived from the player's Google profile.** The seed is a
 *   random per-device id, so an assigned name says nothing about who its owner
 *   is. That was the rule when the handle was opt-in and it still holds.
 * - **A player can still be listed as Anonymous**, by asking for it in Settings
 *   (settings.anonymous). Assigning a name changes the default, not the choice.
 *
 * @see src/utils/pseudonym.js for the shared vocabulary
 * @see src/games/scoundrel/settings.js for how this combines with a typed handle
 */
import { ADJECTIVES, NOUNS } from '../../utils/pseudonym'
import { MAX_HANDLE_LENGTH, sanitizeHandle } from './handle'
import { isHandleAllowed } from './handleDenylist'

const DEVICE_KEY = 'scoundrel:deviceId'

/**
 * Pairs that fit a leaderboard handle, with room for the two-digit suffix.
 *
 * pseudonymFor() is not reused directly because it has no length budget:
 * "Candlelit Lamplighter 99" is 24 characters and a handle has 16. Filtering
 * here rather than trimming there keeps the analytics label unabbreviated and
 * still leaves 679 of the 1024 pairs, which with the suffix is 67,900 names.
 *
 * That is not collision-free and does not need to be. Two guests landing on the
 * same name share a leaderboard bucket -- which is precisely what every unnamed
 * guest does today, so even a collision is no worse than the behaviour this
 * replaces. At a few hundred players the odds of any collision at all are small.
 *
 * Denylisted pairs are dropped as well. None of the current vocabulary trips the
 * filter, but the word lists on both sides can grow, and the game handing a
 * player a name its own server would strip is not a failure worth risking.
 */
const PAIRS = ADJECTIVES.flatMap(adjective =>
  NOUNS.map(noun => `${adjective} ${noun}`),
).filter(pair => pair.length + 3 <= MAX_HANDLE_LENGTH && isHandleAllowed(`${pair} 00`))

// FNV-1a, 32-bit -- the same hash pseudonym.js uses, for the same reason: it is
// picking a word, not protecting a secret.
function hash32(input) {
  let h = 0x811c9dc5
  const s = String(input)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * A stable assigned name for a seed, e.g. "Ashen Vagrant 47".
 *
 * Deterministic: the same seed always gives the same name, so a player's name
 * survives a reload without being stored separately from the seed itself.
 *
 * @param {string} seed - the device id, or any stable string
 * @returns {string} a name that fits MAX_HANDLE_LENGTH and passes the denylist
 */
export function assignedNameFor(seed) {
  const h = hash32(seed)
  // Different shifts so the pair and the number are not correlated: two seeds
  // that differ slightly should not land on adjacent-looking names.
  const pair = PAIRS[h % PAIRS.length]
  const number = (h >>> 16) % 100
  return `${pair} ${number}`
}

/**
 * The device's own id, minted once and kept.
 *
 * Guests have no account to key on -- they all post as 'guest' -- so the only
 * thing that can tell two of them apart is something stored on the device. This
 * is that thing, and it is used for nothing else.
 *
 * Deliberately NOT the account id, even for a signed-in player. Seeding from
 * the account would rename someone the moment they signed in, which reads as
 * the game taking their name away. The cost is that one player on two devices
 * gets two assigned names; for a signed-in player the board groups by account
 * regardless, so only one of them is ever shown.
 *
 * @returns {string} a stable random id, or a per-session one if storage is off
 */
export function deviceSeed() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const minted = mintSeed()
    localStorage.setItem(DEVICE_KEY, minted)
    return minted
  } catch {
    // Private browsing, or storage disabled. A fresh seed each session means
    // the name is not stable, which is a far smaller failure than throwing on
    // the way to the leaderboard.
    return mintSeed()
  }
}

function mintSeed() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    // Fall through to the arithmetic path below.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Fresh names to offer as suggestions, e.g. on the victory screen.
 *
 * Random rather than seeded: this is the reroll, and a player pressing it wants
 * different names, not the same three in a different order. Distinct within a
 * batch, and never offers a name the player is already using.
 *
 * @param {number} count - how many to return
 * @param {string} [exclude] - a name to keep out of the results
 * @returns {string[]} up to `count` distinct names
 */
export function nameSuggestions(count = 3, exclude = '') {
  const skip = sanitizeHandle(exclude).trim().toLowerCase()
  const out = []
  // Bounded rather than "loop until full": with 679 pairs a duplicate is rare,
  // but a caller asking for more names than exist must not hang the render.
  for (let i = 0; out.length < count && i < count * 20; i++) {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)]
    const name = `${pair} ${Math.floor(Math.random() * 100)}`
    if (name.toLowerCase() === skip) continue
    if (!out.includes(name)) out.push(name)
  }
  return out
}

/** Exported for tests: how many names this can produce. */
export const NAME_SPACE = PAIRS.length * 100
