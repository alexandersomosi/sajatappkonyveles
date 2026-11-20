# Az összes levél- és értesítésszöveg átnézése Geminivel "kívülről" (tulaj 11-20: "érthető-e kívülről").
# Forrás: szovegek.json (a backend email.*/notif.* szövegei), ../LEVEL_LEFEDETTSEG.md 3. pont (javasolt új levelek), ../0N_*.html (mintalevelek).
# Kulcs: HKCU\Environment OPENROUTER_API_KEY (csak a folyamatban). Kimenet: atnezes_*.json + _osszes.json.
import glob, html, json, os, re, sys, time, urllib.request, winreg
from concurrent.futures import ThreadPoolExecutor
ITT = os.path.dirname(os.path.abspath(__file__)); os.chdir(ITT)
MODELL = sys.argv[1] if len(sys.argv) > 1 else 'google/gemini-3.8-flash'
KULCS = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]

# 1) a backend szövegei csoportosítva (cím/tárgy + törzs)
d = json.load(open('szovegek.json', encoding='utf-8'))
csop = {}
for k, v in d.items():
    m = re.match(r'^(.*)\.(subject|body|title|title_tobb|footer|magansz)$', k)
    alap, resz = (m.group(1), m.group(2)) if m else (k, 'szoveg')
    csop.setdefault(alap, {})[resz] = v
tetelek = []
for alap, r in csop.items():
    kinek = 'könyvelő/munkatárs' if re.search(r'staff|accountant|konyvelo|digest|csapat', alap) else 'ügyfél'
    tetelek.append({'kulcs': alap, 'kinek': kinek, 'forras': 'e-mail' if alap.startswith('email.') else 'értesítés (push/app, néha e-mail is)',
                    'cim': r.get('subject') or r.get('title') or '', 'szoveg': '\n'.join(v for kk, v in r.items() if kk not in ('subject', 'title'))})
# 2) a javasolt új levelek (LEVEL_LEFEDETTSEG.md 3. pont)
md = open('../LEVEL_LEFEDETTSEG.md', encoding='utf-8').read()
m3 = md.split('## 3.', 1)[1].split('## 4.', 1)[0] if '## 3.' in md else ''
for i, blokk in enumerate(re.split(r'\n(?=\d+\.|\- \*\*|#### )', m3)):
    if len(blokk.strip()) > 40:
        tetelek.append({'kulcs': f'javasolt_{i:02d}', 'kinek': 'ügyfél vagy könyvelő (lásd szöveg)', 'forras': 'JAVASOLT új e-mail', 'cim': '', 'szoveg': blokk.strip()[:1500]})
# 3) a mintalevelek (dizájn)
for f in sorted(glob.glob('../0[1-6]_*.html')):
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'<(style|script|head)\b.*?</\1>', ' ', s, flags=re.S | re.I)
    t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '\n', s))).strip()
    tetelek.append({'kulcs': 'minta_' + os.path.basename(f)[:-5], 'kinek': 'ügyfél', 'forras': 'mintalevél (új dizájn)', 'cim': '', 'szoveg': t[:2000]})

