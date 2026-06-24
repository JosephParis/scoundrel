import {
  SUIT_GLYPH, isMonster, isWeapon, isPotion, isWound, isSkeletonKey, isMap, isWhetstone, rankLabel,
  WOUND_DAMAGE_THRESHOLD, WOUND_CAP_PER_DESCENT, makeWoundCard,
  MAP_PEEK_COUNT,
} from '../constants'
import { BOONS } from '../boons'
import { isEnabled as isFlagEnabled } from '../flags'
import { isBoss, makeBroodSpawn, getBoss, BOSSES } from '../bosses'
import {
  appendLog, fmt,
  activeThemes, themesFor, themeFieldSum, themeFlagAny, getRoomSize,
  effectiveMonsterRank,
  activeBoons, hasBoon, maxBoonField,
  computePotionsPerRoomLimit, effectiveWeaponRank, bonusVsSuitFor,
  markTutorialLesson,
} from './helpers'
import { endDescentDeath, endDescentVictory } from './lifecycle'

// -- HP loss / death checks --------------------------------------------

// Apply pre-mitigated HP damage, honoring Twin Souls and Second Wind.
// Used by combat, Tithe, and Apothecary's sour second potion.
// `cause` describes the killing blow (source/card/weapon) for death analytics;
// it is only read if this hit is lethal. Returns { state, dead }. If dead,
// state is already in gameover phase.
export function applyHpLoss(state, amount, cause = null) {
  const hpBefore = state.hp
  let next = { ...state }
  // Numb soaks the first chunk of incoming damage each room (any source).
  if (hasBoon(state, 'numb') && (state.numbRemaining || 0) > 0 && amount > 0) {
    const absorbed = Math.min(state.numbRemaining, amount)
    amount = amount - absorbed
    next = appendLog(
      { ...next, numbRemaining: state.numbRemaining - absorbed },
      `Numb absorbs ${absorbed}. The hurt slides off.`
    )
  }
  next = { ...next, hp: next.hp - amount }

  // Wound card: a heavy hit (post-mitigation) bleeds a Wound into the deck.
  // Capped per descent so a bad streak does not choke the entire late game.
  // Skipped under the 'wounds' flag being off, during the tutorial (curated
  // flow), and on the killing blow that goes into gameover; Twin Souls
  // saves still get the wound since the player remains in the descent.
  if (
    isFlagEnabled('wounds') &&
    !state.tutorial &&
    amount >= WOUND_DAMAGE_THRESHOLD &&
    (next.hp > 0 || hasBoon(next, 'twin_souls'))
  ) {
    const woundsAdded = state.woundsAddedThisDescent || 0
    if (woundsAdded < WOUND_CAP_PER_DESCENT) {
      const wound = makeWoundCard()
      next = appendLog(
        { ...next, deck: [...next.deck, wound], woundsAddedThisDescent: woundsAdded + 1 },
        'A wound bleeds into the deck.'
      )
    }
  }

  if (next.hp <= 0 && hasBoon(next, 'twin_souls') && !next.twinSoulsUsed) {
    next = appendLog({ ...next, hp: 1, twinSoulsUsed: true },
      'Twin Souls: the second self steadies the body. You stand at 1 HP.')
  }
  if (next.hp <= 0) {
    const death = { ...(cause || {}), damage: amount, hpBefore }
    return { state: endDescentDeath({ ...next, hp: 0 }, death), dead: true }
  }
  if (next.hp > 0 && next.hp <= 3 && hasBoon(next, 'second_wind') && !next.secondWindUsed) {
    next = appendLog({ ...next, hp: Math.min(next.maxHp, 6), secondWindUsed: true },
      'Second Wind catches you. Breath returns, HP steadies at 6.')
  }
  return { state: next, dead: false }
}

// -- Weapon usability --------------------------------------------------

