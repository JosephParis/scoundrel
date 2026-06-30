import {
  HEART, DIAMOND, CLUB, SPADE,
  SUIT_GLYPH,
  BASE_MAX_HP, ROOM_SIZE,
  isMonster,
  rankLabel,
} from '../constants'
import { getActiveThemes } from '../themes'
import { BOONS } from '../boons'
import { getAscensionEffectsForState } from '../ascensions'
import { devourerEffectiveRank, roomBossAuraBonus } from '../bosses'
import { AFFLICTIONS, hasAffliction } from '../afflictions'

// -- Log ---------------------------------------------------------------

export function appendLog(state, line) {
  return { ...state, log: [...(state.log || []), line].slice(-14) }
}

// -- Afflictions -------------------------------------------------------

// Apply an affliction for `rooms` upcoming room thresholds. A repeat hit
// refreshes the timer (takes the longer of the two) rather than stacking.
export function inflictAffliction(state, id, rooms) {
  if (!AFFLICTIONS[id] || rooms <= 0) return state
  const current = state.afflictions?.[id] || 0
  const afflictions = { ...(state.afflictions || {}), [id]: Math.max(current, rooms) }
  return appendLog({ ...state, afflictions },
    `Afflicted: ${AFFLICTIONS[id].name}. ${AFFLICTIONS[id].description}`)
}

// Tick every active affliction down by one room and drop any that reach 0.
// Called once per new room from applyRoomEntryEffects.
export function tickAfflictions(state) {
  if (!state.afflictions) return state
  const next = {}
  for (const [id, rooms] of Object.entries(state.afflictions)) {
    if (rooms - 1 > 0) next[id] = rooms - 1
  }
  return { ...state, afflictions: next }
}

// Apply healing, honoring the Sealed affliction (which blocks all recovery)
// and the maxHp cap. Returns { state, healed } so callers can log the amount
// actually restored; a sealed or already-full heal returns the state untouched.
export function applyHeal(state, amount) {
  if (amount <= 0 || hasAffliction(state, 'sealed')) return { state, healed: 0 }
  const healed = Math.min(state.maxHp, state.hp + amount) - state.hp
  if (healed <= 0) return { state, healed: 0 }
  return { state: { ...state, hp: state.hp + healed }, healed }
}

// -- Formatting --------------------------------------------------------

export function fmt(card) {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
}

// -- Theme helpers -----------------------------------------------------

export function activeThemes(state) {
  return getActiveThemes(state.theme, state.themeChildren)
}

export function themesFor(themeId, themeChildren) {
  return getActiveThemes(themeId, themeChildren)
}

export function themeFieldSum(themes, field) {
  return themes.reduce((s, t) => s + (t[field] || 0), 0)
}

export function themeFlagAny(themes, field) {
  return themes.some(t => t[field])
}

export function getRoomSize(themes) {
  let size = ROOM_SIZE
  for (const t of themes) {
    if (t.roomSize && t.roomSize > size) size = t.roomSize
  }
  return size
}

// Whether the player may flee the current room. state.canFlee is the
// descent-level gate (cleared by Hungry Dark, refreshed by Scoundrel's Cloak);
// a warded monster in the room blocks fleeing on top of that.
export function canFleeRoom(state) {
  if (!state.canFlee) return false
  return !(state.room || []).some(c => c && c.warded)
}

export function effectiveMonsterRank(state, card) {
  const themes = activeThemes(state)
  let bonus = 0
  for (const t of themes) {
    bonus += t.monsterRankBonus || 0
    bonus += t.monsterRankBonusBySuit?.[card.suit] || 0
  }
  // The Devourer overrides its baseline rank with `3 + sum of last 3
  // killed monster ranks`. Theme bonuses still stack on top.
  const baseRank = card.boss === 'devourer'
    ? devourerEffectiveRank(state)
    : card.rank
  // Ascension A6: face-card monsters hit at +N effective rank. Driven by
  // the effective base, so a Devourer scaled above 11 also picks it up.
  const asc = getAscensionEffectsForState(state)
  if (asc.faceCardRankBonus && baseRank >= 11) {
    bonus += asc.faceCardRankBonus
  }
  // The Warden (and any future room-aura boss) adds a flat bonus to every
  // other monster sharing its room.
  bonus += roomBossAuraBonus(state, card)
  // Swelling: each monster already slain this room makes it hit harder.
  if (card.swelling) bonus += (state.monstersFoughtThisRoom || 0)
  // Vengeful deaths leave a lingering +1 on every monster in the room (set in
  // applyMonsterFight, cleared on each new room by applyRoomEntryEffects).
  bonus += (state.vengefulBonus || 0)
  return baseRank + bonus
}

