# doc_voice.py — documentary pacing for seslendir.py (--doc): one TTS take per paragraph, each trimmed with calm pause
# targets, joined with a real pause between paragraphs (--para, s) and a longer one at a section break (a line "~", --sect).
# Writes the same files as seslendir.py: raw.mp3 is skipped, voice.wav / words.json / env.json / voice.json.
import json, re, difflib, subprocess, sys, pathlib, tempfile
import numpy as np
import bosluk_kes as BK

CALM = {'lead': .03, 'end': .42, 'comma': .2, 'mid': .1}

def norm(w): return re.sub(r"[^\w]", '', w.lower().replace('’', "'"))

def align(words, heard):
    A, B = [norm(w) for w in words], [norm(h['w']) for h in heard]
    sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
    times = [None] * len(words)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1): times[i1 + k] = (heard[j1 + k]['s'], heard[j1 + k]['e'])
        elif j2 > j1 and i2 > i1:
            s, e = heard[j1]['s'], heard[j2 - 1]['e']; n = i2 - i1
            for k in range(n): times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    for i, t in enumerate(times):
        if t is None:
            p = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            n = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), p + .3)
            times[i] = (p, max(n, p + .05))
    same = sum(i2 - i1 for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag == 'equal')
    return [{'word': w, 'start': round(s, 3), 'end': round(e, 3)} for w, (s, e) in zip(words, times)], same

def run(vd, paras, take, VOICE, RATE, PITCH, PARA, SECT):
    BK.TARGET.update(CALM)
    out, allw, same, total, t0 = [], [], 0, 0, 0.0
    lead = np.zeros(int(.4 * BK.SR), np.float32); out.append(lead); t0 = len(lead) / BK.SR
    for pi, p in enumerate(paras):
        lines = p.split()
        if lines == ['~']: continue
        sect = any(l.strip() == '~' for l in p.splitlines()) or (pi + 1 < len(paras) and paras[pi + 1].split() == ['~'])
        ws = [w for w in lines if w != '~']
        audio, heard = take(' '.join(ws))
        with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
            f.write(audio); f.flush(); y = BK.load(f.name)
        rw, sm = align(ws, heard); same += sm; total += len(ws)
        seg, keep = BK.trim(y, rw, verbose=False)
        rw = BK.remap(rw, keep, 1.0)
        # cut the tail silence to the last word's end + 60 ms
        endS = min(len(seg), int((rw[-1]['end'] + .06) * BK.SR)); seg = seg[:endS]
        allw += [{**w, 'start': round(w['start'] + t0, 3), 'end': round(w['end'] + t0, 3)} for w in rw]
        gap = np.zeros(int((SECT if sect else PARA) * BK.SR), np.float32)
        out += [seg, gap]; t0 += (len(seg) + len(gap)) / BK.SR
        print(f'  para {pi + 1}/{len(paras)}: {len(ws)} words, {len(seg) / BK.SR:.2f}s' + ('  [section]' if sect else ''), flush=True)
    y = np.concatenate(out[:-1] + [np.zeros(int(.8 * BK.SR), np.float32)])
    BK.save(y, str(vd / 'voice.wav'), 1.0)
    final = len(y) / BK.SR
    json.dump({'words': allw, 'duration': round(final, 3)}, open(vd / 'words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    here = pathlib.Path(__file__).resolve().parent
    subprocess.run([sys.executable, str(here / 'zarf.py'), str(vd / 'voice.wav'), str(vd / 'env.json')], check=True, stdout=subprocess.DEVNULL)
    json.dump({'voice': VOICE, 'rate': RATE, 'pitch': PITCH, 'doc': 1, 'para': PARA, 'sect': SECT}, open(vd / 'voice.json', 'w'), indent=1)
    print(f'matched {same}/{total} words | {final:.2f}s, {total / final:.2f} words/s')
    print('OK', vd / 'voice.wav', vd / 'words.json', vd / 'env.json')
    return 0
