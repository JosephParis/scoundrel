---
id: 03
title: "victory.mp3 and gameover.mp3 are registered but do not exist"
priority: P0
area: content
effort: S
status: open
---

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

- [ ] Both files exist in `public/audio/music/` and play on their screens
- [ ] Attribution added to `CREDITS.md`
- [ ] Each new file is small enough not to regress first load (see issue 16)
- [ ] A failed cue load logs a warning in dev builds
