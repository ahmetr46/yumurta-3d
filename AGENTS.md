# AGENTS.md

This repository is a skill for making vertical story Shorts in the "egg-head" style (three.js + Canvas 2D + puppeteer frame capture).

Before doing anything, read `SKILL.md` and follow it step by step. It holds the whole workflow, the rules and the known pitfalls.
Then read `STIL_KITABI.md` and the report in `analiz/` for whatever you are about to build.

- The sample story is `stories/is-odasi/` (finished video: `ornek/is-odasi.mp4`). Copy it to start a new story.
- New stories go in `stories/<name>/`. The user gives only the scenario; narration is English and generated with `python3 tools/seslendir.py stories/<name>` (see `CLAUDE.md` for the full scenario-to-video steps).
- Setup: `bash tools/kur.sh` (engine npm packages + edge-tts), ffmpeg and Chrome/Chromium (or set `CHROME_PATH`).
- Reply to the user in their language (usually Turkish).
