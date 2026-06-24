import {
  SUIT_GLYPH, BASE_MAX_HP, isMonster, isWeapon, isPotion, rankLabel,
  HEART, DIAMOND, INSCRIBED_FRAMES, INSCRIBED_FRAME_IDS, makeInscribedCard, makeKitCard,
} from '../constants'
import { isEnabled as isFlagEnabled } from '../flags'
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
  // Decision-funnel (analytics only): what was offered vs what was taken,
  // keyed by the descent this pick precedes. Run-level, carried across
  // descents and snapshotted by buildRunRecord. See [[project_history_storage]].
  const pick = {
    descent: (state.sigilsEarned || 0) + 1,
    offered: state.boonOffers.slice(),
    picked: boonId,
  }
  return appendLog(
    {
      ...state,
      boons: state.boons.concat(boonId),
      boonChosen: true,
      boonOffers: [],
      boonPicks: [...(state.boonPicks || []), pick],
    },
    `Took the ${BOONS[boonId]?.name}.`
  )
}

// -- Forge: kit editing ------------------------------------------------
//
// Each sanctuary visit grants a batch of edits whose types are chosen for the
// player (state.forgeGrants). The player works through them one at a time
// (state.forgeGrantIndex), and each edit is a "pick one of a few cards" screen
// (state.forgeChoices). Inscribe adds the chosen tool; Upgrade bumps it +2;
// Remove drops it. Inscribe is weighted high so growth is never starved.

export const UPGRADE_BONUS = 2
export const UPGRADE_RANK_CAP = 10

// How many edits a visit grants: 2 through Tier 1-3, 3 from Tier 4 (sigils 5+).
function editsPerVisit(sigils) {
  return (sigils || 0) >= 5 ? 3 : 2
}

// Kit cards that can still take an Upgrade (+2 within the rank cap).
function upgradeCandidates(kit) {
  return (kit || []).filter(
    c => (isWeapon(c) || isPotion(c)) && c.rank + UPGRADE_BONUS <= UPGRADE_RANK_CAP
  )
}

