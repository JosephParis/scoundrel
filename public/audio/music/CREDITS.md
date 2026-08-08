# Music Credits

## Looping tracks

By Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 3.0 License
http://creativecommons.org/licenses/by/3.0/

### Tracks Used

**Sanctuary** (plays between descents):
- "Ossuary 5 - Rest" by Kevin MacLeod
- From the album "Ossuary" (2015)
- Downloaded from: https://archive.org/details/Kevin-MacLeod_Ossuary_2015_FullAlbum

**Descent** (plays during dungeon runs):
- "Dark Times" by Kevin MacLeod  
- From the album "Darkness" (2014)
- ISRC: USUAN1100747
- Downloaded from: https://archive.org/details/Kevin-MacLeod_Darkness_2014_FullAlbum
- Description: Deeply troubling and somber, heavy on bass strings, dark and funereal

## One-shot cues

Both are built from public-domain bell recordings by
`scripts/build-bell-cues.sh`, which downloads the sources and does the editing,
so the result is reproducible and the provenance is not just this file.

The pairing is deliberate: a funeral toll is a single bell struck slowly with
long gaps, while a peal is many bells rung continuously. Death gets the toll,
victory gets the bells rung in celebration.

(These were chosen while the game was briefly called Knell, after the tolling of
a bell for a death. The name did not survive; the bells did, on their own merits
— a struck bell is the right full stop for a run, whatever the game is called.)

**gameover.mp3** (death) — a single toll:
- Source: "Gong or bell vibrant" by Stephan
- Public domain (released worldwide by its author)
- From: https://commons.wikimedia.org/wiki/File:Gong_or_bell_vibrant.ogg
- Edit: one strike lifted with its decay, pitched down to 0.9 for weight, cut in
  at the attack (the recording opens on 0.285s of room tone) and faded out at 4.6s.
  7.3s, mono, 96 kbps.
- It is deliberately one strike and not a sequence: three tolls over 18s played
  as a short piece of music to wait out rather than a death sound. audio.js also
  starts this cue at full volume, since a fade-up would swallow the attack.

**victory.mp3** (escape) — a full peal:
- Source: "Churchbells" by Natalie
- Public domain (released worldwide by its author)
- From: https://commons.wikimedia.org/wiki/File:Churchbells.ogg
- Edit: a 16s window from the middle of the recording, faded in and out, mono,
  96 kbps.

Public domain imposes no attribution requirement; both are credited here anyway
so the provenance of every shipped asset is recorded in one place.

## Removed (issue 16)

Three files were shipped to every visitor and never played. Deleted 2026-08-08,
taking `public/audio/` from 32MB to 16MB:

- `dark-times.mp3` — **byte-identical** to `descent.mp3`. The same recording,
  kept under its original title as well as its in-game name. Credited above as
  the source of Descent; nothing was lost.
- `ossuary-5-rest.mp3` — **byte-identical** to `sanctuary.mp3`, same story.
- `mourning-song.ogg` — "Mourning Song" by Kevin MacLeod, from Wikimedia
  Commons. Considered for the death cue and not used; a struck bell suited it
  better. Recoverable from git history, or re-downloadable, if ever wanted.

Nothing referenced these — `audio.js` names only `sanctuary`, `descent`,
`victory` and `gameover` — so this is a pure payload cut with no behaviour
change. `visual/audio-assets.spec.js` parses the registry out of `audio.js`, so
it verifies what ships rather than a hard-coded list.
