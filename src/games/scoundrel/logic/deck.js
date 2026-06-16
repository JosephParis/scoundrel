import { HEART, DIAMOND, CLUB, SPADE, makeKitCard, makeMonsterCard } from '../constants'
import { isEnabled as isFlagEnabled } from '../flags'
import { rollBossForDescent } from '../bosses'
import { themesFor } from './helpers'

// -- Base deck ---------------------------------------------------------

// The dungeon's monster half: clubs and spades, ranks 2-14 (face cards and
// aces included). 26 cards. The player never edits these; the dungeon owns them.
export function buildBaseMonsters() {
  const cards = []
  for (const suit of [CLUB, SPADE]) {
    for (let r = 2; r <= 14; r++) {
      cards.push({ suit, rank: r, id: `${suit}${r}` })
    }
  }
  return cards
}

// The full tool half: hearts and diamonds, ranks 2-10 (no red face cards or
// aces). 18 cards. Retained for buildBaseDeck and any external callers.
export function buildBaseTools() {
  const cards = []
  for (const suit of [DIAMOND, HEART]) {
    for (let r = 2; r <= 10; r++) {
      cards.push({ suit, rank: r, id: `${suit}${r}` })
    }
  }
  return cards
}

// The base 44-card Scoundrel deck: monster half + full tool half.
export function buildBaseDeck() {
  return buildBaseMonsters().concat(buildBaseTools())
}

// The player's starting kit: the "low ten". Diamonds 2-6 and hearts 2-6.
// Seeded into state.kit by createRun; persists and is edited across the run.
export function buildStartingKit() {
  const cards = []
  for (const suit of [DIAMOND, HEART]) {
    for (let r = 2; r <= 6; r++) {
      cards.push({ suit, rank: r, id: `${suit}${r}` })
    }
  }
  return cards
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// -- Dungeon monster set (per-descent) ---------------------------------

// Rank bands the dungeon samples from. low/mid/high let a theme skew the
// monster distribution without enumerating every rank.
const RANK_BANDS = {
  low: [2, 6],
  mid: [7, 10],
  high: [11, 14],
}

// The default dungeon: the canonical 26-card monster half, deterministic and
// identical to today. Themes that omit a composition payload use this, so
// existing themes are unchanged; dilution and rank-skew enter only through
// composition themes.
export const DEFAULT_DUNGEON = { canonical: true }

function pickBand(weights, rng) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [band, w] of entries) {
    roll -= w
    if (roll < 0) return band
  }
  return entries[entries.length - 1][0]
}

// Stamp at most one trait on a sampled monster per the spec's `traits`
// probabilities (armored / fast / warded). Mutates and returns the card.
function applyMonsterTraits(card, traits, rng) {
  if (!traits) return card
  if (rng() < (traits.armored ?? 0)) card.armored = true
  else if (rng() < (traits.fast ?? 0)) card.fast = true
  else if (rng() < (traits.warded ?? 0)) card.warded = true
  return card
}

// Build the dungeon's monster set for a descent from a composition spec:
//   { canonical: true }                          -> the deterministic 26
//   { count, bandWeights, suitSkew, traits }     -> sampled set of `count` monsters
// bandWeights default to an even low/mid/high spread; suitSkew is the chance a
// monster is a spade (vs club), default 0.5; traits stamps armored/fast/warded.
export function buildDungeonMonsters(rng, spec = DEFAULT_DUNGEON) {
  if (!spec || spec.canonical) return buildBaseMonsters()
  const weights = spec.bandWeights || { low: 1, mid: 1, high: 1 }
  const suitSkew = spec.suitSkew ?? 0.5
  const out = []
  for (let i = 0; i < spec.count; i++) {
    const band = pickBand(weights, rng)
    const [lo, hi] = RANK_BANDS[band]
    const rank = lo + Math.floor(rng() * (hi - lo + 1))
    const suit = rng() < suitSkew ? SPADE : CLUB
    out.push(applyMonsterTraits(makeMonsterCard(suit, rank), spec.traits, rng))
  }
  return out
}

// Resolve the dungeon composition spec for the descent. Composition rides on
// the theme (one roll per descent); the first active theme that defines a
// `count` wins, else the canonical default. Compound themes thus take the
// first child that carries a spec.
export function resolveDungeonSpec(themeId, themeChildren) {
  const themes = themesFor(themeId, themeChildren)
  const withSpec = themes.find(t => t && t.count != null)
  if (!withSpec) return DEFAULT_DUNGEON
  return {
    count: withSpec.count,
    bandWeights: withSpec.bandWeights,
    suitSkew: withSpec.suitSkew,
    traits: withSpec.traits,
  }
}

// Roll the plain weapon/potion the Inscribe verb can offer this visit. Rank is
// capped by run progress (4 + sigils, max 10); the player takes one or skips.
export function rollInscribeCandidates(rng, sigils) {
  const cap = Math.min(10, 4 + sigils)
  const rollRank = () => 2 + Math.floor(rng() * (cap - 1)) // 2..cap inclusive
  return {
    weapon: makeKitCard(DIAMOND, rollRank()),
    potion: makeKitCard(HEART, rollRank()),
  }
}

