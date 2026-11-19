"""Végpontig tartó próba a sajat_kepek.py-hoz – a valódi fájlokhoz NEM nyúl.

    python _eszkoz/sajat_kepek_proba.py [<próbamappa>] [--video-nelkul]
    python _eszkoz/sajat_kepek_proba.py --csak-horgony     # csak a gyors horgony-regresszió (valódi NAV-króm, 05/06/12)

1. Egy ideiglenes mappába (alap: %TEMP%/kezjegy_sajat_proba_<idő>) lemásolja, ami a parancshoz kell: utmutato_kepek
   (a képek, index.json-ok, annotate.py, sajat_kepek.py, _eszkoz), a kod/app normalizálóját és a GUIDE_STEP_KEYS-t,
   a kod/media/utmutato jegyzékeit, és a bejelentés-videó motorját + a meglévő hangfelvételeit.
2. „Tulaj-képernyőképnek” a mostani rajzolt vázlatok MÁSOLATAIT teszi a sajat/vallalkozas_bejelentes/ alá (02–13), és
   a 02, 04, 05, 12. képre KITALÁLT személyes adatot fest (MINTA PÉTER, Próba Erzsébet, Mintaváros, 8123456789 …), hogy
   az elmosás tényleg ki legyen próbálva.
3. Lefuttatja a próbamappában: python sajat_kepek.py --kepek … --kod … --video … (ugyanaz a kód, csak más gyökerek).
4. Ellenőrzi: minden kép feldolgozva; a kitalált adatok egyike sem olvasható ki (OCR) a _sajat/ képekből; az index.json-ban
   a lépések saját képet használnak; az app-jegyzékben „kepernyokep”; a videó elkészült, és a költségnapló nem nőtt
   (nem volt hangkérés); a valódi utmutato_kepek / kod/media / video fájlok SHA-256-ja a próba előtt és után azonos.
Kilépési kód: 0 = minden rendben.
"""
from __future__ import annotations

import datetime as dt
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

from PIL import Image, ImageDraw, ImageFont

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:  # pragma: no cover
    pass

ITT = os.path.dirname(os.path.abspath(__file__))
KEPEK = os.path.dirname(ITT)
APP = os.path.dirname(KEPEK)
KOD = os.path.join(APP, 'kod')
VIDEO = os.path.join(APP, 'video')

KITALALT = ['MINTA PÉTER', 'Próba Erzsébet', 'Mintaváros', '8123456789', '1990.05.17.', 'Próba utca 12.']
SORSZAM_KEP = {2: 'ugyseged_fooldal', 3: 'ugyseged_ugytipus', 4: 'szemelyi_adatok', 5: 'cimadatok', 6: 'tevekenysegek',
               7: 'adozas_munkavegzes_fofoglalkozas', 8: 'adozas_kata_atalany', 9: 'adozas_afa_mentesseg',
               10: 'adozas_afa_tobbi_eu_nem', 11: 'nyilatkozatok', 12: 'ellenorzes', 13: 'bekuldes'}
ADATOK = {
    'szemelyi_adatok': ['MINTA PÉTER', 'MINTA PÉTER', 'Próba Erzsébet', 'Mintaváros', '1990.05.17.', 'magyar',
                        '1234 Mintaváros, Próba utca 12.', '8123456789'],
    'cimadatok': ['1234', 'Mintaváros', 'Próba', 'utca', '12', '3. em. 4.'],
    'ellenorzes': ['1234 Mintaváros, Próba utca 12.', '620100 Programozás', 'Főfoglalkozású'],
}
FEJLEC = {'ugyseged_fooldal', 'szemelyi_adatok', 'cimadatok'}


def sha_fa(gyokerek: list) -> dict:
    ki = {}
    for g in gyokerek:
        for p in glob.glob(os.path.join(g, '**', '*'), recursive=True):
            if os.path.isfile(p) and '_regi' not in p.replace('\\', '/').split('/'):
                ki[p] = (os.path.getsize(p), os.path.getmtime(p))
    return ki


