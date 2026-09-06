// The four descriptions of "what a synced profile contains" must agree
// (issue 31).
//
// There is no shared schema module -- the client cannot import from `api/` --
// so the profile shape is restated in four places, and a field added to one and
// missed in another fails SILENTLY AND ASYMMETRICALLY: it saves locally, syncs
// to nothing, and reappears as its default the moment another device writes
// back. Nothing throws and nothing is logged; the player just says "it forgot
// my settings".
//
// This is the same problem the run-dedupe keys had, solved the same way:
// test/dedupeKeys.test.js holds four separately-written key functions in
// agreement, and it is why the merge.js runSeed bug (issue 09) cannot come
// back. This file is that test for the profile shape.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mergeProfiles } from '../api/_lib/merge'
import { snapshotLocalState, applyCloudState } from '../src/utils/cloudSync'
import { installLocalStorage, uninstallLocalStorage } from './support/localStorage'

// Named in every failure message below, because the point of this test is to
// tell the next person where to add the field they forgot.
const SITES = [
  'api/_lib/merge.js        mergeProfiles()      (the server merge)',
  'src/utils/cloudSync.js   snapshotLocalState() (what a device sends)',
  'src/utils/cloudSync.js   foldWithLocal()      (the client re-fold)',
  'src/utils/cloudSync.js   applyCloudState()    (the write-back to storage)',
].join('\n  ')

const WHERE = `\n\nThe synced profile shape is restated in four places:\n  ${SITES}\nAll four move together. See docs/issues/31-profile-merge-drops-unknown-fields.md.\n`

const ACCOUNT = 'sub-abc'

/**
 * One non-default value per profile field, plus how to recognise it coming back
 * out of local storage. Every field in the merged shape must appear here, which
 * is asserted below -- so adding a field to the sync makes this test fail until
 * a round-trip value is written for it.
 */
const FIELDS = {
  library: ['boon.emberward', 'boon.tollkeeper'],
  ascensionUnlocked: 4,
  tutorialCompleted: true,
  seenSpecials: ['special.hollow-king'],
  history: [{ accountId: ACCOUNT, startedAt: 1755300000000, runSeed: 'seed-a', sigils: 3 }],
  save: { version: 4, savedAt: 1755300111000, state: { room: 7 } },
  leaderboardName: 'Rookwarden',
  anonymous: false,
  nameSetAt: 1755300222000,
}

/**
 * localStorage keys that are deliberately NOT part of the synced profile, with
 * the reason each one stays behind. An exception has to be stated here to be an
 * exception; a field simply missing from the shape is a bug, not a decision.
 */
const DEVICE_LOCAL = {
  deviceId:
    'api/leaderboard.js partitions guests by deviceId, so two devices sharing '
    + 'one would collapse into a single ranked row and the slower run would '
    + 'vanish from the board entirely. It identifies a device, not a player.',
}

const keysOf = obj => Object.keys(obj).sort()

beforeEach(() => { installLocalStorage() })
afterEach(() => { uninstallLocalStorage() })

describe('the four profile shapes agree', () => {
  it('mergeProfiles returns exactly the keys a device sends', () => {
    const sent = keysOf(snapshotLocalState(ACCOUNT))
    const merged = keysOf(mergeProfiles({}, {}))
    expect(merged, `mergeProfiles() and snapshotLocalState() disagree.${WHERE}`).toEqual(sent)
  })

  it('the client re-fold returns exactly those keys too', () => {
    // applyCloudState returns foldWithLocal's result verbatim, which is the
    // only way to see that (unexported) shape from outside the module.
    const folded = keysOf(applyCloudState(ACCOUNT, mergeProfiles({}, {})))
    expect(folded, `foldWithLocal() disagrees with the other three.${WHERE}`)
      .toEqual(keysOf(snapshotLocalState(ACCOUNT)))
  })

  it('every field in the shape has a round-trip case in this file', () => {
    // Guards the test itself: without this, adding a field to all four sites
    // would pass silently here while its write-back went unchecked.
    expect(keysOf(FIELDS), `A profile field has no round-trip case in test/profileShape.test.js. Add one to FIELDS.${WHERE}`)
      .toEqual(keysOf(mergeProfiles({}, {})))
  })
})

describe('a field the server sends survives the write-back', () => {
  // The asymmetric half of the bug: a field can be in all four key lists and
  // still be lost, because applyCloudState writes each field to storage by
  // hand. Only a real round trip -- server profile in, local snapshot out --
  // can catch that.
  const server = mergeProfiles({}, FIELDS)

  for (const field of Object.keys(FIELDS)) {
    it(`${field} is still there after applyCloudState`, () => {
      applyCloudState(ACCOUNT, server)
      const local = snapshotLocalState(ACCOUNT)
      expect(local[field], `applyCloudState() dropped "${field}" on the way to localStorage: the server sent it, the merge kept it, and the next snapshot this device sends will not have it.${WHERE}`)
        .toEqual(server[field])
    })
  }

  it('a second sync round trip changes nothing', () => {
    // Convergence: a device that has adopted the account's profile must send
    // back what it received, or two devices flap forever.
    applyCloudState(ACCOUNT, server)
    const first = snapshotLocalState(ACCOUNT)
    applyCloudState(ACCOUNT, mergeProfiles(server, first))
    expect(snapshotLocalState(ACCOUNT)).toEqual(first)
  })
})

describe('device-local keys stay on the device', () => {
  for (const [field, reason] of Object.entries(DEVICE_LOCAL)) {
    it(`${field} is not part of the synced profile — ${reason.split('.')[0]}`, () => {
      expect(Object.keys(mergeProfiles({}, {})), reason + WHERE).not.toContain(field)
      expect(Object.keys(snapshotLocalState(ACCOUNT)), reason + WHERE).not.toContain(field)
    })
  }

  it('a rogue deviceId in the server payload cannot overwrite the local one', () => {
    // The merge whitelist is what stops this, and the whitelist is only load
    // bearing if something asserts it. `scoundrel:deviceId` is the key
    // assignedName.js mints into; the snapshot mints one as a side effect of
    // resolving the assigned name, so the check is that the server's value is
    // not what ends up there -- not that nothing does.
    const store = installLocalStorage({ 'scoundrel:deviceId': 'mine' })
    applyCloudState(ACCOUNT, mergeProfiles({}, { ...FIELDS, deviceId: 'other-device' }))
    expect(store.getItem('scoundrel:deviceId'), DEVICE_LOCAL.deviceId + WHERE).toBe('mine')
  })
})

describe('the merge whitelist holds', () => {
  it('drops a key neither side of the sync knows about', () => {
    // Deliberate, not incidental: the blob is written to a jsonb column from a
    // client, and an open passthrough would let a device store arbitrary data
    // in the row. The rule is "whitelist, and test it" -- which is this file.
    const merged = mergeProfiles({ somethingElse: 1 }, { andAnother: 2 })
    expect(merged).not.toHaveProperty('somethingElse')
    expect(merged).not.toHaveProperty('andAnother')
  })
})
