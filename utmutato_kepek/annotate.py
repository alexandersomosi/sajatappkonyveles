"""Jelölt NAV-képek készítése az index.json-ok alapján (Kézjegy, C2 stílus).

Egy paranccsal újrajelöli az összes útmutató-képet:

    python annotate.py                      # mindkét útmutató, minden lépés
    python annotate.py meghatalmazas        # csak az egyik útmutató
    python annotate.py meghatalmazas 05     # egy lépés (sorszám vagy slug)
    python annotate.py --racs vallalkozas_bejelentes 04   # koordináta-rács a forrásképre (_elonezet/racs_...png)
    python annotate.py --elonezet           # áttekintő lap útmutatónként (_elonezet/)

Mit csinál lépésenként (index.json -> lepesek[]):
  1. Forráskép: ha van saját (tulaj által készített) kép: _sajat/<útmutató>/<NN>_<slug>.png (vagy a lépés
     "sajat.kep" mezője), azt használja a "sajat" blokk vágásával/elmosásával/jelöléseivel; különben az "alap" blokkot.
  2. Elmosás/takarás (homalyos, takar, piros_ki) -> vágás -> nagyítás a lap szélességére (2160 px-es vásznon).
  3. C2-jelölések: lekerekített keret (tintakék = koppints/kattints, borostyán = ezt jelöld/írd be,
     szaggatott = hagyd üresen / ne jelöld), mellette számozott korong rövid nyíllal; a feliratok (Geist) számozott
     sorokban a lap alatt, hogy ne takarjanak ki semmit a képernyőn. "jel_meret" = a jelölések nagyítása (pl. 1.7).
  4. Alul forrás-sor; a rajzolt képeken „Illusztráció” címke.
  5. Kimenet: <útmutató>/<NN>_<slug>@2x.png (2160 px) és <NN>_<slug>.png (1080 px), és az index.json-ba
     visszaírja a kimenet méretét és a jelölések helyét a kimeneti képen (0–1 arányban, a videóhoz).

Saját (tulaj) képernyőképnél kötelező a "sajat.homalyos" lista (a személyes adataid helye; ha nincs rajta
személyes adat, írd be: "homalyos": []). Enélkül a lépést kihagyja, hogy ne kerüljön ki kitakaratlan adat.
Ha a "sajat.jelolesek" még üres, a képet keretek nélkül, csak a számozott feliratokkal készíti el, és figyelmeztet:
ilyenkor futtasd a --racs módot, olvasd le a koordinátákat, és írd be őket.

Kell: Python 3.9+, Pillow (pip install pillow). A numpy és az opencv-python nem kötelező (a piros NAV-keretek
eltüntetése szebb velük). A betűk: _betu/Geist_wght.ttf (SIL OFL 1.1).
"""
from __future__ import annotations

import datetime as _dt
import json
import math
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

try:  # nem kötelező
    import numpy as np
except Exception:  # pragma: no cover
    np = None
try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

GYOKER = os.path.dirname(os.path.abspath(__file__))
UTMUTATOK = ['vallalkozas_bejelentes', 'meghatalmazas']
BETU = os.path.join(GYOKER, '_betu', 'Geist_wght.ttf')

# --- C2 tokenek (dizajn/C2_modern/app_v2/tokens.css) + a kék paletta (tulaj 11-18 17:50: dizajn/C3_zold/kek.css, dizajn/PALETTA.md) ---------------------------------------------------------------
TINTAKEK = (20, 40, 219)       # --tintakek #1428DB (a régi tintakék #17284A: _regi/annotate.py_elotte_kek_1817)
TINTA = (16, 21, 43)           # --tinta #10152B
ALAP = (228, 232, 243)         # --alap #E4E8F3
HALVANY = (74, 82, 112)        # --halvany-alapon #4A5270
KERET = (201, 208, 228)        # --keret #C9D0E4 (a lap körvonala)
ARNYEK = (16, 21, 60)          # árnyék (tokens: rgba(16,21,60,…)) – nem a márkakék, hogy ne derengjen kéken
BOROSTYAN = (224, 150, 20)     # jelölő borostyán (a --borostyan #845300 világosabb párja, hogy képernyőképen is látsszon)
BOROSTYAN_ALAP = (247, 232, 198)  # --borostyan-alap #F7E8C6
FEHER = (255, 255, 255)