// Cracked Blade lifts the binding cap. The weapon swings at any monster,
// but shatters if it kills above its previous high (handled in
// applyMonsterFight). Without that theme, the usual lastSlain rule applies.
function isWeaponBoundFor(state, weapon, monsterCard) {
  if (!weapon) return false
  if (!weapon.lastSlain) return true
  if (themeFlagAny(activeThemes(state), 'crackedBlade')) return true
  return monsterCard.rank <= weapon.lastSlain.rank
}

// Pick the best weapon for swinging at this monster.
// Prefers the highest *effective* rank among usable weapons.
export function pickBestWeaponFor(state, monsterCard) {
  // Armored monsters ignore the weapon entirely: the fight resolves
  // bare-handed and the blade's binding stays clean.
  if (monsterCard.armored) return null
  const candidates = []
  if (state.weapon && isWeaponBoundFor(state, state.weapon, monsterCard)) {
    candidates.push({ weapon: state.weapon, slot: 'primary' })
  }
  if (state.spareWeapon && isWeaponBoundFor(state, state.spareWeapon, monsterCard)) {
    candidates.push({ weapon: state.spareWeapon, slot: 'spare' })
  }
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) => {
    const a = effectiveWeaponRank(state, best.weapon)
    const b = effectiveWeaponRank(state, cur.weapon)
    return b > a ? cur : best
  })
}

export function isWeaponUsable(state, monsterCard) {
  return !!pickBestWeaponFor(state, monsterCard)
}

// -- Room entry effects -------------------------------------------------

// Apply Tithe (HP loss), Oath (face-down first new card), Echo (extra
// duplicate slot), Mimic (copyRoomOnEnter bosses re-stamp the room), and
// increment roomsEntered. Called once per time a new room is presented to
// the player: initial descend, refill, or a flee.
export function applyRoomEntryEffects(state, room, firstNewIdx) {
  const themes = activeThemes(state)
  const roomsEntered = (state.roomsEntered || 0) + 1
  // Run-level tally (persists across descents) for the run-history record.
  const runRoomsEntered = (state.runRoomsEntered || 0) + 1
  let next = { ...state, roomsEntered, runRoomsEntered }
  // Refresh Numb's per-room shield before any room-entry damage (Tithe).
  if (hasBoon(next, 'numb')) {
    next = { ...next, numbRemaining: 2 }
  }
  let nextRoom = room.slice()

  // Oath: mark the first newly-drawn card face-down.
  if (themeFlagAny(themes, 'oath') && firstNewIdx != null && nextRoom[firstNewIdx]) {
    nextRoom[firstNewIdx] = { ...nextRoom[firstNewIdx], faceDown: true }
  }

  // Echo: every Nth room, every monster in the room is duplicated and slid
  // to the bottom of the deck. The dead come back round.
  for (const t of themes) {
    if (!t.echo) continue
    if (roomsEntered % t.echo !== 0) continue
    const monsters = nextRoom.filter(c => c && isMonster(c))
    if (monsters.length === 0) continue
    const dups = monsters.map(m => ({
      ...m,
      id: `${m.id}_echo${roomsEntered}`,
      faceDown: false,
    }))
    next = { ...next, deck: next.deck.concat(dups) }
    next = appendLog(next,
      `Echo: ${monsters.map(fmt).join(', ')} ${monsters.length === 1 ? 'echoes' : 'echo'} to the bottom of the deck.`)
  }

  // The Mimic (or any boss with copyRoomOnEnter): replace every other slot
  // with a plain monster of the boss's suit/rank. Face-down stays sticky so
  // Oath's marker survives. Runs after Echo so the echoed copies are the
  // pre-mimic originals, not a deck flood of identical clones.
  const mimic = nextRoom.find(c => c && c.boss && BOSSES[c.boss]?.copyRoomOnEnter)
  if (mimic) {
    nextRoom = nextRoom.map(c => {
      if (!c || c.id === mimic.id) return c
      return {
        suit: mimic.suit,
        rank: mimic.rank,
        id: `${c.id}_mimic_${mimic.id}`,
        ...(c.faceDown ? { faceDown: true } : null),
      }
    })
    next = appendLog(next, `${getBoss(mimic.boss).name} shifts. The room takes its shape.`)
  }

  // Tithe: lose HP per room entered. Can kill (honors Twin Souls / Second Wind).
  const titheLoss = themeFieldSum(themes, 'tithe')
  if (titheLoss > 0) {
    next = appendLog(next, `Tithe: the hall takes ${titheLoss} HP at the threshold.`)
    const result = applyHpLoss(next, titheLoss, { source: 'tithe' })
    return { state: result.state, room: nextRoom, dead: result.dead }
  }

  return { state: next, room: nextRoom, dead: false }
}

