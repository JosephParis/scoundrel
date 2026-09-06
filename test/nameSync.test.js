// One account, one name, however many devices (issue 30).
//
// Every device assigns itself a name on first launch, which is right for guests
// -- it is what makes two of them distinguishable on the board -- and wrong for
// a signed-in player, because nothing carried the choice between devices. The
// same account was a different person on each one, and since api/_lib/handles.js
// never releases a claim, both names were held forever with no way to merge.
//
// The rules live in two halves that cannot import each other: newerName in
// api/_lib/merge.js and foldName in src/utils/cloudSync.js. This file drives
// both through the real round trip -- two devices with their own localStorage,
// posting into one server profile -- so a disagreement between the halves shows
// up as a player's name flapping, which is how they would have met it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mergeProfiles, newerName } from '../api/_lib/merge'
import { snapshotLocalState, applyCloudState } from '../src/utils/cloudSync'
import { installLocalStorage, uninstallLocalStorage } from './support/localStorage'

const ACCOUNT = 'sub-two-devices'
const HANDLE = 'scoundrel:leaderboardHandle'
const ANON = 'scoundrel:leaderboardAnonymous'
const SET_AT = 'scoundrel:leaderboardNameSetAt'
const DEVICE = 'scoundrel:deviceId'

/**
 * A device is its own localStorage. Only one is installed at a time, exactly as
 * only one is ever real, so neither the sync module nor the merge can cheat by
 * seeing the other device's state.
 */
function makeDevice(id, initial = {}) {
  // Built once and kept: a device's storage has to survive across syncs,
  // including keys a sync REMOVES. Rebuilding it from a snapshot would quietly
  // resurrect a cleared opt-out and make this file pass on a bug.
  const store = installLocalStorage({ [DEVICE]: id, ...initial })
  return {
    id,
    enter() {
      globalThis.localStorage = store
      return store
    },
    /** Post to the server, take back what it merged: one full sync. */
    sync(server) {
      this.enter()
      const merged = mergeProfiles(server, snapshotLocalState(ACCOUNT))
      applyCloudState(ACCOUNT, merged)
      return merged
    },
    /** What this device would credit a run finishing now to. */
    postsAs() {
      const s = this.enter()
      if (s.getItem(ANON) === '1') return ''
      return snapshotLocalState(ACCOUNT).leaderboardName
    },
    deviceId() { return this.enter().getItem(DEVICE) },
  }
}

/** The one profile row the account has, read-merge-written by every sync. */
function makeServer() {
  let profile = {}
  return {
    /** One device's full round trip against the stored profile. */
    receive(device) { profile = device.sync(profile); return profile },
    get profile() { return profile },
  }
}

const typed = (name, at) => ({ [HANDLE]: name, [SET_AT]: String(at) })

beforeEach(() => { installLocalStorage() })
afterEach(() => { uninstallLocalStorage() })

describe('a name set on one device is the name the account posts under', () => {
  it('reaches a second device that never chose one', () => {
    const laptop = makeDevice('dev-laptop', typed('Rookwarden', 1755300000000))
    const phone = makeDevice('dev-phone')
    const server = makeServer()
    server.receive(laptop)
    server.receive(phone)
    expect(phone.postsAs()).toBe('Rookwarden')
  })

  it('reaches it in the other order too', () => {
    // The phone syncs first and promotes its assigned name; the laptop's typed
    // name must still win, because it was actually chosen.
    const laptop = makeDevice('dev-laptop', typed('Rookwarden', 1755300000000))
    const phone = makeDevice('dev-phone')
    const server = makeServer()
    server.receive(phone)
    server.receive(laptop)
    server.receive(phone)
    expect(phone.postsAs()).toBe('Rookwarden')
    expect(laptop.postsAs()).toBe('Rookwarden')
  })

  it('a later choice on the second device wins over the first', () => {
    const laptop = makeDevice('dev-laptop', typed('Rookwarden', 1755300000000))
    const phone = makeDevice('dev-phone', typed('Emberward', 1755399999000))
    const server = makeServer()
    server.receive(laptop)
    server.receive(phone)
    server.receive(laptop)
    expect(laptop.postsAs()).toBe('Emberward')
    expect(phone.postsAs()).toBe('Emberward')
  })
})

describe('the anonymous opt-out crosses devices', () => {
  it('a device that never asked to be anonymous stops posting a name', () => {
    // The setting failing in the direction that matters: the privacy-shaped one.
    const laptop = makeDevice('dev-laptop', { [ANON]: '1', [SET_AT]: '1755300000000' })
    const phone = makeDevice('dev-phone')
    const server = makeServer()
    server.receive(laptop)
    server.receive(phone)
    expect(phone.postsAs()).toBe('')
  })

  it('turning it back off on either device lifts it on both', () => {
    const laptop = makeDevice('dev-laptop', { [ANON]: '1', [SET_AT]: '1755300000000' })
    const phone = makeDevice('dev-phone', typed('Rookwarden', 1755400000000))
    const server = makeServer()
    server.receive(laptop)
    server.receive(phone)
    server.receive(laptop)
    expect(laptop.postsAs()).toBe('Rookwarden')
  })
})

