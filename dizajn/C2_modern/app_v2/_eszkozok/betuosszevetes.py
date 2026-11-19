# -*- coding: utf-8 -*-
"""Betűpróba-összesítő: a főoldal öt betűvel egymás mellett + ékezetsor mindegyik betű saját rajzával.
Bemenet: ../../betuk/fooldal_<betu>.png (lovesz.py --betuk). Kimenet: ../../betuk/_betutipusok.jpg"""
import os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
B = os.path.abspath(os.path.join(D, '..', 'betuk'))
F = os.path.join(D, 'fontok')
JEL = [  # kulcs, név, fájl, megjegyzés
    ('onest', 'Onest', 'Onest_wght.ttf', 'OFL · 100–900 · tnum · U+202F'),
    ('inter', 'Inter (Display opsz)', 'Inter_opsz_wght.ttf', 'OFL · 100–900 + opsz · tnum'),
    ('geist', 'Geist', 'Geist_wght.ttf', 'OFL · 100–900 · tnum'),
    ('golos', 'Golos Text', 'GolosText_wght.ttf', 'OFL · 400–900 · tnum'),
    ('figtree', 'Figtree', 'Figtree_wght.ttf', 'OFL · 300–900 · tnum'),
]
EKEZET = 'Ő ő Ű ű Győző Szűcs fűtő'
EKEZET2 = 'Előleg · Üzenetek · 0123456789'
W, H, G, FEJ, LAB = 390, 844, 28, 92, 108
VALASZTOTT = 'geist'

def betu(fajl, meret, suly):
    f = ImageFont.truetype(os.path.join(F, fajl), meret)
    try:
        f.set_variation_by_axes([suly] if 'Inter' not in fajl else [32 if meret > 30 else 14, suly])
    except Exception:
        pass
    return f

cim_f = betu('Geist_wght.ttf', 34, 800)
al_f = betu('Geist_wght.ttf', 17, 400)
lap = Image.new('RGB', (G + len(JEL) * (W + G), 140 + FEJ + H + LAB + G), '#C9D1DD')
d = ImageDraw.Draw(lap)
d.text((G, 26), 'Betűpróba: a C2 főoldala öt szabad groteszkkel', font=cim_f, fill='#17284A')
d.text((G, 72), 'Minden betű OFL-licencű, saját ő Ő ű Ű jellel (fontTools-szal ellenőrizve). Ugyanaz a CSS, csak a család cserélődik. '
       'Az ékezetsort minden oszlopban az adott betű saját fájlja rajzolja.', font=al_f, fill='#4A5468')
d.text((G, 96), 'Választás: Geist. Feszes, nyugodt, a nagy összeg 800-zal erős, a táblázatos számjegyei egyenletesek, a levél két sorba fér. '
       'Az Onest „y”-ja a gy/ny/ty-ben furcsa, a tnum „1”-e lyukas; az Inter a leggyakoribb alapbetű; a Golos széles; a Figtree játékosabb.', font=al_f, fill='#17284A')
for i, (k, nev, fajl, megj) in enumerate(JEL):
    x = G + i * (W + G); y = 140
    cm = TTFont(os.path.join(F, fajl)).getBestCmap()
    hiany = [c for c in 'őŐűŰ' if ord(c) not in cm]
    d.rounded_rectangle((x, y, x + W, y + FEJ + H + LAB), 16, fill='#FFFFFF')
    if k == VALASZTOTT:
        d.rounded_rectangle((x - 5, y - 5, x + W + 5, y + FEJ + H + LAB + 5), 20, outline='#17284A', width=5)
        d.rounded_rectangle((x + W - 150, y + 14, x + W - 14, y + 46), 16, fill='#17284A')
        d.text((x + W - 136, y + 18), 'Választott', font=betu('Geist_wght.ttf', 19, 700), fill='#FFFFFF')
    d.text((x + 16, y + 14), nev, font=betu(fajl, 26, 700), fill='#151C2A')
    d.text((x + 16, y + 52), megj + ('' if not hiany else '  HIÁNYZIK: ' + ''.join(hiany)), font=betu('Geist_wght.ttf', 15, 400), fill='#596379')
    im = Image.open(os.path.join(B, f'fooldal_{k}.png')).convert('RGB').resize((W, H), Image.LANCZOS)
    lap.paste(im, (x, y + FEJ))
    d.text((x + 16, y + FEJ + H + 16), EKEZET, font=betu(fajl, 28, 700), fill='#151C2A')
    d.text((x + 16, y + FEJ + H + 60), EKEZET2, font=betu(fajl, 22, 400), fill='#151C2A')
lap.save(os.path.join(B, '_betutipusok.jpg'), quality=90)
print(os.path.join(B, '_betutipusok.jpg'), lap.size)
