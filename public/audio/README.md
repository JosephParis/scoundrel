# Audio assets

Drop files here and they play with no code change. The registry lives in
`src/games/scoundrel/audio.js`; filenames below must match exactly. Until a
file exists its cue stays silent (the loader fails quietly), so the game runs
fine with this folder empty.

Prefer `.mp3` (broadest browser support). Keep music loops seamless and SFX
short. Source from clean-license libraries: FreePD (CC0), Pixabay (no
attribution), or Incompetech (CC-BY, add a credit in the Credits modal).

## Music (`/audio/music/`)

Keyed to game phase, so the right bed plays automatically.

| File            | When it plays           | Loop |
| --------------- | ----------------------- | ---- |
| `sanctuary.mp3` | Between descents        | yes  |
| `descent.mp3`   | In the dungeon          | yes  |
| `victory.mp3`   | Win screen              | no   |
| `gameover.mp3`  | Death screen            | no   |

## SFX (`/audio/sfx/`)

Played via `audio.sfx('<id>')`. All of these are wired into gameplay.

| File            | id         | Fires on                                  |
| --------------- | ---------- | ----------------------------------------- |
| `card-flip.mp3` | `cardFlip` | Oath face-down flip, wasted potion, skips |
| `equip.mp3`     | `equip`    | Taking up a weapon                        |
| `hit.mp3`       | `hit`      | Fighting a monster (swing or bare hands)  |
| `heal.mp3`      | `heal`     | Drinking an effective potion              |
| `flee.mp3`      | `flee`     | Fleeing the room                          |
| `sigil.mp3`     | `sigil`    | Earning a sigil (winning a descent)       |
| `boon.mp3`      | `boon`     | Picking a boon                            |
| `forge.mp3`     | `forge`    | Applying a forge edit                     |
| `descend.mp3`   | `descend`  | Starting a descent                        |
