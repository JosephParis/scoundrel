import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  assignedNameFor, deviceSeed, nameSuggestions, NAME_SPACE,
} from '../src/games/scoundrel/assignedName.js'
import { MAX_HANDLE_LENGTH, sanitizeHandle } from '../src/games/scoundrel/handle.js'
import { isHandleAllowed } from '../src/games/scoundrel/handleDenylist.js'

// The assigned name is the default identity every player carries onto the public
// board, so it has to satisfy three things at once that are easy to satisfy
// separately: it must fit a handle, survive the denylist, and be stable.
//
// The length one is the trap. The vocabulary is shared with pseudonym.js, which
// has no length budget -- "Candlelit Lamplighter 99" is 24 characters against a
// 16-character limit -- so the filtering in assignedName.js is load-bearing and
// silently breaks if either word list grows.

// Reasonably spread seeds, rather than 'a'/'b'/'c', so a hash that happened to
// bucket short similar strings together cannot pass this by luck.
const SEEDS = Array.from({ length: 400 }, (_, i) => `seed-${i}-${(i * 7919) % 104729}`)

describe('assignedNameFor — shape', () => {
  it('always fits a leaderboard handle', () => {
    for (const seed of SEEDS) {
      expect(assignedNameFor(seed).length).toBeLessThanOrEqual(MAX_HANDLE_LENGTH)
    }
  })

  it('survives sanitizeHandle unchanged', () => {
    // A name the input field would rewrite is a name the player sees change
    // under them the first time they open Settings.
    for (const seed of SEEDS) {
      const name = assignedNameFor(seed)
      expect(sanitizeHandle(name)).toBe(name)
    }
  })

  it('is never a name the server would strip', () => {
    // The game handing out a name its own moderation refuses would put the
    // player on the board as Anonymous with no explanation.
    for (const seed of SEEDS) {
      expect(isHandleAllowed(assignedNameFor(seed))).toBe(true)
    }
  })

  it('reads as "Adjective Noun NN"', () => {
    expect(assignedNameFor('anything')).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/)
  })
})

describe('assignedNameFor — stability', () => {
  it('gives the same seed the same name every time', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(assignedNameFor(seed)).toBe(assignedNameFor(seed))
    }
  })

  it('does not put similar seeds on similar names', () => {
    // Sequential ids are exactly what a device seed can look like, and a hash
    // used badly would walk them down the same adjective.
    const names = ['device-1', 'device-2', 'device-3', 'device-4'].map(assignedNameFor)
    expect(new Set(names.map(n => n.split(' ')[0])).size).toBeGreaterThan(1)
  })

  it('spreads across the space rather than clustering', () => {
    // Not a uniformity proof -- just enough to catch a generator that collapsed
    // onto a handful of names, which would undo the whole point of giving
    // guests distinguishable identities.
    const names = new Set(SEEDS.map(assignedNameFor))
    expect(names.size).toBeGreaterThan(SEEDS.length * 0.9)
  })

  it('has a name space large enough for the board to stay distinguishable', () => {
    expect(NAME_SPACE).toBeGreaterThan(50000)
  })
})

describe('nameSuggestions', () => {
  it('returns the number asked for', () => {
    expect(nameSuggestions(3)).toHaveLength(3)
    expect(nameSuggestions(1)).toHaveLength(1)
  })

  it('returns distinct names', () => {
    for (let i = 0; i < 50; i++) {
      const names = nameSuggestions(3)
      expect(new Set(names).size).toBe(3)
    }
  })

  it('never offers the name the player already has', () => {
    // Offering someone their own name as a change is the one option guaranteed
    // to be useless.
    const mine = assignedNameFor('device-a')
    for (let i = 0; i < 100; i++) {
      expect(nameSuggestions(3, mine)).not.toContain(mine)
    }
  })

  it('produces names that fit and pass the denylist', () => {
    for (let i = 0; i < 100; i++) {
      for (const name of nameSuggestions(3)) {
        expect(name.length).toBeLessThanOrEqual(MAX_HANDLE_LENGTH)
        expect(isHandleAllowed(name)).toBe(true)
      }
    }
  })

  it('terminates even when asked for more names than it can make', () => {
    // The loop is bounded rather than "retry until full"; without that this
    // hangs the render it is called from.
    expect(nameSuggestions(20).length).toBeGreaterThan(0)
  })
})

describe('deviceSeed', () => {
  let store

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mints once and reuses it', () => {
    const first = deviceSeed()
    expect(first).toBeTruthy()
    expect(deviceSeed()).toBe(first)
  })

  it('persists under its own key, not one the game already uses', () => {
    deviceSeed()
    expect(store.has('scoundrel:deviceId')).toBe(true)
  })

  it('gives two devices different seeds', () => {
    const a = deviceSeed()
    store.clear()
    expect(deviceSeed()).not.toBe(a)
  })

  it('still returns a seed when storage throws', () => {
    // Private browsing. A name that is merely unstable beats a crash on the way
    // to the leaderboard.
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => {},
    })
    expect(deviceSeed()).toBeTruthy()
    expect(assignedNameFor(deviceSeed()).length).toBeLessThanOrEqual(MAX_HANDLE_LENGTH)
  })
})
