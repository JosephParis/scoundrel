// Run records and lifetime stats (issue 15, priority 6).
//
// buildRunRecord is what every stored run, every leaderboard row and every
// admin chart is built from, so its shape is a contract. `playerName` is the
// one field with a privacy consequence: it must be null unless the player
// typed a handle, because nothing else is allowed to reach the public board.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildRunRecord, computeLifetimeStats } from '../src/games/scoundrel/history'
import { GAME_VERSION, SIGIL_TARGET } from '../src/games/scoundrel/constants'

afterEach(() => { vi.useRealTimers() })

const finished = (over = {}) => ({
  phase: 'gameover',
  runStartedAt: 1755300000000,
  runSeed: 'a1b2c3d4',
  mode: 'default',
  ascension: 0,
  sigilsEarned: 3,
  sigilTarget: SIGIL_TARGET,
  boons: ['vanguard', 'numb'],
  kit: [
    { id: 'k1', suit: 'D', rank: 6 },
    { id: 'k2', suit: 'H', rank: 8, upgraded: true, upgradeBonus: 2 },
    { id: 'k3', suit: 'T', rank: 0, inscribed: 'map' },
  ],
  themesFaced: ['the_quiet', 'the_armory'],
  bossesDefeated: [{ id: 'the_brood', name: 'The Brood' }],
  runRoomsEntered: 27,
  monstersSlain: 41,
  biggestKill: 13,
  descents: [{ descent: 1, outcome: 'cleared' }],
  boonPicks: [{ descent: 2, offered: ['numb'], picked: 'numb' }],
  forgeEdits: [{ descent: 2, type: 'upgrade', skipped: false }],
  kitEdits: 4,
  pausedMs: 0,
  pausedAt: null,
  ...over,
})

describe('buildRunRecord shape', () => {
  it('stamps the current record and balance versions', () => {
    const rec = buildRunRecord(finished(), null)
    // v8 added deviceId. Bump this deliberately: the number is what tells a
    // reader which fields a stored record can be trusted to have.
    expect(rec.v).toBe(8)
    expect(rec.gameVersion).toBe(GAME_VERSION)
  })

  it('credits a signed-in run to the account and a signed-out one to guest', () => {
    expect(buildRunRecord(finished(), { sub: 'sub-123' }).accountId).toBe('sub-123')
    expect(buildRunRecord(finished(), null).accountId).toBe('guest')
    expect(buildRunRecord(finished(), {}).accountId).toBe('guest')
  })

  it('carries the run seed through for the dedupe key', () => {
    expect(buildRunRecord(finished(), null).runSeed).toBe('a1b2c3d4')
    expect(buildRunRecord(finished({ runSeed: undefined }), null).runSeed).toBeNull()
  })

  it('gives each record a unique id even for the same run', () => {
    const a = buildRunRecord(finished(), null)
    const b = buildRunRecord(finished(), null)
    expect(a.id).not.toBe(b.id)
    expect(a.id.startsWith('run_1755300000000_')).toBe(true)
  })

  it('names the boons and themes rather than storing bare ids', () => {
    const rec = buildRunRecord(finished(), null)
    expect(rec.boons).toEqual([
      { id: 'vanguard', name: 'Vanguard' },
      { id: 'numb', name: 'Numb' },
    ])
    expect(rec.themesFaced).toEqual([
      { id: 'the_quiet', name: 'The Quiet' },
      { id: 'the_armory', name: 'The Foundry' },
    ])
  })

  it('falls back to the id for a boon or theme that no longer exists', () => {
    const rec = buildRunRecord(finished({ boons: ['deleted'], themesFaced: ['gone'] }), null)
    expect(rec.boons).toEqual([{ id: 'deleted', name: 'deleted' }])
    expect(rec.themesFaced).toEqual([{ id: 'gone', name: 'gone' }])
  })

  it('serializes the ending deck down to what the card fan renders', () => {
    const rec = buildRunRecord(finished(), null)
    expect(rec.endingDeck).toEqual([
      { id: 'k1', suit: 'D', rank: 6, upgraded: false, upgradeBonus: 0, inscribed: null },
      { id: 'k2', suit: 'H', rank: 8, upgraded: true, upgradeBonus: 2, inscribed: null },
      { id: 'k3', suit: 'T', rank: 0, upgraded: false, upgradeBonus: 0, inscribed: 'map' },
    ])
  })

  it('mints an id for a kit card that has none', () => {
    const rec = buildRunRecord(finished({ kit: [{ suit: 'D', rank: 4 }] }), null)
    expect(rec.endingDeck[0].id).toBe('deck_0')
  })

  it('denormalizes the run-shape counts off the ending deck', () => {
    const rec = buildRunRecord(finished(), null)
    expect(rec).toMatchObject({
      kitSize: 3, inscribedCount: 1, upgradedCount: 1, boonCount: 2, kitEdits: 4,
    })
  })

  it('defaults every missing tally rather than writing undefined', () => {
    const rec = buildRunRecord({ phase: 'gameover' }, null)
    expect(rec).toMatchObject({
      sigilsEarned: 0, sigilTarget: 0, ascension: 0, ascensionName: null,
      roomsEntered: 0, monstersSlain: 0, biggestKill: 0, kitEdits: 0,
      boonCount: 0, kitSize: 0, inscribedCount: 0, upgradedCount: 0,
      dev: false, finalWeapon: null,
    })
    expect(rec.boons).toEqual([])
    expect(rec.descents).toEqual([])
    expect(rec.bossesDefeated).toEqual([])
  })
})

