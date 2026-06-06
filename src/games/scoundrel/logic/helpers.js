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

// -- Log ---------------------------------------------------------------

export function appendLog(state, line) {
  return { ...state, log: [...(state.log || []), line].slice(-14) }
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
  return baseRank + bonus
}

// -- Boon helpers ------------------------------------------------------

// Wormwood mutes one Boon for the descent. activeBoons filters it out so
// every effect-read consults the same gated list.
export function activeBoons(state) {
  if (state.mutedBoon) return state.boons.filter(id => id !== state.mutedBoon)
  return state.boons
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
  bonus += state.strengthBonus || 0
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
