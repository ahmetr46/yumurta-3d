#!/usr/bin/env bash
# uret.sh — from a finished story.js to the final video: cues -> sound mix -> full render -> ornek/<name>.mp4
#   bash tools/uret.sh <story> [--scale=0.5]      (--scale=0.5 = fast draft)
set -euo pipefail
cd "$(dirname "$0")/.."
S="${1:?usage: tools/uret.sh <story> [--scale=0.5]}"; shift || true
[ -f "stories/$S/voice/voice.wav" ] || { echo "no voice: run  python3 tools/seslendir.py stories/$S"; exit 1; }
(cd engine && node render.mjs "$S" --cues)
python3 engine/audio/mix.py "stories/$S"
(cd engine && node render.mjs "$S" "$@")
mkdir -p ornek
F=$(ls -t "stories/$S/out/"*.mp4 | grep -v _video.mp4 | head -1)
cp "$F" "ornek/$(basename "$F")"
echo "VIDEO: ornek/$(basename "$F")"
