import { CLUB, SPADE } from './constants'

export const BOONS = {
  // ---- Combat ----------------------------------------------------------
  whetstone: {
    id: 'whetstone',
    name: 'Keen Edge',
    description: 'Equipped weapons swing at +1 effective rank.',
    example: 'Your 5♦ strikes as a 6.',
    tag: 'combat',
    weaponRankBonus: 1,
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    description: 'The first monster you fight each room deals 2 less damage.',
    example: 'A 10♠ as the first monster of a room, bare-handed, deals 8 damage instead of 10.',
    tag: 'combat',
    vanguardReduction: 2,
  },
  sworn_vendetta: {
    id: 'sworn_vendetta',
    name: 'Sworn Vendetta',
    description: 'Spade monsters deal 2 less damage.',
    example: 'A 9♠ bare-handed deals 7 instead of 9.',
    tag: 'combat',
    bonusVsSuit: SPADE,
    bonusVsSuitAmount: 2,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    description: 'Club monsters deal 2 less damage.',
    example: 'A 9♣ bare-handed deals 7 instead of 9.',
    tag: 'combat',
    bonusVsSuit: CLUB,
    bonusVsSuitAmount: 2,
  },
  wounded_lion: {
    id: 'wounded_lion',
    name: 'Wounded Lion',
    description: 'While at under 10 HP, weapons swing at +2 effective rank.',
    example: 'At 8 HP your 5♦ strikes as a 7.',
    tag: 'combat',
    woundedLion: true,
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    description: 'Weapons swing at +1 effective rank per monster you have slain this room. Resets each room.',
    example: 'Third fight in a room: your 5♦ strikes as a 7.',
    tag: 'combat',
    berserker: true,
  },
  brawler: {
    id: 'brawler',
    name: 'Brawler',
    description: 'Bare-handed fights deal 3 less damage.',
    example: 'A 9♠ taken bare-handed deals 6 instead of 9.',
    tag: 'combat',
    brawlerReduction: 3,
  },
  executioner: {
    id: 'executioner',
    name: 'Executioner',
    description: 'Bare-handed kills raise your equipped weapon\'s binding to the monster\'s rank.',
    example: "Take a Q with your fists, and your 5♦'s binding lifts to Q.",
    tag: 'build',
    executioner: true,
  },
  crushing_blow: {
    id: 'crushing_blow',
    name: 'Crushing Blow',
    description: 'If a killed monster deals no damage to you, your blade does not bind.',
    example: "A 6♣ that bounces off your effective-6 blade leaves your weapon's ceiling untouched.",
    tag: 'build',
    crushingBlow: true,
  },
  riposte: {
    id: 'riposte',
    name: 'Riposte',
    description: 'When a monster damages you, the next monster you fight deals half that much less damage (rounded down).',
    example: 'Take 4 from a monster, and the next deals 2 less.',
    tag: 'build',
    riposte: true,
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    description: 'Carry 2 weapons at once, each with its own binding. The higher-ranked usable one swings each fight.',
    example: 'Hold a 5♦ and an 8♦ at once; the higher usable one swings each fight.',
    tag: 'combat',
    quartermaster: true,
    // Temporarily removed from the offer pool while the swap-rule
    // question (DESIGN.md §9) is open. Re-enable by deleting `disabled`.
    disabled: true,
  },

  // ---- Survival --------------------------------------------------------
  iron_will: {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Max HP +3.',
    example: '20 base HP becomes 23.',
    tag: 'survival',
    maxHpBonus: 3,
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Once per descent, dropping to 3 HP or less heals you to 6.',
    example: 'Triggers automatically the first time you drop to 3 HP or less in a descent.',
    tag: 'survival',
    secondWind: true,
    // Temporarily removed from the offer pool.
    disabled: true,
  },
  soothsayer: {
    id: 'soothsayer',
    name: 'Soothsayer',
    description: 'See the top card of the deck at all times.',
    example: 'The next card to be drawn is visible at the top of the deck.',
    tag: 'survival',
    soothsayer: true,
    // Temporarily removed from the offer pool.
    disabled: true,
  },
  numb: {
    id: 'numb',
    name: 'Numb',
    description: 'Ignore the first 2 damage you take each room, from any source.',
    example: 'The first 2 damage taken each room slides off, from any source.',
    tag: 'survival',
    numb: true,
  },

  // ---- Economy ---------------------------------------------------------
  sip_of_lethe: {
    id: 'sip_of_lethe',
    name: 'Deep Draught',
    description: 'Drink up to 2 potions per room.',
    example: 'A room with an 8♥ and a 6♥ heals you 14 HP total.',
    tag: 'economy',
    potionsPerRoom: 2,
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist',
    description: 'Every potion you drink heals 2 extra HP.',
    example: 'A 6♥ heals 8 instead of 6; a 9♥ heals 11.',
    tag: 'economy',
    potionHealBonus: 2,
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    description: 'When you flee, 1 card carries into the next room: the highest-rank weapon or potion if any, otherwise the lowest-rank monster.',
    example: 'Flee a room and the strongest potion carries into the next.',
    tag: 'economy',
    pickpocket: true,
  },
  temperance: {
    id: 'temperance',
    name: 'Temperance',
    description: 'Clear a room without drinking a potion and heal 3 HP.',
    example: 'Finish a room having drunk no potion: heal 3 HP as it clears.',
    tag: 'economy',
    temperance: true,
  },
  cowards_reward: {
    id: 'cowards_reward',
    name: "Coward's Reward",
    description: 'Each time you flee, your next first-fight weapon strike swings +1 (stacks to +3, spent on use).',
    example: 'Flee twice in a row, then open the next room with a weapon strike at +2 effective rank.',
    tag: 'economy',
    cowardsReward: true,
  },

  // ---- Build-defining --------------------------------------------------
  scoundrels_cloak: {
    id: 'scoundrels_cloak',
    name: "Scoundrel's Cloak",
    description: 'Once per descent, you can flee 2 rooms in a row.',
    example: 'Chain two flees back-to-back to skip past two rooms.',
    tag: 'survival',
    cloak: true,
  },
  glass_cannon: {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Equipped weapons swing at +4 effective rank. Max HP set to 10.',
    example: 'Your 5♦ strikes as a 9. Max HP is set to 10.',
    tag: 'build',
    weaponRankBonus: 4,
    maxHpOverride: 10,
  },
  stoic: {
    id: 'stoic',
    name: 'Stoic',
    description: "You don't heal between descents. Max HP +10.",
    example: 'End a descent at 12 HP and the next begins at 12, not full.',
    tag: 'build',
    noSanctuaryHeal: true,
    maxHpBonus: 10,
  },
  twin_souls: {
    id: 'twin_souls',
    name: 'Twin Souls',
    description: 'Once per descent, a killing blow leaves you at 1 HP instead.',
    example: 'A killing blow leaves you at 1 HP instead, once per descent.',
    tag: 'survival',
    twinSouls: true,
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'See every remaining card in the deck, in order.',
    example: 'The full deck order is visible at all times.',
    tag: 'build',
    cartographer: true,
    // Temporarily removed from the offer pool.
    disabled: true,
  },
}