// -- Combat -------------------------------------------------------------

// Returns the damage the player takes from this monster, given the chosen
// weapon (or null for bare-handed). Applies theme rank bonuses, Vanguard,
// Vendetta/Hunter and Riposte in that order.
function getMonsterDamage(state, monsterCard, weaponUsed) {
  const effRank = effectiveMonsterRank(state, monsterCard)

  let dmg
  if (weaponUsed) {
    let weapRank = effectiveWeaponRank(state, weaponUsed)
    // The Hollow One halves whatever rank your weapon would have brought
    // to the fight. Bare hands hit at full effective rank.
    if (monsterCard.boss === 'hollow_one') weapRank = Math.floor(weapRank / 2)
    dmg = Math.max(0, effRank - weapRank)
  } else {
    dmg = effRank
    const brawler = maxBoonField(activeBoons(state), 'brawlerReduction', 0)
    if (brawler > 0) dmg = Math.max(0, dmg - brawler)
  }
  if (state.monstersFoughtThisRoom === 0) {
    const reduction = maxBoonField(activeBoons(state), 'vanguardReduction', 0)
    dmg = Math.max(0, dmg - reduction)
    if (weaponUsed && hasBoon(state, 'cowards_reward') && (state.cowardsRewardCharge || 0) > 0) {
      dmg = Math.max(0, dmg - state.cowardsRewardCharge)
    }
  }
  const suitBonus = bonusVsSuitFor(state, monsterCard)
  if (suitBonus) dmg = Math.max(0, dmg - suitBonus.amount)
  if (state.riposteCharge > 0) dmg = Math.max(0, dmg - state.riposteCharge)
  return dmg
}

