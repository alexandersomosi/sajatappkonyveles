# -*- coding: utf-8 -*-
"""Hunyorítás-próba: minden képernyő 6 CSS px-es GaussianBlurral (a @2x képen 12) elmosva, egymás mellett.
Kimenet: ../_hunyoritas.png (fent az eredeti, lent az elmosott sor)
és ../07_elemek_hunyoritas.png (az elemlap: balra eredeti, jobbra elmosva)."""
import os
from PIL import Image, ImageFilter

D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
NEVEK = ['01_belepes', '02_bekotes', '03_fooldal', '04_dosszie', '05_tetel', '06_uzenetek']
W, H, G = 390, 844, 24
lap = Image.new('RGB', (len(NEVEK) * (W + G) + G, 2 * (H + G) + G), '#8C95A5')
for i, n in enumerate(NEVEK):
    im = Image.open(os.path.join(D, n + '.png')).convert('RGB')
    elmosott = im.filter(ImageFilter.GaussianBlur(12))   # a @2x képen 12 = 1x-en 6 px
    x = G + i * (W + G)
    lap.paste(im.resize((W, H), Image.LANCZOS), (x, G))
    lap.paste(elmosott.resize((W, H), Image.LANCZOS), (x, H + 2 * G))
lap.save(os.path.join(D, '_hunyoritas.png'))
print('ok', os.path.join(D, '_hunyoritas.png'))

# elemlap: @2x kép, balra az eredeti, jobbra ugyanez elmosva (a blur a 2x-es képen 12, ami 1x-en 6)
el = Image.open(os.path.join(D, '07_elemek.png')).convert('RGB')
ki = Image.new('RGB', (el.width * 2 + 20, el.height), '#8C95A5')
ki.paste(el, (0, 0))
ki.paste(el.filter(ImageFilter.GaussianBlur(12)), (el.width + 20, 0))
ki.save(os.path.join(D, '07_elemek_hunyoritas.png'))
print('ok', os.path.join(D, '07_elemek_hunyoritas.png'))
