import { HEART, DIAMOND, CLUB, SPADE } from '../constants'
import { isEnabled as isFlagEnabled } from '../flags'
import { rollBossForDescent } from '../bosses'
import { themesFor } from './helpers'

// -- Base deck ---------------------------------------------------------

export function buildBaseDeck() {
  const cards = []
  for (const suit of [HEART, DIAMOND, CLUB, SPADE]) {
    for (let r = 2; r <= 14; r++) {
      const isRed = suit === HEART || suit === DIAMOND
      if (isRed && r >= 11) continue
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

// The "persistent deck": base 44 minus strikes, with transmutes and hefts
// applied, plus any inscribed cards. IDs are stable across these edits.
// Used by the Forge UI and as the starting point for buildDescentDeck.
export function computeCurrentDeck(state) {
  let deck = buildBaseDeck()
  const strikeSet = new Set(state.strikes)
  deck = deck.filter(c => !strikeSet.has(c.id))
  deck = deck.map(c => {
    let result = c
    if (state.transmutes[c.id]) {
      result = {
        ...result,
        suit: state.transmutes[c.id],
        transmuted: true,
        originalSuit: c.suit,
      }
    }
    const heftBonus = state.hefts?.[c.id]
    if (heftBonus) {
      result = {
        ...result,
        rank: result.rank + heftBonus,
        hefted: true,
        heftBonus,
        preHeftRank: c.rank,
      }
    }
    return result
  })
  const inscribed = state.inscribed || []
  if (inscribed.length > 0) {
    deck = deck.concat(inscribed)
  }
  return deck
}

// Themes that modify the deck return either a plain array (the new deck) or
// an object `{ deck, log, additions?, removals? }`. Compound themes chain
// through each child's applyToDeck in order, accumulating log lines and
// per-theme card changes so the UI can animate exactly what entered/left.
export function buildDescentDeck(state, themeId, themeChildren, rng) {
  let deck = computeCurrentDeck(state)
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
