"""Az útmutató-videó(k) újrarenderelése a MEGLÉVŐ hangfelvételekkel – új hangfelvétel, átírás, lektor NÉLKÜL.

    python _eszkoz/video_ujra.py [--video <video mappa>] [--kepek <utmutato_kepek>] [--media <kod/media>] vallalkozas_bejelentes [meghatalmazas]

A sajat_kepek.py hívja, ha új NAV-kép került egy útmutatóba. A video/vallalkozas_bejelentes/eszkoz/ motorját használja
(render.py, ellenoriz.py, epit.mediaba), a fájljaihoz nem nyúl. Ugyanazt csinálja, mint az `epit.py <név>`, csak a hang-
lépések (hang.py TTS, vak.py átírás, újravétel, gyorsítás) nélkül: a video/<név>/hang/ WAV-jai és hossz.json-ja marad.

Biztosítékok:
  - a hálózat (urllib, socket) és a fizetős hívások (kozos.tts, kozos.chat, kozos.or_kulcs) a folyamaton belül tiltva:
    ha bármi hangot akarna kérni, hibával megáll, és egy fillér sem megy el;
  - a forgatókönyv kézi kameranézetei ("nezet", "skala", "sor_eleje", "nyito_arany") a 2026-11-19-i képekre készültek
    (_eszkoz/video_nezet_alap.json). Ha egy kép tartalma azóta megváltozott (valódi / saját kép), ezeket a nézeteket csak
    a memóriában, erre a renderelésre elhagyja, és a kamera a jelölések helyéből számol. A forgatokonyv.json nem változik;
  - a régi kimenet a video/<név>/_regi/ alá kerül (mint az epit.py-nál), a kod/media/ másolat régije is.
Kilépési kód: 0 = kész és az ellenőrzés rendben, 1 = ellenőrzési hiba, 2 = hiba.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import socket
import sys
import urllib.request

ITT = os.path.dirname(os.path.abspath(__file__))
KEPEK_ALAP = os.path.dirname(ITT)
APP = os.path.dirname(KEPEK_ALAP)


class HalozatTiltva(RuntimeError):
    pass


def _tilt(*a, **k):
    raise HalozatTiltva('video_ujra: hálózat / hangkérés tiltva – ez a lépés nem kerülhet pénzbe')


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--video', default=os.path.join(APP, 'video'))
    p.add_argument('--kepek', default=KEPEK_ALAP)
    p.add_argument('--media', default=os.path.join(APP, 'kod', 'media'))
    p.add_argument('nevek', nargs='+')
    a = p.parse_args(argv)
    video = os.path.abspath(a.video).replace('\\', '/')
    kepek = os.path.abspath(a.kepek).replace('\\', '/')
    media = os.path.abspath(a.media).replace('\\', '/')
    eszkoz = f'{video}/vallalkozas_bejelentes/eszkoz'
    if not os.path.isdir(eszkoz):
        print('nincs videómotor:', eszkoz)
        return 2

    urllib.request.urlopen = _tilt
    socket.create_connection = _tilt
    socket.socket.connect = _tilt
    sys.path.insert(0, eszkoz)
    import kozos as K  # noqa: E402
    K.VIDEO, K.KEPEK, K.MEDIA, K.HANG_JSON = video, kepek, media, video + '/hang.json'
    K.tts = K.chat = K.or_kulcs = K.generacio_koltseg = _tilt

    alap_p = os.path.join(kepek, '_eszkoz', 'video_nezet_alap.json')
    alap = json.load(open(alap_p, encoding='utf-8'))['kepek'] if os.path.exists(alap_p) else {}
    eredeti_fk = K.forgatokonyv
    elhagyott = set()

    def forgatokonyv(nev):
        fk = eredeti_fk(nev)
        utm = fk.get('utmutato') or nev
        for j in fk.get('jelenetek', []):
            for s in j.get('sorok', []):
                for jel in s.get('jel') or []:
                    kep = jel.get('kep') or s.get('kep')
                    if not kep or not any(k in jel for k in ('nezet', 'skala', 'sor_eleje', 'nyito_arany')):
                        continue
                    if alap.get(f'{utm}/{kep}') != sha(f'{kepek}/{utm}/{kep}@2x.png'):
                        for k in ('nezet', 'skala', 'sor_eleje', 'nyito_arany'):
                            jel.pop(k, None)
                        elhagyott.add(kep)
        return fk

    K.forgatokonyv = forgatokonyv
    import render as R  # noqa: E402
    import ellenoriz as E  # noqa: E402
    import epit as EP  # noqa: E402

    rc = 0
    for nev in a.nevek:
        d = K.mappa(nev)
        if not os.path.exists(f'{d}/hang/hossz.json'):
            print(f'[{nev}] nincs meg a hang (hang/hossz.json) – kihagyva')
            rc = 2
            continue
        ts = dt.datetime.now().strftime('%Y%m%d_%H%M%S')
        for f in (f'{nev}.mp4', f'{nev}.vtt', f'{nev}_poszter.jpg'):
            if os.path.exists(f'{d}/{f}'):
                regi = f'{d}/_regi/kimenet_{ts}_sajat_kepek'
                os.makedirs(regi, exist_ok=True)
                shutil.copyfile(f'{d}/{f}', f'{regi}/{f}')
        print(f'[{nev}] renderelés a meglévő hanggal ({d}/hang) ...', flush=True)
        try:
            R.epit(nev, mod='vegleges')
        except HalozatTiltva as e:
            print(f'[{nev}] MEGÁLLT: {e}')
            return 2
        if elhagyott:
            print(f'[{nev}] a megváltozott képeken a kézi kameranézet helyett a jelölésekhez igazít: {", ".join(sorted(elhagyott))}')
        EP.mediaba(nev)
        hibak = E.ellenoriz(nev, kockak=True)
        for h in hibak:
            print(f'[{nev}] HIBA: {h}')
        rc = rc or (1 if hibak else 0)
        print(f'[{nev}] kész: {d}/{nev}.mp4 (ellenőrzés: {"RENDBEN" if not hibak else "HIBÁS"}); kockák: {d}/kockak/vegso_lap_*.jpg')
    return rc


if __name__ == '__main__':
    sys.exit(main())