// -- Boon helpers ------------------------------------------------------

// Stoic takes hold from the very next descent after it is chosen: that descent
// gains the +10 max HP and takes a full heal to the new max, then the heal
// stops (see carriesWounds in lifecycle). boonPicks records the descent each
// boon precedes; pick.descent IS that next descent, so Stoic is live once the
// current descent has reached it.
export function stoicActive(state) {
  if (!state.boons?.includes('stoic')) return false
  const pick = (state.boonPicks || []).find(p => p.picked === 'stoic')
  if (!pick) return false
  const currentDescent = (state.sigilsEarned || 0) + 1
  return currentDescent >= pick.descent
}

// Wormwood mutes one Boon for the descent. activeBoons filters it out so
// every effect-read consults the same gated list. Stoic is filtered until it
// goes live (see stoicActive), so every max-HP / heal read defers as one.
export function activeBoons(state) {
  let ids = state.boons
  if (ids?.includes('stoic') && !stoicActive(state)) {
    ids = ids.filter(id => id !== 'stoic')
  }
  if (state.mutedBoon) ids = ids.filter(id => id !== state.mutedBoon)
  return ids
}

export function hasBoon(state, id) {
  return activeBoons(state).includes(id)
}

export function sumBoonField(boons, field) {
  return boons.reduce((sum, id) => sum + (BOONS[id]?.[field] || 0), 0)
}

export function maxBoonField(boons, field, baseline) {
  return boons.reduce((m, id) => Math.max(m, BOONS[id]?.[field] || baseline), baseline)
}

export function minMaxHpOverride(boons) {
  let acc = null
  for (const id of boons) {
    const o = BOONS[id]?.maxHpOverride
    if (o != null && (acc == null || o < acc)) acc = o
  }
  return acc
}

export function computeMaxHp(state, themeId = state.theme, themeChildren = state.themeChildren) {
  const themes = themesFor(themeId, themeChildren)
  const boons = activeBoons(state)
  const override = minMaxHpOverride(boons)
  const base = override != null ? override : BASE_MAX_HP
  const asc = getAscensionEffectsForState(state)
  return Math.max(
    1,
    base + sumBoonField(boons, 'maxHpBonus') + themeFieldSum(themes, 'maxHpBonus') + asc.maxHpBonus
  )
}

export function computePotionsPerRoomLimit(boons) {
  return maxBoonField(boons, 'potionsPerRoom', 1)
}

export function effectiveWeaponRank(state, weapon) {
  if (!weapon) return 0
  const boons = activeBoons(state)
  let bonus = sumBoonField(boons, 'weaponRankBonus')
  if (hasBoon(state, 'wounded_lion') && state.hp < 10) bonus += 2
  if (hasBoon(state, 'berserker')) bonus += (state.monstersFoughtThisRoom || 0)
  // Potion of Strength is banked on the weapon itself, so it only lifts the
  // blade that drank it, not every weapon the player picks up afterwards.
  bonus += weapon.strengthBonus || 0
  return Math.max(0, weapon.rank + bonus)
}

export function bonusVsSuitFor(state, card) {
  for (const id of activeBoons(state)) {
    const b = BOONS[id]
    if (b?.bonusVsSuit && b.bonusVsSuit === card.suit) {
      return { amount: b.bonusVsSuitAmount || 0, name: b.name, id }
    }
  }
  return null
}

// -- Tutorial lesson tracking ------------------------------------------
// Set of actions the curated walkthrough is designed to teach. Once
// the player has done all of these (in any order, across any rooms),
// the UI stops pointing at things and hides the hover tips.
export const TUTORIAL_LESSONS = ['equip', 'fight', 'potion', 'replace', 'barehands', 'barehands_choice', 'flee']

export function markTutorialLesson(state, lesson) {
  if (!state.tutorial) return state
  const current = state.tutorialLessons || []
  if (current.includes(lesson)) return state
  return { ...state, tutorialLessons: [...current, lesson] }
}

export function tutorialAllLessonsDone(state) {
  if (!state.tutorial) return false
  const done = new Set(state.tutorialLessons || [])
  return TUTORIAL_LESSONS.every(l => done.has(l))
}

// -- Numeric breakdown sum helper --------------------------------------

export function sumParts(parts) {
  return parts.reduce((s, p) => s + (p.op === '-' ? -p.value : p.value), 0)
}

// Re-export commonly used identifiers so downstream modules can grab
// them from one place if convenient.
export { isMonster, HEART, DIAMOND, CLUB, SPADE }
