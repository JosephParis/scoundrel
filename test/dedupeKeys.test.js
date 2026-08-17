// The four "which run is this" implementations must agree (issues 09 and 15).
//
// There is no shared module: the client cannot import from `api/`, and each
// site keys a slightly different scope (historyStore's buckets are already
// per-account, so its key omits accountId). What has to hold is not that the
// four strings match, but that the four agree on *which records are the same
// run*. This file asserts that equivalence, which is exactly the property
// issue 09's bug broke: merge.js dropped runSeed and collapsed two real runs.

import { describe, it, expect } from 'vitest'
import { runKey, mergeProfiles } from '../api/_lib/merge'
import { runKeyFor } from '../api/_lib/runsTable'
import { serverKeyOf, runKeyOf } from '../src/utils/historyStore'
import { runMergeKey } from '../src/utils/cloudSync'

// The three account-scoped implementations produce the identical string.
const ACCOUNT_SCOPED = {
  'api/_lib/merge.js runKey': runKey,
  'api/_lib/runsTable.js runKeyFor': runKeyFor,
  'src/utils/historyStore.js serverKeyOf': serverKeyOf,
  'src/utils/cloudSync.js runMergeKey': runMergeKey,
}

// historyStore's own bucket key is per-account already, so it drops the
// accountId. It still has to make the same same-run / different-run calls.
const ALL = { ...ACCOUNT_SCOPED, 'src/utils/historyStore.js runKeyOf': runKeyOf }

const record = over => ({
  accountId: 'sub-123',
  startedAt: 1755300000000,
  runSeed: 'a1b2c3d4',
  id: `rec_${Math.random()}`,
  ...over,
})

describe('the account-scoped key implementations agree exactly', () => {
  const cases = {
    'a modern record': record(),
    'a legacy record with no seed': record({ runSeed: undefined }),
    'a guest record': record({ accountId: 'guest' }),
  }

  for (const [label, rec] of Object.entries(cases)) {
    it(`produces one string for ${label}`, () => {
      const keys = Object.values(ACCOUNT_SCOPED).map(fn => fn(rec))
      expect(new Set(keys).size).toBe(1)
    })
  }

  it('folds the seed in when present and leaves legacy keys alone', () => {
    expect(runKey(record())).toBe('sub-123:1755300000000:a1b2c3d4')
    expect(runKey(record({ runSeed: undefined }))).toBe('sub-123:1755300000000')
  })
})

describe('every implementation makes the same same-run call', () => {
  // Two guest runs started in the same millisecond on two devices: the
  // motivating case for runSeed, and the one merge.js used to collapse.
  const twinA = record({ accountId: 'guest', runSeed: 'aaaa1111' })
  const twinB = record({ accountId: 'guest', runSeed: 'bbbb2222' })

  it.each(Object.entries(ALL))('%s separates two runs sharing a startedAt', (_label, keyOf) => {
    expect(keyOf(twinA)).not.toBe(keyOf(twinB))
  })

  it.each(Object.entries(ALL))('%s treats a re-record of one run as the same run', (_label, keyOf) => {
    // `id` carries a random suffix and must not be part of the key, or a
    // re-post of a finished run would be stored twice.
    expect(keyOf(twinA)).toBe(keyOf({ ...twinA, id: 'a_different_id' }))
  })

  it.each(Object.entries(ALL))('%s still dedupes legacy records against themselves', (_label, keyOf) => {
    const legacy = record({ runSeed: undefined })
    expect(keyOf(legacy)).toBe(keyOf({ ...legacy, id: 'other' }))
  })

  it.each(Object.entries(ALL))('%s separates two legacy runs at different times', (_label, keyOf) => {
    const a = record({ runSeed: undefined })
    const b = record({ runSeed: undefined, startedAt: 1755300000001 })
    expect(keyOf(a)).not.toBe(keyOf(b))
  })

  it.each(Object.entries(ACCOUNT_SCOPED))('%s separates two accounts', (_label, keyOf) => {
    expect(keyOf(record({ accountId: 'one' }))).not.toBe(keyOf(record({ accountId: 'two' })))
  })
})

