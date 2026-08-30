// The Forge: edit-batch generation and the invariants applyForgeEdit holds
// (issue 15, priority 2).
//
// The invariant that motivated this file is the 0.4 one: a visit may not mint
// a card with Inscribe and then immediately Upgrade the thing it just made.
// It lives entirely in the interaction between applyForgeEdit's
// `forgeInscribedIds` bookkeeping and upgradeCandidates' exclude set, which is
// exactly the shape nothing but a unit test reaches.

import { describe, it, expect } from 'vitest'
import {
  rollForgeGrants, rollForgeChoices, initForgeBatch, forgeActive,
  applyForgeEdit, skipForgeEdit, dismissMapPeek, pickBoon,
  UPGRADE_BONUS, UPGRADE_RANK_CAP,
} from '../src/games/scoundrel/logic/sanctuary'
import { DIAMOND, HEART, TOOL } from '../src/games/scoundrel/constants'
import { sanctuaryState, seededRng, scriptedRng, weaponCard, potionCard } from './support/state'

const kitCard = (suit, rank, id, extra = {}) => ({ suit, rank, id, ...extra })

describe('rollForgeGrants', () => {
  it('grants 2 edits below Tier 4 and 3 from sigil 5', () => {
    const kit = [weaponCard(4), potionCard(4)]
    for (const sigils of [0, 1, 2, 3, 4]) {
      expect(rollForgeGrants(kit, sigils, seededRng(sigils + 1))).toHaveLength(2)
    }
    for (const sigils of [5, 6, 9]) {
      expect(rollForgeGrants(kit, sigils, seededRng(sigils + 1))).toHaveLength(3)
    }
  })

  it('offers at most one Remove per visit', () => {
    const kit = [weaponCard(4), potionCard(4), weaponCard(5)]
    for (let seed = 1; seed <= 40; seed++) {
      const grants = rollForgeGrants(kit, 9, seededRng(seed))
      expect(grants.filter(g => g === 'remove').length).toBeLessThanOrEqual(1)
      for (const g of grants) expect(['inscribe', 'upgrade', 'remove']).toContain(g)
    }
  })

  it('falls back to Inscribe when there is nothing left to upgrade', () => {
    // Every kit card is already at the rank cap, so Upgrade has no candidates.
    const kit = [weaponCard(10), potionCard(10)]
    // 0.5 lands in the Upgrade band, 0.9 in the Remove band.
    expect(rollForgeGrants(kit, 0, scriptedRng([0.5, 0.5]))).toEqual(['inscribe', 'inscribe'])
  })

  it('falls back to Inscribe rather than emptying the kit', () => {
    const kit = [weaponCard(10)]
    expect(rollForgeGrants(kit, 0, scriptedRng([0.9, 0.9]))).toEqual(['inscribe', 'inscribe'])
  })

  it('grows the kit whenever the roll lands in the Inscribe band', () => {
    const kit = [weaponCard(4), potionCard(4)]
    expect(rollForgeGrants(kit, 0, scriptedRng([0.1, 0.1]))).toEqual(['inscribe', 'inscribe'])
  })
})

