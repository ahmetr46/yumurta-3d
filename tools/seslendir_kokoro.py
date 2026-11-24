# seslendir_kokoro.py — offline narration (Kokoro-82M ONNX) with documentary pacing, for when edge-tts can't be reached.
#   python tools/seslendir_kokoro.py stories/<name> [--voice=am_michael:.6,am_onyx:.4] [--speed=.9] [--para=.8] [--sect=2.0]
# Model files: KOKORO_DIR (default /home/claude/tts) holds kokoro-v1.0.onnx and voices-v1.0.bin, from
#   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0   (pip install kokoro-onnx soundfile)
# script.txt: a blank line ends a paragraph (pause --para), a line holding only "~" ends a section (pause --sect).
# Each sentence is spoken on its own; word times come from the sentence's span, split at its inner pauses (one per comma)
# and spread by phoneme count inside each piece (Kokoro gives no word boundaries; error is a few frames).
import sys, os, re, json, subprocess, pathlib
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = pathlib.Path(__file__).resolve().parent
args = dict(a.lstrip('-').split('=', 1) if '=' in a else (a.lstrip('-'), '1') for a in sys.argv[2:])
story = pathlib.Path(sys.argv[1]); vd = story / 'voice'
prev = json.load(open(vd / 'voice.json')) if (vd / 'voice.json').exists() else {}
VOICE = args.get('voice', prev.get('voice', 'am_michael:.6,am_onyx:.4'))
SPEED = float(args.get('speed', prev.get('speed', .9)))
PARA = float(args.get('para', prev.get('para', .8))); SECT = float(args.get('sect', prev.get('sect', 2.0)))
SENT, LEAD, TAIL = .42, .5, 1.0
D = os.environ.get('KOKORO_DIR', '/home/claude/tts')
k = Kokoro(f'{D}/kokoro-v1.0.onnx', f'{D}/voices-v1.0.bin')
style = sum(float(w) * k.get_voice_style(v) for v, w in (p.split(':') for p in VOICE.split(',')))
SR = 24000

def speech_runs(y, sr, thr_db=-38, min_sil=.09):
    hop = sr // 100; n = len(y) // hop
    db = 20 * np.log10(np.sqrt(np.mean(y[:n * hop].reshape(n, hop) ** 2, 1)) + 1e-9)
    loud = db > (np.percentile(db, 95) + thr_db)
    idx = np.where(loud)[0]
    if not len(idx): return 0, len(y) / sr, []
    a, b = idx[0], idx[-1] + 1
    sil, i = [], a
    while i < b:
        if not loud[i]:
            j = i
            while j < b and not loud[j]: j += 1
            if (j - i) * hop / sr >= min_sil: sil.append((i * hop / sr, j * hop / sr))
            i = j
        else: i += 1
    return a * hop / sr, b * hop / sr, sil

def weight(w):
    bare = re.sub(r"[^\w']", '', w)
    try: ph = k.tokenizer.phonemize(bare, 'en-us')
    except Exception: ph = bare
    return max(1, len(re.sub(r'[ˈˌː\s]', '', ph)))

src = open(vd / 'script.txt', encoding='utf-8').read().strip()
paras = [p.split() for p in re.split(r'\n\s*\n', src) if p.strip()]
out, words, t0 = [np.zeros(int(LEAD * SR), np.float32)], [], LEAD
for pi, pw in enumerate(paras):
    if pw == ['~']: continue
    sect = pi + 1 < len(paras) and paras[pi + 1] == ['~']
    sents, cur = [], []
    for w in pw:
        cur.append(w)
        if re.search(r'[.!?:]["”’)]*$', w): sents.append(cur); cur = []
    if cur: sents.append(cur)
    for si, sw in enumerate(sents):
        y, sr = k.create(' '.join(sw), voice=style, speed=SPEED, lang='en-us', trim=False)
        assert sr == SR
        a, b, sil = speech_runs(y, sr)
        commas = [i for i, w in enumerate(sw[:-1]) if re.search(r'[,;—–]["”’)]*$', w)]
        sil = sorted(sorted(sil, key=lambda s: s[0] - s[1])[:len(commas)])     # the longest inner pauses, in time order
        cuts = commas[:len(sil)] if len(sil) == len(commas) else []
        if len(sil) != len(commas): sil = []
        bounds = [a] + [x for s in sil for x in s] + [b]
        pieces, s0 = [], 0
        for c in cuts + [len(sw) - 1]: pieces.append(sw[s0:c + 1]); s0 = c + 1
        tw = []
        for pk, piece in enumerate(pieces):
            pa, pb = bounds[2 * pk], bounds[2 * pk + 1]
            ws = [weight(w) for w in piece]; tot = sum(ws); acc = 0
            for w, wt in zip(piece, ws):
                s = pa + (pb - pa) * acc / tot; acc += wt; e = pa + (pb - pa) * acc / tot
                tw.append({'word': w, 'start': s, 'end': e})
        seg = y[int(max(0, a - .03) * SR): int(min(len(y) / SR, b + .08) * SR)]
        off = t0 - max(0, a - .03)
        words += [{'word': w['word'], 'start': round(w['start'] + off, 3), 'end': round(w['end'] + off, 3)} for w in tw]
        last = si == len(sents) - 1
        gap = (SECT if sect else PARA) if last else SENT
        out += [seg, np.zeros(int(gap * SR), np.float32)]; t0 += (len(seg)) / SR + gap
    print(f'  para {pi + 1}/{len(paras)}: {len(pw)} words' + ('  [section]' if sect else ''), flush=True)
out[-1] = np.zeros(int(TAIL * SR), np.float32)
y = np.concatenate(out); y = y / max(1e-6, np.abs(y).max()) * .89
sf.write(str(vd / 'voice.wav'), y, SR, subtype='PCM_16')
dur = len(y) / SR
json.dump({'words': words, 'duration': round(dur, 3)}, open(vd / 'words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, str(HERE / 'zarf.py'), str(vd / 'voice.wav'), str(vd / 'env.json')], check=True, stdout=subprocess.DEVNULL)
json.dump({'engine': 'kokoro', 'voice': VOICE, 'speed': SPEED, 'para': PARA, 'sect': SECT}, open(vd / 'voice.json', 'w'), indent=1)
n = len([w for w in src.split() if w != '~'])
print(f'matched {len(words)}/{n} words | {dur:.2f}s, {n / dur:.2f} words/s')
