"""A két NAV-párbeszédablak (meghatalmazás-útmutató, 14. és 15. kép) ikonja levágott kör nélkül.

    python ikon_teljes.py     ->  ../_nyers/segedlet_ujegyke_2025-03-11/o03_benyujtas_ikonnal.png (+ .json)
                                  ../_nyers/segedlet_ujegyke_2025-03-11/o03_sikeres_ikonnal.png   (+ .json)

Miért kell (2026-11-19, 2. ellenőrző kör): a NAV saját segédletében (a PDF 3. oldalán) mindkét ábra FELÜL LEVÁGVA
szerepel – a figyelmeztető háromszög, illetve a pipa köré rajzolt kör teteje hiányzik (a „Meghatalmazás benyújtása!”
ábrán 7, a „Sikeres benyújtás!” ábrán 26 képpontsor). Magasabb forráskép nincs. A videóban és az útmutató képén a kör
teteje így a lap szélénél „le volt nyírva”.

Ez az eszköz a kép tetejére fehér sávot tesz, és a kör hiányzó felső ívét a KÖR SAJÁT ALSÓ ÍVÉNEK TÜKRÖZÉSÉVEL pótolja
(a kör vízszintes tengelyére szimmetrikus; csak a körvonal sávját másoljuk, a kör belsejét – háromszög, pipa – nem).
Ellenőrzés: a tükrözés a meglévő sorokra visszavetítve is egyezik a képpel (a körvonal felső, még látható része =
az alsó ív tükörképe), különben megáll. A párbeszédablak szövege, gombjai, színei nem változnak; új tartalom nem
keletkezik, csak egy körív záródik be. A helyek (.json) a fehér sávval lejjebb kerülnek.
Bemenet: o03_benyujtas_teljes.png (a benyujtas_teljes.py kimenete) és o03_sikeres.png. Kell: Pillow, numpy.
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image

ITT = os.path.dirname(os.path.abspath(__file__))
MAPPA = os.path.join(os.path.dirname(ITT), "_nyers", "segedlet_ujegyke_2025-03-11")
FEHER_SAV = 16            # ennyi fehér képpontsor a kör teteje fölött
SAV = 5.0                 # a körvonal sávja: a sugártól legfeljebb ennyire lévő képpontokat másoljuk


def kor(a: np.ndarray, kozep_x: int) -> tuple:
    """a kép tetején álló kör (közép x, közép y, sugár) a körvonal külső szélére illesztve (soronkénti bal/jobb szél)"""
    nem_feher = a.min(axis=2) < 200
    pontok = []
    for y in range(0, 60):
        x = np.where(nem_feher[y, kozep_x - 80:kozep_x + 80])[0]
        if len(x) >= 2:
            pontok.append((y, kozep_x - 80 + x.min(), kozep_x - 80 + x.max()))
    cx = float(np.median([(l + r) / 2 for _, l, r in pontok]))
    legjobb = None
    for cy2 in range(40, 140):                      # cy fél képpontos lépésekben
        cy = cy2 / 2
        r2 = [((r - l + 1) / 2) ** 2 + (y - cy) ** 2 for y, l, r in pontok]
        szoras = float(np.std(np.sqrt(r2)))
        if legjobb is None or szoras < legjobb[0]:
            legjobb = (szoras, cy, float(np.mean(np.sqrt(r2))))
    return cx, legjobb[1], legjobb[2], legjobb[0]


def kiegeszit(nev_be: str, nev_ki: str, kozep_x: int) -> dict:
    be = os.path.join(MAPPA, nev_be + ".png")
    a = np.asarray(Image.open(be).convert("RGB")).copy()
    h, w = a.shape[:2]
    cx, cy, r, szoras = kor(a, kozep_x)
    if szoras > 0.6:
        raise SystemExit(f"{nev_be}: a kör illesztése bizonytalan (szórás {szoras:.2f} képpont)")
    hianyzik = int(np.ceil(r - cy)) + 1             # ennyi sor hiányzik a kör tetejéből
    if hianyzik <= 0:
        raise SystemExit(f"{nev_be}: a kör teljes, nincs mit pótolni")
    tukor = int(round(2 * cy))                      # a -k. sor tükörképe a (tukor + k). sor
    yy, xx = np.mgrid[0:h, 0:w]
    tav = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    sav = np.abs(tav - (r - 1.5)) <= SAV            # a körvonal sávja (a vonal kb. 3 képpont vastag, a külső szél a sugár)
    # ellenőrzés: a még látható felső ív = az alsó ív tükörképe (a körvonal sávjában)
    elteres = []
    for y in range(0, min(12, int(cy) - 8)):
        ys = tukor - y
        m = sav[y] & sav[ys]
        if m.sum():
            elteres.append(np.abs(a[y][m].astype(int) - a[ys][m].astype(int)).mean())
    atlag = float(np.mean(elteres))
    if atlag > 14:
        raise SystemExit(f"{nev_be}: a felső ív nem tükörképe az alsónak (átlagos eltérés {atlag:.1f}) – nem pótolunk")
    felso = hianyzik + FEHER_SAV
    ki = np.full((h + felso, w, 3), 255, dtype=np.uint8)
    ki[felso:] = a
    for k in range(1, hianyzik + 1):
        ys = tukor + k
        if ys >= h:
            break
        m = sav[ys]
        ki[felso - k][m] = a[ys][m]
    cel = os.path.join(MAPPA, nev_ki + ".png")
    Image.fromarray(ki).save(cel)
    jb = os.path.join(MAPPA, nev_be + ".json")
    meta = json.load(open(jb, encoding="utf-8")) if os.path.exists(jb) else {}
    tol = lambda t: [t[0], t[1] + felso, t[2], t[3] + felso]          # noqa: E731
    meta["helyek"] = {k: tol(v) for k, v in (meta.get("helyek") or {}).items()}
    for kulcs in ("elozetesen_elmosva", "piros_keret_eltavolitva"):
        meta[kulcs] = [tol(v) for v in meta.get(kulcs) or []]
    meta["ikon_javitas"] = {
        "mibol": nev_be + ".png", "eszkoz": "_eszkoz/ikon_teljes.py", "felso_sav_keppont": felso,
        "potolt_sorok": hianyzik, "kor": {"kozep_x": round(cx, 1), "kozep_y": round(cy + felso, 1), "sugar": round(r, 1)},
        "tukrozes_ellenorzes_atlagos_elteres": round(atlag, 1),
        "megjegyzes": "A NAV-segédlet ábrája felül levágva szerepel (az ikon köré rajzolt kör teteje hiányzott). A hiányzó "
                      "körívet a kör saját alsó ívének tükrözése pótolja, fölötte fehér sáv; a kör belseje, a szöveg és a "
                      "gombok változatlanok.",
    }
    json.dump(meta, open(os.path.join(MAPPA, nev_ki + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{nev_ki}.png: {w} x {h + felso} (+{felso} sor felül, ebből {hianyzik} pótolt körív; kör: közép ({cx:.1f}, {cy:.1f}), "
          f"sugár {r:.1f}; a tükrözés átlagos eltérése a látható íven {atlag:.1f})")
    return {"felso": felso, "meret": (w, h + felso)}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    kiegeszit("o03_benyujtas_teljes", "o03_benyujtas_ikonnal", 427)
    kiegeszit("o03_sikeres", "o03_sikeres_ikonnal", 381)
