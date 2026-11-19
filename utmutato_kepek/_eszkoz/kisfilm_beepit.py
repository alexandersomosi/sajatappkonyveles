"""A NAV kisfilm-kockáiból készült valódi képek beírása a vallalkozas_bejelentes/index.json-ba (2026-11-19).

A 02, 03, 04, 11, 13 és 14. lépés rajzolt Illusztrációja helyett a NAV hivatalos kisfilmjének („Megújul az Ügysegéd”,
https://youtu.be/DQnbjo2lrv8, a NAV 2026.02.19-i sajtóközleményéből és a nav.gov.hu „Új ügysegéd” csempéjének
„Segédlet” linkjéből) kockái lesznek a források. A régi index a _regi/ mappába kerül. Utána: python annotate.py vallalkozas_bejelentes
Előtte: python _eszkoz/kisfilm_nyers.py (az előre elmosott forrásképek a _nyers/kisfilm_2026-02-19/ mappában).
"""
import datetime as dt
import json
import os
import shutil

GYOKER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IP = os.path.join(GYOKER, 'vallalkozas_bejelentes', 'index.json')
NY = '_nyers/kisfilm_2026-02-19/'
FORRAS = {'id': 'nav_kisfilm_ugyseged_2026', 'cim': 'NAV: „Megújul az Ügysegéd” – kisfilm a Vállalkozói Ügysegédről (YouTube, NAVgovHu csatorna)',
          'url': 'https://youtu.be/DQnbjo2lrv8', 'datum': '2026-02-19', 'fajta': 'hivatalos_kisfilm_kocka'}


def forras(ido):
    return dict(FORRAS, oldal=f'{ido} s')


def rovid(ido):
    p, mp = divmod(int(round(ido)), 60)
    return (f'Képernyőkép: NAV, „Megújul az Ügysegéd” kisfilm (2026.02.19.), {p}:{mp:02d}. A NAV bemutató-felülete, '
            f'a mintaadatok elmosva.')


