# Ikonpróba 2 (tulaj 11-20: "nincs valami open source MIT icon pack? pl. icons8 color" -> Flat Color Icons (Icons8, MIT) és Fluent Emoji Flat (Microsoft, MIT)).
# A letöltött SVG-k nem megbízható adatok: csak rajzelemek maradnak. Kimenet: _ikon_proba/flatcolor.js, emoji.js, 01_fooldal_flatcolor.html, 01_fooldal_emoji.html, ikon_osszevetes2.html
import os, re, json
import xml.etree.ElementTree as ET

ALAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PROBA = os.path.join(ALAP, '_ikon_proba')
NS = '{http://www.w3.org/2000/svg}'
ENGEDETT = {'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask'}
ATTR = {'d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'transform', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'id', 'clip-path', 'mask', 'fx', 'fy', 'style'}

def tisztit(fajl, elotag):
    fa = ET.parse(fajl).getroot()
    vb = fa.get('viewBox') or f"0 0 {re.sub('[^0-9.]', '', fa.get('width', '48'))} {re.sub('[^0-9.]', '', fa.get('height', '48'))}"
    if not re.fullmatch(r'[\d.\s-]+', vb): vb = '0 0 48 48'
    def elem(e):
        tag = e.tag.replace(NS, '')
        if tag not in ENGEDETT: return ''
        a = []
        for k, v in e.attrib.items():
            k = k.replace(NS, '')
            if k not in ATTR: continue
            if re.search(r'javascript|expression|data:|url\((?!#)', v, re.I): continue
            if k == 'style' and not re.fullmatch(r'[\w\s:;#.,%()-]*', v): continue
            if k == 'id': v = elotag + v
            v = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{elotag}{m.group(1)})', v)
            a.append(f'{k}="{v}"')
        bel = ''.join(elem(c) for c in e)
        return f'<{tag} {" ".join(a)}>{bel}</{tag}>' if tag != 'svg' else bel
    return vb, elem(fa)

F = [('house', 'fooldal', 'Főoldal'), ('folder', 'dosszie', 'Dosszié'), ('camera', 'kamera', 'Fotózás'), ('chat', 'uzenet', 'Üzenetek'), ('user', 'fiok', 'Fiók'),
     ('bell', 'csengo', 'Értesítés'), ('phone', 'telefon', 'Visszahívás'), ('calendar', 'naptar', 'Határidő'), ('document', 'irat', 'Irat'), ('lock', 'lakat', 'Jelszó'),
     ('mail', 'level', 'E-mail'), ('check', 'pipa-kor', 'Kész'), ('info', 'info', 'Infó'), ('warning', 'figyelem', 'Figyelem'), ('question', 'kerdes', 'Kérdés'),
     ('shield', 'pajzs', 'Biztonság'), ('card', 'kartya', 'Kártya'), ('receipt', 'nyugta', 'Számla'), ('upload', 'feltolt', 'Feltöltés'), ('clock', 'ora', 'Várakozás'),
     ('settings', 'beallitas', 'Beállítás'), ('signout', 'kilep', 'Kilépés'), ('building', 'epulet', 'Vállalkozás'), ('idcard', 'igazolvany', 'Igazolvány'),
     ('people', 'emberek', 'Alkalmazott'), ('bank', 'bank', 'Bank'), ('scales', 'jogi', 'Jogi'), ('trend', 'emelkedes', 'Kereset'), ('wallet', 'tarca', 'Félretenni'),
     ('calculator', 'szamologep', 'Számológép'), ('chart', 'oszlopok', 'Kimutatás')]
FOOLDAL = {'tarca': 'wallet', 'irat-toll': 'document', 'oszlopok': 'chart', 'naptar-sz': 'calendar', 'buborek': 'chat', 'fooldal': 'house', 'dosszie': 'folder',
           'kamera': 'camera', 'uzenet': 'chat', 'fiok': 'user', 'telefon': 'phone', 'szamologep': 'calculator'}
NEV = {'flatcolor': 'Flat Color Icons (Icons8, MIT)', 'emoji': 'Fluent Emoji Flat (Microsoft, MIT)'}
# színes ikonokhoz: semleges csempe, az alsó sávban a nem aktív fül szürke, az aktív színes
STILUS = '<style>.tile{background:#F1F3F9!important}.nav button:not(.on) svg{filter:grayscale(1);opacity:.5}.fej-rajz{filter:grayscale(1) brightness(3);opacity:.16}</style>'

