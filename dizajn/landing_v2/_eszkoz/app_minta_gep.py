# Az értékesítő oldal GÉPES app-képeinek forrása (3. kör, 11-20 éjjel): a C5_v2/asztali képernyők MÁSOLATA,
# kitalált név és válaszidő-ígéret nélkül (mint az app_minta.py a telefonos képeknél). A C5_v2 eredeti fájljaihoz nem nyúlunk.
# Kimenet: _eszkoz/app_minta_gep/*.html  ->  node _eszkoz/app_minta_gep_kep.cjs  ->  kepek/app_gep_*.webp
# A hős gépes nézete a telefon menüjével szinkronban vált: Főoldal (A01), Dosszié (A60), Fotózás (A64: gépen a feltöltés), Üzenetek (A70).
# A64 a C5_v2-ben nincs külön oldal (a gépes menü „Fotózás” pontja a Dossziéra mutat): az A60 másolata, a menüben a Fotózás aktív,
# fent a feltöltő sáv kiemelve, és a most beküldött papír („Papírbolt, nyomtatópapír”) „Új” címkével, mint a telefonos bemutatóban.
# 3. kör javító (11-21): az A64 törzse saját elrendezés (A64_TORZS): balra „Mit töltesz fel?” a valódi app lehetőségeivel
# (Fájl a gépedről + sárga „Fájl kiválasztása” gomb, Bankszámlakivonat, Fotózás), jobbra „Amit te küldtél”. Így a gépes nézet
# a Fotózásra kattintva láthatóan más, mint a Dosszié, és a sárga gomb a böngészőablak bal, a telefon által nem takart részén van.
# Valós funkció: a gépen a fájlt a gépről VÁLASZTOD KI (fogd és vidd feltöltés az ügyfél-appban nincs), ezért a „Húzd ide…” szöveg cserélve.
import os, re, sys
ITT = os.path.dirname(os.path.abspath(__file__))
FORRAS = os.path.normpath(os.path.join(ITT, '..', '..', 'C5_v2', 'asztali'))
CEL = os.path.join(ITT, 'app_minta_gep')
os.makedirs(CEL, exist_ok=True)

KAR = '../../C2_modern/assets/avatar/karakter_1_lapos@2x.png'
# semleges sziluett a rajzolt arc helyén (a v2.js „fiok” útvonala, Material Icons, Apache 2.0) – ugyanaz, mint az app_minta.py-ban
def szil(m):
    return ('<span class="szil" style="width:%dpx;height:%dpx"><svg viewBox="0 0 24 24" aria-hidden="true">'
            '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span>') % (m, m)
STILUS = ('<style>.szil{display:inline-grid;place-items:center;flex:none;border-radius:50%;background:#fff;color:#5B6BEF;'
          'box-shadow:0 0 0 2px rgba(255,255,255,.7)}.szil svg{width:62%;height:62%;fill:currentColor;margin-top:8%}'
          '.sav-konyvelo .szil,.atnezte .szil,.lista-fej .szil{background:#E6EBFF;box-shadow:none}'
          # a képhez 1280x800-as nézet: az oldalsáv a nézet magasságáig ér (az eredeti min. 900 px)
          'body.asztali{min-height:0}.oldalsav{min-height:0;height:100vh}'
          # A64: kiemelt feltöltő sáv (mintha épp ide kattintottál volna) + „Új” címke
          '.feltolto.sav.kijelolt{border-style:solid;border-color:#1428DB;background:#F5F7FF}'
          '.uj-cimke{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:99px;background:#1428DB;color:#fff;font-size:12px;font-weight:700;vertical-align:2px}'
          # A64 (3. kör javító, 11-21): saját elrendezés, hogy a gépes „Papír beküldése” jól elváljon a Dossziétól, és a sárga gomb
          # a böngészőablak BAL, látható részén legyen (a hősben a telefon a jobb ~40%-ot takarja). A valódi app feltöltés-képernyőjének
          # lehetőségei (kod/app/src/app/feltoltes.tsx: Fotózás, Fájl, Bankszámlakivonat; „Legfeljebb 25 MB, PDF vagy fénykép”).
          '.ketpanel.bekuld{grid-template-columns:470px minmax(0,1fr)}'
          '.valaszto{flex-direction:column;gap:0!important;padding:22px 22px 18px!important}'
          '.valaszto>h2{font-size:19px}.valaszto>.al{margin:2px 0 14px;font-size:15px;color:var(--szurke)}'
          '.opcio{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:16px;border:1.5px solid var(--vonal);margin-top:10px}'
          '.opcio.on{border:2px solid #1428DB;background:#F5F7FF;padding:15px}'
          '.opcio .sz{flex:1;min-width:0}.opcio h3{font-size:16.5px;font-weight:750}.opcio p{margin-top:2px;font-size:14.5px;color:var(--szurke);line-height:1.4}'
          '.opcio .gomb{width:auto;height:46px;margin-top:12px;padding:0 22px;font-size:16px;display:inline-flex;gap:8px}'
          '.opcio svg.chev{width:20px;height:20px;align-self:center;color:#9AA2B5;fill:currentColor}'
          '.valaszto .megj{margin:12px 2px 0;font-size:13.5px;color:var(--szurke)}'
          '.ketpanel.bekuld>.valaszto{margin:0}'
          '.bekuld .tabla-fej,.bekuld .tabla-sor{grid-template-columns:40px minmax(0,1fr) 104px 20px}'
          '</style>')

