"""A „Meghatalmazás benyújtása!” ablak képe levágott szöveg nélkül (meghatalmazás-útmutató, 14. kép).

    python benyujtas_teljes.py        ->  ../_nyers/segedlet_ujegyke_2025-03-11/o03_benyujtas_teljes.png (+ .json)

Miért kell (2026-11-19, ellenőrző kör): a NAV saját segédletében (a PDF 3. oldalán) ez az ábra a bal szélén LEVÁGVA
szerepel – a „Ha folytatja, …” sor H betűjének bal szára hiányzik –, a jobb szélén pedig a sor a kép széléig ér.
Szélesebb forráskép nincs: a PDF-be ágyazott kép pontosan 801 x 369 képpont. Ez az eszköz
  1. fehér sávot tesz a kép bal és jobb szélére (a szöveg ne érjen a kép széléhez), és
  2. a hiányzó H-szárat (3 képpontoszlop) UGYANENNEK a NAV-segédletnek egy másik ábrájából pótolja, ahol ugyanez a
     „Ha folytatja, …” sor ugyanazzal a betűvel és képpontra azonos rajzolattal teljes egészében látszik (a 833 x 459-es
     ábra). Az illesztést ellenőrzi: a két ábrán a közös rész („a folytatja,” eleje) képpontra egyezik, különben megáll.
A párbeszédablak szövege, gombjai, színei nem változnak. A forrás-PDF-ből csak adatot olvasunk (zlib-bel kicsomagolt
képpontok), semmit nem futtatunk belőle. Kell: Pillow, numpy.
"""
from __future__ import annotations

import json
import os
import re
import sys
import zlib

import numpy as np
from PIL import Image

ITT = os.path.dirname(os.path.abspath(__file__))
GYOKER = os.path.dirname(ITT)
PDF = os.path.join(GYOKER, "_forras", "segedlet_15_18_ujegyke_onya.pdf")
NYERS = os.path.join(GYOKER, "_nyers", "segedlet_ujegyke_2025-03-11", "o03_benyujtas.png")
CEL = os.path.join(GYOKER, "_nyers", "segedlet_ujegyke_2025-03-11", "o03_benyujtas_teljes.png")
BAL, JOBB = 28, 28            # fehér sáv a két szélen (forrás-képpont)
SOR = (219, 244)              # a „Ha folytatja, …” sor sávja a nyers képen (y0, y1)


def pdf_kep(meret: tuple) -> np.ndarray:
    """a PDF-be ágyazott, adott méretű (szél, mag) RGB kép képpontjai"""
    b = open(PDF, "rb").read()
    for m in re.finditer(rb"(\d+) 0 obj\s*<<(.{0,600}?)>>\s*stream\r?\n", b, re.S):
        d = m.group(2)
        w, h = re.search(rb"/Width (\d+)", d), re.search(rb"/Height (\d+)", d)
        if not (w and h) or (int(w.group(1)), int(h.group(1))) != meret:
            continue
        ln = int(re.search(rb"/Length (\d+)", d).group(1))
        raw = zlib.decompress(b[m.end(): m.end() + ln])
        if len(raw) == meret[0] * meret[1] * 3:
            return np.frombuffer(raw, np.uint8).reshape(meret[1], meret[0], 3).copy()
    raise SystemExit(f"nincs {meret} méretű kép a PDF-ben")


def main() -> int:
    nyers = np.asarray(Image.open(NYERS).convert("RGB")).copy()
    h, w = nyers.shape[:2]
    masik = pdf_kep((833, 459))
    # a közös rész megkeresése: a nyers kép sorának eleje (a H jobb szára + „a folyt…”) a másik ábrán
    minta = nyers[SOR[0]:SOR[1], 4:60].astype(int)
    hely = None
    for y in range(0, masik.shape[0] - minta.shape[0]):
        if (masik[y:y + minta.shape[0], :, :].min() > 250):
            continue
        for x in range(0, masik.shape[1] - minta.shape[1]):
            if masik[y, x, 0] == nyers[SOR[0], 4, 0] and np.array_equal(masik[y:y + minta.shape[0], x:x + minta.shape[1]].astype(int), minta):
                hely = (x, y)
                break
        if hely:
            break
    if not hely:
        raise SystemExit("a két ábra közös része nem egyezik képpontra – nem pótolunk semmit")
    dx, dy = hely[0] - 4, hely[1] - SOR[0]            # másik[y + dy, x + dx] == nyers[y, x]
    # a H teljes szélessége a másik ábrán: a sor első sötét oszlopától
    sav = masik[SOR[0] + dy:SOR[1] + dy, :dx + 12].astype(int).min(axis=2)
    oszl = np.where((sav < 200).any(axis=0))[0]
    # visszafelé a nyers kép 0. oszlopától: az összefüggő sötét oszlopok (a H bal szára)
    x = dx - 1
    while x >= 0 and (sav[:, x] < 250).any():
        x -= 1
    hianyzik = dx - 1 - x                            # ennyi oszlop hiányzik a nyers kép bal széléről
    if not (1 <= hianyzik <= 8) or len(oszl) == 0:
        raise SystemExit(f"váratlan: {hianyzik} hiányzó oszlop")
    ki = np.full((h, w + BAL + JOBB, 3), 255, np.uint8)
    ki[:, BAL:BAL + w] = nyers
    ki[SOR[0]:SOR[1], BAL - hianyzik:BAL] = masik[SOR[0] + dy:SOR[1] + dy, dx - hianyzik:dx]
    if os.path.exists(CEL):                          # nem törlünk: a régi a _regi/-be
        import datetime as _dt
        import shutil
        regi = os.path.join(GYOKER, "_regi", "nyers_" + _dt.datetime.now().strftime("%Y%m%d_%H%M%S"))
        os.makedirs(regi, exist_ok=True)
        shutil.move(CEL, os.path.join(regi, os.path.basename(CEL)))
    Image.fromarray(ki).save(CEL, optimize=True)
    alap = json.load(open(os.path.splitext(NYERS)[0] + ".json", encoding="utf-8"))
    helyek = {k: [v[0] + BAL, v[1], v[2] + BAL, v[3]] for k, v in (alap.get("helyek") or {}).items()}
    json.dump({"helyek": helyek, "elozetesen_elmosva": alap.get("elozetesen_elmosva", []),
               "piros_keret_eltavolitva": [[r[0] + BAL, r[1], r[2] + BAL, r[3]] for r in alap.get("piros_keret_eltavolitva", [])],
               "javitas": {"mibol": "o03_benyujtas.png", "eszkoz": "_eszkoz/benyujtas_teljes.py",
                           "feher_sav_bal_jobb": [BAL, JOBB], "potolt_oszlopok": int(hianyzik),
                           "megjegyzes": "A NAV-segédlet ábrája a bal szélén levágva szerepel (a „Ha folytatja” H betűjének bal szára "
                                         "hiányzott). A hiányzó képpontoszlopok ugyanennek a segédletnek a 833x459-es ábrájából valók, "
                                         "ahol ugyanez a sor képpontra azonos rajzolattal teljes; a két szélen fehér sáv."}},
              open(os.path.splitext(CEL)[0] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"kész: {CEL} ({ki.shape[1]}x{ki.shape[0]}), pótolt oszlopok: {hianyzik}, eltolás a másik ábrához: dx={dx}, dy={dy}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
