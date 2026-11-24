# CLAUDE.md — yumurta-3d

This repo makes vertical story Shorts in the "egg-head" style (three.js world + Canvas 2D characters + puppeteer frame capture).
It is the `yumurta-stili` kit, set up so that **the user only sends a scenario** and gets back a finished video with **English narration**.

Read `SKILL.md` first (whole workflow, rules, pitfalls), then `STIL_KITABI.md` and the `analiz/` report for whatever you build.
Reply to the user in Turkish. The narration, captions and on-screen words are English.

## When the user sends a scenario

The scenario may be Turkish or English, a paragraph or a rough list of beats. Do everything else yourself:

1. **Setup (fresh container):** `bash tools/kur.sh` (npm packages, edge-tts; skips what is already there).
2. **Name and folder:** a short kebab-case name, `stories/<name>/`. Copy `stories/is-odasi/story.js` as the starting point.
3. **Facts:** check every claim (SKILL.md rules); write facts and sources at the top of `stories/<name>/SCRIPT.md`. If a number is disputed, don't state it.
4. **English script:** shape the scenario into the beats in SKILL.md step 3 (hook, "You see," setup, someone laughs, escalation, everyday analogy, payoff), 30-65 s at 3.7 words/s (≈110-240 words). Write it to `stories/<name>/voice/script.txt` exactly as spoken (numbers in words). Put the user's original and the English text side by side in `SCRIPT.md`. Don't ask for approval of the script unless the scenario is too vague to tell what happens; just say what you changed.
5. **Voice:** `python3 tools/seslendir.py stories/<name>` → `voice.wav`, `words.json`, `env.json`. Must print `matched N/N words`. Default voice `en-US-AndrewNeural`; use another only if the user asks (`--voice=...`, see the list at the top of `tools/seslendir.py`).
6. **story.js:** sets, cast, light, camera, every event pinned to words with `W('word', n)` (SKILL.md step 5). `export const LOOK` and check faces: `cd engine && node faces.mjs <name>`.
7. **Stills, then draft:** `cd engine && node render.mjs <name> --stills=... --scale=0.5`, look at them against the checklist in SKILL.md step 6, fix, repeat.
8. **Final:** `bash tools/uret.sh <name>` (cues → sound mix → full render → `ornek/<name>.mp4`). It is slow without a GPU (minutes per 10 s of video at full size), so run it in the background; draft with `--scale=0.5`.
9. **Deliver:** send `ornek/<name>.mp4` (and a stills sheet) to the user with SendUserFile; commit `stories/<name>/` (incl. `voice/voice.wav`) and `ornek/<name>.mp4` on the working branch and push.

## Notes for this environment

- Chromium is at `/opt/pw-browsers/chromium` (already in `engine/chrome.mjs`); `CHROME_PATH` still overrides.
- edge-tts goes through the HTTPS proxy; `seslendir.py` points it at `SSL_CERT_FILE` automatically.
- Whisper (`tools/kelime_saat.py`, torch) is only needed if the user brings their own recording.
