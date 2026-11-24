# bosluk_kes.py — shorten the pauses in a voice take, then (optionally) speed it up.
#   python bosluk_kes.py <in.wav> <words.json> <out.wav> [tempo=1.0] [out_words.json]
# words.json = kelime_saat.py (or seslendir.py) output for <in.wav>; it tells which pause follows a sentence end, a comma or nothing.
# Pause targets (before tempo): sentence end .22 s, comma .14 s, inside a phrase .09 s. Lead-in .03 s.
# With [out_words.json] the word times are carried over to the new file (cuts + tempo), so no second alignment is needed.
import sys, json, subprocess
import numpy as np

SR = 24000
TARGET = {'lead': .03, 'end': .22, 'comma': .14, 'mid': .09}


def load(src):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                                        capture_output=True, check=True).stdout, np.float32).copy()


def trim(y, words, verbose=True):
    """Returns (shortened samples, keep segments [(a, b)] in input samples)."""
    hop = SR // 100   # 10 ms frames, silence = 40 dB under the loud speech level
    fr = np.sqrt(np.mean(y[:len(y) // hop * hop].reshape(-1, hop) ** 2, 1) + 1e-12)
    db = 20 * np.log10(fr)
    quiet = db < np.percentile(db, 95) - 40
    runs, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            runs.append((i * hop, min(j * hop, len(y)))); i = j
        else: i += 1

    def kind(t):      # punctuation of the last word that started before this pause
        w = [x for x in words if x['start'] < t]
        if not w: return 'lead'
        p = w[-1]['word'].rstrip('"\'”’)')
        return 'end' if p[-1:] in '.:?!' else 'comma' if p[-1:] in ',;—–' else 'mid'

    keep, cur, log = [], 0, []
    for a, b in runs:
        dur = (b - a) / SR
        k = 'lead' if a == 0 else 'tail' if b >= len(y) - hop else kind((a + b) / 2 / SR)
        tgt = .30 if k == 'tail' else TARGET[k]
        if dur <= tgt + .02: continue
        h = int(tgt * SR / 2)
        cut_a, cut_b = (a, b - int(tgt * SR)) if k == 'lead' else (a + h, b - h) if k != 'tail' else (a + int(tgt * SR), b)
        keep.append((cur, cut_a)); cur = cut_b
        log.append((round(a / SR, 2), round(dur, 2), k, round(tgt, 2)))
    keep.append((cur, len(y)))
    keep = [(a, b) for a, b in keep if b > a]

    # join with 8 ms crossfades (all joins sit inside silence, so this only guards against clicks)
    xf = int(.008 * SR); out = y[keep[0][0]:keep[0][1]].copy()
    for a, b in keep[1:]:
        seg = y[a:b].copy()
        if len(out) > xf and len(seg) > xf:
            r = np.linspace(0, 1, xf, dtype=np.float32)
            out[-xf:] = out[-xf:] * (1 - r) + seg[:xf] * r; seg = seg[xf:]
        out = np.concatenate([out, seg])
    if verbose:
        for l in log: print('pause at %6.2fs  %.2fs (%s) -> %.2fs' % l)
        print('length %.2fs -> %.2fs' % (len(y) / SR, len(out) / SR))
    return out, keep


def remap(words, keep, tempo=1.0):
    """Carry word times from the input file to the trimmed + sped-up file."""
    xf = int(.008 * SR)
    starts, acc = [], 0
    for i, (a, b) in enumerate(keep):
        starts.append(acc); acc += (b - a) - (xf if i else 0)

    def m(t):
        s = t * SR
        for (a, b), o in zip(keep, starts):
            if s < a: return o / SR / tempo                       # inside a cut: snap to the next kept part
            if s <= b: return (o + s - a) / SR / tempo
        return acc / SR / tempo
    return [{**w, 'start': round(m(w['start']), 3), 'end': round(m(w['end']), 3)} for w in words]


def save(out, dst, tempo=1.0):
    af = ['-af', f'atempo={tempo}'] if abs(tempo - 1.0) > 1e-3 else []
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', *af,
                    '-c:a', 'pcm_s16le', dst], input=out.astype(np.float32).tobytes(), check=True)


if __name__ == '__main__':
    src, wj, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    tempo = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    words = json.load(open(wj, encoding='utf-8'))['words']
    out, keep = trim(load(src), words)
    save(out, dst, tempo)
    print('tempo x%.2f -> %.2fs' % (tempo, len(out) / SR / tempo))
    if len(sys.argv) > 5:
        res = remap(words, keep, tempo)
        json.dump({'words': res, 'duration': round(len(out) / SR / tempo, 3)}, open(sys.argv[5], 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print('words ->', sys.argv[5])
