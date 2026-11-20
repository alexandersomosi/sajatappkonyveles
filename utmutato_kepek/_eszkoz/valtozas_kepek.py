"""Változás-útmutatók képei (SPEC §28.5.4) a tulaj saját NAV-képernyőképeiből – elmosás, jelölés, ellenőrzés.

    python C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/_eszkoz/valtozas_kepek.py

1. Forrás: sajat/vallalkozas_bejelentes/_nyers/*.jpg (a tulaj 2026-11-19-i képei; a nyers mappa a helyén marad,
   semmi nem kerül ki onnan elmosás nélkül).
2. Elmosás TERÜLETRE (kézzel megadott téglalapok, csak koordináták): a fejléc felhasználóneve, a személyes adatok
   teljes értékoszlopa, a címek, az azonosítók, a főtevékenység doboza. Utána kivágás (a fejléc és a bal menü kimarad).
   Az elmosott forrás: _nyers/valtozas/<NN>_<slug>.png (ez már nem tartalmaz személyes adatot).
3. index.json a valtozas/ mappában (annotate.py formátum) + `python annotate.py valtozas` = a kész, jelölt képek.
4. ELLENŐRZÉS (OCR csak a memóriában, a Windows magyar OCR-jével, 2x és 3x nagyításon): a nyers képen az elmosott
   területekre eső szavakat a memóriában gyűjti, és megnézi, hogy az elmosott forrásban és a kész @2x képen egyik sem
   olvasható-e; az elmosott területen belül semmilyen szó nem olvasható-e; és hogy nem maradt-e 6+ jegyű szám
   (azonosító). CSAK DARABSZÁMOT ír ki – szöveget soha, fájlba sem. A munkafájl (_sajat/_munka/ocr_munka.png) a végén
   egy fehér képpontra ürül, ahogy a sajat_kepek.py-nál.
Kapcsolók: --csak-ellenoriz (nem rajzol újra, csak a meglévő kimenetet ellenőrzi)
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFilter, ImageOps

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:  # pragma: no cover
    pass

ITT = os.path.dirname(os.path.abspath(__file__))
KEPEK = os.path.dirname(ITT)
NYERS = os.path.join(KEPEK, 'sajat', 'vallalkozas_bejelentes', '_nyers')
ELMOSOTT = os.path.join(KEPEK, '_nyers', 'valtozas')
CEL = os.path.join(KEPEK, 'valtozas')
MUNKA = os.path.join(KEPEK, '_sajat', '_munka', 'ocr_munka.png')
FEJLEC_NEV = (455, 6, 615, 44)          # „Bejelentkezett felhasználó” alatti név – minden képen
FORRAS_ROVID = 'NAV-képernyő · Forrás: saját képernyőkép, 2026. november 19. A személyes adatok elmosva.'
FORRAS = {'id': 'sajat_2026-11-19', 'cim': 'Saját képernyőkép a NAV Vállalkozói Ügysegédből (adatváltozás-űrlap, nem beküldve)',
          'url': None, 'datum': '2026-11-19', 'oldal': None, 'fajta': 'sajat_kepernyokep'}

# sorszám, slug (= lépéskulcs), nyers fájl, elmosandó területek (nyers px), kivágás, képernyőcím, felirat, jelölések
LEPESEK = [
    (2, 'ugyseged_fooldal', '02_fooldal_teljes.jpg', [(130, 378, 416, 398)], (92, 62, 790, 470),
     'Bejelentéseim, kérelmeim', 'Az Ügysegéd kezdőlapja: kattints a középső fülre.',
     [(1, (318, 90, 484, 134), 'tinta', 'Kattints az „Új bejelentés, kérelem benyújtása” fülre.')]),
    (3, 'valtozas_inditas', '03_uj_bejelentes_meglevo_ev.jpg', [(428, 174, 770, 502)], (92, 62, 790, 620),
     'Új bejelentés, kérelem benyújtása', 'Fent a mostani adataid (elmosva), lent az adatváltozás bejelentése.',
     [(1, (124, 568, 284, 602), 'tinta', 'Görgess le, és kattints a „Bejelentés kitöltése” gombra.')]),
    (4, 'valtozas_szemelyi', '04_valtozas_szemelyi_adatok_kitoltve.jpg', [(436, 280, 770, 446)], (92, 62, 790, 530),
     '1. Személyi adatok', 'A NAV kitölti, neked csak a születési országot kell kiválasztanod.',
     [(1, (106, 362, 560, 386), 'borostyan', 'Születési ország: válaszd ki, hol születtél. Kötelező.', 'jobb'),
      (2, (610, 476, 768, 510), 'tinta', 'Kattints a „Tovább” gombra.')]),
    (5, 'valtozas_cimadatok', '05_valtozas_cimadatok.jpg', [(120, 304, 744, 346)], (92, 140, 790, 600),
     '2. Vállalkozói címadatok', 'Az aktuális székhelyed (elmosva), alatta az új székhely és az új telephely gombja.',
     [(1, (125, 381, 283, 414), 'tinta', 'Ha költözöl: „Új székhely”.'),
      (2, (125, 498, 283, 532), 'tinta', 'Ha új telephelyed lesz: „Új telephely hozzáadása”.'),
      (3, (600, 560, 758, 594), 'tinta', 'Ha a címeid nem változnak: „Tovább”.')]),
    (6, 'valtozas_uj_szekhely', '05_szekhely_mezok_1.jpg', [(120, 304, 744, 346)], (92, 140, 800, 624),
     'Az új székhely címe', 'Mezőnként írd be az új címet; a dátum a költözés napja.',
     [(1, (122, 382, 742, 576), 'borostyan', 'Írd be az új címet mezőnként: ország, irányítószám, település, közterület neve és jellege, házszám.', 'jobb'),
      (2, (122, 580, 276, 622), 'borostyan', 'Változás napja: ettől a naptól érvényes az új cím.', 'jobb')]),
    (7, 'valtozas_szekhely_mentes', '05_szekhely_mezok_2_telephely.jpg', [], (92, 55, 790, 555),
     'Mentés', 'Mentsd el az új címet, utána lépj tovább.',
     [(1, (125, 331, 295, 364), 'tinta', 'Kattints az „Új székhely adatainak mentése” gombra.'),
      (2, (600, 512, 758, 546), 'tinta', 'Utána: „Tovább”.')]),
    (8, 'valtozas_uj_telephely', '05_telephely_mezok.jpg', [(120, 254, 744, 296)], (92, 100, 800, 624),
     'Az új telephely címe', 'Ugyanúgy, mint a székhelynél: mezőnként a címet és a napot.',
     [(1, (122, 398, 742, 622), 'borostyan', 'Írd be a telephely címét mezőnként, ugyanúgy, mint a székhelynél.', 'jobb')]),
    (9, 'valtozas_tevekenysegek', '06_tevekenysegek.jpg', [(120, 366, 744, 414)], (92, 140, 790, 620),
     '3. Tevékenységek', 'A mostani főtevékenységed (elmosva), alatta az új tevékenység gombjai.',
     [(1, (125, 424, 283, 458), 'tinta', 'Ha más lesz a fő munkád: „Új főtevékenység”.'),
      (2, (125, 520, 283, 554), 'tinta', 'Ha a mostani mellett kezdesz újat: „Új tevékenység hozzáadása”.'),
      (3, (600, 581, 758, 615), 'tinta', 'Ha a tevékenységeid nem változnak: „Tovább”.')]),
    # k6c: the searched activity (his own) is blurred too
    (10, 'valtozas_ovtj_kereso', '06_ovtj_kereso.jpg', [(120, 366, 744, 414), (128, 522, 423, 559)], (92, 140, 790, 624),
     'A tevékenység keresése', 'Írj be egy szót vagy a kódot, és válaszd ki a sort.',
     [(1, (126, 518, 428, 560), 'borostyan', 'Ez a kereső: írj ide egy szót vagy az ÖVTJ-kódot, és válaszd ki a sort a listából.', 'jobb'),
      (2, (122, 568, 276, 612), 'borostyan', 'Adatváltozás ideje: ettől a naptól végzed.', 'jobb')]),
    (11, 'szunetel_inditas', '03_uj_bejelentes_meglevo_ev.jpg', [(428, 174, 770, 502)], (92, 62, 790, 620),
     'Új bejelentés, kérelem benyújtása', 'A szüneteltetés bejelentése ezen a lapon, lejjebb indul.',
     [(1, None, 'tinta', 'Görgess lejjebb: a szüneteltetés bejelentését a lap alján indítod.'),
      # k6c2: this card's button is the adatváltozás – crossed out (dashed = "ne ezt"), so nobody starts the wrong form
      (2, (124, 568, 284, 602), 'ures', 'Ez az adatváltozás gombja (kiszürkítve): most ne ezt nyomd meg.', 'jobb')]),
    # k6c: his tax choices (munkavégzés jellege, átalány, alanyi mentesség, közösségi adószám, árfolyam) are blurred too
    (12, 'valtozas_megtekintes', '12_megtekintes_3.jpg', [(395, 82, 758, 108), (114, 190, 749, 212), (114, 254, 749, 277), (114, 317, 749, 340), (114, 380, 749, 403), (114, 444, 749, 474)], (92, 120, 790, 560),
     'Bejelentéseim, kérelmeim – Megtekintés', 'A beküldött bejelentésed: töltsd le a NAV értesítését.',
     [(1, (106, 512, 264, 546), 'tinta', 'Kattints a „Letöltés” gombra, és töltsd fel nálunk az értesítést.')]),
]
# Lépések, amelyekhez meglévő (valódi, már elmosott) kép tartozik a két másik útmutatóból: másolat.
MASOLATOK = {
    'belepes': 'vallalkozas_bejelentes/01_belepes',
    'onya_belepes': 'meghatalmazas/01_onya_nyitooldal',
    'onya_profil': 'meghatalmazas/03_onya_profil',
    't101e_kereses': 'meghatalmazas/04_onya_uj_nyomtatvany',
}
# Lépéssorok fajtánként (SPEC §28.5.3 + §28.K.6); None = még nincs valódi kép (rajzolt vázlat kell / a tulaj fotózza).
FAJTAK = {
    'valtozas_szekhely': ['belepes', 'ugyseged_fooldal', 'valtozas_inditas', 'valtozas_szemelyi', 'valtozas_cimadatok', 'valtozas_uj_szekhely',
                          'valtozas_szekhely_mentes', 'valtozas_tevekenysegek', 'valtozas_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
    'valtozas_telephely': ['belepes', 'ugyseged_fooldal', 'valtozas_inditas', 'valtozas_szemelyi', 'valtozas_cimadatok', 'valtozas_uj_telephely',
                           'valtozas_tevekenysegek', 'valtozas_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
    'valtozas_tevekenyseg': ['belepes', 'ugyseged_fooldal', 'valtozas_inditas', 'valtozas_szemelyi', 'valtozas_cimadatok', 'valtozas_tevekenysegek',
                             'valtozas_ovtj_kereso', 'valtozas_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
    'valtozas_szuneteltetes': ['belepes', 'ugyseged_fooldal', 'szunetel_inditas', 'szunetel_datum', 'szunetel_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
    'valtozas_adoadat': ['onya_belepes', 'onya_profil', 't101e_kereses', 't101e_blokk', 't101e_bekuldes', 'app_feltoltes'],
    'valtozas_folytatas': ['belepes', 'ugyseged_fooldal', 'folytatas_inditas', 'folytatas_datum', 'folytatas_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
}
KEP_NELKUL = {'app_feltoltes': 'saját app-képernyő (nem NAV)'}
HIANYZIK = {
    'valtozas_ellenorzes': 'a tulaj fotózza az adatváltozás-űrlap 4. „Ellenőrzés” lapját (beküldés nélkül) – addig rajzolt vázlat',
    'szunetel_datum': 'a szüneteltetés lapjai a tulaj képén nem látszanak – rajzolt vázlat',
    'szunetel_ellenorzes': 'rajzolt vázlat',
    'folytatas_inditas': 'a szüneteltetés befejezésének kártyája [ELLENŐRIZENDŐ] – rajzolt vázlat',
    'folytatas_datum': 'rajzolt vázlat',
    'folytatas_ellenorzes': 'rajzolt vázlat',
    't101e_blokk': 'ONYA T101E űrlap – rajzolt vázlat',
    't101e_bekuldes': 'ONYA T101E beküldés – rajzolt vázlat',
}


# ---------------------------------------------------------------------------------------------------------------------
def mos(kep: Image.Image, r) -> None:
    """Erős elmosás: nagy blokkos pixelezés + Gauss – a szöveg alakja sem marad meg."""
    x0, y0, x1, y1 = [int(round(v)) for v in r]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(kep.width, x1), min(kep.height, y1)
    if x1 <= x0 or y1 <= y0:
        return
    resz = kep.crop((x0, y0, x1, y1))
    blokk = max(10, min(x1 - x0, y1 - y0) // 2)
    kicsi = resz.resize((max(1, (x1 - x0) // blokk), max(1, (y1 - y0) // blokk)), Image.BILINEAR)
    resz = kicsi.resize(resz.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(max(6, (y1 - y0) / 3)))
    kep.paste(resz, (x0, y0))


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '', s)


def ocr_szavak(kep: Image.Image, nagyit: float) -> list:
    """[(norm_szo, x0, y0, x1, y1)] a megadott kép pixelében. A szöveg csak a memóriában van."""
    nagy = kep.resize((int(kep.width * nagyit), int(kep.height * nagyit)), Image.LANCZOS)
    out = []
    for valt in (nagy, ImageOps.invert(ImageOps.grayscale(nagy)).convert('RGB')):
        os.makedirs(os.path.dirname(MUNKA), exist_ok=True)
        valt.save(MUNKA)
        r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(ITT, 'ocr.ps1'), MUNKA], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError('az OCR nem futott le')
        d = json.loads(r.stdout.decode('utf-8-sig'))
        for s in d.get('sorok') or []:
            for w in s.get('szavak') or []:
                out.append((norm(w['t']), w['x'] / nagyit, w['y'] / nagyit, (w['x'] + w['w']) / nagyit, (w['y'] + w['h']) / nagyit))
    munka_urit()
    return out


def munka_urit():
    if os.path.exists(MUNKA):
        Image.new('RGB', (1, 1), (255, 255, 255)).save(MUNKA)


def benne(w, r, tures=2) -> bool:
    cx, cy = (w[1] + w[3]) / 2, (w[2] + w[4]) / 2
    return r[0] - tures <= cx <= r[2] + tures and r[1] - tures <= cy <= r[3] + tures


HOSSZU_SZAM = re.compile(r'\d{6,}')
# Nyilvános felületi értékek helye a nyers képen (nem személyes adat): az „Ország” lenyíló alapértéke és a rögzítés
# napja a dátummezőkben. Az itt felismert szó nem számít hibának.
SZABAD_TERULET = {
    'valtozas_uj_szekhely': [(126, 398, 426, 420), (126, 596, 272, 620)],
    'valtozas_uj_telephely': [(126, 466, 426, 490)],
    'valtozas_ovtj_kereso': [(126, 590, 272, 614)],
    'valtozas_szekhely_mentes': [(126, 98, 426, 118), (126, 300, 272, 322)],
}


def szabad_szam(m: str) -> bool:
    return m in SZABAD_SZAM or '20261119'.startswith(m)
# a felület nyilvános számai (nem személyes adat): az ÖVTJ-mintasor kódja és a rögzítés napja a dátummezőkben
SZABAD_SZAM = {'741201', '20261119'}


def szemelyes_halmaz(szavak: list, rs: list) -> set:
    """A nyers kép elmosott területein felismert szavak – kivéve azokat, amelyek a területeken kívül is előfordulnak
    (ott a NAV felületének része, pl. az „Ország” lenyíló alapértéke), és a lépésszámokat."""
    kint = {w[0] for w in szavak if not any(benne(w, r) for r in rs)}
    return {w[0] for w in szavak if len(w[0]) >= 3 and any(benne(w, r) for r in rs) and w[0] not in kint}


# k6c2 (2. kör): elmosott terület → üres beviteli mező (a kereső maga nem személyes adat, csak a beírt keresés)
URES_MEZO = {'valtozas_ovtj_kereso': [((126, 520, 425, 561), (128, 528, 423, 552))]}
# k6c2 (2. kör): kiszürkített gomb (nem ezt kell megnyomni ezen a lépésen)
SZURKIT = {'szunetel_inditas': [(126, 569, 283, 601)]}


def mos_es_ment(l) -> tuple[Image.Image, list]:
    nn, slug, fajl, teruletek, *_ = l
    kep = Image.open(os.path.join(NYERS, fajl)).convert('RGB')
    rs = [FEJLEC_NEV] + list(teruletek)
    for r in rs:
        mos(kep, r)
    # k6c2 (2. kör): az elmosott kereső helyére üres beviteli mező – látszódjon, hová kell írni
    for r, doboz in URES_MEZO.get(slug, []):
        d = ImageDraw.Draw(kep)
        d.rectangle(r, fill=(255, 255, 255))
        d.rectangle(doboz, fill=(255, 255, 255), outline=(190, 190, 190), width=1)
    # k6c2 (2. kör): a nem ide való gomb kiszürkítve (a szüneteltetés lépésén az adatváltozás gombja)
    for r in SZURKIT.get(slug, []):
        resz = ImageOps.grayscale(kep.crop(r)).convert('RGB')
        kep.paste(Image.blend(resz, Image.new('RGB', resz.size, (255, 255, 255)), 0.62), (r[0], r[1]))
    os.makedirs(ELMOSOTT, exist_ok=True)
    ut = os.path.join(ELMOSOTT, f'{nn:02d}_{slug}.png')
    if os.path.exists(ut):
        regi = os.path.join(KEPEK, '_regi', 'valtozas_nyers')
        os.makedirs(regi, exist_ok=True)
        shutil.move(ut, os.path.join(regi, f'{nn:02d}_{slug}_{dt.datetime.now():%Y%m%d_%H%M%S}.png'))
    kep.save(ut)
    return kep, rs


def ellenoriz(l, elmosott: Image.Image, rs: list) -> dict:
    """Darabszámok: a nyers kép elmosott területeiről felismert szavakból hány olvasható az elmosott képen, a
    területeken belül hány szó olvasható, és hány hosszú (6+ jegyű) szám maradt. Szöveget nem ad vissza."""
    _, _, fajl, *_ = l
    nyers = Image.open(os.path.join(NYERS, fajl)).convert('RGB')
    nyers_szavak = ocr_szavak(nyers, 2.0)
    szemelyes = szemelyes_halmaz(nyers_szavak, rs)
    hiba = {'szemelyes_szo': len(szemelyes), 'olvashato_szemelyes': 0, 'szo_az_elmosott_teruleten': 0, 'hosszu_szam': 0}
    for nagyit in (2.0, 3.0):
        szavak = ocr_szavak(elmosott, nagyit)
        sz = SZABAD_TERULET.get(l[1], [])
        szavak = [w for w in szavak if not any(benne(w, r) for r in sz)]
        hiba['olvashato_szemelyes'] += sum(1 for w in szavak if w[0] in szemelyes)
        hiba['szo_az_elmosott_teruleten'] += sum(1 for w in szavak if len(w[0]) >= 2 and any(benne(w, r, -3) for r in rs))
        hiba['hosszu_szam'] += sum(1 for w in szavak for m in HOSSZU_SZAM.findall(w[0]) if not szabad_szam(m))
    del nyers_szavak, szemelyes
    return hiba


def kesz_ellenoriz(l) -> dict:
    """A kész @2x képen (jelölésekkel, nagyítva) ugyanaz a vizsgálat, a nyers képből gyűjtött szavakkal."""
    nn, slug, fajl, teruletek, *_ = l
    nyers = Image.open(os.path.join(NYERS, fajl)).convert('RGB')
    rs = [FEJLEC_NEV] + list(teruletek)
    szemelyes = szemelyes_halmaz(ocr_szavak(nyers, 2.0), rs)
    kesz = Image.open(os.path.join(CEL, f'{nn:02d}_{slug}@2x.png')).convert('RGB')
    vagas = l[4]
    s_ = (2160 - 2 * 56) / (vagas[2] - vagas[0])
    sz = [((r[0] - vagas[0]) * s_ + 56, (r[1] - vagas[1]) * s_ + 56, (r[2] - vagas[0]) * s_ + 56, (r[3] - vagas[1]) * s_ + 56) for r in SZABAD_TERULET.get(slug, [])]
    # a 2160 px-es kép az OCR határán (~2600 px) belül van: 1x és 1.2x
    talalat = 0
    szam = 0
    for nagyit in (1.0, 1.2):
        szavak = [w for w in ocr_szavak(kesz, nagyit) if not any(benne(w, r, 6) for r in sz)]
        talalat += sum(1 for w in szavak if w[0] in szemelyes)
        szam += sum(1 for w in szavak for m in HOSSZU_SZAM.findall(w[0]) if not szabad_szam(m))
    return {'szemelyes_szo': len(szemelyes), 'olvashato_a_kesz_kepen': talalat, 'hosszu_szam_a_kesz_kepen': szam}


def index_ir():
    lepesek = []
    for nn, slug, fajl, teruletek, vagas, kepernyo, felirat, jel in LEPESEK:
        jelolesek = []
        for n, doboz, stilus, cimke, *hely in jel:
            j = {'n': n, 'doboz': list(doboz) if doboz else None, 'stilus': stilus, 'cimke': cimke}
            if hely:
                j['szam_hely'] = hely[0]
            jelolesek.append(j)
        markers = ', '.join(x[3] for x in jel)
        lepesek.append({
            'sorszam': nn,
            'slug': slug,
            'lepes_kulcs': slug,
            'resz': 1,
            'valtozat': None,
            'kepernyo': kepernyo,
            'felirat': felirat,
            'alt': f'Képernyőkép: {kepernyo}. A személyes adatok elmosva. Kiemelve – {markers}',
            'tipus': 'valodi',
            'forras': FORRAS,
            'forras_rovid': FORRAS_ROVID,
            'alap': {'kep': f'_nyers/valtozas/{nn:02d}_{slug}.png', 'vagas': list(vagas), 'homalyos': [], 'jel_meret': 1.0},
            'jelolesek': jelolesek,
        })
    ip = os.path.join(CEL, 'index.json')
    regi_index = None
    if os.path.exists(ip):
        regi_index = json.load(open(ip, encoding='utf-8'))
        r = os.path.join(KEPEK, '_regi', 'valtozas')
        os.makedirs(r, exist_ok=True)
        shutil.copy2(ip, os.path.join(r, f'index_{dt.datetime.now():%Y%m%d_%H%M%S}.json'))
    kulcs_kep = {l['slug']: f"{l['sorszam']:02d}_{l['slug']}" for l in lepesek}
    fajtak = {}
    for fajta, kulcsok in FAJTAK.items():
        sor = []
        for k in kulcsok:
            if k in kulcs_kep:
                sor.append({'lepes_kulcs': k, 'kep': kulcs_kep[k] + '.png', 'kep_2x': kulcs_kep[k] + '@2x.png', 'tipus': 'valodi'})
            elif k in MASOLATOK:
                nev = 'm_' + os.path.basename(MASOLATOK[k])
                sor.append({'lepes_kulcs': k, 'kep': nev + '.png', 'kep_2x': nev + '@2x.png', 'tipus': 'valodi', 'masolat_innen': MASOLATOK[k] + '.png'})
            elif k in KEP_NELKUL:
                sor.append({'lepes_kulcs': k, 'kep': None, 'tipus': 'nincs_kep', 'megjegyzes': KEP_NELKUL[k]})
            else:
                sor.append({'lepes_kulcs': k, 'kep': None, 'tipus': 'hianyzik', 'megjegyzes': HIANYZIK.get(k, 'rajzolt vázlat kell')})
        fajtak[fajta] = sor
    index = {
        'utmutato': 'valtozas',
        'cim': 'Változás-útmutatók (SPEC §28.5) – a tulaj saját NAV-képernyői, elmosva és jelölve',
        'verzio': '2026-11-19.ot',
        'leiras': 'Forrás: sajat/vallalkozas_bejelentes/_nyers (a tulaj 2026-11-19-i képei, NEM beküldött adatváltozás-űrlap). '
                  'Az elmosás területre történt (fejléc-név, értékoszlopok, címek, azonosítók, főtevékenység); az elmosott forrás: '
                  '_nyers/valtozas/. Újragenerálás: python _eszkoz/valtozas_kepek.py. Személyes adat sehol nincs leírva.',
        'jelmagyarazat': {'tinta': 'kattints / válaszd', 'borostyan': 'ide írj / ezt töltsd ki', 'ures': 'hagyd üresen'},
        'lepesek': lepesek,
        'masolatok': {k: v + '.png' for k, v in MASOLATOK.items()},
        'fajtak': fajtak,
        'kep_nelkuli_lepes_kulcsok': list(KEP_NELKUL),
        'hianyzo_valodi_kepek': HIANYZIK,
    }
    if regi_index and regi_index.get('lepesek'):
        # a korábbi kimenet-blokkokat az annotate.py úgyis újraírja
        pass
    os.makedirs(CEL, exist_ok=True)
    with open(ip, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    return ip


def masolatok():
    for k, v in MASOLATOK.items():
        for vege in ('.png', '@2x.png'):
            honnan = os.path.join(KEPEK, v + vege)
            hova = os.path.join(CEL, 'm_' + os.path.basename(v) + vege)
            if os.path.exists(honnan):
                shutil.copy2(honnan, hova)


def main(argv):
    csak = '--csak-ellenoriz' in argv
    ossz = {'olvashato_szemelyes': 0, 'szo_az_elmosott_teruleten': 0, 'hosszu_szam': 0, 'olvashato_a_kesz_kepen': 0, 'hosszu_szam_a_kesz_kepen': 0}
    if not csak:
        for l in LEPESEK:
            kep, rs = mos_es_ment(l)
            h = ellenoriz(l, kep, rs)
            for k in ('olvashato_szemelyes', 'szo_az_elmosott_teruleten', 'hosszu_szam'):
                ossz[k] += h[k]
            print(f"  {l[0]:02d} {l[1]}: elmosott forrás kész · gyűjtött szavak {h['szemelyes_szo']} · olvasható {h['olvashato_szemelyes']} · "
                  f"szó az elmosott területen {h['szo_az_elmosott_teruleten']} · hosszú szám {h['hosszu_szam']}")
        index_ir()
        masolatok()
        r = subprocess.run([sys.executable, os.path.join(KEPEK, 'annotate.py'), 'valtozas'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        print(r.stdout.strip()[-2000:])
        if r.returncode != 0:
            print(r.stderr[-1500:])
            return 1
    for l in LEPESEK:
        h = kesz_ellenoriz(l)
        ossz['olvashato_a_kesz_kepen'] += h['olvashato_a_kesz_kepen']
        ossz['hosszu_szam_a_kesz_kepen'] += h['hosszu_szam_a_kesz_kepen']
        print(f"  kész {l[0]:02d} {l[1]}: gyűjtött szavak {h['szemelyes_szo']} · olvasható a kész képen {h['olvashato_a_kesz_kepen']} · "
              f"hosszú szám {h['hosszu_szam_a_kesz_kepen']}")
    munka_urit()
    jo = all(v == 0 for v in ossz.values())
    print('ÖSSZESEN:', json.dumps(ossz), '->', 'RENDBEN' if jo else 'NÉZD MEG (nem nulla)')
    return 0 if jo else 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
