"""EGY PARANCS a tulaj saját NAV-képernyőképeihez (SAJAT_KEPEK.md).

    python C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/sajat_kepek.py

Mit csinál (sorban, hálózat és hangköltség nélkül):
  1. Beolvassa a képeket: utmutato_kepek/sajat/<útmutató>/NN.png (vagy .jpg; NN = a lépés sorszáma, pl. 02 ... 13).
  2. Szövegfelismerés (a Windows beépített magyar OCR-je, _eszkoz/ocr.ps1), és elmos minden személyes adatot:
     a bejelentkezett felhasználó nevét, a személyes rovatok értékét (név, anyja neve, születési adatok, adóazonosító,
     TAJ, cím), a hosszú számokat, e-mail-címet, a csupa nagybetűs neveket; az adatos lapokon (04, 05, 12) minden
     szót, ami nem a NAV felületének ismert szava (_eszkoz/ui_szavak.txt). Ha van sajat/nevek.txt (a saját neved,
     címed szavai soronként – csak a gépeden marad), az ezekre hasonlító szavakat minden képen elmossa.
     A kép ELMOSVA kerül a _sajat/<útmutató>/NN_slug.png-be (az eredeti a sajat/ mappában marad, a gépeden).
  3. A jelöléseket (keret + szám) a szöveg alapján a megfelelő sorra teszi; amit nem talál, annak a felirata a kép
     alá kerül, keret nélkül (figyelmeztet).
  4. index.json: a lépés "sajat" blokkja, forrása, alt-szövege; python annotate.py -> a jelölt kép (régi a _regi/-be).
  5. Ellenőrző lap: _elonezet/sajat_ellenorzes_<útmutató>.jpg (piros keret = elmosva, kék = jelölés). NÉZD MEG!
  6. Az appba másolás: node kod/app/scripts/utmutato-kepek.mjs (kod/media/utmutato/...).
  7. A videó újrarenderelése a MEGLÉVŐ hangfelvételekkel (_eszkoz/video_ujra.py): új hang, átírás, lektor nincs,
     a hálózat le van tiltva; a kész mp4 a kod/media/-ba is (a régi a video/<név>/_regi/-be).
  Feltölteni NEM tölt fel semmit: utána `bash kod/deploy/feltolt.sh --media` (lásd a végén kiírt sort).

Kapcsolók:
  --csak 04,05          csak ezek a sorszámok
  --utmutato meghatalmazas   csak ez az útmutató (alap: ami a sajat/ alatt van)
  --video-nelkul        a videót nem rendereli újra (gyors próba)
  --app-nelkul          az appba nem másol
  --kepek/--kod/--video/--media/--bemenet <mappa>   más gyökerek (a próba ezt használja: _eszkoz/sajat_kepek_proba.py)

Kézi javítás (ha az ellenőrző lapon valami nem jó): sajat/<útmutató>/NN.json, pl.
  {"homalyos": [[x0, y0, x1, y1]], "vagas": [x0, y0, x1, y1], "jelolesek": {"1": [x0, y0, x1, y1]}}
(a koordináták az EREDETI képernyőkép pixelei), majd újra ugyanez a parancs. Vagy szólj Claude-nak:
„nézd meg a saját NAV-képeim ellenőrző lapját”.
"""
from __future__ import annotations

import argparse
import datetime as dt
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:  # pragma: no cover
    pass

ITT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(ITT)
UTMUTATOK = ['vallalkozas_bejelentes', 'meghatalmazas']
VIDEO_NEV = {'vallalkozas_bejelentes': 'vallalkozas_bejelentes', 'meghatalmazas': 'meghatalmazas'}
KEP_MINTA = re.compile(r'^(\d{1,2})(?:[_\- ].*)?\.(png|jpe?g)$', re.I)

# --- melyik lapon mi számít személyes adatnak ------------------------------------------------------------------------
SZIGORU = {'szemelyi_adatok', 'cimadatok', 'ellenorzes'}   # adatos lapok: minden ismeretlen szó elmosva
SZEMELYES_CIMKEK = [
    'Viselt neve', 'Születési neve', 'Anyja születési neve', 'Anyja neve', 'Születési idő', 'Születési ország',
    'Születési hely', 'Adóazonosító jel', 'Adóazonosító', 'Állampolgárság', 'TAJ-szám', 'TAJ szám', 'Lakcím',
    'Családi és utónév', 'Születési családi és utónév', 'Anyja születési családi és utóneve', 'Irányítószám',
    'Település', 'Közterület neve', 'Közterület jellege', 'Házszám', 'Épület, emelet, ajtó', 'Lépcsőház',
    'Helyrajzi szám', 'Telefonszám', 'E-mail cím', 'E-mail', 'Székhely', 'Azonosító', 'Levelezési cím', 'Név',
]
CSAK_SOR = {'Székhely', 'Név', 'Cím'}   # ezek címsorként / gombként is előfordulnak: csak a mellettük álló érték

