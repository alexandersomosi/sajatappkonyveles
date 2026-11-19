# hang_lepes.py - THE VOICE STEP of the onboarding video (one command):
#   python eszkoz/hang_lepes.py            voice every line of szoveg/sorok.json with the shared voice (../hang.json),
#                                          blind-check each line (2 transcriptions), re-take only wrong lines (max 2 more takes),
#                                          lay the lines out with the designed pauses -> hang/narracio.wav + hang/idozites.json
#   python eszkoz/hang_lepes.py --becsult  no API call: timing from a syllable-rate estimate + silent narration (preview)
# When OpenRouter refuses (402 / our own budget), it falls back to --becsult automatically and exits with code 3.
# Cost log: ../koltseg.jsonl (or_hang.py). Takes are cached in hang/cache/, so a re-run only pays for new/changed lines.
import json, os, re, subprocess, sys, unicodedata, wave
import numpy as np
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import or_hang as H

ROOT = H.ROOT
HANG_JSON = os.path.join(os.path.dirname(ROOT), "hang.json")
SOROK = os.path.join(ROOT, "szoveg", "sorok.json")
KI_IDOZITES = os.path.join(ROOT, "hang", "idozites.json")
KI_NARRACIO = os.path.join(ROOT, "hang", "narracio.wav")
KI_JELENTES = os.path.join(ROOT, "hang", "kiejtes.json")
ELO_S = 0.6                       # silence before the first line
UTO_S = 0.4                       # silence after the last line's own pause
MAX_HOSSZ_S = 110.0               # SPEC §26.7.1: 70-110 s
MAX_ATEMPO = 1.06                 # never faster than this (calm voice)
BECSULT_SZOTAG_S = 4.4            # syllables / s for the preview estimate (Charon, 2026-10-22: 4.41 in a slow style)
SR = 24000
CEL_LUFS, CEL_TP, CEL_LRA = -16.0, -1.5, 7.0   # ../hang.json "keveres"
LUFS_TURES = 0.3                  # accepted distance from CEL_LUFS
TP_KEVERES = -2.6                 # true-peak ceiling of the MIX (WAV): AAC encoding adds 0.3-0.9 dB to the peaks, and the
#                                   -1.5 dBTP limit of ../hang.json is measured in the FINISHED mp4 (same as the two guide videos)
MAX_UJRA = 2
SORVEG_TELJES = ", saying every word completely and clearly to its very last sound"
ALIAS = {"nav": {"nav", "náv", "návtól", "navtól"}, "dáp": {"dáp", "dap"}}
SZAMSZO = re.compile(r"^(egy|kettő|két|három|négy|öt|hat|hét|nyolc|kilenc|tíz|tizen|húsz|huszon|harminc|negyven|ötven|hatvan|"
                     r"hetven|nyolcvan|kilencven|száz|ezer)", re.I)


def betuk(s):
    return re.sub(r"[^a-záéíóöőúüű0-9]", "", unicodedata.normalize("NFC", s.lower()))


def szavak(s):
    return [w for w in re.split(r"[\s\-–—]+", unicodedata.normalize("NFC", s.lower())) if betuk(w)]


def hianyzo_szavak(vart, atiratok):
    """expected words missing from >= 2 of the transcripts (all of them when only 2); letters only, compounds tolerated"""
    hiany = []
    tomb = [betuk(t) for t in atiratok]
    for w in szavak(vart):
        b = betuk(w)
        if not b:
            continue
        if SZAMSZO.match(b) and all(re.search(r"\d", t) for t in atiratok):
            continue
        alias = set()
        for k, v in ALIAS.items():
            if b.startswith(k):
                alias = {a + b[len(k):] for a in v}
        jo = sum(1 for t in tomb if b in t or any(a in t for a in alias))
        if len(atiratok) - jo >= min(2, len(atiratok)):
            hiany.append(w)
    return hiany


