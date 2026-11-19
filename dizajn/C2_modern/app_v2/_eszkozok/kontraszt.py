# -*- coding: utf-8 -*-
"""WCAG 2.x kontrasztszámítás a C2 szövegpárjaira. Az áttetsző rétegeket (guilloche 5%, fehér 14%, sötét 55–62%)
a legrosszabb esetre keverjük ki. A kezdőképernyő (10) háttérkép-pontjait a kész PNG-ből olvassuk ki.
Futtatás: python kontraszt.py  → táblázat a konzolra (a TERV.md Kontraszt fejezetének forrása)."""
import os, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def kever(elo, hat, a):
    e, h = rgb(elo) if isinstance(elo, str) else elo, rgb(hat) if isinstance(hat, str) else hat
    return tuple(round(e[i] * a + h[i] * (1 - a)) for i in range(3))

def L(c):
    c = rgb(c) if isinstance(c, str) else c
    def ch(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in c); return 0.2126 * r + 0.7152 * g + 0.0722 * b

def arany(a, b):
    la, lb = L(a), L(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)

def hx(c):
    return c if isinstance(c, str) else '#%02X%02X%02X' % c

def _sav_mert():
    """A sáv legvilágosabb háttérpontja a kész 03-as PNG-n: a tintakékhez közeli képpontok 99,5. percentilise
    (a rozetta vonalai és metszéspontjai benne vannak, a fehér szöveg és élsimítása nincs)."""
    try:
        import numpy as np
        a = np.asarray(Image.open(os.path.join(D, '03_fooldal.png')).convert('RGB')).astype(float)[0:400]
        l = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
        v = a[l < 75]; o = np.argsort(0.2126 * v[:, 0] + 0.7152 * v[:, 1] + 0.0722 * v[:, 2])
        return tuple(int(x) for x in v[o[int(len(o) * .995)]])
    except Exception:
        return kever('#FFFFFF', '#17284A', .13)
SAV = _sav_mert()                                            # sáv + rozetta, mért legrosszabb pont
PAPIR = kever('#17284A', '#FFFFFF', 26 / 255 * .5)        # levél a papírszál legsötétebb pontján
KAMERA_FEHER14 = kever('#FFFFFF', '#0F1B33', .14)
SOTET55_ASZTAL = kever('#0F1B33', '#4A515E', .55)          # kerek gomb / pirula a kamerakép legvilágosabb részén
SOTET62_ASZTAL = kever('#0F1B33', '#4A515E', .62)
FULSOR = kever('#FFFFFF', '#DDE3EC', .92)

# a 10-es kezdőképernyő: a címkék mögötti háttérkép legvilágosabb pontja (a kész PNG-ből)
hatter10 = None
p10 = os.path.join(D, '10_widget.png')
if os.path.exists(p10):
    im = Image.open(p10).convert('RGB')
    pontok = []
    # a címkesorok magasságában, az ikonoszlopok közötti résekben (CSS px; a kép @2x)
    resek = [(195, 141), (287, 141), (378, 141), (195, 249), (287, 249), (378, 249),
             (12, 233), (60, 233), (150, 233), (12, 353), (103, 353), (195, 353), (287, 353), (378, 353)]
    for (x, y) in resek:
        pontok.append(im.getpixel((x * 2, y * 2)))
    hatter10 = max(pontok, key=L)

