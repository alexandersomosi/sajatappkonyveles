# A tulaj választása (11-20): "Emoji jobb, Microsoft, arra cseréld mindenhol" -> a v2.js tartalmi ikonjai Microsoft Fluent Emoji Flat (MIT) rajzok lesznek.
# A kezelőelemek (vissza, nyíl, bezár, plusz, küld, letölt, szem, pipa, keresés, gemkapocs) és a Google "G" maradnak.
# A letöltött SVG-k (_ikon_proba/emoji) nem megbízható adatok: csak rajzelemek maradnak (ikon_proba2.tisztit).
import os, json, re, shutil, importlib.util
ITT = os.path.dirname(os.path.abspath(__file__)); ALAP = os.path.join(ITT, '..')
spec = importlib.util.spec_from_file_location('ip2', os.path.join(ITT, 'ikon_proba2.py'))
src = open(os.path.join(ITT, 'ikon_proba2.py'), encoding='utf-8').read().split('F = [')[0]   # csak a tisztító rész kell
ns = {'__file__': os.path.join(ITT, 'ikon_proba2.py')}; exec(src, ns); tisztit = ns['tisztit']

T = {'fooldal': 'house', 'dosszie': 'folder', 'kamera': 'camera', 'uzenet': 'chat', 'fiok': 'user', 'csengo': 'bell', 'telefon': 'phone',
     'naptar': 'calendar', 'naptar-sz': 'calendar', 'irat': 'document', 'irat-toll': 'memo', 'lakat': 'lock', 'level': 'mail', 'pipa-kor': 'check',
     'info': 'info', 'figyelem': 'warning', 'kerdes': 'question', 'pajzs': 'shield', 'kartya': 'card', 'nyugta': 'receipt', 'feltolt': 'upload',
     'ora': 'hourglass', 'beallitas': 'settings', 'kilep': 'signout', 'epulet': 'building', 'igazolvany': 'idcard', 'toll': 'pen', 'emberek': 'people',
     'cimke': 'label', 'valtozas': 'refresh', 'kuka': 'trash', 'bank': 'bank', 'jogi': 'scales', 'kep': 'picture', 'vaku': 'flash', 'kulcs': 'key',
     'mobil': 'mobile', 'lejatszas': 'play', 'kerdoiv': 'clipboard', 'emelkedes': 'trend', 'oszlop': 'chart', 'oszlopok': 'chart', 'tarca': 'moneybag',
     'buborek': 'chat', 'szamologep': 'calculator'}
EM = {}
for v2id, k in T.items():
    p = os.path.join(ALAP, '_ikon_proba', 'emoji', k + '.svg')
    if not os.path.exists(p): raise SystemExit('hiányzik: ' + k)
    EM[v2id] = tisztit(p, f'em{re.sub("[^a-z0-9]", "", v2id)}_')

ment = os.path.join(ALAP, '_regi', 'elotte_emoji_1120'); os.makedirs(ment, exist_ok=True)
for f in ('v2.js', 'v2.css'):
    if not os.path.exists(os.path.join(ment, f)): shutil.copy2(os.path.join(ALAP, f), os.path.join(ment, f))

js = open(os.path.join(ment, 'v2.js'), encoding='utf-8').read()   # mindig az eredetiből építünk
r1 = "  for (var k in P) sym += '<symbol id=\"i-' + k + '\" viewBox=\"0 0 24 24\"><path d=\"' + P[k] + '\"/></symbol>';"
r2 = "  for (var e in EGYEDI) sym += '<symbol id=\"i-' + e + '\" viewBox=\"0 0 24 24\">' + EGYEDI[e] + '</symbol>';"
assert r1 in js and r2 in js, 'a v2.js szerkezete változott'
emoji = ('  // Tartalmi ikonok: Microsoft Fluent Emoji Flat (MIT, github.com/microsoft/fluentui-emoji) - a tulaj választása 11-20.\n'
         '  var EMOJI = ' + json.dumps(EM, ensure_ascii=False) + ';\n')
js = js.replace(r1, emoji + r1.replace(" sym +=", " if (!EMOJI[k]) sym +=")).replace(r2, r2.replace(" sym +=", " if (!EMOJI[e]) sym +=") +
     "\n  for (var m in EMOJI) sym += '<symbol id=\"i-' + m + '\" viewBox=\"' + EMOJI[m][0] + '\">' + EMOJI[m][1] + '</symbol>';")
js = js.replace('// Az egyszínű ikonok a Material Icons (Apache 2.0) útvonalai;', '// A tartalmi ikonok Microsoft Fluent Emoji Flat rajzok (MIT); a kezelőelemek a Material Icons (Apache 2.0) útvonalai;')
open(os.path.join(ALAP, 'v2.js'), 'w', encoding='utf-8').write(js)

css = open(os.path.join(ment, 'v2.css'), encoding='utf-8').read()
css += '''
/* ---------- Emoji-ikonok (tulaj 11-20: Microsoft Fluent Emoji Flat mindenhol) ----------
   A színes rajzok semleges csempén mutatnak jól; az alsó sávban a nem aktív fül szürke, az aktív színes;
   beviteli mezőben és a fejléc háttérrajzán szürkék, hogy ne vegyék el a figyelmet. */
.tile { background: #F1F3F9 !important; }
.tile svg { width: 26px; height: 26px; }
.tile.kicsi svg { width: 22px; height: 22px; }
.tile.nagy svg { width: 38px; height: 38px; }
.nav button:not(.on) svg { filter: grayscale(1); opacity: .5; }
.fej-rajz { filter: grayscale(1) brightness(3); opacity: .16; }
.mezo svg { filter: grayscale(1); opacity: .6; }
.seg .buborek-ikon svg { filter: drop-shadow(0 1px 1px rgba(16,21,43,.18)); }
'''
open(os.path.join(ALAP, 'v2.css'), 'w', encoding='utf-8').write(css)
print('emoji ikonok:', len(EM), '| v2.js', len(js) // 1024, 'KB')
