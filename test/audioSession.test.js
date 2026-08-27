import { describe, test, expect, vi } from 'vitest'

// iOS/iPadOS silent-mode regression guard.
//
// WebKit runs Web Audio under the `ambient` audio session by default, and
// ambient audio is killed by the ringer switch even though the media volume
// reads full -- so the game was completely silent on iPad while sounding fine
// on Android and desktop, with nothing in the console. The fix is one line in
// audio.js declaring the `playback` session, and it is invisible on every
// platform that has no such concept, which is exactly the kind of line a later
// tidy-up deletes as dead code. Hence this file.
//
// Two things matter and both are asserted below: that we ask at all, and that
// we ask *before* Howler builds the AudioContext -- WebKit latches the category
// at context creation, so setting it afterwards is a silent no-op and the bug
// comes straight back. Both events land in one shared log so their order is
// really being compared.

/**
 * Import audio.js fresh against a stubbed navigator.
 * @param {(log: string[]) => object} makeNavigator
 * @returns {Promise<string[]>} the event log, in the order it happened
 */
async function importAudioWith(makeNavigator) {
  const log = []
  vi.resetModules()
  vi.doMock('howler', () => ({
    Howl: class { constructor(opts) { this.opts = opts } },
    // Howler.mute() is what first creates the AudioContext (with none built
    // yet it runs Howler's setupAudioContext), so it marks that moment.
    Howler: { mute: () => log.push('context') },
  }))
  vi.stubGlobal('navigator', makeNavigator(log))
  try {
    await import('../src/games/scoundrel/audio.js')
  } finally {
    vi.unstubAllGlobals()
    vi.doUnmock('howler')
  }
  return log
}

/** A navigator exposing the Safari 16.4+ Audio Session API. */
const withAudioSession = log => ({
  audioSession: Object.defineProperty({}, 'type', {
    set(v) { log.push(`session:${v}`) },
    get() { return 'auto' },
  }),
})

describe('audio session', () => {
  test('claims the playback session so silent mode does not mute the game', async () => {
    const log = await importAudioWith(withAudioSession)

    expect(
      log,
      'audio.js must set navigator.audioSession.type = "playback" or iOS mutes everything',
    ).toContain('session:playback')
  })

  test('claims it before the AudioContext exists, or the category will not stick', async () => {
    const log = await importAudioWith(withAudioSession)

    expect(log.indexOf('session:playback')).toBeGreaterThanOrEqual(0)
    expect(log.indexOf('context')).toBeGreaterThanOrEqual(0)
    expect(log.indexOf('session:playback')).toBeLessThan(log.indexOf('context'))
  })

  test('a browser without the API still loads', async () => {
    await expect(importAudioWith(() => ({}))).resolves.toContain('context')
  })

  test('a session that refuses the type does not take the module down', async () => {
    const hostile = () => ({
      audioSession: Object.defineProperty({}, 'type', {
        set() { throw new TypeError('nope') },
      }),
    })
    await expect(importAudioWith(hostile)).resolves.toContain('context')
  })
})