PAROK = [
    ('Tinta', '#151C2A', 'Lap', '#FFFFFF', 'törzsszöveg, összegek, gyorsgomb-felirat'),
    ('Tinta', '#151C2A', 'Levél papírszállal (legsötétebb pont)', PAPIR, 'a levél szövege'),
    ('Tinta', '#151C2A', 'Alap', '#DDE3EC', 'szakaszcím'),
    ('Fehér', '#FFFFFF', 'Tintakék (saját buborék)', '#17284A', 'saját üzenet (06) – 4. kör: tintakék, nem világoskék'),
    ('Tinta', '#151C2A', 'Kulcssor (07)', '#F2F4F8', 'a számítás kulcssorai'),
    ('Fehér', '#FFFFFF', 'Sáv + rozetta (legsűrűbb pont)', SAV, 'végösszeg, cím, határidő'),
    ('Fejléc-halvány', '#B4C0D6', 'Sáv + rozetta (legsűrűbb pont)', SAV, 'mondat a sávon, „Ft”'),
    ('Fehér', '#FFFFFF', 'Sáv (a „Hogyan jött ki?” körvonalán belül)', SAV, '„Hogyan jött ki?” felirat'),
    ('Fehér 78% körvonal', kever('#FFFFFF', SAV, .78), 'Sáv', SAV, 'a sávgomb körvonala (nem szöveg, ≥ 3:1)'),
    ('Borostyán címke', '#5E3B00', 'Borostyán-alap', '#F7E8C6', '„még 3 nap” címke (03, 10)'),
    ('Borostyán-alap', '#F7E8C6', 'Sáv', '#17284A', 'a „még 3 nap” címke kiválik a sávból'),
    ('Kész', '#2B6744', 'Kész-alap', '#E2EFE6', 'kamera-tipp (09)'),
    ('Kész', '#2B6744', 'Lap', '#FFFFFF', 'Feldolgozva, Beadva, állapot a részletnézetben (05)'),
    ('Halvány', '#535D72', 'Lap', '#FFFFFF', 'másodlagos szöveg'),
    ('Halvány', '#535D72', 'Nyomott', '#EEF1F6', '„Legközelebb” doboz'),
    ('Halvány', '#535D72', 'Fülsor (fehér 92%)', FULSOR, 'nem aktív fül'),
    ('Fül-aktív kobalt', '#2450C0', 'Nyomott (aktív lencse)', '#EEF1F6', 'aktív fül felirata és ikonja'),
    ('Halvány az alapon', '#4A5468', 'Alap', '#DDE3EC', 'időbélyeg, szakasz-megjegyzés'),
    ('Szegmens-felirat', '#D0D8E6', 'Szegmens a sávon (fehér 10%)', kever('#FFFFFF', SAV, .10), 'nem kiválasztott hónap'),
    ('Tintakék', '#17284A', 'Fehér (kiválasztott hónap)', '#FFFFFF', 'kiválasztott hónap'),
    ('Tintakék szöveg', '#22396A', 'Színezett gomb', '#D6E0F0', 'másodlagos gomb felirata'),
    ('Tintakék szöveg', '#22396A', 'Lap', '#FFFFFF', 'szöveges gomb (link)'),
    ('Fehér', '#FFFFFF', 'Tintakék', '#17284A', 'elsődleges gomb, Fotózás-gomb, app-ikon K'),
    ('Tollkék a sávon', '#8FB0F4', 'Tintakék', '#17284A', 'kézvonás az ikonon és a szóvédjegy alatt (grafika, ≥ 3:1)'),
    ('Tollkék', '#2546A6', 'Lap', '#FFFFFF', 'aláírás, monogram, bélyegző'),
    ('Tintakék szöveg', '#22396A', 'Elefántcsont (fénykép helye)', '#F4EFE4', 'KB kezdőbetűk'),
    # gyorsműveletek: ikon a saját körén (nem szöveg: ≥ 3:1 kell), és ugyanez a csempén, a másodlagos gombon
    ('Kék ikon', '#2A55B5', 'Kék kör', '#E1E9FB', 'Feltöltés'),
    ('Türkiz ikon', '#11686A', 'Türkiz kör', '#D7EEEC', 'Kérdezek'),
    ('Ibolya ikon', '#5540A8', 'Ibolya kör', '#E8E3F8', 'Igazolás, igazolás-csempék (06)'),
    ('Borostyán ikon', '#845300', 'Borostyán kör', '#F7E8C6', 'Határidők, „Legközelebb” (08)'),
    ('Tinta', '#151C2A', 'Ibolya csempe', '#E8E3F8', 'csempe felirata (06)'),
    ('Tinta', '#151C2A', 'Türkiz csempe', '#D7EEEC', 'csempe felirata (06)'),
    ('Kék ikon', '#2A55B5', 'Színezett gomb', '#D6E0F0', 'feltöltés-ikon a másodlagos gombon'),
    ('Türkiz ikon', '#11686A', 'Színezett gomb', '#D6E0F0', 'kérdés-ikon a másodlagos gombon'),
    ('Borostyán ikon', '#845300', 'Színezett gomb', '#D6E0F0', 'naptár-ikon a másodlagos gombon (02)'),
    ('Kék', '#2A55B5', 'Lap', '#FFFFFF', '„+ Fájl hozzáadása” (04)'),
    ('Tinta', '#151C2A', 'Bezáró gomb', '#EEF1F6', 'bezáró X (07, 08)'),
    ('Fehér', '#FFFFFF', 'Fehér 14% a kamerán', KAMERA_FEHER14, '„Ezt újra” gomb (09)'),
    ('Tintakék', '#17284A', 'Fehér', '#FFFFFF', '„Kész, feltöltöm” (09)'),
    ('#C9D2E3', '#C9D2E3', 'Kamera-panel', '#0F1B33', 'oldalszámláló magyarázata (09)'),
    ('Fehér', '#FFFFFF', 'Sötét 55% a kamerán', SOTET55_ASZTAL, 'kerek gombok, „Bence kapja meg”'),
    ('Fehér', '#FFFFFF', 'Sötét 62% a kamerán', SOTET62_ASZTAL, '„2. oldal”'),
]
if hatter10:
    PAROK.append(('Fehér', '#FFFFFF', 'Kezdőképernyő háttere (legvilágosabb címkepont)', hatter10, 'appnevek (10)'))

print('| Előtér | Háttér | Arány | Hol | Szint |')
print('|---|---|---|---|---|')
for en, ec, hn, hc, hol in PAROK:
    r = arany(ec, hc)
    grafika = ('ikon' in en.lower()) or ('körvonal' in en) or ('kézvonás' in hol) or ('kiválik' in hol)
    szint = 'AAA' if r >= 7 else ('AA' if r >= 4.5 else (('grafika ≥ 3:1' if r >= 3 else 'NEM MEGY') if grafika else ('nagy szöveg ≥ 3:1' if r >= 3 else 'NEM MEGY')))
    print(f'| {en} {hx(ec)} | {hn} {hx(hc)} | {r:.2f} | {hol} | {szint} |')