# --- a jelölések keresőszavai lépésenként (n -> keresés) ---------------------------------------------------------------
# mod: 'sor' = a talált szöveg; 'sor_bal' = a talált sor + balra a jelölőnégyzet/rádiógomb; 'gomb' = gomb a felirat körül;
#      'szakasz' = a címsortól a következő címsorig ('veg'); 'szeles' = a talált sorok uniója a tartalom jobb széléig.
# 'utolso': ha több találat van, a legalsó (pl. a gomb a lap alján, nem a címben).
ANKOROK = {
    'vallalkozas_bejelentes': {
        'ugyseged_fooldal': {1: {'keres': ['Új bejelentés, kérelem benyújtása', 'Új bejelentés'], 'mod': 'sor'}},
        'ugyseged_ugytipus': {1: {'keres': ['Egyéni vállalkozói tevékenység elkezdése', 'tevékenység elkezdése'], 'mod': 'sor'}},
        'szemelyi_adatok': {1: {'keres': ['Viselt neve', 'Születési neve', 'Anyja születési', 'Születési idő', 'Születési hely',
                                          'Adóazonosító jel', 'Állampolgárság', 'Családi és utónév', 'Lakcím'], 'mod': 'szeles', 'mind': True,
                                'alatta': 2.6}},
        'cimadatok': {1: {'keres': ['Székhely'], 'mod': 'szakasz', 'veg': ['Telephely', 'Fióktelep']},
                      2: {'keres': ['Telephely, fióktelep', 'Telephely', 'Fióktelep'], 'mod': 'szakasz', 'veg': ['Tovább', 'Vissza', 'Mentés']}},
        # 'bent': a blokk utolsó saját sora (+ 'bent_alatta' sornyi mező alatta) – ha a következő címsort az OCR nem olvassa
        'tevekenysegek': {1: {'keres': ['Főtevékenység'], 'mod': 'szakasz', 'veg': ['Egyéb tevékenység', 'Tevékenység(ek)', 'További tevékenység',
                                                                              'Új tevékenység hozzáadása'],
                              'bent': ['Kiválasztott főtevékenység', 'Új főtevékenység'], 'bent_alatta': 3.2},
                          # 11-19 javító kör 2: ha a „Tevékenység(ek)” címsort az OCR nem olvassa (zárójel), a blokk gombja is jó
                          2: {'keres': ['Egyéb tevékenységek', 'Egyéb tevékenység', 'Tevékenység(ek)', 'További tevékenység',
                                        'Új tevékenység hozzáadása', 'tevékenység hozzáadása'], 'mod': 'szakasz',
                              'veg': ['Tovább', 'Vissza', 'Mentés']}},
        'adozas_munkavegzes_fofoglalkozas': {1: {'keres': ['Főfoglalkozásként', 'Főfoglalkozású', 'Főfoglalkozás'], 'mod': 'sor_bal'}},
        'adozas_munkavegzes_munkaviszony_mellett': {1: {'keres': ['36 órás munkaviszony', 'munkaviszony mellett', 'Munkaviszony'], 'mod': 'sor_bal'}},
        'adozas_munkavegzes_tanulmany_mellett': {1: {'keres': ['tanulmányok mellett', 'nappali rendszerű', 'tanulmány'], 'mod': 'sor_bal'}},
        'adozas_munkavegzes_nyugdij_mellett': {1: {'keres': ['nyugdíj mellett', 'saját jogú nyugdíj', 'nyugdíj'], 'mod': 'sor_bal'}},
        'adozas_kata_atalany': {1: {'keres': ['tételes adóját', 'kisadózó vállalkozók', 'katát választom', 'kata'], 'mod': 'sor_bal'},
                                2: {'keres': ['átalányadózást választom', 'Az átalányadózást', 'átalányadó'], 'mod': 'sor_bal', 'utolso': True}},
        'adozas_afa_mentesseg': {1: {'keres': ['áfafizetési kötelezettség', 'Áfafizetés módja', 'áfafizetés'], 'mod': 'szakasz',
                                     'veg': ['Áfamentesség', 'Áfa-mentesség', 'Kizárólag közérdekű']},
                                 2: {'keres': ['alanyi adómentesség választása', 'Az alanyi adómentesség', 'alanyi adómentesség'], 'mod': 'sor_bal'}},
        'adozas_afa_tobbi_eu_igen': 'adozas_afa_tobbi',
        'adozas_afa_tobbi_eu_nem': 'adozas_afa_tobbi',
        'adozas_afa_tobbi': {1: {'keres': ['Közösségi adószámot igénylek', 'Közösségi adószám'], 'mod': 'sor_bal', 'utolso': True},
                             2: {'keres': ['EKB árfolyamát', 'MNB / EKB', 'EKB-árfolyam', 'MNB'], 'mod': 'sor_bal', 'utolso': True},
                             3: {'keres': ['pénzforgalmi elszámolást választom', 'pénzforgalmi elszámolás', 'pénzforgalmi'], 'mod': 'sor_bal', 'utolso': True},
                             4: {'keres': ['49/A', '89/A', '96. §'], 'mod': 'sor_bal', 'mind': True}},
        'nyilatkozatok': {1: {'keres': ['Büntetőjogi felelősségem', 'Kijelentem', 'kizáró ok nem áll', 'kizáró okokról'], 'mod': 'sor_bal'},
                          2: {'keres': ['fentieket tudomásul veszem', 'megadott ingatlanok megfelelnek', 'megadott ingatlanok', 'tudomásul veszem',
                                        'megadott'], 'mod': 'sor_bal', 'mind': True}},
        'ellenorzes': {1: {'keres': ['Személyi adatok', 'Vállalkozói címadatok', 'Tevékenységek', 'Adózási adatok', 'Székhely',
                                     'Átalányadózás', 'Kata', 'Pénzforgalmi'], 'mod': 'szeles', 'mind': True},
                       2: {'keres': ['Vissza'], 'mod': 'gomb', 'utolso': True}},
        'bekuldes': {1: {'keres': ['Nyilatkozatok', 'fentieket tudomásul veszem', 'megadott ingatlanok', 'Adózási adatok',
                                   'módosítani vagy visszavonni', 'nem lehet', 'tudomásul veszem', 'fentieket', 'megadott'],
                         'mod': 'szeles', 'mind': True},
                     2: {'keres': ['Bejelentés megtétele', 'megtétele', 'Bejelentés'], 'mod': 'gomb', 'utolso': True}},
        'megtekintes_pdf': {1: {'keres': ['Letöltés', 'Megtekintés'], 'mod': 'gomb', 'utolso': True},
                            2: {'keres': ['Bejelentéseim, kérelmeim', 'Bejelentéseim'], 'mod': 'sor'}},
    },
}


# ======================================================================================================================
def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9/§]+', ' ', s).strip()


def hasonlo(a: str, b: str, kuszob: float = 0.78) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    if len(a) <= 2 or len(b) <= 2:
        return False
    return difflib.SequenceMatcher(None, a, b).ratio() >= kuszob


class Szotar:
    def __init__(self, szavak: set):
        self.szavak = {w for w in szavak if w}
        self.hossz = {}
        for w in self.szavak:
            self.hossz.setdefault(len(w), []).append(w)

    def ismert(self, szo: str) -> bool:
        w = norm(szo)
        if not w:
            return True                     # írásjel, ikon
        if all(norm(x) in self.szavak or not norm(x) for x in w.split()):
            return True
        for x in w.split():
            if x in self.szavak:
                continue
            if (x.isdigit() and len(x) <= 2) or re.fullmatch(r'\d{1,2}/\d{1,2}', x) or re.fullmatch(r'[ivxlc]{1,6}', x) \
                    or x in ('btk', 'eeee', 'hh', 'nn', 'ptk', 'art', 'evectv'):
                continue                    # lépésszám, pontszám, „3/7”
            jelolt = [y for n in range(max(1, len(x) - 2), len(x) + 3) for y in self.hossz.get(n, [])]
            if not any(hasonlo(x, y, 0.8) for y in jelolt):
                return False
        return True


