import {
  SUIT_GLYPH, BASE_MAX_HP, isMonster, isWeapon, isPotion, rankLabel, suitColor,
  INSCRIBED_FRAMES, INSCRIBED_FRAME_IDS, makeInscribedCard,
} from '../constants'
import { BOONS } from '../boons'
import { getAscensionEffectsForState } from '../ascensions'
import { BOSSES } from '../bosses'
import {
  appendLog,
  activeThemes, themeFlagAny,
  activeBoons, hasBoon, minMaxHpOverride,
  bonusVsSuitFor,
  computePotionsPerRoomLimit,
  sumParts,
} from './helpers'
import { computeCurrentDeck } from './deck'
import { isWeaponUsable, pickBestWeaponFor } from './combat'

// -- Sanctuary actions -------------------------------------------------

export function pickBoon(state, boonId) {
  if (state.phase !== 'sanctuary') return state
  if (state.boonChosen) return state
  if (!state.boonOffers.includes(boonId)) return state
  return appendLog(
    {
      ...state,
      boons: state.boons.concat(boonId),
      boonChosen: true,
      boonOffers: [],
    },
    `Took the ${BOONS[boonId]?.name}.`
  )
}

export function openForgeAction(state, action) {
  if (state.phase !== 'sanctuary') return state
  if (!state.forgeOpen || state.forgeUsed) return state
  return { ...state, forgeView: action }
}

export function closeForgeView(state) {
  return { ...state, forgeView: null }
}

// Skip the forge for this visit without applying any edit. Marks the
// forge as used so the sequencing in the UI knows the player is done
// with this stage.
export function skipForge(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  return {
    ...state,
    forgeUsed: true,
    forgeView: null,
    log: [...state.log, 'You step away from the forge.'],
  }
}

// Strike's offering may match the monster's rank or fall up to this many
// ranks below it. A lighter blade can still balance the carving, within
// reason. K and A monsters are effectively immune since no offering reaches
// their weight (rank ≤ 10 cap on hearts and diamonds).
export const STRIKE_OFFERING_RANGE = 2

export function applyStrike(state, monsterId, offeringId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const monster = current.find(c => c.id === monsterId)
  const offering = current.find(c => c.id === offeringId)
  if (!monster || !offering) return state
  if (!isMonster(monster)) return state
  if (!(isWeapon(offering) || isPotion(offering))) return state
  const diff = monster.rank - offering.rank
  if (diff < 0 || diff > STRIKE_OFFERING_RANGE) return state

  const mGlyph = SUIT_GLYPH[monster.suit]
  const oGlyph = SUIT_GLYPH[offering.suit]
  return appendLog(
    {
      ...state,
      strikes: state.strikes.concat([monsterId, offeringId]),
      forgeUsed: true,
      forgeView: null,
    },
    `Carved ${rankLabel(monster.rank)}${mGlyph} into the threshold; ${rankLabel(offering.rank)}${oGlyph} offered to the kindling.`
  )
}

export function applyTransmute(state, cardId, newSuit) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const card = current.find(c => c.id === cardId)
  if (!card) return state
  if (card.suit === newSuit) return state
  // Color-locked: ♥↔♦ and ♣↔♠ only. The threshold won't accept a
  // cross-color carving (too far a reshape for the rite to hold).
  if (suitColor(card.suit) !== suitColor(newSuit)) return state

  return appendLog(
    {
      ...state,
      transmutes: { ...state.transmutes, [cardId]: newSuit },
      forgeUsed: true,
      forgeView: null,
    },
    `Transmuted ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} → ${rankLabel(card.rank)}${SUIT_GLYPH[newSuit]}.`
  )
}

export const HEFT_BONUS = 2
export const HEFT_RANK_CAP = 10

export function applyHeft(state, cardId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const card = current.find(c => c.id === cardId)
  if (!card) return state
  if (!(isWeapon(card) || isPotion(card))) return state
  if (card.rank + HEFT_BONUS > HEFT_RANK_CAP) return state
  // Stack with any prior heft on this card (still capped).
  const prior = state.hefts?.[cardId] || 0
  const next = prior + HEFT_BONUS

  return appendLog(
    {
      ...state,
      hefts: { ...(state.hefts || {}), [cardId]: next },
      forgeUsed: true,
      forgeView: null,
    },
    `Hefted ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} → ${rankLabel(card.rank + HEFT_BONUS)}${SUIT_GLYPH[card.suit]}.`
  )
}

