# -*- coding: utf-8 -*-
"""Betűpróba (a betu_01.jpg forrása). Futtatás: python betuproba.py. Betűk: ../_betuk/jeloltek.
Betűpróba: 12 szabad (OFL) grotesk a C valódi tartalmán, a C eredeti betűi (Caslon + Archivo) már nincsenek benne."""
import os, sys, subprocess, uuid, html
sys.stdout.reconfigure(encoding='utf-8')
import tempfile
K = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')).replace(os.sep, '/')
F = K + '/_betuk/jeloltek'
B = os.path.join(tempfile.gettempdir(), 'c2_betuproba').replace(os.sep, '/')
os.makedirs(B + '/out', exist_ok=True)
CH = r'C:/Program Files/Google/Chrome/Application/chrome.exe'
# (css név, fájl, nehéz súly, címsúly, megjegyzés)
JEL = [
 ('Onest', 'Onest_wght.ttf', 800, 600, 'OFL · 100–900 · tnum · U+202F van'),
 ('Golos Text', 'GolosText_wght.ttf', 800, 600, 'OFL · 400–900 · tnum · U+202F van'),
 ('Inter', 'Inter_opsz_wght.ttf', 800, 600, 'OFL · 100–900 + opsz · tnum · U+202F van'),
 ('Geist', 'Geist_wght.ttf', 800, 600, 'OFL · 100–900 · tnum'),
 ('Figtree', 'Figtree_wght.ttf', 800, 600, 'OFL · 300–900 · tnum'),
 ('Schibsted Grotesk', 'SchibstedGrotesk_wght.ttf', 800, 600, 'OFL · 400–900 · tnum'),
 ('Mona Sans', 'MonaSans_wdth_wght.ttf', 800, 600, 'OFL · 200–900 + szélesség · tnum'),
 ('Hanken Grotesk', 'HankenGrotesk_wght.ttf', 800, 600, 'OFL · 100–900 · mindig táblázatos számok'),
 ('Manrope', 'Manrope_wght.ttf', 800, 600, 'OFL · 200–800 · tnum'),
 ('Plus Jakarta Sans', 'PlusJakartaSans_wght.ttf', 800, 600, 'OFL · 200–800 · tnum'),
 ('Rethink Sans', 'RethinkSans_wght.ttf', 800, 600, 'OFL · 400–800 · mindig táblázatos'),
 ('Red Hat Display', 'RedHatDisplay_wght.ttf', 800, 600, 'OFL · 300–900 · tnum'),
]
ff = []
for n, f, *_ in JEL:
    ff.append(f"@font-face{{font-family:'{n} P';src:url('file:///{F}/{f}') format('truetype');font-weight:100 1000;font-display:block}}")
