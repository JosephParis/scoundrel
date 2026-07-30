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
// dungeon rather than a docker container. 32 x 32 x 100 = 102,400 combinations,
// which is far more than this will ever need.
const ADJECTIVES = [
  'Ashen', 'Bitter', 'Bleak', 'Brazen', 'Candlelit', 'Cold', 'Cracked', 'Dim',
  'Dusty', 'Fading', 'Gilded', 'Grim', 'Hollow', 'Hushed', 'Iron', 'Lantern',
  'Lost', 'Muted', 'Pale', 'Quiet', 'Ragged', 'Rusted', 'Salted', 'Silent',
  'Sombre', 'Sunken', 'Tarnished', 'Thin', 'Veiled', 'Weary', 'Wan', 'Withered',
]

const NOUNS = [
  'Almoner', 'Beggar', 'Bellringer', 'Cutpurse', 'Deacon', 'Digger', 'Drifter',
  'Envoy', 'Fencer', 'Gravedigger', 'Herald', 'Hermit', 'Jester', 'Keeper',
  'Lamplighter', 'Mason', 'Miner', 'Novice', 'Pilgrim', 'Poacher', 'Reeve',
  'Sexton', 'Smith', 'Squire', 'Steward', 'Stranger', 'Tanner', 'Thief',
  'Tinker', 'Vagrant', 'Warden', 'Wretch',
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
