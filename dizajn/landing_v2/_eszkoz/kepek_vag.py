# Telefonkeretbe illő képek az app v2 mintáiból: 780x1688 (390x844 @2x).
# A felső rész + az alsó dokk (navigáció, ill. gomb + navigáció) összeillesztve, hogy a képernyő valódi telefonnak hasson.
# Futtatás: python _eszkoz/kepek_vag.py  (a landing_v2 mappából)
from PIL import Image
import os
FORRAS = os.path.join(os.path.dirname(__file__), '..', '..', 'C5_v2')
CEL = os.path.join(os.path.dirname(__file__), '..', 'kepek')
H = 1688
# fájl: (alsó dokk magassága px-ben, kimeneti név)
LISTA = {
    '01_fooldal.png': (190, 'app_fooldal'),
    '51_felretesz.png': (380, 'app_felretesz'),
    '53_hataridok_b.png': (380, 'app_hataridok'),
    '70_uzenetek.png': (330, 'app_uzenetek'),
}
for f, (dokk, nev) in LISTA.items():
    im = Image.open(os.path.join(FORRAS, f)).convert('RGB')
    w, h = im.size
    out = Image.new('RGB', (w, H), (243, 245, 251))
    out.paste(im.crop((0, 0, w, H - dokk)), (0, 0))
    out.paste(im.crop((0, h - dokk, w, h)), (0, H - dokk))
    out.save(os.path.join(CEL, nev + '.webp'), 'WEBP', quality=88, method=6)
    print(nev, out.size)
a = Image.open(os.path.join(FORRAS, 'asztali', 'A01_fooldal.png')).convert('RGB')
a.save(os.path.join(CEL, 'app_asztali.webp'), 'WEBP', quality=88, method=6)
print('app_asztali', a.size)