# A64: a feltöltő sáv és a két panel helyén (a <section class="feltolto sav kijelolt"…> -tól a </main>-ig) ez áll.
A64_TORZS = '''<main class="ketpanel bekuld">
    <section class="k blokk valaszto">
      <h2>Mit töltesz fel?</h2>
      <p class="al">A könyvelőd megkapja, és ő teszi a helyére.</p>
      <div class="opcio on">
        <div class="tile t-kek"><svg><use href="#i-feltolt"/></svg></div>
        <div class="sz"><h3>Fájl a gépedről</h3><p>PDF vagy fénykép, például egy e-mail mellékletéből.</p>
          <button class="gomb"><svg><use href="#i-feltolt"/></svg>Fájl kiválasztása</button></div>
      </div>
      <div class="opcio">
        <div class="tile t-kek"><svg><use href="#i-irat"/></svg></div>
        <div class="sz"><h3>Bankszámlakivonat</h3><p>A bankod appjából letöltött PDF a legjobb.</p></div>
        <svg class="chev"><use href="#i-chev"/></svg>
      </div>
      <div class="opcio">
        <div class="tile t-sarga"><svg><use href="#i-kamera"/></svg></div>
        <div class="sz"><h3>Fotózás</h3><p>Papíron van? A telefonodon le is fotózhatod, több oldalt is.</p></div>
        <svg class="chev"><use href="#i-chev"/></svg>
      </div>
      <p class="megj">Legfeljebb 25&nbsp;MB, PDF vagy fénykép.</p>
    </section>

    <section class="reszlet">
      <div class="reszlet-fej"><h2>Amit te küldtél</h2></div>
      <div class="reszlet-torzs tab">
        <div class="tabla-fej"><span></span><span>Irat</span><span>Állapot</span><span></span></div>
        <a class="tabla-sor" href="#"><div class="tile kicsi t-sarga"><svg><use href="#i-nyugta"/></svg></div><div><div class="c">Papírbolt, nyomtatópapír<span class="uj-cimke">Új</span></div><div class="a">ma 9:12</div></div><div class="a">Feltöltve</div><svg class="chev"><use href="#i-chev"/></svg></a>
        <a class="tabla-sor" href="#"><div class="tile kicsi t-zold"><svg><use href="#i-pipa-kor"/></svg></div><div><div class="c">Telefonszámla, október</div><div class="a">nov. 8.</div></div><div class="a">Feldolgozva</div><svg class="chev"><use href="#i-chev"/></svg></a>
        <a class="tabla-sor" href="#"><div class="tile kicsi t-sarga"><svg><use href="#i-nyugta"/></svg></div><div><div class="c">Pénztárgép havi összesítő</div><div class="a">tegnap 17:40</div></div><div class="a">Feltöltve</div><svg class="chev"><use href="#i-chev"/></svg></a>
      </div>
    </section>
  </main>'''