function applyMonsterFight(state, monsterCard, index, useWeapon) {
  const chosen = useWeapon ? pickBestWeaponFor(state, monsterCard) : null
  const weaponUsed = chosen?.weapon || null
  const damage = getMonsterDamage(state, monsterCard, weaponUsed)
  const wasFirstFight = state.monstersFoughtThisRoom === 0
  const consumedCowardsCharge = wasFirstFight ? (state.cowardsRewardCharge || 0) : 0
  const room = state.room.slice()
  room[index] = null

  const themes = activeThemes(state)

  // Track the effective rank of the last three kills (Devourer feeds on
  // this). Use effective rank, not card.rank, so themes / face-card asc.
  // bonuses also count toward the chain.
  const killedRank = effectiveMonsterRank(state, monsterCard)
  const newLastKills = [...(state.lastKilledMonsterRanks || []), killedRank].slice(-3)

  // Run-level history tallies (persist across descents). bossesDefeated is
  // deduped by id so the Brood's repeated splits count as one boss.
  const bossesDefeated = monsterCard.boss && !(state.bossesDefeated || []).some(b => b.id === monsterCard.boss)
    ? [...(state.bossesDefeated || []), { id: monsterCard.boss, name: getBoss(monsterCard.boss)?.name || monsterCard.boss }]
    : (state.bossesDefeated || [])

  let next = {
    ...state,
    room,
    discard: state.discard.concat(monsterCard),
    monstersFoughtThisRoom: state.monstersFoughtThisRoom + 1,
    monstersSlain: (state.monstersSlain || 0) + 1,
    biggestKill: Math.max(state.biggestKill || 0, monsterCard.rank),
    bossesDefeated,
    lastMonsterSuit: monsterCard.suit,
    lastKilledMonsterRanks: newLastKills,
    riposteCharge: 0,
    // Coward's Reward charge is spent on the first fight of a room, weapon
    // or no. You only get one "opening" per room.
    cowardsRewardCharge: wasFirstFight ? 0 : (state.cowardsRewardCharge || 0),
  }

  // Weapon update: under Cracked Blade, slaying above the weapon's own
  // rank shatters it; otherwise lastSlain advances normally.
  // Crushing Blow: if the kill cost you no HP (weapon, Hunter, Vanguard,
  // Riposte, whatever brought it to 0), the binding is untouched.
  let weaponShattered = false
  if (chosen) {
    const shatters = themeFlagAny(themes, 'crackedBlade') && monsterCard.rank > weaponUsed.rank
    if (shatters) {
      weaponShattered = true
      if (chosen.slot === 'primary') next.weapon = null
      else next.spareWeapon = null
    } else {
      const crushed = hasBoon(state, 'crushing_blow') && damage === 0
      if (!crushed) {
        const updated = { ...weaponUsed, lastSlain: { rank: monsterCard.rank } }
        if (chosen.slot === 'primary') next.weapon = updated
        else next.spareWeapon = updated
      }
    }
  } else if (hasBoon(state, 'executioner')) {
    // Bare-handed kills raise the equipped weapon's ceiling. Even slay
    // a K with your fists to free the blade for everything below.
    const lift = (w) => {
      if (!w) return w
      const prior = w.lastSlain?.rank ?? 0
      if (monsterCard.rank <= prior) return w
      return { ...w, lastSlain: { rank: monsterCard.rank } }
    }
    next.weapon = lift(next.weapon)
    next.spareWeapon = lift(next.spareWeapon)
  }

  // Carrion: slain monsters return once at rank 2 of their suit. Skip if
  // this card is itself a carrion revenant. One return per original.
  if (themeFlagAny(themes, 'carrion') && !monsterCard.carrioned) {
    const revenant = {
      suit: monsterCard.suit,
      rank: 2,
      id: `${monsterCard.id}_carrion`,
      carrioned: true,
    }
    const deck = next.deck.slice()
    const insertAt = deck.length === 0 ? 0 : Math.floor(state.rng() * (deck.length + 1))
    deck.splice(insertAt, 0, revenant)
    next = { ...next, deck }
    next = appendLog(next, `Carrion: ${fmt(monsterCard)} stirs again in the deck as ${fmt(revenant)}.`)
  }

  // The Brood: each kill spawns the next-step child into the deck at a
  // random position, so the player keeps drawing it back. Chain bottoms
  // out at rank 2 and stops spawning.
  if (monsterCard.boss === 'the_brood') {
    const spawn = makeBroodSpawn(monsterCard.id, monsterCard.broodStep || 0)
    if (spawn) {
      const deck = next.deck.slice()
      const insertAt = deck.length === 0 ? 0 : Math.floor(state.rng() * (deck.length + 1))
      deck.splice(insertAt, 0, spawn)
      next = { ...next, deck }
      next = appendLog(next, `The Brood splits. A smaller form (${rankLabel(spawn.rank)}${SUIT_GLYPH[spawn.suit]}) slips back into the deck.`)
    } else {
      next = appendLog(next, 'The Brood is silent. No more split.')
    }
  }

  const glyph = SUIT_GLYPH[monsterCard.suit]
  const how = weaponUsed
    ? `with the ${rankLabel(weaponUsed.rank)}♦`
    : 'bare-handed'
  // Use effective rank in the log so the Devourer reads at its scaled
  // value, not the base 3. Plain monsters land on their printed rank.
  const logRank = effectiveMonsterRank(state, monsterCard)
  next = appendLog(next, `Fought ${rankLabel(logRank)}${glyph} ${how}, took ${damage}.`)

  if (consumedCowardsCharge > 0 && weaponUsed) {
    next = appendLog(next, `Coward's Reward: the opening swing landed +${consumedCowardsCharge}.`)
  }

  if (weaponShattered) {
    next = appendLog(next, 'The blade shatters under the strain. Cracked Blade claims it.')
  }

  // Riposte: bank half this fight's actual damage (rounded down).
  if (hasBoon(next, 'riposte') && damage > 0) {
    const charge = Math.floor(damage / 2)
    if (charge > 0) {
      next.riposteCharge = charge
      next = appendLog(next, `Riposte holds: the next monster deals ${charge} less.`)
    }
  }

  // Killing-blow detail for death analytics, shared by the main hit and the
  // fast monster's second strike.
  const monsterCause = {
    source: monsterCard.boss ? 'boss' : 'monster',
    card: {
      suit: monsterCard.suit,
      rank: monsterCard.rank,
      effRank: effectiveMonsterRank(state, monsterCard),
      boss: monsterCard.boss || null,
    },
    barehanded: !weaponUsed,
    weaponRank: weaponUsed ? weaponUsed.rank : null,
  }

  const dmgResult = applyHpLoss(next, damage, monsterCause)
  if (dmgResult.dead) return dmgResult.state
  next = dmgResult.state

  // Fast monsters strike a second time. Each hit is a real applyHpLoss so
  // Numb, wound-bleed, and death all evaluate per hit.
  if (monsterCard.fast) {
    const second = applyHpLoss(next, damage, monsterCause)
    if (second.dead) return second.state
    next = appendLog(second.state, `${fmt(monsterCard)} strikes twice.`)
  }

  // Cursed Idol gift: a prior idol play left a pending heal that applies
  // on the next real monster kill. Drains and clears here, capped at maxHp.
  if ((next.pendingCursedHeal || 0) > 0) {
    const heal = Math.min(next.maxHp - next.hp, next.pendingCursedHeal)
    if (heal > 0) {
      next = appendLog(
        { ...next, hp: next.hp + heal, pendingCursedHeal: 0 },
        `Cursed Idol's gift: heal ${heal} HP.`
      )
    } else {
      next = { ...next, pendingCursedHeal: 0 }
    }
  }

  if (weaponUsed) {
    next = markTutorialLesson(next, 'fight')
  } else {
    // First bare-hand teaches the mechanic (weapon locked, eat full rank).
    // The second teaches the choice: even with alternatives in the room,
    // bare hands can be the right trade.
    const hasBareLesson = (next.tutorialLessons || []).includes('barehands')
    next = markTutorialLesson(next, hasBareLesson ? 'barehands_choice' : 'barehands')
  }

  return checkRefillAndComplete(next)
}

