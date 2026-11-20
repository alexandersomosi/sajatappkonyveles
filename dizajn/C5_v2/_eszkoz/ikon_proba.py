# Ikonkészlet-próba (tulaj 11-20: "freeicons.io-ról cserélj valami jót, ami illik" -> javaslat: Phosphor duotone / Fluent Color, MIT).
# A letöltött SVG-k (_ikon_proba/phosphor, _ikon_proba/fluent) nem megbízható adatok: csak rajzelemeket veszünk át, minden mást eldobunk.
# Kimenet: _ikon_proba/phosphor.js, _ikon_proba/fluent.js (felülírják a v2.js szimbólumait), 01_fooldal_phosphor.html, 01_fooldal_fluent.html, ikon_osszevetes.html
import os, re, json, sys
import xml.etree.ElementTree as ET

ALAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PROBA = os.path.join(ALAP, '_ikon_proba')
NS = '{http://www.w3.org/2000/svg}'
ENGEDETT = {'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask'}
ATTR = {'d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'transform', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'id', 'clip-path', 'mask', 'fx', 'fy'}

def tisztit(fajl, elotag):
    fa = ET.parse(fajl).getroot()
    vb = fa.get('viewBox', '0 0 24 24')
    if not re.fullmatch(r'[\d.\s-]+', vb): vb = '0 0 24 24'
    def elem(e):
        tag = e.tag.replace(NS, '')
        if tag not in ENGEDETT: return ''
        a = []
        for k, v in e.attrib.items():
            k = k.replace(NS, '')
            if k not in ATTR: continue
            if re.search(r'javascript|expression|data:', v, re.I): continue
            if k == 'id': v = elotag + v
            v = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{elotag}{m.group(1)})', v)
            a.append(f'{k}="{v}"')
        bel = ''.join(elem(c) for c in e)
        return f'<{tag} {" ".join(a)}>{bel}</{tag}>' if tag != 'svg' else bel
    return vb, elem(fa)

# fogalom -> (v2.js azonosító, phosphor fájl, fluent fájl)
F = [('house', 'fooldal', 'house', 'house', 'Főoldal'), ('folder', 'dosszie', 'folder', 'folder', 'Dosszié'), ('camera', 'kamera', 'camera', 'camera', 'Fotózás'),
     ('chat', 'uzenet', 'chat-circle-dots', 'chat', 'Üzenetek'), ('user', 'fiok', 'user', 'user', 'Fiók'), ('bell', 'csengo', 'bell', 'bell', 'Értesítés'),
     ('phone', 'telefon', 'phone', 'phone', 'Visszahívás'), ('calendar', 'naptar', 'calendar-dots', 'calendar', 'Határidő'), ('document', 'irat', 'file-text', 'document', 'Irat'),
     ('lock', 'lakat', 'lock', 'lock', 'Jelszó'), ('mail', 'level', 'envelope', 'mail', 'E-mail'), ('check', 'pipa-kor', 'check-circle', 'check', 'Kész'),
     ('info', 'info', 'info', 'info', 'Infó'), ('warning', 'figyelem', 'warning', 'warning', 'Figyelem'), ('question', 'kerdes', 'question', 'question', 'Kérdés'),
     ('shield', 'pajzs', 'shield-check', 'shield', 'Biztonság'), ('card', 'kartya', 'credit-card', 'card', 'Kártya'), ('receipt', 'nyugta', 'receipt', 'receipt', 'Számla'),
     ('upload', 'feltolt', 'cloud-arrow-up', 'upload', 'Feltöltés'), ('clock', 'ora', 'clock', 'clock', 'Várakozás'), ('settings', 'beallitas', 'gear', 'settings', 'Beállítás'),
     ('signout', 'kilep', 'sign-out', 'signout', 'Kilépés'), ('building', 'epulet', 'buildings', 'building', 'Vállalkozás'), ('idcard', 'igazolvany', 'identification-card', 'idcard', 'Igazolvány'),
     ('people', 'emberek', 'users', 'people', 'Alkalmazott'), ('bank', 'bank', 'bank', 'bank', 'Bank'), ('scales', 'jogi', 'scales', 'scales', 'Jogi'),
     ('trend', 'emelkedes', 'trend-up', 'trend', 'Kereset'), ('wallet', 'tarca', 'wallet', 'wallet', 'Félretenni'), ('calculator', 'szamologep', 'calculator', 'calculator', 'Számológép'),
     ('chart', 'oszlopok', 'chart-bar', 'chart', 'Kimutatás')]
# a főoldal egyedi ikonjai -> melyik fogalom
FOOLDAL = {'tarca': 'wallet', 'irat-toll': 'document', 'oszlopok': 'chart', 'naptar-sz': 'calendar', 'buborek': 'chat', 'fooldal': 'house', 'dosszie': 'folder',
           'kamera': 'camera', 'uzenet': 'chat', 'fiok': 'user', 'telefon': 'phone', 'szamologep': 'calculator'}

