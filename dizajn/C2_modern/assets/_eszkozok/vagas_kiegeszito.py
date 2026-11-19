# -*- coding: utf-8 -*-
"""Kézjegy C2, a szigorú átnézés javításai (11-18): kiegészítő vágások a jóváhagyott ikonlapok mellé.
A vagas_ikon3d.py függvényeit használja (maszk, peremmatt), de a meglévő 16 ikon fájljait NEM írja felül.

1. ÁRNYÉK NÉLKÜLI B-ikonok (A4): a B lap (ikonlap_b_v1.webp) tárgyai lebegnek, az árnyékuk külön csík alattuk.
   24–44 pt-on ez szürke aláhúzásnak látszott (irat, csengő a 04-en), az A lap ikonjainak pedig nincs árnyéka.
   Itt csak a tárgy kerül a négyzetbe (FILL 0,86, a tárgy közepén, mint az A lapon):
   assets/ikon3d/<név>_arnyektalan_<pt>@2x|@3x.png, pt = 24, 28, 36, 44.
   Az iratnál a fehér lap széle 1,5 px-en kissé sötétebb (a fehér lapon különben eltűnik a széle).
2. C ikonlap (ikonlap_c_v1.webp, ingyenes Recraft, 0 USD, ugyanaz a prompt-keret, mint az A és B lapé):
   boríték (NAV-levél), számlaköteg (kiállított számlák), bevallás pecséttel, tépőnaptár (a 02 tárgya),
   plusz négy tartalék (új nyugta, lakat, óra, kivonat), szintén árnyék nélkül:
   assets/ikon3d/<név>_<pt>@2x|@3x.png, pt = 24, 28, 36, 44, 56, 72.
   A tépőnaptár a 02 nagy tárgya is: assets/illusztraciok/tepnaptar_3d@2x|@3x.png (szorosan vágva, 96 pt magas).
Kimenet még: assets/ikon3d/_info_kiegeszito.json, assets/ikon3d/_elonezet_kiegeszito.png.
Használat: python vagas_kiegeszito.py"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
import vagas_ikon3d as v

KI = v.KI
ILL = os.path.join(v.ASSETS, "illusztraciok")
B_ARNYEKTALAN = ["fotozas", "masolas", "szamlaszam", "befizetve", "szamolo", "ertesites", "irat", "nyugta"]
B_PT = (24, 28, 36, 44)
C_PT = (24, 28, 36, 44, 56, 72)
PEREM_SOTET = {"irat": (4.0, 0.86), "nyugta_uj": (4.0, 0.90), "szamlak": (3.0, 0.90),
               "bevallas": (4.0, 0.88), "kivonat": (4.0, 0.88)}   # (sáv px a forráson, szorzó a szélén)

v.LAPOK["c"] = {"fajl": "ikonlap_c_v1.webp", "oszlop": [0, 340, 620, 870, 1216], "sor": [0, 440, 896]}
C_IKONOK = [
    ("c", 0, 0, "boritek", "eredeti", None, None),
    ("c", 0, 1, "szamlak", "eredeti", None, None),
    ("c", 0, 2, "bevallas", "eredeti", None, None),
    ("c", 0, 3, "tepnaptar", "eredeti", None, None),
    ("c", 1, 0, "nyugta_uj", "eredeti", None, None),
    ("c", 1, 1, "lakat", "eredeti", None, None),
    ("c", 1, 2, "ora", "eredeti", None, None),
    ("c", 1, 3, "kivonat", "eredeti", None, None),
]
v.IKONOK = v.IKONOK + C_IKONOK
MAGYARUL = dict(v.MAGYARUL, boritek="Levél (boríték)", szamlak="Számlák", bevallas="Bevallás", tepnaptar="Tépőnaptár",
                nyugta_uj="Nyugta (új, tartalék)", lakat="Lakat (tartalék)", ora="Óra (tartalék)", kivonat="Kivonat (tartalék)")


def targy_kepek(lk):
    """A lap minden tárgya árnyék NÉLKÜL: (név → RGBA tömb a tárgy dobozára, doboz)."""
    rgb = np.asarray(Image.open(os.path.join(v.NYERS, v.LAPOK[lk]["fajl"])).convert("RGB")).astype(np.float32)
    targyak = v.lap_targyai(lk, rgb)
    nevek, targy_gazda, _mag, a_obj, szin, _a_arny = v.rgba_lap(rgb, targyak)
    ki = {}
    for i, nev in enumerate(nevek, start=1):
        sajat = targy_gazda == i
        ys, xs = np.nonzero(targyak[nev])
        ox0, ox1, oy0, oy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        p = 3  # a peremmatt 1-3 px-rel a maszkon túl is adhat alfát
        x0, y0, x1, y1 = max(ox0 - p, 0), max(oy0 - p, 0), min(ox1 + p, rgb.shape[1]), min(oy1 + p, rgb.shape[0])
        a = np.where(sajat[y0:y1, x0:x1], a_obj[y0:y1, x0:x1], 0).astype(np.float32)
        c = szin[y0:y1, x0:x1].copy()
        if nev in PEREM_SOTET:
            sav, szorzo = PEREM_SOTET[nev]
            d = ndi.distance_transform_edt(a > 0.5)
            vilagos = c.mean(axis=2) > 190
            k = np.where((d <= sav) & vilagos, szorzo + (1 - szorzo) * np.clip((d - 1) / sav, 0, 1), 1.0)
            c = c * k[..., None]
        rgba = np.dstack([c, a * 255]).round().clip(0, 255).astype(np.uint8)
        ki[nev] = (Image.fromarray(rgba, "RGBA"), [int(ox0), int(oy0), int(ox1), int(oy1)])
    return ki


def negyzetre(kep, fill=v.FILL):
    w, h = kep.size
    n = int(np.ceil(max(w, h) / fill))
    q = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    q.paste(kep, ((n - w) // 2, (n - h) // 2))
    return q


def main():
    info = {"forras": {"b": "ikonlap_b_v1.webp", "c": "ikonlap_c_v1.webp"}, "fill": v.FILL, "ikonok": {}}
    b = targy_kepek("b")
    for nev in B_ARNYEKTALAN:
        kep, doboz = b[nev]
        q = negyzetre(kep)
        for pt in B_PT:
            for sz in v.SZORZOK:
                v.premult_resize(q, pt * sz).save(os.path.join(KI, f"{nev}_arnyektalan_{pt}@{sz}x.png"))
        info["ikonok"][f"{nev}_arnyektalan"] = {"lap": "b", "targy_doboz_px": doboz, "negyzet_px": q.size[0],
                                                "meretek_pt": list(B_PT), "felskalazva_44pt@3x": bool(132 > q.size[0])}
    c = targy_kepek("c")
    for nev, (kep, doboz) in c.items():
        q = negyzetre(kep)
        q.save(os.path.join(KI, f"{nev}.png"))
        for pt in C_PT:
            for sz in v.SZORZOK:
                v.premult_resize(q, pt * sz).save(os.path.join(KI, f"{nev}_{pt}@{sz}x.png"))
        info["ikonok"][nev] = {"lap": "c", "targy_doboz_px": doboz, "negyzet_px": q.size[0], "meretek_pt": list(C_PT),
                               "felskalazva_72pt@3x": bool(216 > q.size[0])}
    # a 02 nagy tárgya: a tépőnaptár szorosan vágva, 96 pt magasra (@2x 192 px, @3x 288 px)
    kep, doboz = c["tepnaptar"]
    for sz in v.SZORZOK:
        h = 96 * sz
        w = int(round(kep.size[0] * h / kep.size[1]))
        kep.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA").save(os.path.join(ILL, f"tepnaptar_3d@{sz}x.png"))
    info["tepnaptar_3d"] = {"forras_px": list(kep.size), "magassag_pt": 96,
                            "szelesseg_pt": round(kep.size[0] * 96 / kep.size[1], 2), "felskalazva_3x": bool(288 > kep.size[1])}
    json.dump(info, open(os.path.join(KI, "_info_kiegeszito.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    elonezet()
    print(json.dumps({k: (val.get("negyzet_px") if isinstance(val, dict) else val) for k, val in info["ikonok"].items()}))
    print(info["tepnaptar_3d"])


def elonezet():
    """Régi (árnyékos) és új (árnyék nélküli) B-ikonok 44 pt-on, és a C lap 44 pt-on, fehér lapon és az alapon."""
    try:
        f = ImageFont.truetype(v.FONT, 20); f.set_variation_by_name("Medium")
        fk = ImageFont.truetype(v.FONT, 26); fk.set_variation_by_name("SemiBold")
    except Exception:
        f = ImageFont.truetype("segoeui.ttf", 22); fk = ImageFont.truetype("segoeuib.ttf", 26)
    sorok = [("B lap, eddig (árnyékkal), 44 pt", [f"{n}_44@2x" for n in B_ARNYEKTALAN], B_ARNYEKTALAN),
             ("B lap, árnyék nélkül, 44 pt", [f"{n}_arnyektalan_44@2x" for n in B_ARNYEKTALAN], B_ARNYEKTALAN),
             ("C lap (új), 44 pt", [f"{n[3]}_44@2x" for n in C_IKONOK], [n[3] for n in C_IKONOK])]
    cella, px, MARGO = 170, 88, 40
    lapok = []
    for alap in ((255, 255, 255), (0xDD, 0xE3, 0xEC)):
        img = Image.new("RGB", (MARGO * 2 + 8 * cella, len(sorok) * 190 + 20), alap)
        d = ImageDraw.Draw(img)
        for r, (cim, fajlok, nevek) in enumerate(sorok):
            y0 = 10 + r * 190
            d.text((MARGO, y0 + 6), cim, font=fk, fill=(0x15, 0x1C, 0x2A))
            for j, (fa, nev) in enumerate(zip(fajlok, nevek)):
                ik = Image.open(os.path.join(KI, fa + ".png"))
                x = MARGO + j * cella + (cella - px) // 2
                img.paste(ik, (x, y0 + 50), ik)
                t = MAGYARUL.get(nev, nev)
                d.text((MARGO + j * cella + (cella - d.textlength(t, font=f)) / 2, y0 + 50 + px + 8), t, font=f, fill=(0x53, 0x5D, 0x72))
        lapok.append(img)
    out = Image.new("RGB", (lapok[0].width, sum(l.height for l in lapok)), (255, 255, 255))
    y = 0
    for l in lapok:
        out.paste(l, (0, y)); y += l.height
    out.save(os.path.join(KI, "_elonezet_kiegeszito.png"))


if __name__ == "__main__":
    main()