// Cursed Idol: an inscribed spade that bypasses the weapon-vs-monster dance.
// Always inflicts its rank in damage (Numb still soaks, since applyHpLoss is
// the death gate), then arms pendingCursedHeal so the next real monster kill
// heals the same amount back.
function playCursedIdol(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  let next = appendLog(
    { ...state, room, discard: state.discard.concat(card) },
    `Cursed Idol bites for ${card.rank}. Its bargain waits.`
  )
  const result = applyHpLoss(next, card.rank, {
    source: 'cursed_idol',
    card: { suit: card.suit, rank: card.rank },
  })
  if (result.dead) return result.state
  next = { ...result.state, pendingCursedHeal: card.rank }
  return checkRefillAndComplete(next)
}

// -- Card plays ---------------------------------------------------------

function playPotion(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  const limit = computePotionsPerRoomLimit(activeBoons(state))
  const themes = activeThemes(state)
  const apothecary = themeFlagAny(themes, 'secondPotionDamages')
  const bitterBrew = themeFlagAny(themes, 'potionHealHalf')
  const playedNow = state.potionsUsedThisRoom

  // Stoic: hearts pass straight to the discard, no heal, no apothecary bite,
  // no alchemist dregs. The +10 max HP is the entire compensation.
  if (hasBoon(state, 'stoic')) {
    const next = appendLog(
      { ...state, room, discard: state.discard.concat(card) },
      `Set aside ${fmt(card)}. Stoic. No draught passes your lips.`
    )
    return checkRefillAndComplete(next)
  }

  let next = {
    ...state,
    room,
    discard: state.discard.concat(card),
    potionsUsedThisRoom: state.potionsUsedThisRoom + 1,
  }

  // Apothecary: any potion after the first damages instead of healing.
  if (apothecary && playedNow >= 1) {
    const damage = card.rank
    next = appendLog(next, `Sour draught: ${fmt(card)} bites back for ${damage}.`)
    const result = applyHpLoss(next, damage, {
      source: 'apothecary_potion',
      card: { suit: card.suit, rank: card.rank },
    })
    if (result.dead) return result.state
    return checkRefillAndComplete(result.state)
  }

  // Normal heal path: first potion always, plus extras up to Sip's limit.
  if (playedNow < limit) {
    const healAmount = bitterBrew ? Math.floor(card.rank / 2) : card.rank
    const healed = Math.min(next.maxHp, next.hp + healAmount) - next.hp
    next.hp = next.hp + healed
    const note = bitterBrew ? 'bitter, ' : ''
    next = appendLog(next, `Drank ${fmt(card)}, ${note}restored ${healed} HP.`)
    next = markTutorialLesson(next, 'potion')
  } else {
    // Overflow path: Alchemist and Field Surgeon stack, each adds its bit.
    const alchAmt = hasBoon(next, 'alchemist') ? Math.ceil(card.rank / 2) : 0
    const surgAmt = hasBoon(next, 'field_surgeon') ? 1 : 0
    const totalHeal = alchAmt + surgAmt
    if (totalHeal > 0) {
      const healed = Math.min(next.maxHp, next.hp + totalHeal) - next.hp
      next.hp = next.hp + healed
      const reasons = []
      if (alchAmt) reasons.push('Alchemist')
      if (surgAmt) reasons.push('Field Surgeon')
      next = appendLog(next, `Overflow ${fmt(card)}: ${reasons.join(' and ')} drew ${healed} HP from the dregs.`)
    } else {
      next = appendLog(next, `Potion ${fmt(card)} wasted. No thirst left.`)
    }
  }

  // Lucky Coin: after the heal, refill the slot the coin just left with a
  // fresh draw from the deck. Effectively a free extra card for the room.
  if (card.inscribed === 'lucky_coin' && next.deck.length > 0) {
    const drawn = next.deck[0]
    const newDeck = next.deck.slice(1)
    const newRoom = next.room.slice()
    newRoom[index] = drawn
    next = appendLog(
      { ...next, deck: newDeck, room: newRoom },
      `Lucky Coin draws ${fmt(drawn)} into the empty slot.`
    )
  }

  return checkRefillAndComplete(next)
}

