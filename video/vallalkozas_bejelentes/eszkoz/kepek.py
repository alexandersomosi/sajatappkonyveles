"""Rétegezett NAV-képek a videóhoz: utmutato_kepek/<útmutató>/index.json -> alap + jelölésenkénti réteg.

Ugyanazzal a rajzolással, mint az utmutato_kepek/annotate.py (annak segédfüggvényeit használja, a fájljaihoz nem nyúl):
a kész kép = alap + minden jelölés rétege. Így a videóban a jelölések egyenként, a narrációval együtt jelennek meg.
Ha a tulaj saját képernyőképet tesz a _sajat/ mappába és újrafuttatja az annotate.py-t, a videó újraépítése
(epit.py) automatikusan azt használja (ugyanaz a forrásválasztás).
"""
from __future__ import annotations

import datetime as _dt
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402

sys.path.insert(0, K.KEPEK)
import annotate as A  # noqa: E402  (utmutato_kepek/annotate.py – csak olvasunk belőle)

_CACHE: dict = {}


def lepes_by_kep(utmutato: str) -> dict:
    d = K.index_json(utmutato)
    return {f"{s['sorszam']:02d}_{s['slug']}": s for s in d["lepesek"]}


def retegek(utmutato: str, kep: str) -> dict:
    """-> {'alap': RGB, 'jelek': {n: {'reteg': RGBA, 'lista': RGBA, 'doboz', 'korong', 'stilus', 'cimke'}}, 'tipus', 'forras', 'lap'}"""
    kulcs = (utmutato, kep)
    if kulcs in _CACHE:
        return _CACHE[kulcs]
    lepes = lepes_by_kep(utmutato)[kep]
    honnan, utvonal, blokk = A.forras_valasztas(utmutato, lepes)
    kep_img = Image.open(utvonal).convert("RGB")
    helyek = {}
    jsonut = os.path.splitext(utvonal)[0] + ".json"
    if os.path.exists(jsonut):
        import json
        with open(jsonut, encoding="utf-8") as f:
            helyek = json.load(f).get("helyek", {}) or {}
    helyek = {k: v for k, v in helyek.items() if v and (v[2] - v[0]) > 0}
    for r in blokk.get("piros_ki") or []:
        A.piros_ki(kep_img, A.hely_feloldas(r, helyek))
    for r in blokk.get("takar") or []:
        A.takar(kep_img, A.hely_feloldas(r, helyek))
    for r in blokk.get("homalyos") or []:
        A.homalyosit(kep_img, A.hely_feloldas(r, helyek))
    v = blokk.get("vagas")
    if isinstance(v, list) and len(v) == 4 and not isinstance(v[0], str):
        v = [0 if v[0] is None else v[0], 0 if v[1] is None else v[1], kep_img.width if v[2] is None else v[2],
             kep_img.height if v[3] is None else v[3]]
    vagas = A.hely_feloldas(v, helyek) or [0, 0, kep_img.width, kep_img.height]
    vagas = [int(round(x)) for x in vagas]
    kep_img = A.kivag_szelekkel(kep_img, vagas)
    bov = blokk.get("bovites") or [0, 0, 0, 0]
    if any(bov):
        kit = blokk.get("kitoltes")
        szin = tuple(int(kit.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if kit else None
        uj = Image.new("RGB", (kep_img.width + bov[0] + bov[2], kep_img.height + bov[1] + bov[3]), szin or (255, 255, 255))
        uj.paste(kep_img, (bov[0], bov[1]))
        if szin is None:
            if bov[0]:
                uj.paste(kep_img.crop((0, 0, 1, kep_img.height)).resize((bov[0], kep_img.height)), (0, bov[1]))
            if bov[2]:
                uj.paste(kep_img.crop((kep_img.width - 1, 0, kep_img.width, kep_img.height)).resize((bov[2], kep_img.height)),
                         (bov[0] + kep_img.width, bov[1]))
            if bov[1]:
                uj.paste(uj.crop((0, bov[1], uj.width, bov[1] + 1)).resize((uj.width, bov[1])), (0, 0))
            if bov[3]:
                uj.paste(uj.crop((0, bov[1] + kep_img.height - 1, uj.width, bov[1] + kep_img.height)).resize((uj.width, bov[3])),
                         (0, bov[1] + kep_img.height))
        kep_img = uj
        vagas = [vagas[0] - bov[0], vagas[1] - bov[1], vagas[2] + bov[2], vagas[3] + bov[3]]
    W2, MARGO, LAP_R = A.W2, A.MARGO, A.LAP_R
    lap_w = W2 - 2 * MARGO
    s = lap_w / kep_img.width
    lap_h = int(round(kep_img.height * s))
    nagy = kep_img.resize((lap_w, lap_h), Image.LANCZOS)
    if s > 1.15:
        nagy = nagy.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))

    def at(r):
        return [(r[0] - vagas[0]) * s, (r[1] - vagas[1]) * s, (r[2] - vagas[0]) * s, (r[3] - vagas[1]) * s]

    jelolesek = (blokk.get("jelolesek") or []) if honnan == "sajat" else (lepes.get("jelolesek") or [])
    jelolesek = [dict(j) for j in jelolesek]
    lap_ter = [MARGO, MARGO, MARGO + lap_w, MARGO + lap_h]
    dobozok = []
    for j in jelolesek:
        if j.get("doboz") is None:
            dobozok.append(None)
            continue
        r = at(A.hely_feloldas(j["doboz"], helyek))
        p = j.get("parna", 12)
        r = [r[0] - p + MARGO, r[1] - p + MARGO, r[2] + p + MARGO, r[3] + p + MARGO]
        r = [max(lap_ter[0] + 6, r[0]), max(lap_ter[1] + 6, r[1]), min(lap_ter[2] - 6, r[2]), min(lap_ter[3] - 6, r[3])]
        dobozok.append(r)
    k = float(blokk.get("jel_meret") or lepes.get("jel_meret") or 1.0)
    font_lista = A.betu(56, 600)
    font_lista_szam = A.betu(44, 760)
    font_szam = A.betu(int(42 * k), 760)
    font_lab = A.betu(38, 520)
    font_jelveny = A.betu(38, 680)
    illusztracio = (lepes.get("tipus") == "illusztracio") and honnan == "alap"
    forras_sor = (lepes.get("forras_rovid") or "") if honnan == "alap" else \
        f"Saját képernyőkép, {_dt.date.fromtimestamp(os.path.getmtime(utvonal)).isoformat()}"
    jelveny_w = (font_jelveny.getlength("Illusztráció") + 44 + 22) if illusztracio else 0
    lab_sorok = A.tordeles(forras_sor, font_lab, W2 - 2 * MARGO - jelveny_w - 8)
    R_L = 36
    lista = []
    for j in jelolesek:
        if j.get("cimke"):
            lista.append((j, A.tordeles(j["cimke"], font_lista, W2 - 2 * MARGO - 2 * R_L - 40)))
    lista_h = (34 + sum(max(1, len(s_)) * 70 + 22 for _, s_ in lista)) if lista else 0
    lab_h = 30 + max(len(lab_sorok) * 50, 56 if illusztracio else 0) + 26
    Hh = MARGO + lap_h + lista_h + lab_h
    vaszon = Image.new("RGB", (W2, Hh), A.ALAP)
    arnyek = Image.new("L", (W2, Hh), 0)
    ImageDraw.Draw(arnyek).rounded_rectangle([MARGO, MARGO + 14, MARGO + lap_w, MARGO + lap_h + 14], radius=LAP_R, fill=70)
    arnyek = arnyek.filter(ImageFilter.GaussianBlur(22))
    vaszon.paste(Image.new("RGB", (W2, Hh), A.ARNYEK), (0, 0), arnyek)
    maszk = Image.new("L", (lap_w, lap_h), 0)
    ImageDraw.Draw(maszk).rounded_rectangle([0, 0, lap_w - 1, lap_h - 1], radius=LAP_R, fill=255)
    vaszon.paste(nagy, (MARGO, MARGO), maszk)
    ImageDraw.Draw(vaszon).rounded_rectangle([MARGO, MARGO, MARGO + lap_w - 1, MARGO + lap_h - 1], radius=LAP_R,
                                             outline=A.KERET, width=2)
    # a korongok helye: ugyanaz a sorrend és ütközésvizsgálat, mint az annotate.py-ban (mind a jelöléssel számolva)
    R = int(36 * k)
    RES = int(52 * k)
    korongok, helyek_jel = [], []
    for j, r in zip(jelolesek, dobozok):
        if r is None:
            helyek_jel.append(None)
            continue
        cy_bal = r[1] + min(R + 10, (r[3] - r[1]) / 2)
        jeloltek = {
            "bal": (r[0] - RES - R, cy_bal, (r[0] - RES, cy_bal), (r[0] - 4, cy_bal)),
            "jobb": (r[2] + RES + R, cy_bal, (r[2] + RES, cy_bal), (r[2] + 4, cy_bal)),
            "fent": (r[0] + R + 14, r[1] - RES - R, (r[0] + R + 14, r[1] - RES), (r[0] + R + 14, r[1] - 4)),
            "lent": (r[0] + R + 14, r[3] + RES + R, (r[0] + R + 14, r[3] + RES), (r[0] + R + 14, r[3] + 4)),
        }
        sorrend = [j.get("szam_hely", "bal"), "bal", "jobb", "lent", "fent"]
        hely = None
        for oldal in sorrend:
            cx, cy, a, b = jeloltek[oldal]
            kor = [cx - R - 5, cy - R - 5, cx + R + 5, cy + R + 5]
            belul = kor[0] >= lap_ter[0] + 4 and kor[2] <= lap_ter[2] - 4 and kor[1] >= lap_ter[1] + 4 and kor[3] <= lap_ter[3] - 4
            utkozik = any(A.metszes(kor, o) for o in korongok) or any(A.metszes(kor, o) for o in dobozok if o is not None and o is not r)
            if belul and not utkozik:
                hely = (cx, cy, a, b)
                break
        if hely is None:
            hely = (min(max(r[0] + 6, lap_ter[0] + R + 8), lap_ter[2] - R - 8), min(max(r[1] + 6, lap_ter[1] + R + 8), lap_ter[3] - R - 8),
                    None, None)
        korongok.append([hely[0] - R - 5, hely[1] - R - 5, hely[0] + R + 5, hely[1] + R + 5])
        helyek_jel.append(hely)
    jelek = {}
    for j, r, hely in zip(jelolesek, dobozok, helyek_jel):
        if r is None:
            continue
        st = A.SZINEK[j.get("stilus", "tinta")]
        reteg = Image.new("RGBA", (W2, Hh), (0, 0, 0, 0))
        d = ImageDraw.Draw(reteg)
        if st["kitolt"]:
            d.rounded_rectangle(r, radius=int(22 * k), fill=st["kitolt"])
        if st["szaggatott"]:
            A.szaggatott_keret(d, r, st["vonal"] + (235,), int(7 * k), int(22 * k), int(26 * k), int(16 * k))
        else:
            A.tomor_keret(d, r, st["vonal"], k)
        cx, cy, a, b = hely
        if a is not None:
            A.nyil(d, a, b, st["vonal"] + (255,), int(7 * k), int(26 * k))
        d.ellipse([cx - R - 5, cy - R - 5, cx + R + 5, cy + R + 5], fill=A.FEHER + (255,))
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=st["korong"] + (255,))
        szam = str(j["n"])
        d.text((cx - font_szam.getlength(szam) / 2, cy - 26 * k), szam, font=font_szam, fill=st["szam"] + (255,))
        # memória (2026-11-19): a réteg csak a saját befoglaló téglalapja (+ a helye), nem a teljes vászon –
        # egy 2160x4218-as RGBA réteg 36 MB volt, jelölésenként kettő; a gép más munkák mellett kifogyott a memóriából
        bb = reteg.getbbox() or (0, 0, 1, 1)
        jelek[j["n"]] = {"reteg": reteg.crop(bb), "reteg_hely": (bb[0], bb[1]), "lista": None, "lista_hely": (0, 0),
                         "doboz": r, "korong": (cx, cy), "R": R,
                         "stilus": j.get("stilus", "tinta"), "cimke": j.get("cimke") or ""}
        del reteg, d
    y = MARGO + lap_h + 34
    for j, sorok_ in lista:
        st = A.SZINEK[j.get("stilus", "tinta")]
        lr = Image.new("RGBA", (W2, Hh), (0, 0, 0, 0))
        dv = ImageDraw.Draw(lr)
        cx, cy = MARGO + R_L + 4, y + 37
        if st["szaggatott"]:
            dv.ellipse([cx - R_L, cy - R_L, cx + R_L, cy + R_L], fill=A.FEHER + (255,), outline=st["vonal"] + (255,), width=4)
            szin = A.TINTA
        else:
            dv.ellipse([cx - R_L, cy - R_L, cx + R_L, cy + R_L], fill=st["korong"] + (255,))
            szin = st["szam"]
        szam = str(j["n"])
        dv.text((cx - font_lista_szam.getlength(szam) / 2, cy - 27), szam, font=font_lista_szam, fill=szin + (255,))
        for i, s_ in enumerate(sorok_):
            dv.text((MARGO + 2 * R_L + 34, y + 4 + i * 70), s_, font=font_lista, fill=A.TINTA + (255,))
        y += max(1, len(sorok_)) * 70 + 22
        if j["n"] in jelek:
            bb = lr.getbbox() or (0, 0, 1, 1)
            jelek[j["n"]]["lista"] = lr.crop(bb)
            jelek[j["n"]]["lista_hely"] = (bb[0], bb[1])
        del lr, dv
    dv = ImageDraw.Draw(vaszon)
    y = MARGO + lap_h + lista_h + 30
    x = MARGO + 4
    if illusztracio:
        jt = "Illusztráció"
        jw = font_jelveny.getlength(jt) + 44
        dv.rounded_rectangle([x, y - 4, x + jw, y + 52], radius=28, fill=A.BOROSTYAN_ALAP, outline=A.BOROSTYAN, width=3)
        dv.text((x + 22, y + 2), jt, font=font_jelveny, fill=A.TINTA)
        x += jw + 22
    for i, s_ in enumerate(lab_sorok):
        dv.text((x, y + 2 + i * 50), s_, font=font_lab, fill=A.HALVANY)
    out = {"alap": vaszon, "jelek": jelek, "tipus": "illusztracio" if illusztracio else "valodi", "forras": forras_sor,
           "lap": [MARGO, MARGO, MARGO + lap_w, MARGO + lap_h], "meret": (W2, Hh), "kepernyo": lepes.get("kepernyo") or ""}
    _CACHE[kulcs] = out
    return out