keszlet = {}
for nev in NEV:
    keszlet[nev] = {}
    for kulcs, *_ in F:
        p = os.path.join(PROBA, nev, kulcs + '.svg')
        if os.path.exists(p): keszlet[nev][kulcs] = tisztit(p, f'{nev[:2]}{kulcs}_')

for nev, cim in NEV.items():
    terkep = {v2id: keszlet[nev][k] for v2id, k in FOOLDAL.items() if k in keszlet[nev]}
    for kulcs, v2id, _ in F:
        if kulcs in keszlet[nev] and v2id not in terkep: terkep[v2id] = keszlet[nev][kulcs]
    open(os.path.join(PROBA, nev + '.js'), 'w', encoding='utf-8').write(
        f'// {cim}: a v2.js szimbólumai helyett (próba)\n(function(){{var M=' + json.dumps(terkep, ensure_ascii=False) +
        ';function cs(){for(var k in M){var s=document.getElementById("i-"+k);if(!s)continue;s.setAttribute("viewBox",M[k][0]);s.innerHTML=M[k][1];}}'
        'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",cs);else cs();})();\n')
    fo = open(os.path.join(ALAP, '01_fooldal.html'), encoding='utf-8').read()
    fo = fo.replace('<script src="v2.js"></script>', f'<script src="v2.js"></script>\n<script src="_ikon_proba/{nev}.js"></script>', 1)
    fo = fo.replace('</head>', STILUS + '\n</head>', 1).replace('<title>Adózz – Főoldal</title>', f'<title>Adózz – Főoldal ({cim})</title>')
    open(os.path.join(ALAP, f'01_fooldal_{nev}.html'), 'w', encoding='utf-8').write(fo)

SZIN = ['kek', 'sarga', 'zold', 'narancs', 'lila', 'piros']
sorok = []
for i, (kulcs, v2id, cim) in enumerate(F):
    t = SZIN[i % len(SZIN)]
    def cella(ik):
        return '<div class="ures">nincs</div>' if not ik else f'<div class="tile fl"><svg viewBox="{ik[0]}">{ik[1]}</svg></div>'
    sorok.append(f'<div class="s"><div class="n">{cim}</div><div class="tile t-{t}"><svg><use href="#i-{v2id}"/></svg></div>{cella(keszlet["flatcolor"].get(kulcs))}{cella(keszlet["emoji"].get(kulcs))}</div>')
lap = '''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=390, initial-scale=1"><title>Adózz – színes ikonkészletek</title><link rel="stylesheet" href="v2.css">
<style>.s{display:grid;grid-template-columns:1fr 58px 58px 58px;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--vonal)}.s:first-of-type{border-top:0}.n{font-weight:650;font-size:14.5px}
.fej2{display:grid;grid-template-columns:1fr 58px 58px 58px;gap:8px;font-size:12px;font-weight:750;color:var(--szurke);text-align:center;margin:0 0 6px}.fej2 span:first-child{text-align:left}
.s .tile{margin:0 auto}.tile.fl{background:#F1F3F9}.tile.fl svg{width:28px;height:28px}.ures{font-size:12px;color:#B42318;text-align:center;font-weight:650}</style></head><body><script src="v2.js"></script>
<header class="fej kis"><div class="allapot"></div><div class="vissza-sor"><span class="logo" data-meret="22"></span></div><h1>Színes ikonok</h1><p>Balról: a mostani, Flat Color Icons (Icons8), Fluent Emoji Flat (Microsoft).</p></header>
<main class="lap sima"><section class="k blokk"><div class="fej2"><span>Mire való</span><span>Mostani</span><span>Icons8</span><span>Emoji</span></div>''' + ''.join(sorok) + '''</section>
<p class="megj">Mindkét készlet MIT licencű: ingyenes, üzleti célra is, forrásmegjelölés nélkül.</p></main></body></html>'''
open(os.path.join(ALAP, 'ikon_osszevetes2.html'), 'w', encoding='utf-8').write(lap)
print({k: len(v) for k, v in keszlet.items()})
