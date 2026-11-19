# -*- coding: utf-8 -*-
"""Kézjegy C2, 5. kör: a „kész” jel kis méretben (állapotjel, jelvény, idővonal-pont, 19–24 pt).
A jóváhagyott 3D ibolya pecsét (assets/ikon3d/befizetve.png) a B lapról jön, és ott a pecsét LEBEG: az árnyéka a
tárgy alatt külön csíkban van. 19–24 pt-on ez a csík kóbor aláhúzásnak látszik, és a négyzet közepe is az árnyék felé
van tolva, ezért a pecsét a jelvényben balra fent ül. Itt a mester-PNG-ből csak a tárgy dobozát vágjuk ki (az árnyék
teljesen alatta van, a dobozba nem lóg bele), négyzetre egészítjük középre, 94%-os kitöltéssel, és lefelé méretezünk.
A mester és a többi ikon érintetlen. Kimenet: assets/ikon3d/befizetve_jel_<pt>@2x|@3x.png (20, 24, 28 pt).
Használat: python ikon_jel.py"""
import json, os
from PIL import Image

D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'ikon3d'))
NEV = 'befizetve'
KITOLTES = 0.94
PT = (20, 24, 28, 44, 84)  # 11-18: 44 pt a levél sarkára (03_allapot), 84 pt a 08 lapjára (a vonalas bélyegző helyett)


def main():
    info = json.load(open(os.path.join(D, '_info.json'), encoding='utf-8'))['ikonok'][NEV]
    ox0, oy0, ox1, oy1 = info['targy_doboz_px']
    bx, by, n = info['negyzet_px']
    mester = Image.open(os.path.join(D, NEV + '.png')).convert('RGBA')
    doboz = (ox0 - bx, oy0 - by, ox1 - bx, oy1 - by)
    targy = mester.crop(doboz)
    # ellenőrzés: a doboz alatti 3 px-es sávban ne legyen tárgy (ott már csak az árnyék kezdődhet)
    w, h = targy.size
    oldal = int(round(max(w, h) / KITOLTES))
    negyzet = Image.new('RGBA', (oldal, oldal), (0, 0, 0, 0))
    negyzet.paste(targy, ((oldal - w) // 2, (oldal - h) // 2))
    for pt in PT:
        for sz in (2, 3):
            px = pt * sz
            kep = negyzet.convert('RGBa').resize((px, px), Image.LANCZOS).convert('RGBA')
            kep.save(os.path.join(D, f'{NEV}_jel_{pt}@{sz}x.png'))
    print('ok', doboz, (w, h), oldal, [f'{NEV}_jel_{p}@2x|3x' for p in PT])


if __name__ == '__main__':
    main()