describe('buildRunRecord outcome', () => {
  it('reads victory, retired and death off the terminal state', () => {
    expect(buildRunRecord(finished({ phase: 'victory' }), null).outcome).toBe('victory')
    expect(buildRunRecord(finished({ retired: true }), null).outcome).toBe('retired')
    expect(buildRunRecord(finished(), null).outcome).toBe('death')
  })

  it('populates only the context matching the outcome', () => {
    const contexts = { deathContext: { source: 'monster' }, retireContext: { phase: 'descent' } }
    const died = buildRunRecord(finished(contexts), null)
    expect(died.death).toEqual({ source: 'monster' })
    expect(died.retire).toBeNull()

    const retired = buildRunRecord(finished({ ...contexts, retired: true }), null)
    expect(retired.retire).toEqual({ phase: 'descent' })
    expect(retired.death).toBeNull()

    const won = buildRunRecord(finished({ ...contexts, phase: 'victory' }), null)
    expect(won.death).toBeNull()
    expect(won.retire).toBeNull()
  })

  it('reads the carried weapon on a victory and the live one otherwise', () => {
    const weapons = {
      weapon: { rank: 5, originalRank: 4, lastSlain: { rank: 3 } },
      carriedWeapon: { rank: 9, originalRank: 8 },
    }
    expect(buildRunRecord(finished(weapons), null).finalWeapon).toEqual({ rank: 9, originalRank: 8 })
    expect(buildRunRecord(finished({ weapon: weapons.weapon }), null).finalWeapon)
      .toEqual({ rank: 5, originalRank: 4 })
  })

  it('falls back to rank when a weapon has no originalRank', () => {
    expect(buildRunRecord(finished({ weapon: { rank: 7 } }), null).finalWeapon)
      .toEqual({ rank: 7, originalRank: 7 })
  })

  it('flags a run that touched the Dev overrides tool as test data', () => {
    expect(buildRunRecord(finished({ devUsed: true }), null).dev).toBe(true)
    expect(buildRunRecord(finished({ devUsed: 'yes' }), null).dev).toBe(false)
  })
})

describe('buildRunRecord playerName', () => {
  // A name reaches the public leaderboard only because its owner typed it.
  it('is null when no handle was set', () => {
    expect(buildRunRecord(finished(), null).playerName).toBeNull()
    expect(buildRunRecord(finished(), { sub: 'x' }, '').playerName).toBeNull()
    expect(buildRunRecord(finished(), { sub: 'x' }, '   ').playerName).toBeNull()
  })

  it('never derives anything from the signed-in profile', () => {
    const user = { sub: 'sub-123', name: 'Jane Doe', email: 'jane@example.com' }
    expect(buildRunRecord(finished(), user).playerName).toBeNull()
  })

  it('carries the handle the player typed', () => {
    expect(buildRunRecord(finished(), null, 'Ashgrave').playerName).toBe('Ashgrave')
  })

  it('trims, then clamps to 16 characters, then trims again', () => {
    expect(buildRunRecord(finished(), null, '  Ashgrave  ').playerName).toBe('Ashgrave')
    // 20 characters in, 16 out.
    expect(buildRunRecord(finished(), null, 'abcdefghijklmnopqrst').playerName)
      .toBe('abcdefghijklmnop')
    // The clamp must not leave trailing whitespace behind.
    expect(buildRunRecord(finished(), null, 'abcdefghijklmno pqrst').playerName)
      .toBe('abcdefghijklmno')
  })

  it('survives a non-string handle', () => {
    expect(buildRunRecord(finished(), null, null).playerName).toBeNull()
    expect(buildRunRecord(finished(), null, undefined).playerName).toBeNull()
    expect(buildRunRecord(finished(), null, 12345).playerName).toBe('12345')
  })
})

