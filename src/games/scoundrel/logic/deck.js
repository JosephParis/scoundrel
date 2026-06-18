import { HEART, DIAMOND, CLUB, SPADE, makeMonsterCard } from '../constants'
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

// Rank bands a theme's monster mods draw from. `high` is clamped to the tier
// ceiling (bandRange) so a theme never introduces a face card above its tier.
const RANK_BANDS = {
  low: [2, 6],
  mid: [7, 10],
  high: [11, 14],
}

// A band's [lo, hi] rank range, clamped to the tier ceiling.
function bandRange(band, ceiling) {
  const [lo, hi] = RANK_BANDS[band] || RANK_BANDS.low
  return [Math.min(lo, ceiling), Math.min(hi, ceiling)]
}

// Default dungeon strength scales with progress, one face card per theme tier:
// the Quiet tops out at rank 9, then Tier 1 adds jacks, Tier 2 queens, Tier 3
// kings, Tier 4 aces. The top rank holds steady within a tier, so a new face
// card appears only when you cross into the next tier.
function defaultMonsterCeiling(sigils) {
  const s = Math.max(0, sigils || 0)
  if (s === 0) return 9    // The Quiet
  if (s <= 3) return 11    // Tier 1 (sigils 1-3): jacks
  if (s <= 5) return 12    // Tier 2 (sigils 4-5): queens
  if (s <= 7) return 13    // Tier 3 (sigils 6-7): kings
  return 14                // Tier 4 (sigils 8+): aces
}

// In the ace tier (Tier 4, sigils 8+) the rank can't climb further, so the
// dungeon escalates by volume instead: extra high-rank (J-A) monsters pile on,
// more each descent into the tier. This is also the climax tier's extra rooms.
const ACE_TIER_START_SIGIL = 8
const EXTRA_MONSTERS_PER_SIGIL = 3

// The default (non-composition) monster set: one of each club and spade from
// rank 2 up to the progress ceiling, plus the ace-tier high-rank extras above.
// 16 cards at the Quiet up to 26 at the ace tier, then +3 per descent into it.
export function buildDefaultMonsters(sigils = 0) {
  const ceiling = defaultMonsterCeiling(sigils)
  const cards = []
  for (const suit of [CLUB, SPADE]) {
    for (let r = 2; r <= ceiling; r++) {
      cards.push({ suit, rank: r, id: `${suit}${r}` })
    }
  }
  const intoAceTier = (sigils || 0) - ACE_TIER_START_SIGIL + 1
  const extra = Math.max(0, intoAceTier) * EXTRA_MONSTERS_PER_SIGIL
  for (let i = 0; i < extra; i++) {
    const rank = 11 + (i % 4)              // J, Q, K, A cycling
    const suit = i % 2 === 0 ? CLUB : SPADE
    cards.push(makeMonsterCard(suit, rank))
  }
  return cards
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

// Apply one theme's monster modifications to the (tier base) monster deck.
// Every descent starts from buildDefaultMonsters; a theme adds, removes,
// re-suits, or traits those monsters, always within the tier's rank ceiling:
//   remove:    { count, band }                drop N monsters from a band
//   add:       { count, band }                add N monsters in a band
//   suitShift: { to, fraction }               convert a fraction of the other suit
//   traits:    { armored?, fast?, warded? }   stamp on the monsters
export function applyMonsterMods(monsters, mods, ceiling, rng) {
  if (!mods) return monsters
  let out = monsters.slice()

  if (mods.remove) {
    const [lo, hi] = bandRange(mods.remove.band, ceiling)
    const pool = out.filter(m => m.rank >= lo && m.rank <= hi)
    const removeIds = new Set()
    for (let i = 0; i < mods.remove.count && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length)
      removeIds.add(pool[idx].id)
      pool.splice(idx, 1)
    }
    out = out.filter(m => !removeIds.has(m.id))
  }

  if (mods.add) {
    const [lo, hi] = bandRange(mods.add.band, ceiling)
    for (let i = 0; i < mods.add.count; i++) {
      const rank = lo + Math.floor(rng() * (hi - lo + 1))
      const suit = rng() < 0.5 ? CLUB : SPADE
      out.push(makeMonsterCard(suit, rank))
    }
  }

  if (mods.suitShift) {
    const from = mods.suitShift.to === SPADE ? CLUB : SPADE
    out = out.map(m =>
      (m.suit === from && rng() < mods.suitShift.fraction)
        ? makeMonsterCard(mods.suitShift.to, m.rank)
        : m
    )
  }

  if (mods.traits) {
    out = out.map(m => applyMonsterTraits({ ...m }, mods.traits, rng))
  }

  return out
}

// Themes that modify the deck via applyToDeck return either a plain array (the
// new deck) or an object `{ deck, log, additions?, removals? }`. Compound themes
// chain through each child's applyToDeck in order, accumulating log lines and
// per-theme card changes so the UI can animate exactly what entered/left.
//
// Every descent starts from the tier's base monster deck (buildDefaultMonsters);
// active themes modify it (applyMonsterMods, within the tier ceiling), it merges
// with the kit, then applyToDeck themes and boss injection run on the assembled
// deck before the shuffle.
export function buildDescentDeck(state, themeId, themeChildren, rng) {
  const sigils = state.sigilsEarned || 0
  const ceiling = defaultMonsterCeiling(sigils)
  const themes = themesFor(themeId, themeChildren)
  let monsterDeck = buildDefaultMonsters(sigils)
  for (const theme of themes) {
    if (theme.monsterMods) monsterDeck = applyMonsterMods(monsterDeck, theme.monsterMods, ceiling, rng)
  }
  let deck = monsterDeck.concat(state.kit || buildStartingKit())
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
