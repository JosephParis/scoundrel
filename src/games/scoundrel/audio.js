/**
 * Audio for Scoundrel: a thin controller over Howler.
 *
 * One module-level singleton owns every sound. Music is a single looping bed
 * that crossfades when the game phase changes; SFX are short one-shots fired
 * from gameplay. A global mute (persisted to localStorage) is the only user
 * control for now, surfaced as the TopBar speaker toggle.
 *
 * Files live under /public/audio and are loaded lazily on first play. Until a
 * file exists the Howl just errors quietly and that cue stays silent, so the
 * whole system is safe to ship before the audio has been sourced. Drop the
 * files in (see public/audio/README.md) and they start playing with no code
 * change.
 *
 * Browser autoplay policy: Howler auto-unlocks the AudioContext on the first
 * user gesture, so the opening track may not sound until the first click. That
 * is expected and unavoidable on the web.
 */
import { Howl, Howler } from 'howler'
import { useSyncExternalStore } from 'react'

const MUTE_KEY = 'scoundrel:muted'
const MUSIC_VOL_KEY = 'scoundrel:musicVolume'
const SFX_VOL_KEY = 'scoundrel:sfxVolume'
const DEFAULT_MUSIC_VOLUME = 0.45
const DEFAULT_SFX_VOLUME = 0.7
const MUSIC_FADE_MS = 600

const clamp01 = v => Math.max(0, Math.min(1, v))

function loadVolume(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const v = parseFloat(raw)
    return Number.isFinite(v) ? clamp01(v) : fallback
  } catch {
    return fallback
  }
}

function storeVolume(key, v) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    // storage disabled; the volume still applies for this session
  }
}

// Music beds, keyed to match game.phase exactly so phase changes map straight
// to a track. victory/gameover are one-shot stings (loop off); the two live
// phases loop.
const MUSIC = {
  sanctuary: { src: '/audio/music/sanctuary.mp3', loop: true },
  descent: { src: '/audio/music/descent.mp3', loop: true },
  victory: { src: '/audio/music/victory.mp3', loop: false },
  gameover: { src: '/audio/music/gameover.mp3', loop: false },
}

// Short one-shots. Wire these from gameplay via audio.sfx('<id>') as the game
// grows; the registry is here so adding a cue is just a file plus a call.
const SFX = {
  cardFlip: { src: '/audio/sfx/card-flip.mp3' },
  equip: { src: '/audio/sfx/equip.mp3' },
  hit: { src: '/audio/sfx/hit.mp3' },
  heal: { src: '/audio/sfx/heal.mp3' },
  flee: { src: '/audio/sfx/flee.mp3' },
  sigil: { src: '/audio/sfx/sigil.mp3' },
  // Sanctuary actions.
  boon: { src: '/audio/sfx/boon.mp3' },
  forge: { src: '/audio/sfx/forge.mp3' },
  descend: { src: '/audio/sfx/descend.mp3' },
}

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

function storeMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false')
  } catch {
    // storage disabled; mute still works for the session
  }
}

class AudioController {
  constructor() {
    this.muted = loadMuted()
    this.musicVolume = loadVolume(MUSIC_VOL_KEY, DEFAULT_MUSIC_VOLUME)
    this.sfxVolume = loadVolume(SFX_VOL_KEY, DEFAULT_SFX_VOLUME)
    this.listeners = new Set()
    this.howls = new Map() // cacheKey -> Howl
    this.currentMusicId = null
    // Apply the persisted mute to the global Howler bus up front so a player
    // who muted last visit never hears a stray frame on load.
    Howler.mute(this.muted)
  }

  // -- mute state (also a React store via useMuted below) --------------

  get isMuted() {
    return this.muted
  }

  setMuted(muted) {
    const next = !!muted
    if (next === this.muted) return
    this.muted = next
    storeMuted(next)
    Howler.mute(next)
    this.listeners.forEach(fn => fn())
  }

  toggleMuted() {
    this.setMuted(!this.muted)
  }

  // -- per-channel volume (0..1) ---------------------------------------

  setMusicVolume(v) {
    const next = clamp01(v)
    if (next === this.musicVolume) return
    this.musicVolume = next
    storeVolume(MUSIC_VOL_KEY, next)
    // Apply live to the bed that's currently playing so the change is instant.
    if (this.currentMusicId) {
      const howl = this.howls.get(`music:${this.currentMusicId}`)
      if (howl && !howl._scoundrelFailed) howl.volume(next)
    }
    this.listeners.forEach(fn => fn())
  }

  setSfxVolume(v) {
    const next = clamp01(v)
    if (next === this.sfxVolume) return
    this.sfxVolume = next
    storeVolume(SFX_VOL_KEY, next)
    // One-shots read the level at play time (see sfx), so nothing to apply now.
    this.listeners.forEach(fn => fn())
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // -- howl cache ------------------------------------------------------

  _howl(kind, id, config) {
    const cacheKey = `${kind}:${id}`
    let howl = this.howls.get(cacheKey)
    if (howl) return howl
    howl = new Howl({
      src: [config.src],
      loop: !!config.loop,
      volume: kind === 'music' ? this.musicVolume : this.sfxVolume,
      // Swallow load failures (e.g. file not added yet) so a missing cue is
      // silent rather than a thrown error. Mark it so we never re-fade to it.
      onloaderror: () => {
        howl._scoundrelFailed = true
      },
    })
    this.howls.set(cacheKey, howl)
    return howl
  }

  // -- music -----------------------------------------------------------

  /**
   * Crossfade to the track for `id` (a game.phase value). Same id while it is
   * already current is a no-op, so this is safe to call from a phase effect on
   * every render. Unknown id stops music.
   */
  playMusic(id) {
    if (id === this.currentMusicId) return
    const config = MUSIC[id]
    this.stopMusic()
    this.currentMusicId = config ? id : null
    if (!config) return
    const howl = this._howl('music', id, config)
    if (howl._scoundrelFailed) return
    howl.volume(0)
    howl.play()
    howl.fade(0, this.musicVolume, MUSIC_FADE_MS)
  }

  stopMusic() {
    const prev = this.currentMusicId
    this.currentMusicId = null
    if (!prev) return
    const howl = this.howls.get(`music:${prev}`)
    if (!howl || howl._scoundrelFailed) return
    // Fade out, then halt so a re-entry to this track restarts cleanly.
    howl.fade(howl.volume(), 0, MUSIC_FADE_MS)
    howl.once('fade', () => howl.stop())
  }

  // -- sfx -------------------------------------------------------------

  sfx(id) {
    const config = SFX[id]
    if (!config) return
    const howl = this._howl('sfx', id, config)
    if (howl._scoundrelFailed) return
    // Read the current level at play time so a volume change applies to the
    // very next cue without touching the cached Howl elsewhere.
    howl.volume(this.sfxVolume)
    howl.play()
  }
}

export const audio = new AudioController()

// React bindings: subscribe a component to a piece of audio state. All three
// share the one listener set, so any change re-renders the bound controls.
// Server snapshots match the client defaults to keep hydration consistent.
export function useMuted() {
  return useSyncExternalStore(
    fn => audio.subscribe(fn),
    () => audio.isMuted,
    () => false,
  )
}

export function useMusicVolume() {
  return useSyncExternalStore(
    fn => audio.subscribe(fn),
    () => audio.musicVolume,
    () => DEFAULT_MUSIC_VOLUME,
  )
}

export function useSfxVolume() {
  return useSyncExternalStore(
    fn => audio.subscribe(fn),
    () => audio.sfxVolume,
    () => DEFAULT_SFX_VOLUME,
  )
}
