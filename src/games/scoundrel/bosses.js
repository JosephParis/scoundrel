import { CLUB, SPADE } from './constants'

// Bosses are normal monster cards (CLUB or SPADE so isMonster passes) with
// extra behavior keyed off card.boss. One random boss is shuffled into the
// descent deck under the 'bosses' flag; from there each entry's mechanic
// lives in the combat / preview code paths. This file is the data table.
//
// ----------------------------------------------------------------------
// To add a new boss:
//   1. Add an entry below with { id, name, description, suit, and either
//      `rank` (fixed) or `rankRange: [min, max]` (rolled at descent start).
//   2. Add any mechanic-specific data field (the existing ones are
//      documented as Mechanic fields below). Reuse one if it fits, or
//      introduce a new field plus a hook in the right gameplay module:
//        - effectiveMonsterRank   (logic/helpers.js)    rank manipulation
//        - getMonsterDamage       (logic/combat.js)     combat-time effects
//        - applyMonsterFight      (logic/combat.js)     on-kill hooks
//        - applyRoomEntryEffects  (logic/combat.js)     when a room forms
//        - describeDamage         (logic/sanctuary.js)  so the preview matches
//   3. (Optional) add a custom icon path in BOSS_ICON_PATHS in
//      components/SuitIcon.jsx. Without one, the card renders with the
//      regular suit silhouette.
//
// Mechanic fields currently in use:
//   rank               fixed effective rank baseline
//   rankRange          [min, max], rolled at descent start (Mimic)
//   dynamicRank        string key picked up by effectiveMonsterRank (Devourer)
//   chain              spawn ladder, ranks (The Brood)
//   copyRoomOnEnter    when the boss is in a freshly-formed room, every
//                      other slot becomes a plain copy of the boss (Mimic)
//   roomMonsterRankBonus  +N to every other monster's effective rank while
//                      the boss is in the room (The Warden)
// ----------------------------------------------------------------------
export const BOSSES = {
  hollow_one: {
    id: 'hollow_one',
    name: 'The Hollow One',
    description: 'Weapon strikes against it count for half (rounded down). Bare hands hit at full rank.',
    rank: 14,
    suit: SPADE,
  },
  the_brood: {
    id: 'the_brood',
    name: 'The Brood',
    description: 'When killed, a smaller copy spawns and shuffles into the deck. The chain: 9 → 6 → 4 → 2.',
    rank: 9,
    suit: CLUB,
    chain: [9, 6, 4, 2],
  },
  devourer: {
    id: 'devourer',
    name: 'The Devourer',
    description: 'Effective rank is 3 plus the ranks of your last 3 killed monsters.',
    rank: 3,
    suit: SPADE,
    dynamicRank: 'lastKilled3',
  },
  mimic: {
    id: 'mimic',
    name: 'The Mimic',
    description: 'Rank rolled 7-10 each descent. Whenever a room forms with it present, every other card in the room becomes a plain copy of it.',
    rankRange: [7, 10],
    suit: CLUB,
    copyRoomOnEnter: true,
  },
  warden: {
    id: 'warden',
    name: 'The Warden',
    description: 'Every other monster in the room with it hits at +3 effective rank.',
    rank: 13,
    suit: SPADE,
    roomMonsterRankBonus: 3,
  },
}

export const BOSS_IDS = Object.keys(BOSSES)

let bossCounter = 0

function nextBossUid() {
  bossCounter += 1
  return `${bossCounter}_${Date.now().toString(36)}`
}

function rollRank(boss, rng) {
  if (boss.rankRange) {
    const [min, max] = boss.rankRange
    return min + Math.floor(rng() * (max - min + 1))
  }
  return boss.rank
}

// Build a fresh boss card. Brood starts at step 0 so the first kill spawns
// step-1 (rank 6). Other bosses ignore the broodStep field. `rng` is used
// for `rankRange` rolls; defaults to Math.random for ad-hoc creation.
export function makeBossCard(id, rng = Math.random) {
  const boss = BOSSES[id]
  if (!boss) return null
  return {
    suit: boss.suit,
    rank: rollRank(boss, rng),
    id: `boss_${id}_${nextBossUid()}`,
    boss: id,
    ...(id === 'the_brood' ? { broodStep: 0 } : null),
  }
}

// Make the next Brood child after a kill at `step` (0-indexed). Returns
// null when the chain is exhausted (step >= chain.length - 1, since we
// spawn the *next* step).
export function makeBroodSpawn(parentId, fromStep) {
  const chain = BOSSES.the_brood.chain
  const nextStep = fromStep + 1
  if (nextStep >= chain.length) return null
  return {
    suit: BOSSES.the_brood.suit,
    rank: chain[nextStep],
    id: `${parentId}_step${nextStep}_${nextBossUid()}`,
    boss: 'the_brood',
    broodStep: nextStep,
  }
}

export function isBoss(card) {
  return !!card && !!card.boss
}

export function getBoss(id) {
  return BOSSES[id]
}

// Pick one boss for the descent. Caller is responsible for adding the
// returned card to the deck before shuffle.
export function rollBossForDescent(rng) {
  const idx = Math.floor(rng() * BOSS_IDS.length)
  return makeBossCard(BOSS_IDS[idx], rng)
}

// Devourer rank resolver. Called from effectiveMonsterRank.
export function devourerEffectiveRank(state) {
  const ranks = state.lastKilledMonsterRanks || []
  return 3 + ranks.reduce((s, r) => s + r, 0)
}

// Sum of `roomMonsterRankBonus` across every boss currently in the room
// other than `card` itself. Used by effectiveMonsterRank and the sanctuary
// damage preview so face-card auras (The Warden) read at their live value.
export function roomBossAuraBonus(state, card) {
  let total = 0
  for (const c of state.room || []) {
    if (!c || c.id === card.id || !c.boss) continue
    total += BOSSES[c.boss]?.roomMonsterRankBonus || 0
  }
  return total
}