const ALL_BOON_IDS = Object.keys(BOONS)

// Boons unlocked for every new player from their very first run. Picked
// for being legible at first glance, covering combat/survival/economy, and
// not introducing build-defining twists (no Glass Cannon, no Stoic) until
// the player has met the basics. Everything else has to be discovered
// through play, one unlock per sigil earned (see endDescentVictory).
export const STARTER_BOON_IDS = [
  'whetstone',
  'vanguard',
  'iron_will',
  'numb',
  'sip_of_lethe',
  'alchemist',
]

// All Boons the player could *eventually* unlock. Excludes anything flagged
// `disabled` so the discovery pool stays in sync with the offer pool.
export const UNLOCKABLE_BOON_IDS = ALL_BOON_IDS.filter(id => !BOONS[id]?.disabled)

export function getBoon(id) {
  return id ? BOONS[id] : null
}

// Pick `count` Boons not already taken, drawn from the player's unlocked set.
// Bias toward tags the player has the least of so a run can't degenerate into
// "six Combat Boons in a row" (per DESIGN.md §4). Boons flagged `disabled` are
// skipped entirely. `unlocked` defaults to the starter set when not provided
// (covers older saves that pre-date the library).
export function pickBoonOffers(currentBoons, count, rng, unlocked = STARTER_BOON_IDS) {
  const taken = new Set(currentBoons)
  const unlockedSet = new Set(unlocked)
  const available = ALL_BOON_IDS.filter(
    id => !taken.has(id) && !BOONS[id]?.disabled && unlockedSet.has(id)
  )
  if (available.length <= count) return available

  const tagCounts = currentBoons.reduce((acc, id) => {
    const tag = BOONS[id]?.tag || 'misc'
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {})

  // Weight = 1 / (1 + tagCount). Heavier weight = more likely to be picked.
  const weighted = available.map(id => {
    const tag = BOONS[id]?.tag || 'misc'
    return { id, weight: 1 / (1 + (tagCounts[tag] || 0)) }
  })

  const offers = []
  const pool = weighted.slice()
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((s, x) => s + x.weight, 0)
    let roll = rng() * total
    let idx = 0
    for (; idx < pool.length; idx++) {
      roll -= pool[idx].weight
      if (roll <= 0) break
    }
    if (idx >= pool.length) idx = pool.length - 1
    offers.push(pool[idx].id)
    pool.splice(idx, 1)
  }
  return offers
}
