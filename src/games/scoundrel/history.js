/**
 * Pure helpers that turn a finished run's game state into a stored record,
 * and aggregate stored records into lifetime stats. No React, no storage,
 * no side effects: easy to test and to feed from either the end-of-run
 * screen or the history modal.
 */

import { getMode, GAME_VERSION } from './constants'
import { getAscension } from './ascensions'
import { BOONS } from './boons'
import { getTheme } from './themes'

// v2 added `death` (where/how the run ended). v3 added the decision funnels
// `boonPicks` and `forgeEdits` (offered-vs-chosen). v4 added `retire` (soft
// death), the per-descent `descents` timeline, and denormalized run-shape
// counts. v5 added `gameVersion` (the balance version stamp, for filtering
// analytics by ruleset). v6 added `dev` (the run touched the Dev overrides
// tool, so it is test data and admin stats exclude it). v7 added `playerName`
// (the abbreviated display name shown on the public leaderboard). Older
// records simply lack the newer fields; readers treat them as null/[]/0/false.
const RECORD_VERSION = 7
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

/**
 * The name a run is credited to on the public leaderboard. Abbreviated to a
 * first name plus a last initial ("Alex Rivera" → "Alex R.") so the board
 * stays readable without publishing anyone's full Google profile name, and so
 * only the shortened form is ever stored in the record we mirror to the
 * server. Guests get null; the leaderboard renders those as "Anonymous".
 *
 * A name containing '@' is an email: initGoogleSignIn falls back to the email
 * when a Google profile carries no display name, and an email address must
 * never reach a public board. Those runs stay anonymous.
 * @param {object|null} user - signed-in user ({ name, email }) or null
 */
export function leaderboardName(user) {
  const raw = (user?.name || '').trim()
  if (!raw || raw.includes('@')) return null
  const parts = raw.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 24)
  const first = parts[0].slice(0, 24)
  const initial = parts[parts.length - 1][0]
  return `${first} ${initial.toUpperCase()}.`
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
  // Paused wall-clock: accumulated total plus any pause still open at run end.
  const pausedMs = (state.pausedMs || 0) + (state.pausedAt ? Math.max(0, now - state.pausedAt) : 0)
  const outcome = outcomeOf(state)
  const endingDeck = endingDeckOf(state)
  return {
    v: RECORD_VERSION,
    // Balance version live when the run ended. Lets analytics filter every stat
    // to one ruleset so retuned boons/themes don't pollute comparisons.
    gameVersion: GAME_VERSION,
    // True if the Dev overrides tool was applied during this run. Such runs are
    // test data: kept locally for the tester but excluded from admin stats.
    dev: state.devUsed === true,
    id: `run_${startedAt}_${Math.random().toString(36).slice(2, 8)}`,
    // Stable per-run token (set at run start, unlike `id` which is fresh each
    // build). Part of the dedupe key so two devices' guest runs can't collide
    // on a shared startedAt. Absent on legacy runs; readers fall back then.
    runSeed: state.runSeed || null,
    accountId: user?.sub || GUEST_ID,
    // Abbreviated display name for the public leaderboard. Null for guests.
    playerName: leaderboardName(user),
    startedAt,
    endedAt: now,
    durationMs: Math.max(0, now - startedAt - pausedMs),
    outcome,
    sigilsEarned: state.sigilsEarned || 0,
    sigilTarget: state.sigilTarget || 0,
    mode: { id: state.mode, name: getMode(state.mode)?.name || state.mode },
    ascension: state.ascension || 0,
    ascensionName: getAscension(state.ascension)?.name || null,
    boons: namedBoons(state),
    endingDeck,
    themesFaced: namedThemes(state),
    bossesDefeated: state.bossesDefeated || [],
    roomsEntered: state.runRoomsEntered || 0,
    monstersSlain: state.monstersSlain || 0,
    biggestKill: state.biggestKill || 0,
    finalWeapon: finalWeaponOf(state),
    // Where and how the run ended. Only the matching outcome is populated.
    death: outcome === 'death' ? (state.deathContext || null) : null,
    retire: outcome === 'retired' ? (state.retireContext || null) : null,
    // Per-descent timeline: one entry per descent (theme, HP arc, outcome).
    descents: state.descents || [],
    // Decision funnels: every boon pick and forge edit this run, offered vs
    // chosen. Analytics-only; not shown in-app.
    boonPicks: state.boonPicks || [],
    forgeEdits: state.forgeEdits || [],
    // Denormalized run-shape counts, promoted to top-level so common queries
    // don't dig through endingDeck. Derivable from the arrays above.
    kitEdits: state.kitEdits || 0,
    boonCount: (state.boons || []).length,
    kitSize: endingDeck.length,
    inscribedCount: endingDeck.filter(c => c.inscribed).length,
    upgradedCount: endingDeck.filter(c => c.upgraded).length,
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
