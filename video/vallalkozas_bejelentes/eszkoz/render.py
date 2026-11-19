"""A két útmutató-videó képe, felirata és hangkeverése (SPEC §26.7): 1080x1920, 30 fps, H.264 High + AAC, +faststart.

  python render.py <nev> [--elonezet]      # --elonezet: becsült időzítés, néma, gyors kódolás (a kép ellenőrzéséhez)

Bemenet: video/<nev>/forgatokonyv.json, video/<nev>/hang/hossz.json (+ hang/<id>.wav), utmutato_kepek/<útmutató>/.
Kimenet: video/<nev>/<nev>.mp4, <nev>.vtt, <nev>_poszter.jpg (előnézetnél _elonezet/<nev>_elonezet.mp4).
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kozos as K  # noqa: E402
import kepek as KP  # noqa: E402

sys.path.insert(0, K.VIDEO)
import felirat_tores as FT  # noqa: E402  (video/felirat_tores.py – közös a három videónak)

W, H, FPS = K.W, K.H, K.FPS
BAND_H = 250
VY0, VY1 = BAND_H, 1400            # a képernyőkép-ablak
VW, VH = W, VY1 - VY0
PILL_Y = 1418
CAP_Y0, CAP_Y1 = 1516, 1772        # a felirat lapja
FOOT_Y = 1798
KEZDO = 0.6                        # a címkép az első mondat előtt
SZUNET_SOR = 0.24
SZUNET_JELENET = 0.54
VEG = 3.4                          # az utolsó mondat után: zárókép (11-19 javítás: 2,1 -> 3,4 s, hogy olvasható legyen)
ZARO_KEP = 2.4                     # ennyi ideig látszik a tintakék zárókép a végén (11-19: 1,25 -> 2,4 s, teljesen ~2,3 s)
ATMENET = 0.45
CUE_TARTAS = 1.0                   # a beégetett felirat kitart a következőig, ha a szünet ennél rövidebb
GOMB_M_ALAP = (223, 228, 253)  # #DFE4FD
ESZKOZ_DIR = K.ESZKOZ


# ============================================================================================ időzítés
def hosszak(nev: str, fk: dict, elonezet: bool) -> dict:
    """elonezet=True: becsült hossz (13,7 karakter/s: a végleges közös hang, Umbriel mért tempója a két videó 50 során,
    2026-11-19; a korábbi 13,5 + 0,12 s/sor az ideiglenes hangra készült), a hangfájloktól függetlenül"""
    p = f"{K.mappa(nev)}/hang/hossz.json"
    meglevo = json.load(open(p, encoding="utf-8")) if (os.path.exists(p) and not elonezet) else {}
    out = {}
    for _, s in K.sorok(fk):
        if s["id"] in meglevo:
            out[s["id"]] = float(meglevo[s["id"]]["mp"])
        else:
            if not elonezet:
                raise SystemExit(f"hiányzik a hang: {s['id']} (futtasd: python hang.py {nev})")
            out[s["id"]] = len(s["mond"]) / 13.7
    return out


# --- a sor valódi ritmusa (2026-11-19, a végleges hanghoz): a hangban mért szünetek <-> a szöveg írásjelei.
# A jelölések és a felirat-váltások ideje így nem egyenletes betűtempóból, hanem szünettől szünetig számolódik:
# a kamera akkor ér a jelölt részre, és a felirat akkor vált, amikor a hang tényleg ott tart. Hang nélkül (néma /
# előnézet mód) marad az egyenletes becslés.
RITMUS_BE = False       # epit() kapcsolja be 'vegleges' módban
_RITMUS: dict = {}


def _szunetek(p: str, min_mp: float = 0.16, kuszob_db: float = -38.0):
    """-> ([(kezdet, vég)], hossz): a soron belüli csendek (a sor csúcsszintjéhez képest kuszob_db alatt)"""
    with wave.open(p) as w:
        sr = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
    ab = int(sr * 0.01)
    n = len(a) // ab
    if n < 20:
        return [], len(a) / sr
    rms = np.sqrt((a[: n * ab].reshape(n, ab) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    csend = (db - db.max()) < kuszob_db
    nyers, i = [], 0
    while i < n:
        if csend[i]:
            j = i
            while j < n and csend[j]:
                j += 1
            if i > 8 and j < n - 8:              # a sor eleje/vége nem soron belüli szünet
                nyers.append([i * 0.01, j * 0.01])
            i = j
        else:
            i += 1
    ossze = []
    for x in nyers:                              # két csend közt egy rövid pisszenés (levegővétel): egy szünet
        if ossze and x[0] - ossze[-1][1] < 0.08:
            ossze[-1][1] = x[1]
        else:
            ossze.append(x)
    return [(a_, b_) for a_, b_ in ossze if b_ - a_ >= min_mp], len(a) / sr


def _terkep(csomok: list, i: float) -> float:
    """darabonként lineáris betűhely -> idő"""
    for (c0, t0), (c1, t1) in zip(csomok, csomok[1:]):
        if i <= c1:
            return t0 if c1 <= c0 else t0 + (t1 - t0) * (i - c0) / (c1 - c0)
    return csomok[-1][1]


def ritmus(nev: str | None, s: dict, mp: float) -> list | None:
    """-> csomópontok [(betűhely a 'mond'-ban, idő a sor elejétől)] vagy None (nincs hang / nem ehhez a hosszhoz való)"""
    if not RITMUS_BE or not nev:
        return None
    kulcs = (nev, s["id"], round(mp, 3))
    if kulcs in _RITMUS:
        return _RITMUS[kulcs]
    ki = None
    p = f"{K.mappa(nev)}/hang/{s['id']}.wav"
    if os.path.exists(p):
        szun, wav_mp = _szunetek(p)
        if abs(wav_mp - mp) <= 0.06:
            t = s["mond"]
            n = len(t)
            irasjel = [m.start() for m in re.finditer(r"[.,:;!?–]", t) if m.start() < n - 2]
            par = {}                             # írásjel helye -> (szünet kezdete, vége)

            def csomok():
                out = [(0.0, 0.0)]
                for c in sorted(par):
                    out += [(c + 1.0, par[c][0]), (c + 2.0, par[c][1])]
                return out + [(float(n), mp)]
            for ps, pe in sorted(szun, key=lambda x: x[0] - x[1]):      # a leghosszabb szünettel kezdve
                legjobb = None
                for c in irasjel:
                    if c in par:
                        continue
                    if any((c2 < c and par[c2][1] > ps) or (c2 > c and par[c2][0] < pe) for c2 in par):
                        continue                 # a sorrend nem borulhat
                    d = abs(_terkep(csomok(), c + 1.0) - ps)
                    if d <= 0.75 and (legjobb is None or d < legjobb[0]):
                        legjobb = (d, c)
                if legjobb:
                    par[legjobb[1]] = (ps, pe)
            ki = csomok()
    _RITMUS[kulcs] = ki
    return ki


def anker_ido(s: dict, kezd: float, mp: float, szo: str, kesleltet: float = 0.0, nev: str | None = None) -> float:
    t = s["mond"]
    i = t.find(szo)
    if i < 0:
        i = 0
    cs = ritmus(nev, s, mp)
    if cs:
        return kezd + _terkep(cs, float(i)) + 0.08 + kesleltet
    return kezd + mp * (i / max(1, len(t))) + 0.08 + kesleltet


def idovonal(nev: str, fk: dict, hossz: dict) -> dict:
    t = KEZDO
    jel_list, sor_list = [], []
    for ji, j in enumerate(fk["jelenetek"]):
        if ji > 0:
            t += SZUNET_JELENET - SZUNET_SOR
        jstart = None
        for si, s in enumerate(j["sorok"]):
            if si > 0 or ji > 0:
                t += SZUNET_SOR
            mp = hossz[s["id"]]
            sor_list.append({"id": s["id"], "jelenet": ji, "start": t, "end": t + mp, "mp": mp, "sor": s})
            if jstart is None:
                jstart = t
            t += mp + float(s.get("kitart", 0.0))       # "kitart": szünet a sor után (a mondat végi jelölés látsszon)
        t += float(j.get("kitart", 0.0))                # ugyanez a jelenet végén, a jelenetváltás előtt
        jel_list.append({"j": j, "i": ji, "elso_sor": jstart})
    vege = t + VEG
    for k, js in enumerate(jel_list):
        js["start"] = 0.0 if k == 0 else js["elso_sor"] - 0.55
    for k, js in enumerate(jel_list):
        js["end"] = jel_list[k + 1]["start"] if k + 1 < len(jel_list) else vege
    return {"jelenetek": jel_list, "sorok": sor_list, "hossz": vege}


# ============================================================================================ rajz-segédek
def ease(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return 4 * x * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def tordel(szoveg: str, font, max_w: float) -> list:
    sorok_, sor = [], ""
    for szo in szoveg.split():
        p = (sor + " " + szo).strip()
        if font.getlength(p) <= max_w or not sor:
            sor = p
        else:
            sorok_.append(sor)
            sor = szo
    if sor:
        sorok_.append(sor)
    return sorok_


_IKON: dict = {}


def ikon(nev: str, px: int) -> Image.Image:
    k = (nev, px)
    if k not in _IKON:
        p = f"{K.IKON3D}/{nev}.png"
        if not os.path.exists(p):
            p = f"{K.ILLUSZTR}/{nev}@3x.png"
        im = Image.open(p).convert("RGBA")
        sc = px / max(im.size)
        _IKON[k] = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    return _IKON[k]


def vizual(nev: str, w: int) -> Image.Image:
    k = ("viz", nev, w)
    if k not in _IKON:
        im = Image.open(f"{K.ILLUSZTR}/{nev}@3x.png").convert("RGBA")
        sc = w / im.width
        _IKON[k] = im.resize((w, round(im.height * sc)), Image.LANCZOS)
    return _IKON[k]


def arnyekos_lap(img: Image.Image, box, r=36, arny=True):
    x0, y0, x1, y1 = [int(v) for v in box]
    if arny:
        a = Image.new("L", img.size, 0)
        ImageDraw.Draw(a).rounded_rectangle([x0, y0 + 12, x1, y1 + 12], radius=r, fill=60)
        a = a.filter(ImageFilter.GaussianBlur(20))
        img.paste(Image.new("RGB", img.size, K.ARNYEK), (0, 0), a)
    ImageDraw.Draw(img).rounded_rectangle([x0, y0, x1, y1], radius=r, fill=K.LAP)


def szoveg_kozep(d, cx, y, szoveg, font, szin):
    d.text((cx - font.getlength(szoveg) / 2, y), szoveg, font=font, fill=szin)


# ============================================================================================ keret (sáv + lábléc)
_KERET: dict = {}


def keret(fk: dict, cim: str | None, felcim: str, lepes: str, haladas, lab: dict | None) -> Image.Image:
    kulcs = (cim, felcim, lepes, tuple(haladas) if haladas else None, json.dumps(lab, ensure_ascii=False) if lab else None)
    if kulcs in _KERET:
        return _KERET[kulcs]
    img = Image.new("RGB", (W, H), K.ALAP)
    d = ImageDraw.Draw(img)
    if cim is not None:
        d.rectangle([0, 0, W, BAND_H], fill=K.TINTAKEK)
        f1 = K.betu(34, 520)
        d.text((56, 52), felcim, font=f1, fill=K.FEJLEC_HALVANY)
        if lepes:
            d.text((W - 56 - f1.getlength(lepes), 52), lepes, font=f1, fill=K.FEJLEC_HALVANY)
        f2 = K.betu(64, 680)
        if f2.getlength(cim) > W - 112:
            f2 = K.betu(54, 680)
        d.text((56, 104), cim, font=f2, fill=(255, 255, 255))
        if haladas:
            n, aktiv = haladas
            gap, x0, x1 = 10, 56, W - 56
            sw = (x1 - x0 - gap * (n - 1)) / n
            for i in range(n):
                xa = x0 + i * (sw + gap)
                szin = (255, 255, 255) if i < aktiv else (K.BOROSTYAN if i == aktiv else K.HALADAS_HATRA)
                d.rounded_rectangle([xa, 208, xa + sw, 216], radius=4, fill=szin)
    if lab:
        x = 48
        ff = K.betu(30, 500)
        if lab.get("illusztracio"):
            fj = K.betu(28, 650)
            jw = fj.getlength("Illusztráció") + 32
            d.rounded_rectangle([x, FOOT_Y - 2, x + jw, FOOT_Y + 40], radius=21, fill=K.BOROSTYAN_ALAP, outline=K.BOROSTYAN, width=2)
            d.text((x + 16, FOOT_Y + 3), "Illusztráció", font=fj, fill=K.TINTA)
            x += jw + 16
        for i, s in enumerate(tordel(lab.get("szoveg") or "", ff, W - 48 - x)[:3]):
            d.text((x, FOOT_Y + 2 + i * 39), s, font=ff, fill=K.HALVANY_ALAPON)
    if len(_KERET) > 60:
        _KERET.clear()
    _KERET[kulcs] = img
    return img


# ============================================================================================ felirat
# A tördelés szabályai a video/felirat_tores.py-ban vannak (közös a három videónak; 2026-11-19, 2. ellenőrző kör): a sor
# és a cue ott törik, ahol a mondat tagolódik (írásjel, tagmondat, névelő előtt), nem ott, ahol a két sor a
# legkiegyensúlyozottabb; az igekötő / simulószó („be”, „le”, „is”, „ne”) soha nem válik el a szavától.
ZARO_JEL = FT.MONDATVEG + FT.TAGVEG


def ket_sor(szavak: list, max_c: int = 42) -> list | None:
    """szavak -> 1 vagy 2 sor (<= max_c), a mondat tagolása szerint törve, vagy None, ha nem fér el"""
    return FT.ket_sor(szavak, max_c)


def cue_darabok(felirat: str, max_c: int = 42) -> list:
    """felirat -> cue-k (mindegyik legfeljebb 2 sor x max_c karakter), mondat- / tagmondathatáron vágva"""
    return FT.cue_darabok(felirat, max_c)


def sor_cuek(sor: dict) -> list:
    """a sor felirat-cue-i: a forgatókönyv kézi tördelése ("felirat_sorok": [[sor, sor], [sor]]), ha van – ott, ahol a
    szószerkezet határát a szabályok nem látják –, különben az automatikus"""
    if sor.get("felirat_sorok"):
        return FT.kezi(sor["felirat"], sor["felirat_sorok"])
    return cue_darabok(sor["felirat"])


def feliratok(iv: dict, nev: str | None = None) -> list:
    """nev megadva (végleges mód): a soron belüli felirat-váltás a hang valódi ritmusához igazodik (ritmus()), és ha
    szünet közelébe esik, a szünet végére kerül – a következő felirat akkor jelenik meg, amikor a hang belekezd."""
    out = []
    for s in iv["sorok"]:
        cuek = sor_cuek(s["sor"])
        hosszak_ = [sum(len(x) for x in c) for c in cuek]
        ossz = sum(hosszak_)
        cs = ritmus(nev, s["sor"], s["mp"]) if nev else None
        hatarok, acc = [0.0], 0
        for h in hosszak_[:-1]:
            acc += h
            tb = s["mp"] * acc / ossz
            if cs:
                tb = _terkep(cs, len(s["sor"]["mond"]) * acc / ossz)
                for (_, ps), (_, pe) in zip(cs[1:-1:2], cs[2:-1:2]):       # a párosított szünetek
                    if ps - 0.45 <= tb <= pe + 0.45:
                        tb = max(ps, pe - 0.10)
                        break
            hatarok.append(min(max(tb, hatarok[-1] + 0.3), s["mp"] - 0.3))
        hatarok.append(s["mp"])
        for c, a, b in zip(cuek, hatarok, hatarok[1:]):
            out.append({"start": s["start"] + a, "end": s["start"] + b, "sorok": c})
    for i, c in enumerate(out):                  # min. 1 s, és ne lógjon a következőbe
        if c["end"] - c["start"] < 1.0:
            c["end"] = c["start"] + 1.0
        if i + 1 < len(out) and c["end"] > out[i + 1]["start"] - 0.02:
            c["end"] = out[i + 1]["start"] - 0.02
    for i, c in enumerate(out):                  # a beégetett változat kitart a következő cue-ig (rövid szünetben)
        kov = out[i + 1]["start"] if i + 1 < len(out) else None
        c["tart"] = kov if (kov is not None and kov - c["end"] <= CUE_TARTAS) else c["end"] + 0.25
    return out


def vtt(cuek: list, cel: str):
    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"
    with open(cel, "w", encoding="utf-8", newline="\n") as f:
        f.write("WEBVTT - hu\n\n")
        for i, c in enumerate(cuek, 1):
            f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n" + "\n".join(c["sorok"]) + "\n\n")


_CAP: dict = {}


def felirat_reteg(sorok_: list) -> Image.Image:
    """A fő videó felirat-stílusa (tulaj-kérés 8: ugyanaz a stílus): tintakék, lekerekített kapszula, fehér Geist
    szöveg, a szöveg szélességére szabva, a felirat-sáv közepén."""
    k = tuple(sorok_)
    if k in _CAP:
        return _CAP[k]
    f = K.betu(44, 600)
    mw = W - 80 - 72
    while max(f.getlength(x) for x in sorok_) > mw and f.size > 34:
        f = K.betu(f.size - 2, 600)
    im = Image.new("RGBA", (W - 80, CAP_Y1 - CAP_Y0), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lh = int(f.size * 1.34)
    tw = max(f.getlength(x) for x in sorok_)
    pw, ph = tw + 72, lh * len(sorok_) + 40
    x0, y0 = (im.width - pw) / 2, (im.height - ph) / 2
    d.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=min(34, ph / 2), fill=K.TINTAKEK + (255,))
    ty = y0 + 20 + (lh - f.size) * 0.22
    for i, x in enumerate(sorok_):
        szoveg_kozep(d, im.width / 2, ty + i * lh, x, f, (255, 255, 255, 255))
    if len(_CAP) > 30:
        _CAP.clear()
    _CAP[k] = im
    return im


# ============================================================================================ jelölés-címke (pirula)
_PILL: dict = {}


def pirula(n: int | None, stilus: str, cimke: str) -> Image.Image:
    """a jelölés felirata a kép alatt. n=None: szám nélküli, bevezető pirula (a kép első jelölése előtt – pl. amikor a hang
    egy olyan gombról beszél, amelyről nincs kép: „Az űrlap alján: …”)"""
    k = (n, stilus, cimke)
    if k in _PILL:
        return _PILL[k]
    f = K.betu(36, 600)
    fs = K.betu(32, 760)
    while f.getlength(cimke) > W - 200 and f.size > 26:
        f = K.betu(f.size - 2, 600)
    if n is None:
        w, h = int(f.getlength(cimke) + 72), 78
        im = Image.new("RGBA", (w + 8, h + 14), (0, 0, 0, 0))
        a = Image.new("L", im.size, 0)
        ImageDraw.Draw(a).rounded_rectangle([4, 8, w + 4, h + 8], radius=h // 2, fill=50)
        a = a.filter(ImageFilter.GaussianBlur(5))
        im.paste((*K.ARNYEK, 255), (0, 0), a)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([4, 2, w + 4, h + 2], radius=h // 2, fill=(255, 255, 255, 255))
        d.text((4 + 36, 2 + h / 2 - f.size * 0.62), cimke, font=f, fill=K.TINTA + (255,))
        _PILL[k] = im
        return im
    w = int(f.getlength(cimke) + 128)
    h = 78
    im = Image.new("RGBA", (w + 8, h + 14), (0, 0, 0, 0))
    a = Image.new("L", im.size, 0)
    ImageDraw.Draw(a).rounded_rectangle([4, 8, w + 4, h + 8], radius=h // 2, fill=50)
    a = a.filter(ImageFilter.GaussianBlur(5))
    im.paste((*K.ARNYEK, 255), (0, 0), a)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 2, w + 4, h + 2], radius=h // 2, fill=(255, 255, 255, 255))
    cx, cy, r = 4 + 44, 2 + h / 2, 26
    if stilus == "borostyan":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=K.BOROSTYAN + (255,))
        szin = K.TINTA
    elif stilus == "ures":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255), outline=K.TINTAKEK + (255,), width=4)
        szin = K.TINTA
    else:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=K.TINTAKEK + (255,))
        szin = (255, 255, 255)
    szam = str(n)
    d.text((cx - fs.getlength(szam) / 2, cy - 20), szam, font=fs, fill=szin + (255,))
    d.text((4 + 88, cy - f.size * 0.62), cimke, font=f, fill=K.TINTA + (255,))
    _PILL[k] = im
    return im


# ============================================================================================ kamera
# A videó csak a NAV-képernyőkép lapját mutatja (a vászon alatti jelölés-lista és forrássor nem: a jelölés felirata a
# pirulában, a forrás a lábsorban van), így a kamera soha nem vág félbe saját feliratot (k3c review, 11-18).
def lap_ter(r) -> tuple:
    """a vágási téglalap: a képernyőkép lapja + a jelölések korongjai (néhány px levegővel)"""
    x0, y0, x1, y1 = r["lap"]
    for j in r["jelek"].values():
        cx, cy = j["korong"]
        R = j["R"] + 10
        x0, y0, x1, y1 = min(x0, cx - R), min(y0, cy - R), max(x1, cx + R), max(y1, cy + R)
    cw, ch = r["meret"]
    return (max(0, x0 - 14), max(0, y0 - 14), min(cw, x1 + 14), min(ch, y1 + 14))


def attekintes(r) -> tuple:
    x0, y0, x1, y1 = lap_ter(r)
    s = min(VW / (x1 - x0), VH / (y1 - y0)) * 0.97
    return ((x0 + x1) / 2, (y0 + y1) / 2, s)


def olvashato_skala(meret) -> float:
    """milyen nagyítás kell, hogy a kép szövege telefonon olvasható legyen: a széles (asztali) NAV-képernyőképeken
    apró a betű -> erős közelítés; a magas (mobilos, illetve a rajzolt) képeken nagy a betű -> enyhe"""
    cw, ch = meret
    return 1.0 if ch / cw < 0.9 else 0.55


def jel_allapot(r, jel, opt: dict | None = None) -> tuple:
    """A jelöléshez tartozó kameraállapot. Alapból a jelölés doboza + korongja (a sor elejével együtt, ha kifér);
    a forgatókönyv jel-bejegyzése felülírhatja: "nezet": [x0,y0,x1,y1] (a vászon törtjében) és/vagy "skala"."""
    opt = opt or {}
    meret = r["meret"]
    cw, ch = meret
    if opt.get("nezet"):
        f = opt["nezet"]
        rx0, ry0, rx1, ry1 = f[0] * cw, f[1] * ch, f[2] * cw, f[3] * ch
    else:
        x0, y0, x1, y1 = jel["doboz"]
        cx, cy = jel["korong"]
        R = jel["R"] + 8
        rx0, ry0, rx1, ry1 = min(x0, cx - R), min(y0, cy - R), max(x1, cx + R), max(y1, cy + R)
        pad = 48
        rx0, ry0, rx1, ry1 = rx0 - pad, ry0 - pad, rx1 + pad, ry1 + pad
    rw, rh = rx1 - rx0, ry1 - ry0
    s_fit = attekintes(r)[2]
    s_olv = olvashato_skala(meret)
    s_reg = min(VW / rw, VH / rh)
    kx, ky = (rx0 + rx1) / 2, (ry0 + ry1) / 2
    if opt.get("skala"):
        s = float(opt["skala"])
        if rw * s > VW:           # nem fér ki: a bal széle (korong + a sor neve) látszik
            kx = rx0 + VW / (2 * s)
        if rh * s > VH:
            ky = ry0 + VH / (2 * s)
    elif opt.get("nezet"):
        s = min(s_reg * 0.96, S_MAX_NEZET)
    elif s_reg >= s_olv * 0.85:   # kifér (majdnem) olvasható méretben: az egész doboz látszik, egy kis levegővel
        s = min(s_reg * 0.94, max(s_olv * 1.15, s_fit))
    else:                         # nem fér ki: a bal része (korong + mezőnév) látszik, olvasható méretben
        s = s_olv
        kx = rx0 + VW / (2 * s)
        if rh * s > VH:
            ky = ry0 + VH / (2 * s)
    s = max(s_fit, min(s, S_MAX_NEZET))
    return (kx, ky, s)


# ---------------------------------------------------------------------------------------------------------------
# A nézet széle ne vágjon félbe sort, mezőt, gombot vagy jelölést (2026-11-19, 2. ellenőrző kör: a fejlécsáv alatt
# félbevágott szövegsor, a kép alján félbevágott Vissza / Tovább gomb). A magas (mobilos / rajzolt) képernyőképeken a
# nézet mindig csak egy részt mutat, ezért a kamera célállapotát a kép tartalmához igazítjuk: a felső és az alsó szél
# olyan sávba kerül, ahol csak a lap háttere (vagy egy kártya fehérje) van – két sor / két kártya közé. Ha kell, a
# nagyítás is változik pár százalékot. A nyugvó kamera lassú ráközelítése (1,8%) is ebben a sávban marad.
SZEL_HATTER_ARANY = 0.985     # a sor ekkora része háttérszín (a kártyák függőleges szegélye belefér)
SZEL_SAV = 8                  # ennyi vászon-képpont tiszta sáv kell a szélen belül (a ráközelítés útján túl)
SZEL_KULSO = 24               # ... és ennyi a szélen KÍVÜL: a szél ne közvetlenül egy keret / sor alatt (fölött) álljon –
#                               különben pl. egy tájékoztató doboz felső szegélye a fejlécsáv mögé kerülne, a doboz „le lenne nyírva”
SZEL_DRIFT = 0.0095           # a lassú ráközelítés (1,8%) ennyit visz befelé a szélen (a nézet magasságának arányában)
SZEL_MAX_TOLAS = 0.22         # legfeljebb ennyit toljuk a nézetet (a nézet magasságának arányában)
SZEL_SKALAK = tuple(sorted((1 + k / 100 for k in range(-20, 13)), key=lambda f: abs(math.log(f))))   # 0,80 … 1,12
_HATTER: dict = {}


def _hatter_maszk(utm: str, kep: str):
    """-> bool tömb [mag, szél]: igaz, ahol a képpont a lap háttérszíne (a lap két leggyakoribb színének egyike).
    A kép minden jelölésével számolunk: a jelölés keretét és korongját sem vághatja félbe a nézet széle."""
    k = (utm, kep)
    if k in _HATTER:
        return _HATTER[k]
    r = KP.retegek(utm, kep)
    a = np.asarray(KP.allapot(utm, kep, tuple(r["jelek"].keys())).convert("RGB"))
    x0, y0, x1, y1 = [int(v) for v in r["lap"]]
    lap = a[y0:y1:2, x0:x1:2].astype(np.int32)
    q = (lap[..., 0] >> 3 << 10) | (lap[..., 1] >> 3 << 5) | (lap[..., 2] >> 3)
    db = np.bincount(q.ravel(), minlength=1 << 15)
    maszk = np.zeros(a.shape[:2], dtype=bool)
    for c in np.argsort(db)[::-1][:2]:
        if db[c] < 0.04 * q.size:
            continue
        szin = np.array([(c >> 10) << 3, ((c >> 5) & 31) << 3, (c & 31) << 3]) + 4
        maszk |= (np.abs(a.astype(np.int16) - szin).max(axis=2) <= 14)
    if len(_HATTER) > 1:
        _HATTER.clear()
    _HATTER[k] = maszk
    return maszk


def szel_igazit(utm: str, kep: str, r: dict, st: tuple, opt: dict | None = None, jel: dict | None = None) -> tuple:
    """A kamera-célállapot (cx, cy, s) igazítása: a nézet felső és alsó széle tiszta sávba essen. A legkisebb
    változtatást választja (tolás, aztán pár százalék nagyítás); ha nincs jó hely, az eredeti marad.
    A forgatókönyv jel-bejegyzésében "szel_igazit": false kikapcsolja."""
    if (opt or {}).get("szel_igazit") is False:
        return st
    cx, cy, s = st
    lx0, ly0, lx1, ly1 = lap_ter(r)
    if VH / s >= (ly1 - ly0) - 2:
        return st                                   # a kép teljes magassága látszik: nincs mit félbevágni
    m = _hatter_maszk(utm, kep)
    dobozok = []
    for j in r["jelek"].values():
        bx0, by0, bx1, by1 = j["doboz"]
        kx, ky = j["korong"]
        dobozok.append((min(by0, ky - j["R"]) - 6, max(by1, ky + j["R"]) + 6))

    cel = None
    if jel is not None:
        cel = (min(jel["doboz"][1], jel["korong"][1] - jel["R"]), max(jel["doboz"][3], jel["korong"][1] + jel["R"]))

    def tiszta(y_a, y_b, x_a, x_b):
        y_a, y_b = int(max(0, y_a)), int(min(m.shape[0], y_b))
        x_a, x_b = int(max(0, x_a)), int(min(m.shape[1], x_b))
        if y_b <= y_a or x_b <= x_a:
            return True
        return bool((m[y_a:y_b, x_a:x_b].mean(axis=1) >= SZEL_HATTER_ARANY).all())

    def jo(cx_, cy_, s_):
        vw, vh = VW / s_, VH / s_
        # csak a lap belsejét nézzük: a lap szegélye, árnyéka és a lapon kívüli alap nem „tartalom”
        xa, xb = max(r["lap"][0] + 16, cx_ - vw / 2), min(r["lap"][2] - 16, cx_ + vw / 2)
        yt, yb = cy_ - vh / 2, cy_ + vh / 2
        d = SZEL_DRIFT * vh
        if yt > ly0 + 2 and not tiszta(max(r["lap"][1] + 4, yt - SZEL_KULSO), yt + d + SZEL_SAV, xa, xb):
            return False
        if yb < ly1 - 2 and not tiszta(yb - d - SZEL_SAV, min(r["lap"][3] - 4, yb + SZEL_KULSO), xa, xb):
            return False
        if cel is not None and cel[1] - cel[0] < vh - 2 * d - 40 and not (yt + d + 16 <= cel[0] and cel[1] <= yb - d - 16):
            return False                            # a jelölés, amelyről a hang beszél, egészben a nézetben marad
        for (b0, b1) in dobozok:                    # jelölést sem vág félbe (ha a jelölés belefér a nézetbe)
            if b1 - b0 < vh - 2 * d:
                if (b0 < yt + d < b1) or (b0 < yb - d < b1) or (b0 < yt < b1) or (b0 < yb < b1):
                    return False
        return True

    cx0, cy0 = kamera_korlat(r, cx, cy, s)
    if jo(cx0, cy0, s):
        return (cx0, cy0, s)
    s_fit = attekintes(r)[2]
    legjobb = None
    for f in SZEL_SKALAK:                           # a legkisebb nagyítás-változástól kifelé
        ar_s = 2.5 * abs(math.log(f))
        if legjobb is not None and ar_s >= legjobb[0]:
            break
        s2 = max(s_fit, min(s * f, S_MAX_NEZET))
        vh = VH / s2
        lepes = max(2.0, vh * 0.003)
        talalt = False
        for k in range(0, int(SZEL_MAX_TOLAS * vh / lepes) + 1):
            for elojel in ((0,) if k == 0 else (-1, 1)):
                cx2, cy2 = kamera_korlat(r, cx, cy + elojel * k * lepes, s2)
                if k and abs(cy2 - (cy + elojel * k * lepes)) > 0.5:
                    continue                        # a lap széle megfogta: ezt a helyet már próbáltuk
                if jo(cx2, cy2, s2):
                    ar = abs(cy2 - cy0) / vh + ar_s
                    if legjobb is None or ar < legjobb[0]:
                        legjobb = (ar, (cx2, cy2, s2))
                    talalt = True
                    break
            if talalt:
                break
    return legjobb[1] if legjobb else (cx0, cy0, s)


S_MAX = 1.25        # vászon-px (2x) -> kimeneti px; a kis betűs valódi képernyőképeken kell az erős közelítés
S_MAX_NEZET = 2.4   # a forgatókönyvben kért kivágásnál / skálánál (apró, alacsony felbontású segédlet-képek)
NYITO_ARANY = 0.9   # a kép első állapota: az első jelölés környéke, csak kicsit távolabbról (k3c2: ne álljon sokáig a teljes széles képen)


def nyito_allapot(r: dict, elso_n, opt: dict | None = None) -> tuple:
    """a kép első kameraállapota: ha van jelölése, az első jelölés környéke kicsit távolabbról (olvasható méret), különben az egész kép"""
    att = attekintes(r)
    if elso_n is None or elso_n not in r["jelek"]:
        return att
    cel = jel_allapot(r, r["jelek"][elso_n], opt)
    # "nyito_arany": 1.0 a jel-bejegyzésben = a kép rögtön a jelölés nézetével nyit (ha a távolabbi nyitókép félbevágna
    # egy feliratot vagy gombot a kép szélén – 2026-11-19)
    s = max(att[2], cel[2] * float((opt or {}).get("nyito_arany", NYITO_ARANY)))
    if s <= att[2] * 1.02:
        return att
    return (cel[0], cel[1], s)


def kamera_korlat(r, cx, cy, s):
    x0, y0, x1, y1 = lap_ter(r)
    vw, vh = VW / s, VH / s
    cx = (x0 + x1) / 2 if vw >= x1 - x0 else min(max(cx, x0 + vw / 2), x1 - vw / 2)
    cy = (y0 + y1) / 2 if vh >= y1 - y0 else min(max(cy, y0 + vh / 2), y1 - vh / 2)
    return cx, cy


def interp(a, b, u):
    return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * u))


class KepSav:
    """Egy kép a jelenetben: mikortól látszik, a kamera kulcskockái és a jelölések ideje."""

    def __init__(self, utm, kep, t0, kamera0):
        self.utm, self.kep, self.t0 = utm, kep, t0
        self.r = KP.retegek(utm, kep)
        self.kam0 = kamera0 or attekintes(self.r)
        self.orokolt = kamera0 is not None
        self.kf = []        # (t_kezd, t_veg, cel)
        self.jelek = []     # (t, n)
        self.uj_lap = []    # "csak_ez": from this time on only the markers shown since then are drawn (k3c2)
        self.pirula_szoveg = {}   # n -> a pirula szövege, ha a forgatókönyv felülírja ("pirula" a jel-bejegyzésben)
        self.elo_pirula = None    # szám nélküli pirula a kép első jelölése előtt ("pirula_elotte" a sorban)
        self.nyugvo = False       # "all": true a jel-bejegyzésben: a nyugvó kamera nem közelít lassan rá (a nézet széle
        #                           szavak / mezők közti keskeny résbe van állítva, a ráközelítés kivinné onnan)

    def kamera(self, t):
        st, utolso = self.kam0, self.t0
        for (a, b, cel) in self.kf:
            if t >= b:
                st, utolso = cel, b
            elif t > a:
                st = interp(st, cel, ease((t - a) / (b - a)))
                utolso = None
                break
            else:
                break
        if utolso is not None and not self.nyugvo:
            drift = 1 + 0.018 * ease(min(1.0, (t - utolso) / 5.0))
            st = (st[0], st[1], st[2] * drift)
        cx, cy = kamera_korlat(self.r, st[0], st[1], st[2])
        return cx, cy, st[2]

    def kep_allapot(self, t):
        """-> (RGB kép, a legutóbbi jel n-je vagy None, a legutóbbi jel átlátszósága)"""
        def lathatok(tt):
            tr = max((x for x in self.uj_lap if x <= tt), default=-1.0)
            return [n for (tj, n) in self.jelek if tr <= tj <= tt]
        lathato = lathatok(t)
        uj = [(tj, n) for (tj, n) in self.jelek if tj <= t < tj + 0.30]
        utolso = max(((tj, n) for (tj, n) in self.jelek if tj <= t), default=None)
        teljes = KP.allapot(self.utm, self.kep, tuple(lathato))
        if uj:
            # a régi állapot = ami közvetlenül az új jelölés ELŐTT látszott: "csak_ez" váltásnál így a korábbi jelölések
            # nem egy kockán tűnnek el, hanem átúsznak az újba (2026-11-19)
            t_uj = min(x[0] for x in uj)
            regi = KP.allapot(self.utm, self.kep, tuple(lathatok(t_uj - 1e-6)))
            a = ease((t - t_uj) / 0.30)
            return (regi, teljes, a), (utolso[1] if utolso else None), a
        return (teljes, None, 1.0), (utolso[1] if utolso else None), 1.0

    def nezet(self, t):
        cx, cy, s = self.kamera(t)
        (img_a, img_b, a), n_utolso, pa = self.kep_allapot(t)
        box = (cx - VW / (2 * s), cy - VH / (2 * s), cx + VW / (2 * s), cy + VH / (2 * s))
        ki = Image.new("RGB", (VW, VH), K.ALAP)
        # csak a képernyőkép lapja látszik (a vászon alatti lista és forrássor nem), a többi alapszín
        lx0, ly0, lx1, ly1 = lap_ter(self.r)
        bx0, by0, bx1, by1 = max(lx0, box[0]), max(ly0, box[1]), min(lx1, box[2]), min(ly1, box[3])
        ox, oy = (bx0 - box[0]) * s, (by0 - box[1]) * s
        tw, th = max(1, round((bx1 - bx0) * s)), max(1, round((by1 - by0) * s))

        def vag(img):
            return img.resize((tw, th), Image.BILINEAR, box=(bx0, by0, bx1, by1), reducing_gap=2.0)
        resz = vag(img_a)
        if img_b is not None:
            resz = Image.blend(resz, vag(img_b), a)
        ki.paste(resz, (round(ox), round(oy)))
        return ki, n_utolso, pa


# ============================================================================================ jelenetek
class Jelenet:
    def __init__(self, nev, fk, js, iv, kep_jelenetek):
        self.nev, self.fk, self.js, self.j = nev, fk, js, js["j"]
        self.t0, self.t1 = js["start"], js["end"]
        self.tipus = self.j["tipus"]
        self.sorok = [s for s in iv["sorok"] if s["jelenet"] == js["i"]]
        self.utm = fk["utmutato"]
        self.kep_index = kep_jelenetek.index(js["i"]) if js["i"] in kep_jelenetek else None
        self.kep_db = len(kep_jelenetek)
        self.savok: list[KepSav] = []
        self.elem_ido = {}
        self.app_ido = {}
        if self.tipus == "kep":
            self._kep_epit()
        else:
            for s in self.sorok:
                for jj in s["sor"].get("jel", []):
                    t = anker_ido(s["sor"], s["start"], s["mp"], jj["szo"], jj.get("kesleltet", 0.0), self.nev)
                    if "elem" in jj:
                        self.elem_ido[jj["elem"]] = t
                    if "app" in jj:
                        self.app_ido[jj["app"]] = t
                    if "zaro_elem" in jj:                   # zárókép: a kiemelt „Intézzük helyetted” kártya megjelenése
                        self.elem_ido[jj["zaro_elem"]] = t

    def _kep_epit(self):
        aktualis = None
        for k, s in enumerate(self.sorok):
            sor = s["sor"]
            if sor.get("kep") and (aktualis is None or sor["kep"] != aktualis.kep):
                tv = self.t0 if aktualis is None else s["start"] - 0.25
                aktualis = self._valt(aktualis, sor["kep"], tv)
            if sor.get("pirula_elotte"):
                aktualis.elo_pirula = sor["pirula_elotte"]
            for jj in sor.get("jel", []):
                tj = anker_ido(sor, s["start"], s["mp"], jj["szo"], jj.get("kesleltet", 0.0), self.nev)
                # "atusztat": ugyanannak a képernyőnek egy változata (pl. a négy választógomb egyike) a jelölésével EGYÜTT
                # úszik be, így az előző kiemelés addig látszik, amíg a következő meg nem jelenik (2026-11-19: a b19 négy
                # kiemelése egyenként csak 0,5–0,8 s-ig látszott, mert a kép előbb váltott, és a jelölés külön érkezett)
                atuszik = bool(jj.get("atusztat")) and bool(jj.get("kep")) and jj["kep"] != aktualis.kep
                if jj.get("kep") and jj["kep"] != aktualis.kep:
                    aktualis = self._valt(aktualis, jj["kep"], tj - (0.20 if atuszik else 0.35))
                jel = aktualis.r["jelek"].get(jj["n"])
                if not jel:
                    continue
                if jj.get("pirula"):
                    aktualis.pirula_szoveg[jj["n"]] = jj["pirula"]
                if jj.get("all"):
                    aktualis.nyugvo = True
                cel = szel_igazit(self.utm, aktualis.kep, aktualis.r, jel_allapot(aktualis.r, jel, jj), jj, jel)
                if atuszik:
                    aktualis.kf.append((aktualis.t0, aktualis.t0 + 0.35, cel))
                    aktualis.jelek.append((aktualis.t0 - 0.31, jj["n"]))
                    continue
                a = max(tj - 0.55, aktualis.kf[-1][1] if aktualis.kf else aktualis.t0 + (0.6 if aktualis.t0 == self.t0 else 0.25))
                b = max(a + 0.35, tj + 0.15)
                if not aktualis.jelek and not aktualis.orokolt:
                    aktualis.kam0 = szel_igazit(self.utm, aktualis.kep, aktualis.r, nyito_allapot(aktualis.r, jj["n"], jj), jj)
                if jj.get("sor_eleje"):
                    # széles asztali sor: előbb a sor eleje (pl. „UJEGYKE”), aztán végigúszik a gombig, és ott jelenik meg a jelölés
                    lx0 = lap_ter(aktualis.r)[0]
                    sor = (lx0 + VW / (2 * cel[2]), cel[1], cel[2])
                    aktualis.kf.append((a, b, sor))
                    b2 = b + float(jj.get("uszas", 1.1))
                    aktualis.kf.append((b + 0.35, b2, cel))
                    aktualis.jelek.append((b2 - 0.15, jj["n"]))
                    continue
                aktualis.kf.append((a, b, cel))
                aktualis.jelek.append((max(tj, a + 0.2), jj["n"]))
                if jj.get("csak_ez"):
                    # the earlier markers of this picture disappear (e.g. a highlighted dropdown row next to the next field)
                    aktualis.uj_lap.append(max(tj, a + 0.2))

    def _valt(self, regi, kep, t):
        kam = None
        if regi is not None:
            uj_r = KP.retegek(self.utm, kep)
            if uj_r["meret"] == regi.r["meret"]:
                kam = regi.kamera(t)
        sav = KepSav(self.utm, kep, t, kam)
        self.savok.append(sav)
        return sav

    def sav_t(self, t):
        aktiv = None
        for i, s in enumerate(self.savok):
            if s.t0 <= t:
                aktiv = i
        return aktiv

    # --- keret adatai
    def keret_adat(self, t):
        fk = self.fk
        if self.tipus == "cim":
            return None
        cim = self.j.get("cim") or ""
        felcim = fk["fejlec"] if self.tipus != "lista" else self.j.get("felcim", fk["fejlec"])
        lepes = f"{self.kep_index + 1}/{self.kep_db}" if self.kep_index is not None else ""
        haladas = (self.kep_db, self.kep_index) if self.kep_index is not None else None
        lab = None
        if self.tipus == "kep" and self.savok:
            i = self.sav_t(t)
            sv = self.savok[i if i is not None else 0]
            lab = {"illusztracio": sv.r["tipus"] == "illusztracio", "szoveg": sv.r["forras"]}
        elif self.tipus == "kartya":
            lab = {"illusztracio": False, "szoveg": self.j.get("forras", "")}
        elif self.tipus == "app":
            lab = {"illusztracio": True, "szoveg": "Így néz ki az alkalmazásban. A valódi képernyő kicsit eltérhet."}
        return cim, felcim, lepes, haladas, lab

    # --- a jelenet képe t-ben (teljes 1080x1920 keret, felirat nélkül) + a pirula
    def kep(self, t):
        if self.tipus == "cim":
            return cim_kep(self.fk, self.j, t - self.t0), None
        cim, felcim, lepes, haladas, lab = self.keret_adat(t)
        img = keret(self.fk, cim, felcim, lepes, haladas, lab).copy()
        pill = None
        if self.tipus == "kep":
            i = self.sav_t(t)
            if i is None:
                i = 0
            sv = self.savok[i]
            nz, n_utolso, pa = sv.nezet(t)
            if i > 0 and t < sv.t0 + 0.40:              # váltás az előző képről
                elozo = self.savok[i - 1]
                nz0, n0, _ = elozo.nezet(t)
                u = ease((t - sv.t0) / 0.40)
                if elozo.r["meret"] == sv.r["meret"]:
                    nz = Image.blend(nz0, nz, u)            # változat (ugyanaz a képernyő): átúszás
                else:
                    x = int(round(u * VW))                  # másik képernyő: tolás balra, mint egy appban
                    uj = Image.new("RGB", (VW, VH), K.ALAP)
                    uj.paste(nz0.crop((x, 0, VW, VH)), (0, 0))
                    if x > 0:
                        uj.paste(nz.crop((0, 0, x, VH)), (VW - x, 0))
                    nz = uj
                    n_utolso = None
            img.paste(nz, (0, VY0))
            if n_utolso is not None:
                jel = sv.r["jelek"][n_utolso]
                pill = (pirula(n_utolso, jel["stilus"], sv.pirula_szoveg.get(n_utolso) or jel["cimke"]), pa)
            elif sv.elo_pirula and not (i > 0 and t < sv.t0 + 0.40):
                # a kép első jelölése előtt: szám nélküli pirula (0,3 s alatt úszik be a kép megjelenése után)
                pill = (pirula(None, "", sv.elo_pirula), ease((t - sv.t0 - (0.40 if i > 0 else 0.45)) / 0.30))
        elif self.tipus == "lista":
            lista_rajz(img, self.j, self.elem_ido, t)
        elif self.tipus == "app":
            app_rajz(img, self.j, self.app_ido, t, self.fk["fejlec"])
        elif self.tipus == "kartya":
            kartya_rajz(img, self.j, t - self.t0)
        elif self.tipus == "zaro":
            zaro_rajz(img, self.j, t - self.t0, self.elem_ido.get("helyettunk"), t)
        return img, pill


def cim_kep(fk, j, dt, poszter=False):
    """címkép = első kocka = poszter (k3c2: a fő videó posztere mintájára). Teljes tintakék kép halvány körökkel, a
    cím-blokk középre zárva és nagyobb betűvel, alatta nagyobb fehér lap a tárgyképpel. A cím az app széles, kb. 1,8:1-es
    borító-vágásában (y ~660–1260) és a 4:5-ös vágásban (y 285–1635) is egészben marad; a 9:16-os bélyegképen olvasható."""
    img = Image.new("RGB", (W, H), K.TINTAKEK)
    d = ImageDraw.Draw(img)
    for r_, a_ in ((640, 14), (450, 10)):                  # halvány körök, mint a fő videó rozettája
        d.ellipse([W / 2 - r_, 820 - r_, W / 2 + r_, 820 + r_], outline=K.KOR_SAVON, width=a_)
    f0 = K.betu(40, 600)
    meret = 112
    while meret > 64:
        f1 = K.betu(meret, 740)
        cim_sorok = tordel(fk["cim"], f1, W - 120)
        if all(f1.getlength(x) <= W - 120 for x in cim_sorok) and len(cim_sorok) <= 3:
            break
        meret -= 4
    f2 = K.betu(48, 540)
    al_sorok = tordel(fk["alcim"], f2, W - 160)
    lh = int(f1.size * 1.14)
    blokk = 66 + len(cim_sorok) * lh + 22 + len(al_sorok) * 62
    y = int(820 - blokk / 2)
    szoveg_kozep(d, W / 2, y, "Videós útmutató", f0, K.FEJLEC_HALVANY)
    y += 66
    for x in cim_sorok:
        szoveg_kozep(d, W / 2, y, x, f1, (255, 255, 255))
        y += lh
    y += 22
    for x in al_sorok:
        szoveg_kozep(d, W / 2, y, x, f2, K.FEJLEC_HALVANY)
        y += 62
    # fehér lap a tárgyképpel a cím alatt; a felirat-sáv (y 1516-tól) fölött véget ér, hogy a felirat ne takarja
    lap_y0 = max(y + 56, 1080)
    lap = [150, lap_y0, W - 150, 1488]
    arnyekos_lap(img, lap, r=40)
    u = ease(min(1.0, dt / 1.2)) if not poszter else 1.0
    sz = int(min(440, (lap[3] - lap[1]) * 1.15) + 12 * u)
    v = vizual(j.get("vizual", "befizetve_pecset"), sz)
    img.paste(v, (int(W / 2 - v.width / 2), int((lap[1] + lap[3]) / 2 - v.height / 2)), v)
    return img


def lista_rajz(img, j, elem_ido, t):
    d = ImageDraw.Draw(img)
    lap = [40, VY0 + 26, W - 40, VY1 - 6]
    arnyekos_lap(img, lap, r=28)
    elemek = j["elemek"]
    sor_h = (lap[3] - lap[1] - 40) / len(elemek)
    f1, f2, ft = K.betu(38, 650), K.betu(29, 480), K.betu(26, 620)
    for i, e in enumerate(elemek):
        te = elem_ido.get(i)
        u = ease((t - te) / 0.35) if te is not None else 0.0
        alfa = 0.30 + 0.70 * u
        y0 = lap[1] + 20 + i * sor_h + (1 - u) * 14
        reteg = Image.new("RGBA", (lap[2] - lap[0], int(sor_h)), (0, 0, 0, 0))
        rd = ImageDraw.Draw(reteg)
        ik = ikon(e["ikon"], 84)
        reteg.paste(ik, (34, int(sor_h / 2 - ik.height / 2)), ik)
        # a megjegyzés a tartalom-oszlopon belül marad: ha nem fér ki (vagy sortörés van benne), két sorba törik, és a
        # blokk feljebb kezdődik (2026-11-19: a „Saját, bérelt, …” sor 22 px-lel túlfutott az oszlopon, a lap széléig)
        megj_sorok = []
        for resz in e["megj"].splitlines():
            megj_sorok += tordel(resz, f2, reteg.width - 150 - 34)
        y_cim = sor_h / 2 - (61 if len(megj_sorok) > 1 else 44)
        rd.text((150, y_cim), e["cim"], font=f1, fill=K.TINTA + (255,))
        for k, ms in enumerate(megj_sorok[:2]):
            rd.text((150, y_cim + 50 + k * 36), ms, font=f2, fill=K.HALVANY + (255,))
        # a címke csak igazat mondhat (2026-11-19, tulaj 4. kérés + 2. kör O3): "Mi nem tároljuk" csak ott, ahol tényleg
        # nem kérjük el (TAJ); az anyukád születési nevét az azonosításnál (Pmt.) elkérjük, ott "cimke": "A NAV tölti ki"
        tx = e.get("cimke") or ("Mi nem tároljuk" if e.get("nem_taroljuk") else None)
        if tx:
            tw = ft.getlength(tx) + 28
            x1 = reteg.width - 30
            rd.rounded_rectangle([x1 - tw, sor_h / 2 - 66, x1, sor_h / 2 - 28], radius=6, fill=K.BOROSTYAN_ALAP + (255,))
            rd.text((x1 - tw + 14, sor_h / 2 - 64), tx, font=ft, fill=K.BOROSTYAN_SOTET + (255,))
        if i < len(elemek) - 1:
            rd.line([(150, sor_h - 2), (reteg.width - 30, sor_h - 2)], fill=K.HAJSZAL + (255,), width=2)
        if alfa < 1:
            a = reteg.getchannel("A").point(lambda p: int(p * alfa))
            reteg.putalpha(a)
        img.paste(reteg, (lap[0], int(y0)), reteg)


def gomb(d, box, szoveg, font, kitolt=K.TINTAKEK, szin=(255, 255, 255)):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=(y1 - y0) // 2, fill=kitolt)
    szoveg_kozep(d, (x0 + x1) / 2, (y0 + y1) / 2 - font.size * 0.62, szoveg, font, szin)


def jel_keret(img, box, n, stilus, alfa):
    """C2 jelölés (keret + számkorong + rövid nyíl) az app-vázlaton, az annotate.py stílusában."""
    r = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(r)
    x0, y0, x1, y1 = box
    szin = K.TINTAKEK if stilus == "tinta" else K.BOROSTYAN
    d.rounded_rectangle(box, radius=24, outline=szin + (255,), width=6)
    R = 30
    cx, cy = x0 - 26 - R, (y0 + y1) / 2
    d.line([(cx + R, cy), (x0 - 6, cy)], fill=szin + (255,), width=5)
    d.polygon([(x0 - 4, cy), (x0 - 18, cy - 10), (x0 - 18, cy + 10)], fill=szin + (255,))
    d.ellipse([cx - R - 4, cy - R - 4, cx + R + 4, cy + R + 4], fill=(255, 255, 255, 255))
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=szin + (255,))
    f = K.betu(34, 760)
    d.text((cx - f.getlength(str(n)) / 2, cy - 22), str(n), font=f, fill=((255, 255, 255) if stilus == "tinta" else K.TINTA) + (255,))
    if alfa < 1:
        r.putalpha(r.getchannel("A").point(lambda p: int(p * alfa)))
    img.paste(r, (0, 0), r)


def app_rajz(img, j, app_ido, t, fejlec=""):
    a = j["app"]
    d = ImageDraw.Draw(img)
    lap = [130, VY0 + 40, W - 130, VY1 - 20]
    arnyekos_lap(img, lap, r=40)
    # a mi appunk sávja a lap tetején
    d.rounded_rectangle([lap[0], lap[1], lap[2], lap[1] + 150], radius=40, fill=K.TINTAKEK)
    d.rectangle([lap[0], lap[1] + 110, lap[2], lap[1] + 150], fill=K.TINTAKEK)
    fh = K.betu(36, 650)
    d.text((lap[0] + 44, lap[1] + 54), a.get("sav") or fejlec, font=fh, fill=(255, 255, 255))
    x0 = lap[0] + 44
    y = lap[1] + 190
    ik = ikon(a["ikon"], 132)
    img.paste(ik, (x0, y), ik)
    y += 160
    f1, f2 = K.betu(48, 700), K.betu(34, 470)
    for s in tordel(a["cim"], f1, lap[2] - lap[0] - 88):
        d.text((x0, y), s, font=f1, fill=K.TINTA)
        y += 62
    y += 8
    for s in tordel(a["szoveg"], f2, lap[2] - lap[0] - 88):
        d.text((x0, y), s, font=f2, fill=K.HALVANY)
        y += 50
    y += 24
    # feltöltő mező (szaggatott, 12 px sarok)
    mezo = [x0, y, lap[2] - 44, y + 150]
    KP.A.szaggatott_keret(d, mezo, K.KERET, 4, 12, 18, 12)
    ik2 = ikon("irat", 70)
    img.paste(ik2, (mezo[0] + 30, int((mezo[1] + mezo[3]) / 2 - ik2.height / 2)), ik2)
    d.text((mezo[0] + 124, (mezo[1] + mezo[3]) / 2 - 22), a.get("mezo", "PDF vagy fotó"), font=K.betu(34, 560), fill=K.TINTAKEK_SZOVEG)
    y = mezo[3] + 40
    gb = [x0, y, lap[2] - 44, y + 116]
    gomb(d, gb, a["gomb"], K.betu(40, 650))
    tg = app_ido.get("gomb")
    if tg is not None and t >= tg - 0.05:
        jel_keret(img, [gb[0] - 14, gb[1] - 14, gb[2] + 14, gb[3] + 14], 1, "tinta", ease((t - tg + 0.05) / 0.3))
    ta = app_ido.get("allapot")
    if ta is not None and t >= ta - 0.1:
        u = ease((t - ta + 0.1) / 0.45)
        kb = [lap[0] + 30, int(lap[3] - 230 + (1 - u) * 60), lap[2] - 30, int(lap[3] - 30 + (1 - u) * 60)]
        r = Image.new("RGBA", img.size, (0, 0, 0, 0))
        rd = ImageDraw.Draw(r)
        rd.rounded_rectangle(kb, radius=24, fill=(255, 255, 255, 255), outline=K.KERET + (255,), width=3)
        ik3 = ikon(a.get("allapot_ikon", "irat"), 92)
        r.paste(ik3, (kb[0] + 30, int((kb[1] + kb[3]) / 2 - ik3.height / 2)), ik3)
        fs = K.betu(36, 600)
        sorok_ = tordel(a["allapot"], fs, kb[2] - kb[0] - 180)
        yy = (kb[1] + kb[3]) / 2 - len(sorok_) * 25
        for s in sorok_:
            rd.text((kb[0] + 146, yy), s, font=fs, fill=K.TINTA + (255,))
            yy += 50
        r.putalpha(r.getchannel("A").point(lambda p: int(p * u)))
        img.paste(r, (0, 0), r)


def kartya_rajz(img, j, dt):
    k = j["kartya"]
    d = ImageDraw.Draw(img)
    lap = [60, VY0 + 40, W - 60, VY1 - 20]
    arnyekos_lap(img, lap, r=36)
    u = ease(min(1.0, dt / 1.0))
    v = vizual(k["vizual"], int(470 + 14 * u))
    f1, fk_, f2, fl = K.betu(60, 720), K.betu(50, 680), K.betu(44, 500), K.betu(36, 620)
    h = 340 + 100 + 104 + 60 * (len(k["sorok"]) - 1) + 40 + 90
    y = (lap[1] + lap[3]) / 2 - h / 2
    img.paste(v, (int(W / 2 - v.width / 2), int(y + 170 - v.height / 2)), v)
    y += 360
    szoveg_kozep(d, W / 2, y, k["cim"], f1, K.TINTA)
    y += 100
    s0 = k["sorok"][0]
    tw = fk_.getlength(s0) + 56
    d.rounded_rectangle([W / 2 - tw / 2, y, W / 2 + tw / 2, y + 78], radius=10, fill=K.BOROSTYAN_ALAP)
    szoveg_kozep(d, W / 2, y + 10, s0, fk_, K.BOROSTYAN_SOTET)
    y += 110
    for s in k["sorok"][1:]:
        szoveg_kozep(d, W / 2, y, s, f2, K.HALVANY)
        y += 60
    y += 40
    lw = fl.getlength(k["link"]) + 64
    gomb(d, [W / 2 - lw / 2, y, W / 2 + lw / 2, y + 88], k["link"], fl, kitolt=GOMB_M_ALAP, szin=K.TINTAKEK_SZOVEG)


def zaro_rajz(img, j, dt, t_helyettunk=None, t=None):
    z = j["zaro"]
    d = ImageDraw.Draw(img)
    lap = [60, VY0 + 40, W - 60, VY1 - 20]
    arnyekos_lap(img, lap, r=36)
    u = ease(min(1.0, dt / 1.0))
    hz = z.get("helyettunk")                       # tulaj 3. kérés (11-19): kiemelt „Intézzük helyetted” kártya
    ik_px = 210 if hz else 250
    h = (ik_px + 30) + 140 + 150 + 70 + (300 if hz else 0)
    y = (lap[1] + lap[3]) / 2 - h / 2
    ik = ikon(z["ikon"], int(ik_px + 10 * u))
    img.paste(ik, (int(W / 2 - ik.width / 2), int(y + (ik_px + 10) / 2 - ik.height / 2)), ik)
    y += ik_px + 40
    szoveg_kozep(d, W / 2, y, z["cim"], K.betu(70, 720), K.TINTA)
    y += 140
    fg = K.betu(46, 650)
    gw = fg.getlength(z["gomb"]) + 130
    gomb(d, [W / 2 - gw / 2, y, W / 2 + gw / 2, y + 128], z["gomb"], fg)
    y += 180
    szoveg_kozep(d, W / 2, y, z["szoveg"], K.betu(44, 520), K.HALVANY)
    if hz and t_helyettunk is not None and t is not None:
        a = ease((t - t_helyettunk) / 0.40)
        if a > 0:
            # az app kártyája (SPEC §27.3.1): fehér lap 6 px-es márkakék kerettel, kapszula-jelvény, tárgykép
            r = Image.new("RGBA", img.size, (0, 0, 0, 0))
            rd = ImageDraw.Draw(r)
            bx = [110, int(y + 84 + (1 - a) * 24), W - 110, int(y + 84 + 268 + (1 - a) * 24)]
            rd.rounded_rectangle(bx, radius=30, fill=(255, 255, 255, 255), outline=K.TINTAKEK + (255,), width=6)
            v = ikon(hz.get("ikon", "igazolas"), 150)          # mint az app KiemeltKartya-ja: 3D „igazolas” ikon
            r.paste(v, (bx[0] + 34, int((bx[1] + bx[3]) / 2 - v.height / 2)), v)
            x0 = bx[0] + 34 + 150 + 30
            fb, f1, f2 = K.betu(30, 650), K.betu(50, 720), K.betu(32, 500)
            bw = fb.getlength(hz["badge"]) + 40
            rd.rounded_rectangle([x0, bx[1] + 34, x0 + bw, bx[1] + 34 + 50], radius=25, fill=GOMB_M_ALAP + (255,))
            rd.text((x0 + 20, bx[1] + 34 + 7), hz["badge"], font=fb, fill=K.TINTAKEK_SZOVEG + (255,))
            rd.text((x0, bx[1] + 100), hz["cim"], font=f1, fill=K.TINTA + (255,))
            for i, sor in enumerate(tordel(hz["al"], f2, bx[2] - 30 - x0)[:2]):
                rd.text((x0, bx[1] + 168 + i * 42), sor, font=f2, fill=K.HALVANY + (255,))
            if a < 1:
                r.putalpha(r.getchannel("A").point(lambda p: int(p * a)))
            img.paste(r, (0, 0), r)


_ZARO_KEP: dict = {}


def zaro_kep(fk, ala, u):
    """tintakék zárókép (a fő videó „Kezdjük is!” képének párja): nagy fehér cím + egy sor; termék- és könyvelőnév nélkül"""
    v = fk.get("vege") or {}
    cim, al = v.get("cim", "Ennyi az egész!"), v.get("al", "Minden lépést leírtunk lent, az útmutatóban.")
    if (cim, al) not in _ZARO_KEP:
        img = Image.new("RGB", (W, H), K.TINTAKEK)
        d = ImageDraw.Draw(img)
        for r_, a_ in ((620, 14), (430, 10)):              # halvány körök, mint a fő videó rozettája
            d.ellipse([W / 2 - r_, H * 0.44 - r_, W / 2 + r_, H * 0.44 + r_], outline=K.KOR_SAVON, width=a_)
        f1 = K.betu(104, 740)
        while f1.getlength(cim) > W - 140 and f1.size > 70:
            f1 = K.betu(f1.size - 4, 740)
        szoveg_kozep(d, W / 2, H * 0.44 - 92, cim, f1, (255, 255, 255))
        f2 = K.betu(46, 520)
        for i, x in enumerate(tordel(al, f2, W - 180)[:2]):
            szoveg_kozep(d, W / 2, H * 0.44 + 54 + i * 64, x, f2, K.FEJLEC_HALVANY)
        _ZARO_KEP[(cim, al)] = img
    z = _ZARO_KEP[(cim, al)]
    u = max(0.0, min(1.0, u))
    return z if u >= 1 else Image.blend(ala, z, ease(u))


# ============================================================================================ hang
CEL_LUFS = -16.0        # video/hang.json "keveres": -16 LUFS integrált
CEL_TP = -1.5           # ... és legfeljebb -1,5 dBTP valódi csúcs – a KÉSZ mp4-ben mérve (az AAC-kódolás UTÁN)
TP_KEVERES = -2.6       # a keverés (WAV) csúcs-plafonja: az AAC 0,3–0,9 dB-t rálő a csúcsokra (2026-11-19: a -1,5-re
#                         kevert hang a kész fájlban -0,6 / -1,2 dBTP lett), ezért a WAV-ot ennyivel lejjebb határoljuk
LUFS_TURES = 0.3


def hang_meres(p: str) -> tuple:
    """-> (integrált hangosság LUFS, valódi csúcs dBTP) egy hang- vagy videófájlra (ffmpeg ebur128)"""
    r = K.futtat(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
                 capture_output=True, text=True, encoding="utf-8", errors="replace")
    return (float(re.findall(r"I:\s*(-?[\d.]+) LUFS", r.stderr)[-1]), float(re.findall(r"Peak:\s*(-?[\d.]+) dBFS", r.stderr)[-1]))


def hang_keveres(nev: str, iv: dict, cel: str, tp: float = TP_KEVERES) -> tuple:
    """a sorok egy sávba + hangosság-normálás -> cel (48 kHz mono WAV); -> (mért LUFS, mért dBTP)"""
    sr = 48000
    n = int(math.ceil(iv["hossz"] * sr)) + sr
    buf = np.zeros(n, dtype=np.float32)
    for s in iv["sorok"]:
        p = f"{K.mappa(nev)}/hang/{s['id']}.wav"
        with wave.open(p) as w:
            assert w.getframerate() == sr and w.getnchannels() == 1
            a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
        i0 = int(round(s["start"] * sr))
        buf[i0:i0 + len(a)] += a[: max(0, n - i0)]
    buf = buf[: int(math.ceil(iv["hossz"] * sr))]
    nyers = cel + ".nyers.wav"
    with wave.open(nyers, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(buf, -1, 1) * 32767).astype(np.int16).tobytes())
    # 1) kétmenetes loudnorm -16 LUFS-re (a beszéd hangosság-ingadozását is simítja; a saját csúcskorlátja -1,5 dBTP),
    # 2) utána valódi csúcshatároló a megadott plafonra (4x túlmintavételezve), mert a kész fájl csúcsát az AAC-kódolás
    #    UTÁN mérjük. Visszamérjük (ebur128), és ha a hangosság LUFS_TURES-nél jobban eltér, a loudnorm célját a
    #    különbséggel eltoljuk (a határoló 0,3–0,4 LU-t elvesz). 2026-11-19: a loudnorm egymaga a plafont nem tartotta
    #    megbízhatóan, és -16 helyett -16,9 LUFS-t adott.
    hatar = 10 ** (tp / 20.0)
    limiter = f"aresample=192000,alimiter=level_in=1:level_out=1:limit={hatar:.4f}:attack=5:release=50:asc=0:level=0"
    cel_i = CEL_LUFS
    for _ in range(5):
        alap = f"loudnorm=I={cel_i:.2f}:TP=-1.5:LRA=11"
        m = K.futtat(["ffmpeg", "-hide_banner", "-nostats", "-i", nyers, "-af", alap + ":print_format=json", "-f", "null", "-"],
                     capture_output=True, text=True, encoding="utf-8", errors="replace")
        t = m.stderr
        js = json.loads(t[t.rindex("{"):t.rindex("}") + 1])
        af = (alap + ":measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
              "measured_thresh={input_thresh}:offset={target_offset}:linear=true").format(**js)
        K.futtat(["ffmpeg", "-y", "-v", "error", "-i", nyers, "-af", af + "," + limiter, "-ar", "48000", "-ac", "1",
                  "-c:a", "pcm_s16le", cel])
        lufs, csucs = hang_meres(cel)
        if abs(lufs - CEL_LUFS) <= LUFS_TURES:
            break
        cel_i += CEL_LUFS - lufs
    return lufs, csucs


# A kép színe (2026-11-19, ellenőrző kör): BT.709, korlátozott tartomány, teljes címkézéssel – ugyanúgy, mint a fő videó
# (bekotes/eszkoz/render.py). Címke nélkül, BT.601 mátrixszal kódolva a böngésző a sávot #0F31E4-nek festette a
# márkakék #1428DB helyett (a poszter és az app sávja mellett látszott az ugrás). accurate_rnd: pontos kerekítés.
SZIN_SZURO = ("scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=bicubic+accurate_rnd+full_chroma_int,"
              "format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709")
SZIN_CIMKE_SZURO = "setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709"
SZIN_CIMKEK = ["-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
# kocka a KÉSZ (BT.709) mp4-ből JPEG-be: a JPEG BT.601 teljes tartomány – átszámolva, különben a kék elcsúszik a képen
JPEG_SZIN = ("scale=in_color_matrix=bt709:out_color_matrix=bt601:in_range=tv:out_range=pc:flags=bicubic+accurate_rnd+full_chroma_int,"
             "format=yuvj420p")

CEL_BAJT = 14_300_000        # a SPEC: <= 15 MB; a kétmenetes kódoló jellemzően 3–5%-kal a cél alatt marad
MAX_BAJT = 15 * 1024 * 1024 - 200_000
QMAX = 38                    # a kvantáló felső korlátja (2026-11-19): enélkül a sebességszabályzó egy kulcskocka után
#   kb. 0,7 s-ra szinte bit nélkül hagyta a képet (szellemképes, szétesett kockák a 78. másodpercnél; a köztes fájlhoz
#   mért SSIM 0,90-re esett). 38-cal a legrosszabb kocka SSIM-je 0,99, a méret 13,7 MB.


def ketmenetes(koztes: str, cel: str, hossz: float, munka: str, hang: str | None = None):
    """kétmenetes H.264 High a megadott méretre (a köztes fájlt a _elonezet/-be teszi, nem törli); ha a kvantáló-korlát
    miatt a fájl mégis a SPEC-határ fölé nőne, kisebb célmérettel újra. hang: a kevert WAV – a hangot ebből kódoljuk
    (egyszer), nem a köztes fájl AAC-sávjából (az kétszeres kódolás volt); None = a köztes fájl hangja (néma változat)."""
    hang_kbps = 128
    log = f"{munka}/x264_2pass"
    cel_bajt = CEL_BAJT
    be2 = ["-i", koztes] + (["-i", hang, "-map", "0:v:0", "-map", "1:a:0"] if hang else [])
    for kor in range(4):
        v_kbps = int(cel_bajt * 8 / 1000 / hossz - hang_kbps - 12)
        kozos = ["-vf", SZIN_CIMKE_SZURO, *SZIN_CIMKEK,
                 "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-tune", "animation", "-b:v", f"{v_kbps}k",
                 "-maxrate", f"{int(v_kbps * 2.2)}k", "-bufsize", f"{int(v_kbps * 4)}k", "-qmax", str(QMAX), "-pix_fmt", "yuv420p",
                 "-g", "90", "-passlogfile", log]
        K.futtat(["ffmpeg", "-y", "-v", "error", "-i", koztes, *kozos, "-pass", "1", "-an", "-f", "null", "-"])
        K.futtat(["ffmpeg", "-y", "-v", "error", *be2, *kozos, "-pass", "2", "-c:a", "aac", "-b:a", f"{hang_kbps}k",
                  "-ar", "48000", "-ac", "1", "-movflags", "+faststart", cel + ".2p.mp4"])
        meret = os.path.getsize(cel + ".2p.mp4")
        if meret <= MAX_BAJT or kor == 3:
            break
        print(f"  kétmenetes: {meret / 1e6:.2f} MB túl nagy, kisebb célmérettel újra", flush=True)
        cel_bajt *= 0.92 * MAX_BAJT / meret
    os.replace(cel + ".2p.mp4", cel)
    os.replace(koztes, f"{munka}/{os.path.basename(cel)[:-4]}_koztes.mp4")
    print(f"  kétmenetes: videó {v_kbps} kb/s, {os.path.getsize(cel) / 1e6:.2f} MB")


def csucs_igazit(nev: str, iv: dict, cel: str, hang: str) -> dict:
    """A KÉSZ mp4 hangját visszaméri. Ha az AAC-kódolás után a valódi csúcs CEL_TP fölött van, a keverés plafonját
    ennyivel (+0,3 dB) lejjebb veszi, újrakeveri, és CSAK a hangsávot cseréli (a kép másolva marad). -> a mért értékek"""
    tp = TP_KEVERES
    lufs, csucs = hang_meres(cel)
    for _ in range(3):
        if csucs <= CEL_TP + 0.05:
            break
        tp -= (csucs - CEL_TP) + 0.3
        print(f"  hang: a kész fájl csúcsa {csucs:.1f} dBTP > {CEL_TP}; újrakeverés {tp:.1f} dBTP plafonnal", flush=True)
        hang_keveres(nev, iv, hang, tp)
        K.futtat(["ffmpeg", "-y", "-v", "error", "-i", cel, "-i", hang, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                  "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", cel + ".hang.mp4"])
        os.replace(cel + ".hang.mp4", cel)
        lufs, csucs = hang_meres(cel)
    print(f"  hang: {lufs:.1f} LUFS, csúcs {csucs:.1f} dBTP a kész fájlban (keverési plafon {tp:.1f} dBTP)", flush=True)
    return {"lufs": lufs, "csucs_dbtp": csucs, "keveres_plafon_dbtp": round(tp, 2)}


# ============================================================================================ fő
def epit(nev: str, elonezet: bool = False, csak_kockak: list | None = None, mod: str | None = None):
    """mod: 'vegleges' (hang/hossz.json + a narráció), 'nema' (becsült időzítés, néma hangsáv, végleges kódolás és
    kimeneti nevek – átmeneti változat, amíg nincs hang), 'elonezet' (gyors, _elonezet/ mappába)"""
    mod = mod or ("elonezet" if elonezet else "vegleges")
    elonezet = mod == "elonezet"
    global RITMUS_BE
    RITMUS_BE = mod == "vegleges"               # a valódi hang ritmusa csak a végleges (narrált) módban ismert
    fk = K.forgatokonyv(nev)
    hossz = hosszak(nev, fk, mod != "vegleges")
    iv = idovonal(nev, fk, hossz)
    kep_jelenetek = [js["i"] for js in iv["jelenetek"] if js["j"]["tipus"] == "kep"]
    jelenetek = [Jelenet(nev, fk, js, iv, kep_jelenetek) for js in iv["jelenetek"]]
    cuek = feliratok(iv, nev)
    ki = K.mappa(nev)
    os.makedirs(f"{ki}/_elonezet", exist_ok=True)
    print(f"{nev}: {iv['hossz']:.1f} s, {len(iv['sorok'])} sor, {len(cuek)} felirat-cue", flush=True)

    def kocka(t):
        aktiv = 0
        for k, jl in enumerate(jelenetek):
            if jl.t0 <= t:
                aktiv = k
        jl = jelenetek[aktiv]
        img, pill = jl.kep(t)
        if aktiv > 0 and t < jl.t0 + ATMENET:
            img0, pill0 = jelenetek[aktiv - 1].kep(t)
            x = int(round(ease((t - jl.t0) / ATMENET) * W))
            uj = Image.new("RGB", (W, H), K.ALAP)
            uj.paste(img0.crop((x, 0, W, H)), (0, 0))
            if x > 0:
                uj.paste(img.crop((0, 0, x, H)), (W - x, 0))
            img, pill = uj, None
        if pill is not None:
            p, a = pill
            if a < 1:
                p = p.copy()
                p.putalpha(p.getchannel("A").point(lambda v: int(v * a)))
            img.paste(p, (int(W / 2 - p.width / 2), PILL_Y), p)
        c = next((c for c in cuek if c["start"] <= t < c["tart"]), None)
        if c is not None:
            cr = felirat_reteg(c["sorok"])
            img.paste(cr, (40, CAP_Y0), cr)
        if t >= iv["hossz"] - ZARO_KEP:                     # zárókép, mint a fő videó végén
            img = zaro_kep(fk, img, (t - (iv["hossz"] - ZARO_KEP)) / 0.12)   # szinte vágás: nem úszik rá az „Elakadtál?” kártyára
        return img

    if csak_kockak is not None:
        out = []
        for t in csak_kockak:
            out.append(kocka(t))
        return out, iv
    n_kocka = int(math.ceil(iv["hossz"] * FPS))
    if elonezet:
        cel = f"{ki}/_elonezet/{nev}_elonezet.mp4"
        hang_be = ["-f", "lavfi", "-t", f"{iv['hossz']:.3f}", "-i", "anullsrc=r=48000:cl=mono"]
        kod = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26"]
    else:
        cel = f"{ki}/{nev}.mp4"
        if mod == "nema":
            hang_be = ["-f", "lavfi", "-t", f"{iv['hossz']:.3f}", "-i", "anullsrc=r=48000:cl=mono"]
        else:
            hang = f"{ki}/_elonezet/{nev}_hang.wav"
            hang_keveres(nev, iv, hang)
            hang_be = ["-i", hang]
        kod = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "14"]          # köztes, jó minőség; utána kétmenetes
    hang_wav = None if (elonezet or mod == "nema") else hang       # a végleges kódolás hangja közvetlenül a WAV-ból
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           *hang_be, "-map", "0:v", "-map", "1:a", "-vf", SZIN_SZURO, *SZIN_CIMKEK, *kod, "-pix_fmt", "yuv420p", "-g", "60",
           "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", "-shortest", cel + ".tmp.mp4"]
    import time as _t
    t0 = _t.time()
    PROBAK = 4
    for kiserlet in range(PROBAK):
        # ha a kódoló menet közben leáll (2026-11-19: „Cannot allocate memory”, mert más munkák foglalták a gépet),
        # várunk és elölről kezdjük a kockák küldését – a hang, az átiratok és a képek gyorsítótárban vannak
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        try:
            for i in range(n_kocka):
                p.stdin.write(kocka(i / FPS).tobytes())
                if i % 300 == 0:
                    print(f"  kocka {i}/{n_kocka} ({_t.time() - t0:.0f} s)", flush=True)
            p.stdin.close()
            rc = p.wait()
        except (BrokenPipeError, OSError, MemoryError) as e:
            try:
                p.stdin.close()
            except Exception:  # noqa: BLE001
                pass
            try:
                p.wait(timeout=60)
            except Exception:  # noqa: BLE001
                p.kill()
            rc = p.returncode or 1
            print(f"  a kódoló leállt a(z) {i}. kockánál ({type(e).__name__})", flush=True)
            KP._ALLAPOT.clear()
            _KERET.clear()
            _CAP.clear()
        if rc == 0:
            break
        if kiserlet == PROBAK - 1:
            raise SystemExit("ffmpeg hiba (többszöri próbára is)")
        varj = 45 * (kiserlet + 1)
        print(f"  ffmpeg hiba (kód {rc}) – valószínűleg átmeneti memóriahiány; {varj} s múlva újra ({kiserlet + 2}/{PROBAK})", flush=True)
        _t.sleep(varj)
    hang_mert = None
    if elonezet:
        os.replace(cel + ".tmp.mp4", cel)
    else:
        ketmenetes(cel + ".tmp.mp4", cel, iv["hossz"], f"{ki}/_elonezet", hang_wav)
        if hang_wav:
            hang_mert = csucs_igazit(nev, iv, cel, hang_wav)
    if not elonezet:
        vtt(cuek, f"{ki}/{nev}.vtt")
        poszter = cim_kep(fk, fk["jelenetek"][0], 9, poszter=True).convert("RGB")
        poszter.save(f"{ki}/{nev}_poszter.jpg", quality=86, optimize=True, progressive=True)
        json.dump({"mod": mod, "hossz_mp": round(iv["hossz"], 2), "hang": hang_mert,
                   "sorok": [{"id": s["id"], "start": round(s["start"], 3), "end": round(s["end"], 3)} for s in iv["sorok"]]},
                  open(f"{ki}/_elonezet/idovonal.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"kész: {cel} ({_t.time() - t0:.0f} s)")
    return cel


if __name__ == "__main__":
    nev = sys.argv[1]
    epit(nev, mod="elonezet" if "--elonezet" in sys.argv else ("nema" if "--nema" in sys.argv else "vegleges"))
