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
 *
 * iOS/iPadOS: see configureAudioSession below. Without it the whole game is
 * silent on any Apple device whose ringer is off, which is most of them.
 */
import { Howl, Howler } from 'howler'
import { useSyncExternalStore } from 'react'
import { assetUrl } from '../../buildTarget.js'

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
//
// gameover opts out of the fade-in. It is a single bell struck once, and its
// whole character is in the attack -- fading up over 600ms turns the strike
// into a swell, which is the difference between a death sound and a piece of
// music. The file is cut to start on the transient (scripts/build-bell-cues.sh)
// so this plays the toll on the same frame the death screen appears. The
// outgoing bed still fades out underneath it.
const MUSIC = {
  sanctuary: { src: '/audio/music/sanctuary.mp3', loop: true },
  descent: { src: '/audio/music/descent.mp3', loop: true },
  victory: { src: '/audio/music/victory.mp3', loop: false },
  gameover: { src: '/audio/music/gameover.mp3', loop: false, fadeIn: false },
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

/**
 * Opt this page into the "playback" audio session so sound survives silent mode.
 *
 * WebKit runs Web Audio under the `ambient` session category by default, and
 * ambient audio is silenced by the iPhone ringer switch / the iPad's Control
 * Centre silent toggle -- independently of the volume buttons, which keep
 * showing a healthy media level the whole time. No other platform has this
 * concept, which is why the game sounded fine on Android and desktop and was
 * mute on iPad with nothing in the console to explain it.
 *
 * Declaring `playback` (the category media players use) routes the game like
 * media instead of like a UI blip, so it ignores the silent switch and keeps
 * running when the screen locks. The trade is iOS's, not ours: a playback
 * session takes the audio focus, so it stops whatever the player had going in
 * another app rather than mixing under it. A muted game is the worse of the
 * two, and the mute toggle is right there in the top bar.
 *
 * Must run before the AudioContext exists -- the category is latched at
 * context creation -- so the constructor calls this before touching Howler.
 * Safari 16.4+ only; older iPadOS has no way to ask, and stays silent-switched.
 */
function configureAudioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = 'playback'
    }
  } catch {
    // Unsupported value or a locked-down session; Web Audio still works, it
    // just keeps the default category.
  }
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
    // Before anything else: Howler.mute() below is what first creates the
    // AudioContext, and the session category can only be chosen up front.
    configureAudioSession()
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
      // Resolved against the deployment base rather than used as written. The
      // registry paths are absolute so the tooling can read them straight out of
      // this file (visual/audio-assets.spec.js, visual/robots-and-payload.spec.js),
      // but they are the one class of asset Vite's `base` cannot rewrite -- they
      // are strings assembled at runtime, not imports. Left alone, a build served
      // from a subdirectory requests /audio/... at the host's root and every cue
      // 404s into the silent-failure path below: no music, no error, nothing to
      // notice. assetUrl is the identity function when BASE_URL is '/'.
      src: [assetUrl(config.src)],
      loop: !!config.loop,
      volume: kind === 'music' ? this.musicVolume : this.sfxVolume,
      // Swallow load failures (e.g. file not added yet) so a missing cue is
      // silent rather than a thrown error. Mark it so we never re-fade to it.
      //
      // Silent in production is the right behaviour, but it also hid two cues
      // that were registered and never added, leaving the win and death screens
      // mute for a long time with nothing to notice (issue 03). Say so in dev, so
      // the next missing file announces itself. visual/audio-assets.spec.js
      // checks the whole registry resolves.
      onloaderror: () => {
        howl._scoundrelFailed = true
        if (!import.meta.env.PROD) {
          console.warn(`[audio] cue failed to load, will stay silent: ${config.src}`)
        }
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
    // A cue marked fadeIn: false starts at full level, for cues whose attack is
    // the point (see MUSIC). Everything else eases in.
    if (config.fadeIn === false) {
      howl.volume(this.musicVolume)
      howl.play()
      return
    }
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
