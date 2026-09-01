---
id: 32
title: "The two music beds are 15MB of the 16MB audio payload, at 320 and 256 kb/s"
priority: P3
area: performance
effort: M
status: open
---

## Problem

Issue 16 halved the audio payload by removing byte-identical duplicates. What it
did not touch is the remaining cost, which is two files:

| File | Size | Duration | Encoding |
|---|---|---|---|
| `public/audio/music/descent.mp3` | 7.44 MB | 3:03 | **320 kb/s stereo**, 48 kHz |
| `public/audio/music/sanctuary.mp3` | 7.69 MB | 3:55 | **256 kb/s stereo**, 44.1 kHz |
| `public/audio/music/victory.mp3` | 0.19 MB | 0:15 | 96 kb/s mono |
| `public/audio/music/gameover.mp3` | 0.09 MB | 0:07 | **96 kb/s mono** |

`public/audio` is 16MB; music is 15MB of it and those two files are 15MB of
that. `dist-itch.zip` is 15.1MB for the same reason.

The house standard is already set: the two cues added for issue 03 are 96 kb/s
mono. The beds are 3x that and were simply never brought in line.

Both files also carry an embedded 1425x1425 mjpeg cover art stream — album art,
shipped to every player, decoded by nobody.

## Why it matters

- Howler is on Web Audio here with no `html5: true`
  (`src/games/scoundrel/audio.js:208`), so a bed is **downloaded in full before
  it plays**. The descent bed's 7.4MB fetch starts at the moment the player
  descends, which on cellular is a long silence at the exact beat the music is
  supposed to land.
- It is ~15MB per session of bandwidth for a game whose entire JS is 284KB.
- It is the whole weight of the itch standalone build, which plays inside an
  iframe on someone else's page.

## Suggested fix

Transcode both beds to the standard the cues already use, and strip the art:

```bash
# ffmpeg is already a devDependency: @ffmpeg-installer/ffmpeg
ffmpeg -i descent.mp3 -map 0:a -ac 1 -b:a 96k -ar 44100 descent.out.mp3
```

`-map 0:a` drops the cover art. Expect roughly 7.4MB -> ~2.2MB and 7.7MB ->
~2.8MB; the whole payload lands near 5MB.

Listen to the result on a phone speaker before committing — these are ambient
beds under sound effects, which is the most forgiving case for a low bitrate,
but mono is a real change and the call is a listening one, not a numeric one.

Worth deciding at the same time, and cheap once you are in the file:

- **`html5: true` for music only.** Streams instead of buffering the whole file,
  so playback starts immediately regardless of size. The trade is that HTML5
  Audio does not fade as smoothly as Web Audio and the crossfades here are
  deliberate — try it, keep it only if the fades survive.
- A `scripts/` entry for the transcode, so the next bed added does not arrive at
  320 kb/s. `scripts/build-bell-cues.sh` is the precedent.

## Acceptance criteria

- [ ] Both beds at the project's standard bitrate, art stream removed
- [ ] `public/audio` under ~6MB total
- [ ] The beds still loop seamlessly and the crossfades still sound intentional
- [ ] `visual/audio-assets.spec.js` and `visual/robots-and-payload.spec.js` green,
      with the payload budget in the latter updated to the new figure
- [ ] Whether `html5: true` was adopted for music is recorded here either way
- [ ] `npm run build:itch` regenerated if the zip is meant to stay current
