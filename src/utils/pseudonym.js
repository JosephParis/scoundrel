/**
 * Deterministic, human-readable pseudonyms for analytics.
 *
 * PostHog used to receive each player's real email and display name. It no
 * longer does (issue 06): the only identity sent is the Google `sub`, which is
 * an opaque per-application id -- it carries no personal data and cannot be
 * resolved back to a person without Google. Keeping `sub` as the distinct_id
 * also means PostHog events can still be cross-referenced with the `runs` table,
 * which keys on the same value as `accountId`.
 *
 * The cost of dropping the name is an unreadable PostHog UI: every person shows
 * as a long number. This restores legibility without restoring the personal
 * data, by deriving a stable label from the id itself. Same player, same device
 * or not, always the same pseudonym -- and nothing about it reveals who they are.
 *
 * Collisions between players are possible and harmless: identity is the
 * distinct_id, and this is only a label shown beside it.
 */

// FNV-1a, 32-bit. Chosen for being tiny and well-distributed, not for being
// cryptographic -- it is picking a word, not protecting a secret.
function hash32(input) {
  let h = 0x811c9dc5
  const s = String(input)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // >>> 0 keeps this in unsigned 32-bit range; Math.imul avoids the precision
    // loss a plain multiply would hit.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// Deliberately in the game's register, so a PostHog session list reads like the
// dungeon rather than a docker container. 44 x 44 x 100 = 193,600 combinations,
// which is far more than this will ever need.
//
// Exported because the player-facing assigned name (assignedName.js) draws on
// the same two lists. One vocabulary rather than two that drift apart -- but
// note the two have different rules: this one may produce any length and joins
// with spaces, while an assigned name is concatenated and has to fit
// MAX_HANDLE_LENGTH, so that module composes these itself rather than reusing
// pseudonymFor directly.
//
// Both lists grew by twelve on 2026-09-06, to widen the assigned-name space.
// The new words are short on purpose: the assigned name spends its whole
// character budget on the pair, so a long word costs more there than here.
//
// Growing either list RENAMES EVERY EXISTING PSEUDONYM -- the pick is a modulo
// of the list length, so a different length moves every id to a different word.
// That is accepted rather than overlooked: a pseudonym is a label beside the
// distinct_id, never the identity itself (see the note at the top of this
// file), so a PostHog profile keeps its history and its events and only reads
// under a new name. An assigned name is a different matter and assignedName.js
// says what happens there.
export const ADJECTIVES = [
  'Ashen', 'Bitter', 'Bleak', 'Blunt', 'Brazen', 'Candlelit', 'Charred', 'Cold',
  'Cracked', 'Damp', 'Dim', 'Drowned', 'Dusty', 'Fading', 'Frayed', 'Gaunt',
  'Gilded', 'Grim', 'Hollow', 'Hushed', 'Iron', 'Lantern', 'Leaden', 'Lost',
  'Muted', 'Numb', 'Pale', 'Quiet', 'Ragged', 'Rusted', 'Salted', 'Scarred',
  'Silent', 'Sodden', 'Sombre', 'Starved', 'Sunken', 'Tarnished', 'Thin',
  'Veiled', 'Wan', 'Weary', 'Withered', 'Worn',
]

export const NOUNS = [
  'Almoner', 'Baker', 'Beggar', 'Bellringer', 'Carter', 'Cooper', 'Curate',
  'Cutpurse', 'Deacon', 'Digger', 'Drifter', 'Dyer', 'Envoy', 'Fencer',
  'Fuller', 'Glazier', 'Gravedigger', 'Harper', 'Herald', 'Hermit', 'Jester',
  'Keeper', 'Lamplighter', 'Mason', 'Miner', 'Monk', 'Novice', 'Pilgrim',
  'Poacher', 'Potter', 'Reeve', 'Sawyer', 'Scribe', 'Sexton', 'Smith',
  'Squire', 'Steward', 'Stranger', 'Tanner', 'Thief', 'Tinker', 'Vagrant',
  'Warden', 'Wretch',
]

/**
 * A stable pseudonym for an account id, e.g. "Ashen Vagrant 47".
 *
 * Three independent slices of the hash pick each part, so two ids that differ
 * only slightly do not land on adjacent-looking names.
 *
 * @param {string} accountId - the Google `sub`, or any stable id
 * @returns {string} pseudonym, or 'Guest' when there is no id
 */
export function pseudonymFor(accountId) {
  if (!accountId || accountId === 'guest') return 'Guest'
  const h = hash32(accountId)
  const adjective = ADJECTIVES[h % ADJECTIVES.length]
  // Different shifts so the three components are not correlated.
  const noun = NOUNS[(h >>> 8) % NOUNS.length]
  const number = (h >>> 16) % 100
  return `${adjective} ${noun} ${number}`
}
