# seslendir.py — English narration from the script alone: TTS -> pause trim -> tempo -> words.json + env.json.
#   python tools/seslendir.py stories/<name> [--voice=en-US-AndrewNeural] [--rate=+0%] [--pitch=+0Hz] [--wps=3.7] [--tempo=auto]
# Reads   stories/<name>/voice/script.txt   (the exact words that are spoken and shown as captions)
# Writes  stories/<name>/voice/raw.mp3       the TTS take as it came
#         stories/<name>/voice/voice.wav     trimmed + sped-up take (what the video uses)
#         stories/<name>/voice/words.json    word times on the script's own spelling (from the TTS word boundaries, no Whisper)
#         stories/<name>/voice/env.json      lip-flap envelope (tools/zarf.py)
#         stories/<name>/voice/voice.json    the settings used, so a later run can repeat them
# The TTS is Microsoft Edge's neural voices (pip install edge-tts): free, no key. Measured pace of the style in English is
# 3.7 words/s; --tempo=auto picks the atempo (0.9-1.35) that lands there after the pauses are trimmed.
# Good narrator voices: en-US-AndrewNeural (warm male, default), en-US-GuyNeural, en-US-ChristopherNeural, en-US-BrianNeural,
# en-US-AriaNeural / en-US-JennyNeural / en-US-EmmaNeural (female), en-GB-RyanNeural (British). List all: edge-tts --list-voices
import sys, os, json, re, difflib, asyncio, subprocess, pathlib

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bosluk_kes as BK

args = dict(a.lstrip('-').split('=', 1) if '=' in a else (a.lstrip('-'), '1') for a in sys.argv[2:])
story = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__ or 'usage: seslendir.py stories/<name>')
vd = story / 'voice'; vd.mkdir(parents=True, exist_ok=True)
prev = json.load(open(vd / 'voice.json')) if (vd / 'voice.json').exists() else {}
VOICE = args.get('voice', prev.get('voice', 'en-US-AndrewNeural'))
RATE = args.get('rate', prev.get('rate', '+0%'))
PITCH = args.get('pitch', prev.get('pitch', '+0Hz'))
WPS = float(args.get('wps', prev.get('wps', 3.7)))
TEMPO = args.get('tempo', prev.get('tempo', 'auto'))

text = open(vd / 'script.txt', encoding='utf-8').read().strip()
words = text.split()

# --- 1. TTS with word boundaries -----------------------------------------------------------------------------------
# edge-tts pins its own CA file; behind a TLS-inspecting proxy point it at the system bundle instead.
ca = os.environ.get('SSL_CERT_FILE') or os.environ.get('REQUESTS_CA_BUNDLE')
if ca and os.path.exists(ca):
    import certifi
    certifi.where = lambda: ca
import edge_tts

async def tts():
    c = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary='WordBoundary',
                             proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy'))
    audio, bounds = bytearray(), []
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary':
            bounds.append({'w': ch['text'], 's': ch['offset'] / 1e7, 'e': (ch['offset'] + ch['duration']) / 1e7})
    return bytes(audio), bounds

for attempt in range(4):
    try:
        audio, heard = asyncio.run(tts()); break
    except Exception as e:
        if attempt == 3: raise
        print('TTS retry:', e)
(vd / 'raw.mp3').write_bytes(audio)
print(f'TTS {VOICE} rate {RATE}: {len(heard)} word boundaries, {heard[-1]["e"]:.2f}s')

# --- 2. boundaries -> the script's own words (same matching as kelime_saat.py) --------------------------------------
def norm(w): return re.sub(r"[^\w]", '', w.lower().replace('’', "'"))
A, B = [norm(w) for w in words], [norm(h['w']) for h in heard]
sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
times = [None] * len(words)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1): times[i1 + k] = (heard[j1 + k]['s'], heard[j1 + k]['e'])
    elif j2 > j1 and i2 > i1:     # e.g. "1,000" spoken as "one thousand": spread the heard span over the script words
        s, e = heard[j1]['s'], heard[j2 - 1]['e']
        n = i2 - i1
        for k in range(n): times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
for i, t in enumerate(times):
    if t is None:
        p = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
        n = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), p + .3)
        times[i] = (p, max(n, p + .05))
raw_words = [{'word': w, 'start': round(s, 3), 'end': round(e, 3)} for w, (s, e) in zip(words, times)]
same = sum(i2 - i1 for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag == 'equal')
diff = [(' '.join(words[i1:i2]), ' '.join(h['w'] for h in heard[j1:j2])) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal']
print(f'matched {same}/{len(words)} words', diff if diff else '')

# --- 3. trim pauses, pick tempo, write voice.wav + words.json --------------------------------------------------------
y = BK.load(str(vd / 'raw.mp3'))
out, keep = BK.trim(y, raw_words, verbose=False)
dur = len(out) / BK.SR
tempo = max(.9, min(1.35, WPS * dur / len(words))) if TEMPO == 'auto' else float(TEMPO)
BK.save(out, str(vd / 'voice.wav'), tempo)
res = BK.remap(raw_words, keep, tempo)
final = dur / tempo
json.dump({'words': res, 'duration': round(final, 3)}, open(vd / 'words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, str(HERE / 'zarf.py'), str(vd / 'voice.wav'), str(vd / 'env.json')], check=True,
               stdout=subprocess.DEVNULL)
json.dump({'voice': VOICE, 'rate': RATE, 'pitch': PITCH, 'wps': WPS, 'tempo': TEMPO}, open(vd / 'voice.json', 'w'), indent=1)

gaps = [(res[i]['word'], round(res[i + 1]['start'] - res[i]['end'], 2)) for i in range(len(res) - 1) if res[i + 1]['start'] - res[i]['end'] > .35]
print(f'raw {len(y) / BK.SR:.2f}s -> trimmed {dur:.2f}s -> x{tempo:.2f} = {final:.2f}s | {len(words)} words, '
      f'{len(words) / final:.2f} words/s (target {WPS}) | gaps>0.35: {gaps}')
print('OK', vd / 'voice.wav', vd / 'words.json', vd / 'env.json')