describe('buildRunRecord deviceId', () => {
  it('carries the device id it is given', () => {
    // Identity, as opposed to playerName, which is only a label. The board
    // groups guests on this, so a run without it cannot be told apart from
    // any other guest's.
    expect(buildRunRecord(finished(), null, '', 'dev-abc').deviceId).toBe('dev-abc')
  })

  it('is null when the caller does not supply one', () => {
    // Display-only callers build records they never store.
    expect(buildRunRecord(finished(), null).deviceId).toBeNull()
    expect(buildRunRecord(finished(), null, 'Ashgrave').deviceId).toBeNull()
    expect(buildRunRecord(finished(), null, '', '').deviceId).toBeNull()
  })

  it('is kept on signed-in runs too', () => {
    // The board does not need it there, but storing it unconditionally means
    // no reader has to branch on which kind of run it is looking at.
    expect(buildRunRecord(finished(), { sub: 'sub-1' }, '', 'dev-abc').deviceId).toBe('dev-abc')
  })

  it('is independent of the name', () => {
    const rec = buildRunRecord(finished(), null, 'Rookwarden', 'dev-abc')
    expect(rec.playerName).toBe('Rookwarden')
    expect(rec.deviceId).toBe('dev-abc')
  })
})

describe('buildRunRecord timing', () => {
  it('measures the run from its start to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1755300060000) // 60s after runStartedAt
    const rec = buildRunRecord(finished(), null)
    expect(rec.startedAt).toBe(1755300000000)
    expect(rec.endedAt).toBe(1755300060000)
    expect(rec.durationMs).toBe(60000)
  })

  it('subtracts time spent paused so idling in the menu is not playtime', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1755300060000)
    expect(buildRunRecord(finished({ pausedMs: 20000 }), null).durationMs).toBe(40000)
  })

  it('closes a pause that was still open at run end', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1755300060000)
    // Paused 10s ago and never resumed, on top of 5s already banked.
    const rec = buildRunRecord(finished({ pausedMs: 5000, pausedAt: 1755300050000 }), null)
    expect(rec.durationMs).toBe(45000)
  })

  it('never reports a negative duration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1755300060000)
    expect(buildRunRecord(finished({ pausedMs: 999999999 }), null).durationMs).toBe(0)
  })

  it('treats a run with no recorded start as starting now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1755300060000)
    const rec = buildRunRecord(finished({ runStartedAt: undefined }), null)
    expect(rec.startedAt).toBe(1755300060000)
    expect(rec.durationMs).toBe(0)
  })
})

describe('computeLifetimeStats', () => {
  const run = over => ({ outcome: 'death', sigilsEarned: 0, roomsEntered: 0, monstersSlain: 0, ...over })

  it('is all zeroes with no runs, and reports no victory as -1', () => {
    expect(computeLifetimeStats([])).toEqual({
      totalRuns: 0, wins: 0, deaths: 0, retires: 0, winRate: 0, totalSigils: 0,
      bestAscensionCleared: -1, longestRunRooms: 0, mostKills: 0,
    })
  })

  it('splits runs across the three outcomes', () => {
    const stats = computeLifetimeStats([
      run({ outcome: 'victory' }),
      run({ outcome: 'retired' }),
      run({ outcome: 'death' }),
      run({ outcome: 'death' }),
    ])
    expect(stats).toMatchObject({ totalRuns: 4, wins: 1, retires: 1, deaths: 2 })
  })

  it('counts an unrecognized outcome as a death rather than dropping it', () => {
    const stats = computeLifetimeStats([run({ outcome: undefined })])
    expect(stats).toMatchObject({ totalRuns: 1, deaths: 1 })
  })

  it('rounds the win rate to a whole percent', () => {
    expect(computeLifetimeStats([run({ outcome: 'victory' }), run({})]).winRate).toBe(50)
    // 1 of 3 rounds to 33.
    expect(computeLifetimeStats([run({ outcome: 'victory' }), run({}), run({})]).winRate).toBe(33)
  })

  it('sums sigils and takes the max of the per-run bests', () => {
    const stats = computeLifetimeStats([
      run({ sigilsEarned: 3, roomsEntered: 40, monstersSlain: 12 }),
      run({ sigilsEarned: 7, roomsEntered: 12, monstersSlain: 55 }),
    ])
    expect(stats).toMatchObject({ totalSigils: 10, longestRunRooms: 40, mostKills: 55 })
  })

  it('credits the best ascension only for runs that were actually won', () => {
    const stats = computeLifetimeStats([
      run({ outcome: 'death', ascension: 5 }),
      run({ outcome: 'victory', ascension: 2 }),
      run({ outcome: 'victory', ascension: 1 }),
    ])
    expect(stats.bestAscensionCleared).toBe(2)
  })

  it('counts an A0 victory as cleared, distinct from no victory at all', () => {
    expect(computeLifetimeStats([run({ outcome: 'victory' })]).bestAscensionCleared).toBe(0)
    expect(computeLifetimeStats([run({})]).bestAscensionCleared).toBe(-1)
  })

  it('tolerates records missing every optional field', () => {
    expect(computeLifetimeStats([{ outcome: 'victory' }])).toMatchObject({
      totalRuns: 1, wins: 1, totalSigils: 0, longestRunRooms: 0, mostKills: 0,
      bestAscensionCleared: 0,
    })
  })
})
