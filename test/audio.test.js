import { describe, test, expect, vi, beforeEach } from 'vitest'

// How the music controller starts a track.
//
// The death toll is the reason this file exists. It is one bell struck once,
// and its whole character is in the attack, so it must start at full level on
// the frame the death screen appears -- not swell in over the 600ms crossfade
// the looping beds use. That is a single `if` in playMusic, which is exactly
// the kind of thing a later refactor tidies away without noticing.

const howls = []

vi.mock('howler', () => {
  class Howl {
    constructor(opts) {
      this.opts = opts
      this.src = opts.src[0]
      this._volume = opts.volume
      this.calls = []
      howls.push(this)
    }
    volume(v) {
      if (v === undefined) return this._volume
      this._volume = v
      this.calls.push(['volume', v])
      return this
    }
    play() { this._playing = true; this.calls.push(['play']); return this }
    stop() { this._playing = false; this.calls.push(['stop']); return this }
    pause() { this._playing = false; this.calls.push(['pause']); return this }
    playing() { return !!this._playing }
    fade(from, to, ms) { this.calls.push(['fade', from, to, ms]); return this }
    once() { return this }
  }
  return { Howl, Howler: { mute: vi.fn() } }
})

// audio.js is a module-level singleton and caches one Howl per cue for the
// life of the process, so `howls` accumulates across the whole file and is
// never emptied -- a second test asking for the same cue gets the same
// instance back, not a new one. Each test is isolated by stopping playback and
// clearing the recorded calls instead.
const { audio } = await import('../src/games/scoundrel/audio.js')

const howlFor = src => howls.find(h => h.src === src)
const played = h => h.calls.some(([name]) => name === 'play')
const faded = h => h.calls.some(([name]) => name === 'fade')
const paused = h => h.calls.some(([name]) => name === 'pause')
const stopped = h => h.calls.some(([name]) => name === 'stop')
const countOf = (h, name) => h.calls.filter(([n]) => n === name).length
/** A fade down to silence -- the tail stopMusic runs, as opposed to a fade in. */
const fadedOut = h => h.calls.some(([n, , to]) => n === 'fade' && to === 0)
/** Level at the moment play() was called. */
const levelAtPlay = (h) => {
  const i = h.calls.findIndex(([name]) => name === 'play')
  const before = h.calls.slice(0, i).filter(([name]) => name === 'volume')
  return before.length ? before[before.length - 1][1] : h.opts.volume
}

beforeEach(() => {
  audio.resumeMusic()   // release a hold a previous test left on the controller
  audio.playMusic(null) // stop whatever the previous test left running
  // The fade-out path ends on a 'fade' event this mock never fires, so a faded
  // howl would still read as playing. Reset the double's own state too.
  howls.forEach(h => { h.calls.length = 0; h._playing = false })
})

