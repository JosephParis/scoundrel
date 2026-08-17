// Deck construction and the seeded shuffle (issue 15, priority 5).
//
// These are the cheapest invariants in the whole rules engine to break: a
// stray rank bound turns "44-card Scoundrel deck" into something else and no
// screenshot test notices.

import { describe, it, expect } from 'vitest'
import {
  buildBaseMonsters, buildBaseTools, buildBaseDeck, buildStartingKit,
  buildDefaultMonsters, applyMonsterMods, shuffle, buildTutorialDeck,
} from '../src/games/scoundrel/logic/deck'
import { CLUB, SPADE, DIAMOND, HEART, isMonster } from '../src/games/scoundrel/constants'
import { seededRng, scriptedRng } from './support/state'

const ranks = cards => cards.map(c => c.rank)
const suits = cards => new Set(cards.map(c => c.suit))

describe('buildBaseDeck', () => {
  it('is the 44-card Scoundrel deck: 26 monsters + 18 tools', () => {
    expect(buildBaseMonsters()).toHaveLength(26)
    expect(buildBaseTools()).toHaveLength(18)
    expect(buildBaseDeck()).toHaveLength(44)
  })

  it('puts clubs and spades on ranks 2-14, hearts and diamonds on 2-10', () => {
    const monsters = buildBaseMonsters()
    expect(suits(monsters)).toEqual(new Set([CLUB, SPADE]))
    expect(Math.min(...ranks(monsters))).toBe(2)
    expect(Math.max(...ranks(monsters))).toBe(14)

    const tools = buildBaseTools()
    expect(suits(tools)).toEqual(new Set([DIAMOND, HEART]))
    expect(Math.min(...ranks(tools))).toBe(2)
    expect(Math.max(...ranks(tools))).toBe(10)
  })

  it('gives every card a unique id', () => {
    const deck = buildBaseDeck()
    expect(new Set(deck.map(c => c.id)).size).toBe(deck.length)
  })
})

describe('buildStartingKit', () => {
  it('is the low ten: diamonds 2-6 and hearts 2-6', () => {
    const kit = buildStartingKit()
    expect(kit).toHaveLength(10)
    expect(kit.filter(c => c.suit === DIAMOND).map(c => c.rank)).toEqual([2, 3, 4, 5, 6])
    expect(kit.filter(c => c.suit === HEART).map(c => c.rank)).toEqual([2, 3, 4, 5, 6])
  })

  it('contains no monsters, so the kit can never poison the dungeon half', () => {
    expect(buildStartingKit().some(isMonster)).toBe(false)
  })

  it('returns a fresh array each call, so editing one run does not leak', () => {
    const a = buildStartingKit()
    a[0].rank = 99
    expect(buildStartingKit()[0].rank).toBe(2)
  })
})

describe('buildDefaultMonsters', () => {
  // One rank per theme tier: 9 at the Quiet, then 10, 11, queens, kings, aces.
  it.each([
    [0, 9],
    [1, 10],
    [2, 11],
    [3, 12],
    [4, 12],
    [5, 13],
    [6, 13],
    [7, 14],
  ])('caps the top rank at the tier ceiling (sigils %i -> rank %i)', (sigils, ceiling) => {
    const monsters = buildDefaultMonsters(sigils)
    expect(Math.max(...ranks(monsters))).toBe(ceiling)
    expect(Math.min(...ranks(monsters))).toBe(2)
  })

  it('deals one of each club and spade up to the ceiling below the ace tier', () => {
    // 8 ranks (2-9) x 2 suits at the Quiet.
    expect(buildDefaultMonsters(0)).toHaveLength(16)
    // 12 ranks (2-13) x 2 suits at Tier 4.
    expect(buildDefaultMonsters(5)).toHaveLength(24)
  })

  it('escalates by volume once the rank ceiling tops out at aces', () => {
    // Rank can climb no further in Tier 5, so each further descent piles on
    // three more high-rank monsters instead.
    const base = 26 // ranks 2-14 x 2 suits
    expect(buildDefaultMonsters(7)).toHaveLength(base + 3)
    expect(buildDefaultMonsters(8)).toHaveLength(base + 6)
    expect(buildDefaultMonsters(9)).toHaveLength(base + 9)
  })

  it('draws the ace-tier extras from the face cards only', () => {
    const extras = buildDefaultMonsters(9).slice(26)
    expect(extras).toHaveLength(9)
    for (const c of extras) expect(c.rank).toBeGreaterThanOrEqual(11)
    expect(new Set(extras.map(c => c.id)).size).toBe(extras.length)
  })

  it('treats a missing or negative sigil count as the Quiet', () => {
    expect(buildDefaultMonsters()).toHaveLength(16)
    expect(buildDefaultMonsters(-3)).toHaveLength(16)
  })
})

