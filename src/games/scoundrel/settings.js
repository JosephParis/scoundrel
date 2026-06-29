/**
 * Player-facing display settings that are not part of a run's saved state.
 *
 * One module-level singleton owns each preference and persists it to
 * localStorage, mirroring the audio controller. Components subscribe through
 * the matching hook (e.g. useCardLayout) so a change from the Settings modal
 * re-renders every card at once.
 */
import { useSyncExternalStore } from 'react'

const CARD_LAYOUT_KEY = 'scoundrel:cardLayout'

// 'modern' prints rules text on the face of bosses/inscribed/trait cards;
// 'classic' is the original art-centered face with rules on hover only.
export const CARD_LAYOUTS = ['modern', 'classic']
const DEFAULT_CARD_LAYOUT = 'modern'

function loadCardLayout() {
  try {
    const v = localStorage.getItem(CARD_LAYOUT_KEY)
    return CARD_LAYOUTS.includes(v) ? v : DEFAULT_CARD_LAYOUT
  } catch {
    return DEFAULT_CARD_LAYOUT
  }
}

class Settings {
  constructor() {
    this.cardLayout = loadCardLayout()
    this.listeners = new Set()
  }

  get layout() {
    return this.cardLayout
  }

  setCardLayout(layout) {
    const next = CARD_LAYOUTS.includes(layout) ? layout : DEFAULT_CARD_LAYOUT
    if (next === this.cardLayout) return
    this.cardLayout = next
    try {
      localStorage.setItem(CARD_LAYOUT_KEY, next)
    } catch {
      // storage disabled; the choice still holds for the session
    }
    this.listeners.forEach(fn => fn())
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const settings = new Settings()

// React binding for the card-layout preference. Server snapshot matches the
// client default so hydration stays consistent.
export function useCardLayout() {
  return useSyncExternalStore(
    fn => settings.subscribe(fn),
    () => settings.layout,
    () => DEFAULT_CARD_LAYOUT,
  )
}
