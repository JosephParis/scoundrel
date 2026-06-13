/**
 * Pure helpers that turn a finished run's game state into a stored record,
 * and aggregate stored records into lifetime stats. No React, no storage,
 * no side effects: easy to test and to feed from either the end-of-run
 * screen or the history modal.
 */

import { getMode, INSCRIBED_FRAMES } from './constants'
import { getAscension } from './ascensions'
import { BOONS } from './boons'
import { getTheme } from './themes'

const RECORD_VERSION = 1
const GUEST_ID = 'guest'

function outcomeOf(state) {
  if (state.phase === 'victory') return 'victory'
  if (state.retired) return 'retired'
  return 'death'
}

// Forge edits, collapsed to the parts worth showing in a summary: the list of
// inscribed cards (frame name + rank) plus counts of the other three edits.
function deckChangesOf(state) {
  const inscribed = (state.inscribed || []).map(card => {
    const frame = INSCRIBED_FRAMES[card.inscribed]
    return { frame: card.inscribed, name: frame?.name || card.inscribed, rank: card.rank }
  })
  // strikes stores a flat [monsterId, offeringId] pair per removal.
  const struck = Math.floor((state.strikes || []).length / 2)
  return {
    inscribed,
    transmuted: Object.keys(state.transmutes || {}).length,
    hefted: Object.keys(state.hefts || {}).length,
    struck,
  }
}

function namedThemes(state) {
  return (state.themesFaced || []).map(id => ({ id, name: getTheme(id)?.name || id }))
}

function namedBoons(state) {
  return (state.boons || []).map(id => ({ id, name: BOONS[id]?.name || id }))
}

function finalWeaponOf(state) {
  // Victory carries the weapon out; death/retire reads the live weapon.
  const w = state.carriedWeapon || state.weapon
  if (!w) return null
  return { rank: w.rank, originalRank: w.originalRank ?? w.rank }
}

/**
 * Build a stored record from a terminal game state.
 * @param {object} state - game state with phase 'victory' or 'gameover'
 * @param {object|null} user - signed-in user ({ sub }) or null for guest
 */
export function buildRunRecord(state, user) {
  const now = Date.now()
  const startedAt = state.runStartedAt || now
  return {
    v: RECORD_VERSION,
    id: `run_${startedAt}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: user?.sub || GUEST_ID,
    startedAt,
    endedAt: now,
    durationMs: Math.max(0, now - startedAt),
    outcome: outcomeOf(state),
    sigilsEarned: state.sigilsEarned || 0,
    sigilTarget: state.sigilTarget || 0,
    mode: { id: state.mode, name: getMode(state.mode)?.name || state.mode },
    ascension: state.ascension || 0,
    ascensionName: getAscension(state.ascension)?.name || null,
    boons: namedBoons(state),
    deckChanges: deckChangesOf(state),
    themesFaced: namedThemes(state),
    bossesDefeated: state.bossesDefeated || [],
    roomsEntered: state.runRoomsEntered || 0,
    monstersSlain: state.monstersSlain || 0,
    biggestKill: state.biggestKill || 0,
    finalWeapon: finalWeaponOf(state),
  }
}

/** Aggregate a list of records into lifetime stats for the header panel. */
export function computeLifetimeStats(records) {
  const totalRuns = records.length
  let wins = 0
  let deaths = 0
  let retires = 0
  let totalSigils = 0
  let bestAscensionCleared = -1
  let longestRunRooms = 0
  let mostKills = 0

  for (const r of records) {
    if (r.outcome === 'victory') {
      wins += 1
      if ((r.ascension || 0) > bestAscensionCleared) bestAscensionCleared = r.ascension || 0
    } else if (r.outcome === 'retired') {
      retires += 1
    } else {
      deaths += 1
    }
    totalSigils += r.sigilsEarned || 0
    if ((r.roomsEntered || 0) > longestRunRooms) longestRunRooms = r.roomsEntered || 0
    if ((r.monstersSlain || 0) > mostKills) mostKills = r.monstersSlain || 0
  }

  return {
    totalRuns,
    wins,
    deaths,
    retires,
    winRate: totalRuns > 0 ? Math.round((wins / totalRuns) * 100) : 0,
    totalSigils,
    // -1 means "no victory yet"; callers render that as a dash.
    bestAscensionCleared,
    longestRunRooms,
    mostKills,
  }
}