keszlet = {'phosphor': {}, 'fluent': {}}
for kulcs, v2id, ph, fl, cim in F:
    for nev, fajl in (('phosphor', ph), ('fluent', fl)):
        p = os.path.join(PROBA, nev, fajl + '.svg')
        if os.path.exists(p):
            keszlet[nev][kulcs] = tisztit(p, f'{nev[0]}{kulcs}_')

def js(nev, tartalek=None):
    terkep = {}
    for v2id, kulcs in FOOLDAL.items():
        ik = keszlet[nev].get(kulcs) or (tartalek and keszlet[tartalek].get(kulcs))
        if ik: terkep[v2id] = ik
    for kulcs, v2id, *_ in F:
        ik = keszlet[nev].get(kulcs) or (tartalek and keszlet[tartalek].get(kulcs))
        if ik and v2id not in terkep: terkep[v2id] = ik
    return ('// ' + nev + ' ikonok a v2.js szimbólumai helyett (próba). Forrás: ' + ('@phosphor-icons/core 2.1.1 duotone, MIT' if nev == 'phosphor' else 'microsoft/fluentui-system-icons color, MIT; a hiányzók Phosphorból') + '\n'
            '(function(){var M=' + json.dumps(terkep, ensure_ascii=False) + ';function cs(){for(var k in M){var s=document.getElementById("i-"+k);if(!s)continue;s.setAttribute("viewBox",M[k][0]);s.innerHTML=M[k][1];}}'
            'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",cs);else cs();})();\n')

open(os.path.join(PROBA, 'phosphor.js'), 'w', encoding='utf-8').write(js('phosphor'))
open(os.path.join(PROBA, 'fluent.js'), 'w', encoding='utf-8').write(js('fluent', 'phosphor'))

fo = open(os.path.join(ALAP, '01_fooldal.html'), encoding='utf-8').read()
for nev, cim in (('phosphor', 'Phosphor duotone'), ('fluent', 'Fluent Color')):
    s = fo.replace('<script src="v2.js"></script>', f'<script src="v2.js"></script>\n<script src="_ikon_proba/{nev}.js"></script>', 1)
    s = s.replace('<title>Adózz – Főoldal</title>', f'<title>Adózz – Főoldal ({cim} ikonokkal)</title>')
    open(os.path.join(ALAP, f'01_fooldal_{nev}.html'), 'w', encoding='utf-8').write(s)

# összevető lap: fogalmanként jelenlegi | Phosphor | Fluent
SZIN = ['kek', 'sarga', 'zold', 'narancs', 'lila', 'piros']
sorok = []
for i, (kulcs, v2id, ph, fl, cim) in enumerate(F):
    t = SZIN[i % len(SZIN)]
    def cella(ik, extra=''):
        if not ik: return '<div class="ures">nincs</div>'
        return f'<div class="tile t-{t}{extra}"><svg viewBox="{ik[0]}">{ik[1]}</svg></div>'
    sorok.append(f'<div class="s"><div class="n">{cim}</div><div class="tile t-{t}"><svg><use href="#i-{v2id}"/></svg></div>{cella(keszlet["phosphor"].get(kulcs))}{cella(keszlet["fluent"].get(kulcs), " fl")}</div>')
lap = '''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=390, initial-scale=1"><title>Adózz – ikonkészletek összevetése</title><link rel="stylesheet" href="v2.css">
<style>.s{display:grid;grid-template-columns:1fr 58px 58px 58px;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--vonal)}.s:first-of-type{border-top:0}.n{font-weight:650;font-size:14.5px}
.fej2{display:grid;grid-template-columns:1fr 58px 58px 58px;gap:8px;font-size:12px;font-weight:750;color:var(--szurke);text-align:center;margin:0 0 6px}.fej2 span:first-child{text-align:left}
.s .tile{margin:0 auto}.tile.fl{background:#F1F3F9}.ures{font-size:12px;color:#B42318;text-align:center;font-weight:650}</style></head><body><script src="v2.js"></script>
<header class="fej kis"><div class="allapot"></div><div class="vissza-sor"><span class="logo" data-meret="22"></span></div><h1>Ikonkészletek</h1><p>Balról: a mostani (Material), Phosphor kétszínű, Microsoft Fluent Color.</p></header>
<main class="lap sima"><section class="k blokk"><div class="fej2"><span>Mire való</span><span>Mostani</span><span>Phosphor</span><span>Fluent</span></div>''' + ''.join(sorok) + '''</section>
<p class="megj">Mindkét új készlet MIT licencű: ingyenes, üzleti célra is, forrásmegjelölés nélkül. A Fluent Colorból több ikon hiányzik („nincs”).</p></main></body></html>'''
open(os.path.join(ALAP, 'ikon_osszevetes.html'), 'w', encoding='utf-8').write(lap)
print('phosphor:', len(keszlet['phosphor']), 'fluent:', len(keszlet['fluent']), 'hiányzó fluent:', [k for k, *_ in F if k not in keszlet['fluent']])