function playWeapon(state, index, card) {
  const room = state.room.slice()
  room[index] = null

  const themes = activeThemes(state)
  const rusty = themeFieldSum(themes, 'weaponRankModifier')
  const effectiveRank = Math.max(2, card.rank + rusty)

  const newWeapon = { rank: effectiveRank, originalRank: card.rank, lastSlain: null }

  let nextWeapon, nextSpare, swapNote
  if (hasBoon(state, 'quartermaster')) {
    if (!state.weapon) {
      nextWeapon = newWeapon
      nextSpare = state.spareWeapon
      swapNote = ''
    } else {
      // Push current primary to spare; discard whatever the old spare was.
      nextWeapon = newWeapon
      nextSpare = state.weapon
      swapNote = state.spareWeapon
        ? ` (slung the old ${rankLabel(state.weapon.rank)}♦ to your back; the spent ${rankLabel(state.spareWeapon.rank)}♦ left on the stone)`
        : ` (slung the old ${rankLabel(state.weapon.rank)}♦ to your back)`
    }
  } else {
    nextWeapon = newWeapon
    nextSpare = null
    swapNote = ''
  }

  const wasArmed = !!state.weapon
  let next = {
    ...state,
    room,
    discard: state.discard.concat(card),
    weapon: nextWeapon,
    spareWeapon: nextSpare,
  }
  const rustNote = rusty < 0
    ? ` (rusty, bites as a ${rankLabel(effectiveRank)})`
    : ''
  next = appendLog(next, `Took up the ${rankLabel(card.rank)}♦${rustNote}${swapNote}.`)
  next = markTutorialLesson(next, wasArmed ? 'replace' : 'equip')

  return checkRefillAndComplete(next)
}