def szotar_epit(kepek: str) -> Szotar:
    szavak = set()
    p = os.path.join(kepek, '_eszkoz', 'ui_szavak.txt')
    if os.path.exists(p):
        for sor in open(p, encoding='utf-8'):
            if not sor.startswith('#'):
                szavak.update(norm(sor).split())
    for u in UTMUTATOK:
        ip = os.path.join(kepek, u, 'index.json')
        if not os.path.exists(ip):
            continue
        ix = json.load(open(ip, encoding='utf-8'))
        for l in ix.get('lepesek', []):
            for k in ('kepernyo', 'mit_csinalj', 'felirat'):
                szavak.update(norm(l.get(k) or '').split())
            for m in l.get('mezok') or []:
                szavak.update(norm(m.get('mezo') or '').split())
            for j in l.get('jelolesek') or []:
                szavak.update(norm(j.get('cimke') or '').split())
    for c in SZEMELYES_CIMKEK:
        szavak.update(norm(c).split())
    return Szotar(szavak)


# ======================================================================================================================
# OCR
class Szo:
    __slots__ = ('t', 'x0', 'y0', 'x1', 'y1', 'sor')

    def __init__(self, t, x0, y0, x1, y1, sor):
        self.t, self.x0, self.y0, self.x1, self.y1, self.sor = t, x0, y0, x1, y1, sor


class Sor:
    def __init__(self, szavak):
        self.szavak = szavak
        self.x0 = min(w.x0 for w in szavak)
        self.y0 = min(w.y0 for w in szavak)
        self.x1 = max(w.x1 for w in szavak)
        self.y1 = max(w.y1 for w in szavak)
        self.lh = max(8.0, self.y1 - self.y0)
        self.szoveg = ' '.join(w.t for w in szavak)

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2


def ocr(kep: Image.Image, munka: str, kepek: str) -> list:
    """-> [Sor] az eredeti kép pixelében. A munkafájl (felnagyított kép) minden futásnál felülíródik, a végén üresre."""
    nagyit = 2.0 if kep.width < 1700 else (1.5 if kep.width < 2600 else 1.0)
    if max(kep.width, kep.height) * nagyit > 9800:
        nagyit = 9800 / max(kep.width, kep.height)
    nagy = kep.resize((int(kep.width * nagyit), int(kep.height * nagyit)), Image.LANCZOS) if nagyit != 1 else kep
    os.makedirs(os.path.dirname(munka), exist_ok=True)
    sorok = _ocr_menet(nagy, munka, kepek, nagyit)
    # második menet a negatívon: a kék gombok fehér felirata („Megtekintés”, „Bejelentés megtétele”) így olvasható
    inverz = ImageOps.invert(ImageOps.grayscale(nagy)).convert('RGB')
    for s2 in _ocr_menet(inverz, munka, kepek, nagyit):
        if not any(_atfed(s2, s1) for s1 in sorok):
            sorok.append(s2)
    sorok.sort(key=lambda s: (round(s.y0 / 6), s.x0))
    return sorok


def _atfed(a, b) -> bool:
    ix = max(0.0, min(a.x1, b.x1) - max(a.x0, b.x0))
    iy = max(0.0, min(a.y1, b.y1) - max(a.y0, b.y0))
    kisebb = min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0)) or 1
    return ix * iy / kisebb > 0.3


def _ocr_menet(kep, munka, kepek, nagyit) -> list:
    kep.save(munka)
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                        os.path.join(kepek, '_eszkoz', 'ocr.ps1'), munka], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError('az OCR nem futott le: ' + r.stderr.decode('utf-8', 'replace')[-400:])
    d = json.loads(r.stdout.decode('utf-8-sig'))
    sorok = []
    for s in d.get('sorok') or []:
        ws = []
        for w in s.get('szavak') or []:
            ws.append(Szo(w['t'], w['x'] / nagyit, w['y'] / nagyit, (w['x'] + w['w']) / nagyit, (w['y'] + w['h']) / nagyit, None))
        if ws:
            so = Sor(ws)
            for w in ws:
                w.sor = so
            sorok.append(so)
    return sorok


def munkafajl_urit(munka: str):
    if os.path.exists(munka):
        Image.new('RGB', (1, 1), (255, 255, 255)).save(munka)


# ======================================================================================================================
# keresés a szövegben
def talal(sorok: list, kifejezes: str, csak_pontos: bool = False, kuszob: float | None = None) -> list:
    """-> [(sor, [szavak])] minden előfordulás. Előbb (majdnem) pontos egyezést keres, és csak ha az nincs, kis OCR-hibát
    is tűrőt – így a „Főtevékenység” nem a „Tevékenységek” címre talál."""
    if kuszob is None:
        ki = _talal(sorok, kifejezes, 0.9)
        if ki or csak_pontos:
            return ki
        return _talal(sorok, kifejezes, 0.75)
    return _talal(sorok, kifejezes, kuszob)