def betu(meret):
    return ImageFont.truetype(os.path.join(KEPEK, '_betu', 'Inter_opsz_wght.ttf'), meret)


def hamis_adat(kep: Image.Image, slug: str) -> Image.Image:
    """A vázlat szürke adatsávjaira (#B7C0CE) kitalált adatot ír; a fejlécbe bejelentkezett felhasználót."""
    import numpy as np
    a = np.asarray(kep.convert('RGB')).astype(int)
    m = (abs(a[:, :, 0] - 183) < 6) & (abs(a[:, :, 1] - 192) < 6) & (abs(a[:, :, 2] - 206) < 6)
    d = ImageDraw.Draw(kep)
    savok = []
    if m.any():
        import cv2
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m.astype('uint8'), 8)
        for i in range(1, n):
            x, y, w, h, area = stats[i]
            if w > 40 and h > 15:
                savok.append((y, x, w, h))
    savok.sort()
    for (y, x, w, h), szoveg in zip(savok, ADATOK.get(slug, [])):
        d.rectangle([x - 3, y - 3, x + w + 3, y + h + 3], fill=(255, 255, 255))
        d.text((x, y - h * 0.35), szoveg, font=betu(int(h * 1.35)), fill=(29, 36, 51))
    if slug in FEJLEC:
        W = kep.width
        d.rectangle([int(W * 0.48), 4, W - 4, 158], fill=(255, 255, 255))
        d.text((int(W * 0.55), 22), 'Bejelentkezett felhasználó', font=betu(36), fill=(75, 85, 103))
        d.text((int(W * 0.55), 80), 'MINTA PÉTER', font=betu(44), fill=(29, 36, 51))
    return kep


def masol_fa(honnan, hova, kihagy=('_regi', '_forras', '_forras2', '_elonezet', 'sajat', '_sajat', '__pycache__')):
    shutil.copytree(honnan, hova, ignore=shutil.ignore_patterns(*kihagy))


# ----------------------------------------------------------------------------------------------------------------------
# 11-19 javító kör 2 – regresszió: a VALÓDI NAV-űrlap „krómja” (fejléc, cím, 1–6 lépéssor a címkékkel, a NAV saját
# kisfilmjének 21,6 s-os kockájából) + a vázlat tartalma kitalált értékekkel. Eddig a próba csak a vázlatokat kapta, amiken
# nincs lépéssor-címke, így nem fogta meg, hogy a 06-on a „Főtevékenység” horgony a cím „tevékenység” szavára talált.
KROM_KOCKA = os.path.join(KEPEK, '_forras2', 'kisfilm_kockak', 'kocka_t021.6_x190_y150.png')
KROM_ALJA = 322          # a kocka lépéssor-címkéi alatt (OCR: 293–305 px)
VAZLAT_TARTALOM = 660    # a vázlatok saját fejléce + lépéssora eddig tart (2060 px széles vásznon)
HORGONY_LAPOK = {5: 'cimadatok', 6: 'tevekenysegek', 12: 'ellenorzes'}


def kromos_kep(slug: str) -> Image.Image:
    krom = Image.open(KROM_KOCKA).convert('RGB')
    krom = krom.crop((0, 0, krom.width, KROM_ALJA))
    v = Image.open(os.path.join(KEPEK, '_illusztracio', 'png', slug + '.png')).convert('RGB')
    v = v.crop((0, VAZLAT_TARTALOM, v.width, v.height))
    v = v.resize((krom.width, int(v.height * krom.width / v.width)), Image.LANCZOS)
    ki = Image.new('RGB', (krom.width, krom.height + v.height), (255, 255, 255))
    ki.paste(krom, (0, 0))
    ki.paste(v, (0, krom.height))
    if slug in ADATOK:
        d = ImageDraw.Draw(ki)
        f = betu(26)
        for i, t in enumerate(ADATOK[slug][:3]):
            d.text((860, krom.height + 40 + i * 40), t, fill=(30, 30, 30), font=f)
    return ki


