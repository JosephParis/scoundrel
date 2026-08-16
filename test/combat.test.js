// Combat: damage arithmetic, weapon binding and durability (issue 15,
// priority 1 — the largest file and the most rules per line).
//
// Every test here plays a card through the real entry point (`playCard` /
// `playCardBare` / `applyHpLoss`) rather than reaching into the private damage
// helper, so the ordering of the reductions is covered as well as each one.
//
// Rooms are built with four cards so `checkRefillAndComplete` does not fire
// mid-assertion; the refill and victory rules get their own block at the end.

import { describe, it, expect } from 'vitest'
import {
  playCard, playCardBare, applyHpLoss, pickBestWeaponFor, isWeaponUsable,
  checkRefillAndComplete,
} from '../src/games/scoundrel/logic/combat'
import { WOUND } from '../src/games/scoundrel/constants'
import {
  descentState, equipped, club, spade, weaponCard, potionCard, roomOf, seededRng,
} from './support/state'

// Fillers keep the room above the refill threshold without affecting damage.
const filler = () => [potionCard(2), potionCard(3), potionCard(4)]

// Play the card in slot 0 and report what it cost.
function fightAt0(state, { bare = false } = {}) {
  const next = bare ? playCardBare(state, 0) : playCard(state, 0)
  return { next, damage: state.hp - next.hp }
}

describe('pickBestWeaponFor / isWeaponUsable', () => {
  it('is bare-handed with no weapon equipped', () => {
    const s = descentState()
    expect(pickBestWeaponFor(s, spade(7))).toBeNull()
    expect(isWeaponUsable(s, spade(7))).toBe(false)
  })

  it('swings a fresh weapon at any rank', () => {
    const s = descentState({ weapon: equipped(2) })
    expect(pickBestWeaponFor(s, spade(14)).slot).toBe('primary')
  })

  it('respects the binding: only monsters at or below the last kill', () => {
    const s = descentState({ weapon: equipped(9, { lastSlain: { rank: 7 } }) })
    expect(isWeaponUsable(s, spade(7))).toBe(true)
    expect(isWeaponUsable(s, spade(6))).toBe(true)
    expect(isWeaponUsable(s, spade(8))).toBe(false)
  })

  it('binds on the printed rank, not the effective one', () => {
    // Keen Edge lifts the swing, not the binding.
    const s = descentState({
      weapon: equipped(5, { lastSlain: { rank: 5 } }),
      boons: ['whetstone'],
    })
    expect(isWeaponUsable(s, spade(6))).toBe(false)
  })

  it('never swings at an armored monster', () => {
    const s = descentState({ weapon: equipped(10) })
    expect(pickBestWeaponFor(s, spade(3, { armored: true }))).toBeNull()
  })

  it('prefers the higher effective rank between primary and spare', () => {
    const s = descentState({ weapon: equipped(5), spareWeapon: equipped(8) })
    expect(pickBestWeaponFor(s, spade(3)).slot).toBe('spare')
  })

  it('counts a weapon-borne Strength bonus when choosing', () => {
    // The 5 out-swings the 8 once Potion of Strength is banked on it.
    const s = descentState({
      weapon: equipped(5, { strengthBonus: 4 }),
      spareWeapon: equipped(8),
    })
    expect(pickBestWeaponFor(s, spade(3)).slot).toBe('primary')
  })

  it('falls through to the spare when the primary is bound too low', () => {
    const s = descentState({
      weapon: equipped(10, { lastSlain: { rank: 3 } }),
      spareWeapon: equipped(4),
    })
    expect(pickBestWeaponFor(s, spade(9)).slot).toBe('spare')
  })
})