// Themes that modify the deck return either a plain array (the new deck) or
// an object `{ deck, log, additions?, removals? }`. Compound themes chain
// through each child's applyToDeck in order, accumulating log lines and
// per-theme card changes so the UI can animate exactly what entered/left.
//
// The descent deck is the dungeon's per-descent monster set (rolled from the
// theme's composition spec) merged with the player's kit, then shuffled. Theme
// deck-mutations (tool disruption, monster adds) and boss injection run on the
// assembled deck.
export function buildDescentDeck(state, themeId, themeChildren, rng) {
  const spec = resolveDungeonSpec(themeId, themeChildren)
  const monsterDeck = buildDungeonMonsters(rng, spec)
  let deck = monsterDeck.concat(state.kit || buildStartingKit())
  const themes = themesFor(themeId, themeChildren)
  let extraLog = []
  const changes = []
  for (const theme of themes) {
    if (!theme.applyToDeck) continue
    const result = theme.applyToDeck(deck, rng)
    if (Array.isArray(result)) {
      deck = result
    } else {
      deck = result.deck
      extraLog = extraLog.concat(result.log || [])
      const additions = result.additions || []
      const removals = result.removals || []
      if (additions.length > 0 || removals.length > 0) {
        changes.push({ themeId: theme.id, themeName: theme.name, additions, removals })
      }
    }
  }
  // Boss injection: appended pre-shuffle so it lands somewhere random in
  // the resulting deck like any other card. Gated by the 'bosses' flag.
  if (isFlagEnabled('bosses')) {
    const boss = rollBossForDescent(rng)
    if (boss) deck = deck.concat(boss)
  }
  return { deck: shuffle(deck, rng), log: extraLog, changes }
}

// Hand-curated tutorial deck. 22 cards. Order matters and we skip
// the shuffle so the tutorial hits each lesson in sequence. The cue
// in DescentView.computeTutorialCue is the source of truth for what
// "smart play" looks like; this deck is designed so following the
// cue's arrow lands every lesson cleanly.
//
//   Room 1 dealt: 5♦ 3♣ 2♥ 7♠
//     equip 5♦, swing 7♠ (largest first, binds 7), swing 3♣ (binds 3).
//     Carry 2♥. -> equip, fight, binding awareness.
//   Room 2 (refill 6♦ 4♣ 5♥ + 2♥): 4♣ is locked at binding 3.
//     Replace 6♦ (unlocks 4♣), swing 4♣, drink 2♥ (heals exactly 2).
//     Carry 5♥. -> replace, potion.
//   Room 3 (refill 9♠ 10♠ 9♣ + 5♥): all monsters locked, no weapon,
//     no useful potion (HP full). -> flee.
//   Post-flee deal: 8♦ 8♥ 6♣ 7♥. 6♣ is locked at binding 4.
//     Replace 8♦, swing 6♣. Two potions remain at full HP — cue goes
//     silent, player plays them through.
//   Room 5 (refill 5♣ 6♥ 7♣ + carryover): 7♣ is locked at binding 6.
//     Swing 5♣ (binds 5), bare-hand 7♣ (lone locked, safe to absorb),
//     drink 7♥ (heals exactly back to full). -> bare hands.
//   Room 6 (refill 7♦ 8♠ 10♦ + carryover): bound weapon vs 8♠. A
//     tutorial-specific override in computeTutorialCue stages a two-
//     step lesson: replace into 7♦ (smaller than 10♦ on purpose), then
//     bare-hand 8♠ to keep that fresh swing for the bigger monster
//     waiting in the deck. -> replace + bare hands (strategic).
//   Tail (5♠ 10♣ + cycled-back cards): lessons are done by this point.
//     The cue stops; the player finishes the walk freely.
export function buildTutorialDeck() {
  return [
    // Room 1
    { suit: DIAMOND, rank: 5, id: 'tut_d5' },
    { suit: CLUB,    rank: 3, id: 'tut_c3' },
    { suit: HEART,   rank: 2, id: 'tut_h2' },
    { suit: SPADE,   rank: 7, id: 'tut_s7' },
    // Room 2
    { suit: DIAMOND, rank: 6, id: 'tut_d6' },
    { suit: CLUB,    rank: 4, id: 'tut_c4' },
    { suit: HEART,   rank: 10, id: 'tut_h10' },
    // Room 3 (forces flee)
    { suit: SPADE,   rank: 9,  id: 'tut_s9' },
    { suit: SPADE,   rank: 10, id: 'tut_s10' },
    { suit: CLUB,    rank: 9,  id: 'tut_c9' },
    // Post-flee deal
    { suit: DIAMOND, rank: 8, id: 'tut_d8' },
    { suit: HEART,   rank: 8, id: 'tut_h8' },
    { suit: CLUB,    rank: 6, id: 'tut_c6' },
    { suit: HEART,   rank: 7, id: 'tut_h7' },
    // Room 4
    { suit: CLUB,    rank: 5, id: 'tut_c5' },
    { suit: HEART,   rank: 6, id: 'tut_h6' },
    { suit: CLUB,    rank: 7, id: 'tut_c7' },
    // Room 5
    { suit: DIAMOND, rank: 7, id: 'tut_d7' },
    { suit: SPADE,   rank: 8, id: 'tut_s8' },
    { suit: DIAMOND, rank: 10, id: 'tut_d10' },
    // Tail
    { suit: SPADE,   rank: 5,  id: 'tut_s5' },
    { suit: CLUB,    rank: 10, id: 'tut_c10' },
  ]
}
