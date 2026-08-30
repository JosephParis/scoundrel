/**
 * Content screening for the public leaderboard handle (issue 08).
 *
 * `sanitizeHandle` in settings.js restricts the character set, which stops
 * injection and layout breakage and does nothing about what the letters spell.
 * This module is the second half: it decides whether a handle is publishable.
 *
 * Shared by the client (settings modal, so the player is told before they
 * commit) and by api/runs.js (so it holds for a hand-rolled POST, which the
 * client check cannot). Plain JS with no imports for exactly that reason --
 * api/_lib/validate.js already reaches into this directory the same way.
 *
 * Matching is deliberately dumb and deliberately narrow. Two tiers, because one
 * blunt substring pass either misses the obvious dodges or eats real handles:
 *
 * - SUBSTRING_TERMS match anywhere, after leetspeak folding and repeated-letter
 *   collapsing. Reserved for strings that essentially never occur inside an
 *   innocent English word.
 * - WORD_TERMS match only as a whole word. These are the ones with common
 *   hosts -- "spic" sits inside "suspicious", "coon" inside "raccoon", "rape"
 *   inside "grape" -- so a substring pass here would reject real people.
 *
 * The seed lists below are a floor, not a solution. They catch the lazy
 * attempt, which is most of them at this scale; a determined person will get
 * something through, and the answer to that is the blocklist plus row delete,
 * not a longer word list. Extend the lists when something gets through, and
 * note which tier it belongs in.
 */

// Leetspeak folding: the substitutions someone reaches for first. Applied
// before matching, so "n1gg3r" and "nigger" normalize to the same string.
const LEET = {
  '4': 'a', '@': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '1': 'i',
  '!': 'i', '|': 'i', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't',
  '2': 'z', '9': 'g',
}

// Matched anywhere in the normalized handle. Keep to strings that do not occur
// inside ordinary words -- check before adding, since a false positive here
// silently keeps a real player off the board.
const SUBSTRING_TERMS = [
  'nigg', 'nigr', 'niger', 'faggot', 'kike', 'chink', 'tranny', 'trannie',
  'retard', 'gook', 'wetback', 'towelhead', 'raghead', 'hitler', 'nazi',
  'kkk', 'goatse', 'whore', 'molest', 'incest', 'beastiality', 'bestiality',
]

// Real words that host a substring term and have to survive it. A handle whose
// whole word is one of these is dropped before the substring scan, so "Nazir"
// (a given name) and "Nigerian" stay usable while "xXnaziXx" does not. Only
// substring-tier hosts belong here -- the word tier already has boundaries.
//
// This list grows by report: when a real handle is refused, add the word here
// rather than deleting the term, since the term is doing its job elsewhere.
const ALLOWED_WORDS = [
  'nazir', 'nazira', 'nazim', 'nigeria', 'nigerian', 'nigerien',
  'retardant', 'retardants',
]

// Matched only as a whole word, because each has a common innocent host:
// suspicious, raccoon, grape, Cassandra, Scunthorpe, assassin, Dickinson.
const WORD_TERMS = [
  'spic', 'coon', 'rape', 'rapist', 'ass', 'cum', 'fag', 'dyke', 'jap',
  'twat', 'slut', 'shit', 'fuck', 'bitch', 'dick', 'cock', 'penis',
  'vagina', 'porn', 'cunt', 'pedo', 'heil',
]

// Names that would let one player pass for the game or its operator. Matched
// against the whole normalized handle, so "Sigilbane" is fine and "S1G1L" is
// not.
const RESERVED_HANDLES = [
  'admin', 'administrator', 'moderator', 'mod', 'staff', 'support',
  'official', 'system', 'sigil', 'sigildeck', 'server', 'root', 'null',
  'undefined', 'anonymous',
]

/**
 * Fold a handle to the form the lists are matched against: lowercase, leetspeak
 * resolved, everything that is not a letter or digit turned into a single
 * space. Separators become spaces rather than vanishing, so the word tier can
 * still see word boundaries in "my_ass_here".
 */
export function normalizeHandle(raw) {
  const folded = String(raw ?? '')
    .toLowerCase()
    .split('')
    .map(ch => LEET[ch] ?? ch)
    .join('')
  return folded.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

// "niiiiiger" -> "niger". Collapsing runs is what makes the substring tier
// resistant to padding; it is NOT applied to the word tier, where it would
// turn "assess" into "ases" and generally make boundaries meaningless.
function collapseRuns(text) {
  return text.replace(/(.)\1+/g, '$1')
}

/**
 * Why this handle cannot be published, or null when it is fine.
 * Returns 'reserved' for impersonation of the game or its operators, and
 * 'denylisted' for content. Callers phrase the message; this only classifies.
 */
export function handleRejectionReason(raw) {
  const normalized = normalizeHandle(raw)
  if (!normalized) return null

  const words = normalized.split(' ')
  const squashed = words.join('')
  if (RESERVED_HANDLES.includes(squashed)) return 'reserved'

  // Separators are dropped before the substring scan, so "n_i_g_g_e_r" is seen
  // as one string -- but an allowlisted word is dropped whole rather than
  // joined, so it cannot form a term with its neighbours either.
  const scannable = words.filter(w => !ALLOWED_WORDS.includes(w)).join('')
  const collapsed = collapseRuns(scannable)
  for (const term of SUBSTRING_TERMS) {
    if (scannable.includes(term) || collapsed.includes(term)) return 'denylisted'
  }

  for (const word of words) {
    if (WORD_TERMS.includes(word)) return 'denylisted'
  }
  return null
}

/** True when the handle is publishable on the leaderboard. */
export function isHandleAllowed(raw) {
  return handleRejectionReason(raw) === null
}