describe('playMusic', () => {
  test('the death toll starts at full volume, with no fade in', () => {
    audio.playMusic('gameover')

    const toll = howlFor('/audio/music/gameover.mp3')
    expect(toll, 'gameover cue should have been constructed').toBeTruthy()
    expect(played(toll)).toBe(true)
    expect(faded(toll), 'the toll must not be faded in -- it would swallow the strike').toBe(false)
    expect(levelAtPlay(toll)).toBe(audio.musicVolume)
  })

  test('the death toll does not loop', () => {
    audio.playMusic('gameover')
    expect(howlFor('/audio/music/gameover.mp3').opts.loop).toBe(false)
  })

  test('the looping beds still fade in from silence', () => {
    audio.playMusic('descent')

    const bed = howlFor('/audio/music/descent.mp3')
    expect(played(bed)).toBe(true)
    expect(levelAtPlay(bed), 'a bed should start silent').toBe(0)
    const fade = bed.calls.find(([name]) => name === 'fade')
    expect(fade).toBeTruthy()
    expect(fade[1]).toBe(0)
    expect(fade[2]).toBe(audio.musicVolume)
  })

  test('victory still fades in, so the opt-out is per cue and not global', () => {
    audio.playMusic('victory')
    expect(faded(howlFor('/audio/music/victory.mp3'))).toBe(true)
  })

  test('dying out of a descent fades the bed out under the toll', () => {
    audio.playMusic('descent')
    audio.playMusic('gameover')

    const bed = howlFor('/audio/music/descent.mp3')
    const fades = bed.calls.filter(([name]) => name === 'fade')
    // Two: one in, one back out. The last one lands on silence.
    expect(fades.length).toBe(2)
    expect(fades[1][2]).toBe(0)
    expect(faded(howlFor('/audio/music/gameover.mp3'))).toBe(false)
  })

  test('re-entering the same phase does not restart the track', () => {
    audio.playMusic('gameover')
    audio.playMusic('gameover')

    const toll = howlFor('/audio/music/gameover.mp3')
    expect(toll.calls.filter(([name]) => name === 'play').length).toBe(1)
  })

  test('an unknown phase stops music rather than throwing', () => {
    audio.playMusic('descent')
    expect(() => audio.playMusic('leaderboard')).not.toThrow()
    expect(howlFor('/audio/music/descent.mp3').calls.some(([n, , to]) => n === 'fade' && to === 0)).toBe(true)
  })
})

// Pausing the game pauses the music.
//
// The distinction that matters is pause vs stop: stopMusic exists and would
// have been the one-line answer, but it fades to zero and halts, so resuming
// would restart the bed from the top every time the player opened the menu.
// These assert the playhead is kept instead.
describe('pauseMusic / resumeMusic', () => {
  test('pausing holds the bed rather than stopping it', () => {
    audio.playMusic('descent')
    audio.pauseMusic()

    const bed = howlFor('/audio/music/descent.mp3')
    expect(paused(bed)).toBe(true)
    expect(stopped(bed)).toBe(false)
    // The fade in from playMusic is still on the call list; what must not be
    // there is the fade *out* to silence that stopMusic would have run.
    expect(fadedOut(bed)).toBe(false)
  })

  test('resuming continues the same track instead of restarting it', () => {
    audio.playMusic('descent')
    const bed = howlFor('/audio/music/descent.mp3')
    bed.calls.length = 0

    audio.pauseMusic()
    audio.resumeMusic()

    // One play() and no stop() between them: Howler resumes from the playhead,
    // which is the whole point. A restart would show up as a stop or a fade.
    expect(countOf(bed, 'play')).toBe(1)
    expect(stopped(bed)).toBe(false)
    expect(faded(bed)).toBe(false)
  })

  test('a second pause or a stray resume changes nothing', () => {
    audio.playMusic('descent')
    const bed = howlFor('/audio/music/descent.mp3')

    audio.pauseMusic()
    bed.calls.length = 0
    audio.pauseMusic()
    expect(bed.calls).toEqual([])

    audio.resumeMusic()
    bed.calls.length = 0
    audio.resumeMusic()
    expect(bed.calls).toEqual([])
  })

  test('pausing with no track playing does not throw', () => {
    expect(() => { audio.pauseMusic(); audio.resumeMusic() }).not.toThrow()
  })

  test('a phase change while paused selects the bed but stays silent', () => {
    audio.playMusic('sanctuary')
    audio.pauseMusic()
    audio.playMusic('descent')

    const next = howlFor('/audio/music/descent.mp3')
    expect(played(next)).toBe(false)

    // ...and the menu closing is what finally starts it.
    audio.resumeMusic()
    expect(played(next)).toBe(true)
  })

  test('stopping a held bed halts it flat, since a paused fade never lands', () => {
    audio.playMusic('sanctuary')
    audio.pauseMusic()
    const bed = howlFor('/audio/music/sanctuary.mp3')
    bed.calls.length = 0

    audio.playMusic('descent') // stops the held bed on the way past

    expect(stopped(bed)).toBe(true)
    expect(faded(bed)).toBe(false)
  })
})
