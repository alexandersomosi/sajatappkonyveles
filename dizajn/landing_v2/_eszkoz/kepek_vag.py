# Telefonkeretbe illő képek az app v2 mintáiból: 780x1688 (390x844 @2x).
# A felső rész + az alsó dokk (navigáció, ill. gomb + navigáció) összeillesztve, hogy a képernyő valódi telefonnak hasson.
# Ha a forrás pontosan 1688 magas (pl. a fotózás), változatlanul átmegy.
# Futtatás: python _eszkoz/kepek_vag.py  (a landing_v2 mappából)
# 2026-11-20 este: bővítve a mozgó bemutatóhoz (dosszié, fotózás, kiállított számlák, kereset, üzenetek-beszélgetés)
# és a hős váltakozó böngészőképeihez (A60, A70, A53 a gépes nézetből, 1440x914-re vágva).
from PIL import Image
import os
FORRAS = os.path.join(os.path.dirname(__file__), '..', '..', 'C5_v2')
# 3. kör (11-20 este): ha van név és ígéret nélküli másolat (_eszkoz/app_minta, app_minta.py + app_minta_kep.cjs), azt használjuk.
MINTA = os.path.join(os.path.dirname(__file__), 'app_minta')
def forras(f):
    m = os.path.join(MINTA, f)
    return m if os.path.exists(m) else os.path.join(FORRAS, f)
CEL = os.path.join(os.path.dirname(__file__), '..', 'kepek')
H = 1688
# kimeneti név: (forrásfájl, alsó dokk magassága px-ben, felső szeletek [(y0, y1), ...] vagy None = a kép teteje)
# A dokk: 190 = navigáció (kb. 170 px) + egy kis háttér fölötte; 330 = beírósáv + navigáció; 380 = sárga gomb + navigáció.
LISTA = {
    'app_fooldal':   ('01_fooldal.png', 190, None),
    'app_felretesz': ('51_felretesz.png', 380, None),
    'app_hataridok': ('53_hataridok_b.png', 380, None),
    'app_uzenetek':  ('70_uzenetek.png', 330, None),
    'app_dosszie':   ('60_dosszie.png', 190, None),
    'app_szamlak':   ('61_dosszie_honap.png', 0, None),
    'app_fotozas':   ('64_fotozas.png', 0, None),
    'app_kereset':   ('54_kereset.png', 190, None),
    # beszélgetés: a fejléc (0–432) + a beszélgetés (1190-től), mintha lejjebb görgettél volna
    'app_uzenetek_chat': ('70_uzenetek.png', 330, [(0, 432), (1190, None)]),
}
for nev, (f, dokk, szeletek) in LISTA.items():
    im = Image.open(forras(f)).convert('RGB')
    w, h = im.size
    if h == H:
        out = im
    else:
        out = Image.new('RGB', (w, H), (243, 245, 251))
        felso = H - dokk
        y = 0
        for (a, b) in (szeletek or [(0, None)]):
            if y >= felso: break
            b = min(b if b is not None else h - dokk, a + felso - y)
            out.paste(im.crop((0, a, w, b)), (0, y))
            y += b - a
        out.paste(im.crop((0, h - dokk, w, h)), (0, H - dokk))
    out.save(os.path.join(CEL, nev + '.webp'), 'WEBP', quality=86, method=6)
    print(nev, out.size)

# RÉGI (2. kör): gépes böngészőképek közvetlenül a C5_v2/asztali PNG-kből, 1440x914 – bennük még kitalált név van, az oldalon nem szerepelnek.
# Csak --gep-regi kapcsolóval készülnek újra (a meglévő app_asztali*.webp fájlokat nem írjuk felül véletlenül).
GEP = {
    'app_asztali': 'A01_fooldal.png',
    'app_asztali_dosszie': 'A60_dosszie.png',
    'app_asztali_uzenetek': 'A70_uzenetek.png',
    'app_asztali_hataridok': 'A53_hataridok.png',
}
for nev, f in (GEP.items() if '--gep-regi' in __import__('sys').argv else []):
    a = Image.open(os.path.join(FORRAS, 'asztali', f)).convert('RGB')
    a = a.crop((0, 0, 1440, 914))
    a.save(os.path.join(CEL, nev + '.webp'), 'WEBP', quality=86, method=6)
    print(nev, a.size)

# 3. kör (11-20 éjjel): a hős böngészőablaka és a bemutató zárólépése. Forrás: a név és ígéret nélküli másolatok képei
# (_eszkoz/app_minta_gep.py -> app_minta_gep_kep.cjs: 1280x800 @1,25 = 1600x1000). --gep kapcsolóval.
GEP2 = {
    'app_gep_fooldal': 'A01_fooldal.png',
    'app_gep_dosszie': 'A60_dosszie.png',
    'app_gep_feltoltes': 'A64_feltoltes.png',
    'app_gep_uzenetek': 'A70_uzenetek.png',
}
for nev, f in (GEP2.items() if '--gep' in __import__('sys').argv else []):
    a = Image.open(os.path.join(os.path.dirname(__file__), 'app_minta_gep', f)).convert('RGB')
    a.save(os.path.join(CEL, nev + '.webp'), 'WEBP', quality=82, method=6)
    print(nev, a.size)
    # 3. kör javító (11-21): kisebb változat a srcset-hez (telefonon és 1x kijelzőn ez is elég éles), 800x500
    k = a.resize((800, 500), Image.LANCZOS)
    k.save(os.path.join(CEL, nev + '_800.webp'), 'WEBP', quality=84, method=6)
    print(nev + '_800', k.size)