W2 = 2160          # a @2x kép szélessége
MARGO = 56         # a lap körüli alap-sáv
LAP_R = 30         # a lap sarka
SZINEK = {
    'tinta': {'vonal': TINTAKEK, 'kitolt': TINTAKEK + (18,), 'korong': TINTAKEK, 'szam': FEHER, 'cimke_hatter': TINTAKEK, 'cimke_szoveg': FEHER, 'szaggatott': False},
    'borostyan': {'vonal': BOROSTYAN, 'kitolt': BOROSTYAN + (34,), 'korong': BOROSTYAN, 'szam': TINTA, 'cimke_hatter': BOROSTYAN_ALAP, 'cimke_szoveg': TINTA, 'cimke_keret': BOROSTYAN, 'szaggatott': False},
    'ures': {'vonal': TINTAKEK, 'kitolt': None, 'korong': (106, 117, 138), 'szam': FEHER, 'cimke_hatter': FEHER, 'cimke_szoveg': TINTA, 'cimke_keret': TINTAKEK, 'szaggatott': True},
}


def betu(meret: int, suly: int = 600) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(BETU, meret)
    try:
        f.set_variation_by_axes([suly])
    except Exception:
        pass
    return f


# --- segédek --------------------------------------------------------------------------------------------------------
def hely_feloldas(ertek, helyek: dict):
    """[x0,y0,x1,y1] | "@kulcs" | ["@a", "@b"] (unió) -> [x0,y0,x1,y1] a forráskép pixelében."""
    if ertek is None:
        return None
    if isinstance(ertek, str):
        if not ertek.startswith('@'):
            raise ValueError(f'ismeretlen hely: {ertek}')
        r = helyek.get(ertek[1:])
        if not r:
            raise ValueError(f'nincs ilyen hely a forrás .json-jában: {ertek}')
        return list(r)
    if isinstance(ertek, list) and ertek and isinstance(ertek[0], str):
        rs = [hely_feloldas(e, helyek) for e in ertek]
        return [min(r[0] for r in rs), min(r[1] for r in rs), max(r[2] for r in rs), max(r[3] for r in rs)]
    return [float(v) for v in ertek]


