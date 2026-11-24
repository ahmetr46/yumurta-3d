#!/usr/bin/env bash
# kur.sh — one-time setup for a fresh machine/container: engine npm packages + the TTS package.
set -e
cd "$(dirname "$0")/.."
[ -d engine/node_modules/puppeteer-core ] || (cd engine && npm install --no-fund --no-audit)
python3 -c "import edge_tts" 2>/dev/null || pip install -q edge-tts numpy
command -v ffmpeg >/dev/null || echo "ffmpeg missing: install it (apt-get install -y ffmpeg)"
echo "kur.sh: OK"