describe('applyMonsterMods', () => {
  const base = () => buildDefaultMonsters(5) // ranks 2-13, 26 cards

  it('is a no-op with no mods, and never mutates its input', () => {
    const monsters = base()
    const snapshot = JSON.stringify(monsters)
    expect(applyMonsterMods(monsters, null, 13, seededRng(1))).toBe(monsters)
    applyMonsterMods(monsters, { add: { count: 3, band: 'high' } }, 13, seededRng(1))
    expect(JSON.stringify(monsters)).toBe(snapshot)
  })

  it('removes the requested count from within the named band', () => {
    const monsters = base()
    const out = applyMonsterMods(monsters, { remove: { count: 4, band: 'low' } }, 13, seededRng(7))
    expect(out).toHaveLength(monsters.length - 4)
    const gone = monsters.filter(m => !out.some(o => o.id === m.id))
    for (const c of gone) expect(c.rank).toBeLessThanOrEqual(6)
  })

  it('cannot remove more than the band holds', () => {
    const monsters = base()
    // The low band is ranks 2-6: 5 ranks x 2 suits = 10 cards.
    const out = applyMonsterMods(monsters, { remove: { count: 999, band: 'low' } }, 13, seededRng(3))
    expect(out).toHaveLength(monsters.length - 10)
  })

  it('adds monsters inside the band, clamped to the tier ceiling', () => {
    // Ceiling 10 (Tier 1) with a `high` band (11-14) must not mint a face card.
    const out = applyMonsterMods([], { add: { count: 20, band: 'high' } }, 10, seededRng(11))
    expect(out).toHaveLength(20)
    for (const c of out) expect(c.rank).toBe(10)
  })

  it('suit-shifts only the opposite suit, keeping the rank', () => {
    const monsters = base()
    // fraction 1 converts every club.
    const out = applyMonsterMods(monsters, { suitShift: { to: SPADE, fraction: 1 } }, 13, seededRng(5))
    expect(out.every(c => c.suit === SPADE)).toBe(true)
    expect(ranks(out).sort((a, b) => a - b)).toEqual(ranks(monsters).sort((a, b) => a - b))
  })

  it('leaves the deck alone when the shift fraction never rolls', () => {
    const monsters = base()
    const out = applyMonsterMods(monsters, { suitShift: { to: SPADE, fraction: 0 } }, 13, seededRng(5))
    expect(out.filter(c => c.suit === CLUB)).toHaveLength(monsters.filter(c => c.suit === CLUB).length)
  })

  it('stamps at most one trait per monster', () => {
    // Every probability at 1: the if/else-if chain must still stop at the first.
    const traits = {
      armored: 1, relentless: 1, warded: 1, shrouded: 1, vengeful: 1, swelling: 1,
      cursed: { chance: 1, inflicts: 'bleeding', rooms: 2 },
    }
    const out = applyMonsterMods(base(), { traits }, 13, seededRng(2))
    for (const c of out) {
      const stamped = ['armored', 'relentless', 'warded', 'shrouded', 'vengeful', 'swelling', 'cursed']
        .filter(t => c[t])
      expect(stamped).toEqual(['armored'])
    }
  })

  it('gives a cursed monster its affliction payload', () => {
    const traits = { cursed: { chance: 1, inflicts: 'sealed', rooms: 3 } }
    const out = applyMonsterMods(base(), { traits }, 13, seededRng(2))
    for (const c of out) {
      expect(c.cursed).toBe(true)
      expect(c.afflicts).toEqual({ id: 'sealed', rooms: 3 })
    }
  })

  it('stamps nothing when every probability misses', () => {
    // rng always returns 0.99, above every threshold below.
    const traits = { armored: 0.5, relentless: 0.5, cursed: { chance: 0.5, inflicts: 'bleeding', rooms: 1 } }
    const out = applyMonsterMods(base(), { traits }, 13, scriptedRng([0.99]))
    expect(out.some(c => c.armored || c.relentless || c.cursed)).toBe(false)
  })
})

describe('shuffle', () => {
  it('is a permutation: same cards, new array, input untouched', () => {
    const deck = buildBaseDeck()
    const before = deck.map(c => c.id)
    const out = shuffle(deck, seededRng(9))
    expect(out).not.toBe(deck)
    expect(deck.map(c => c.id)).toEqual(before)
    expect(out.map(c => c.id).sort()).toEqual(before.slice().sort())
  })

  it('is deterministic under a seeded rng', () => {
    const deck = buildBaseDeck()
    const a = shuffle(deck, seededRng(123)).map(c => c.id)
    const b = shuffle(deck, seededRng(123)).map(c => c.id)
    expect(a).toEqual(b)
    expect(shuffle(deck, seededRng(124)).map(c => c.id)).not.toEqual(a)
  })

  it('handles the empty and single-card cases', () => {
    expect(shuffle([], seededRng(1))).toEqual([])
    expect(shuffle([{ id: 'x' }], seededRng(1))).toEqual([{ id: 'x' }])
  })
})

describe('buildTutorialDeck', () => {
  // The curated walk is order-sensitive: DescentView's cue assumes this exact
  // sequence, so a reorder silently breaks the tutorial rather than failing.
  it('is 22 cards in a fixed order with unique ids', () => {
    const deck = buildTutorialDeck()
    expect(deck).toHaveLength(22)
    expect(new Set(deck.map(c => c.id)).size).toBe(22)
    expect(buildTutorialDeck().map(c => c.id)).toEqual(deck.map(c => c.id))
  })

  it('opens on the room the equip/fight/binding lesson needs', () => {
    expect(buildTutorialDeck().slice(0, 4).map(c => `${c.suit}${c.rank}`))
      .toEqual(['D5', 'C3', 'H2', 'S7'])
  })
})
