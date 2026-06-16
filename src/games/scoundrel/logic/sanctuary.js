import {
  SUIT_GLYPH, BASE_MAX_HP, isMonster, isWeapon, isPotion, rankLabel,
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
  if (!(state.forgeOffer || []).includes(action)) return state
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

export const UPGRADE_BONUS = 2
export const UPGRADE_RANK_CAP = 10

// Inscribe: add a card to the kit. `sel` is one of:
//   { type: 'plain', id }            a pre-rolled plain weapon/potion from
//                                    state.inscribeOffer (rank capped by progress)
//   { type: 'frame', frameId, rank } a framed special tool (Lucky Coin, etc.)
// Monster frames (Cursed Idol) are rejected: the player only builds tools.
// oncePerRun frames (Skeleton Key) are blocked if one is already in the kit.
export function applyInscribe(state, sel) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  if (!sel) return state
  const kit = state.kit || []
  let card = null
  let line = ''

  if (sel.type === 'plain') {
    const offer = state.inscribeOffer
    const pick = offer ? [offer.weapon, offer.potion].find(c => c && c.id === sel.id) : null
    if (!pick) return state
    card = { ...pick }
    line = `Added ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} to the kit.`
  } else if (sel.type === 'frame') {
    const frame = INSCRIBED_FRAMES[sel.frameId]
    if (!frame) return state
    if (isMonster({ suit: frame.suit })) return state
    if (frame.oncePerRun && kit.some(c => c.inscribed === sel.frameId)) return state
    card = makeInscribedCard(sel.frameId, sel.rank)
    if (!card) return state
    line = `Inscribed ${frame.name}${card.rank > 0 ? ` (${rankLabel(card.rank)})` : ''} into the kit.`
  } else {
    return state
  }

  return appendLog(
    {
      ...state,
      kit: [...kit, card],
      kitEdits: (state.kitEdits || 0) + 1,
      forgeUsed: true,
      forgeView: null,
    },
    line
  )
}

// Upgrade: raise a kit weapon/potion's rank by +2, capped at 10.
export function upgradeKitCard(state, cardId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const card = (state.kit || []).find(c => c.id === cardId)
  if (!card) return state
  if (!(isWeapon(card) || isPotion(card))) return state
  if (card.rank + UPGRADE_BONUS > UPGRADE_RANK_CAP) return state

  const kit = state.kit.map(c =>
    c.id === cardId
      ? { ...c, rank: c.rank + UPGRADE_BONUS, upgraded: true, upgradeBonus: (c.upgradeBonus || 0) + UPGRADE_BONUS }
      : c
  )
  return appendLog(
    {
      ...state,
      kit,
      kitEdits: (state.kitEdits || 0) + 1,
      forgeUsed: true,
      forgeView: null,
    },
    `Upgraded ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} → ${rankLabel(card.rank + UPGRADE_BONUS)}${SUIT_GLYPH[card.suit]}.`
  )
}

// Remove: drop a kit card. Thinning a dud raises the density of good tools
// against the dungeon's dilution. Won't empty the kit entirely.
export function removeKitCard(state, cardId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const card = (state.kit || []).find(c => c.id === cardId)
  if (!card) return state
  if (state.kit.length <= 1) return state

  return appendLog(
    {
      ...state,
      kit: state.kit.filter(c => c.id !== cardId),
      kitEdits: (state.kitEdits || 0) + 1,
      forgeUsed: true,
      forgeView: null,
    },
    `Removed ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} from the kit.`
  )
}

// Clear the Map peek snapshot. Called when the player closes the modal
// the Map opens. Idempotent: a no-op when mapPeek is already null.
export function dismissMapPeek(state) {
  if (!state.mapPeek) return state
  return { ...state, mapPeek: null }
}

// What special frames can the player inscribe right now? Tool/neutral frames
// only (monster frames like Cursed Idol are excluded), minus any one-per-run
// frame already present in the kit (Skeleton Key).
export function getInscribeFrameOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  const kit = state.kit || []
  return INSCRIBED_FRAME_IDS.map(id => INSCRIBED_FRAMES[id]).filter(frame => {
    if (isMonster({ suit: frame.suit })) return false
    if (frame.oncePerRun && kit.some(c => c.inscribed === frame.id)) return false
    return true
  })
}

// -- Convenience inspection (used by UI) -------------------------------

// Upgrade can target any kit weapon or potion whose rank, after the +2 bonus,
// still respects the lore cap (no king-grade tools).
export function getUpgradeOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  return (state.kit || []).filter(
    c => (isWeapon(c) || isPotion(c)) && c.rank + UPGRADE_BONUS <= UPGRADE_RANK_CAP
  )
}

// Remove can target any kit card.
export function getRemoveOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  return (state.kit || []).slice()
}

// Roll the subset of verbs the Forge offers this visit. Inscribe is always
// present so kit growth is never starved; Upgrade and Remove each appear at
// 50% when available (something upgradable / more than one kit card). Takes the
// kit directly so it can run before the next sanctuary state is finalized.
export function rollForgeOffer(kit, rng) {
  const offer = ['inscribe']
  const canUpgrade = (kit || []).some(
    c => (isWeapon(c) || isPotion(c)) && c.rank + UPGRADE_BONUS <= UPGRADE_RANK_CAP
  )
  const canRemove = (kit || []).length > 1
  if (canUpgrade && rng() < 0.5) offer.push('upgrade')
  if (canRemove && rng() < 0.5) offer.push('remove')
  return offer
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
