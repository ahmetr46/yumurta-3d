#!/usr/bin/env bash
# paralel_render.sh — full-size render in short segments on N parallel workers (CPU capture), then one mp4 with mix.wav.
# Resumable: a finished segment (out/seg/sNNN.mp4) is skipped, so after a crash or a container restart just run it again.
#   bash tools/paralel_render.sh <story> [workers=4] [segment seconds=10]
set -euo pipefail
cd "$(dirname "$0")/.."
S="$1"; N="${2:-4}"; SEG="${3:-10}"
read FPS DUR < <(python3 -c "import json;c=json.load(open('stories/$S/audio/cues.json'));print(c.get('FPS', 30), c['DUR'])")
OUT="stories/$S/out"; D="$OUT/seg"; mkdir -p "$D"
python3 - "$FPS" "$DUR" "$SEG" > "$D/list.txt" <<'PY'
import sys
fps, dur, seg = int(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
fr, step = round(dur * fps), round(seg * fps)
for i, a in enumerate(range(0, fr, step)):
    b = min(fr, a + step); print(f"{i:03d} {a / fps!r} {b / fps!r}")
PY
one() {   # one segment: render silent video to a temp name, rename when complete
  local i=$1 a=$2 b=$3
  [ -s "$D/s$i.mp4" ] && return 0
  (cd engine && node render.mjs "$S" --from=$a --to=$b --name=seg_tmp_$i > "../$D/s$i.log" 2>&1)
  local f="$OUT/seg_tmp_$i.mp4"; [ -f "$OUT/seg_tmp_${i}_video.mp4" ] && f="$OUT/seg_tmp_${i}_video.mp4"
  ffmpeg -y -loglevel error -i "$f" -map 0:v:0 -c copy "$D/s$i.part.mp4" && mv "$D/s$i.part.mp4" "$D/s$i.mp4" && rm -f "$OUT/seg_tmp_$i"*.mp4
}
export -f one; export S D OUT
xargs -P "$N" -L 1 bash -c 'one "$@"' _ < "$D/list.txt"
: > "$D/concat.txt"; while read i a b; do [ -s "$D/s$i.mp4" ] || { echo "missing segment $i"; exit 1; }; echo "file 's$i.mp4'" >> "$D/concat.txt"; done < "$D/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$D/concat.txt" -i "stories/$S/audio/mix.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest "$OUT/$S.mp4"
mkdir -p ornek; cp "$OUT/$S.mp4" "ornek/$S.mp4"
echo "VIDEO: ornek/$S.mp4"
