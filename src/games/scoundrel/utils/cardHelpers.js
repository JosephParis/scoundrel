import { isMonster, isWeapon, isPotion, isTool, isWound, isBoss } from '../logic'

// Border color by card type: monsters deep green, weapons cool gray, potions
// deep purple, wounds dull rust, tools warm gold. Bosses overlap with monsters
// but get a rune-gold border so they read as distinct on sight.
export function cardBorderTone(card) {
  if (!card) return 'border-stone-700'
  if (isBoss(card)) return 'border-rune'
  if (isTool(card)) return 'border-amber-600'
  if (isMonster(card)) return 'border-green-700'
  if (isWeapon(card)) return 'border-gray-500'
  if (isPotion(card)) return 'border-purple-700'
  if (isWound(card)) return 'border-red-900'
  return 'border-stone-700'
}

// Colored tint per category. Kept saturated since the icon is the
// centerpiece, not a watermark. Bosses override the monster tone so the
// sigil itself reads gold, matching the rune border.
export function suitIconTone(card) {
  if (isBoss(card)) return 'text-rune'
  if (isTool(card)) return 'text-amber-700'
  if (isMonster(card)) return 'text-green-800'
  if (isWeapon(card)) return 'text-stone-700'
  if (isPotion(card)) return 'text-purple-800'
  if (isWound(card)) return 'text-red-900'
  return 'text-stone-700'
}