def homalyosit(kep: Image.Image, r) -> None:
    x0, y0, x1, y1 = [int(round(v)) for v in r]
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(kep.width, x1), min(kep.height, y1)
    if x1 <= x0 or y1 <= y0:
        return
    resz = kep.crop((x0, y0, x1, y1))
    blokk = max(6, (y1 - y0) // 3)
    kicsi = resz.resize((max(1, (x1 - x0) // blokk), max(1, (y1 - y0) // blokk)), Image.BILINEAR)
    resz = kicsi.resize(resz.size, Image.NEAREST).filter(ImageFilter.GaussianBlur(max(4, (y1 - y0) / 4)))
    kep.paste(resz, (x0, y0))


def takar(kep: Image.Image, r, szin=(214, 219, 227)) -> None:
    d = ImageDraw.Draw(kep)
    x0, y0, x1, y1 = r
    d.rounded_rectangle([x0, y0, x1, y1], radius=max(2, int((y1 - y0) / 2)), fill=tuple(szin))


def piros_ki(kep: Image.Image, r) -> None:
    """A NAV saját piros kiemelő kereteit eltünteti a megadott területen (hogy ne keveredjenek a mi jelöléseinkkel)."""
    x0, y0, x1, y1 = [int(round(v)) for v in r]
    resz = kep.crop((x0, y0, x1, y1)).convert('RGB')
    if np is None:
        px = resz.load()
        for y in range(resz.height):
            for x in range(resz.width):
                rr, gg, bb = px[x, y]
                if rr > 170 and gg < 130 and bb < 130 and rr - gg > 70:
                    px[x, y] = (255, 255, 255)
        kep.paste(resz, (x0, y0))
        return
    a = np.asarray(resz).astype(int)
    maszk = ((a[:, :, 0] > 170) & (a[:, :, 1] < 140) & (a[:, :, 2] < 140) & (a[:, :, 0] - a[:, :, 1] > 70)).astype('uint8') * 255
    if cv2 is not None:
        maszk = cv2.dilate(maszk, np.ones((3, 3), np.uint8), iterations=2)
        kesz = cv2.inpaint(np.asarray(resz)[:, :, ::-1].copy(), maszk, 3, cv2.INPAINT_TELEA)[:, :, ::-1]
        kep.paste(Image.fromarray(kesz.astype('uint8')), (x0, y0))
    else:
        b = np.asarray(resz).copy()
        b[maszk > 0] = (255, 255, 255)
        kep.paste(Image.fromarray(b), (x0, y0))


def kivag_szelekkel(kep: Image.Image, r) -> Image.Image:
    """Vágás; ha a terület kilóg a képből, a széleket a szélső pixelsor/oszlop nyújtásával pótolja
    (így a számkorongoknak jut hely a keret mellett, és a kiegészítés nem látszik külön sávnak)."""
    x0, y0, x1, y1 = r
    bal, fent = max(0, -x0), max(0, -y0)
    jobb, lent = max(0, x1 - kep.width), max(0, y1 - kep.height)
    if bal or fent or jobb or lent:
        uj = Image.new('RGB', (kep.width + bal + jobb, kep.height + fent + lent))
        uj.paste(kep, (bal, fent))
        if bal:
            uj.paste(kep.crop((0, 0, 1, kep.height)).resize((bal, kep.height)), (0, fent))
        if jobb:
            uj.paste(kep.crop((kep.width - 1, 0, kep.width, kep.height)).resize((jobb, kep.height)), (bal + kep.width, fent))
        if fent:
            uj.paste(uj.crop((0, fent, uj.width, fent + 1)).resize((uj.width, fent)), (0, 0))
        if lent:
            uj.paste(uj.crop((0, fent + kep.height - 1, uj.width, fent + kep.height)).resize((uj.width, lent)), (0, fent + kep.height))
        kep = uj
        x0, y0, x1, y1 = x0 + bal, y0 + fent, x1 + bal, y1 + fent
    return kep.crop((max(0, x0), max(0, y0), min(kep.width, x1), min(kep.height, y1)))


def tordeles(szoveg: str, font, max_szel: int) -> list[str]:
    sorok, sor = [], ''
    for szo in szoveg.split():
        proba = (sor + ' ' + szo).strip()
        if font.getlength(proba) <= max_szel or not sor:
            sor = proba
        else:
            sorok.append(sor)
            sor = szo
    if sor:
        sorok.append(sor)
    return sorok


def szaggatott_keret(d: ImageDraw.ImageDraw, r, szin, vastag, sugar, hossz=26, res=16):
    x0, y0, x1, y1 = r
    # egyenes szakaszok szaggatva, a sarkok ívei teljesen
    def szakasz(ax, ay, bx, by):
        L = math.hypot(bx - ax, by - ay)
        n = max(1, int(L // (hossz + res)))
        for i in range(n + 1):
            t0 = i * (hossz + res) / L
            t1 = min(1, (i * (hossz + res) + hossz) / L)
            if t0 >= 1:
                break
            d.line([(ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)], fill=szin, width=vastag)
    szakasz(x0 + sugar, y0, x1 - sugar, y0)
    szakasz(x0 + sugar, y1, x1 - sugar, y1)
    szakasz(x0, y0 + sugar, x0, y1 - sugar)
    szakasz(x1, y0 + sugar, x1, y1 - sugar)
    for (cx, cy, kezd) in [(x0 + sugar, y0 + sugar, 180), (x1 - sugar, y0 + sugar, 270), (x1 - sugar, y1 - sugar, 0), (x0 + sugar, y1 - sugar, 90)]:
        d.arc([cx - sugar, cy - sugar, cx + sugar, cy + sugar], kezd, kezd + 90, fill=szin, width=vastag)


def tomor_keret(d: ImageDraw.ImageDraw, r, szin, k: float) -> None:
    """Tömör jelölőkeret + belső fehér hajszálvonal (11-18, kék paletta): a #1428DB keret a NAV saját sötétkék gombjával
    majdnem azonos világosságú, a fehér vonal választja el tőle. A videó (kepek.py) is ezt hívja, a kettő pixelre egyezik."""
    v = int(9 * k)
    d.rounded_rectangle(r, radius=int(22 * k), outline=szin + (255,), width=v)
    f = max(2, int(3 * k))
    if r[2] - r[0] > 2 * (v + f) + 4 and r[3] - r[1] > 2 * (v + f) + 4:
        d.rounded_rectangle([r[0] + v, r[1] + v, r[2] - v, r[3] - v], radius=max(1, int(22 * k) - v), outline=FEHER + (255,), width=f)


def nyil(d: ImageDraw.ImageDraw, a, b, szin, vastag=7, fej=26):
    ax, ay = a
    bx, by = b
    L = math.hypot(bx - ax, by - ay)
    if L < 8:
        return
    ux, uy = (bx - ax) / L, (by - ay) / L
    tx, ty = bx - ux * fej, by - uy * fej
    d.line([(ax, ay), (tx, ty)], fill=szin, width=vastag)
    px, py = -uy, ux
    d.polygon([(bx, by), (tx + px * fej * 0.62, ty + py * fej * 0.62), (tx - px * fej * 0.62, ty - py * fej * 0.62)], fill=szin)


def metszes(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


# --- egy lépés -------------------------------------------------------------------------------------------------------
class Kihagyva(Exception):
    pass


def forras_valasztas(utmutato: str, lepes: dict):
    nn = f"{lepes['sorszam']:02d}"
    sajat_blokk = lepes.get('sajat') or {}
    jelolt = sajat_blokk.get('kep') or os.path.join('_sajat', utmutato, f"{nn}_{lepes['slug']}.png")
    utvonal = os.path.join(GYOKER, jelolt)
    if os.path.exists(utvonal):
        if sajat_blokk.get('homalyos') is None:
            raise Kihagyva(f'saját kép van ({jelolt}), de a "sajat.homalyos" lista hiányzik – előbb jelöld meg a személyes adatokat')
        return 'sajat', utvonal, sajat_blokk
    alap = lepes['alap']
    return 'alap', os.path.join(GYOKER, alap['kep']), alap


def lepes_kep(utmutato: str, lepes: dict, irj_vissza=True) -> dict:
    honnan, utvonal, blokk = forras_valasztas(utmutato, lepes)
    kep = Image.open(utvonal).convert('RGB')
    helyek = {}
    jsonut = os.path.splitext(utvonal)[0] + '.json'
    if os.path.exists(jsonut):
        with open(jsonut, encoding='utf-8') as f:
            helyek = json.load(f).get('helyek', {}) or {}
    helyek = {k: v for k, v in helyek.items() if v and (v[2] - v[0]) > 0}

    # 1) elmosás, takarás, piros keretek
    for r in blokk.get('piros_ki') or []:
        piros_ki(kep, hely_feloldas(r, helyek))
    for r in blokk.get('takar') or []:
        takar(kep, hely_feloldas(r, helyek))
    for r in blokk.get('homalyos') or []:
        homalyosit(kep, hely_feloldas(r, helyek))

    # 2) vágás + nagyítás
    v = blokk.get('vagas')
    if isinstance(v, list) and len(v) == 4 and not isinstance(v[0], str):
        v = [0 if v[0] is None else v[0], 0 if v[1] is None else v[1], kep.width if v[2] is None else v[2], kep.height if v[3] is None else v[3]]
    vagas = hely_feloldas(v, helyek) or [0, 0, kep.width, kep.height]
    vagas = [int(round(x)) for x in vagas]
    kep = kivag_szelekkel(kep, vagas)
    # bővítés a kivágott kép szélein (hely a számkorongoknak): [bal, fent, jobb, lent] px, a szélső
    # pixelsor nyújtásával, vagy egyszínűen, ha "kitoltes" (pl. "#FFFFFF") meg van adva
    bov = blokk.get('bovites') or [0, 0, 0, 0]
    if any(bov):
        kit = blokk.get('kitoltes')
        szin = tuple(int(kit.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) if kit else None
        uj = Image.new('RGB', (kep.width + bov[0] + bov[2], kep.height + bov[1] + bov[3]), szin or (255, 255, 255))
        uj.paste(kep, (bov[0], bov[1]))
        if szin is None:
            if bov[0]:
                uj.paste(kep.crop((0, 0, 1, kep.height)).resize((bov[0], kep.height)), (0, bov[1]))
            if bov[2]:
                uj.paste(kep.crop((kep.width - 1, 0, kep.width, kep.height)).resize((bov[2], kep.height)), (bov[0] + kep.width, bov[1]))
            if bov[1]:
                uj.paste(uj.crop((0, bov[1], uj.width, bov[1] + 1)).resize((uj.width, bov[1])), (0, 0))
            if bov[3]:
                uj.paste(uj.crop((0, bov[1] + kep.height - 1, uj.width, bov[1] + kep.height)).resize((uj.width, bov[3])), (0, bov[1] + kep.height))
        kep = uj
        vagas = [vagas[0] - bov[0], vagas[1] - bov[1], vagas[2] + bov[2], vagas[3] + bov[3]]
    lap_w = W2 - 2 * MARGO
    s = lap_w / kep.width
    lap_h = int(round(kep.height * s))
    nagy = kep.resize((lap_w, lap_h), Image.LANCZOS)
    if s > 1.15:
        nagy = nagy.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))

    def at(r):  # forrás-pixel -> lap-pixel
        return [(r[0] - vagas[0]) * s, (r[1] - vagas[1]) * s, (r[2] - vagas[0]) * s, (r[3] - vagas[1]) * s]

    jelolesek = (blokk.get('jelolesek') or []) if honnan == 'sajat' else (lepes.get('jelolesek') or [])
    jelolesek = [dict(j) for j in jelolesek]
    jelolessel = bool(jelolesek)
    if honnan == 'sajat' and not jelolesek:
        jelolesek = [dict(j, doboz=None) for j in lepes.get('jelolesek', [])]
        print(f'  ! {utmutato} {lepes["sorszam"]:02d}: saját kép jelölés nélkül – a feliratok a lap alá kerültek (használd a --racs módot)')

    # 3) a jelölések helye a lapon
    lap_ter = [MARGO, MARGO, MARGO + lap_w, MARGO + lap_h]
    dobozok = []
    for j in jelolesek:
        if j.get('doboz') is None:
            dobozok.append(None)
            continue
        r = at(hely_feloldas(j['doboz'], helyek))
        p = j.get('parna', 12)
        r = [r[0] - p + MARGO, r[1] - p + MARGO, r[2] + p + MARGO, r[3] + p + MARGO]
        r = [max(lap_ter[0] + 6, r[0]), max(lap_ter[1] + 6, r[1]), min(lap_ter[2] - 6, r[2]), min(lap_ter[3] - 6, r[3])]
        dobozok.append(r)

    # 4) vászon: lap + jelmagyarázat (számozott sorok) + lábléc
    k = float(blokk.get('jel_meret') or lepes.get('jel_meret') or 1.0)  # a jelölések mérete a kép tartalmához
    font_lista = betu(56, 600)
    font_lista_szam = betu(44, 760)
    font_szam = betu(int(42 * k), 760)
    font_lab = betu(38, 520)
    font_jelveny = betu(38, 680)
    illusztracio = (lepes.get('tipus') == 'illusztracio') and honnan == 'alap'
    forras_sor = (lepes.get('forras_rovid') or '') if honnan == 'alap' else f"Saját képernyőkép, {_dt.date.fromtimestamp(os.path.getmtime(utvonal)).isoformat()}"
    jelveny_w = (font_jelveny.getlength('Illusztráció') + 44 + 22) if illusztracio else 0
    lab_sorok = tordeles(forras_sor, font_lab, W2 - 2 * MARGO - jelveny_w - 8)
    R_L = 36
    lista = []  # (jelölés, sorok)
    for j in jelolesek:
        if j.get('cimke'):
            lista.append((j, tordeles(j['cimke'], font_lista, W2 - 2 * MARGO - 2 * R_L - 40)))
    lista_h = (34 + sum(max(1, len(s_)) * 70 + 22 for _, s_ in lista)) if lista else 0
    lab_h = 30 + max(len(lab_sorok) * 50, 56 if illusztracio else 0) + 26
    H = MARGO + lap_h + lista_h + lab_h
    vaszon = Image.new('RGB', (W2, H), ALAP)
    arnyek = Image.new('L', (W2, H), 0)
    ImageDraw.Draw(arnyek).rounded_rectangle([MARGO, MARGO + 14, MARGO + lap_w, MARGO + lap_h + 14], radius=LAP_R, fill=70)
    arnyek = arnyek.filter(ImageFilter.GaussianBlur(22))
    vaszon.paste(Image.new('RGB', (W2, H), ARNYEK), (0, 0), arnyek)
    maszk = Image.new('L', (lap_w, lap_h), 0)
    ImageDraw.Draw(maszk).rounded_rectangle([0, 0, lap_w - 1, lap_h - 1], radius=LAP_R, fill=255)
    vaszon.paste(nagy, (MARGO, MARGO), maszk)
    ImageDraw.Draw(vaszon).rounded_rectangle([MARGO, MARGO, MARGO + lap_w - 1, MARGO + lap_h - 1], radius=LAP_R, outline=KERET, width=2)

    # 5) keretek, számkorongok, rövid nyilak (RGBA rétegen)
    reteg = Image.new('RGBA', (W2, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(reteg)
    for j, r in zip(jelolesek, dobozok):
        if r is None:
            continue
        st = SZINEK[j.get('stilus', 'tinta')]
        if st['kitolt']:
            d.rounded_rectangle(r, radius=int(22 * k), fill=st['kitolt'])
        if st['szaggatott']:
            szaggatott_keret(d, r, st['vonal'] + (235,), int(7 * k), int(22 * k), int(26 * k), int(16 * k))
        else:
            tomor_keret(d, r, st['vonal'], k)
    kimeneti = []
    R = int(36 * k)
    RES = int(52 * k)  # a korong és a keret közti rés (ide jön a rövid nyíl)
    korongok = []
    for j, r in zip(jelolesek, dobozok):
        if r is None:
            continue
        st = SZINEK[j.get('stilus', 'tinta')]
        cy_bal = r[1] + min(R + 10, (r[3] - r[1]) / 2)
        jeloltek = {
            'bal': (r[0] - RES - R, cy_bal, (r[0] - RES, cy_bal), (r[0] - 4, cy_bal)),
            'jobb': (r[2] + RES + R, cy_bal, (r[2] + RES, cy_bal), (r[2] + 4, cy_bal)),
            'fent': (r[0] + R + 14, r[1] - RES - R, (r[0] + R + 14, r[1] - RES), (r[0] + R + 14, r[1] - 4)),
            'lent': (r[0] + R + 14, r[3] + RES + R, (r[0] + R + 14, r[3] + RES), (r[0] + R + 14, r[3] + 4)),
        }
        sorrend = [j.get('szam_hely', 'bal'), 'bal', 'jobb', 'lent', 'fent']
        hely = None
        for oldal in sorrend:
            cx, cy, a, b = jeloltek[oldal]
            kor = [cx - R - 5, cy - R - 5, cx + R + 5, cy + R + 5]
            belul = kor[0] >= lap_ter[0] + 4 and kor[2] <= lap_ter[2] - 4 and kor[1] >= lap_ter[1] + 4 and kor[3] <= lap_ter[3] - 4
            utkozik = any(metszes(kor, o) for o in korongok) or any(metszes(kor, o) for o in dobozok if o is not None and o is not r)
            if belul and not utkozik:
                hely = (cx, cy, a, b)
                break
        if hely is None:  # nincs hely kívül: a keret bal felső sarkára
            hely = (min(max(r[0] + 6, lap_ter[0] + R + 8), lap_ter[2] - R - 8), min(max(r[1] + 6, lap_ter[1] + R + 8), lap_ter[3] - R - 8), None, None)
        cx, cy, a, b = hely
        if a is not None:
            nyil(d, a, b, st['vonal'] + (255,), int(7 * k), int(26 * k))
        d.ellipse([cx - R - 5, cy - R - 5, cx + R + 5, cy + R + 5], fill=FEHER + (255,))
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=st['korong'] + (255,))
        szam = str(j['n'])
        d.text((cx - font_szam.getlength(szam) / 2, cy - 26 * k), szam, font=font_szam, fill=st['szam'] + (255,))
        korongok.append([cx - R - 5, cy - R - 5, cx + R + 5, cy + R + 5])
        kimeneti.append({'n': j['n'], 'stilus': j.get('stilus', 'tinta'), 'cimke': j.get('cimke'),
                         'doboz': [round(r[0] / W2, 4), round(r[1] / H, 4), round(r[2] / W2, 4), round(r[3] / H, 4)],
                         'korong': [round(cx / W2, 4), round(cy / H, 4)]})
    vaszon.paste(reteg, (0, 0), reteg)

    # 6) jelmagyarázat és lábléc
    dv = ImageDraw.Draw(vaszon)
    y = MARGO + lap_h + 34
    for j, sorok in lista:
        st = SZINEK[j.get('stilus', 'tinta')]
        cx, cy = MARGO + R_L + 4, y + 37
        if st['szaggatott']:
            dv.ellipse([cx - R_L, cy - R_L, cx + R_L, cy + R_L], fill=FEHER, outline=st['vonal'], width=4)
            szin = TINTA
        else:
            dv.ellipse([cx - R_L, cy - R_L, cx + R_L, cy + R_L], fill=st['korong'])
            szin = st['szam']
        szam = str(j['n'])
        dv.text((cx - font_lista_szam.getlength(szam) / 2, cy - 27), szam, font=font_lista_szam, fill=szin)
        for i, s_ in enumerate(sorok):
            dv.text((MARGO + 2 * R_L + 34, y + 4 + i * 70), s_, font=font_lista, fill=TINTA)
        y += max(1, len(sorok)) * 70 + 22
    y = MARGO + lap_h + lista_h + 30
    x = MARGO + 4
    if illusztracio:
        jt = 'Illusztráció'
        jw = font_jelveny.getlength(jt) + 44
        dv.rounded_rectangle([x, y - 4, x + jw, y + 52], radius=28, fill=BOROSTYAN_ALAP, outline=BOROSTYAN, width=3)
        dv.text((x + 22, y + 2), jt, font=font_jelveny, fill=TINTA)
        x += jw + 22
    for i, s_ in enumerate(lab_sorok):
        dv.text((x, y + 2 + i * 50), s_, font=font_lab, fill=HALVANY)

    # 7) mentés
    nn = f"{lepes['sorszam']:02d}"
    cel = os.path.join(GYOKER, utmutato)
    os.makedirs(cel, exist_ok=True)
    f2 = f"{nn}_{lepes['slug']}@2x.png"
    f1 = f"{nn}_{lepes['slug']}.png"
    for nev in (f1, f2):  # régi változat a _regi mappába (nem törlünk)
        ut = os.path.join(cel, nev)
        if os.path.exists(ut):
            regi = os.path.join(GYOKER, '_regi', utmutato)
            os.makedirs(regi, exist_ok=True)
            shutil.move(ut, os.path.join(regi, f"{os.path.splitext(nev)[0]}_{_dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"))
    vaszon.save(os.path.join(cel, f2), optimize=True)
    egy = vaszon.resize((W2 // 2, round(H / 2)), Image.LANCZOS)
    egy.save(os.path.join(cel, f1), optimize=True)
    return {'fajl': f1, 'fajl_2x': f2, 'szel': W2 // 2, 'mag': round(H / 2), 'szel_2x': W2, 'mag_2x': H,
            'forras_hasznalt': honnan, 'tipus': 'valodi' if honnan == 'sajat' else lepes.get('tipus'),
            'jelolesek_kimeneten': kimeneti}


# --- rács a koordinátákhoz -------------------------------------------------------------------------------------------
def racs(utmutato: str, lepes: dict):
    try:
        honnan, utvonal, _ = forras_valasztas(utmutato, lepes)
    except Kihagyva:
        nn = f"{lepes['sorszam']:02d}"
        utvonal = os.path.join(GYOKER, '_sajat', utmutato, f"{nn}_{lepes['slug']}.png")
        honnan = 'sajat'
    kep = Image.open(utvonal).convert('RGB')
    d = ImageDraw.Draw(kep)
    lepeskoz = 100 if kep.width < 2500 else 200
    f = betu(max(18, kep.width // 90), 600)
    for x in range(0, kep.width, lepeskoz):
        d.line([(x, 0), (x, kep.height)], fill=(255, 0, 120) if x % (lepeskoz * 5) == 0 else (255, 140, 190), width=1)
        d.text((x + 3, 3), str(x), font=f, fill=(200, 0, 90))
    for y in range(0, kep.height, lepeskoz):
        d.line([(0, y), (kep.width, y)], fill=(255, 0, 120) if y % (lepeskoz * 5) == 0 else (255, 140, 190), width=1)
        d.text((3, y + 3), str(y), font=f, fill=(200, 0, 90))
    os.makedirs(os.path.join(GYOKER, '_elonezet'), exist_ok=True)
    ki = os.path.join(GYOKER, '_elonezet', f"racs_{utmutato}_{lepes['sorszam']:02d}_{honnan}.png")
    kep.save(ki)
    print('rács:', ki, '(a koordináták a forráskép pixelei: [x0, y0, x1, y1])')


def elonezet(utmutato: str, index: dict):
    kepek = []
    for l in index['lepesek']:
        ut = os.path.join(GYOKER, utmutato, f"{l['sorszam']:02d}_{l['slug']}.png")
        if os.path.exists(ut):
            kepek.append((l, Image.open(ut).convert('RGB')))
    if not kepek:
        return
    cel_w, oszlop = 540, 4
    font = betu(26, 640)
    sorok = [kepek[i:i + oszlop] for i in range(0, len(kepek), oszlop)]
    mag = [max(int(k.height * cel_w / k.width) for _, k in s) + 50 for s in sorok]
    lap = Image.new('RGB', (oszlop * (cel_w + 20) + 20, sum(mag) + 20), (245, 247, 250))
    d = ImageDraw.Draw(lap)
    y = 10
    for s, h in zip(sorok, mag):
        x = 20
        for l, k in s:
            kk = k.resize((cel_w, int(k.height * cel_w / k.width)), Image.LANCZOS)
            d.text((x, y + 6), f"{l['sorszam']:02d} {l['slug']} ({l['tipus']})", font=font, fill=TINTA)
            lap.paste(kk, (x, y + 42))
            x += cel_w + 20
        y += h
    ki = os.path.join(GYOKER, '_elonezet', f'attekintes_{utmutato}.jpg')
    os.makedirs(os.path.dirname(ki), exist_ok=True)
    lap.save(ki, quality=88)
    print('áttekintés:', ki)


def main(argv):
    if argv and argv[0] == '--racs':
        utmutato, sz = argv[1], argv[2]
        index = json.load(open(os.path.join(GYOKER, utmutato, 'index.json'), encoding='utf-8'))
        for l in index['lepesek']:
            if f"{l['sorszam']:02d}" == sz.zfill(2) or l['slug'] == sz:
                racs(utmutato, l)
        return 0
    if argv and argv[0] == '--elonezet':
        for u in UTMUTATOK:
            elonezet(u, json.load(open(os.path.join(GYOKER, u, 'index.json'), encoding='utf-8')))
        return 0
    utmutatok = [argv[0]] if argv else UTMUTATOK
    csak = argv[1] if len(argv) > 1 else None
    hibak = 0
    for u in utmutatok:
        ip = os.path.join(GYOKER, u, 'index.json')
        index = json.load(open(ip, encoding='utf-8'))
        for l in index['lepesek']:
            if csak and not (f"{l['sorszam']:02d}" == csak.zfill(2) or l['slug'] == csak):
                continue
            try:
                l['kimenet'] = lepes_kep(u, l)
                print(f"  {u} {l['sorszam']:02d} {l['slug']}: {l['kimenet']['fajl']} ({l['kimenet']['szel']}x{l['kimenet']['mag']}, {l['kimenet']['forras_hasznalt']})")
            except Kihagyva as e:
                print(f"  ! {u} {l['sorszam']:02d} {l['slug']}: KIHAGYVA – {e}")
                hibak += 1
        index['jelolve'] = _dt.datetime.now().isoformat(timespec='seconds')
        with open(ip, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=1)
        elonezet(u, index)
    return 1 if hibak else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
