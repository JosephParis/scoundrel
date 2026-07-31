import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Every audio cue the game registers must actually exist (issue 03).
//
// victory.mp3 and gameover.mp3 were declared in the registry for a long time
// without ever being added, so the win and death screens played silence. Nothing
// surfaced it: Howler's onloaderror sets _scoundrelFailed and every play() call
// then returns early, by design, so a missing file is indistinguishable from a
// muted one.
//
// The paths are parsed out of audio.js rather than hard-coded here, so this
// covers any cue added later too -- the point is to catch the class of bug, not
// the two files that happened to be missing.

const AUDIO_JS = fileURLToPath(new URL('../src/games/scoundrel/audio.js', import.meta.url))

function registeredAudioPaths() {
  const source = readFileSync(AUDIO_JS, 'utf8')
  const paths = [...source.matchAll(/src:\s*'(\/audio\/[^']+)'/g)].map(m => m[1])
  return [...new Set(paths)]
}

test('the registry is non-empty and parseable', () => {
  // Guards the regex above: if audio.js changes shape and this stops matching,
  // every other test here would vacuously pass with an empty list.
  const paths = registeredAudioPaths()
  expect(paths.length).toBeGreaterThanOrEqual(13)
  expect(paths).toContain('/audio/music/gameover.mp3')
  expect(paths).toContain('/audio/music/victory.mp3')
})

test('every registered cue resolves and is real audio', async ({ request }) => {
  const missing = []
  const empty = []

  for (const path of registeredAudioPaths()) {
    const res = await request.get(path)
    if (res.status() !== 200) {
      missing.push(`${path} -> HTTP ${res.status()}`)
      continue
    }
    const body = await res.body()
    // A dev server can answer 200 with the SPA's index.html for an unknown path,
    // so a status check alone would not prove the file exists.
    if (body.length < 1024) empty.push(`${path} -> ${body.length} bytes`)
    else if (body.slice(0, 5).toString('utf8').includes('<')) {
      missing.push(`${path} -> served HTML, not audio`)
    }
  }

  expect(missing, 'registered cues that do not resolve').toEqual([])
  expect(empty, 'registered cues that resolve but are suspiciously small').toEqual([])
})

test('the one-shot cues are a sane length for a screen transition', async ({ request }) => {
  // Long enough to land, short enough not to outstay the outcome screen.
  for (const path of ['/audio/music/victory.mp3', '/audio/music/gameover.mp3']) {
    const res = await request.get(path)
    const bytes = (await res.body()).length
    // ~96 kbps mono => ~12 KB/s. 8s..45s.
    expect(bytes, `${path} too short`).toBeGreaterThan(90_000)
    expect(bytes, `${path} too long`).toBeLessThan(560_000)
  }
})
