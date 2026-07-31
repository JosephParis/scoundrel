---
id: 03
title: "victory.mp3 and gameover.mp3 are registered but do not exist"
priority: P0
area: content
effort: S
status: done
---

## Resolution

Both cues built from **public-domain** bell recordings on Wikimedia Commons, by
`scripts/build-bell-cues.sh` — it downloads the sources and does the editing, so
the result is reproducible and provenance lives in the repo rather than in a
memory.

The pairing follows from the game's new name. A **funeral toll** is one bell
struck slowly with long gaps; a **peal** is many bells rung continuously. So
death gets the toll the game is named for, and victory gets the bells rung in
celebration.

- **`gameover.mp3`** — "Gong or bell vibrant" by Stephan. That recording is
  isolated strikes separated by ~5s of silence, so the first strike lifts cleanly
  with its whole decay. Pitched down to 0.9 tape-style, which deepens and
  lengthens together: a bigger bell, not a processed one. **One strike, 7.3s.**
- **`victory.mp3`** — "Churchbells" by Natalie. Already a peal; a 16s window from
  the middle, faded in and out.

### Revision: one toll, not three (2026-07-31)

The first cut sounded the strike three times at 4.6s intervals over 18s. On the
death screen that played as a short piece of music to sit through rather than as
a death sound, so it is now a single toll. Two things changed with it:

- The cue is cut in **at the attack**. The source opens on 0.285s of room tone,
  which put the strike a beat behind the screen it punctuates.
- `gameover` opts out of the music crossfade (`fadeIn: false` in `MUSIC`, handled
  in `playMusic`). A 600ms fade-up turns a struck bell into a swell, which is
  most of the difference between a death sound and music. The outgoing descent
  bed still fades out underneath it.

Covered by `test/audio.test.js` (the fade opt-out, against a mocked Howler) and
by two tests in `visual/audio-assets.spec.js` that decode the file in-page and
assert a single onset at t=0 — the old three-toll cut fails every one of those
assertions independently, and the cue being *requested* as the death screen
appears is asserted end to end.

Both mono at 96 kbps (88 KB and 188 KB), which is the treatment issue 16 wants
for the rest of the audio.

`mourning-song.ogg` was the obvious candidate here and was **not** used — a bell
suited the name better. Issue 16 still covers removing it and the other
unreferenced sources.

### The real fix is the test

The bug was never "two files are missing" so much as **nothing could tell you**.
Howler's `onloaderror` sets `_scoundrelFailed` and every `play()` then returns
early — by design — so a missing cue is indistinguishable from a muted one.

`visual/audio-assets.spec.js` parses the paths **out of `audio.js`** rather than
hard-coding them, so it covers all 13 cues and any added later. It also asserts
the registry parsed at all, since a regex that silently stopped matching would
make every other assertion vacuously pass.

Verified by deleting `gameover.mp3` and re-running: 2 tests fail. That probe
exposed something worth keeping — the dev server answers a missing file with the
SPA's `index.html` at **HTTP 200**, so a status-code check alone would have passed.
The test checks the payload isn't HTML and isn't implausibly small.

`audio.js` now also warns in dev when a cue fails to load, so the next missing
file announces itself instead of going quiet.

## Problem

The music registry declares four cues; only two of the files exist. The win and
death screens — the two highest-emotion moments in a run — play silence.

## Evidence

`src/games/scoundrel/audio.js:54-57`:

```js
sanctuary: { src: '/audio/music/sanctuary.mp3', loop: true },   // exists
descent:   { src: '/audio/music/descent.mp3',   loop: true },   // exists
victory:   { src: '/audio/music/victory.mp3',   loop: false },  // MISSING
gameover:  { src: '/audio/music/gameover.mp3',  loop: false },  // MISSING
```

`public/audio/music/` contains only `sanctuary.mp3`, `descent.mp3`,
`dark-times.mp3`, `ossuary-5-rest.mp3`, `mourning-song.ogg`, `CREDITS.md`.

The failure is invisible: Howler's `onloaderror` sets `_scoundrelFailed` and the
cue is skipped silently, so nothing in the console or the UI flags it.

## Why it blocks batch 1

It reads as a polish failure exactly where you most want the player to feel
something, and because it fails silently you will not hear about it in
feedback — people just find the ending flat.

## Suggested fix

Source two Kevin MacLeod tracks (consistent with the existing CC BY 3.0
attribution in `public/audio/music/CREDITS.md`) — one short triumphant sting,
one somber. Both are one-shot (`loop: false`), so they can be short (15–30s),
which keeps the payload cost low. Add them to `CREDITS.md` with the same fields
as the existing entries.

Note `mourning-song.ogg` is already downloaded and documented as an unused
alternative — it is a plausible `gameover` candidate and needs no new sourcing,
only an OGG→MP3 conversion. See issue 16, which cleans up this directory.

Also worth adding: a dev-only warning when a registered cue fails to load, so the
next missing asset isn't silent too.

## Acceptance criteria

- [x] Both files exist in `public/audio/music/` and are served as real audio
- [~] **Not listened to.** I can build and measure these but not hear them — the win and death screens need a human ear before this is truly closed
- [x] Attribution added to `CREDITS.md` (public domain requires none; recorded anyway)
- [x] Each under 200 KB, mono 96 kbps — no meaningful first-load cost
- [x] A failed cue load logs a warning in dev builds
- [x] The death cue is a single toll that lands on the frame the screen turns
