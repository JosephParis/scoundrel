// Theme selection (issue 15, priority 4).
//
// `pickThemeId` carries the 0.4 balance change — a Trial may not repeat within
// a run, not merely back-to-back — plus two fallback tiers that only fire if a
// pool is exhausted. Both are invisible in play until they are wrong, so they
// get a seeded rng and an explicit assertion here.

import { describe, it, expect } from 'vitest'
import {
  THEMES, pickThemeId, resolveThemeChildren, getTheme, getActiveThemes, getVisibleThemes,
} from '../src/games/scoundrel/themes'
import { seededRng, scriptedRng } from './support/state'

// The rotation pools, derived the same way the module does. Experimental
// Trials are held out unless the `specialMonsters` flag is on, and it is off
// by default (there is no localStorage under vitest's node environment, so the
// flag module falls back to DEFAULTS).
const tier = n => Object.values(THEMES).filter(t => t.tier === n && !t.experimental).map(t => t.id)

const POOLS = {
  1: tier(1),
  2: tier(2),
  3: Object.values(THEMES).filter(t => t.tier === 3).map(t => t.id),
  4: tier(4),
  5: tier(5),
}

describe('theme pools', () => {
  // The run-level no-repeat rule can only hold if each band offers more themes
  // than the descents that draw from it. If a pool ever shrinks below this,
  // pickThemeId silently starts falling back instead of failing.
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
  ])('tier %i holds more themes than the %i descent(s) that draw from it', (t, descents) => {
    expect(POOLS[t].length).toBeGreaterThan(descents)
  })

  it('hides experimental Trials from the reference UI while the flag is off', () => {
    const visible = getVisibleThemes()
    expect(visible.some(t => t.experimental)).toBe(false)
    expect(visible.length).toBeLessThan(Object.keys(THEMES).length)
  })
})

describe('pickThemeId band selection', () => {
  it.each([
    [0, 1],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 4],
    [6, 4],
    [7, 5],
    [9, 5],
  ])('draws sigils %i from tier %i', (sigils, expectedTier) => {
    // Sweep the whole [0,1) range so every slot in the pool is reachable.
    for (let i = 0; i < 40; i++) {
      const id = pickThemeId(scriptedRng([i / 40]), sigils)
      expect(POOLS[expectedTier]).toContain(id)
    }
  })

  it('is deterministic under a seeded rng', () => {
    expect(pickThemeId(seededRng(77), 3)).toBe(pickThemeId(seededRng(77), 3))
  })
})

describe('pickThemeId no-repeat', () => {
  it('never repeats a theme across a full 10-descent run', () => {
    // Descents 2-10 pick a theme (descent 1 is always The Quiet), so sigils
    // run 1 through 9 and every pick is added to the exclude list.
    const rng = seededRng(2026)
    const seen = []
    for (let sigils = 1; sigils <= 9; sigils++) {
      const id = pickThemeId(rng, sigils, seen)
      expect(seen).not.toContain(id)
      seen.push(id)
    }
    expect(new Set(seen).size).toBe(9)
  })

  it('holds no matter the seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = seededRng(seed)
      const seen = []
      for (let sigils = 1; sigils <= 9; sigils++) seen.push(pickThemeId(rng, sigils, seen))
      expect(new Set(seen).size).toBe(9)
    }
  })

  it('accepts a bare id as well as a list', () => {
    const only = POOLS[1]
    for (const excluded of only) {
      for (let i = 0; i < 20; i++) {
        expect(pickThemeId(scriptedRng([i / 20]), 0, excluded)).not.toBe(excluded)
      }
    }
  })

  it('ignores exclusions that are not in the band', () => {
    const id = pickThemeId(seededRng(4), 0, ['hungry_dark', 'carrion'])
    expect(POOLS[1]).toContain(id)
  })
})

describe('pickThemeId fallbacks', () => {
  it('relaxes run-level uniqueness but still avoids the theme just played', () => {
    // Every Tier 1 theme excluded: the strict pool is empty, so the first
    // fallback drops the constraint down to "not the last one".
    const pool = POOLS[1]
    const exhausted = pool.slice()
    for (let i = 0; i < 30; i++) {
      const id = pickThemeId(scriptedRng([i / 30]), 0, exhausted)
      expect(pool).toContain(id)
      expect(id).not.toBe(exhausted[exhausted.length - 1])
    }
  })

  it('still returns something when even the relaxed pool is empty', () => {
    // A one-theme band whose only theme was also the last played: both
    // fallbacks are exhausted, and the pick must not come back undefined.
    const single = POOLS[1].slice(0, 1)
    const exclude = POOLS[1].filter(id => id !== single[0]).concat(single)
    const id = pickThemeId(seededRng(8), 0, exclude)
    expect(POOLS[1]).toContain(id)
    expect(id).toBeDefined()
  })

  it('never returns undefined for any exclusion set in any band', () => {
    for (const [t, sigils] of [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7]]) {
      for (let i = 0; i < 20; i++) {
        const id = pickThemeId(scriptedRng([i / 20]), sigils, POOLS[t].slice())
        expect(POOLS[t]).toContain(id)
      }
    }
  })
})

describe('resolveThemeChildren', () => {
  it('returns null for a non-compound theme', () => {
    expect(resolveThemeChildren('the_armory', seededRng(1))).toBeNull()
    expect(resolveThemeChildren('nope', seededRng(1))).toBeNull()
  })

  it('picks two distinct Tier 3 children for The Long Night', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const children = resolveThemeChildren('the_long_night', seededRng(seed))
      expect(children).toHaveLength(2)
      expect(children[0]).not.toBe(children[1])
      for (const id of children) expect(POOLS[3]).toContain(id)
    }
  })

  it('is deterministic under a seeded rng', () => {
    expect(resolveThemeChildren('the_long_night', seededRng(5)))
      .toEqual(resolveThemeChildren('the_long_night', seededRng(5)))
  })
})

describe('getActiveThemes', () => {
  it('is empty with no theme', () => {
    expect(getActiveThemes(null, null)).toEqual([])
    expect(getActiveThemes(undefined, undefined)).toEqual([])
  })

  it('is the theme itself for a plain theme', () => {
    expect(getActiveThemes('the_armory', null)).toEqual([getTheme('the_armory')])
  })

  it('expands a compound theme into its resolved children', () => {
    const active = getActiveThemes('the_long_night', ['tithe', 'the_bog'])
    expect(active.map(t => t.id)).toEqual(['tithe', 'the_bog'])
  })

  it('falls back to the parent when a compound theme has no children yet', () => {
    // A save written before the children were resolved must not produce an
    // empty effect list, which would silently disable the Trial.
    expect(getActiveThemes('the_long_night', null).map(t => t.id)).toEqual(['the_long_night'])
  })

  it('drops children that no longer exist', () => {
    expect(getActiveThemes('the_long_night', ['tithe', 'deleted_theme']).map(t => t.id))
      .toEqual(['tithe'])
  })
})
