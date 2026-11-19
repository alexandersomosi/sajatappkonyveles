"""A NAV hivatalos kisfilmjéből („Megújul az Ügysegéd”, https://youtu.be/DQnbjo2lrv8, NAVgovHu, 2026.02.19.) rögzített
kockák előkészítése az annotate.py-nak: _forras2/kisfilm_kockak/kocka_*.png -> _nyers/kisfilm_2026-02-19/<nev>.png + .json.

Mit csinál kockánként (újrafuttatható, a kimenetet felülírja; a forráshoz nem nyúl):
  1. Elmossa a személyes / azonosító adatot, a mintaadatot is (a NAV tesztfelhasználójának nevét: „SAMPLE …”,
     az ügy azonosítóját) – ugyanazzal az elmosással, mint az annotate.py.
  2. Eltünteti a tesztkörnyezet fejlesztői buborékát („evny.main.tabs…”) és a böngésző állapotsorát: a terület
     minden sorát a terület bal szélének színével tölti ki (fehér háttér / szegély folytatása). A NAV felületének
     tartalmán nem változtat.
  3. A .json-ba írja a jelölendő elemek helyét („helyek”, a kocka pixelében) – az index.json "@kulcs"-csal hivatkozik rájuk.

Futtatás: python _eszkoz/kisfilm_nyers.py   (az utmutato_kepek mappából vagy bárhonnan)
A kockák rögzítése: a beépített böngészőben, a lejátszó kockáját canvasra rajzolva, 1:1-es képernyőképekből összerakva
(videót nem töltöttünk le) – lásd _forras2/kisfilm_kockak/kockak.json és forrasok.md.
"""
import json
import os
import sys

from PIL import Image

GYOKER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, GYOKER)
import annotate as A  # noqa: E402  (homalyosit)

FORRAS = os.path.join(GYOKER, '_forras2', 'kisfilm_kockak')
CEL = os.path.join(GYOKER, '_nyers', 'kisfilm_2026-02-19')

# A koordináták a kocka_*.png-ben (= a 1920x1080-as videókocka, eltolva a fájlnévben jelzett x/y-nal).
KOCKAK = {
    'ugyseged_fooldal': {
        'forras': 'kocka_t031.6_x190_y90.png', 'ido': 31.6,
        'homalyos': [[1058, 54, 1202, 86]],                      # fejléc: a bejelentkezett (minta)felhasználó neve
        'kitolt': [],
        'helyek': {'uj': [625, 157, 967, 221], 'fulek': [163, 148, 1488, 226]},
    },
    'ugyseged_ugytipus': {
        'forras': 'kocka_t027.5_x190_y90.png', 'ido': 27.5,
        'homalyos': [[1046, 54, 1192, 86], [828, 284, 952, 347]],  # fejléc-név; a Személyi adatok mintanevei
        'kitolt': [],
        'helyek': {'kezdes': [205, 657, 640, 704], 'kartya': [192, 650, 1462, 727]},
    },
    'szemelyi_adatok': {
        'forras': 'kocka_t021.6_x190_y150.png', 'ido': 21.6,
        'homalyos': [[1148, 46, 1268, 74], [818, 356, 928, 412]],
        'kitolt': [],
        'helyek': {'adatok': [150, 318, 1490, 590], 'leptek': [150, 250, 1490, 310]},
    },
    'nyilatkozatok': {
        'forras': 'kocka_t024.0_x190_y150.png', 'ido': 24.0,
        'homalyos': [[1188, 40, 1308, 66]],
        'kitolt': [[466, 528, 784, 574]],                         # fejlesztői buborék + egérmutató
        'helyek': {'kizaro': [158, 428, 830, 465], 'tobbi': [150, 482, 1488, 726]},
    },
    'bekuldes': {
        'forras': 'kocka_t037.3_x190_y380.png', 'ido': 37.3,
        'homalyos': [],
        'kitolt': [[1266, 372, 1501, 399]],                       # fejlesztői buborék a gomb alatt
        'helyek': {'osszesito': [146, 22, 1489, 303], 'gomb': [1310, 334, 1488, 383], 'vissza': [120, 334, 298, 383]},
    },
    'megtekintes_pdf': {
        'forras': 'kocka_t042.5_x190_y300.png', 'ido': 42.5,
        'homalyos': [[106, 325, 192, 347]],                       # az ügy azonosítója
        'kitolt': [],
        'helyek': {'megtekintes': [92, 349, 192, 398], 'bejelenteseim': [70, 50, 254, 90], 'bejelenteseim_ful': [60, 44, 528, 96]},
    },
}


def kitolt(kep: Image.Image, r) -> None:
    """A terület minden sorát a terület bal szélén (x0-1) lévő pixel színével tölti ki."""
    x0, y0, x1, y1 = [int(v) for v in r]
    px = kep.load()
    for y in range(max(0, y0), min(kep.height, y1)):
        szin = px[max(0, x0 - 1), y]
        for x in range(max(0, x0), min(kep.width, x1)):
            px[x, y] = szin


def main():
    os.makedirs(CEL, exist_ok=True)
    meta = json.load(open(os.path.join(FORRAS, 'kockak.json'), encoding='utf-8'))
    for nev, k in KOCKAK.items():
        kep = Image.open(os.path.join(FORRAS, k['forras'])).convert('RGB')
        for r in k['kitolt']:
            kitolt(kep, r)
        for r in k['homalyos']:
            A.homalyosit(kep, r)
        kep.save(os.path.join(CEL, nev + '.png'))
        json.dump({'forras': meta['forras'], 'kocka_ido_mp': k['ido'], 'kocka_fajl': '_forras2/kisfilm_kockak/' + k['forras'],
                   'elmosva': k['homalyos'], 'kitoltve': k['kitolt'], 'meret': [kep.width, kep.height], 'helyek': k['helyek']},
                  open(os.path.join(CEL, nev + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(nev, kep.size)


if __name__ == '__main__':
    main()
