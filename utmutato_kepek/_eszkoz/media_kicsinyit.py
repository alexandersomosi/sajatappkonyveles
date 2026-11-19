"""Az app útmutató-képeinek kicsinyítése a telefonhoz (2026-11-19): kod/media/utmutato/<útmutató>/*.png -> 256 színű PNG.

    python C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/_eszkoz/media_kicsinyit.py          # minden útmutató
    python .../media_kicsinyit.py --proba                                                      # csak kiírja, nem ír

Mikor: MINDIG a normalizáló (node kod/app/scripts/utmutato-kepek.mjs) UTÁN és a feltöltés (bash kod/deploy/feltolt.sh --media)
ELŐTT. A normalizáló a forrás (utmutato_kepek/<útmutató>/) teljes színű PNG-it másolja; ha egy kép megváltozott, újra azt
teszi ki, ezért ezt a lépést utána mindig újra kell futtatni (a már kicsinyített, palettás képeket átugorja).

Miért: az app telefonon (PixelRatio >= 2) a @2x képet tölti be (2160 px széles, 0,1–1 MB). A 256 színű változat
a képernyőképeken szemre ugyanaz, és kb. harmada akkora (2026-11-19: a két útmutató 66 képe 23,1 MB -> kb. 7 MB).
A színpaletta két részből áll: a kép ~210 leggyakoribb színe (median cut) + a ritka, de élénk színek (pl. a NAV-logó
piros-zöldje, a jelölések kékje és borostyánja) színcsoportonként egy-egy hellyel, hogy semmi ne szürküljön el.
Csak akkor cseréli a fájlt, ha (1) a PSNR >= 38 dB, (2) a pixelek 99,99 %-ánál a hiba < 64 (0–255), és (3) legalább
15 %-kal kisebb lesz. A forrás (utmutato_kepek/) és a videók képei NEM változnak; a méret (szélesség, magasság) sem.
A régi fájl a kod/media/utmutato/_regi/<idő>_kicsinyites/<útmutató>/ mappába kerül (nem törlünk).
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import os
import shutil
import sys

import numpy as np
from PIL import Image

ITT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(ITT))
MEDIA_UTM = os.path.join(APP, 'kod', 'media', 'utmutato')


def kvantal(rgb: Image.Image, max_extra: int = 48) -> Image.Image:
    a = np.asarray(rgb)
    sat = a.max(axis=2).astype(int) - a.min(axis=2).astype(int)
    sz = a[sat > 36].astype(np.int32)
    extra: list[int] = []
    if len(sz):
        kulcs = (sz[:, 0] // 40) * 49 + (sz[:, 1] // 40) * 7 + (sz[:, 2] // 40)
        _, inv, db = np.unique(kulcs, return_inverse=True, return_counts=True)
        for i in np.argsort(-db)[:max_extra]:
            if db[i] < 12:
                break
            extra += [int(x) for x in sz[inv == i].mean(axis=0).round()]
    fo = 256 - len(extra) // 3
    pal = rgb.quantize(colors=fo, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[: fo * 3]
    teljes = pal + extra
    teljes += teljes[:3] * (256 - len(teljes) // 3)
    pimg = Image.new('P', (1, 1))
    pimg.putpalette(teljes[:768])
    return rgb.quantize(palette=pimg, dither=Image.Dither.NONE)


def egy(p: str) -> tuple[bytes | None, str]:
    im = Image.open(p)
    if im.mode == 'P':
        return None, 'már palettás'
    rgb = im.convert('RGB')
    q = kvantal(rgb)
    b = io.BytesIO()
    q.save(b, 'PNG', optimize=True)
    a = np.asarray(rgb, np.int16)
    c = np.asarray(q.convert('RGB'), np.int16)
    hiba = np.abs(a - c).max(axis=2)
    mse = float(((a - c) ** 2).mean())
    psnr = 10 * np.log10(255 ** 2 / max(mse, 1e-9))
    p9999 = float(np.percentile(hiba, 99.99))
    s0, s1 = os.path.getsize(p), len(b.getvalue())
    info = f'{s0 // 1024} K -> {s1 // 1024} K, PSNR {psnr:.1f} dB, 99,99 %-os hiba {p9999:.0f}'
    if psnr < 38 or p9999 >= 64:
        return None, 'MARAD (minőség): ' + info
    if s1 > s0 * 0.85:
        return None, 'marad (alig kisebb): ' + info
    return b.getvalue(), info


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--media', default=MEDIA_UTM)
    ap.add_argument('--proba', action='store_true')
    a = ap.parse_args(argv)
    ts = dt.datetime.now().strftime('%Y%m%d_%H%M%S')
    regi = os.path.join(a.media, '_regi', f'{ts}_kicsinyites')
    ossz0 = ossz1 = csere = 0
    for kind in sorted(os.listdir(a.media)):
        d = os.path.join(a.media, kind)
        if kind.startswith('_') or not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith('.png'):
                continue
            p = os.path.join(d, f)
            s0 = os.path.getsize(p)
            uj, info = egy(p)
            ossz0 += s0
            if uj is None:
                ossz1 += s0
                print(f'  {kind}/{f}: {info}')
                continue
            ossz1 += len(uj)
            csere += 1
            print(f'  {kind}/{f}: {info}')
            if a.proba:
                continue
            os.makedirs(os.path.join(regi, kind), exist_ok=True)
            shutil.move(p, os.path.join(regi, kind, f))
            with open(p, 'wb') as fh:
                fh.write(uj)
    print(f'{csere} kép kicsinyítve; összesen {ossz0 / 1048576:.1f} MB -> {ossz1 / 1048576:.1f} MB'
          + ('' if a.proba or not csere else f' (a régiek: {regi})'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