_ALLAPOT: dict = {}


def allapot(utmutato: str, kep: str, lathato: tuple) -> Image.Image:
    """A kép a megadott jelölésekkel (RGB). Gyorsítótárazva."""
    kulcs = (utmutato, kep, tuple(sorted(lathato)))
    if kulcs in _ALLAPOT:
        return _ALLAPOT[kulcs]
    r = retegek(utmutato, kep)
    img = r["alap"].convert("RGBA")
    for n in sorted(lathato):
        j = r["jelek"].get(n)
        if not j:
            continue
        img.alpha_composite(j["reteg"], dest=j["reteg_hely"])
        if j["lista"] is not None:
            img.alpha_composite(j["lista"], dest=j["lista_hely"])
    img = img.convert("RGB")
    if len(_ALLAPOT) > 8:               # egy állapot 18–27 MB; egy jelenet 2–6 állapotot használ
        _ALLAPOT.clear()
    _ALLAPOT[kulcs] = img
    return img


if __name__ == "__main__":
    # önellenőrzés: a teljes jelöléssel rajzolt kép egyezik-e a jelölt kép @2x változatával
    import numpy as np
    for utm in K.NEVEK:
        for kep in lepes_by_kep(utm):
            r = retegek(utm, kep)
            teljes = allapot(utm, kep, tuple(r["jelek"].keys()))
            ref = Image.open(f"{K.KEPEK}/{utm}/{kep}@2x.png").convert("RGB")
            if ref.size != teljes.size:
                print("MÉRET ELTÉR", utm, kep, ref.size, teljes.size)
                continue
            diff = np.abs(np.asarray(ref, dtype=np.int16) - np.asarray(teljes, dtype=np.int16)).mean()
            print(f"{utm:24s} {kep:44s} {teljes.size} jelek={sorted(r['jelek'])} elteres={diff:.3f}")
