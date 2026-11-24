#!/usr/bin/env bash
# paralel_render.sh — full-size render in N parallel chunks (CPU capture), then one mp4 with the story's mix.wav.
#   bash tools/paralel_render.sh <story> [chunks=4]
set -euo pipefail
cd "$(dirname "$0")/.."
S="$1"; N="${2:-4}"
read FPS DUR NAME < <(python3 -c "import json;c=json.load(open('stories/$S/audio/cues.json'));print(c.get('FPS', 30), c['DUR'], '$S')")
FR=$(python3 -c "print(round($DUR*$FPS))")
OUT="stories/$S/out"; mkdir -p "$OUT"; : > "$OUT/parts.txt"
for i in $(seq 0 $((N-1))); do
  A=$(python3 -c "print($i*($FR//$N)/$FPS)"); B=$(python3 -c "print((($i+1)*($FR//$N) if $i<$N-1 else $FR)/$FPS)")
  (cd engine && node render.mjs "$S" --from=$A --to=$B --name=part$i > "../$OUT/part$i.log" 2>&1) &
  echo "file 'part$i.mp4'" >> "$OUT/parts.txt"
done
wait
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/parts.txt" -i "stories/$S/audio/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest "$OUT/$NAME.mp4"
mkdir -p ornek; cp "$OUT/$NAME.mp4" "ornek/$NAME.mp4"
echo "VIDEO: ornek/$NAME.mp4"