describe('mergeProfiles history', () => {
  // The regression issue 09 describes, asserted end to end through the real
  // server merge rather than through the key function alone.
  it('keeps both runs when they share accountId and startedAt but not runSeed', () => {
    const a = record({ accountId: 'guest', runSeed: 'aaaa1111' })
    const b = record({ accountId: 'guest', runSeed: 'bbbb2222' })
    const merged = mergeProfiles({ history: [a] }, { history: [b] })
    expect(merged.history).toHaveLength(2)
    expect(merged.history.map(r => r.runSeed).sort()).toEqual(['aaaa1111', 'bbbb2222'])
  })

  it('still collapses a genuine re-record of the same run', () => {
    const a = record()
    const merged = mergeProfiles({ history: [a] }, { history: [{ ...a, id: 'resent' }] })
    expect(merged.history).toHaveLength(1)
  })

  it('collapses legacy records with no seed against themselves', () => {
    const legacy = record({ runSeed: undefined })
    const merged = mergeProfiles({ history: [legacy] }, { history: [{ ...legacy, id: 'resent' }] })
    expect(merged.history).toHaveLength(1)
  })

  it('does not conflate a legacy record with a seeded one at the same instant', () => {
    const legacy = record({ runSeed: undefined })
    const seeded = record({ runSeed: 'zzzz9999' })
    expect(mergeProfiles({ history: [legacy] }, { history: [seeded] }).history).toHaveLength(2)
  })

  it('drops records that carry neither an account nor a start time', () => {
    const merged = mergeProfiles({ history: [{ id: 'junk' }] }, { history: [record()] })
    expect(merged.history).toHaveLength(1)
  })

  it('sorts history oldest-first and caps it at 200', () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      record({ startedAt: 1755300000000 + i, runSeed: `seed${i}` }))
    const merged = mergeProfiles({ history: many.slice(0, 200) }, { history: many.slice(200) })
    expect(merged.history).toHaveLength(200)
    // The oldest 50 fell off the front.
    expect(merged.history[0].startedAt).toBe(1755300000050)
    expect(merged.history.at(-1).startedAt).toBe(1755300000249)
  })
})

describe('mergeProfiles non-history fields', () => {
  it('unions the boon library and seen specials', () => {
    const merged = mergeProfiles(
      { library: ['vanguard'], seenSpecials: ['map'] },
      { library: ['brawler', 'vanguard'], seenSpecials: ['torch'] },
    )
    expect(merged.library.sort()).toEqual(['brawler', 'vanguard'])
    expect(merged.seenSpecials.sort()).toEqual(['map', 'torch'])
  })

  it('never walks the ascension ladder backward', () => {
    expect(mergeProfiles({ ascensionUnlocked: 4 }, { ascensionUnlocked: 1 }).ascensionUnlocked).toBe(4)
    expect(mergeProfiles({ ascensionUnlocked: 1 }, { ascensionUnlocked: 4 }).ascensionUnlocked).toBe(4)
  })

  it('keeps the tutorial done once it is done', () => {
    expect(mergeProfiles({ tutorialCompleted: true }, { tutorialCompleted: false }).tutorialCompleted).toBe(true)
  })

  it('keeps the newer save, and never lets a device with none clobber one', () => {
    const older = { savedAt: 10 }
    const newer = { savedAt: 20 }
    expect(mergeProfiles({ save: older }, { save: newer }).save).toBe(newer)
    expect(mergeProfiles({ save: newer }, { save: older }).save).toBe(newer)
    expect(mergeProfiles({ save: newer }, { save: null }).save).toBe(newer)
    expect(mergeProfiles({ save: null }, { save: null }).save).toBeNull()
  })

  it('converges: merging in either order gives the same result', () => {
    const a = { library: ['vanguard'], ascensionUnlocked: 2, history: [record({ runSeed: 'a' })], save: { savedAt: 5 } }
    const b = { library: ['numb'], ascensionUnlocked: 1, history: [record({ runSeed: 'b' })], save: { savedAt: 9 } }
    const ab = mergeProfiles(a, b)
    const ba = mergeProfiles(b, a)
    expect(ab.library.sort()).toEqual(ba.library.sort())
    expect(ab.ascensionUnlocked).toBe(ba.ascensionUnlocked)
    expect(ab.history.map(r => r.runSeed).sort()).toEqual(ba.history.map(r => r.runSeed).sort())
    expect(ab.save).toEqual(ba.save)
  })

  it('handles empty and missing profiles', () => {
    expect(mergeProfiles(null, null)).toEqual({
      library: [],
      ascensionUnlocked: 0,
      tutorialCompleted: false,
      seenSpecials: [],
      history: [],
      save: null,
    })
  })
})