APP = """Az Adózz.hu egy magyar mobilapp átalányadózó egyéni vállalkozóknak: havi 19 999 Ft-ért saját, valódi könyvelőt kapnak (a mintában Kovács Bence), aki intézi a könyvelést, a bevallásokat és meghatalmazással a NAV-os ügyeket. Az ügyfél lefotózza a számláit, az app megmondja, mennyit tegyen félre adóra, mikor mi a határidő; üzenhet a könyvelőnek, visszahívást kérhet. Fizetés kártyával vagy átutalással (díjbekérő). A könyvelők egy panelt használnak."""
SZEREP = """Az alábbi rendszerüzeneteket kívülállóként olvasod: az ügyfélnek szólókat úgy, mint Szabó Péter (34, rendezvényszervező, idén lett átalányadós EV, az adózáshoz nem ért, a szakszavakat nem szereti, telefonon olvas, sietve); a könyvelőnek szólókat úgy, mint egy új könyvelő munkatárs, aki most kezdte használni a panelt. A {kapcsos} helyőrzők helyére a rendszer automatikusan beírja az adatot (név, összeg, dátum stb.) – ezeken ne akadj fenn, csak ha a mondat a behelyettesítés után is rosszul hangzana."""
FELADAT = """Minden üzenetnél döntsd el: első olvasásra ÉRTHETŐ-e, kiderül-e belőle, MI történt, MIT kell tenni (ha kell), és MEDDIG; nincs-e benne érthetetlen szakszó vagy belső zsargon (pl. "bekötés", "meghatalmazás" magyarázat nélkül), kétértelműség, ijesztő vagy hideg hang, hiányzó következő lépés; magyaros-e. Ne javasolj időígéretet (kivéve: "A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között."), ne említs mesterséges intelligenciát.
Csak azokat sorold fel, ahol gond van (az érthetőeket hagyd ki). Válasz CSAK JSON:
{"gondok":[{"kulcs":"...","ertheto":"részben"|"nem","mi_a_gond":"<rövid, Péter/új könyvelő szemével>","javitott_cim":"<ha kell, a helyőrzőkkel>","javitott_szoveg":"<rövid, tegező, magyaros, helyőrzőkkel>","sulyossag":"fontos"|"apró"}],
 "osszbenyomas":"<2-3 mondat erről a csomagról>"}"""

def hiv(uz):
    test = json.dumps({'model': MODELL, 'messages': uz, 'temperature': 0.3, 'max_tokens': 14000, 'response_format': {'type': 'json_object'}, 'reasoning': {'effort': 'low'}}).encode()
    hiba = ''
    for prob in range(3):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test, headers={'Authorization': 'Bearer ' + KULCS, 'Content-Type': 'application/json', 'X-Title': 'Adozz level-atnezes'})
            r = json.load(urllib.request.urlopen(req, timeout=300))
            t = re.sub(r'^```(?:json)?|```$', '', r['choices'][0]['message']['content'].strip(), flags=re.M).strip()
            return json.loads(t), r.get('usage', {})
        except urllib.error.HTTPError as e:
            hiba = f'HTTP {e.code}'
            if e.code in (401, 402, 403): break
        except Exception as e:
            hiba = f'{type(e).__name__}: {str(e)[:150]}'
        time.sleep(4 * (prob + 1))
    return {'hiba': hiba}, {}

CS = 25
csomagok = [tetelek[i:i + CS] for i in range(0, len(tetelek), CS)]
def fut(i_cs):
    i, cs = i_cs
    e, u = hiv([{'role': 'system', 'content': APP + '\n\n' + SZEREP}, {'role': 'user', 'content': FELADAT + '\n\nAZ ÜZENETEK (JSON):\n' + json.dumps(cs, ensure_ascii=False)}])
    e['csomag'] = i; e['usage'] = u
    json.dump(e, open(f'atnezes_{i:02d}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return e
with ThreadPoolExecutor(5) as ex:
    er = list(ex.map(fut, enumerate(csomagok)))
gondok = [g for e in er for g in e.get('gondok', [])]
json.dump({'tetelek': len(tetelek), 'gondok': gondok, 'osszbenyomas': [e.get('osszbenyomas') for e in er], 'hibak': [e.get('hiba') for e in er if 'hiba' in e]},
          open('_osszes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
koltseg = sum(float(e.get('usage', {}).get('cost', 0) or 0) for e in er)
print(f'tétel: {len(tetelek)}, csomag: {len(csomagok)}, gond: {len(gondok)} (fontos: {sum(1 for g in gondok if g.get("sulyossag") == "fontos")}), hibás csomag: {[e.get("hiba") for e in er if "hiba" in e] or "nincs"}, költség: {koltseg:.3f} $')