def _szo_egyezik(a: str, c: str, kuszob: float, egy_szo: bool) -> bool:
    """Egy OCR-szó (a) és a keresett szó (c). 11-19 javító kör 2: az egy szavas horgony csak EGÉSZ szóra talál (OCR-hibát
    tűrve: azonos első betű, legfeljebb 1 betű hosszkülönbség) – különben a „Főtevékenység” 0,917-es hasonlósággal a
    NAV-űrlap címének „tevékenység” szavára talált, és az 1-es jelölés a címet keretezte. Több szónál is van hosszkorlát."""
    if a == c:
        return True
    if len(c) <= 4:
        return False
    if abs(len(a) - len(c)) > (1 if egy_szo else max(1, len(c) // 6)):
        return False
    if a[:1] != c[:1]:            # „főtevékenység” ≠ „tevékenység” (több szavas horgonyban sem: „Új főtevékenység”)
        return False
    return hasonlo(a, c, kuszob)


def _talal(sorok: list, kifejezes: str, kuszob: float) -> list:
    cel = norm(kifejezes).split()
    if not cel:
        return []
    egy_szo = len(cel) == 1
    ki = []
    for s in sorok:
        ws = [(w, norm(w.t)) for w in s.szavak]
        lapos = []                                   # szavak szétszedve (az OCR néha kettőt egynek lát)
        for w, n in ws:
            for darab in (n.split() or ['']):
                lapos.append((w, darab))
        for i in range(len(lapos)):
            ok, j = True, i
            for c in cel:
                if j >= len(lapos) or not _szo_egyezik(lapos[j][1], c, kuszob, egy_szo):
                    ok = False
                    break
                j += 1
            if ok:
                szavak = []
                for w, _ in lapos[i:j]:
                    if w not in szavak:
                        szavak.append(w)
                ki.append((s, szavak))
    return ki


def doboz_unio(rs):
    rs = [r for r in rs if r]
    if not rs:
        return None
    return [min(r[0] for r in rs), min(r[1] for r in rs), max(r[2] for r in rs), max(r[3] for r in rs)]


def tartalom_jobb(sorok, kep):
    xs = [s.x1 for s in sorok if s.x1 < kep.width - 4]
    return min(kep.width - 2, (max(xs) if xs else kep.width * 0.95) + 12)


# 11-19 javító kör 2: a NAV-űrlap „króma” – a cím („Egyéni vállalkozói tevékenység elkezdése”) és az 1–6 lépéssor a
# címkéivel („Személyi adatok” … „Ellenőrzés”) – minden űrlaplapon ott van, ezért soha nem lehet jelölés-horgony, és a
# 'szeles' uniókba sem kerülhet bele (eddig a 06-on az 1-es, a 12-n az 1-es keret felnőtt a címig és a lépéssorig).
URLAP_CIM = 'Egyéni vállalkozói tevékenység elkezdése'
LEPESSOR_CIMKEK = ['Személyi adatok', 'Vállalkozói címadatok', 'Tevékenységek', 'Adózási adatok', 'Nyilatkozatok', 'Ellenőrzés']


def urlap_kroma(sorok: list) -> tuple:
    """-> (a kizárt sorok halmaza, a lépéssor alja y-ban | None). Csak ha a lépéssor megvan (legalább 3 címke egy sávban):
    így az ügytípus-választó lapon (ahol a cím maga a horgony) semmit nem zár ki."""
    cimkek = [norm(c) for c in LEPESSOR_CIMKEK]
    jelolt = []
    for s in sorok:
        n = ' ' + norm(s.szoveg) + ' '
        db = sum(1 for c in cimkek if f' {c} ' in n)
        if db:
            jelolt.append((s, db))
    legjobb = None
    for s, _ in jelolt:
        sav = [(t, d) for t, d in jelolt if abs(t.cy - s.cy) < 1.2 * max(s.lh, t.lh)]
        ossz = sum(d for _, d in sav)
        if ossz >= 3 and (legjobb is None or ossz > legjobb[1]):
            legjobb = ([t for t, _ in sav], ossz)
    if not legjobb:
        return set(), None
    sav = legjobb[0]
    lh = max(t.lh for t in sav)
    fent, lent = min(t.y0 for t in sav), max(t.y1 for t in sav)
    ki = set(sav)
    cim = norm(URLAP_CIM)
    for s in sorok:
        if s in ki:
            continue
        n = norm(s.szoveg)
        if s.y0 >= fent - 3.5 * lh and s.y1 <= lent + 0.3 * lh and re.fullmatch(r'[\d\s]*', n):
            ki.add(s)                                    # a lépéssor számai / pipái a címkék fölött
        elif s.y1 <= fent + 0.2 * lh and (cim in n or 'elkezdese' in n or difflib.SequenceMatcher(None, n, cim).ratio() > 0.85):
            ki.add(s)                                    # az űrlap címe
    return ki, lent


def jeloles_doboz(sorok, kep, ank) -> list | None:
    kizart, _ = urlap_kroma(sorok)
    if kizart:
        sorok = [s for s in sorok if s not in kizart]
    talalatok = []
    for k in ank['keres']:
        t = talal(sorok, k)
        if t:
            talalatok.extend(t)
            if not ank.get('mind'):
                break
    if not talalatok:
        return None
    if ank.get('utolso') and not ank.get('mind'):
        talalatok = [max(talalatok, key=lambda x: x[0].y0)]
    elif not ank.get('mind'):
        talalatok = talalatok[:1]
    mod = ank.get('mod', 'sor')
    rs = []
    for s, ws in talalatok:
        lh = s.lh
        if mod == 'sor':
            rs.append([min(w.x0 for w in ws), s.y0, max(w.x1 for w in ws), s.y1])
        elif mod == 'gomb':
            x0, x1 = min(w.x0 for w in ws), max(w.x1 for w in ws)
            rs.append([x0 - 1.4 * lh, s.y0 - 0.7 * lh, x1 + 1.4 * lh, s.y1 + 0.7 * lh])
        elif mod == 'sor_bal':
            r = [s.x0 - 2.2 * lh, s.y0, s.x1, s.y1]
            # folytatósor (tördelt felirat) ugyanazzal a bal széllel: lefelé és felfelé (ha a találat a 2. sorban van)
            for s2 in sorted(sorok, key=lambda q: q.y0):
                if s2 is not s and 0 <= s2.y0 - r[3] < 0.7 * lh and abs(s2.x0 - s.x0) < 1.2 * lh:
                    r = [r[0], r[1], max(r[2], s2.x1), s2.y1]
            for s2 in sorted(sorok, key=lambda q: -q.y1):
                if s2 is not s and 0 <= r[1] - s2.y1 < 0.7 * lh and abs(s2.x0 - s.x0) < 1.2 * lh:
                    r = [min(r[0], s2.x0 - 2.2 * lh), s2.y0, max(r[2], s2.x1), r[3]]
            rs.append(r)
        elif mod in ('szakasz', 'szeles'):
            rs.append([s.x0, s.y0, s.x1, s.y1])
    r = doboz_unio(rs)
    if mod == 'szakasz':
        s0 = talalatok[0][0]
        veg_y = None
        for v in ank.get('veg') or []:
            for s2, _ in talal(sorok, v):
                if s2.y0 > s0.y1 + 2 and (veg_y is None or s2.y0 < veg_y):
                    veg_y = s2.y0
        bent_y = [s2.y1 for b in ank.get('bent') or [] for s2, _ in talal(sorok, b) if s2.y0 > s0.y0]
        if bent_y:
            bv = max(bent_y) + ank.get('bent_alatta', 2.5) * s0.lh
            veg_y = bv if veg_y is None else min(veg_y, bv)
        if veg_y is None:
            veg_y = min(kep.height - 4, s0.y1 + 8 * s0.lh)
        bent = [s2 for s2 in sorok if s0.y0 <= s2.y0 and s2.y1 <= veg_y - 2]
        jobb = max([s2.x1 for s2 in bent] + [r[2]])
        r = [r[0] - 0.4 * s0.lh, s0.y0 - 0.5 * s0.lh, max(jobb, r[0] + 0.5 * (tartalom_jobb(sorok, kep) - r[0])), veg_y - 0.9 * s0.lh,
             'alul_nincs_parna']
    if mod == 'szeles':
        lh = talalatok[0][0].lh
        alatta = ank.get('alatta', 0) if kep.height > 1.5 * kep.width else 0   # telefonon a mező a címke alatt van
        r = [r[0] - 0.6 * lh, r[1] - 0.6 * lh, tartalom_jobb(sorok, kep), r[3] + (0.6 + alatta) * lh]
    return r


# ======================================================================================================================
# személyes adatok
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
SZAMOK = re.compile(r'\d')


def nevek_betolt(bemenet: str) -> list:
    p = os.path.join(bemenet, 'nevek.txt')
    if not os.path.exists(p):
        return []
    ki = []
    for sor in open(p, encoding='utf-8-sig'):
        sor = sor.strip()
        if sor and not sor.startswith('#'):
            ki.extend(x for x in norm(sor).split() if len(x) >= 3)
    return ki


def szemelyes(sorok, kep, slug, szotar: Szotar, nevek: list) -> list:
    """-> elmosandó dobozok (eredeti pixel)."""
    szigoru = slug in SZIGORU
    ki = []

    def szo_doboz(w, pad=0.25):
        h = w.y1 - w.y0
        return [w.x0 - pad * h, w.y0 - pad * h, w.x1 + pad * h, w.y1 + pad * h]

    # 1) a bejelentkezett felhasználó neve (a fejlécben, a „Bejelentkezett felhasználó” alatt / mellett)
    fej = talal(sorok, 'Bejelentkezett felhasználó', kuszob=0.9) or \
        [(s, ws) for s, ws in talal(sorok, 'Bejelentkezett', kuszob=0.93) if len(s.szavak) <= 3]
    for s, ws in fej:
        lh = s.lh
        ki.append([s.x0 - 1.6 * lh, s.y1 + 0.05 * lh, max(s.x1 + 2.5 * lh, s.x0 + 14 * lh), s.y1 + 2.0 * lh])
        utana = [w for w in s.szavak if w.x0 > max(x.x1 for x in ws) + 2 and norm(w.t) not in ('felhasznalo',)]
        for w in utana:
            if not hasonlo(norm(w.t), 'felhasznalo', 0.7):
                ki.append(szo_doboz(w))
    # 2) személyes rovatok értéke
    cimke_sorok = []
    cimke_sor_id = set()
    for c in SZEMELYES_CIMKEK:
        for s, ws in talal(sorok, c, csak_pontos=True) or talal(sorok, c, kuszob=0.82):
            if len(norm(c)) <= 4 and len(ws) == 1 and len(s.szavak) > 3:
                continue                                    # rövid szó („Név”) csak önálló címkeként
            if ws[0] is not s.szavak[0] and len(s.szavak) > 6:
                continue                                    # mondat közepén (tájékoztató szöveg) nem címke
            cimke_sorok.append((s, ws, c in CSAK_SOR))
            cimke_sor_id.add(id(s))

    def ertek_jellegu(szavak):
        return any(not szotar.ismert(w.t) or len(SZAMOK.findall(w.t)) >= 2 for w in szavak)

    tabla = False
    jobb = tartalom_jobb(sorok, kep)
    for s, ws, _ in cimke_sorok:
        vege = max(w.x1 for w in ws)
        ertek = [w for w in s.szavak if w.x0 > vege + 2]
        mellette = [s2 for s2 in sorok if s2 is not s and id(s2) not in cimke_sor_id and abs(s2.cy - s.cy) < 0.6 * s.lh
                    and s2.x0 > vege and ertek_jellegu(s2.szavak)]
        if (ertek and ertek_jellegu(ertek)) or mellette:
            tabla = True
    for s, ws, csak_sor in cimke_sorok:
        lh = s.lh
        vege = max(w.x1 for w in ws)
        for w in s.szavak:
            if w.x0 > vege + 2:
                ki.append(szo_doboz(w))
        for s2 in sorok:
            if s2 is not s and id(s2) not in cimke_sor_id and abs(s2.cy - s.cy) < 0.6 * lh and s2.x0 > vege:
                ki.append([s2.x0 - 0.3 * lh, s2.y0 - 0.3 * lh, s2.x1 + 0.3 * lh, s2.y1 + 0.3 * lh])
        if tabla and not csak_sor:          # táblázat: a sor jobb oldala (üres értéknél is)
            ki.append([vege + 1.5 * lh, s.cy - 0.75 * lh, jobb, s.cy + 0.75 * lh])
        elif not tabla and not csak_sor:    # egymás alatt: a címke alatti beviteli mező
            ki.append([s.x0 - 0.6 * lh, s.y1 + 0.1 * lh, max(s.x1 + 6 * lh, s.x0 + 0.42 * kep.width), s.y1 + 2.7 * lh])
    # 3) minták és ismeretlen szavak (az adatos lapon az ismeretlen szó a személyes címkék sávjában – ha nincs címke, mindenhol)
    if cimke_sorok:
        lh0 = max(s.lh for s, _, _ in cimke_sorok)
        sav = (min(s.y0 for s, _, _ in cimke_sorok) - 2 * lh0, max(s.y1 for s, _, _ in cimke_sorok) + 3.5 * lh0)
    else:
        sav = (-1e9, 1e9)
    for s in sorok:
        savban = sav[0] <= s.cy <= sav[1]
        caps = []
        ismert_arany = sum(1 for w in s.szavak if szotar.ismert(w.t)) / max(1, len(s.szavak))
        mondat = len(s.szavak) >= 4 and ismert_arany >= 0.6       # tájékoztató mondat: az ismeretlen szava nem érték
        for w in s.szavak:
            t = w.t
            n = norm(t)
            szam = len(SZAMOK.findall(t))
            azonosito = re.search(r'[A-Za-z]{2,}[-&_]?[0-9OoQDSZIl]{5,}', t) and szam >= 2
            if EMAIL.search(t) or szam >= 6 or (szigoru and szam >= 3) or azonosito:
                ki.append(szo_doboz(w))
                continue
            if nevek and any(hasonlo(x, nn, 0.8) for x in n.split() for nn in nevek):
                ki.append(szo_doboz(w, 0.35))
                continue
            betuk = re.sub(r'[^A-Za-zÀ-ÿŐőŰű]', '', t)
            if len(betuk) >= 2 and betuk.upper() == betuk and not szotar.ismert(t):
                caps.append(w)
            if szigoru and savban and not mondat and not szotar.ismert(t):
                ki.append(szo_doboz(w))
        if len(caps) >= 2 or (caps and szigoru and savban):
            for w in caps:
                ki.append(szo_doboz(w, 0.35))
    # 4) irányítószám + település („1234 Mintaváros”)
    for s in sorok:
        if re.search(r'\b\d{4}\b\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+', s.szoveg):
            ki.append([s.x0 - 0.3 * s.lh, s.y0 - 0.3 * s.lh, s.x1 + 0.3 * s.lh, s.y1 + 0.3 * s.lh])
    # vágás a képre, egyesítés
    out = []
    for r in ki:
        r = [max(0, r[0]), max(0, r[1]), min(kep.width, r[2]), min(kep.height, r[3])]
        if r[2] - r[0] > 2 and r[3] - r[1] > 2:
            out.append([round(v) for v in r])
    return osszevon(out)


def osszevon(rs: list) -> list:
    rs = [list(r) for r in rs]
    valtozott = True
    while valtozott:
        valtozott = False
        for i in range(len(rs)):
            for j in range(i + 1, len(rs)):
                a, b = rs[i], rs[j]
                if not (a[2] < b[0] - 2 or b[2] < a[0] - 2 or a[3] < b[1] - 2 or b[3] < a[1] - 2):
                    rs[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    rs.pop(j)
                    valtozott = True
                    break
            if valtozott:
                break
    return rs


# ======================================================================================================================
def auto_vagas(kep, sorok) -> list:
    """Asztali kép: a szöveg köré vág (üres szélek nélkül). Telefonkép: a felső állapotsort (óra, akku) levágja."""
    w, h = kep.size
    if h > 1.5 * w:                                        # álló, telefon
        return [0, int(h * 0.035), w, h]
    if not sorok:
        return [0, 0, w, h]
    x0 = min(s.x0 for s in sorok)
    x1 = max(s.x1 for s in sorok)
    y0 = min(s.y0 for s in sorok)
    y1 = max(s.y1 for s in sorok)
    m = 0.03 * w
    return [int(max(0, x0 - m)), int(max(0, y0 - m)), int(min(w, x1 + m)), int(min(h, y1 + m))]


def ankor(utmutato, slug):
    a = (ANKOROK.get(utmutato) or {}).get(slug)
    if isinstance(a, str):
        a = ANKOROK[utmutato][a]
    return a or {}


def betolt_kep(p) -> Image.Image:
    k = Image.open(p)
    k = ImageOps.exif_transpose(k)
    return k.convert('RGB')


def mozgat_regibe(kepek, ut, alcim):
    if os.path.exists(ut):
        cel = os.path.join(kepek, '_regi', alcim)
        os.makedirs(cel, exist_ok=True)
        b, e = os.path.splitext(os.path.basename(ut))
        shutil.move(ut, os.path.join(cel, f"{b}_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}{e}"))


def betu(meret):
    for p in ('C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, meret)
    return ImageFont.load_default()


# ======================================================================================================================
def feldolgoz(a) -> int:
    kepek, bemenet = a.kepek, a.bemenet
    sys.path.insert(0, kepek)
    import annotate as A  # noqa: E402  (a megadott utmutato_kepek mappa annotate.py-ja)

    szotar = szotar_epit(kepek)
    nevek = nevek_betolt(bemenet)
    munka = os.path.join(kepek, '_sajat', '_munka', 'ocr_munka.png')
    csak = {int(x) for x in a.csak.split(',')} if a.csak else None
    utmutatok = [a.utmutato] if a.utmutato else [u for u in UTMUTATOK if os.path.isdir(os.path.join(bemenet, u))]
    if not utmutatok:
        print(f'Nincs mit feldolgozni: a {bemenet} alatt nincs vallalkozas_bejelentes/ (vagy meghatalmazas/) mappa.')
        return 2
    figy, kesz, valtozott = [], [], []
    for u in utmutatok:
        ip = os.path.join(kepek, u, 'index.json')
        ix = json.load(open(ip, encoding='utf-8'))
        mappa = os.path.join(bemenet, u)
        fajlok = {}
        for f in sorted(os.listdir(mappa)) if os.path.isdir(mappa) else []:
            m = KEP_MINTA.match(f)
            if m:
                if int(m.group(1)) in fajlok:
                    figy.append(f'{u}/{f}: a {int(m.group(1)):02d}. lépéshez már van kép ({os.path.basename(fajlok[int(m.group(1))])}) – ezt nem használtam')
                    continue
                fajlok[int(m.group(1))] = os.path.join(mappa, f)
            elif f.lower().endswith(('.png', '.jpg', '.jpeg')):
                figy.append(f'{u}/{f}: a név nem sorszámmal kezdődik (pl. 05.png) – kihagytam')
        if not fajlok:
            continue
        lapok = []
        for nn, ut in sorted(fajlok.items()):
            if csak and nn not in csak:
                continue
            lepesek = [l for l in ix['lepesek'] if l['sorszam'] == nn]
            if not lepesek:
                figy.append(f'{u}/{os.path.basename(ut)}: nincs {nn:02d}. lépés az útmutatóban – kihagytam')
                continue
            kezi = {}
            kp = os.path.splitext(ut)[0] + '.json'
            if os.path.exists(kp):
                kezi = json.load(open(kp, encoding='utf-8'))
            kep = betolt_kep(ut)
            sorok = ocr(kep, munka, kepek)
            _, kroma_alja = urlap_kroma(sorok)
            elmos = set()
            for l in lepesek:
                for r in szemelyes(sorok, kep, l['slug'], szotar, nevek):
                    elmos.add(tuple(r))
            elmos = osszevon([list(r) for r in elmos] + [list(map(int, r)) for r in kezi.get('homalyos') or []])
            tiszta = kep.copy()
            for r in elmos:
                A.homalyosit(tiszta, r)
            datum = dt.date.fromtimestamp(os.path.getmtime(ut)).isoformat()
            for l in lepesek:
                slug = l['slug']
                vagas = [int(v) for v in kezi['vagas']] if kezi.get('vagas') else auto_vagas(kep, sorok)
                portre = kep.height > 1.5 * kep.width
                k = 1.6 if portre else (1.25 if (vagas[2] - vagas[0]) > 1100 else 1.45)
                bov = [int(0.17 * (vagas[2] - vagas[0])), 0, 0, 0] if portre else [0, 0, 0, 0]   # hely a számoknak a bal szélen
                ank = ankor(u, slug)
                # 11-19 javítás: a vágás SOHA nem metsz bele egy megtalált jelölés (pl. a „Bejelentés megtétele” gomb) dobozába,
                # és ha egy jelölést nem találunk (pl. az egér súgója takarta), az eredeti jobb és alsó szél marad – így a gomb,
                # amiről a videó beszél, biztosan a képen van.
                if not kezi.get('vagas'):
                    hianyzik = False
                    for j in l.get('jelolesek') or []:
                        if (kezi.get('jelolesek') or {}).get(str(j['n'])):
                            continue
                        r0 = jeloles_doboz(sorok, kep, ank[j['n']]) if j['n'] in ank else None
                        if not r0:
                            hianyzik = True
                            continue
                        m0 = 0.02 * kep.width
                        vagas = [int(max(0, min(vagas[0], r0[0] - m0))), int(max(0, min(vagas[1], r0[1] - m0))),
                                 int(min(kep.width, max(vagas[2], r0[2] + m0))), int(min(kep.height, max(vagas[3], r0[3] + m0)))]
                    if hianyzik:
                        vagas = [vagas[0], vagas[1], kep.width, kep.height]
                jel = []
                for j in l.get('jelolesek') or []:
                    jj = {kk: vv for kk, vv in j.items() if kk not in ('doboz', 'szam_hely')}
                    kezi_doboz = (kezi.get('jelolesek') or {}).get(str(j['n']))
                    if kezi_doboz:
                        r = [float(v) for v in kezi_doboz]
                    else:
                        r = jeloles_doboz(sorok, kep, ank[j['n']]) if j['n'] in ank else None
                    if r and not kezi_doboz and kroma_alja is not None and r[1] < kroma_alja:
                        figy.append(f'{u} {nn:02d} {slug}: a(z) {j["n"]}. jelölés a NAV-űrlap címére / lépéssorára esett – nézd meg az '
                                    f'ellenőrző lapon; ha rossz, add meg kézzel a {nn:02d}.json „jelolesek” részében')
                    if r:
                        alul = 0 if (len(r) > 4 and r[4] == 'alul_nincs_parna') else 1
                        r = [float(v) for v in r[:4]]
                        s_ = (vagas[2] - vagas[0] + bov[0]) / (A.W2 - 2 * A.MARGO)   # forráspixel / vászonpixel
                        pad = 9 * k * s_ + 6 * s_ + 4
                        r = [r[0] - pad, r[1] - pad, r[2] + pad, r[3] + pad * alul]
                        r = [max(vagas[0] + 1, r[0]), max(vagas[1] + 1, r[1]), min(vagas[2] - 1, r[2]), min(vagas[3] - 1, r[3])]
                        jj['doboz'] = [round(v) for v in r]
                        jj['parna'] = 0
                    else:
                        jj['doboz'] = None
                        figy.append(f'{u} {nn:02d} {slug}: a(z) {j["n"]}. jelölés helyét nem találtam – a felirat a kép alatt van, keret nélkül')
                    jel.append(jj)
                cel = os.path.join(kepek, '_sajat', u, f'{nn:02d}_{slug}.png')
                os.makedirs(os.path.dirname(cel), exist_ok=True)
                mozgat_regibe(kepek, cel, os.path.join('_sajat', u))
                tiszta.save(cel)
                os.utime(cel, (os.path.getmtime(ut), os.path.getmtime(ut)))
                if 'forras_alap' not in l:
                    l['forras_alap'] = l.get('forras')
                    l['forras_rovid_alap'] = l.get('forras_rovid')
                    l['alt_alap'] = l.get('alt')
                l['sajat'] = {
                    'kep': None, 'vagas': vagas, 'bovites': bov, 'jel_meret': k, 'homalyos': [], 'jelolesek': jel,
                    'megjegyzes': 'sajat_kepek.py: a kép a _sajat/ mappában már ELMOSVA van (a homalyos ezért üres).',
                    'auto': {'forras_fajl': os.path.relpath(ut, kepek).replace('\\', '/'), 'keszult': dt.datetime.now().isoformat(timespec='seconds'),
                             'elmosva': len(elmos), 'elmosott_dobozok': elmos, 'kezi_javitas': bool(kezi),
                             'jelolesek_megtalalva': sum(1 for x in jel if x['doboz'])},
                }
                l['forras'] = {'id': 'sajat_kepernyokep', 'cim': 'Saját képernyőkép a NAV Vállalkozói Ügysegédről' if u == 'vallalkozas_bejelentes'
                               else 'Saját képernyőkép a NAV ONYA-ról', 'url': None, 'datum': datum, 'oldal': None, 'fajta': 'sajat_kepernyokep'}
                l['forras_rovid'] = f'Saját képernyőkép, {datum}. A személyes adatok elmosva.'
                cimkek = '; '.join(f"{x['n']}: {x['cimke']}" for x in jel if x.get('cimke'))
                l['alt'] = f"Képernyőkép: {l.get('kepernyo', '')}. A személyes adatok elmosva. Kiemelve – {cimkek}."
                kesz.append(f'{u} {nn:02d} {slug}')
                lapok.append((u, nn, slug, kep, elmos, vagas, jel))
            valtozott.append(u)
        json.dump(ix, open(ip, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        # jelölt képek (annotate.py) – csak a feldolgozott sorszámokra
        for nn in sorted({x[1] for x in lapok}):
            r = subprocess.run([sys.executable, os.path.join(kepek, 'annotate.py'), u, f'{nn:02d}'], capture_output=True, text=True,
                               encoding='utf-8', errors='replace')
            for sor in (r.stdout + r.stderr).splitlines():
                if sor.strip().startswith(('!', u)) or 'Error' in sor or 'KIHAGYVA' in sor:
                    print('   ', sor.strip())
            if r.returncode:
                figy.append(f'{u} {nn:02d}: az annotate.py hibával állt le (kód {r.returncode})')
        ellenorzo_lap(kepek, u, lapok)
    munkafajl_urit(munka)
    valtozott = sorted(set(valtozott))
    print()
    print(f'Feldolgozva: {len(kesz)} kép' + (': ' + ', '.join(kesz) if kesz else ''))
    for f in figy:
        print('  ! ' + f)
    if not kesz:
        return 2
    for u in valtozott:
        print(f'NÉZD MEG: {os.path.join(kepek, "_elonezet", f"sajat_ellenorzes_{u}.jpg")}  (piros = elmosva, kék = jelölés)')
    rc = 0
    if not a.app_nelkul:
        rc |= app_masol(a)
    if not a.video_nelkul:
        rc |= video(a, valtozott)
    print()
    if figy:
        # 11-19 javítás: a figyelmeztetések a hosszú app- és videó-kimenet UTÁN is látsszanak
        print('FIGYELEM – még egyszer, mert fontos:')
        for f in figy:
            print('  ! ' + f)
        print('  Ha egy jelölést nem találtam: nézd meg az ellenőrző lapot; ha a gomb nem látszik, fotózd újra úgy, hogy az egér ne legyen rajta.')
        print()
    print('Kész. Feltöltés csak az ellenőrző lap megnézése után. A legegyszerűbb: kérd meg Claude-ot („töltsd fel a saját NAV-képeimet”).')
    print('Ha magad töltenéd fel, a Git Bash ablakban (nem a Windows parancssorban):')
    print(f'  cd "{a.kod}/app" && node ../deploy/videok-json.mjs && bash ../deploy/feltolt.sh --media')
    return rc


def ellenorzo_lap(kepek, u, lapok):
    if not lapok:
        return
    sor_kepek = []
    f = betu(30)
    for (uu, nn, slug, kep, elmos, vagas, jel) in lapok:
        bal = kep.copy()
        import annotate as A
        for r in elmos:
            A.homalyosit(bal, r)
        d = ImageDraw.Draw(bal)
        lw = max(3, bal.width // 400)
        for r in elmos:
            d.rectangle(r, outline=(230, 0, 40), width=lw)
        for j in jel:
            if j.get('doboz'):
                d.rectangle(j['doboz'], outline=(20, 40, 219), width=lw)
        d.rectangle(vagas, outline=(0, 160, 80), width=lw)
        jobb_ut = os.path.join(kepek, uu, f'{nn:02d}_{slug}.png')
        jobb = Image.open(jobb_ut).convert('RGB') if os.path.exists(jobb_ut) else Image.new('RGB', (1080, 400), 'white')
        H = 900
        b = bal.resize((max(1, int(bal.width * H / bal.height)), H), Image.LANCZOS)
        jj = jobb.resize((max(1, int(jobb.width * H / jobb.height)), H), Image.LANCZOS)
        lap = Image.new('RGB', (b.width + jj.width + 60, H + 70), (245, 247, 250))
        lap.paste(b, (20, 60))
        lap.paste(jj, (b.width + 40, 60))
        ImageDraw.Draw(lap).text((20, 12), f'{nn:02d} {slug} – balra a te képed (piros: elmosva, kék: jelölés, zöld: kivágás), jobbra a kész kép', font=f, fill=(16, 21, 43))
        sor_kepek.append(lap)
    W = max(x.width for x in sor_kepek)
    osz = Image.new('RGB', (W, sum(x.height for x in sor_kepek)), (245, 247, 250))
    y = 0
    for x in sor_kepek:
        osz.paste(x, (0, y))
        y += x.height
    if osz.width > 2400:
        osz = osz.resize((2400, int(osz.height * 2400 / osz.width)), Image.LANCZOS)
    ki = os.path.join(kepek, '_elonezet', f'sajat_ellenorzes_{u}.jpg')
    os.makedirs(os.path.dirname(ki), exist_ok=True)
    osz.save(ki, quality=88)


def app_masol(a) -> int:
    script = os.path.join(a.kod, 'app', 'scripts', 'utmutato-kepek.mjs')
    print('\n[app] képek az appba:', script)
    r = subprocess.run(['node', script, '--forras', a.kepek], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print('   ' + (r.stdout + r.stderr).strip().replace('\n', '\n   '))
    if r.returncode != 0:
        return 4
    # 2026-11-19: az app képei telefonra kicsinyítve (256 szín, a forrás és a videó képei nem változnak)
    k = subprocess.run([sys.executable, os.path.join(a.kepek, '_eszkoz', 'media_kicsinyit.py'), '--media',
                        os.path.join(a.kod, 'media', 'utmutato')], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print('   ' + ((k.stdout + k.stderr).strip().splitlines() or [''])[-1])
    return 0


def video(a, utmutatok) -> int:
    nevek = [VIDEO_NEV[u] for u in utmutatok if u in VIDEO_NEV]
    if not nevek:
        return 0
    print('\n[videó] újrarenderelés a meglévő hanggal (új hangfelvétel nincs, a hálózat tiltva):', ', '.join(nevek))
    cmd = [sys.executable, os.path.join(a.kepek, '_eszkoz', 'video_ujra.py'), '--video', a.video, '--kepek', a.kepek, '--media', a.media] + nevek
    r = subprocess.run(cmd)
    return 0 if r.returncode == 0 else 8


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description='A tulaj saját NAV-képernyőképei: elmosás, jelölés, index, app, videó (SAJAT_KEPEK.md).')
    p.add_argument('--kepek', default=ITT)
    p.add_argument('--bemenet', default=None, help='alap: <kepek>/sajat')
    p.add_argument('--kod', default=os.path.join(APP, 'kod'))
    p.add_argument('--video', default=os.path.join(APP, 'video'))
    p.add_argument('--media', default=None, help='alap: <kod>/media')
    p.add_argument('--utmutato', choices=UTMUTATOK)
    p.add_argument('--csak')
    p.add_argument('--video-nelkul', action='store_true')
    p.add_argument('--app-nelkul', action='store_true')
    a = p.parse_args(argv)
    a.kepek = os.path.abspath(a.kepek)
    a.bemenet = os.path.abspath(a.bemenet or os.path.join(a.kepek, 'sajat'))
    a.kod = os.path.abspath(a.kod)
    a.video = os.path.abspath(a.video)
    a.media = os.path.abspath(a.media or os.path.join(a.kod, 'media'))
    return feldolgoz(a)


if __name__ == '__main__':
    sys.exit(main())