describe('rollForgeChoices', () => {
  it('offers 4 fresh tools for an Inscribe, at or below the progress cap', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const choices = rollForgeChoices('inscribe', [], 2, seededRng(seed))
      expect(choices).toHaveLength(4)
      for (const c of choices) {
        // Plain rolls are hearts or diamonds within the cap; a special frame
        // may replace one of them and carries its own rank range.
        if (!c.inscribed) {
          expect([DIAMOND, HEART]).toContain(c.suit)
          expect(c.rank).toBeGreaterThanOrEqual(2)
          expect(c.rank).toBeLessThanOrEqual(6) // cap = 4 + sigils
        }
      }
    }
  })

  it('never re-offers a oncePerRun frame the kit already holds', () => {
    const kit = [kitCard(HEART, 0, 'have_panacea', { inscribed: 'panacea' })]
    for (let seed = 1; seed <= 60; seed++) {
      const choices = rollForgeChoices('inscribe', kit, 6, seededRng(seed))
      expect(choices.some(c => c.inscribed === 'panacea')).toBe(false)
    }
  })

  it('offers only weapons and potions for an Upgrade', () => {
    const kit = [
      kitCard(DIAMOND, 4, 'd4'),
      kitCard(HEART, 4, 'h4'),
      kitCard('T', 0, 'map', { inscribed: 'map' }),
    ]
    const ids = rollForgeChoices('upgrade', kit, 0, seededRng(1)).map(c => c.id)
    expect(ids.sort()).toEqual(['d4', 'h4'])
  })

  it('holds back cards the upgrade would push past the rank cap', () => {
    const kit = [kitCard(DIAMOND, 8, 'd8'), kitCard(DIAMOND, 9, 'd9'), kitCard(DIAMOND, 10, 'd10')]
    expect(UPGRADE_BONUS).toBe(2)
    expect(UPGRADE_RANK_CAP).toBe(10)
    expect(rollForgeChoices('upgrade', kit, 0, seededRng(1)).map(c => c.id)).toEqual(['d8'])
  })

  it('holds back fixed-rank inscriptions, which do not scale', () => {
    const kit = [
      kitCard(DIAMOND, 14, 'fang', { inscribed: 'brittle_fang' }),
      kitCard(HEART, 0, 'elixir', { inscribed: 'panacea' }),
      kitCard(DIAMOND, 4, 'd4'),
    ]
    expect(rollForgeChoices('upgrade', kit, 0, seededRng(1)).map(c => c.id)).toEqual(['d4'])
  })

  it('samples up to 4 kit cards for a Remove', () => {
    const kit = Array.from({ length: 9 }, (_, i) => kitCard(DIAMOND, 4, `d${i}`))
    const choices = rollForgeChoices('remove', kit, 0, seededRng(1))
    expect(choices).toHaveLength(4)
    expect(new Set(choices.map(c => c.id)).size).toBe(4)
  })

  it('offers nothing for an unknown grant type', () => {
    expect(rollForgeChoices('nonsense', [weaponCard(4)], 0, seededRng(1))).toEqual([])
  })
})

describe('initForgeBatch', () => {
  it('skips a grant whose choices come back empty', () => {
    // Nothing upgradeable, so the batch opens on the Inscribe at index 1.
    const kit = [kitCard(DIAMOND, 10, 'd10')]
    const batch = initForgeBatch(['upgrade', 'inscribe'], kit, 0, seededRng(1))
    expect(batch.forgeGrantIndex).toBe(1)
    expect(batch.forgeChoices).toHaveLength(4)
  })

  it('runs off the end when every grant is empty', () => {
    const kit = [kitCard(DIAMOND, 10, 'd10')]
    const batch = initForgeBatch(['upgrade', 'upgrade'], kit, 0, seededRng(1))
    expect(batch.forgeGrantIndex).toBe(2)
    expect(batch.forgeChoices).toEqual([])
  })

  it('holds this visit\'s fresh inscribes out of an Upgrade offer', () => {
    const kit = [kitCard(DIAMOND, 4, 'old'), kitCard(DIAMOND, 4, 'fresh')]
    const batch = initForgeBatch(['upgrade'], kit, 0, seededRng(1), 0, ['fresh'])
    expect(batch.forgeChoices.map(c => c.id)).toEqual(['old'])
  })
})

describe('forgeActive', () => {
  it('is false with the forge closed', () => {
    expect(forgeActive(sanctuaryState({ forgeOpen: false, forgeGrants: ['inscribe'] }))).toBe(false)
  })

  it('is false once the batch is worked through', () => {
    expect(forgeActive(sanctuaryState({ forgeGrants: ['inscribe'], forgeGrantIndex: 1 }))).toBe(false)
  })

  it('is true mid-batch', () => {
    expect(forgeActive(sanctuaryState({ forgeGrants: ['inscribe', 'upgrade'], forgeGrantIndex: 1 }))).toBe(true)
  })
})