// Inscribe: add a player-authored card to state.inscribed. The card joins
// the deck on the next descent and persists for the rest of the run.
// Frames with `oncePerRun: true` (e.g. Skeleton Key) are blocked when one
// is already in the inscribed list. Rank is clamped to the frame's range.
export function applyInscribe(state, frameId, rank) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const frame = INSCRIBED_FRAMES[frameId]
  if (!frame) return state
  const inscribed = state.inscribed || []
  if (frame.oncePerRun && inscribed.some(c => c.inscribed === frameId)) return state
  const card = makeInscribedCard(frameId, rank)
  if (!card) return state

  return appendLog(
    {
      ...state,
      inscribed: inscribed.concat(card),
      forgeUsed: true,
      forgeView: null,
    },
    `Inscribed ${frame.name}${card.rank > 0 ? ` (${rankLabel(card.rank)})` : ''} into the deck.`
  )
}

// Clear the Map peek snapshot. Called when the player closes the modal
// the Map opens. Idempotent: a no-op when mapPeek is already null.
export function dismissMapPeek(state) {
  if (!state.mapPeek) return state
  return { ...state, mapPeek: null }
}

// What frames can the player inscribe right now? Removes any frame that's
// already at its per-run cap (Skeleton Key).
export function getInscribeOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  const inscribed = state.inscribed || []
  return INSCRIBED_FRAME_IDS.map(id => INSCRIBED_FRAMES[id]).filter(frame => {
    if (frame.oncePerRun && inscribed.some(c => c.inscribed === frame.id)) return false
    return true
  })
}

// -- Convenience inspection (used by UI) -------------------------------

export function getStrikeOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return { monsters: [], byRank: {} }
  const current = computeCurrentDeck(state)
  const monsters = current.filter(c => isMonster(c))
  const byRank = {}
  for (const c of current) {
    if (isWeapon(c) || isPotion(c)) {
      if (!byRank[c.rank]) byRank[c.rank] = []
      byRank[c.rank].push(c)
    }
  }
  return { monsters, byRank }
}

export function getTransmuteOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  return computeCurrentDeck(state)
}

// Heft can target any weapon or potion whose rank, after the +2 bonus,
// still respects the lore cap (no king-grade weapons or potions).
export function getHeftOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  return computeCurrentDeck(state).filter(
    c => (isWeapon(c) || isPotion(c)) && c.rank + HEFT_BONUS <= HEFT_RANK_CAP
  )
}

export function isWeaponUsableFor(state, card) {
  return isWeaponUsable(state, card)
}

export function previewMonsterDamage(state, card) {
  if (!card || !isMonster(card)) {
    return { weapon: null, bare: { value: 0, parts: [], clamped: false }, faceDown: false }
  }
  if (card.faceDown) {
    return { weapon: null, bare: null, faceDown: true }
  }
  // Cursed Idol bypasses combat entirely: no weapon swing, no theme bonus,
  // no Vanguard/Riposte. The card always inflicts its rank straight.
  if (card.inscribed === 'cursed_idol') {
    return {
      weapon: null,
      bare: {
        value: card.rank,
        parts: [{ label: 'cursed idol', value: card.rank, op: '+' }],
        clamped: false,
      },
      faceDown: false,
    }
  }
  const bare = describeDamage(state, card, null)
  const chosen = pickBestWeaponFor(state, card)
  const weapon = chosen ? describeDamage(state, card, chosen.weapon) : null
  return { weapon, bare, faceDown: false }
}

// Returns the resolved list of active themes for this descent: the parent
// for single-theme nights, or the children of a compound theme like
// The Long Night. UI uses this to display theme expansively.
export function getActiveThemesForState(state) {
  return activeThemes(state)
}