NB = '\u00a0'
def tile(n, heavy, semi, note, elvetett=False):
    fam = f"'{n} P'" if not elvetett else "'Libre Caslon Condensed'"
    body = f"'{n} P'" if not elvetett else "Archivo"
    st = '' if not elvetett else 'font-stretch:96%;'
    return f"""
<div class="t{' elv' if elvetett else ''}">
 <div class="nev">{html.escape(n if not elvetett else 'Elvetve: Libre Caslon Condensed + Archivo (a C eredeti párja)')}<span>{html.escape(note)}</span></div>
 <div class="sav" style="font-family:{body};{st}">
   <div class="osszeg" style="font-family:{fam};font-weight:{heavy}">457{NB}380<small>Ft</small></div>
   <div class="hat">Október 12-ig (hétfő) utald el a NAV-nak.</div>
 </div>
 <div class="lap" style="font-family:{body};{st}">
   <div class="megsz" style="font-family:{fam};font-weight:{semi if not elvetett else 600}">Kedves Kata!</div>
   <p>Kiszámoltam, mennyit kell most befizetned. Szeptemberből csak a kivonatod hiányzik.</p>
   <div class="sor"><span>TB-járulék</span><b style="font-family:{fam};font-weight:{semi if not elvetett else 600}">113{NB}220 <i>Ft</i></b></div>
   <div class="sor"><span>Szocho</span><b style="font-family:{fam};font-weight:{semi if not elvetett else 600}">79{NB}560 <i>Ft</i></b></div>
   <div class="sor"><span>SZJA-előleg, III. negyedév</span><b style="font-family:{fam};font-weight:{semi if not elvetett else 600}">264{NB}600 <i>Ft</i></b></div>
   <div class="gombok"><span class="g1">Befizettem</span><span class="g2">Másolás</span></div>
   <div class="all"><span class="pipa"></span><b>Feldolgozva,</b>&nbsp;hétfőn · <b>Bence látta,</b>&nbsp;tegnap</div>
   <div class="eke">Ő ő Ű ű · Győző, Szűcs, fűtő, tőled, ŰRLAP, ŐSZ</div>
 </div>
</div>"""
CSS = """
""" + '\n'.join(ff) + """
*{box-sizing:border-box;margin:0;padding:0}
body{width:1600px;background:#DDE3EC;color:#151C2A;font-family:'Onest P',sans-serif;padding:28px 24px}
h1{font-family:'Onest P';font-weight:800;font-size:40px;letter-spacing:-.02em;color:#17284A}
.al{font-size:16px;color:#4A5468;margin:6px 0 20px;max-width:1300px;line-height:1.45}
.racs{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.t{background:#fff;border-radius:14px;overflow:hidden}
.t.elv{opacity:.92;outline:3px dashed #B42318;outline-offset:-3px}
.nev{padding:10px 14px 8px;font:700 17px 'Onest P';color:#17284A}
.nev span{display:block;font-weight:400;font-size:12.5px;color:#596379;margin-top:2px}
.sav{background:#17284A;color:#fff;padding:16px 16px 14px}
.osszeg{font-size:46px;line-height:1;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.osszeg small{font-size:.5em;font-weight:500;color:#AEBBD2;margin-left:.2em;letter-spacing:0}
.hat{font-size:15.5px;margin-top:8px;color:#fff}
.lap{padding:14px 16px 14px;background:#fff}
.megsz{font-size:25px;letter-spacing:-.015em;line-height:1.1}
.lap p{font-size:15px;line-height:1.45;margin:6px 0 8px}
.sor{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #D6DCE5;padding:7px 0;font-size:14.5px}
.sor b{font-size:19px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.sor b i{font-style:normal;font-size:.7em;color:#596379;font-weight:500}
.gombok{display:flex;gap:8px;margin:10px 0 10px}
.g1{flex:1;background:#17284A;color:#fff;border-radius:10px;padding:12px 0;text-align:center;font-weight:700;font-size:16px}
.g2{background:#D6E0F0;color:#22396A;border-radius:10px;padding:12px 16px;font-weight:700;font-size:15px}
.all{font-size:13.5px;color:#151C2A;display:flex;align-items:center}
.all b{font-weight:600}
.pipa{width:14px;height:14px;border-radius:50%;background:#2B6744;margin-right:6px;display:inline-block}
.eke{margin-top:8px;font-size:14px;color:#4A5468}
"""
def main():
    tiles = ''.join(tile(n, h, s, note) for n, f, h, s, note in JEL)
    page = f"""<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<h1>Betűpróba a Kézjegyhez: 12 szabad grotesk a C saját tartalmán</h1>
<div class="al">Minden betű OFL-licencű (Google Fonts), van benne ő, Ő, ű, Ű és táblázatos számjegy. A végösszeg 800-as súlyú, −2,5% betűközzel, ahogy a Revolut szedi az egyenleget (Aeonik Pro). A szöveg 400, a megszólítás és a tételösszeg 600. A Qonto saját betűje (QontoSans) és a Revolut Aeonik Pro-ja nem szabad, ezért ezek a legközelebbi szabad rokonok.</div>
<div class="racs">{tiles}</div></body></html>"""
    p = B + '/out/proba.html'
    open(p, 'w', encoding='utf-8').write(page)
    png = B + '/out/proba.png'
    prof = B + '/out/prof_' + uuid.uuid4().hex[:6]
    subprocess.run([CH, '--headless=new', '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        f'--user-data-dir={prof}', '--force-device-scale-factor=1.5', '--window-size=1600,2000', '--virtual-time-budget=10000',
        '--allow-file-access-from-files', f'--screenshot={png}', 'file:///' + p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    from PIL import Image
    Image.open(png).convert('RGB').save(K + '/betu_01.jpg', quality=90)
    print(K + '/betu_01.jpg')
main()
