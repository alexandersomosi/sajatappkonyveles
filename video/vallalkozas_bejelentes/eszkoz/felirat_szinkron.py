"""Felirat–hang szinkron a KÉSZ mp4-ben: a VTT cue-k kezdete a beszéd tényleges kezdetéhez képest.
python felirat_szinkron.py <nev>"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
V = "C:/Users/UpgradePC/konyvelo_app/video"
nev = sys.argv[1]
mp4 = f"{V}/{nev}/{nev}.mp4"
tmp = f"{V}/{nev}/_elonezet/szinkron_ellenorzes.wav"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp4, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", tmp], check=True)
with wave.open(tmp) as w:
    sr = w.getframerate()
    a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
ab = int(sr * 0.01)
n = len(a) // ab
rms = np.sqrt((a[: n * ab].reshape(n, ab) ** 2).mean(axis=1) + 1e-12)
db = 20 * np.log10(rms)
beszed = db > (db.max() - 38)
print(f"{nev}: hang {n * 0.01:.2f} s, csúcs {20 * np.log10(np.abs(a).max() + 1e-9):.1f} dBFS, beszéd-arány {beszed.mean():.2f}")


def elso_beszed(t0, t1):
    i0, i1 = max(0, int(t0 * 100)), min(n, int(t1 * 100))
    idx = np.where(beszed[i0:i1])[0]
    return None if len(idx) == 0 else (i0 + idx[0]) / 100


def utolso_beszed(t0, t1):
    i0, i1 = max(0, int(t0 * 100)), min(n, int(t1 * 100))
    idx = np.where(beszed[i0:i1])[0]
    return None if len(idx) == 0 else (i0 + idx[-1] + 1) / 100


iv = json.load(open(f"{V}/{nev}/_elonezet/idovonal.json", encoding="utf-8"))
print("mód:", iv["mod"], "hossz:", iv["hossz_mp"])
sor_kezd = {round(s["start"], 2): s["id"] for s in iv["sorok"]}
# 1) a sorok helye: a beszéd a sor idősávjában szól-e (előtte/utána csend)
rossz = 0
for k, s in enumerate(iv["sorok"]):
    # a keresőablak nem lóghat a szomszéd sorba (a sorok közt 0,24 s a szünet): különben az előző sor vége / a következő
    # eleje hamis „ELTÉR” jelzést ad (2026-11-19)
    elozo_vege = iv["sorok"][k - 1]["end"] + 0.03 if k else 0.0
    kov_eleje = iv["sorok"][k + 1]["start"] - 0.03 if k + 1 < len(iv["sorok"]) else 1e9
    e = elso_beszed(max(s["start"] - 0.3, elozo_vege), s["end"])
    u = utolso_beszed(s["start"], min(s["end"] + 0.3, kov_eleje))
    d0, d1 = (e - s["start"]) if e is not None else None, (u - s["end"]) if u is not None else None
    jo = e is not None and -0.05 <= d0 <= 0.25 and -0.25 <= d1 <= 0.08
    rossz += 0 if jo else 1
    if not jo:
        print(f"  SOR {s['id']}: {s['start']:.2f}-{s['end']:.2f}  beszéd kezdete {d0:+.2f}, vége {d1:+.2f}  <-- ELTÉR")
print(f"sorok: {len(iv['sorok'])}, eltérés: {rossz}")
# 2) cue-k
t = open(f"{V}/{nev}/{nev}.vtt", encoding="utf-8").read()
cuek = []
for blokk in t.strip().split("\n\n")[1:]:
    sorok = blokk.split("\n")
    m = re.match(r"(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3})", sorok[1])
    g = [int(x) for x in m.groups()]
    cuek.append((g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000, g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000, " / ".join(sorok[2:])))
elt = []
for (c0, c1, sz) in cuek:
    sor_eleje = any(abs(c0 - k) < 0.02 for k in sor_kezd)
    e = elso_beszed(c0 - 0.05, c1)
    elotte = beszed[max(0, int((c0 - 0.2) * 100)):int(c0 * 100)].mean() if c0 > 0.2 else 0.0
    d = (e - c0) if e is not None else None
    tip = "sor eleje" if sor_eleje else "soron belül"
    megj = ""
    if sor_eleje and (d is None or not (-0.05 <= d <= 0.3)):
        megj = "  <-- ELTÉR"
    if not sor_eleje:
        megj = "  (szünetben vált)" if elotte < 0.3 else "  (beszéd közben vált – nincs szünet a hangban)"
    elt.append(d)
    print(f"  {c0:7.2f}-{c1:7.2f} [{tip:11s}] beszéd a cue kezdete után {d:+.2f} s; előtte 0,2 s beszéd-arány {elotte:.2f}{megj}  | {sz[:60]}")
print(f"cue-k: {len(cuek)}; a beszéd kezdete a cue kezdetéhez képest: átlag {np.mean([x for x in elt if x is not None]):+.2f} s, "
      f"max {max(x for x in elt if x is not None):+.2f} s")
os.replace(tmp, tmp)  # megmarad az _elonezet-ben (nem törlünk)
