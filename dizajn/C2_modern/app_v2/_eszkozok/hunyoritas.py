# -*- coding: utf-8 -*-
"""Hunyorítás-próba (C2): mind a 11 képernyő a @2x PNG-n PIL GaussianBlur(6)-tal (1x-en 3 px), és a szigorúbb
GaussianBlur(12)-vel (1x-en 6 px, a C 2. körének mércéje). Kimenet:
  ../_hunyoritas.jpg        felül eredeti, középen blur 6, alul blur 12 (fél méretben)
  ../_attekintes.jpg        csak az eredetik egy sorban"""
import os
from PIL import Image, ImageFilter

D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
NEVEK = ['01_belepes', '02_bekotes', '03_fooldal', '04_dosszie', '05_tetel', '06_uzenetek',
         '07_hogyan_jott_ki', '08_befizettem', '09_fotozas', '10_widget', '11_ures_dosszie']
W, H, G = 390, 844, 20
sorok = 3
lap = Image.new('RGB', (len(NEVEK) * (W + G) + G, sorok * (H + G) + G), '#8C95A5')
att = Image.new('RGB', (len(NEVEK) * (W + G) + G, H + 2 * G), '#C9D1DD')
for i, n in enumerate(NEVEK):
    im = Image.open(os.path.join(D, n + '.png')).convert('RGB')
    x = G + i * (W + G)
    kicsi = im.resize((W, H), Image.LANCZOS)
    lap.paste(kicsi, (x, G))
    att.paste(kicsi, (x, G))
    lap.paste(im.filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.LANCZOS), (x, H + 2 * G))
    lap.paste(im.filter(ImageFilter.GaussianBlur(12)).resize((W, H), Image.LANCZOS), (x, 2 * H + 3 * G))
lap.save(os.path.join(D, '_hunyoritas.jpg'), quality=86)
att.save(os.path.join(D, '_attekintes.jpg'), quality=90)
print('ok', os.path.join(D, '_hunyoritas.jpg'), lap.size)
