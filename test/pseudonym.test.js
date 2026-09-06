import { describe, it, expect } from 'vitest'
import { pseudonymFor, ADJECTIVES, NOUNS } from '../src/utils/pseudonym.js'
import { MAX_HANDLE_LENGTH } from '../src/games/scoundrel/handle.js'

// These two lists are shared with assignedName.js, which spends its whole
// character budget on them. Nothing in this module notices a word that is too
// long -- a pseudonym may be any length -- so the constraint is asserted here,
// beside the lists, rather than only downstream where the symptom is 1,936
// pairs quietly becoming 1,900.
describe('the shared vocabulary', () => {
  it('has no duplicates within either list', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
    expect(new Set(NOUNS).size).toBe(NOUNS.length)
  })

  it('is sorted, so a new word has one obvious home', () => {
    expect([...ADJECTIVES].sort()).toEqual(ADJECTIVES)
    expect([...NOUNS].sort()).toEqual(NOUNS)
  })

  it('every pair still fits an assigned name', () => {
    // assignedName.js concatenates and appends four digits. A word pushing any
    // pair over the cap would be dropped from PAIRS without a word of warning.
    const DIGITS = 4
    for (const adjective of ADJECTIVES) {
      for (const noun of NOUNS) {
        expect(`${adjective}${noun}`.length + DIGITS).toBeLessThanOrEqual(MAX_HANDLE_LENGTH)
      }
    }
  })

  it('is made of plain capitalised words', () => {
    // Anything else -- a space, a hyphen, an accent -- survives here and is
    // stripped by sanitizeHandle downstream, renaming the player on first sight.
    for (const word of [...ADJECTIVES, ...NOUNS]) {
      expect(word).toMatch(/^[A-Z][a-z]+$/)
    }
  })
})

// The pseudonym replaces the real name PostHog used to receive (issue 06). Two
// properties matter: it must be stable, or a player fragments into many profiles
// across devices, and it must never leak the id it came from.
describe('pseudonymFor', () => {
  it('is stable for the same id', () => {
    const a = pseudonymFor('107812345678901234567')
    const b = pseudonymFor('107812345678901234567')
    expect(a).toBe(b)
  })

  it('differs between ids', () => {
    expect(pseudonymFor('107812345678901234567'))
      .not.toBe(pseudonymFor('107812345678901234568'))
  })

  it('reads as "Adjective Noun N"', () => {
    expect(pseudonymFor('107812345678901234567')).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/)
  })

  it('reveals nothing of the id it came from', () => {
    // The whole point: PostHog holds a label, not an identity.
    const sub = '107812345678901234567'
    const name = pseudonymFor(sub)
    expect(name).not.toContain(sub)
    for (const chunk of [sub.slice(0, 4), sub.slice(-4)]) {
      expect(name).not.toContain(chunk)
    }
  })

  it('returns Guest for a signed-out player', () => {
    expect(pseudonymFor('guest')).toBe('Guest')
    expect(pseudonymFor('')).toBe('Guest')
    expect(pseudonymFor(null)).toBe('Guest')
    expect(pseudonymFor(undefined)).toBe('Guest')
  })

  it('spreads ids across the space rather than clustering', () => {
    // Sequential Google subs differ only in their last digits, which a weak hash
    // would map to a handful of names.
    const base = 107812345678901234000n
    const names = new Set()
    for (let i = 0; i < 200; i++) names.add(pseudonymFor(String(base + BigInt(i))))
    // Not uniqueness -- collisions are harmless here -- just that it is not
    // collapsing a couple of hundred ids into a tiny set.
    expect(names.size).toBeGreaterThan(150)
  })
})
