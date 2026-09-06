import { describe, it, expect } from 'vitest'
import {
  normalizeHandle, handleRejectionReason, isHandleAllowed,
} from '../src/games/scoundrel/handleDenylist.js'
import { sanitizeHandle, MAX_HANDLE_LENGTH } from '../src/games/scoundrel/settings.js'

// Issue 08. The point of these tests is the two failure modes a denylist has:
// letting the obvious dodge through, and eating a real handle. Both are
// asserted, because a list tuned only for the first is worse than none -- it
// keeps real players off the board and nobody finds out.

describe('normalizeHandle', () => {
  it('folds case', () => {
    expect(normalizeHandle('SiGiL')).toBe('sigil')
  })

  it('resolves leetspeak substitutions', () => {
    expect(normalizeHandle('n1gg3r')).toBe('nigger')   // 1 -> i, 3 -> e
  })

  it('turns separators into single spaces so words keep boundaries', () => {
    expect(normalizeHandle('my__ass--here')).toBe('my ass here')
  })

  it('is empty for a handle with no letters or digits', () => {
    expect(normalizeHandle('---')).toBe('')
    expect(normalizeHandle(null)).toBe('')
    expect(normalizeHandle(undefined)).toBe('')
  })
})

describe('handleRejectionReason — content', () => {
  it('rejects a slur outright', () => {
    expect(handleRejectionReason('nigger')).toBe('denylisted')
  })

  it('rejects it through leetspeak', () => {
    expect(handleRejectionReason('N1GG3R')).toBe('denylisted')
    expect(handleRejectionReason('f4gg0t')).toBe('denylisted')
  })

  it('rejects it through padded repeats', () => {
    expect(handleRejectionReason('niiiiiiger')).toBe('denylisted')
    expect(handleRejectionReason('nnnnigger')).toBe('denylisted')
  })

  it('rejects it when buried in a longer handle', () => {
    expect(handleRejectionReason('xXnaziXx')).toBe('denylisted')
  })

  it('sees through separators the sanitizer allows', () => {
    // sanitizeHandle keeps spaces, _ and -, so a word-tier term can hide behind
    // any of them and still read as the word on screen.
    expect(handleRejectionReason('big_ass_axe')).toBe('denylisted')
    expect(handleRejectionReason('big ass axe')).toBe('denylisted')
    expect(handleRejectionReason('big-ass-axe')).toBe('denylisted')
  })
})

describe('handleRejectionReason — false positives', () => {
  // Every one of these is a handle a real player could plausibly want. The
  // Scunthorpe problem is the reason the word tier exists at all.
  const innocent = [
    'Cassandra', 'Scunthorpe', 'assassin', 'Assassin_42', 'classic',
    'suspicious', 'raccoon', 'Grape Knight', 'Draper', 'Dickinson',
    'Cockburn', 'shitake', 'Analyst', 'Bassist', 'Compass', 'Titan',
    'Hitchcock', 'Nazir', 'Nigerian', 'Cumbria', 'Massive', 'passer by',
    'Spice Trader', 'Sheila',
  ]
  for (const handle of innocent) {
    it(`allows ${handle}`, () => {
      expect(handleRejectionReason(handle)).toBe(null)
    })
  }

  it('allows an ordinary handle', () => {
    expect(isHandleAllowed('Joey')).toBe(true)
    expect(isHandleAllowed('the_ninth_blade')).toBe(true)
  })

  it('allows the empty handle — that is opting out, not an offence', () => {
    expect(handleRejectionReason('')).toBe(null)
    expect(handleRejectionReason('   ')).toBe(null)
  })
})

describe('handleRejectionReason — impersonation', () => {
  it('reserves the game and operator names', () => {
    expect(handleRejectionReason('admin')).toBe('reserved')
    expect(handleRejectionReason('ADMIN')).toBe('reserved')
    expect(handleRejectionReason('Sigil')).toBe('reserved')
    expect(handleRejectionReason('s1g1l')).toBe('reserved')
    expect(handleRejectionReason('Anonymous')).toBe('reserved')
  })

  it('reserves only the whole handle, not the word inside one', () => {
    expect(handleRejectionReason('Sigilbane')).toBe(null)
    expect(handleRejectionReason('admiral')).toBe(null)
  })

  it('matches across the separators a handle may contain', () => {
    expect(handleRejectionReason('a d m i n')).toBe('reserved')
    expect(handleRejectionReason('s_i_g_i_l')).toBe('reserved')
  })
})

describe('interaction with sanitizeHandle', () => {
  // The two run in sequence: the sanitizer decides which characters survive,
  // the denylist decides whether the survivors may be published. A term that
  // only matches characters the sanitizer strips would never fire in practice.
  it('screens what the sanitizer actually produces', () => {
    const sanitized = sanitizeHandle('n1gg3r!!!')
    expect(sanitized).toBe('n1gg3r')         // ! is not in the charset
    expect(handleRejectionReason(sanitized)).toBe('denylisted')
  })

  it('cannot see a term the sanitizer broke apart', () => {
    // Known limitation, asserted so it stays a known one: the charset strip
    // runs first, and a character it removes takes the match with it. The
    // answer to what slips through is the blocklist and the row delete, not a
    // cleverer regex.
    const sanitized = sanitizeHandle('n!gg3r')
    expect(sanitized).toBe('ngg3r')
    expect(handleRejectionReason(sanitized)).toBe(null)
  })

  it('still screens a handle clipped to the length cap', () => {
    // Padded from the cap so the slur is always just past the end, whatever the
    // cap is. Spelled out, this stopped testing the clip the moment it moved.
    const long = sanitizeHandle(`${'a'.repeat(MAX_HANDLE_LENGTH + 2)}nazi`)
    expect(long.length).toBe(MAX_HANDLE_LENGTH)
    // The slur fell off the end, so this one is genuinely fine -- asserting the
    // order matters: screening before clipping would reject a handle whose
    // stored form is harmless.
    expect(handleRejectionReason(long)).toBe(null)
  })
})
