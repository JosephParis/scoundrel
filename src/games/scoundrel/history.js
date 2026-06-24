/**
 * Pure helpers that turn a finished run's game state into a stored record,
 * and aggregate stored records into lifetime stats. No React, no storage,
 * no side effects: easy to test and to feed from either the end-of-run
 * screen or the history modal.
 */

import { getMode } from './constants'
import { getAscension } from './ascensions'
import { BOONS } from './boons'
import { getTheme } from './themes'

// v2 added `death` (where/how the run ended). v3 added the decision funnels
// `boonPicks` and `forgeEdits` (offered-vs-chosen). Older records simply lack
// the newer fields; readers treat them as null/[].
const RECORD_VERSION = 3
const GUEST_ID = 'guest'

function outcomeOf(state) {
  if (state.phase === 'victory') return 'victory'
  if (state.retired) return 'retired'
  return 'death'
}

// The kit as it stood when the run ended, serialized down to the fields the
// card fan needs to render. Lets the summary show the final deck the same way
// the rest of the game does, rather than a text list of edits.
function endingDeckOf(state) {
  return (state.kit || []).map((card, i) => ({
    id: card.id ?? `deck_${i}`,
    suit: card.suit,
    rank: card.rank,
    upgraded: card.upgraded || false,
    upgradeBonus: card.upgradeBonus || 0,
    inscribed: card.inscribed || null,
  }))
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
    endingDeck: endingDeckOf(state),
    themesFaced: namedThemes(state),
    bossesDefeated: state.bossesDefeated || [],
    roomsEntered: state.runRoomsEntered || 0,
    monstersSlain: state.monstersSlain || 0,
    biggestKill: state.biggestKill || 0,
    finalWeapon: finalWeaponOf(state),
    // Where and how the run ended. Only populated on death; victory and
    // retire leave it null.
    death: outcomeOf(state) === 'death' ? (state.deathContext || null) : null,
    // Decision funnels: every boon pick and forge edit this run, offered vs
    // chosen. Analytics-only; not shown in-app.
    boonPicks: state.boonPicks || [],
    forgeEdits: state.forgeEdits || [],
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