def horgony_regresszio(munkamappa: str) -> list:
    """-> a hibák listája (üres = rendben). A sajat_kepek.py horgony-keresését futtatja a krómos képeken."""
    sys.path.insert(0, KEPEK)
    import sajat_kepek as S  # noqa: E402
    hibak = []
    os.makedirs(munkamappa, exist_ok=True)
    munka = os.path.join(munkamappa, 'ocr_munka.png')
    for nn, slug in HORGONY_LAPOK.items():
        kep = kromos_kep(slug)
        kep.save(os.path.join(munkamappa, f'{nn:02d}_{slug}_kromos.png'))
        sorok = S.ocr(kep, munka, KEPEK)
        _, lent = S.urlap_kroma(sorok)
        if lent is None:
            hibak.append(f'{nn:02d} {slug}: a lépéssort nem ismerte fel (a próba maga hibás)')
            continue
        ank = S.ankor('vallalkozas_bejelentes', slug) or {}
        for n, a in sorted(ank.items()):
            if a.get('mod') == 'gomb':
                continue                                   # a gombok (Vissza) a vázlat alján vannak, nem a krómban
            r = S.jeloles_doboz(sorok, kep, a)
            if not r:
                hibak.append(f'{nn:02d} {slug}: a(z) {n}. jelölést nem találta')
            elif r[1] < lent:
                hibak.append(f'{nn:02d} {slug}: a(z) {n}. jelölés a címre / lépéssorra került (felső széle {int(r[1])} < {int(lent)})')
        if slug == 'tevekenysegek':
            fo = [x for x in S.talal(sorok, 'Főtevékenység') if x[0].y0 > lent]
            r1 = S.jeloles_doboz(sorok, kep, ank[1])
            if not fo or not r1 or not (r1[1] <= fo[0][0].y0 <= r1[3]):
                hibak.append('06 tevekenysegek: az 1-es keret nem a „Főtevékenység” blokkot fogja')
    return hibak


