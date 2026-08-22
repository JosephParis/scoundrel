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
const HANDLE_KEY = 'scoundrel:leaderboardHandle'

// 'modern' prints rules text on the face of bosses/inscribed/trait cards;
// 'classic' is the original art-centered face with rules on hover only.
export const CARD_LAYOUTS = ['modern', 'classic']
const DEFAULT_CARD_LAYOUT = 'modern'

// The public leaderboard credits runs to this handle. Empty is the default and
// means "keep my runs off the board": there is no anonymous listing, so
// appearing at all is an opt-in the player performs, never something derived
// from their Google profile. Kept deliberately narrow so nothing resembling contact details can
// be typed in — no '@', no dots, no slashes.
export const MAX_HANDLE_LENGTH = 16

/**
 * Normalize a typed handle: drop anything outside letters, digits, spaces,
 * hyphens and underscores, collapse runs of whitespace, and clamp the length.
 * Returns '' for a handle that is empty or made entirely of rejected
 * characters, which every reader treats as "keep this run off the board".
 *
 * Leading whitespace is dropped but a single trailing space is kept: this runs
 * on every keystroke of a controlled input, and trimming the end would eat the
 * space the moment it is typed, making a two-word handle impossible to enter.
 * Readers trim before storing or displaying, and since a leading space can
 * never survive, no handle can consist only of whitespace.
 */
export function sanitizeHandle(raw) {
  return String(raw ?? '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MAX_HANDLE_LENGTH)
}

function loadCardLayout() {
  try {
    const v = localStorage.getItem(CARD_LAYOUT_KEY)
    return CARD_LAYOUTS.includes(v) ? v : DEFAULT_CARD_LAYOUT
  } catch {
    return DEFAULT_CARD_LAYOUT
  }
}

function loadHandle() {
  try {
    return sanitizeHandle(localStorage.getItem(HANDLE_KEY))
  } catch {
    return ''
  }
}

class Settings {
  constructor() {
    this.cardLayout = loadCardLayout()
    this.leaderboardHandle = loadHandle()
    this.listeners = new Set()
  }

  get layout() {
    return this.cardLayout
  }

  /** The opt-in leaderboard handle, or '' when the player has not set one. */
  get handle() {
    return this.leaderboardHandle
  }

  setHandle(raw) {
    const next = sanitizeHandle(raw)
    if (next === this.leaderboardHandle) return
    this.leaderboardHandle = next
    try {
      if (next) localStorage.setItem(HANDLE_KEY, next)
      else localStorage.removeItem(HANDLE_KEY)
    } catch {
      // storage disabled; the choice still holds for the session
    }
    this.listeners.forEach(fn => fn())
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

// React binding for the leaderboard handle. Empty string = stay off the
// leaderboard, which is also the server snapshot so hydration stays consistent.
export function useHandle() {
  return useSyncExternalStore(
    fn => settings.subscribe(fn),
    () => settings.handle,
    () => '',
  )
}