def stilus(hj, hangulat, take):
    s = hj["alap_stilus"]
    if hangulat and hangulat in hj.get("hangulatok", {}):
        s += ", " + hj["hangulatok"][hangulat]
    if take > 1:
        s += f", take {take}" + SORVEG_TELJES
    return s + ". " + hj["nativ_vege"]


def kimondott(sor):
    return sor.get("tts") or re.sub(r"\s*\|\s*", " ", sor["szoveg"]).strip()


def olvas_wav(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def ir_wav(p, x, sr=SR):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    y = np.clip(x * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(y.tobytes())


def burkolo(x, ablak=0.02):
    n = int(SR * ablak)
    m = len(x) // n
    return np.sqrt(np.mean(x[: m * n].reshape(m, n) ** 2, axis=1) + 1e-12)


def vag(x, kuszob_db=-42.0, rahagy=0.06, tartos=3, burst_s=0.2):
    """trim leading/trailing silence; 20 ms frames.
    The START is the first run of `tartos` loud frames, moved back to the earliest loud frame within `burst_s` before it
    (the burst of a plosive: the K of "Kezdjük" is one frame, 80 ms before its vowel). A loud frame further away is a click:
    every take starts with one, and in L05 and L21 it was above the threshold, 0.3 s before the voice, so the caption led
    the voice (2026-11-19). The END keeps the last loud frame however short it is (a word's last sound is never cut)."""
    e = 20 * np.log10(burkolo(x))
    hangos = e > kuszob_db
    hang = np.where(hangos)[0]
    if len(hang) == 0:
        return x
    kezd = next((i for i in hang if i + tartos <= len(hangos) and hangos[i: i + tartos].all()), hang[0])
    kezd = min(i for i in hang if i <= kezd and (kezd - i) * 0.02 <= burst_s)
    a = max(0, int((kezd * 0.02 - rahagy) * SR))
    b = min(len(x), int(((hang[-1] + 1) * 0.02 + rahagy) * SR))
    y = x[a:b].copy()
    f = int(0.008 * SR)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y


def belso_csendek(x, min_s=0.12, kuszob_db=-38.0):
    """[(start_s, end_s)] of internal pauses (for caption splits)"""
    e = 20 * np.log10(burkolo(x))
    csend = e < kuszob_db
    ki, i = [], 0
    while i < len(csend):
        if csend[i]:
            j = i
            while j < len(csend) and csend[j]:
                j += 1
            if (j - i) * 0.02 >= min_s and i > 0 and j < len(csend):
                ki.append((i * 0.02, j * 0.02))
            i = j
        else:
            i += 1
    return ki


def cue_reszek(sor):
    return [c.strip() for c in sor["szoveg"].split("|") if c.strip()]


def cue_idok(reszek, hossz, csendek):
    """split a line of `hossz` seconds into len(reszek) cues: char-proportional, snapped to the nearest internal pause"""
    n = len(reszek)
    if n == 1:
        return [(0.0, hossz)]
    ossz = sum(len(r) for r in reszek)
    hatarok, acc = [], 0
    for r in reszek[:-1]:
        acc += len(r)
        cel = hossz * acc / ossz
        jelolt = [(abs((a + b) / 2 - cel), (a + b) / 2) for a, b in csendek if abs((a + b) / 2 - cel) < 1.2]
        hatarok.append(min(jelolt)[1] if jelolt else cel)
    hatarok = sorted(hatarok)
    pontok = [0.0] + hatarok + [hossz]
    return [(pontok[i], pontok[i + 1]) for i in range(n)]


def szotag(t):
    return len(re.findall(r"[aáeéiíoóöőuúüű]", t.lower()))


def mert_hang(p):
    """(integrated loudness LUFS, true peak dBTP) of an audio or video file, measured with ffmpeg ebur128"""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return (float(re.findall(r"I:\s*(-?[\d.]+) LUFS", r.stderr)[-1]), float(re.findall(r"Peak:\s*(-?[\d.]+) dBFS", r.stderr)[-1]))


def mert_lufs(p):
    """integrated loudness (LUFS) of an audio or video file, measured with ffmpeg ebur128"""
    return mert_hang(p)[0]


def hangosit(be, ki, tp=TP_KEVERES):
    """be -> ki (48 kHz MONO) at CEL_LUFS, true peak <= tp. Two-pass loudnorm (measure, then apply with the measured
    values), then a true-peak limiter at `tp` (4x oversampled) - the same chain as the two guide videos, so all three play
    at the same level (2026-11-19, 2nd review round: this video was 3 dB quieter per channel). Checked with ebur128; while
    the result is more than LUFS_TURES off, the loudnorm target is moved by the difference and the passes run again
    (the limiter takes 0.3-0.4 LU; the single-pass form landed at -16.9 LUFS on 2026-11-19). -> (LUFS, dBTP)"""
    cel = CEL_LUFS
    hatar = 10 ** (tp / 20.0)
    limiter = f"aresample=192000,alimiter=level_in=1:level_out=1:limit={hatar:.4f}:attack=5:release=50:asc=0:level=0"
    for _ in range(5):
        alap = f"loudnorm=I={cel:.2f}:TP={CEL_TP}:LRA={CEL_LRA}"
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", be, "-af", alap + ":print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
        m = json.loads(r.stderr[r.stderr.rindex("{"): r.stderr.rindex("}") + 1])
        af = (alap + f":measured_I={m['input_i']}:measured_LRA={m['input_lra']}:measured_TP={m['input_tp']}"
              f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", be, "-af", af + "," + limiter, "-ar", "48000", "-ac", "1",
                        "-c:a", "pcm_s16le", ki], check=True)
        mert, csucs = mert_hang(ki)
        if abs(mert - CEL_LUFS) <= LUFS_TURES:
            break
        cel += CEL_LUFS - mert
    return mert, csucs


def becsult_idozites(d, ok):
    sorok, t = [], ELO_S
    for s in d["sorok"]:
        hossz = max(1.2, szotag(kimondott(s)) / BECSULT_SZOTAG_S)
        reszek = cue_reszek(s)
        cues = [dict(szoveg=r, start=round(t + a, 3), end=round(t + b, 3)) for r, (a, b) in zip(reszek, cue_idok(reszek, hossz, []))]
        sorok.append(dict(id=s["id"], jelenet=s["jelenet"], start=round(t, 3), end=round(t + hossz, 3), cues=cues))
        t += hossz + s.get("szunet_utana", d["szunet_utana_alap"])
    ossz = round(t + UTO_S, 3)
    ir_wav(KI_NARRACIO, np.zeros(int(ossz * SR), dtype=np.float32))
    ki = dict(becsult=True, ok=ok, hossz=ossz, atempo=1.0, sorok=sorok, verzio=d.get("verzio"))
    json.dump(ki, open(KI_IDOZITES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return ki


def main():
    d = json.load(open(SOROK, encoding="utf-8"))
    if "--becsult" in sys.argv:
        ki = becsult_idozites(d, "kézi --becsult")
        print(f"BECSÜLT időzítés (néma): {ki['hossz']} s -> {KI_IDOZITES}")
        return 0
    hj = json.load(open(HANG_JSON, encoding="utf-8"))
    hang = hj["hang"]
    jelentes, klipek = [], {}
    try:
        for s in d["sorok"]:
            szoveg = kimondott(s)
            legjobb = None
            for take in range(1, MAX_UJRA + 2):
                raw = H.tts(szoveg, hang, stilus(hj, s.get("hangulat"), take), tag=f"{s['id']}_t{take}",
                            becsult_mp=szotag(szoveg) / 4.0 + 1)
                wav = H.pcm_wav(raw, os.path.join(ROOT, "hang", "sorok", f"{s['id']}_t{take}_nyers.wav"))
                atiratok = [H.atir(wav, f"{s['id']}_t{take}", proba=p) for p in range(2)]
                hiany = hianyzo_szavak(szoveg, atiratok)
                sor = dict(id=s["id"], take=take, szoveg=szoveg, atiratok=atiratok, hianyzo=hiany, wav=wav)
                print(f"{s['id']} t{take}: {'OK' if not hiany else 'HIBÁS: ' + ', '.join(hiany)}")
                if legjobb is None or len(hiany) < len(legjobb["hianyzo"]):
                    legjobb = sor
                if not hiany:
                    break
            jelentes.append(legjobb)
            klipek[s["id"]] = vag(olvas_wav(legjobb["wav"]))
    except H.Penzhiany as e:
        ki = becsult_idozites(d, f"OpenRouter/keret: {e}")
        json.dump(dict(hiba=str(e), sorok=jelentes), open(KI_JELENTES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"HANG LEÁLLT ({e}).\nBECSÜLT időzítés (néma előzetes): {ki['hossz']} s -> {KI_IDOZITES}")
        return 3

    # layout with the designed pauses
    hossz = ELO_S + sum(len(klipek[s["id"]]) / SR + s.get("szunet_utana", d["szunet_utana_alap"]) for s in d["sorok"]) + UTO_S
    atempo = 1.0
    if hossz > MAX_HOSSZ_S:
        atempo = min(MAX_ATEMPO, hossz / (MAX_HOSSZ_S - 1.0))
    sorok, darabok, t = [], [np.zeros(int(ELO_S * SR), dtype=np.float32)], ELO_S
    for s in d["sorok"]:
        x = klipek[s["id"]]
        if atempo > 1.0:
            p_be = os.path.join(ROOT, "hang", "sorok", f"{s['id']}_vagott.wav")
            p_ki = os.path.join(ROOT, "hang", "sorok", f"{s['id']}_tempo.wav")
            ir_wav(p_be, x)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p_be, "-af", f"atempo={atempo:.4f}", "-ar", str(SR), p_ki], check=True)
            x = olvas_wav(p_ki)
        ir_wav(os.path.join(ROOT, "hang", "sorok", f"{s['id']}.wav"), x)
        h = len(x) / SR
        reszek = cue_reszek(s)
        cues = [dict(szoveg=r, start=round(t + a, 3), end=round(t + b, 3))
                for r, (a, b) in zip(reszek, cue_idok(reszek, h, belso_csendek(x)))]
        sorok.append(dict(id=s["id"], jelenet=s["jelenet"], start=round(t, 3), end=round(t + h, 3), cues=cues))
        szunet = s.get("szunet_utana", d["szunet_utana_alap"]) / atempo
        darabok += [x, np.zeros(int(szunet * SR), dtype=np.float32)]
        t += h + szunet
    darabok.append(np.zeros(int(UTO_S * SR), dtype=np.float32))
    nyers = os.path.join(ROOT, "hang", "narracio_nyers.wav")
    ir_wav(nyers, np.concatenate(darabok))
    lufs, csucs = hangosit(nyers, KI_NARRACIO)
    ossz = round(t + UTO_S, 3)
    ki = dict(becsult=False, hang=hang, hossz=ossz, atempo=round(atempo, 4), lufs=lufs, csucs_dbtp=csucs,
              keveres_plafon_dbtp=TP_KEVERES, sorok=sorok, verzio=d.get("verzio"))
    json.dump(ki, open(KI_IDOZITES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rossz = [j["id"] for j in jelentes if j["hianyzo"]]
    json.dump(dict(rossz_sorok=rossz, sorok=jelentes), open(KI_JELENTES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"KÉSZ: {ossz} s, atempo {atempo:.3f}, {lufs:.1f} LUFS, csúcs {csucs:.1f} dBTP (mono), hibás maradt: {rossz or 'nincs'}; "
          f"költés eddig {H.koltes():.4f} USD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