describe('bare-handed damage', () => {
  it('costs the monster its full rank', () => {
    const s = descentState({ room: roomOf(spade(9), ...filler()) })
    expect(fightAt0(s).damage).toBe(9)
  })

  it('Brawler takes 3 off a bare-handed fight', () => {
    const s = descentState({ room: roomOf(spade(9), ...filler()), boons: ['brawler'] })
    expect(fightAt0(s).damage).toBe(6)
  })

  it('Vanguard takes 2 off the first fight of a room only', () => {
    const room = roomOf(spade(9), ...filler())
    expect(fightAt0(descentState({ room, boons: ['vanguard'] })).damage).toBe(7)
    expect(fightAt0(descentState({ room, boons: ['vanguard'], monstersFoughtThisRoom: 1 })).damage).toBe(9)
  })

  it('stacks Brawler, Vanguard and a suit boon on the same hit', () => {
    // 9 - 3 (Brawler) - 2 (Vanguard) - 2 (Sworn Vendetta vs spades) = 2.
    const s = descentState({
      room: roomOf(spade(9), ...filler()),
      boons: ['brawler', 'vanguard', 'sworn_vendetta'],
    })
    expect(fightAt0(s).damage).toBe(2)
  })

  it('applies a suit boon only to its own suit', () => {
    const boons = ['sworn_vendetta']
    expect(fightAt0(descentState({ room: roomOf(spade(9), ...filler()), boons })).damage).toBe(7)
    expect(fightAt0(descentState({ room: roomOf(club(9), ...filler()), boons })).damage).toBe(9)
  })

  it('floors at zero rather than healing you', () => {
    const s = descentState({
      hp: 12,
      room: roomOf(spade(3), ...filler()),
      boons: ['brawler', 'vanguard'],
    })
    const { next, damage } = fightAt0(s)
    expect(damage).toBe(0)
    expect(next.hp).toBe(12)
  })

  it('spends a banked Riposte charge', () => {
    const s = descentState({ room: roomOf(spade(9), ...filler()), riposteCharge: 3 })
    const { next, damage } = fightAt0(s)
    expect(damage).toBe(6)
    expect(next.riposteCharge).toBe(0)
  })

  it('banks half the damage taken when Riposte is held', () => {
    const s = descentState({ room: roomOf(spade(9), ...filler()), boons: ['riposte'] })
    expect(fightAt0(s).next.riposteCharge).toBe(4)
  })
})

describe('weapon damage', () => {
  it('subtracts the weapon rank from the monster rank', () => {
    const s = descentState({ weapon: equipped(5), room: roomOf(spade(7), ...filler()) })
    expect(fightAt0(s).damage).toBe(2)
  })

  it('costs nothing when the weapon outranks the monster', () => {
    const s = descentState({ weapon: equipped(9), room: roomOf(spade(7), ...filler()) })
    expect(fightAt0(s).damage).toBe(0)
  })

  it('Keen Edge lifts the swing by 1', () => {
    const s = descentState({
      weapon: equipped(5), room: roomOf(spade(9), ...filler()), boons: ['whetstone'],
    })
    expect(fightAt0(s).damage).toBe(3)
  })

  it('Wounded Lion only applies under 10 HP', () => {
    const room = roomOf(spade(9), ...filler())
    const boons = ['wounded_lion']
    expect(fightAt0(descentState({ hp: 20, weapon: equipped(5), room, boons })).damage).toBe(4)
    expect(fightAt0(descentState({ hp: 9, weapon: equipped(5), room, boons })).damage).toBe(2)
  })

  it('Berserker scales with kills already made this room', () => {
    const s = descentState({
      weapon: equipped(5),
      room: roomOf(spade(9), ...filler()),
      boons: ['berserker'],
      monstersFoughtThisRoom: 2,
    })
    expect(fightAt0(s).damage).toBe(2)
  })

  it("Coward's Reward spends its charge on the room's opening weapon strike", () => {
    const s = descentState({
      weapon: equipped(5),
      room: roomOf(spade(9), ...filler()),
      boons: ['cowards_reward'],
      cowardsRewardCharge: 3,
    })
    const { next, damage } = fightAt0(s)
    expect(damage).toBe(1)
    expect(next.cowardsRewardCharge).toBe(0)
  })

  it("does not spend Coward's Reward on a bare-handed opening", () => {
    // The charge is a weapon bonus, but the room's opening is still used up.
    const s = descentState({
      room: roomOf(spade(9), ...filler()),
      boons: ['cowards_reward'],
      cowardsRewardCharge: 3,
    })
    const { next, damage } = fightAt0(s, { bare: true })
    expect(damage).toBe(9)
    expect(next.cowardsRewardCharge).toBe(0)
  })

  it('Glass Cannon swings +4 from the same 5♦', () => {
    const s = descentState({
      weapon: equipped(5), room: roomOf(spade(12), ...filler()), boons: ['glass_cannon'],
    })
    expect(fightAt0(s).damage).toBe(3)
  })
})