UJ = {
    2: dict(
        ido=31.6, kep='ugyseged_fooldal',
        mit_csinalj='Koppints az „Új bejelentés, kérelem benyújtása” fülre.',
        mezok=[{'mezo': 'Új bejelentés, kérelem benyújtása (fül)', 'mit': 'kattints', 'ertek': None}],
        felirat='Új bejelentést indítasz.',
        alt='A Vállalkozói Ügysegéd három füllel: Bejelentéseim, kérelmeim; Új bejelentés, kérelem benyújtása; Tájékoztató. Az Új bejelentés fül kiemelve.',
        alap={'vagas': [22, 22, 1503, 420], 'bovites': [0, 0, 0, 0], 'jel_meret': 1.25, 'homalyos': [], 'elmosva_elore': True},
        jelolesek=[{'n': 1, 'doboz': '@uj', 'stilus': 'tinta', 'cimke': 'Koppints ide', 'cimke_hely': 'lent', 'parna': 0}],
    ),
    3: dict(
        ido=27.5, kep='ugyseged_ugytipus',
        mit_csinalj='Válaszd az „Egyéni vállalkozói tevékenység elkezdése” ügyet.',
        mezok=[{'mezo': 'Egyéni vállalkozói tevékenység elkezdése', 'mit': 'kattints', 'ertek': None}],
        felirat='A kezdés bejelentését válaszd.',
        alt='Az Új bejelentés fül: fent az adataid összefoglalója (a nevek elmosva), alatta az ügy: Egyéni vállalkozói tevékenység elkezdése, kiemelve.',
        alap={'vagas': [22, 22, 1503, 727], 'bovites': [0, 0, 0, 0], 'jel_meret': 1.25, 'homalyos': [], 'elmosva_elore': True},
        jelolesek=[{'n': 1, 'doboz': '@kezdes', 'stilus': 'tinta', 'cimke': 'Ezt válaszd: a kezdés bejelentése', 'cimke_hely': 'lent', 'parna': 0, 'szam_hely': 'jobb'}],
    ),
    4: dict(
        ido=21.6, kep='szemelyi_adatok',
        mit_csinalj='A NAV a nyilvántartásból tölti ki az adataidat. Nézd át őket. Ha valami hibás, ne itt javítsd: szólj a NAV-nak.',
        mezok=[{'mezo': 'Viselt név, születési név, anyja születési neve, születési idő, ország és hely, adóazonosító jel, állampolgárság', 'mit': 'ellenorizd', 'ertek': None},
               {'mezo': 'TAJ-szám', 'mit': 'ird_be', 'ertek': 'csak ha a képernyő kéri, a TAJ-kártyádról (a NAV kisfilmjében ezen a lapon nincs ilyen mező)'}],
        felirat='Nézd át az adataidat.',
        alt='A Személyi adatok lap, az 1. lépés a hatból: viselt név, születési név, anyja születési neve, születési idő, ország és hely, adóazonosító jel, állampolgárság. A nevek elmosva, az adatblokk kiemelve.',
        alap={'vagas': [22, 22, 1503, 668], 'bovites': [0, 0, 0, 0], 'jel_meret': 1.25, 'homalyos': [], 'elmosva_elore': True},
        jelolesek=[{'n': 1, 'doboz': '@adatok', 'stilus': 'tinta', 'cimke': 'Nézd át. Ha hibás, szólj a NAV-nak', 'cimke_hely': 'lent', 'parna': 0}],
    ),
    11: dict(
        ido=24.0, kep='nyilatkozatok',
        mit_csinalj='Négy nyilatkozat van, mind a négyet jelöld be. Az elsővel azt mondod, hogy nincs kizáró ok: csak akkor jelöld, ha ez igaz. A másik hárommal tudomásul veszed a szabályokat.',
        mezok=[{'mezo': 'I. Nyilatkozat a kizáró okokról', 'mit': 'jelold', 'ertek': None},
               {'mezo': 'II–IV. „A fentieket tudomásul veszem.” / „A megadott ingatlanok megfelelnek a feltételeknek.”', 'mit': 'jelold', 'ertek': None}],
        felirat='Nyilatkozatok: mind a négyet jelöld be.',
        alt='A Nyilatkozatok lap, az 5. lépés a hatból: négy nyilatkozat, mindegyik alatt egy jelölőnégyzet. Az első (nincs kizáró ok) és a másik három külön kiemelve.',
        alap={'vagas': [22, 22, 1503, 742], 'bovites': [0, 0, 0, 0], 'jel_meret': 1.25, 'homalyos': [], 'elmosva_elore': True},
        jelolesek=[{'n': 1, 'doboz': '@kizaro', 'stilus': 'borostyan', 'cimke': 'Jelöld be, ha nincs kizáró ok', 'cimke_hely': 'lent', 'parna': 0},
                   {'n': 2, 'doboz': '@tobbi', 'stilus': 'borostyan', 'cimke': 'Ezt a hármat is jelöld be', 'cimke_hely': 'lent', 'parna': 0}],
    ),
    13: dict(
        ido=37.3, kep='bekuldes',
        mit_csinalj='Ha minden stimmel, koppints a „Bejelentés megtétele” gombra, és a felugró ablakban még egyszer. Utána már nem lehet módosítani vagy visszavonni.',
        mezok=[{'mezo': 'Bejelentés megtétele', 'mit': 'kattints', 'ertek': None}],
        felirat='Beküldés: utána nem módosítható.',
        alt='Az Ellenőrzés lap alja: a bejelölt nyilatkozatok, alatta a Vissza, a Mentés és a Bejelentés megtétele gomb. A gomb és a beküldendő összesítő kiemelve.',
        alap={'vagas': [22, 14, 1503, 452], 'bovites': [0, 0, 0, 58], 'jel_meret': 1.25, 'homalyos': [], 'elmosva_elore': True},
        jelolesek=[{'n': 1, 'doboz': '@osszesito', 'stilus': 'borostyan', 'cimke': 'Ezt küldöd be. Utána már nem módosítható', 'cimke_hely': 'fent', 'parna': 0},
                   {'n': 2, 'doboz': '@gomb', 'stilus': 'tinta', 'cimke': 'Csak ha minden stimmel', 'cimke_hely': 'lent', 'parna': 0, 'szam_hely': 'lent'}],
    ),
    14: dict(
        ido=42.5, kep='megtekintes_pdf',
        mit_csinalj='A „Bejelentéseim, kérelmeim” fülön nyisd meg az ügyet a „Megtekintés” gombbal, és a „Letöltés” gombbal töltsd le PDF-ben. Töltsd fel itt, az appban.',
        mezok=[{'mezo': 'Megtekintés, majd Letöltés (PDF)', 'mit': 'kattints', 'ertek': None}],
        felirat='Töltsd le a PDF-et, és töltsd fel az appba.',
        alt='A Bejelentéseim, kérelmeim fül: az elfogadott Egyéni vállalkozói tevékenység elkezdése ügy a Megtekintés gombbal; az ügy azonosítója elmosva. A Megtekintés gomb és a fül kiemelve.',
        alap={'vagas': [52, 26, 1473, 436], 'bovites': [0, 0, 0, 0], 'jel_meret': 1.25, 'homalyos': [], 'elmosva_elore': True},
        jelolesek=[{'n': 1, 'doboz': '@megtekintes', 'stilus': 'tinta', 'cimke': 'Megtekintés, majd Letöltés: így kapod meg a PDF-et', 'cimke_hely': 'lent', 'parna': 0},
                   {'n': 2, 'doboz': '@bejelenteseim', 'stilus': 'tinta', 'cimke': 'Később itt is megtalálod', 'cimke_hely': 'fent', 'parna': 0, 'szam_hely': 'jobb'}],
    ),
}


def main():
    ix = json.load(open(IP, encoding='utf-8'))
    regi = os.path.join(GYOKER, '_regi', 'vallalkozas_bejelentes')
    os.makedirs(regi, exist_ok=True)
    shutil.copyfile(IP, os.path.join(regi, f'index_elotte_kisfilm_{dt.datetime.now().strftime("%Y%m%d_%H%M%S")}.json'))
    for l in ix['lepesek']:
        u = UJ.get(l['sorszam'])
        if not u:
            continue
        l['tipus'] = 'valodi'
        l['forras'] = forras(u['ido'])
        l['forras_rovid'] = rovid(u['ido'])
        for k in ('mit_csinalj', 'mezok', 'felirat', 'alt', 'jelolesek'):
            l[k] = u[k]
        l['alap'] = dict(u['alap'], kep=NY + u['kep'] + '.png')
        l['illusztracio_elotte'] = {'kep': f"_illusztracio/png/{l['slug']}.png", 'megjegyzes': 'a 2026-11-19 előtti rajzolt vázlat (_regi/ alatt a régi jelölt képek)'}
    ix['verzio'] = '2026-11-19'
    ix['leiras'] = ('A belépés (01) és a 02, 03, 04, 11, 13, 14. lépés valódi képernyőkép: az 01 a belépő oldalról, a többi a NAV hivatalos '
                    'kisfilmjéből („Megújul az Ügysegéd”, 2026.02.19.). A többi (05–10, 12) még rajzolt Illusztráció; '
                    'a tulaj saját képeivel cserélhető: SAJAT_KEPEK.md, python sajat_kepek.py.')
    json.dump(ix, open(IP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('index.json frissítve:', sorted(UJ))


if __name__ == '__main__':
    main()