// Pull up to n random items from arr (partial Fisher-Yates).
function sampleN(arr, n, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

// Tool/neutral inscribe frames the kit can still take (monster frames excluded;
// oncePerRun frames already in the kit excluded).
function inscribeFramePool(kit) {
  return INSCRIBED_FRAME_IDS.map(id => INSCRIBED_FRAMES[id]).filter(frame => {
    if (isMonster({ suit: frame.suit })) return false
    if (frame.oncePerRun && (kit || []).some(c => c.inscribed === frame.id)) return false
    return true
  })
}

// Roll the 4 candidate cards an Inscribe grant offers: plain weapons/potions at
// the progress rank cap (4 + sigils, max 10), with up to one special frame mixed
// in when custom cards are enabled. Each candidate is a kit-ready card.
function rollInscribeChoices(kit, sigils, rng) {
  const cap = Math.min(10, 4 + (sigils || 0))
  const choices = []
  for (let i = 0; i < 4; i++) {
    const suit = rng() < 0.5 ? DIAMOND : HEART
    const rank = 2 + Math.floor(rng() * (cap - 1))
    choices.push(makeKitCard(suit, rank))
  }
  if (isFlagEnabled('customCards')) {
    const frames = inscribeFramePool(kit)
    if (frames.length > 0 && rng() < 0.5) {
      const frame = frames[Math.floor(rng() * frames.length)]
      const rank = frame.rankMin + Math.floor(rng() * (frame.rankMax - frame.rankMin + 1))
      choices[Math.floor(rng() * choices.length)] = makeInscribedCard(frame.id, rank)
    }
  }
  return choices
}

// Roll the candidate cards (up to 4) an edit grant offers, given its type and
// the current kit. Inscribe rolls fresh tool cards; Upgrade and Remove sample
// existing kit cards.
export function rollForgeChoices(type, kit, sigils, rng) {
  if (type === 'inscribe') return rollInscribeChoices(kit, sigils, rng)
  if (type === 'upgrade') return sampleN(upgradeCandidates(kit), 4, rng)
  if (type === 'remove') return sampleN((kit || []).slice(), 4, rng)
  return []
}

// Roll the ordered batch of edit types for a visit. Inscribe is weighted high
// so growth is never starved; Upgrade and Remove fall back to Inscribe when
// unavailable; at most one Remove per visit.
export function rollForgeGrants(kit, sigils, rng) {
  const n = editsPerVisit(sigils)
  const grants = []
  let removeUsed = false
  for (let i = 0; i < n; i++) {
    const canUpgrade = upgradeCandidates(kit).length > 0
    const canRemove = !removeUsed && (kit || []).length > 1
    const r = rng()
    let type
    if (r < 0.45) type = 'inscribe'
    else if (r < 0.8) type = canUpgrade ? 'upgrade' : 'inscribe'
    else type = canRemove ? 'remove' : 'inscribe'
    if (type === 'remove') removeUsed = true
    grants.push(type)
  }
  return grants
}

// Find the first grant (from `from`) with non-empty choices, rolling each
// against the current kit. Empty grants (e.g. an Upgrade with nothing left to
// upgrade) are skipped. Returns { forgeGrantIndex, forgeChoices }.
export function initForgeBatch(grants, kit, sigils, rng, from = 0) {
  let index = from
  while (index < grants.length) {
    const choices = rollForgeChoices(grants[index], kit, sigils, rng)
    if (choices.length > 0) return { forgeGrantIndex: index, forgeChoices: choices }
    index += 1
  }
  return { forgeGrantIndex: index, forgeChoices: [] }
}

// Whether the player still has edits to resolve this visit.
export function forgeActive(state) {
  return !!state.forgeOpen && (state.forgeGrantIndex || 0) < (state.forgeGrants || []).length
}

// Advance to the next non-empty grant in the batch (rolling its choices against
// the just-edited kit), or close the forge stage when the batch is done.
function advanceForgeGrant(state) {
  const { forgeGrantIndex, forgeChoices } = initForgeBatch(
    state.forgeGrants || [], state.kit, state.sigilsEarned || 0, state.rng,
    (state.forgeGrantIndex || 0) + 1
  )
  return { ...state, forgeGrantIndex, forgeChoices }
}

// Compact card descriptor for the decision-funnel record (analytics only):
// just the dimensions worth grouping on, never the full card object.
function cardBrief(c) {
  if (!c) return null
  return { suit: c.suit, rank: c.rank, inscribed: c.inscribed || null, upgraded: !!c.upgraded }
}

// One resolved forge edit for the decision funnel: the grant type, the cards
// offered, and the one chosen (null when skipped). Keyed by the descent the
// edit precedes. Run-level, carried across descents, snapshotted by
// buildRunRecord. See [[project_history_storage]].
function forgeEditEntry(state, type, chosen, skipped) {
  return {
    descent: (state.sigilsEarned || 0) + 1,
    type,
    offered: (state.forgeChoices || []).map(cardBrief),
    chosen: cardBrief(chosen),
    skipped,
  }
}

// Apply the current grant to the chosen card (one of state.forgeChoices), then
// advance the batch. cardId must be in the current offer.
export function applyForgeEdit(state, cardId) {
  if (state.phase !== 'sanctuary' || !forgeActive(state)) return state
  const type = state.forgeGrants[state.forgeGrantIndex]
  const card = (state.forgeChoices || []).find(c => c.id === cardId)
  if (!card) return state
  const kit = state.kit || []
  let next

  if (type === 'inscribe') {
    if (card.inscribed) {
      const frame = INSCRIBED_FRAMES[card.inscribed]
      if (frame?.oncePerRun && kit.some(c => c.inscribed === card.inscribed)) return state
    }
    next = appendLog(
      { ...state, kit: [...kit, card], kitEdits: (state.kitEdits || 0) + 1 },
      card.inscribed
        ? `Inscribed ${INSCRIBED_FRAMES[card.inscribed]?.name || 'a tool'}${card.rank > 0 ? ` (${rankLabel(card.rank)})` : ''} into the kit.`
        : `Added ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} to the kit.`
    )
  } else if (type === 'upgrade') {
    if (!(isWeapon(card) || isPotion(card)) || card.rank + UPGRADE_BONUS > UPGRADE_RANK_CAP) return state
    const newKit = kit.map(c =>
      c.id === cardId
        ? { ...c, rank: c.rank + UPGRADE_BONUS, upgraded: true, upgradeBonus: (c.upgradeBonus || 0) + UPGRADE_BONUS }
        : c
    )
    next = appendLog(
      { ...state, kit: newKit, kitEdits: (state.kitEdits || 0) + 1 },
      `Upgraded ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} → ${rankLabel(card.rank + UPGRADE_BONUS)}${SUIT_GLYPH[card.suit]}.`
    )
  } else if (type === 'remove') {
    if (kit.length <= 1) return state
    next = appendLog(
      { ...state, kit: kit.filter(c => c.id !== cardId), kitEdits: (state.kitEdits || 0) + 1 },
      `Removed ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} from the kit.`
    )
  } else {
    return state
  }

  next = { ...next, forgeEdits: [...(state.forgeEdits || []), forgeEditEntry(state, type, card, false)] }
  return advanceForgeGrant(next)
}

// Skip the current grant without applying it, then advance the batch.
export function skipForgeEdit(state) {
  if (state.phase !== 'sanctuary' || !forgeActive(state)) return state
  const type = state.forgeGrants[state.forgeGrantIndex]
  const next = {
    ...appendLog(state, 'You leave the coals for now.'),
    forgeEdits: [...(state.forgeEdits || []), forgeEditEntry(state, type, null, true)],
  }
  return advanceForgeGrant(next)
}

// Clear the Map peek snapshot. Called when the player closes the modal
// the Map opens. Idempotent: a no-op when mapPeek is already null.
export function dismissMapPeek(state) {
  if (!state.mapPeek) return state
  return { ...state, mapPeek: null }
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
