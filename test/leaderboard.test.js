import { describe, test, expect } from 'vitest'
import { entryDisplayName, ANONYMOUS_NAME } from '../src/utils/leaderboard.js'

// The name column on the public board.
//
// The board used to list only runs carrying a handle, so playerName was always
// present and the column could render it raw. It now lists unnamed runs too,
// which means every caller has to survive a null here -- render it raw again
// and the fastest rows on the board go blank.

describe('entryDisplayName', () => {
  test('shows the handle a player set', () => {
    expect(entryDisplayName({ playerName: 'Ashgrave', you: false })).toBe('Ashgrave')
  })

  test('shows the stand-in when there is no handle', () => {
    expect(entryDisplayName({ playerName: null, you: false })).toBe(ANONYMOUS_NAME)
  })

  test('treats a whitespace handle as no handle, never a blank row', () => {
    expect(entryDisplayName({ playerName: '   ', you: false })).toBe(ANONYMOUS_NAME)
    expect(entryDisplayName({ playerName: '', you: false })).toBe(ANONYMOUS_NAME)
  })

  test('your own row says so, handle or not', () => {
    expect(entryDisplayName({ playerName: 'Ashgrave', you: true })).toBe('You')
    expect(entryDisplayName({ playerName: null, you: true })).toBe('You')
  })

  test('a malformed entry still renders something', () => {
    expect(entryDisplayName(undefined)).toBe(ANONYMOUS_NAME)
    expect(entryDisplayName({})).toBe(ANONYMOUS_NAME)
  })
})