describe('a device with only an assigned name adopts the account name', () => {
  it('the first device to sync names the account', () => {
    // Nobody has opened Settings. Without this, two devices keep two assigned
    // names and the player holds two leaderboard claims forever.
    const first = makeDevice('dev-first')
    const second = makeDevice('dev-second')
    const assigned = first.postsAs()
    const server = makeServer()
    server.receive(first)
    server.receive(second)
    expect(second.postsAs()).toBe(assigned)
  })

  it('and that assigned name still loses to one the player types', () => {
    const first = makeDevice('dev-first')
    const second = makeDevice('dev-second', typed('Rookwarden', 1))
    const server = makeServer()
    server.receive(first)
    server.receive(second)
    server.receive(first)
    expect(first.postsAs()).toBe('Rookwarden')
  })
})

describe('two devices converge instead of flapping', () => {
  it('repeated syncing in an interleaved order settles on one name', () => {
    const a = makeDevice('dev-a', typed('Rookwarden', 1755300000000))
    const b = makeDevice('dev-b', typed('Emberward', 1755300000000)) // identical stamp
    const server = makeServer()
    for (let i = 0; i < 6; i++) {
      server.receive(i % 2 ? b : a)
    }
    // An equal stamp keeps whatever the server already holds, so the first
    // device to arrive owns the name and re-posting never displaces it.
    expect(a.postsAs()).toBe('Rookwarden')
    expect(b.postsAs()).toBe('Rookwarden')
  })

  it('a device that adopts a name does not re-stamp it as its own choice', () => {
    // The flapping bug in one assertion: if adopting re-stamped with the local
    // clock, the adopting device would win the next round and the two would
    // trade the name forever.
    const laptop = makeDevice('dev-laptop', typed('Rookwarden', 1755300000000))
    const phone = makeDevice('dev-phone')
    const server = makeServer()
    server.receive(laptop)
    server.receive(phone)
    expect(phone.enter().getItem(SET_AT)).toBe('1755300000000')
  })
})

describe('deviceId stays on the device', () => {
  it('two devices keep different ids after syncing the same account', () => {
    // api/leaderboard.js partitions guests by deviceId. Two devices sharing one
    // collapse into a single ranked row and the slower run vanishes from the
    // board -- the exact defect the deviceId work fixed on 2026-08-30. It is a
    // device id, not a player id, even though it lives beside the name.
    const a = makeDevice('dev-a', typed('Rookwarden', 1755300000000))
    const b = makeDevice('dev-b')
    const server = makeServer()
    server.receive(a)
    server.receive(b)
    expect(a.deviceId()).toBe('dev-a')
    expect(b.deviceId()).toBe('dev-b')
    expect(server.profile).not.toHaveProperty('deviceId')
  })
})

describe('newerName, directly', () => {
  const choice = (leaderboardName, nameSetAt, anonymous = false) =>
    ({ leaderboardName, nameSetAt, anonymous })

  it('keeps the name and the opt-out together', () => {
    // Picking them separately would let one device's "do not list me" land
    // beside another device's name and publish a player who opted out.
    const merged = newerName(choice('Rookwarden', 10), choice('', 20, true))
    expect(merged).toEqual({ leaderboardName: '', anonymous: true, nameSetAt: 20 })
  })

  it('an untouched profile loses to any choice', () => {
    expect(newerName({}, choice('Rookwarden', 0)).leaderboardName).toBe('Rookwarden')
    expect(newerName(choice('Rookwarden', 0), {}).leaderboardName).toBe('Rookwarden')
  })

  it('two untouched profiles stay untouched', () => {
    expect(newerName(null, undefined))
      .toEqual({ leaderboardName: '', anonymous: false, nameSetAt: 0 })
  })

  it('keeps the incumbent on an equal stamp, in both argument orders', () => {
    expect(newerName(choice('A', 5), choice('B', 5)).leaderboardName).toBe('A')
    expect(newerName(choice('B', 5), choice('A', 5)).leaderboardName).toBe('B')
  })

  it('ignores a name that is not a string and caps a long one', () => {
    // The blob arrives from a client; the column should not take arbitrary junk.
    expect(newerName({ leaderboardName: { evil: true } }, {}).leaderboardName).toBe('')
    expect(newerName(choice('x'.repeat(200), 1), {}).leaderboardName).toHaveLength(64)
  })
})
