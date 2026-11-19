# -*- coding: utf-8 -*-
"""Kontaktlapok a C2 modern-elem kutatáshoz, 2. változat (2026-11-17 este).
A tulaj szerint „a C-nél a betűtípus volt csúnya”, ezért a lapok már NEM a C Caslon + Archivo
párjával készülnek, hanem a javasolt új betűvel: Onest (OFL, _betuk/Onest_wght.ttf, helyben).
Az 1. változat (Caslon) a ../_regi/ mappában van.

Kimenet:  ../_revolut_qonto.jpg      Revolut és Qonto képernyők + betűtanulság, mit veszünk át
          ../_modern.jpg             a 25 elemes katalógus, a 8 javasolt kék kerettel
          ../_minta_papirszemcse.jpg a papírszemcse-minta egy Onesttel szedett levélen
          ../betu_03.jpg             a levél-minta szemcse nélkül (Onest + kézírásos aláírás)
Futtatás: python kontakt.py [revolut_qonto] [modern] [betu]. Nem töröl semmit, internet nem kell."""
import os, sys, subprocess, tempfile, uuid, html, random
from PIL import Image, ImageFilter, ImageChops

sys.stdout.reconfigure(encoding='utf-8')
K = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')).replace('\\', '/')
C = os.path.abspath(os.path.join(K, '..', '..', 'C_tintakek_kezjegy')).replace('\\', '/')
TMP = os.path.join(tempfile.gettempdir(), 'c2_kontakt_v2').replace('\\', '/')
os.makedirs(TMP, exist_ok=True)
CH = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
ONEST = f'file:///{K}/_betuk/Onest_wght.ttf'


def vag(fajl, cx, cy, cw, nev):
    """3:4-es kivágás: középpont (cx, cy) és szélesség (cw) a kép arányában. Ha nem fér ki, a sarok színével pótol."""
    im = Image.open(f'{K}/{fajl}').convert('RGB')
    W, H = im.size
    w = cw * W; h = w * 4 / 3
    x0 = cx * W - w / 2; y0 = cy * H - h / 2
    x0 = max(min(x0, W - w), 0) if w <= W else x0
    y0 = max(min(y0, H - h), 0) if h <= H else (H - h) / 2
    bg = im.getpixel((3, 3))
    out = Image.new('RGB', (int(w), int(h)), bg)
    out.paste(im, (int(-x0), int(-y0)))
    out = out.resize((600, 800), Image.LANCZOS)
    p = f'{TMP}/{nev}.jpg'
    out.save(p, quality=90)
    return 'file:///' + p