describe('applyForgeEdit — the inscribe-then-upgrade invariant', () => {
  // The 0.4 rule: a card minted this visit cannot be upgraded this visit.
  const minted = kitCard(DIAMOND, 4, 'minted')

  function afterInscribing(extraKit = []) {
    const state = sanctuaryState({
      kit: [kitCard(DIAMOND, 4, 'old'), ...extraKit],
      forgeGrants: ['inscribe', 'upgrade'],
      forgeGrantIndex: 0,
      forgeChoices: [minted],
      rng: seededRng(1),
    })
    return applyForgeEdit(state, 'minted')
  }

  it('records the minted card so the same visit cannot upgrade it', () => {
    const next = afterInscribing()
    expect(next.kit.map(c => c.id)).toEqual(['old', 'minted'])
    expect(next.forgeInscribedIds).toEqual(['minted'])
    expect(next.forgeGrants[next.forgeGrantIndex]).toBe('upgrade')
    expect(next.forgeChoices.map(c => c.id)).toEqual(['old'])
  })

  it('skips the Upgrade entirely when the mint was the only candidate', () => {
    // Kit holds one card already at the cap, so once the fresh mint is held
    // out there is nothing to upgrade and the batch closes.
    const state = sanctuaryState({
      kit: [kitCard(DIAMOND, 10, 'capped')],
      forgeGrants: ['inscribe', 'upgrade'],
      forgeChoices: [minted],
      rng: seededRng(1),
    })
    const next = applyForgeEdit(state, 'minted')
    expect(forgeActive(next)).toBe(false)
    expect(next.forgeChoices).toEqual([])
  })

  it('still lets Remove undo a fresh Inscribe', () => {
    const state = sanctuaryState({
      kit: [kitCard(DIAMOND, 4, 'old')],
      forgeGrants: ['inscribe', 'remove'],
      forgeChoices: [minted],
      rng: seededRng(1),
    })
    const next = applyForgeEdit(state, 'minted')
    expect(next.forgeChoices.map(c => c.id).sort()).toEqual(['minted', 'old'])
  })

  it('the hold lasts only for the visit', () => {
    // A later visit rolls with a cleared forgeInscribedIds and offers it again.
    const kit = afterInscribing().kit
    expect(rollForgeChoices('upgrade', kit, 0, seededRng(1)).map(c => c.id).sort())
      .toEqual(['minted', 'old'])
  })
})

describe('applyForgeEdit', () => {
  const base = overrides => sanctuaryState({
    kit: [kitCard(DIAMOND, 4, 'd4'), kitCard(HEART, 6, 'h6')],
    forgeGrants: ['upgrade'],
    forgeGrantIndex: 0,
    forgeChoices: [kitCard(DIAMOND, 4, 'd4')],
    rng: seededRng(1),
    ...overrides,
  })

  it('bumps an upgraded card by the fixed bonus and tags it', () => {
    const next = applyForgeEdit(base(), 'd4')
    expect(next.kit.find(c => c.id === 'd4')).toMatchObject({
      rank: 6, upgraded: true, upgradeBonus: 2,
    })
    expect(next.kitEdits).toBe(1)
  })

  it('accumulates the bonus across visits', () => {
    const once = applyForgeEdit(base(), 'd4')
    const twice = applyForgeEdit(base({
      kit: once.kit,
      forgeChoices: [once.kit.find(c => c.id === 'd4')],
    }), 'd4')
    expect(twice.kit.find(c => c.id === 'd4')).toMatchObject({ rank: 8, upgradeBonus: 4 })
  })

  it('refuses an upgrade that would break the rank cap', () => {
    const s = base({
      kit: [kitCard(DIAMOND, 9, 'd9'), kitCard(HEART, 4, 'h4')],
      forgeChoices: [kitCard(DIAMOND, 9, 'd9')],
    })
    expect(applyForgeEdit(s, 'd9')).toBe(s)
  })

  it('removes the chosen card', () => {
    const s = base({
      forgeGrants: ['remove'],
      forgeChoices: [kitCard(DIAMOND, 4, 'd4')],
    })
    expect(applyForgeEdit(s, 'd4').kit.map(c => c.id)).toEqual(['h6'])
  })

  it('refuses to empty the kit', () => {
    const s = base({
      kit: [kitCard(DIAMOND, 4, 'd4')],
      forgeGrants: ['remove'],
      forgeChoices: [kitCard(DIAMOND, 4, 'd4')],
    })
    expect(applyForgeEdit(s, 'd4')).toBe(s)
  })

  it('refuses a second copy of a oncePerRun inscription', () => {
    const elixir = kitCard(HEART, 0, 'elixir2', { inscribed: 'panacea' })
    const s = base({
      kit: [kitCard(HEART, 0, 'elixir1', { inscribed: 'panacea' }), kitCard(DIAMOND, 4, 'd4')],
      forgeGrants: ['inscribe'],
      forgeChoices: [elixir],
    })
    expect(applyForgeEdit(s, 'elixir2')).toBe(s)
  })

  // The three edits are named for the player in plain words -- Add, Upgrade,
  // Remove -- while the grant type stays keyed `inscribe` in the state, the
  // save and every recorded run. That split is deliberate and invisible from
  // the outside, so what is asserted here is the wording: a future rename that
  // reaches the log line has changed what the player reads.
  it('logs a plain added card in the player-facing wording', () => {
    const s = base({
      forgeGrants: ['inscribe'],
      forgeChoices: [kitCard(DIAMOND, 4, 'fresh')],
    })
    const next = applyForgeEdit(s, 'fresh')
    expect(next.log.at(-1)).toBe('Added 4♦ to the kit.')
    expect(next.log.at(-1)).not.toMatch(/inscrib/i)
  })

  it('logs an added inscription by its frame name, not the raw grant key', () => {
    const s = base({
      forgeGrants: ['inscribe'],
      forgeChoices: [kitCard(TOOL, 4, 'coin', { inscribed: 'lucky_coin' })],
    })
    const next = applyForgeEdit(s, 'coin')
    expect(next.log.at(-1)).toBe('Added Lucky Coin (4) to the kit.')
    expect(next.log.at(-1)).not.toMatch(/inscrib/i)
  })

  // The rename must not have leaked into the persisted grant type: run records
  // and in-progress saves both carry it, and /admin plus PostHog group on it.
  it('still records the grant type as `inscribe` in the decision funnel', () => {
    const s = base({
      forgeGrants: ['inscribe'],
      forgeChoices: [kitCard(DIAMOND, 4, 'fresh')],
    })
    expect(applyForgeEdit(s, 'fresh').forgeEdits[0]).toMatchObject({ type: 'inscribe' })
  })

  it('is a no-op outside the sanctuary, with the forge shut, or off-offer', () => {
    expect(applyForgeEdit(base({ phase: 'descent' }), 'd4').phase).toBe('descent')
    const shut = base({ forgeOpen: false })
    expect(applyForgeEdit(shut, 'd4')).toBe(shut)
    const s = base()
    expect(applyForgeEdit(s, 'not_offered')).toBe(s)
  })

  it('records the decision funnel entry for the edit', () => {
    const next = applyForgeEdit(base({ sigilsEarned: 3 }), 'd4')
    expect(next.forgeEdits).toHaveLength(1)
    expect(next.forgeEdits[0]).toMatchObject({
      descent: 4,
      type: 'upgrade',
      chosen: { suit: DIAMOND, rank: 4, inscribed: null, upgraded: false },
      skipped: false,
    })
    expect(next.forgeEdits[0].offered).toHaveLength(1)
  })
})