KOZOS = [
    # arcok -> sziluett (a méret a v2_asztali.css szerint)
    ('<div class="ki"><img class="avatar" src="%s" alt="">' % KAR, '<div class="ki">' + szil(40)),
    ('<div class="ki"><img src="%s" alt="">' % KAR, '<div class="ki">' + szil(34)),
    ('<div class="fej-sor"><img class="avatar" src="%s" alt="">' % KAR, '<div class="fej-sor">' + szil(46)),
    ('<img src="%s" alt="">' % KAR, szil(52)),
    # nevek
    ('<div><b>Kovács Bence</b><span>a könyvelőd</span></div>', '<div><b>A könyvelőd</b><span>itt írhatsz neki</span></div>'),
    ('<span><b>Kovács Bence</b>, a könyvelőd</span>', '<span><b>A könyvelőd</b> átnézi a számláidat</span>'),
    ('Kovács Bence átnézte az iratokat', 'A könyvelőd átnézte az iratokat'),
    ('Kovács Bence látta', 'A könyvelőd látta'),
    ('Kovács Bence beadta', 'A könyvelőd beadta'),
    ('Kovács Bence megkapja', 'A könyvelőd megkapja'),
    ('<div class="felado">Kovács Bence</div>', '<div class="felado">A könyvelőd</div>'),
    ('Bármit megkérdezhetsz Bencétől, amiben elakadtál.', 'Bármit megkérdezhetsz a könyvelődtől, amiben elakadtál.'),
    ('Beszélgetés Bencével', 'Beszélgetés a könyvelőddel'),
    ('Szia Péter! Itt vagyok', 'Szia! Itt vagyok'),
    ('Szia Bence! Mennyit', 'Szia! Mennyit'),
    ('Bence kéri', 'A könyvelőd kéri'),
    ('Írj Bencének…', 'Írj a könyvelődnek…'),
    # válaszidő-ígéret -> csak az időablak
    ('A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.', 'Munkanapokon 9 és 17 óra között hívunk vissza.'),
    ('Kollégánk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.', 'Munkanapokon 9 és 17 óra között hívunk vissza.'),
    # nem létező funkció (fogd és vidd) -> valós: kiválasztás a gépről
    ('Húzd ide a fájlt, vagy válaszd ki a gépedről', 'Válaszd ki a fájlt a gépedről'),
    # NAV-írásmód
    ('ÁFA-mentesség', 'áfamentesség'), ('ÁFA', 'áfa'),
]

# (kimeneti név, forrás, extra cserék)
OLDALAK = [
    ('A01_fooldal', 'A01_fooldal', []),
    ('A60_dosszie', 'A60_dosszie', []),
    ('A64_feltoltes', 'A60_dosszie', [
        ('<title>Adózz – Dosszié (gép)</title>', '<title>Adózz – Fotózás és feltöltés (gép)</title>'),
        ('<a class="on" aria-current="page" href="A60_dosszie.html"><svg><use href="#i-dosszie"/></svg>Dosszié</a>',
         '<a href="A60_dosszie.html"><svg><use href="#i-dosszie"/></svg>Dosszié</a>'),
        ('<a href="A60_dosszie.html"><svg><use href="#i-kamera"/></svg>Fotózás</a>',
         '<a class="on" aria-current="page" href="A64_feltoltes.html"><svg><use href="#i-kamera"/></svg>Fotózás</a>'),
        ('<h1>Novemberi dosszié</h1>', '<h1>Papír beküldése</h1>'),
        ('<p>Itt van minden irat, amit küldtél, és amit a könyvelőd átnézett.</p>',
         '<p>Gépen a fájlt választod ki, telefonon le is fotózhatod. A könyvelődhöz kerül.</p>'),
        ('<section class="feltolto sav" id="feltoltes">', '<section class="feltolto sav kijelolt" id="feltoltes">'),
        ('<div class="c">Papírbolt, nyomtatópapír</div>', '<div class="c">Papírbolt, nyomtatópapír<span class="uj-cimke">Új</span></div>'),
    ]),
    ('A70_uzenetek', 'A70_uzenetek', []),
]

hiba = 0
for nev, forras, extra in OLDALAK:
    h = open(os.path.join(FORRAS, forras + '.html'), encoding='utf-8').read()
    for minta, uj in extra + KOZOS:
        if minta not in h and (minta, uj) in extra:
            print('NEM TALÁLT (extra)', nev, minta[:60]); hiba += 1
        h = h.replace(minta, uj)
    if nev == 'A64_feltoltes':
        h, db = re.subn(r'<section class="feltolto sav kijelolt" id="feltoltes">.*?</main>', lambda m: A64_TORZS, h, count=1, flags=re.S)
        if db != 1: print('NEM TALÁLT (A64 törzs)'); hiba += 1
    # utak: a másolat a landing_v2/_eszkoz/app_minta_gep mappában van (dizajn/ három szinttel feljebb)
    h = h.replace('href="../v2.css"', 'href="../../../C5_v2/v2.css"').replace('href="v2_asztali.css"', 'href="../../../C5_v2/asztali/v2_asztali.css"')
    h = h.replace('src="../v2.js"', 'src="../../../C5_v2/v2.js"').replace('../../C2_modern/', '../../../C2_modern/')
    h = h.replace('</head>', STILUS + '</head>', 1)
    h = h.replace('<html lang="hu">', '<html lang="hu"><!-- MÁSOLAT: landing_v2/_eszkoz/app_minta_gep.py készítette a C5_v2/asztali/' + forras + '.html-ből. -->', 1)
    maradt = [s for s in ('Bence', 'Péter', 'Kovács', '24–48', 'ÁFA', 'karakter_1', 'Húzd ide') if s in h]
    if maradt: print('MARADT', nev, maradt); hiba += 1
    open(os.path.join(CEL, nev + '.html'), 'w', encoding='utf-8').write(h)
    print('kész', nev)
sys.exit(1 if hiba else 0)