function playMonster(state, index, card) {
  return applyMonsterFight(state, card, index, isWeaponUsable(state, card))
}

export function playCard(state, index) {
  if (state.phase !== 'descent') return state
  const card = state.room[index]
  if (!card) return state
  // Inscribed cards with custom handlers intercept before their natural
  // suit's handler. Lucky Coin still flows through playPotion (heart) and
  // is special-cased inside it; Cursed Idol and Potion of Strength divert
  // away from their natural-suit handlers entirely.
  if (card.inscribed === 'cursed_idol') return playCursedIdol(state, index, card)
  if (card.inscribed === 'potion_of_strength') return playPotionOfStrength(state, index, card)
  if (isSkeletonKey(card)) return playSkeletonKey(state, index, card)
  if (isMap(card)) return playMap(state, index, card)
  if (isWhetstone(card)) return playWhetstone(state, index, card)
  if (isPotion(card)) return playPotion(state, index, card)
  if (isWeapon(card)) return playWeapon(state, index, card)
  if (isMonster(card)) return playMonster(state, index, card)
  if (isWound(card)) return playWound(state, index, card)
  return state
}

// Skeleton Key: discards every other card in the room (back to the bottom
// of the deck so they aren't lost from the run), clears the slot, then lets
// checkRefillAndComplete pull a fresh room. The descent shape stays the
// same; the player just skips this room's threats. Consumed from the kit on
// play so it cannot reappear in future descents.
function playSkeletonKey(state, index, card) {
  const otherCards = state.room
    .map((c, i) => (i !== index && c) ? c : null)
    .filter(Boolean)
    .map(c => {
      // Strip the Oath face-down flag so cards don't return permanently hidden.
      if (!c.faceDown) return c
      const { faceDown, ...rest } = c
      return rest
    })
  const newRoom = state.room.map(() => null)
  const newDeck = state.deck.concat(otherCards)
  const kit = (state.kit || []).filter(c => c.id !== card.id)
  let next = appendLog(
    {
      ...state,
      deck: newDeck,
      room: newRoom,
      discard: state.discard.concat(card),
      kit,
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
    },
    `Skeleton Key turns. The room scatters back into the dark.`
  )
  return checkRefillAndComplete(next)
}

// Map: snapshots the top N cards of the deck onto state.mapPeek so the UI
// can show them in a modal. The map itself goes to the discard and the
// slot empties; the snapshot persists until the player dismisses the
// modal (dismissMapPeek in sanctuary.js). If the deck is empty the map
// still resolves cleanly (mapPeek = []), so the player isn't stuck.
function playMap(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  const peek = state.deck.slice(0, MAP_PEEK_COUNT)
  const next = appendLog(
    {
      ...state,
      room,
      discard: state.discard.concat(card),
      mapPeek: peek,
    },
    peek.length > 0
      ? `The Map unfolds. Top ${peek.length} card${peek.length === 1 ? '' : 's'} revealed.`
      : 'The Map unfolds, but the deck is bare.'
  )
  return checkRefillAndComplete(next)
}

