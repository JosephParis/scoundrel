#!/usr/bin/env bash
#
# Build the two one-shot music cues from public-domain bell recordings.
#
#   public/audio/music/gameover.mp3  a slow funeral toll  (a knell)
#   public/audio/music/victory.mp3   a full peal
#
# Both cues are committed, so this is an authoring tool: it exists to record
# provenance and to make the result reproducible/tweakable, not to run in CI.
#
#   bash scripts/build-bell-cues.sh
#
# Sources, both released into the public domain on Wikimedia Commons:
#   Gong or bell vibrant  by Stephan  -- isolated strikes with ~5s gaps
#   Churchbells           by Natalie  -- a continuous peal
#
# Why these two: a funeral toll is one bell struck slowly with long gaps between
# strikes, whereas a peal is many bells rung continuously. The first recording
# gives a clean isolated strike with its full decay; the second is already a
# peal. So death gets the toll the game is named after, and victory gets the
# bells rung in celebration.
set -euo pipefail

cd "$(dirname "$0")/.."

FF="node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"
[ -x "$FF" ] || FF="$(command -v ffmpeg)"
OUT="public/audio/music"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

UA="ScoundrelGameDev/1.0 (+https://github.com/JosephParis/scoundrel)"
fetch() {
  echo "fetching $2"
  curl -fsSL -A "$UA" -o "$WORK/$2" "$1"
}

fetch "https://upload.wikimedia.org/wikipedia/commons/f/fa/Gong_or_bell_vibrant.ogg" gong.ogg
fetch "https://upload.wikimedia.org/wikipedia/commons/e/e4/Churchbells.ogg" peal.ogg

# --- death: a knell ---------------------------------------------------------
# Lift the first strike (0 -> 8.4s) with its whole decay, then sound it three
# times at 4.6s intervals. The spacing is shorter than the decay on purpose, so
# each toll bleeds into the next the way a real bell tower does rather than
# reading as three pasted samples. Pitched down to 0.9 tape-style, which deepens
# and lengthens it together: a bigger bell, not a processed one.
"$FF" -y -loglevel error -i "$WORK/gong.ogg" -ss 0 -t 8.4 -ac 1 -ar 44100 "$WORK/strike.wav"

"$FF" -y -loglevel error \
  -i "$WORK/strike.wav" -i "$WORK/strike.wav" -i "$WORK/strike.wav" \
  -filter_complex "\
[0:a]asetrate=44100*0.9,aresample=44100,adelay=0[a0];\
[1:a]asetrate=44100*0.9,aresample=44100,adelay=4600[a1];\
[2:a]asetrate=44100*0.9,aresample=44100,adelay=9200[a2];\
[a0][a1][a2]amix=inputs=3:duration=longest[mix];\
[mix]afade=t=out:st=13.5:d=4.5,loudnorm=I=-18:TP=-2:LRA=11[out]" \
  -map "[out]" -t 18 -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k \
  "$OUT/gameover.mp3"

# --- victory: a peal --------------------------------------------------------
# A window from the middle of the recording, past the first strikes and before it
# winds down. Short fade in so it does not click, long fade out so the screen is
# not left in sudden silence.
"$FF" -y -loglevel error -i "$WORK/peal.ogg" -ss 6 -t 16 \
  -af "afade=t=in:st=0:d=0.8,afade=t=out:st=12:d=4,loudnorm=I=-18:TP=-2:LRA=11" \
  -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k \
  "$OUT/victory.mp3"

# Mono at 96k: these are one-shots behind a UI screen, and issue 16 is trimming
# an audio payload that was over 30MB.
ls -la "$OUT/gameover.mp3" "$OUT/victory.mp3"
