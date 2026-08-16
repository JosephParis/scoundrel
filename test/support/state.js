// Shared fixtures for the game-logic unit tests (issue 15).
//
// The `logic/` modules are pure functions over a plain state object with an
// injected `rng`, so a test only needs to hand them a state literal. This file
// exists so each test file doesn't re-declare the twenty fields combat reads
// but doesn't care about.
//
// Not named `*.test.js`, so vitest's `include` does not collect it.

import { CLUB, SPADE, DIAMOND, HEART } from '../../src/games/scoundrel/constants'

// Deterministic 32-bit PRNG (mulberry32). Same seed, same sequence, so a test
// that asserts on a shuffle or a forge roll stays stable across runs.
export function seededRng(seed = 1) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// An rng that returns the given values in order, then repeats the last one.
// Useful when a branch is chosen by a single `rng() < 0.5` and the test wants
// to pin which side it takes.
export function scriptedRng(values) {
  let i = 0
  return () => {
    const v = values[Math.min(i, values.length - 1)]
    i += 1
    return v
  }
}

export const monster = (suit, rank, extra = {}) => ({ suit, rank, id: `${suit}${rank}`, ...extra })
export const club = (rank, extra) => monster(CLUB, rank, extra)
export const spade = (rank, extra) => monster(SPADE, rank, extra)
export const weaponCard = (rank, extra = {}) => ({ suit: DIAMOND, rank, id: `D${rank}`, ...extra })
export const potionCard = (rank, extra = {}) => ({ suit: HEART, rank, id: `H${rank}`, ...extra })

// An equipped weapon (the object that lives at state.weapon), which is a
// different shape from the diamond card that was played to get it.
export const equipped = (rank, extra = {}) => ({
  rank,
  originalRank: rank,
  lastSlain: null,
  ...extra,
})

// A mid-descent state with nothing exotic switched on: no theme, no boons, no
// afflictions, full HP. Override anything via `overrides`.
export function descentState(overrides = {}) {
  return {
    phase: 'descent',
    hp: 20,
    maxHp: 20,
    deck: [],
    room: [null, null, null, null],
    discard: [],
    kit: [],
    log: [],
    weapon: null,
    spareWeapon: null,
    boons: [],
    boonPicks: [],
    theme: null,
    themeChildren: null,
    afflictions: {},
    mutedBoon: null,
    ascension: 0,
    sigilsEarned: 0,
    monstersFoughtThisRoom: 0,
    potionsUsedThisRoom: 0,
    monstersSlain: 0,
    biggestKill: 0,
    roomsEntered: 0,
    runRoomsEntered: 0,
    canFlee: true,
    cloakUsed: false,
    cloakArmed: false,
    riposteCharge: 0,
    vengefulBonus: 0,
    lastKilledMonsterRanks: [],
    descents: [],
    tutorial: false,
    rng: seededRng(42),
    ...overrides,
  }
}

// A sanctuary state, for the forge tests.
export function sanctuaryState(overrides = {}) {
  return {
    ...descentState(),
    phase: 'sanctuary',
    forgeOpen: true,
    forgeGrants: [],
    forgeGrantIndex: 0,
    forgeChoices: [],
    forgeInscribedIds: [],
    forgeEdits: [],
    kitEdits: 0,
    ...overrides,
  }
}

// Put a room together with the cards under test in the first slots. Keeps the
// room at ROOM_SIZE so `checkRefillAndComplete` doesn't fire while a test is
// still asserting on the pre-refill state.
export function roomOf(...cards) {
  const room = cards.slice()
  while (room.length < 4) room.push(null)
  return room
}
