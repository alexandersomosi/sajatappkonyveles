# Az értékesítő oldal app-képeinek forrása (3. kör, 11-20 este): a C5_v2 képernyők MÁSOLATA, kitalált név és válaszidő-ígéret nélkül.
# A C5_v2 eredeti fájljaihoz nem nyúlunk. Ez a szkript a másolatokat írja ide: _eszkoz/app_minta/*.html
# Cserék (tulaj szabályai): „Kovács Bence” / „Bence” / „Péter” helyett „a könyvelőd” vagy semmi; a rajzolt arc helyett semleges
# sziluett (ugyanaz a jel, mint az app Fiók fülén); a „Kollégánk 24–48 órán belül visszahív…” helyett csak az időablak;
# „ÁFA” helyett „áfa” (NAV-írásmód).
# Utána: node _eszkoz/app_minta_kep.cjs  (PNG + elemhatárok), majd python _eszkoz/kepek_vag.py
import os, re, sys
ITT = os.path.dirname(os.path.abspath(__file__))
FORRAS = os.path.normpath(os.path.join(ITT, '..', '..', 'C5_v2'))
CEL = os.path.join(ITT, 'app_minta')
os.makedirs(CEL, exist_ok=True)

FAJLOK = ['01_fooldal', '60_dosszie', '61_dosszie_honap', '64_fotozas', '70_uzenetek', '53_hataridok_b', '54_kereset', '51_felretesz']

# semleges sziluett a kör alakú arc helyén (a v2.js „fiok” útvonala, Material Icons, Apache 2.0)
SZIL = ('<span class="szil" style="width:{m}px;height:{m}px"><svg viewBox="0 0 24 24" aria-hidden="true">'
        '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span>')
STILUS = ('<style>.szil{display:inline-grid;place-items:center;flex:none;border-radius:50%;background:#fff;color:#5B6BEF;'
          'box-shadow:0 0 0 2px rgba(255,255,255,.7)}.szil svg{width:62%;height:62%;fill:currentColor;margin-top:8%}'
          '.kamera .szil{background:rgba(255,255,255,.9)}.k .szil{background:#E6EBFF;box-shadow:none}</style>')

CSERE = [
    # arcok -> sziluett (méret a régi kép méretéből)
    (r'<img class="avatar" style="width:(\d+)px;height:\1px(?:;box-shadow:none)?" src="\.\./C2_modern/assets/avatar/karakter_1_lapos@2x\.png" alt="">',
     lambda m: SZIL.format(m=m.group(1))),
    (r'<img src="\.\./C2_modern/assets/avatar/karakter_1_lapos@2x\.png" alt="">', lambda m: SZIL.format(m=32)),
    # nevek
    ('<b>Kovács Bence</b>, a könyvelőd', '<b>A könyvelőd</b> átnézi a számláidat'),
    ('<b>Kovács Bence</b> · a könyvelőd', '<b>A könyvelőd</b> · itt írhatsz neki'),
    ('Kovács Bence átnézte az iratokat', 'A könyvelőd átnézte az iratokat'),
    ('Kovács Bence látta', 'A könyvelőd látta'),
    ('Kovács Bence beadta', 'A könyvelőd beadta'),
    ('Kovács Bence kapja meg', 'A könyvelőd kapja meg'),
    ('Kovács Bence hagyja jóvá', 'a könyvelőd hagyja jóvá'),
    ('<div class="felado">Kovács Bence</div>', '<div class="felado">A könyvelőd</div>'),
    ('Szia Péter! Itt vagyok', 'Szia! Itt vagyok'),
    ('Szia Bence! Mennyit', 'Szia! Mennyit'),
    ('Bence kéri', 'A könyvelőd kéri'),
    ('Írj Bencének…', 'Írj a könyvelődnek…'),
    ('Bence a negyedév végén', 'A könyvelőd a negyedév végén'),
    ('A végleges adót Bence hagyja jóvá.', 'A végleges adót a könyvelőd hagyja jóvá.'),
    # válaszidő-ígéret -> csak az időablak
    ('Kollégánk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.', 'Munkanapokon 9 és 17 óra között hívunk vissza.'),
    ('Kollégánk 24–48 órán belül visszahív.', 'Munkanapokon 9 és 17 óra között.'),
    # NAV-írásmód
    ('ÁFA-mentesség', 'áfamentesség'), ('ÁFA', 'áfa'),
]

hiba = 0
for nev in FAJLOK:
    h = open(os.path.join(FORRAS, nev + '.html'), encoding='utf-8').read()
    for minta, uj in CSERE:
        if callable(uj): h = re.sub(minta, uj, h)
        else: h = h.replace(minta, uj)
    # utak: a másolat két szinttel mélyebben van (landing_v2/_eszkoz/app_minta -> dizajn/C5_v2)
    h = h.replace('href="v2.css"', 'href="../../../C5_v2/v2.css"').replace('src="v2.js"', 'src="../../../C5_v2/v2.js"')
    h = h.replace('../C2_modern/', '../../../C2_modern/')
    h = h.replace('</head>', STILUS + '</head>', 1)
    h = h.replace('<html lang="hu">', '<html lang="hu"><!-- MÁSOLAT: landing_v2/_eszkoz/app_minta.py készítette a C5_v2/' + nev + '.html-ből. -->', 1)
    maradt = [s for s in ('Bence', 'Péter', 'Kovács', '24–48', 'ÁFA', 'karakter_1') if s in h]
    if maradt: print('MARADT', nev, maradt); hiba += 1
    open(os.path.join(CEL, nev + '.html'), 'w', encoding='utf-8').write(h)
    print('kész', nev)
sys.exit(1 if hiba else 0)
