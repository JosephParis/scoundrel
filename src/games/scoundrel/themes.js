import { HEART, DIAMOND, CLUB, SPADE, SUIT_GLYPH, rankLabel } from './constants'

function fmt(card) {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
}

// "A" → "A"; "A and B" → "A and B"; "A, B, and C" → "A, B and C" (no Oxford comma).
function joinList(arr) {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]
}

// Helper for themes that sample N cards from a suit and clone them with new ids.
function sampleSuit(deck, suit, count, rng, tag, filter) {
  const pool = deck.filter(c => c.suit === suit && (!filter || filter(c)))
  const additions = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const pick = pool[Math.floor(rng() * pool.length)]
    additions.push({ ...pick, id: `${pick.id}_${tag}${i}`, themed: true })
  }
  return additions
}

export const THEMES = {
  // Tutorial descent. Only assigned by createRun({ tutorial: true })
  // on a player's first run. Not in any tier pool. The deck is built
  // manually in logic.js buildTutorialDeck and the shuffle is skipped.
  tutorial: {
    id: 'tutorial',
    name: 'Tutorial',
    description: 'A short walkthrough.',
  },

  // The opening-descent theme. Assigned to descent 1 of every run by
  // createRun(); not in any tier pool, so the dungeon never rolls it.
  the_quiet: {
    id: 'the_quiet',
    name: 'The Quiet',
    description: 'Max HP +10 this descent.',
    maxHpBonus: 10,
  },

  // ---- Tier 1 ----------------------------------------------------------

  the_crypt: {
    id: 'the_crypt',
    name: 'The Crypt',
    description: 'Adds 2 random spade face cards to the deck. Removes 1 random potion.',
    tier: 1,
    applyToDeck(deck, rng) {
      const additions = sampleSuit(deck, SPADE, 2, rng, 'crypt', c => c.rank >= 11)
      const hearts = deck.filter(c => c.suit === HEART)
      let result = deck.slice()
      const removals = []
      if (hearts.length > 0) {
        const removed = hearts[Math.floor(rng() * hearts.length)]
        removals.push(removed)
        result = result.filter(c => c.id !== removed.id)
      }
      const log = []
      if (additions.length > 0) {
        log.push(`The Crypt added ${joinList(additions.map(fmt))} to the deck.`)
      }
      if (removals.length > 0) {
        log.push(`The Crypt removed ${joinList(removals.map(fmt))} from the deck.`)
      }
      return { deck: result.concat(additions), log, additions, removals }
    },
  },

  the_armory: {
    id: 'the_armory',
    name: 'The Foundry',
    description: 'Adds 3 low-rank weapons (rank 2–5) to the deck.',
    tier: 1,
    applyToDeck(deck, rng) {
      const additions = sampleSuit(deck, DIAMOND, 3, rng, 'armory', c => c.rank <= 5)
      const log = []
      if (additions.length > 0) {
        log.push(`The Armory added ${joinList(additions.map(fmt))} to the deck.`)
      }
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  the_menagerie: {
    id: 'the_menagerie',
    name: 'The Menagerie',
    description: 'Club monsters act as 2 ranks higher this descent.',
    tier: 1,
    monsterRankBonusBySuit: { [CLUB]: 2 },
  },

  the_apothecary: {
    id: 'the_apothecary',
    name: 'The Stillery',
    description: 'Adds 2 random potions to the deck. The second potion of any room damages you for its rank instead of healing.',
    tier: 1,
    secondPotionDamages: true,
    applyToDeck(deck, rng) {
      const additions = sampleSuit(deck, HEART, 2, rng, 'apoth')
      const log = []
      if (additions.length > 0) {
        log.push(`The Apothecary added ${joinList(additions.map(fmt))} to the deck.`)
      }
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  locust_swarm: {
    id: 'locust_swarm',
    name: 'Locust Swarm',
    description: 'Adds 4 rank-2 monsters to the deck.',
    tier: 1,
    applyToDeck(deck, rng) {
      const additions = []
      for (let i = 0; i < 4; i++) {
        const suit = rng() < 0.5 ? CLUB : SPADE
        additions.push({ suit, rank: 2, id: `${suit}2_swarm${i}`, themed: true })
      }
      const log = [`Locust Swarm released ${joinList(additions.map(fmt))} into the deck.`]
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  sharpened_fangs: {
    id: 'sharpened_fangs',
    name: 'The Den',
    description: 'Every monster acts as 1 rank higher this descent.',
    tier: 1,
    monsterRankBonus: 1,
  },

  rusty_edge: {
    id: 'rusty_edge',
    name: 'The Brine',
    description: 'Weapons taken up this descent enter at 1 rank lower (minimum 2).',
    tier: 1,
    weaponRankModifier: -1,
  },

  bitter_brew: {
    id: 'bitter_brew',
    name: 'The Cellar',
    description: 'Potions heal only half their rank, rounded down.',
    tier: 1,
    potionHealHalf: true,
  },

  the_swarm: {
    id: 'the_swarm',
    name: 'The Swarm',
    description: 'The dungeon teems: 36 monsters, mostly low rank. Your tools are spread thin.',
    tier: 1,
    count: 36,
    bandWeights: { low: 4, mid: 1, high: 0 },
  },

  // ---- Tier 2 ----------------------------------------------------------

  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    description: 'Max HP −4 this descent.',
    tier: 2,
    maxHpBonus: -4,
  },

  hungry_dark: {
    id: 'hungry_dark',
    name: 'Hungry Dark',
    description: 'You cannot flee this descent.',
    tier: 3,
    cannotFlee: true,
  },

  cramped_halls: {
    id: 'cramped_halls',
    name: 'Cramped Halls',
    description: 'Rooms hold 5 cards. Clear 4 to refill.',
    tier: 2,
    roomSize: 5,
  },

  iron_bones: {
    id: 'iron_bones',
    name: 'The Catacombs',
    description: 'You cannot fight bare-handed while a usable weapon is equipped.',
    tier: 2,
    ironBones: true,
  },

  cracked_blade: {
    id: 'cracked_blade',
    name: 'The Anvil',
    description: 'Your weapon is no longer bound by rank, but it shatters if it slays a monster of higher rank than itself.',
    tier: 3,
    crackedBlade: true,
  },

  the_oath: {
    id: 'the_oath',
    name: 'The Oath',
    description: 'The first new card drawn into each room is face-down until played.',
    tier: 3,
    oath: true,
  },

  tithe: {
    id: 'tithe',
    name: 'The Toll',
    description: 'Lose 1 HP each time a room is entered.',
    tier: 2,
    tithe: 1,
  },

  the_bog: {
    id: 'the_bog',
    name: 'The Bog',
    description: 'Removes 2 random weapons from the deck.',
    tier: 2,
    applyToDeck(deck, rng) {
      const weapons = deck.filter(c => c.suit === DIAMOND)
      let result = deck.slice()
      const removals = []
      for (let i = 0; i < 2; i++) {
        const pool = weapons.filter(w => !removals.find(r => r.id === w.id))
        if (pool.length === 0) break
        const pick = pool[Math.floor(rng() * pool.length)]
        removals.push(pick)
        result = result.filter(c => c.id !== pick.id)
      }
      const log = []
      if (removals.length > 0) {
        log.push(`The Bog swallowed ${joinList(removals.map(fmt))}.`)
      }
      return { deck: result, log, additions: [], removals }
    },
  },

  the_reliquary: {
    id: 'the_reliquary',
    name: 'The Vault',
    description: 'Adds 4 aces to the deck.',
    tier: 2,
    applyToDeck(deck, rng) {
      const additions = []
      for (let i = 0; i < 4; i++) {
        const suit = rng() < 0.5 ? SPADE : CLUB
        additions.push({ suit, rank: 14, id: `${suit}14_relic${i}`, themed: true })
      }
      const log = [`The Reliquary unsealed ${joinList(additions.map(fmt))}.`]
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  the_gauntlet: {
    id: 'the_gauntlet',
    name: 'The Gauntlet',
    description: 'Few monsters (16), all mid to high rank. Dense with your tools, but every fight bites.',
    tier: 2,
    count: 16,
    bandWeights: { low: 0, mid: 1, high: 2 },
  },

  the_press: {
    id: 'the_press',
    name: 'The Press',
    description: '28 monsters, four in five of them spades. A one-suit tide.',
    tier: 2,
    count: 28,
    suitSkew: 0.8,
  },

  the_bulwark: {
    id: 'the_bulwark',
    name: 'The Bulwark',
    description: 'About two in five monsters are armored: weapons do nothing, fight them bare-handed.',
    tier: 2,
    count: 22,
    traits: { armored: 0.4 },
  },

  the_frenzy: {
    id: 'the_frenzy',
    name: 'The Frenzy',
    description: 'About a third of the monsters are fast and strike twice. Low ranks, but the hits add up.',
    tier: 2,
    count: 24,
    bandWeights: { low: 3, mid: 2, high: 0 },
    traits: { fast: 0.35 },
  },

  // ---- Tier 3 ----------------------------------------------------------

  the_snare: {
    id: 'the_snare',
    name: 'The Snare',
    description: 'About a third of the monsters are warded: you cannot flee a room while one is present.',
    tier: 3,
    count: 20,
    bandWeights: { low: 0, mid: 2, high: 1 },
    traits: { warded: 0.3 },
  },

  echo: {
    id: 'echo',
    name: 'Echo',
    description: 'Every third room: every monster present is duplicated and slid to the bottom of the deck.',
    tier: 3,
    echo: 3,
  },

  carrion: {
    id: 'carrion',
    name: 'Carrion',
    description: 'Each slain monster returns to the deck once, as a rank-2 of its suit.',
    tier: 3,
    carrion: true,
  },

  wormwood: {
    id: 'wormwood',
    name: 'Wormwood',
    description: 'One of your Boons is muted this descent.',
    tier: 2,
    wormwood: true,
  },

  the_long_night: {
    id: 'the_long_night',
    name: 'The Long Night',
    description: 'Two Tier 2 themes at once.',
    tier: 3,
    compound: true,
  },
}

const TIER_1_IDS = Object.values(THEMES).filter(t => t.tier === 1).map(t => t.id)
const TIER_2_IDS = Object.values(THEMES).filter(t => t.tier === 2).map(t => t.id)
const TIER_3_IDS = Object.values(THEMES).filter(t => t.tier === 3).map(t => t.id)

// Each band of descents draws exclusively from its own tier. Higher tiers
// crowd lower ones out as the dungeon deepens:
// - 0–2 sigils → Tier 1 only (descents 2–3)
// - 3–4 sigils → Tier 2 only (descents 4–5)
// - 5+ sigils  → Tier 3 only (descents 6–7)
function getThemePool(sigils) {
  if (sigils >= 5) return TIER_3_IDS
  if (sigils >= 3) return TIER_2_IDS
  return TIER_1_IDS
}

export function pickThemeId(rng, sigils = 0) {
  const pool = getThemePool(sigils)
  return pool[Math.floor(rng() * pool.length)]
}

// For compound themes (currently only The Long Night), pick two distinct
// Tier 2 children deterministically from the run's rng. Returns null for
// non-compound themes so callers can store a uniform `children` slot.
export function resolveThemeChildren(themeId, rng) {
  const theme = THEMES[themeId]
  if (!theme?.compound) return null
  const pool = TIER_2_IDS.slice()
  if (pool.length < 2) return null
  const aIdx = Math.floor(rng() * pool.length)
  const a = pool.splice(aIdx, 1)[0]
  const b = pool[Math.floor(rng() * pool.length)]
  return [a, b]
}

export function getTheme(id) {
  return id ? THEMES[id] : null
}

// Returns the array of theme objects whose effects apply this descent.
// For non-compound themes that's just the theme itself; for compound it's
// the resolved children. Callers iterate this and sum/combine fields.
export function getActiveThemes(themeId, themeChildren) {
  const base = getTheme(themeId)
  if (!base) return []
  if (base.compound && themeChildren) {
    return themeChildren.map(getTheme).filter(Boolean)
  }
  return [base]
}
