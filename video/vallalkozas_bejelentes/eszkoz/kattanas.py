"""Soron BELÜLI kattanás elnémítása a meglévő felvételben, új felvétel nélkül (2026-11-19, 2. ellenőrző kör).

  python kattanas.py <nev> --keres                 # a szünetekben álló rövid impulzusok listája (ezeket meg kell hallgatni / nézni)
  python kattanas.py <nev> <sor> <t0> <t1>         # a sor hangjában a [t0, t1] másodperc közti ablakot elnémítja

Miért kézi: a sor ELEJÉN álló kattanást a hang.py magától levágja (eleje_elemzes), de soron belül egy rövid impulzus
lehet a szó része is (szóvégi k / t / p pattanása a szünet előtt), ezért itt nem döntünk gépiesen. A b26-ban a „vagy”
előtt 54 ms-mal állt egy 1,9 ms-os kattanás (-18 dBFS a kész hangban), csend közepén: ez nem beszédhang.

A némítás a választott take-et (hang/takek/<sor>_t<k>.wav) és a hang/<sor>.wav-ot írja át, 2 ms-os ki- és beúsztatással;
az eredetik a hang/_regi/kattanas_elott_<idő>/ mappába kerülnek (nem törlünk), a hossz.json „kattanas_nemitva” mezője
megjegyzi az ablakot. Ismételhető: ha az ablak már csendes, nem nyúl hozzá. A sor hossza nem változik.
Utána: python epit.py <nev>  (a vak ellenőrzés az átírt sort újra átíratja – kb. 0,0006 USD).
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402
import hang as HG  # noqa: E402

USZTATAS = 0.002            # ki- és beúsztatás a némított ablak két szélén
MAR_CSENDES_DB = -60.0      # ha az ablak csúcsa ez alatt van, már nincs mit némítani


def nemit(nev: str, sid: str, t0: float, t1: float) -> bool:
    hd = f"{K.mappa(nev)}/hang"
    hp = f"{hd}/hossz.json"
    hossz = json.load(open(hp, encoding="utf-8"))
    v = hossz[sid]
    if v.get("tempo"):
        raise SystemExit(f"{sid}: a sor gyorsítva van (tempo {v['tempo']}); a némítást a take idejében kell megadni – előbb "
                         f"vedd ki a gyorsítást, vagy számold át az időt")
    take = f"{hd}/takek/{sid}_t{v['take']}.wav"
    a, sr = HG._wav_be(take)
    i0, i1 = int(round(t0 * sr)), int(round(t1 * sr))
    if not (0 < i0 < i1 < len(a)):
        raise SystemExit(f"{sid}: rossz ablak ({t0}–{t1} s; a sor {len(a) / sr:.2f} s)")
    f = int(USZTATAS * sr)
    csucs = 20 * np.log10(float(np.abs(a[i0 + f:i1 - f]).max()) + 1e-9)     # az úsztatás sávja nélkül: ismételve már csend
    if csucs < MAR_CSENDES_DB:
        print(f"[{nev}] {sid}: a {t0:.3f}–{t1:.3f} s ablak már csendes ({csucs:.1f} dBFS) – nincs teendő")
        return False
    regi = f"{hd}/_regi/kattanas_elott_{_dt.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(regi, exist_ok=True)
    shutil.copy2(take, f"{regi}/{os.path.basename(take)}")
    if os.path.exists(f"{hd}/{sid}.wav"):
        shutil.copy2(f"{hd}/{sid}.wav", f"{regi}/{sid}.wav")
    b = a.copy()
    burok = np.ones(i1 - i0, dtype=np.float32)
    burok[:f] = np.linspace(1, 0, f)
    burok[f:-f] = 0.0
    burok[-f:] = np.linspace(0, 1, f)
    b[i0:i1] *= burok
    HG._wav_ki(take, b, sr)
    shutil.copyfile(take, f"{hd}/{sid}.wav")
    v.setdefault("kattanas_nemitva", []).append([round(t0, 4), round(t1, 4)])
    json.dump(hossz, open(hp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[{nev}] {sid} (take {v['take']}): a {t0:.3f}–{t1:.3f} s ablak elnémítva (a csúcs {csucs:.1f} dBFS volt); az eredeti: {regi}")
    return True


def keres(nev: str, min_db: float = -40.0) -> list:
    """szünetben álló rövid impulzusok: 2 ms-os keretben min_db-nél hangosabb csúcs, előtte ÉS utána 30 ms-on át
    -50 dB alatti csend. Szóvégi zárhang pattanása is ilyen lehet – a lista jelölt, nem ítélet."""
    hd = f"{K.mappa(nev)}/hang"
    hossz = json.load(open(f"{hd}/hossz.json", encoding="utf-8"))
    ki = []
    for sid in hossz:
        a, sr = HG._wav_be(f"{hd}/{sid}.wav")
        ab = int(sr * 0.002)
        n = len(a) // ab
        x = a[: n * ab].reshape(n, ab)
        rms = 20 * np.log10(np.sqrt((x ** 2).mean(axis=1)) + 1e-9)
        csucs = 20 * np.log10(np.abs(x).max(axis=1) + 1e-9)
        i = 15
        while i < n - 15:
            if csucs[i] > min_db:
                j = i
                while j < n - 15 and csucs[j] > min_db - 12:
                    j += 1
                if (j - i) <= 4 and rms[i - 15:i - 1].max() < -50 and rms[j + 3:j + 15].max() < -50:
                    ki.append((sid, round(i * 0.002, 3), round(float(csucs[i:j + 1].max()), 1), (j - i) * 2))
                i = j + 1
            else:
                i += 1
    for sid, t, db, ms in ki:
        print(f"  {sid}: {t:.3f} s, csúcs {db} dBFS, kb. {ms} ms  (a sor {hossz[sid]['mp']} s: {hossz[sid]['szoveg'][:50]})")
    print(f"{nev}: {len(ki)} elszigetelt impulzus a sorok hangjában")
    return ki


if __name__ == "__main__":
    arg = sys.argv[1:]
    if len(arg) >= 2 and arg[1] == "--keres":
        keres(arg[0])
    elif len(arg) == 4:
        nemit(arg[0], arg[1], float(arg[2]), float(arg[3]))
    else:
        print(__doc__)
        sys.exit(2)