def main(argv):
    video_nelkul = '--video-nelkul' in argv
    csak_horgony = '--csak-horgony' in argv
    argv = [x for x in argv if not x.startswith('--')]
    if csak_horgony:
        T0 = os.path.join(tempfile.gettempdir(), 'kezjegy_horgony_proba_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S'))
        hibak = horgony_regresszio(T0)
        print('horgony-próba (valódi NAV-króm):', 'RENDBEN' if not hibak else 'HIBA')
        for h in hibak:
            print('  ! ' + h)
        print('képek:', T0)
        return 1 if hibak else 0
    T = os.path.abspath(argv[0]) if argv else os.path.join(tempfile.gettempdir(), 'kezjegy_sajat_proba_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S'))
    if os.path.exists(T) and os.listdir(T):
        print('a próbamappa nem üres:', T)
        return 2
    os.makedirs(T, exist_ok=True)
    print('próbamappa:', T)
    valodi = [os.path.join(KEPEK, 'vallalkozas_bejelentes'), os.path.join(KEPEK, 'meghatalmazas'), os.path.join(KEPEK, '_sajat'),
              os.path.join(KOD, 'media'), os.path.join(VIDEO, 'vallalkozas_bejelentes')]
    elotte = sha_fa(valodi)
    elotte_index = hashlib.sha256(open(os.path.join(KEPEK, 'vallalkozas_bejelentes', 'index.json'), 'rb').read()).hexdigest()

    # 1) másolatok
    tk = os.path.join(T, 'utmutato_kepek')
    masol_fa(KEPEK, tk)
    os.makedirs(os.path.join(tk, '_sajat'), exist_ok=True)
    tkod = os.path.join(T, 'kod')
    os.makedirs(os.path.join(tkod, 'app', 'scripts'))
    for f in ('utmutato-kepek.mjs', 'utmutato-kepek.map.json'):
        shutil.copyfile(os.path.join(KOD, 'app', 'scripts', f), os.path.join(tkod, 'app', 'scripts', f))
    os.makedirs(os.path.join(tkod, 'shared', 'src'))
    shutil.copyfile(os.path.join(KOD, 'shared', 'src', 'enums.ts'), os.path.join(tkod, 'shared', 'src', 'enums.ts'))
    for u in ('vallalkozas_bejelentes', 'meghatalmazas'):
        shutil.copytree(os.path.join(KOD, 'media', 'utmutato', u), os.path.join(tkod, 'media', 'utmutato', u))
    for f in glob.glob(os.path.join(KOD, 'media', 'vallalkozas_bejelentes*')):
        shutil.copyfile(f, os.path.join(tkod, 'media', os.path.basename(f)))
    tv = os.path.join(T, 'video')
    vb = os.path.join(VIDEO, 'vallalkozas_bejelentes')
    os.makedirs(os.path.join(tv, 'vallalkozas_bejelentes', 'hang'))
    shutil.copytree(os.path.join(vb, 'eszkoz'), os.path.join(tv, 'vallalkozas_bejelentes', 'eszkoz'), ignore=shutil.ignore_patterns('__pycache__'))
    for f in ('forgatokonyv.json', 'koltseg.jsonl', 'vallalkozas_bejelentes.mp4', 'vallalkozas_bejelentes.vtt', 'vallalkozas_bejelentes_poszter.jpg'):
        if os.path.exists(os.path.join(vb, f)):
            shutil.copyfile(os.path.join(vb, f), os.path.join(tv, 'vallalkozas_bejelentes', f))
    for f in glob.glob(os.path.join(vb, 'hang', '*.wav')) + glob.glob(os.path.join(vb, 'hang', '*.json')):
        shutil.copyfile(f, os.path.join(tv, 'vallalkozas_bejelentes', 'hang', os.path.basename(f)))
    for f in glob.glob(os.path.join(VIDEO, '*.py')) + glob.glob(os.path.join(VIDEO, '*.json')):   # közös modulok (felirat_tores, hang_ellenorzes) + hang.json
        shutil.copyfile(f, os.path.join(tv, os.path.basename(f)))
    koltseg_elotte = open(os.path.join(tv, 'vallalkozas_bejelentes', 'koltseg.jsonl'), encoding='utf-8').read()

    # 2) kitalált „tulaj-képek” a vázlatok másolataiból
    be = os.path.join(tk, 'sajat', 'vallalkozas_bejelentes')
    os.makedirs(be)
    for nn, slug in SORSZAM_KEP.items():
        k = Image.open(os.path.join(KEPEK, '_illusztracio', 'png', slug + '.png')).convert('RGB')
        k = hamis_adat(k, slug)
        k.save(os.path.join(be, f'{nn:02d}.png'))
    print('kitalált tulaj-képek:', be)

    # 3) a parancs
    t0 = time.time()
    cmd = [sys.executable, os.path.join(tk, 'sajat_kepek.py'), '--kepek', tk, '--kod', tkod, '--video', tv,
           '--utmutato', 'vallalkozas_bejelentes'] + (['--video-nelkul'] if video_nelkul else [])
    print('futtatom:', ' '.join(cmd), flush=True)
    rc = subprocess.run(cmd).returncode
    print('sajat_kepek.py kilépési kód:', rc, f'({time.time() - t0:.0f} s)')

    # 4) ellenőrzés
    hibak = []
    sys.path.insert(0, tk)
    import sajat_kepek as S
    ix = json.load(open(os.path.join(tk, 'vallalkozas_bejelentes', 'index.json'), encoding='utf-8'))
    munka = os.path.join(tk, '_sajat', '_munka', 'proba_ocr.png')
    norm_kitalalt = [S.norm(x) for x in KITALALT]
    for l in ix['lepesek']:
        if l['sorszam'] not in SORSZAM_KEP:
            continue
        nev = f"{l['sorszam']:02d}_{l['slug']}"
        if (l.get('kimenet') or {}).get('forras_hasznalt') != 'sajat':
            hibak.append(f'{nev}: nem a saját képet használja')
            continue
        if (l.get('kimenet') or {}).get('tipus') != 'valodi':
            hibak.append(f'{nev}: kimenet.tipus nem valodi')
        sajat = Image.open(os.path.join(tk, '_sajat', 'vallalkozas_bejelentes', nev + '.png')).convert('RGB')
        sorok = S.ocr(sajat, munka, tk)
        szoveg = ' '.join(S.norm(s.szoveg) for s in sorok)
        for x, nx in zip(KITALALT, norm_kitalalt):
            reszek = [p for p in nx.split() if len(p) >= 4]
            for p in reszek:
                if any(S.hasonlo(p, w, 0.85) for w in szoveg.split()):
                    hibak.append(f'{nev}: a kitalált adat egy része („{p}”) még olvasható')
        jel = l['sajat']['jelolesek']
        print(f"  {nev}: elmosva {l['sajat']['auto']['elmosva']} terület, jelölés {sum(1 for j in jel if j['doboz'])}/{len(jel)}")
    S.munkafajl_urit(munka)
    kj = json.load(open(os.path.join(tkod, 'media', 'utmutato', 'vallalkozas_bejelentes', 'kepek.json'), encoding='utf-8'))
    kk = sum(1 for i in kj['items'] if i['kind'] == 'kepernyokep')
    print(f'  app-jegyzék: {len(kj["items"])} kép, ebből {kk} valódi képernyőkép')
    if kk < 17:
        hibak.append(f'az app-jegyzékben csak {kk} valódi kép van (várt: 18 – mind a 18, mert 02–13 saját, 01 és 14 valódi)')
    if not video_nelkul:
        mp4 = os.path.join(tv, 'vallalkozas_bejelentes', 'vallalkozas_bejelentes.mp4')
        if not os.path.exists(mp4) or os.path.getmtime(mp4) < t0:
            hibak.append('a videó nem készült el újra')
        if not os.path.exists(os.path.join(tkod, 'media', 'vallalkozas_bejelentes.mp4')) or os.path.getmtime(os.path.join(tkod, 'media', 'vallalkozas_bejelentes.mp4')) < t0:
            hibak.append('a videó nem került a (próba) kod/media-ba')
        if open(os.path.join(tv, 'vallalkozas_bejelentes', 'koltseg.jsonl'), encoding='utf-8').read() != koltseg_elotte:
            hibak.append('a költségnapló megváltozott (hangkérés történt?)')
        else:
            print('  költségnapló változatlan: nem volt hangkérés')
    utana = sha_fa(valodi)
    if utana != elotte:
        valt = sorted(set(utana.items()) ^ set(elotte.items()))
        hibak.append(f'VALÓDI fájl változott a próba alatt: {len(valt)} – pl. {valt[:3]}')
    else:
        print(f'  a valódi fájlok ({len(elotte)} db) nem változtak')
    if hashlib.sha256(open(os.path.join(KEPEK, 'vallalkozas_bejelentes', 'index.json'), 'rb').read()).hexdigest() != elotte_index:
        hibak.append('a valódi index.json megváltozott')
    if rc not in (0, 1):
        hibak.append(f'a sajat_kepek.py hibakóddal állt le: {rc}')
    # 11-19 javító kör 2: a valódi NAV-krómos horgony-regresszió is része a teljes próbának
    hibak.extend(horgony_regresszio(os.path.join(T, 'horgony')))
    print()
    print('ellenőrző lap:', os.path.join(tk, '_elonezet', 'sajat_ellenorzes_vallalkozas_bejelentes.jpg'))
    if not video_nelkul:
        print('videó-kockák:', os.path.join(tv, 'vallalkozas_bejelentes', 'kockak'))
    for h in hibak:
        print('HIBA:', h)
    print('PRÓBA:', 'RENDBEN' if not hibak else f'{len(hibak)} HIBA')
    return 0 if not hibak else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
