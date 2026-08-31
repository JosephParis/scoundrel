/**
 * Player-facing display settings that are not part of a run's saved state.
 *
 * One module-level singleton owns each preference and persists it to
 * localStorage, mirroring the audio controller. Components subscribe through
 * the matching hook (e.g. useCardLayout) so a change from the Settings modal
 * re-renders every card at once.
 */
import { useSyncExternalStore } from 'react'
import { MAX_HANDLE_LENGTH, sanitizeHandle } from './handle'
import { assignedNameFor, deviceSeed } from './assignedName'

const CARD_LAYOUT_KEY = 'scoundrel:cardLayout'
const HANDLE_KEY = 'scoundrel:leaderboardHandle'
const ANONYMOUS_KEY = 'scoundrel:leaderboardAnonymous'

// 'modern' prints rules text on the face of bosses/inscribed/trait cards;
// 'classic' is the original art-centered face with rules on hover only.
export const CARD_LAYOUTS = ['modern', 'classic']
const DEFAULT_CARD_LAYOUT = 'modern'

// Re-exported so the many callers that reach for these through settings keep
// working; they live in handle.js because assignedName.js needs them too and
// importing settings from there would be a cycle.
export { MAX_HANDLE_LENGTH, sanitizeHandle }

/**
 * How a player is credited on the public board, in three states:
 *
 * - **assigned** (the default) — a random name in the game's register, given
 *   out without asking. Nobody faces a blank field, and every player is
 *   distinguishable on the board instead of collapsing into one "Anonymous".
 * - **custom** — they typed one. Wins over the assigned name.
 * - **anonymous** — they asked not to be named. The run still places; the row
 *   simply carries no name, exactly as an unnamed run did before.
 *
 * `effectiveName` collapses the three into the single string a record carries.
 */

function loadCardLayout() {
  try {
    const v = localStorage.getItem(CARD_LAYOUT_KEY)
    return CARD_LAYOUTS.includes(v) ? v : DEFAULT_CARD_LAYOUT
  } catch {
    return DEFAULT_CARD_LAYOUT
  }
}

function loadAnonymous() {
  try {
    return localStorage.getItem(ANONYMOUS_KEY) === '1'
  } catch {
    return false
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
    this.leaderboardAnonymous = loadAnonymous()
    // Minted on first read and cached for the session. Deliberately lazy: a
    // module-level call would touch localStorage at import time, before the
    // error boundary is mounted.
    this.assigned = ''
    this.listeners = new Set()
  }

  get layout() {
    return this.cardLayout
  }

  /** The typed handle, or '' when the player has not set one. */
  get handle() {
    return this.leaderboardHandle
  }

  /** The random name this device was given, e.g. 'Ashen Vagrant 47'. */
  get assignedName() {
    if (!this.assigned) this.assigned = assignedNameFor(deviceSeed())
    return this.assigned
  }

  /** True when the player has asked not to be named on the board. */
  get anonymous() {
    return this.leaderboardAnonymous
  }

  /**
   * The name a run finished now would be credited to: '' means the row carries
   * no name and the board shows it as Anonymous. This is the only one of the
   * four values a record should ever be built from.
   */
  get effectiveName() {
    if (this.leaderboardAnonymous) return ''
    return this.leaderboardHandle.trim() || this.assignedName
  }

  setAnonymous(next) {
    const value = Boolean(next)
    if (value === this.leaderboardAnonymous) return
    this.leaderboardAnonymous = value
    try {
      if (value) localStorage.setItem(ANONYMOUS_KEY, '1')
      else localStorage.removeItem(ANONYMOUS_KEY)
    } catch {
      // storage disabled; the choice still holds for the session
    }
    this.listeners.forEach(fn => fn())
  }

  setHandle(raw) {
    const next = sanitizeHandle(raw)
    // Typing a name is itself a request to be named, so it lifts the opt-out
    // rather than being silently overridden by it. Clearing the field does not
    // re-apply it: that would make the opt-out reachable by accident.
    if (next.trim()) this.setAnonymous(false)
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

// React binding for the typed handle. Empty string means the player has typed
// no name -- not that they are unlisted -- and is also the server snapshot so
// hydration stays consistent.
export function useHandle() {
  return useSyncExternalStore(
    fn => settings.subscribe(fn),
    () => settings.handle,
    () => '',
  )
}

// React binding for the name assigned to this device.
//
// The server snapshot is '' rather than a generated name because generating one
// needs localStorage, which does not exist during SSR or the prerender pass.
// Components must therefore tolerate an empty value on the first paint.
export function useAssignedName() {
  return useSyncExternalStore(
    fn => settings.subscribe(fn),
    () => settings.assignedName,
    () => '',
  )
}

// React binding for the explicit opt-out.
export function useAnonymous() {
  return useSyncExternalStore(
    fn => settings.subscribe(fn),
    () => settings.anonymous,
    () => false,
  )
}

// React binding for what a run finished right now would be credited to. This is
// what UI should show the player; useHandle is for the input field itself.
export function useEffectiveName() {
  return useSyncExternalStore(
    fn => settings.subscribe(fn),
    () => settings.effectiveName,
    () => '',
  )
}