describe('skipForgeEdit', () => {
  it('advances the batch without touching the kit', () => {
    const s = sanctuaryState({
      kit: [kitCard(DIAMOND, 4, 'd4'), kitCard(HEART, 6, 'h6')],
      forgeGrants: ['upgrade', 'remove'],
      forgeChoices: [kitCard(DIAMOND, 4, 'd4')],
      rng: seededRng(1),
    })
    const next = skipForgeEdit(s)
    expect(next.kit).toEqual(s.kit)
    expect(next.kitEdits).toBe(0)
    expect(next.forgeGrantIndex).toBe(1)
    expect(next.forgeEdits[0]).toMatchObject({ type: 'upgrade', chosen: null, skipped: true })
  })

  it('is a no-op with no grant active', () => {
    const s = sanctuaryState({ forgeGrants: [], forgeChoices: [] })
    expect(skipForgeEdit(s)).toBe(s)
  })
})

describe('pickBoon', () => {
  const offered = ['vanguard', 'brawler', 'numb']

  it('takes the boon and closes the offer', () => {
    const s = sanctuaryState({ boonOffers: offered, boonChosen: false, sigilsEarned: 2 })
    const next = pickBoon(s, 'brawler')
    expect(next.boons).toEqual(['brawler'])
    expect(next.boonChosen).toBe(true)
    expect(next.boonOffers).toEqual([])
    expect(next.boonPicks).toEqual([{ descent: 3, offered, picked: 'brawler' }])
  })

  it('refuses a boon that was not offered', () => {
    const s = sanctuaryState({ boonOffers: offered, boonChosen: false })
    expect(pickBoon(s, 'glass_cannon')).toBe(s)
  })

  it('refuses a second pick in the same visit', () => {
    const s = sanctuaryState({ boonOffers: offered, boonChosen: true })
    expect(pickBoon(s, 'brawler')).toBe(s)
  })

  it('is a no-op outside the sanctuary', () => {
    const s = sanctuaryState({ phase: 'descent', boonOffers: offered, boonChosen: false })
    expect(pickBoon(s, 'brawler')).toBe(s)
  })
})

describe('dismissMapPeek', () => {
  it('clears the snapshot and is idempotent', () => {
    const s = sanctuaryState({ mapPeek: [weaponCard(3)] })
    expect(dismissMapPeek(s).mapPeek).toBeNull()
    const cleared = sanctuaryState({ mapPeek: null })
    expect(dismissMapPeek(cleared)).toBe(cleared)
  })
})
