---
id: 16
title: "~31MB of audio in public/, over half of it byte-identical duplicates"
priority: P3
area: performance
effort: S
status: open
---

## Problem

`public/audio/` is roughly 31 MB, and about 17 MB of that is dead weight served
to nobody.

## Evidence

`public/audio/music/CREDITS.md` documents the situation directly:

- **`sanctuary.mp3` is a copy of "Ossuary 5 - Rest"** — and
  `ossuary-5-rest.mp3` (7.69 MB) is still sitting next to it. Byte-identical
  sizes confirm it's a duplicate, not a re-encode.
- **`descent.mp3` is a copy of "Dark Times"** — `dark-times.mp3` (7.44 MB) is
  likewise still present.
- **`mourning-song.ogg` (1.67 MB)** is documented under "Alternative Track
  (available but not currently active)".

So ~15 MB is *literal duplication* of two files that are also present under their
gameplay names, plus 1.67 MB unused.

Everything in `public/` is copied verbatim into `dist/` and deployed, whether or
not any code references it.

## Why it matters

The two real tracks are ~7.5 MB each as loop music, which is very heavy for a
browser game — especially on mobile, where issue 04's PWA work is trying to make
this feel like an installable app. Combined with the missing victory/gameover
cues (issue 03), audio is both oversized and incomplete.

## Suggested fix

Two independent wins; do the first regardless.

**1. Delete the orphans** (~17 MB, zero risk):

- `public/audio/music/ossuary-5-rest.mp3` — duplicate of `sanctuary.mp3`
- `public/audio/music/dark-times.mp3` — duplicate of `descent.mp3`
- `public/audio/music/mourning-song.ogg` — unless issue 03 uses it for `gameover`,
  in which case convert it and keep the converted file only

Update `CREDITS.md`: keep the full attribution (CC BY 3.0 requires it) but stop
describing the deleted files as if they're present. Attribution stays even
though the source-named files go.

**2. Re-encode the two real tracks.** Ambient loop music does not need stereo at
high bitrate. Mono at ~96 kbps typically cuts these by 4–6× with no perceptible
loss in this context, taking ~15 MB to ~3 MB. Verify by ear at game volume before
committing.

Also consider whether music should be lazy-loaded rather than sitting in the
initial payload — `audio.js` already handles load failure gracefully via
`_scoundrelFailed`, so a deferred fetch is low-risk.

Combined effect: ~31 MB → under 5 MB.

## Acceptance criteria

- [ ] No unreferenced audio files in `public/`
- [ ] `CREDITS.md` accurate, with CC BY 3.0 attribution intact for every track still used
- [ ] Total `public/audio/` under 5 MB
- [ ] Sanctuary and descent music still play correctly and sound acceptable at game volume
- [ ] `dist/` size drop recorded in the commit message
