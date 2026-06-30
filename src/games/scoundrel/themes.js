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

  // ---- Light themes: deck fill and mild bias (tiers 1-2) ----------------
  // Tier is the `tier` field below, not source order; these dividers are a
  // rough grouping only.

  the_crypt: {
    id: 'the_crypt',
    name: 'The Crypt',
    description: 'Adds 2 random spade face cards to the deck. Removes 1 random potion.',
    tier: 2,
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
    description: 'Adds 3 rank-2 weapons to the deck.',
    tier: 1,
    applyToDeck(deck) {
      const additions = []
      for (let i = 0; i < 3; i++) {
        additions.push({ suit: DIAMOND, rank: 2, id: `${DIAMOND}2_foundry${i}`, themed: true })
      }
      const log = []
      if (additions.length > 0) {
        log.push(`The Foundry added ${joinList(additions.map(fmt))} to the deck.`)
      }
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  the_menagerie: {
    id: 'the_menagerie',
    name: 'The Menagerie',
    description: 'Club monsters act as 2 ranks higher this descent.',
    tier: 2,
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
    name: 'Lesser Swarm',
    description: 'Adds 4 rank-2 monsters to the deck.',
    tier: 1,
    applyToDeck(deck, rng) {
      const additions = []
      for (let i = 0; i < 4; i++) {
        const suit = rng() < 0.5 ? CLUB : SPADE
        additions.push({ suit, rank: 2, id: `${suit}2_swarm${i}`, themed: true })
      }
      const log = [`The Lesser Swarm released ${joinList(additions.map(fmt))} into the deck.`]
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  sharpened_fangs: {
    id: 'sharpened_fangs',
    name: 'The Den',
    description: 'Every monster acts as 1 rank higher this descent.',
    tier: 2,
    monsterRankBonus: 1,
  },

  rusty_edge: {
    id: 'rusty_edge',
    name: 'The Brine',
    description: 'Weapons taken up this descent enter at 1 rank lower (minimum 2).',
    tier: 2,
    weaponRankModifier: -1,
  },

  bitter_brew: {
    id: 'bitter_brew',
    name: 'The Cellar',
    description: 'Potions heal only half their rank, rounded down.',
    tier: 2,
    potionHealHalf: true,
  },

  the_swarm: {
    id: 'the_swarm',
    name: 'Greater Swarm',
    description: 'Adds 14 monsters of rank 2-6 to the deck.',
    tier: 2,
    monsterMods: { add: { count: 14, band: 'low' } },
  },

  // ---- Rule changes and harder bias (tiers 3-5) ------------------------

  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    description: 'Max HP −4 this descent.',
    tier: 3,
    maxHpBonus: -4,
  },

  hungry_dark: {
    id: 'hungry_dark',
    name: 'Hungry Dark',
    description: 'You cannot flee this descent.',
    tier: 5,
    cannotFlee: true,
  },

  cramped_halls: {
    id: 'cramped_halls',
    name: 'Cramped Halls',
    description: 'Rooms hold 5 cards. Clear 4 to refill.',
    tier: 4,
    roomSize: 5,
  },

  iron_bones: {
    id: 'iron_bones',
    name: 'The Catacombs',
    description: 'You cannot fight bare-handed while a usable weapon is equipped.',
    tier: 4,
    ironBones: true,
  },

  cracked_blade: {
    id: 'cracked_blade',
    name: 'The Anvil',
    description: 'Your weapon is no longer bound by rank, but it shatters if it slays a monster of higher rank than itself.',
    tier: 5,
    crackedBlade: true,
  },

  the_oath: {
    id: 'the_oath',
    name: 'The Oath',
    description: 'The first new card drawn into each room is face-down until played.',
    tier: 4,
    oath: true,
  },

  tithe: {
    id: 'tithe',
    name: 'The Toll',
    description: 'Lose 1 HP each time a room is entered.',
    tier: 3,
    tithe: 1,
  },

  the_bog: {
    id: 'the_bog',
    name: 'The Bog',
    description: 'Removes 2 random weapons from the deck.',
    tier: 3,
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
    description: "Adds 4 copies of the deck's strongest monster.",
    tier: 3,
    applyToDeck(deck, rng) {
      const monsterRanks = deck.filter(c => c.suit === SPADE || c.suit === CLUB).map(c => c.rank)
      const top = monsterRanks.length ? Math.max(...monsterRanks) : 10
      const additions = []
      for (let i = 0; i < 4; i++) {
        const suit = rng() < 0.5 ? SPADE : CLUB
        additions.push({ suit, rank: top, id: `${suit}${top}_relic${i}`, themed: true })
      }
      const log = [`The Reliquary unsealed ${joinList(additions.map(fmt))}.`]
      return { deck: deck.concat(additions), log, additions, removals: [] }
    },
  },

  the_gauntlet: {
    id: 'the_gauntlet',
    name: 'The Gauntlet',
    description: 'Removes 8 monsters of rank 2-6 from the deck.',
    tier: 4,
    monsterMods: { remove: { count: 8, band: 'low' } },
  },

  the_press: {
    id: 'the_press',
    name: 'The Press',
    description: 'About 3 in 5 club monsters become spades.',
    tier: 3,
    monsterMods: { suitShift: { to: SPADE, fraction: 0.6 } },
  },

  the_bulwark: {
    id: 'the_bulwark',
    name: 'The Bulwark',
    description: 'About 2 in 5 monsters are armored: weapons do nothing, fight them bare-handed.',
    tier: 4,
    monsterMods: { traits: { armored: 0.4 } },
  },

  the_frenzy: {
    id: 'the_frenzy',
    name: 'The Frenzy',
    description: 'About 2 in 5 monsters are relentless: they hit you twice, dealing their damage a second time.',
    tier: 4,
    monsterMods: { traits: { relentless: 0.4 } },
  },

  the_veil: {
    id: 'the_veil',
    name: 'The Veil',
    description: 'About 3 in 10 monsters are shrouded: they sit face-down, and you fight them without seeing their rank.',
    tier: 4,
    monsterMods: { traits: { shrouded: 0.3 } },
  },

  the_murk: {
    id: 'the_murk',
    name: 'The Murk',
    description: 'The whole hall is Obscured: card ranks stay hidden, so you see each card\'s kind but never how strong it is.',
    tier: 4,
    ambientAffliction: { id: 'obscured', rooms: 1 },
  },

  // ---- Compounding and climax effects (tier 5) -------------------------

  the_snare: {
    id: 'the_snare',
    name: 'The Snare',
    description: 'About 3 in 10 monsters are warded: you cannot flee a room while one is present.',
    tier: 5,
    monsterMods: { traits: { warded: 0.3 } },
  },

  the_grudge: {
    id: 'the_grudge',
    name: 'The Grudge',
    description: 'About 3 in 10 monsters are vengeful: when one dies, every other monster in the room hits at +1 for the rest of the room.',
    tier: 5,
    monsterMods: { traits: { vengeful: 0.3 } },
  },

  the_glut: {
    id: 'the_glut',
    name: 'The Glut',
    description: 'About 1 in 4 monsters are swelling: each hits at +1 for every monster already slain in the room.',
    tier: 5,
    monsterMods: { traits: { swelling: 0.25 } },
  },

  the_gloom: {
    id: 'the_gloom',
    name: 'The Gloom',
    description: 'About 3 in 10 monsters are cursed: slaying one leaves you Blind, so the next room shows only card backs.',
    tier: 5,
    monsterMods: { traits: { cursed: { chance: 0.3, inflicts: 'blind', rooms: 1 } } },
  },

  the_hex: {
    id: 'the_hex',
    name: 'The Hex',
    description: 'About 3 in 10 monsters are cursed: slaying one Seals your wounds, so healing restores nothing for 2 rooms.',
    tier: 5,
    monsterMods: { traits: { cursed: { chance: 0.3, inflicts: 'sealed', rooms: 2 } } },
  },

  the_leech: {
    id: 'the_leech',
    name: 'The Leech',
    description: 'About 1 in 4 monsters are cursed: slaying one leaves you Bleeding, costing 2 HP at each threshold for 2 rooms.',
    tier: 5,
    monsterMods: { traits: { cursed: { chance: 0.25, inflicts: 'bleeding', rooms: 2 } } },
  },

  echo: {
    id: 'echo',
    name: 'Echo',
    description: 'Every third room: every monster present is duplicated and slid to the bottom of the deck.',
    tier: 5,
    echo: 3,
  },

  carrion: {
    id: 'carrion',
    name: 'Carrion',
    description: 'Each slain monster returns to the deck once, as a rank-2 of its suit.',
    tier: 5,
    carrion: true,
  },

  wormwood: {
    id: 'wormwood',
    name: 'Wormwood',
    description: 'One of your Boons is muted this descent.',
    tier: 3,
    wormwood: true,
  },

  the_long_night: {
    id: 'the_long_night',
    name: 'The Long Night',
    description: 'Two Tier 3 themes at once.',
    tier: 5,
    compound: true,
  },
}

const TIER_1_IDS = Object.values(THEMES).filter(t => t.tier === 1).map(t => t.id)
const TIER_2_IDS = Object.values(THEMES).filter(t => t.tier === 2).map(t => t.id)
const TIER_3_IDS = Object.values(THEMES).filter(t => t.tier === 3).map(t => t.id)
const TIER_4_IDS = Object.values(THEMES).filter(t => t.tier === 4).map(t => t.id)
const TIER_5_IDS = Object.values(THEMES).filter(t => t.tier === 5).map(t => t.id)

// Each band of descents draws exclusively from its own tier, tracking the
// dungeon's rising monster ceiling. The 10-descent run splits 1 / 1 / 2 / 2 / 3
// after the Quiet, giving the ace climax extra descents:
// - sigil 1   → Tier 1 (descent 2, tens)
// - sigil 2   → Tier 2 (descent 3, jacks)
// - sigils 3–4 → Tier 3 (descents 4–5, queens)
// - sigils 5–6 → Tier 4 (descents 6–7, kings)
// - sigils 7+  → Tier 5 (descents 8–10, aces)
function getThemePool(sigils) {
  if (sigils >= 7) return TIER_5_IDS
  if (sigils >= 5) return TIER_4_IDS
  if (sigils >= 3) return TIER_3_IDS
  if (sigils >= 2) return TIER_2_IDS
  return TIER_1_IDS
}

// excludeId drops the previous descent's theme so the dungeon never rolls
// the same theme two descents in a row within a tier band (e.g. Tier 5
// spans descents 8-10). Every tier pool has >=3 themes, so removing one is
// always safe; the guard keeps a 1-theme pool from collapsing to nothing.
export function pickThemeId(rng, sigils = 0, excludeId = null) {
  const full = getThemePool(sigils)
  const pool = excludeId ? full.filter(id => id !== excludeId) : full
  const choices = pool.length > 0 ? pool : full
  return choices[Math.floor(rng() * choices.length)]
}

// For compound themes (currently only The Long Night), pick two distinct
// Tier 3 children deterministically from the run's rng. Returns null for
// non-compound themes so callers can store a uniform `children` slot.
export function resolveThemeChildren(themeId, rng) {
  const theme = THEMES[themeId]
  if (!theme?.compound) return null
  const pool = TIER_3_IDS.slice()
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