describe('weapon durability', () => {
  it('binds the weapon to the rank it just killed', () => {
    const s = descentState({ weapon: equipped(9), room: roomOf(spade(6), ...filler()) })
    expect(playCard(s, 0).weapon.lastSlain).toEqual({ rank: 6 })
  })

  it('binds the spare when the spare is the one that swung', () => {
    const s = descentState({
      weapon: equipped(10, { lastSlain: { rank: 2 } }),
      spareWeapon: equipped(8),
      room: roomOf(spade(6), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.spareWeapon.lastSlain).toEqual({ rank: 6 })
    expect(next.weapon.lastSlain).toEqual({ rank: 2 })
  })

  it('Crushing Blow leaves the binding alone on a free kill', () => {
    const s = descentState({
      weapon: equipped(9), room: roomOf(spade(6), ...filler()), boons: ['crushing_blow'],
    })
    expect(playCard(s, 0).weapon.lastSlain).toBeNull()
  })

  it('Crushing Blow still binds when the kill costs HP', () => {
    const s = descentState({
      weapon: equipped(5), room: roomOf(spade(9), ...filler()), boons: ['crushing_blow'],
    })
    expect(playCard(s, 0).weapon.lastSlain).toEqual({ rank: 9 })
  })

  it('Executioner lifts the binding on a bare-handed kill', () => {
    const s = descentState({
      weapon: equipped(5, { lastSlain: { rank: 3 } }),
      room: roomOf(spade(11), ...filler()),
      boons: ['executioner'],
      hp: 20,
    })
    expect(playCardBare(s, 0).weapon.lastSlain).toEqual({ rank: 11 })
  })

  it('Executioner never lowers an existing binding', () => {
    const s = descentState({
      weapon: equipped(5, { lastSlain: { rank: 11 } }),
      room: roomOf(spade(3), ...filler()),
      boons: ['executioner'],
    })
    expect(playCardBare(s, 0).weapon.lastSlain).toEqual({ rank: 11 })
  })

  it('Brittle Fang breaks itself after a single kill', () => {
    const s = descentState({
      weapon: equipped(14, { inscribed: 'brittle_fang' }),
      room: roomOf(spade(2), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.weapon).toBeNull()
    expect(next.log.join(' ')).toContain('Brittle Fang')
  })

  it('Vampiric Edge drinks 2 HP back on a weapon kill, capped at max', () => {
    const base = {
      weapon: equipped(9, { inscribed: 'vampiric_edge' }),
      room: roomOf(spade(9), ...filler()),
    }
    expect(playCard(descentState({ ...base, hp: 10 }), 0).hp).toBe(12)
    expect(playCard(descentState({ ...base, hp: 20 }), 0).hp).toBe(20)
  })

  it('Vampiric Edge does nothing on a bare-handed kill', () => {
    const s = descentState({
      hp: 10,
      weapon: equipped(9, { inscribed: 'vampiric_edge' }),
      room: roomOf(spade(2), ...filler()),
    })
    expect(playCardBare(s, 0).hp).toBe(8)
  })

  it("Gambler's Flail rerolls its edge to a fresh 2-10 after the swing", () => {
    const s = descentState({
      weapon: equipped(9, { inscribed: 'wildedge' }),
      room: roomOf(spade(2), ...filler()),
      rng: seededRng(3),
    })
    const rank = playCard(s, 0).weapon.rank
    expect(rank).toBeGreaterThanOrEqual(2)
    expect(rank).toBeLessThanOrEqual(10)
  })

  it('a Whetstone card frees both blades', () => {
    const s = descentState({
      weapon: equipped(5, { lastSlain: { rank: 3 } }),
      spareWeapon: equipped(7, { lastSlain: { rank: 4 } }),
      room: roomOf({ suit: 'T', rank: 0, id: 'whet', inscribed: 'whetstone' }, ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.weapon.lastSlain).toBeNull()
    expect(next.spareWeapon.lastSlain).toBeNull()
  })

  it('a Whetstone with no weapon in hand still resolves', () => {
    const s = descentState({
      room: roomOf({ suit: 'T', rank: 0, id: 'whet', inscribed: 'whetstone' }, ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.room[0]).toBeNull()
    expect(next.weapon).toBeNull()
  })
})

describe('equipping a weapon', () => {
  it('takes up the diamond and clears any binding', () => {
    const s = descentState({
      weapon: equipped(9, { lastSlain: { rank: 2 } }),
      room: roomOf(weaponCard(6), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.weapon).toMatchObject({ rank: 6, originalRank: 6, lastSlain: null })
  })

  it('discards the old weapon without Quartermaster', () => {
    const s = descentState({ weapon: equipped(9), room: roomOf(weaponCard(6), ...filler()) })
    expect(playCard(s, 0).spareWeapon).toBeNull()
  })

  it('Quartermaster slings the old weapon to the spare slot', () => {
    const s = descentState({
      weapon: equipped(9, { lastSlain: { rank: 4 } }),
      room: roomOf(weaponCard(6), ...filler()),
      boons: ['quartermaster'],
    })
    const next = playCard(s, 0)
    expect(next.weapon.rank).toBe(6)
    expect(next.spareWeapon).toMatchObject({ rank: 9, lastSlain: { rank: 4 } })
  })

  it('Quartermaster fills the primary slot first when unarmed', () => {
    const s = descentState({
      spareWeapon: equipped(3), room: roomOf(weaponCard(6), ...filler()), boons: ['quartermaster'],
    })
    const next = playCard(s, 0)
    expect(next.weapon.rank).toBe(6)
    expect(next.spareWeapon.rank).toBe(3)
  })
})

describe('applyHpLoss', () => {
  it('takes the damage straight off HP', () => {
    const { state, dead } = applyHpLoss(descentState({ hp: 15 }), 4)
    expect(state.hp).toBe(11)
    expect(dead).toBe(false)
  })

  it('Numb soaks up to 2 from the first hit of a room', () => {
    const s = descentState({ hp: 20, boons: ['numb'], numbRemaining: 2 })
    const first = applyHpLoss(s, 6)
    expect(first.state.hp).toBe(16)
    expect(first.state.numbRemaining).toBe(0)
    // Spent: the next hit lands in full.
    expect(applyHpLoss(first.state, 6).state.hp).toBe(10)
  })

  it('Numb is spent even when it absorbed less than 2', () => {
    // A 1 HP hit costs Numb the whole shield, so the next hit is unguarded.
    const s = descentState({ hp: 20, boons: ['numb'], numbRemaining: 2 })
    const first = applyHpLoss(s, 1)
    expect(first.state.hp).toBe(20)
    expect(first.state.numbRemaining).toBe(0)
    expect(applyHpLoss(first.state, 6).state.hp).toBe(14)
  })

  it('Twin Souls converts one killing blow per descent into 1 HP', () => {
    const s = descentState({ hp: 5, boons: ['twin_souls'] })
    const saved = applyHpLoss(s, 40)
    expect(saved.dead).toBe(false)
    expect(saved.state.hp).toBe(1)
    expect(saved.state.twinSoulsUsed).toBe(true)

    const second = applyHpLoss(saved.state, 40)
    expect(second.dead).toBe(true)
    expect(second.state.phase).toBe('gameover')
  })

  it('Second Wind catches a drop to 3 or less, once', () => {
    const s = descentState({ hp: 10, maxHp: 20, boons: ['second_wind'] })
    const caught = applyHpLoss(s, 8)
    expect(caught.state.hp).toBe(6)
    expect(caught.state.secondWindUsed).toBe(true)
    expect(applyHpLoss(caught.state, 4).state.hp).toBe(2)
  })

  it('Second Wind never lifts you above max HP', () => {
    // It steadies at 6, or at max HP if that is lower (Glass Cannon territory).
    const s = descentState({ hp: 5, maxHp: 4, boons: ['second_wind'] })
    expect(applyHpLoss(s, 2).state.hp).toBe(4)
  })

  it('records the killing blow for the death analytics', () => {
    const s = descentState({ hp: 4, sigilsEarned: 2, theme: 'the_armory' })
    const { state, dead } = applyHpLoss(s, 9, { source: 'monster', barehanded: true })
    expect(dead).toBe(true)
    expect(state.hp).toBe(0)
    expect(state.phase).toBe('gameover')
    expect(state.deathContext).toMatchObject({
      source: 'monster', barehanded: true, damage: 9, hpBefore: 4, descent: 3, theme: 'the_armory',
    })
  })

  it('bleeds no Wound into the deck while the wounds flag is off', () => {
    // The flag defaults off, so a heavy hit must not seed the deck.
    const s = descentState({ hp: 20, deck: [spade(3)] })
    const { state } = applyHpLoss(s, 12)
    expect(state.deck.some(c => c.suit === WOUND)).toBe(false)
  })
})

describe('monster traits', () => {
  it('a relentless monster strikes twice', () => {
    const s = descentState({ room: roomOf(spade(6, { relentless: true }), ...filler()) })
    expect(fightAt0(s).damage).toBe(12)
  })

  it('a swelling monster hits harder for each kill already made this room', () => {
    const s = descentState({
      room: roomOf(spade(6, { swelling: true }), ...filler()), monstersFoughtThisRoom: 3,
    })
    expect(fightAt0(s).damage).toBe(9)
  })

  it('a vengeful death leaves a lingering +1 on the room', () => {
    const s = descentState({ room: roomOf(spade(4, { vengeful: true }), club(4), potionCard(2), potionCard(3)) })
    const after = playCard(s, 0)
    expect(after.vengefulBonus).toBe(1)
    expect(after.hp - playCard(after, 1).hp).toBe(5)
  })

  it('a cursed monster lands its affliction on the kill', () => {
    const s = descentState({
      room: roomOf(spade(3, { cursed: true, afflicts: { id: 'sealed', rooms: 2 } }), ...filler()),
    })
    expect(playCard(s, 0).afflictions.sealed).toBe(2)
  })

  it('an armored monster is fought bare-handed even with a weapon in hand', () => {
    const s = descentState({
      weapon: equipped(9), room: roomOf(spade(6, { armored: true }), ...filler()),
    })
    const { next, damage } = fightAt0(s)
    expect(damage).toBe(6)
    // The blade never swung, so its binding stays clean.
    expect(next.weapon.lastSlain).toBeNull()
  })
})

describe('potions', () => {
  it('heals its rank, capped at max HP', () => {
    expect(playCard(descentState({ hp: 10, room: roomOf(potionCard(6), ...filler()) }), 0).hp).toBe(16)
    expect(playCard(descentState({ hp: 18, room: roomOf(potionCard(6), ...filler()) }), 0).hp).toBe(20)
  })

  it('wastes any heart past the room limit of one', () => {
    const s = descentState({ hp: 10, potionsUsedThisRoom: 1, room: roomOf(potionCard(6), ...filler()) })
    const next = playCard(s, 0)
    expect(next.hp).toBe(10)
    expect(next.log.join(' ')).toContain('No thirst left')
  })

  it('Deep Draught raises the limit to two', () => {
    const s = descentState({
      hp: 10, potionsUsedThisRoom: 1, boons: ['sip_of_lethe'], room: roomOf(potionCard(6), ...filler()),
    })
    expect(playCard(s, 0).hp).toBe(16)
  })

  it('Alchemist adds 2 to every draught', () => {
    const s = descentState({ hp: 5, boons: ['alchemist'], room: roomOf(potionCard(6), ...filler()) })
    expect(playCard(s, 0).hp).toBe(13)
  })

  it('Sealed blocks the heal but still spends the card', () => {
    const s = descentState({
      hp: 10, afflictions: { sealed: 2 }, room: roomOf(potionCard(6), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.hp).toBe(10)
    expect(next.room[0]).toBeNull()
    expect(next.potionsUsedThisRoom).toBe(1)
  })

  it('Elixir of Life restores to full whatever its rank', () => {
    const s = descentState({
      hp: 3, room: roomOf(potionCard(2, { inscribed: 'panacea' }), ...filler()),
    })
    expect(playCard(s, 0).hp).toBe(20)
  })

  it('Draught of Vigor lifts max HP by 2 and heals its rank', () => {
    const s = descentState({
      hp: 20, room: roomOf(potionCard(5, { inscribed: 'draught_of_vigor' }), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.maxHp).toBe(22)
    expect(next.hp).toBe(22)
  })

  it('Potion of Strength whets the equipped blade instead of healing', () => {
    const s = descentState({
      hp: 10, weapon: equipped(5),
      room: roomOf(potionCard(4, { inscribed: 'potion_of_strength' }), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.hp).toBe(10)
    expect(next.weapon.strengthBonus).toBe(4)
  })

  it('Potion of Strength is wasted with no weapon in hand', () => {
    const s = descentState({
      hp: 10, room: roomOf(potionCard(4, { inscribed: 'potion_of_strength' }), ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.hp).toBe(10)
    expect(next.log.join(' ')).toContain('wasted')
  })

  it('Lucky Coin heals without spending the room potion charge', () => {
    const s = descentState({
      hp: 10, deck: [spade(5)],
      room: roomOf({ suit: 'T', rank: 4, id: 'coin', inscribed: 'lucky_coin' }, ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.hp).toBe(14)
    expect(next.potionsUsedThisRoom).toBe(0)
    // It refills the slot it left from the top of the deck.
    expect(next.room[0].id).toBe('S5')
    expect(next.deck).toHaveLength(0)
  })

  it('Lucky Coin still resolves on an empty deck', () => {
    const s = descentState({
      hp: 10, deck: [],
      room: roomOf({ suit: 'T', rank: 4, id: 'coin', inscribed: 'lucky_coin' }, ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.hp).toBe(14)
    expect(next.room[0]).toBeNull()
  })
})

describe('tool cards', () => {
  it('a Torch burns the strongest non-boss monster in the room', () => {
    const s = descentState({
      room: roomOf({ suit: 'T', rank: 0, id: 'torch', inscribed: 'torch' }, spade(4), club(11), spade(7)),
    })
    const next = playCard(s, 0)
    expect(next.hp).toBe(20)
    expect(next.room.filter(Boolean).map(c => c.id)).toEqual(['S4', 'S7'])
  })

  it('a Torch with nothing to burn simply gutters out', () => {
    const s = descentState({
      room: roomOf({ suit: 'T', rank: 0, id: 'torch', inscribed: 'torch' }, ...filler()),
    })
    expect(playCard(s, 0).log.join(' ')).toContain('nothing in the room will catch')
  })

  it('a Map snapshots the top of the deck without spending it', () => {
    const deck = [spade(2), spade(3), spade(4), spade(5), spade(6)]
    const s = descentState({
      deck, room: roomOf({ suit: 'T', rank: 0, id: 'map', inscribed: 'map' }, ...filler()),
    })
    const next = playCard(s, 0)
    expect(next.mapPeek.map(c => c.id)).toEqual(['S2', 'S3', 'S4', 'S5'])
    expect(next.deck).toHaveLength(5)
  })

  it('a Skeleton Key scatters the rest of the room back into the deck', () => {
    const s = descentState({
      deck: [spade(2), spade(3), spade(4), spade(5)],
      kit: [{ suit: 'T', rank: 0, id: 'key', inscribed: 'skeleton_key' }],
      room: roomOf({ suit: 'T', rank: 0, id: 'key', inscribed: 'skeleton_key' }, spade(13), club(12), spade(11)),
    })
    const next = playCard(s, 0)
    // The three threats went to the bottom of the deck, then the room refilled
    // from the top, so none of them are in the new room.
    expect(next.room.filter(Boolean).map(c => c.id)).toEqual(['S2', 'S3', 'S4', 'S5'])
    expect(next.deck.map(c => c.id)).toEqual(['S13', 'C12', 'S11'])
    // Consumed from the kit, so it cannot reappear next descent.
    expect(next.kit).toHaveLength(0)
  })

  it('a Wound clears out of the room at no cost', () => {
    const s = descentState({ room: roomOf({ suit: WOUND, rank: 0, id: 'w1' }, ...filler()) })
    const next = playCard(s, 0)
    expect(next.hp).toBe(20)
    expect(next.room[0]).toBeNull()
    expect(next.discard.map(c => c.id)).toEqual(['w1'])
  })
})

describe('playCard guards', () => {
  it('is a no-op outside the descent phase', () => {
    const s = descentState({ phase: 'sanctuary', room: roomOf(spade(5), ...filler()) })
    expect(playCard(s, 0)).toBe(s)
  })

  it('is a no-op on an empty slot', () => {
    const s = descentState({ room: [spade(5), null, potionCard(3), potionCard(4)] })
    expect(playCard(s, 1)).toBe(s)
  })

  it('refuses a bare-handed swing at anything that is not a monster', () => {
    const s = descentState({ room: roomOf(potionCard(5), ...filler()) })
    expect(playCardBare(s, 0)).toBe(s)
  })
})

describe('checkRefillAndComplete', () => {
  it('refills to room size once a single card is left', () => {
    const s = descentState({
      deck: [spade(2), spade(3), spade(4), spade(5)],
      room: roomOf(potionCard(9), null, null, null),
    })
    const next = checkRefillAndComplete(s)
    expect(next.room.filter(Boolean)).toHaveLength(4)
    expect(next.deck).toHaveLength(1)
  })

  it('keeps the leftover card in its own slot', () => {
    const s = descentState({
      deck: [spade(2), spade(3), spade(4)],
      room: [null, null, potionCard(9), null],
    })
    expect(checkRefillAndComplete(s).room[2].id).toBe('H9')
  })

  it('resets the per-room counters on refill', () => {
    const s = descentState({
      deck: [spade(2), spade(3), spade(4)],
      room: roomOf(potionCard(9), null, null, null),
      potionsUsedThisRoom: 1,
      monstersFoughtThisRoom: 3,
      cloakArmed: true,
    })
    const next = checkRefillAndComplete(s)
    expect(next.potionsUsedThisRoom).toBe(0)
    expect(next.monstersFoughtThisRoom).toBe(0)
    expect(next.cloakArmed).toBe(false)
    expect(next.roomsEntered).toBe(1)
  })

  it('Temperance heals 3 for clearing a room with no potion drunk', () => {
    const base = {
      hp: 10,
      deck: [spade(2), spade(3), spade(4)],
      room: roomOf(potionCard(9), null, null, null),
      boons: ['temperance'],
    }
    expect(checkRefillAndComplete(descentState(base)).hp).toBe(13)
    expect(checkRefillAndComplete(descentState({ ...base, potionsUsedThisRoom: 1 })).hp).toBe(10)
  })

  it('ends the descent in victory when the deck and room are both empty', () => {
    const s = descentState({ deck: [], room: [null, null, null, null] })
    expect(checkRefillAndComplete(s).phase).toBe('sanctuary')
  })

  it('leaves a room with two or more cards alone', () => {
    const s = descentState({ deck: [spade(2)], room: roomOf(spade(3), spade(4), null, null) })
    expect(checkRefillAndComplete(s)).toBe(s)
  })
})
