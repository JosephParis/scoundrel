import { describe, it, expect } from 'vitest'
import { pseudonymFor } from '../src/utils/pseudonym.js'

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