// -- Numeric breakdown helpers (for UI transparency) -------------------
//
// Each describe* returns { value, parts } where parts is an array of
// { label, value, op }. Display layer formats as e.g. "23 (20 + 3 first run)".

export function describeMaxHp(state) {
  const boons = activeBoons(state)
  const override = minMaxHpOverride(boons)
  const baseValue = override != null ? override : BASE_MAX_HP
  const overrideBoon = override != null
    ? boons.find(id => BOONS[id]?.maxHpOverride === override)
    : null
  const baseLabel = overrideBoon ? BOONS[overrideBoon].name : 'base'

  const parts = [{ label: baseLabel, value: baseValue, op: '+' }]
  for (const id of boons) {
    const bonus = BOONS[id]?.maxHpBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  for (const t of activeThemes(state)) {
    if (!t.maxHpBonus) continue
    parts.push({
      label: t.name,
      value: Math.abs(t.maxHpBonus),
      op: t.maxHpBonus > 0 ? '+' : '-',
    })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

// Describe the strength of a specific weapon (or state.weapon by default).
export function describeWeaponStrength(state, weapon = state.weapon) {
  if (!weapon) return null
  const parts = [{ label: 'base', value: weapon.rank, op: '+' }]
  for (const id of activeBoons(state)) {
    const bonus = BOONS[id]?.weaponRankBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  if (hasBoon(state, 'wounded_lion') && state.hp < 10) {
    parts.push({ label: 'Wounded Lion', value: 2, op: '+' })
  }
  if (hasBoon(state, 'berserker') && (state.monstersFoughtThisRoom || 0) > 0) {
    parts.push({ label: 'Berserker', value: state.monstersFoughtThisRoom, op: '+' })
  }
  if ((state.strengthBonus || 0) > 0) {
    parts.push({ label: 'Strength', value: state.strengthBonus, op: '+' })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

// `weaponUsed` is the actual weapon object (or null for bare-handed).
export function describeDamage(state, card, weaponUsed) {
  const parts = []
  // Devourer's printed rank is 3, but the live rank is 3 + last 3 kills.
  // Sum the components into a single line so the breakdown is honest.
  if (card.boss === 'devourer') {
    const kills = state.lastKilledMonsterRanks || []
    const live = 3 + kills.reduce((s, r) => s + r, 0)
    parts.push({ label: 'Devourer (3 + last kills)', value: live, op: '+' })
  } else {
    parts.push({ label: 'monster', value: card.rank, op: '+' })
  }

  const themes = activeThemes(state)
  for (const t of themes) {
    const bonus = t.monsterRankBonus || 0
    if (bonus) parts.push({ label: t.name, value: Math.abs(bonus), op: bonus < 0 ? '-' : '+' })
    const suitBonus = t.monsterRankBonusBySuit?.[card.suit] || 0
    if (suitBonus) parts.push({ label: t.name, value: Math.abs(suitBonus), op: suitBonus < 0 ? '-' : '+' })
  }

  // Ascension face-card bonus (A6): J/Q/K/A monsters hit at +N effective rank.
  const ascEffects = getAscensionEffectsForState(state)
  const liveBase = card.boss === 'devourer'
    ? 3 + (state.lastKilledMonsterRanks || []).reduce((s, r) => s + r, 0)
    : card.rank
  if (ascEffects.faceCardRankBonus && liveBase >= 11) {
    parts.push({
      label: `Asc ${ascEffects.level}`,
      value: ascEffects.faceCardRankBonus,
      op: '+',
    })
  }

  // Room-aura bosses (The Warden, etc.) add a flat bonus to every other
  // monster in their room. Surface them by name so the breakdown reads true.
  for (const c of state.room || []) {
    if (!c || c.id === card.id || !c.boss) continue
    const bonus = BOSSES[c.boss]?.roomMonsterRankBonus || 0
    if (bonus) parts.push({ label: BOSSES[c.boss].name, value: bonus, op: '+' })
  }

  if (weaponUsed) {
    const ws = describeWeaponStrength(state, weaponUsed)
    if (ws) {
      // The Hollow One only lets half a weapon's swing land. Show the
      // halved value so the player sees what they actually subtract.
      const value = card.boss === 'hollow_one' ? Math.floor(ws.value / 2) : ws.value
      const label = card.boss === 'hollow_one' ? 'weapon (halved)' : 'weapon'
      parts.push({ label, value, op: '-' })
    }
  } else {
    for (const id of activeBoons(state)) {
      const reduction = BOONS[id]?.brawlerReduction || 0
      if (reduction) {
        parts.push({ label: BOONS[id].name, value: reduction, op: '-' })
        break
      }
    }
  }

  if (state.monstersFoughtThisRoom === 0) {
    for (const id of activeBoons(state)) {
      const reduction = BOONS[id]?.vanguardReduction || 0
      if (reduction) {
        parts.push({ label: BOONS[id].name, value: reduction, op: '-' })
        break
      }
    }
    if (weaponUsed && hasBoon(state, 'cowards_reward') && (state.cowardsRewardCharge || 0) > 0) {
      parts.push({ label: "Coward's Reward", value: state.cowardsRewardCharge, op: '-' })
    }
  }

  const suitBonus = bonusVsSuitFor(state, card)
  if (suitBonus) parts.push({ label: suitBonus.name, value: suitBonus.amount, op: '-' })

  if (state.riposteCharge > 0) {
    parts.push({ label: 'Riposte', value: state.riposteCharge, op: '-' })
  }

  if (hasBoon(state, 'numb') && (state.numbRemaining || 0) > 0) {
    const beforeNumb = sumParts(parts)
    if (beforeNumb > 0) {
      parts.push({
        label: 'Numb',
        value: Math.min(state.numbRemaining, beforeNumb),
        op: '-',
      })
    }
  }

  const raw = sumParts(parts)
  return { value: Math.max(0, raw), parts, clamped: raw < 0 }
}

// Describe what playing this potion now would do. Returns one of:
//   { mode: 'heal',     value, parts }
//   { mode: 'damage',   value, parts }   // Apothecary sour draught
//   { mode: 'strength', value, parts }   // Potion of Strength (inscribed)
//   { mode: 'skip',     note }            // Stoic refusal or wasted overflow
export function describePotion(state, card) {
  if (!card || !isPotion(card)) return null

  // Potion of Strength: never heals, never counts as a potion, so it
  // bypasses Stoic / Apothecary / Bitter Brew entirely. Preview is the
  // strength bump it'll add to the descent's weapon-strength bonus.
  if (card.inscribed === 'potion_of_strength') {
    return {
      mode: 'strength',
      value: card.rank,
      parts: [{ label: 'strength', value: card.rank, op: '+' }],
    }
  }

  if (hasBoon(state, 'stoic')) {
    return { mode: 'skip', note: 'Stoic, set aside' }
  }

  const themes = activeThemes(state)
  const apothecary = themeFlagAny(themes, 'secondPotionDamages')
  const bitterBrew = themeFlagAny(themes, 'potionHealHalf')
  const playedNow = state.potionsUsedThisRoom || 0
  const limit = computePotionsPerRoomLimit(activeBoons(state))

  if (apothecary && playedNow >= 1) {
    const parts = [{ label: 'sour draught', value: card.rank, op: '+' }]
    return { mode: 'damage', value: card.rank, parts }
  }

  if (playedNow < limit) {
    const parts = [{ label: 'potion', value: card.rank, op: '+' }]
    if (bitterBrew) {
      const lost = card.rank - Math.floor(card.rank / 2)
      if (lost > 0) parts.push({ label: 'Bitter Brew', value: lost, op: '-' })
    }
    return { mode: 'heal', value: Math.max(0, sumParts(parts)), parts }
  }

  const parts = []
  if (hasBoon(state, 'alchemist')) {
    parts.push({ label: 'Alchemist', value: Math.ceil(card.rank / 2), op: '+' })
  }
  if (hasBoon(state, 'field_surgeon')) {
    parts.push({ label: 'Field Surgeon', value: 1, op: '+' })
  }
  if (parts.length === 0) {
    return { mode: 'skip', note: 'No thirst left' }
  }
  return { mode: 'heal', value: Math.max(0, sumParts(parts)), parts }
}