def szemcse(kep, erosseg=0.11):
    """Hideg fehér papír rost-textúrája: finom pontzaj + függőleges rostcsíkok, legfeljebb néhány %-os sötétítés."""
    w, h = kep.size
    random.seed(7)
    zaj = Image.effect_noise((w, h), 48).convert('L').filter(ImageFilter.GaussianBlur(0.5))
    rost = Image.effect_noise((max(w // 5, 1), h), 70).convert('L').resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.0))
    tex = ImageChops.multiply(zaj, rost)
    hist = tex.histogram(); m = sum(i * c for i, c in enumerate(hist)) / max(sum(hist), 1)
    sotet = tex.point(lambda v: int(255 - max(0.0, m - v) * erosseg * 2.2))
    return ImageChops.multiply(kep, Image.merge('RGB', (sotet, sotet, sotet)))


def lo(html_utvonal, png, w, h, skala=2):
    prof = os.path.join(TMP, 'prof_' + uuid.uuid4().hex[:8]).replace('\\', '/')
    subprocess.run([CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                    f'--user-data-dir={prof}', f'--force-device-scale-factor={skala}', f'--window-size={w},{h}',
                    '--virtual-time-budget=12000', '--allow-file-access-from-files', f'--screenshot={png}',
                    'file:///' + html_utvonal], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)


# --------------------------------------------------------------------------- levél-minta Onesttel
LEVEL_CSS = """
@font-face{font-family:'Onest';src:url('%s') format('truetype');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
body{width:390px;background:#DDE3EC;font-family:Onest,sans-serif;color:#151C2A;padding:14px 16px}
.level{background:#fff;border-radius:4px;padding:20px 20px 16px}
.m{font-weight:650;font-size:26px;letter-spacing:-.02em;line-height:1.1}
p{font-size:16px;line-height:1.5;margin-top:8px}
.sor{display:flex;align-items:flex-end;justify-content:space-between;margin-top:14px}
.ki{display:flex;align-items:center;gap:10px}
.ki svg.ar{width:44px;height:44px;border-radius:50%%;overflow:hidden;display:block}
.nev{font-weight:600;font-size:15px}.mikor{font-size:13.5px;color:#596379;margin-top:1px}
svg.al{width:112px;height:42px;fill:#2546A6;display:block}
""" % ONEST


def level_png():
    h = f"""<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{LEVEL_CSS}</style></head><body>
<script src="file:///{C}/kezjegy_utak.js"></script><script src="file:///{C}/ikonok.js"></script>
<article class="level"><div class="m">Kedves Kata!</div>
<p>Kiszámoltam, mennyit kell most befizetned. Szeptemberből csak a kivonatod hiányzik.</p>
<div class="sor"><div class="ki"><svg class="ar" viewBox="0 0 64 64"><use href="#bence"/></svg>
<div><div class="nev">Kovács Bence</div><div class="mikor">könyvelőd, október 2.</div></div></div>
<svg class="al" viewBox="0 0 210 78"><use href="#alairas"/></svg></div></article></body></html>"""
    p = f'{TMP}/level.html'
    open(p, 'w', encoding='utf-8').write(h)
    lo(p, f'{TMP}/level.png', 390, 230, 3)
    im = Image.open(f'{TMP}/level.png').convert('RGB')
    # a fehér levél kivágása (az alap #DDE3EC)
    W, H = im.size
    px = im.load()
    ys = [y for y in range(H) if px[W // 2, y] == (255, 255, 255)]
    lev = im.crop((int(16 * 3), ys[0], W - int(16 * 3), ys[-1] + 1))
    return lev


def papirszemcse():
    """Onesttel szedett levél: bal fele sima, jobb fele szemcsés. Csempe: felül sima, alul szemcsés."""
    lev = level_png()
    lev.save(f'{K}/betu_03.jpg', quality=94)
    w, h = lev.size
    szem = szemcse(lev)
    ki = lev.copy()
    ki.paste(szem.crop((w // 2, 0, w, h)), (w // 2, 0))
    ki.save(f'{K}/_minta_papirszemcse.jpg', quality=94)
    dob = (0, 0, int(.80 * w), int(.62 * h))
    a, b = lev.crop(dob), szem.crop(dob)
    cs = Image.new('RGB', (a.width, a.height * 2 + 14), (0xDD, 0xE3, 0xEC))
    cs.paste(a, (0, 0)); cs.paste(b, (0, a.height + 14))
    r = 600 / cs.width
    cs = cs.resize((600, int(cs.height * r)), Image.LANCZOS)
    tile = Image.new('RGB', (600, 800), (0xDD, 0xE3, 0xEC))
    tile.paste(cs, (0, (800 - cs.height) // 2))
    return tile


def betu_csempe(csalad, fajl, ki, cimke):
    """3:4-es betűminta-csempe (600 x 800 px) a C tartalmával: sáv a végösszeggel, levél, oszlop, ékezetek."""
    css = f"""@font-face{{font-family:'B';src:url('file:///{K}/_betuk/{fajl}') format('truetype');font-weight:100 900;font-display:block}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:300px;height:400px;overflow:hidden;background:#fff;font-family:B,sans-serif;color:#151C2A}}
.sav{{background:#17284A;color:#fff;padding:16px 14px 12px}}
.n{{font-size:11.5px;color:#AEBBD2;font-weight:500;margin-bottom:6px}}
.o{{font-weight:800;font-size:44px;line-height:1;letter-spacing:-.025em}}
.o small{{font-size:.5em;font-weight:500;color:#AEBBD2;margin-left:.15em;letter-spacing:0}}
.h{{font-size:13.5px;margin-top:7px}}
.l{{padding:12px 14px 0}}
.m{{font-weight:650;font-size:21px;letter-spacing:-.02em}}
p{{font-size:13px;line-height:1.45;margin:4px 0 6px}}
.s{{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #D6DCE5;padding:5px 0;font-size:12.5px}}
.s b{{font-weight:600;font-size:16px;font-variant-numeric:tabular-nums}}
.s b i{{font-style:normal;font-size:.7em;color:#596379;font-weight:500}}
.g{{display:flex;gap:6px;margin:8px 0 6px}}
.g span{{border-radius:9px;padding:9px 0;text-align:center;font-weight:700;font-size:13.5px}}
.g .a{{flex:1;background:#17284A;color:#fff}} .g .b{{background:#D6E0F0;color:#22396A;padding:9px 12px}}
.e{{font-size:12.5px;color:#4A5468}}"""
    nb = ' '
    h = f"""<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="sav"><div class="n">{e(cimke)}</div><div class="o">457{nb}380<small>Ft</small></div><div class="h">Október 12-ig (hétfő) utald el a NAV-nak.</div></div>
<div class="l"><div class="m">Kedves Kata!</div><p>Kiszámoltam, mennyit kell most befizetned. Szeptemberből csak a kivonatod hiányzik.</p>
<div class="s"><span>TB-járulék</span><b>113{nb}220 <i>Ft</i></b></div><div class="s"><span>Szocho</span><b>79{nb}560 <i>Ft</i></b></div>
<div class="s"><span>SZJA-előleg</span><b>264{nb}600 <i>Ft</i></b></div>
<div class="g"><span class="a">Befizettem</span><span class="b">Másolás</span></div>
<div class="e">Ő ő Ű ű · Győző, Szűcs, fűtő, tőled</div></div></body></html>"""
    p = f'{TMP}/{ki}.html'
    open(p, 'w', encoding='utf-8').write(h)
    lo(p, f'{TMP}/{ki}.png', 300, 400, 2)
    Image.open(f'{TMP}/{ki}.png').convert('RGB').save(f'{K}/{ki}.jpg', quality=92)


CSS = """
@font-face{font-family:'Onest';src:url('%s') format('truetype');font-weight:100 900;font-display:block}
:root{--tinta:#151C2A;--tintakek:#17284A;--alap:#DDE3EC;--halvany:#596379;--fejlec-halvany:#AEBBD2;--gomb:#D6E0F0;--kesz:#2B6744;--figyelem:#8A5A00}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:var(--alap);font-family:Onest,'Segoe UI',Arial,sans-serif;color:var(--tinta)}
.fej{background:var(--tintakek);color:#fff;padding:30px 24px 26px}
.fej h1{font-weight:800;font-size:42px;line-height:1.05;letter-spacing:-.025em}
.fej p{color:var(--fejlec-halvany);font-size:16px;line-height:1.45;margin-top:10px;max-width:1000px}
.szakasz{padding:24px 24px 4px}
.szakasz h2{font-weight:750;font-size:28px;line-height:1.1;letter-spacing:-.02em}
.szakasz p{font-size:14.5px;color:#4A5468;margin-top:5px;line-height:1.45;max-width:1040px}
.racs{display:grid;gap:14px;padding:12px 24px 10px}
.r6{grid-template-columns:repeat(6,1fr)}
.r5{grid-template-columns:repeat(5,1fr);gap:16px}
.lap{background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;position:relative}
.lap img{width:100%%;aspect-ratio:3/4;object-fit:cover;display:block;background:#0f1522}
.felirat{padding:9px 10px 11px}
.felirat b{display:block;font-weight:650;font-size:13px;line-height:1.3}
.felirat span{display:block;font-size:12.5px;line-height:1.38;color:var(--tintakek);margin-top:4px}
.felirat i{font-style:normal;display:block;font-size:11.5px;color:var(--halvany);margin-top:5px}
.elem .felirat{padding:10px 12px 13px}
.elem .cim{display:flex;gap:7px;align-items:baseline;line-height:1.12}
.elem .sz{font-weight:800;font-size:21px;font-variant-numeric:tabular-nums;color:var(--tintakek);letter-spacing:-.02em}
.elem .nev{font-weight:700;font-size:17.5px;letter-spacing:-.015em}
.elem .jav,.elem .vig,.betu .jav{position:absolute;top:10px;right:10px;font-size:12.5px;font-weight:700;border-radius:999px;padding:4px 11px;box-shadow:0 1px 4px rgba(10,20,40,.25)}
.elem .jav,.betu .jav{background:var(--tintakek);color:#fff}
.elem .vig{background:#FBF3E2;color:var(--figyelem)}
.elem .hol{font-size:12px;color:var(--halvany);margin-top:5px;line-height:1.3}
.elem .c{font-size:13px;line-height:1.4;margin-top:6px}
.elem.top{outline:3px solid var(--tintakek);outline-offset:-3px}
.lab{padding:14px 24px 22px;font-size:12.5px;color:#4A5468;line-height:1.45}
""" % ONEST

# --------------------------------------------------------------------------- Revolut + Qonto
REVOLUT = [
    ('revolut_hu_02.jpg', .5, .50, .72, 'Nagy összeg középen, alatta tónusos pirula', 'Nálunk 457 380 Ft a sávon, alatta „Hogyan jött ki?” pirula.', 'Revolut, Google Play HU'),
    ('revolut_02.jpg', .5, .66, .78, 'Négy kerek gyorsgomb, felirattal', 'A levél alatt: Fotózás, Feltöltés, Kérdezek, Igazolás.', 'Revolut, App Store GB'),
    ('revolut_hu_06.jpg', .5, .74, .80, '„Közelgő fizetés, 2 napon belül esedékes”', 'Határidő-sor: „NAV-befizetés, még 3 nap”.', 'Revolut, Google Play HU'),
    ('revolut_hu_07.jpg', .5, .72, .80, 'Cél-sáv, alatta „Határidő: jún. 25, 4 hónap van hátra”', 'A határ-mérő alá: meddig és mennyi van még.', 'Revolut, Google Play HU'),
    ('revolut_08.jpg', .5, .68, .84, 'Ikon, a sarkán zöld pipás jelvény', 'Dosszié-sor: az irat ikonján ül az állapotjel.', 'Revolut, App Store GB'),
    ('revolutbiz_04.jpg', .5, .55, .84, 'Részletek lapon, kerek X-szel, „1/3” követés', 'Másolás, „Hogyan jött ki?”, Befizettem: lap, nem új oldal.', 'Revolut Business, App Store GB'),
    ('revolutbiz_02.jpg', .5, .80, .84, 'Lebegő, pirula alakú fülsor', 'Fehér lebegő fülsor, mellette kerek Fotózás gomb.', 'Revolut Business, App Store GB'),
    ('revolutbiz_06.jpg', .5, .60, 1.0, 'Nyugtafotó, fölötte „Match found” kártya', 'Fotó után: „Bence megkapta, az októberi bevételedhez került”.', 'Revolut Business, App Store GB'),
    ('revolut_07.jpg', .5, .48, 1.0, 'Kézírásos aláírás a kártyán', 'Bence aláírása kirajzolódik, amikor a levél kinyílik.', 'Revolut, App Store GB'),
    ('revolut_hu_04.jpg', .5, .62, .84, 'Összeg beszélgetés-buborékban, Kérés és Küldés', 'Bence kérése buborékban, benne a „Feltöltöm” gombbal.', 'Revolut, Google Play HU'),
    ('revolut_hu_08.jpg', .5, .62, .84, 'Szegmentált váltó: 1 hét, 1 hó, 6 hó, 1 év', 'Határoknál: Havi, Negyedéves, Idei.', 'Revolut, Google Play HU'),
    ('revolut_hu_05.jpg', .5, .555, .84, 'Egyenleg nagy, félkövér groteszkkel', 'A végösszeg Onest 800-zal, a „Ft” kisebb és halványabb.', 'Revolut, Google Play HU'),
]
QONTO = [
    ('qonto_06.jpg', .5, .50, 1.0, 'Könyvelő a nyugta fölött: fotó, név, hozzáférés', 'Fotózáskor felül Bence képe: „Bence nézi át”.', 'Qonto, App Store GB'),
    ('qontoweb_05.jpg', .5, .5, .92, '„Accountant Access”, 148 tétel ellenőrizve', 'Havi kártya: „Bence átnézte: 12 tétel, mind rendben.”', 'qonto.com, könyvelés'),
    ('qontoweb_03.jpg', .5, .55, .75, 'Teljes képernyős nyugtaszkenner, fehér exponáló', 'Fotózás: sarokjelölők, magától exponál.', 'qonto.com, fizetés'),
    ('qontoweb_06.jpg', .5, .5, .95, 'Lebegő visszajelzés zöld pipával', 'Feltöltés után: hová került az irat, pipával.', 'qonto.com, könyvelés'),
    ('qontoweb_08.jpg', .5, .5, .95, 'Állapot-pirulák ikonnal: Scheduled, Paid', 'A négy állapotszó kis pirulában, a jel a szó előtt.', 'qonto.com, számlázás'),
    ('qontoweb_09.jpg', .5, .5, .95, 'Satírozott függő rész a sávon, Elutasít és Elfogad', 'Határ-mérő: tollsatír a várható részre; két egyértelmű gomb.', 'qonto.com, kártya'),
    ('qontoweb_01.jpg', .5, .5, .75, 'Kezdőlap: egyenleg és négy gyorsművelet', 'A gyorsműveletek a pénz alatt, mindig ugyanott.', 'qonto.com, fizetés'),
    ('qontoweb_02.jpg', .5, .5, .75, 'Lista: ikon korongban, összeg és dátum jobbra', 'Dosszié-sor: tónusos ikon-korong, egyforma ritmus.', 'qonto.com, könyvelés'),
    ('qontodribbble_01.jpg', .47, .5, .50, 'Üres állapot: vékony vonal, egy pasztell folt', 'Tollrajz az üres dossziéhoz, egy halványkék kitöltéssel.', 'Qonto csapat, Dribbble'),
    ('qonto_04.jpg', .5, .66, 1.0, 'Keret-sávok, figyelmeztető jel, egy sötét gomb', '80% fölött borostyán jel; laponként egy sötét gomb.', 'Qonto, App Store GB'),
    ('qontoweb_12.jpg', .62, .45, .70, 'Előrejelzés: a tény teli, a várható satírozott', '„Novemberben várhatóan kb. 190 000 Ft” satírozva.', 'qonto.com, pénzforgalom'),
    ('qonto_fr_06.jpg', .5, .48, .80, 'Könyvelő-kártya ÁFA-kulcs választóval (FR bolt)', 'Fotózáskor: Bence fotója és neve felül, alatta egy kérdés.', 'Qonto, App Store FR'),
]
# Betű: mit tanulunk a két cég betűhasználatából, és mi a szabad megfelelő
BETU = [
    ('revolut_hu_02.jpg', .5, .32, 1.0, 'Revolut: Aeonik Pro a címtől az egyenlegig', 'Egy grotesk mindenhol, a nagy szám szorosan szedve. Nálunk Onest.', 'Revolut, Google Play HU (a weben Aeonik Pro + Inter)'),
    ('revolut_hu_06.jpg', .5, .62, .84, 'Revolut: a lista összegei jobbra, egy oszlopban', 'Utalások: táblázatos számok, a „Ft” kisebb, a tétel neve 600-as.', 'Revolut, Google Play HU'),
    ('qonto_02.jpg', .5, .32, 1.0, 'Qonto: saját QontoSans, könnyű és félkövér', 'A súlyváltás csak bolti képen; az appban soronként egy félkövér szó.', 'Qonto, App Store GB (QontoSans, PolySans)'),
    ('qonto_nl_06.jpg', .5, .42, .80, 'Qonto: a könyvelő neve félkövér, a szerepe alatta', 'Kovács Bence 600, „könyvelőd, október 2.” 400 halványan.', 'Qonto, App Store NL'),
    ('betu_04.jpg', .5, .5, 1.0, 'Javasolt: Onest (OFL)', 'Van ő, ű, táblázatos szám, 100–900 súly és keskeny szóköz. Aeonik-közeli.', 'Saját betűpróba, betu_04.jpg, betu_01.jpg'),
    ('betu_05.jpg', .5, .5, 1.0, 'Tartalék: Golos Text (OFL)', 'Tömörebb, nehezebb számok; szintén van benne keskeny szóköz.', 'Saját betűpróba, betu_05.jpg, betu_01.jpg'),
]

# --------------------------------------------------------------------------- katalógus (25 elem)
# (sorszám, név, forrás-kép, cx, cy, cw, hol látható, C-ben, jelölés: 'jav' = javasolt, 'vig' = óvatosan)
ELEMEK = [
    (1, 'Egy grotesk, nehéz számok', 'betu_04.jpg', .5, .5, 1.0, 'Revolut (Aeonik Pro), Qonto (QontoSans)', 'Onest mindenhol: összeg 800, cím 600–650, szöveg 400, oszlopban táblázatos számok. Kézírás csak az aláírás.', 'jav'),
    (2, 'Lap az oldalak helyett', 'revolutbiz_04.jpg', .5, .55, .84, 'Revolut Business, iOS 26', '„Hogyan jött ki?”, utalások és Befizettem felcsúszó lapon; a levél mögötte marad.', 'jav'),
    (3, 'Lebegő fülsor, külön Fotózás gomb', 'revolutbiz_02.jpg', .5, .80, .84, 'Revolut Business 2026, iOS 26', 'Fehér pirula négy füllel, mellette kerek tintakék kameragomb; görgetéskor összehúzódik.', 'jav'),
    (4, 'Határidő a zárolt képernyőn', 'apple_01.jpg', .5, .62, .65, 'iOS 26 Live Activity, Revolut', '„NAV-befizetés 457 380 Ft, még 3 nap”, vonal a levél napjától a határidőig.', 'jav'),
    (5, 'Widget', 'apple_05.jpg', .5, .5, .56, 'iOS 26, Qonto, Revolut', 'Kicsi: összeg és határidő. Közepes: Bence kérése és egy Fotózás gomb.', ''),
    (6, 'Fotózás élkereséssel', 'qontoweb_03.jpg', .5, .55, .75, 'Qonto, Ramp, Revolut Business', 'Sarokjelölők a papír sarkára ugranak, magától exponál, oldalszámláló.', 'jav'),
    (7, 'Megkaptam-kártya', 'revolutbiz_06.jpg', .5, .60, 1.0, 'Revolut Business, Qonto', '„Nyugta, 18 000 Ft, az októberi bevételedhez került”, alatta a kiolvasott adatok.', ''),
    (8, 'Bence ellenőrző kártyája', 'qontoweb_05.jpg', .5, .5, .92, 'Qonto könyvelői hozzáférés', 'Fotó, „Bence átnézte: 12 tétel, mind rendben”, KB monogram.', 'jav'),
    (9, 'Befizettem-pillanat', 'apple_02.jpg', .5, .60, .75, 'Apple Cash, Monarch', 'Tintavonás áthúzza az összeget, zöld pipa, KB pecsét, sikeres rezgés. Konfetti nincs.', 'jav'),
    (10, 'Kirajzolódó aláírás', 'revolut_07.jpg', .5, .48, 1.0, 'Revolut aláírásos kártya', 'A havi levél első nyitásakor Bence aláírása tollvonásonként megjelenik, egyszer.', 'jav'),
    (11, 'Kerek gyorsműveletek', 'revolut_02.jpg', .5, .66, .78, 'Revolut, Qonto', 'A levél alatt: Fotózás, Feltöltés, Kérdezek, Igazolás. Tónusos körök felirattal.', ''),
    (12, 'Állapotjel az ikon sarkán', 'revolut_08.jpg', .5, .68, .84, 'Revolut, Qonto', 'Dosszié-sor: zöld pipa vagy szürke óra az irat ikonján; a tétel fejében pirula.', ''),
    (13, 'Satírozott várható rész', 'qontoweb_09.jpg', .5, .5, .95, 'Qonto keret és előrejelzés', 'Határ-mérő: teli az eddigi, tollsatír a várható év végéig, jel 80%-nál.', ''),
    (14, 'Visszaszámláló határidő-sor', 'revolut_hu_06.jpg', .5, .74, .80, 'Revolut, Cleo', '„Következő befizetés: november 12., még 34 nap”. Piros sosem.', ''),
    (15, 'Szegmentált váltó', 'revolut_hu_08.jpg', .5, .62, .84, 'Revolut, Qonto', 'Határoknál: Havi, Negyedéves, Idei. A kiválasztott fehér kapszula.', ''),
    (16, 'Kérés buborékban', 'revolut_hu_04.jpg', .5, .62, .84, 'Revolut, Apple Cash', 'Bence kérése buborékban, benne „Feltöltöm” gomb; utána zöldre vált.', ''),
    (17, 'Jóváhagyó kérdések', 'copilot_2.jpg', .5, .42, 1.0, 'Copilot Money, Qonto, Ramp', '„Ez a nyugta a vállalkozásodhoz tartozik?” Igen, vagy: Nem, magánkiadás.', ''),
    (18, 'Lapozós átnézés pecséttel', 'monarch_1.jpg', .6, .66, 1.0, 'Monarch', 'Hónap végi bizonytalan tételek: jobbra Üzleti, balra Magán, pecséttel.', 'vig'),
    (19, 'Tollrajz üres állapotok', 'qontodribbble_01.jpg', .47, .5, .50, 'Qonto illusztrációk', 'Nyitott dosszié gemkapoccsal, egy halványkék folttal. Vázlat OpenRouteren, kézzel tisztázva.', ''),
    (20, 'Kiemelt fő gomb', 'material_03.jpg', .5, .5, .42, 'Material 3 Expressive', 'Egy fő gomb, 56 px, ikonnal; nyomásra a sarka lágyan változik. Gyorsabban észrevehető.', ''),
    (21, 'Frissítés tollhullámmal', 'material_02.jpg', .5, .5, .42, 'Material 3 Expressive', 'Lehúzáskor rövid kézírásos hullám, majd kis pipa. Feltöltésnél ugyanez a vonal.', ''),
    (22, 'Gördülő nagy számjegyek', 'revolut_hu_05.jpg', .5, .555, .84, 'Revolut', 'Ha Bence újraszámol, a számjegyek oszloponként átgördülnek. Onest 800, táblázatos számokkal, hogy ne ugráljon.', ''),
    (23, 'Feltöltés-pirula, vonalas váz', 'mercury_2.jpg', .5, .60, 1.0, 'Mercury, Revolut, Qonto', '„Feltöltés… 2/3” pirula; töltéskor a levélpapír halvány sorai látszanak.', ''),
    (24, 'Sötét mód tintából', 'qontodribbble_03.jpg', .5, .5, .56, 'Qonto, Revolut, Origin', 'Éjkék alap, világosabb lapok, a levél világos marad. Fekete és neon nincs.', ''),
    (25, 'Papírszemcse csak a levélen', None, 0, 0, 0, 'Saját javaslat (Monarch, Origin hangulata)', 'Halvány rost-textúra csak a levélen (felül sima, alul szemcsés, kicsit túlzva). Hunyorítva el kell tűnnie.', ''),
]


def e(s):
    return html.escape(s, quote=True)


def vegso(png, jpg):
    """Levágja az alsó üres alapot, és JPG-be menti (2400 px széles)."""
    im = Image.open(png).convert('RGB')
    W, H = im.size
    alap = (0xDD, 0xE3, 0xEC)
    y = H - 1
    while y > 0:
        sor = im.crop((0, y, W, y + 1)).getcolors(W)
        if not (len(sor) == 1 and sor[0][1] == alap):
            break
        y -= 1
    im = im.crop((0, 0, W, min(H, y + 40)))
    im.save(jpg, quality=86, optimize=True)
    print(jpg, im.size)


def racs(lista, pre, jav_idx=()):
    out = []
    for i, (f, cx, cy, cw, mit, at, forras) in enumerate(lista):
        src = vag(f, cx, cy, cw, f'{pre}{i:02d}')
        jel = '<span class="jav">Javasolt</span>' if i in jav_idx else ''
        fn = '' if f in forras else f', {e(f)}'
        out.append(f'<div class="lap betu">{jel}<img src="{src}"><div class="felirat"><b>{e(mit)}</b>'
                   f'<span>{e(at)}</span><i>{e(forras)}{fn}</i></div></div>')
    return '\n'.join(out)


def revolut_qonto():
    h = f"""<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="fej"><h1>Revolut és Qonto: mit veszünk át a Kézjegybe</h1>
<p>A két app 2025–2026-os bolti képei (App Store: Egyesült Királyság, Franciaország, Hollandia, Olaszország, Spanyolország, Portugália, USA; Google Play HU), a qonto.com termékoldalai és a Qonto tervezőinek Dribbble-lapjai. Minden kártyán: mit látunk, alatta kékkel, hogyan kerül a C-be. A lap már az új betűvel, az Onesttel készült.</p></div>
<div class="szakasz"><h2>Revolut</h2><p>Erős oldala: a pénz mint középre tett nagy, félkövér szám, a kerek gyorsgombok, a felcsúszó lapok és a lebegő fülsor. A fekete-fotós, neon-színátmenetes világát nem vesszük át.</p></div>
<div class="racs r6">{racs(REVOLUT, 'rv')}</div>
<div class="szakasz"><h2>Qonto</h2><p>Erős oldala: a könyvelő mint látható ember, a nyugtafotózás, a tiszta állapot-pirulák, a satírozott „várható” rész és a vonalas illusztrációk. Világos, nyugodt, laponként egy sötét gomb.</p></div>
<div class="racs r6">{racs(QONTO, 'qo')}</div>
<div class="szakasz"><h2>Betű: amit a két cégtől tanulunk</h2><p>Mindkettő egyetlen, saját groteszket használ (Revolut: Aeonik Pro, a weben Inter mellett; Qonto: QontoSans). Talp nélküli, nyugodt betű, a pénz nehéz súllyal. Ezek nem szabad betűk, ezért a legközelebbi OFL-rokont választottuk: Onest, tartaléknak Golos Text.</p></div>
<div class="racs r6">{racs(BETU, 'bt')}</div>
<div class="lab">Források és pontos webcímek: kutatas/_forrasok.json. A teljes betűpróba (12 jelölt): betu_01.jpg, közelről: betu_02.jpg, a betűk: kutatas/_betuk. A képek a kutatáshoz kellenek, az appba nem kerülnek.</div>
</body></html>"""
    p = f'{TMP}/revolut_qonto.html'
    open(p, 'w', encoding='utf-8').write(h)
    lo(p, f'{TMP}/revolut_qonto.png', 1200, 3000)
    vegso(f'{TMP}/revolut_qonto.png', f'{K}/_revolut_qonto.jpg')


def modern():
    csempe = papirszemcse()
    lapok = []
    for (n, nev, f, cx, cy, cw, hol, c, jel) in ELEMEK:
        if f:
            src = vag(f, cx, cy, cw, f'el{n:02d}')
        else:
            src = f'file:///{TMP}/el{n:02d}.jpg'
            csempe.save(f'{TMP}/el{n:02d}.jpg', quality=94)
        jelzo = '<span class="jav">Javasolt</span>' if jel == 'jav' else ('<span class="vig">Óvatosan</span>' if jel == 'vig' else '')
        lapok.append(f'<div class="lap elem{" top" if jel == "jav" else ""}">{jelzo}<img src="{src}"><div class="felirat">'
                     f'<div class="cim"><span class="sz">{n}</span><span class="nev">{e(nev)}</span></div>'
                     f'<div class="hol">{e(hol)}</div><div class="c">{e(c)}</div></div></div>')
    h = f"""<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="fej"><h1>Modern elemek a Kézjegyhez: 25 jelölt, 8 javasolt</h1>
<p>Fő minta a Revolut és a Qonto, mellettük az iOS 26 Liquid Glass, a Material 3 Expressive és a legjobb pénzügyi appok (Copilot Money, Mercury, Monarch, Ramp). A kék keretes kártyák a javasoltak. A tintakék levélpapír marad, a Caslon helyére az Onest jön. Kihagytuk: fémes 3D tárgyak, neon, fekete-fotós háttér.</p></div>
<div class="racs r5" style="padding-top:20px">{''.join(lapok)}</div>
<div class="lab">Az elemek részletes leírása a kutatás eredményében van. Források: kutatas/_forrasok.json. A számok csak minták.</div>
</body></html>"""
    p = f'{TMP}/modern.html'
    open(p, 'w', encoding='utf-8').write(h)
    lo(p, f'{TMP}/modern.png', 1200, 3900)
    vegso(f'{TMP}/modern.png', f'{K}/_modern.jpg')


if __name__ == '__main__':
    mit = sys.argv[1:] or ['revolut_qonto', 'modern']
    if 'betu' in mit or 'revolut_qonto' in mit or 'modern' in mit:
        betu_csempe('Onest', 'Onest_wght.ttf', 'betu_04', 'Onest, OFL')
        betu_csempe('Golos Text', 'GolosText_wght.ttf', 'betu_05', 'Golos Text, OFL')
    if 'betu' in mit:
        papirszemcse()
    if 'revolut_qonto' in mit:
        revolut_qonto()
    if 'modern' in mit:
        modern()