// Whetstone: a single-use tool that clears lastSlain on both the primary
// and spare weapon. The binding is gone, so a worn 5♦ can swing at K's
// again until its next kill. Resolves cleanly even if you have no weapon
// equipped (just discards), so the play is never blocked.
function playWhetstone(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  const hone = (w) => (w && w.lastSlain ? { ...w, lastSlain: null } : w)
  const honedPrimary = hone(state.weapon)
  const honedSpare = hone(state.spareWeapon)
  const honed = honedPrimary !== state.weapon || honedSpare !== state.spareWeapon
  const next = appendLog(
    {
      ...state,
      room,
      discard: state.discard.concat(card),
      weapon: honedPrimary,
      spareWeapon: honedSpare,
    },
    honed
      ? 'The whetstone bites. The binding rests; any blade swings fresh again.'
      : 'The whetstone slides over nothing. No edge to hone.'
  )
  return checkRefillAndComplete(next)
}

// Potion of Strength: a heart that doesn't heal and doesn't count as a
// potion. Banks its rank as a persistent weapon-strength bonus for the
// rest of the descent (state.strengthBonus, read by effectiveWeaponRank).
// The bonus rides whichever weapon you equip later if you don't have one
// yet, so the play is never wasted.
function playPotionOfStrength(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  const next = appendLog(
    {
      ...state,
      room,
      discard: state.discard.concat(card),
      strengthBonus: (state.strengthBonus || 0) + card.rank,
    },
    `Potion of Strength: weapon strikes harder by ${card.rank}.`
  )
  return checkRefillAndComplete(next)
}

// Clicking a Wound just clears it from the room. No HP cost, no weapon
// binding, no monster fight side-effects. The slot empties and the room
// refills like any other card play.
function playWound(state, index, card) {
  let next = { ...state }
  const newRoom = next.room.slice()
  newRoom[index] = null
  next = {
    ...next,
    room: newRoom,
    discard: [...next.discard, card],
  }
  next = appendLog(next, 'You bind the wound and move on.')
  return checkRefillAndComplete(next)
}

export function playCardBare(state, index) {
  if (state.phase !== 'descent') return state
  const card = state.room[index]
  if (!card || !isMonster(card)) return state
  // Iron Bones forbids bare-handed fights while a usable weapon is equipped.
  if (themeFlagAny(activeThemes(state), 'ironBones') && isWeaponUsable(state, card)) {
    return state
  }
  return applyMonsterFight(state, card, index, false)
}

// -- Room refill / descent completion ----------------------------------

export function checkRefillAndComplete(state) {
  const remaining = state.room.filter(Boolean)

  if (state.deck.length === 0 && remaining.length === 0) {
    return endDescentVictory(state)
  }

  if (remaining.length === 1) {
    const themes = activeThemes(state)
    const targetSize = getRoomSize(themes)

    // Rebuild a fixed-size room: place the leftover (in its old slot if it
    // still fits, else slot 0), then fill the rest from the deck.
    const leftover = state.room.find(Boolean)
    const leftoverIdx = state.room.findIndex(c => c && c.id === leftover.id)
    const slot = leftoverIdx < targetSize ? leftoverIdx : 0

    const newRoom = new Array(targetSize).fill(null)
    newRoom[slot] = leftover

    const deck = state.deck.slice()
    let firstNewIdx = null
    for (let i = 0; i < newRoom.length; i++) {
      if (newRoom[i] === null && deck.length > 0) {
        newRoom[i] = deck.shift()
        if (firstNewIdx === null) firstNewIdx = i
      }
    }

    const next = {
      ...state,
      deck,
      room: newRoom,
      potionsUsedThisRoom: 0,
      canFlee: !themeFlagAny(themes, 'cannotFlee'),
      monstersFoughtThisRoom: 0,
    }

    const entry = applyRoomEntryEffects(next, next.room, firstNewIdx)
    if (entry.dead) return entry.state
    return { ...entry.state, room: entry.room }
  }

  return state
}

