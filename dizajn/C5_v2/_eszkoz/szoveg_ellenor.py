# Szövegellenőrzés a v2 képernyőkön OpenRouterrel (tulaj 11-20: "értelmes-e mind és magyaros-e").
# Használat (a C5_v2 mappából): python _eszkoz/szoveg_ellenor.py [modell]
# Kulcs: HKCU\Environment OPENROUTER_API_KEY (csak a folyamatban, sehova nem írjuk ki).
# Kimenet: _eszkoz/szoveg/NN_nev.txt (kinyert szöveg), NN_nev.json (javaslatok), _osszes.json, _egyseg.json (képernyőkön átívelő egységesség).
import glob, html, json, os, re, sys, time, urllib.request, winreg
from concurrent.futures import ThreadPoolExecutor

MODELL = sys.argv[1] if len(sys.argv) > 1 else 'google/gemini-3.8-flash'
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
KI = '_eszkoz/szoveg'
os.makedirs(KI, exist_ok=True)
KULCS = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]

BLOKK = r'(div|p|h1|h2|h3|li|button|label|section|header|main|nav|a|span class="(?:cimke|c|a|d|jobb|osszeg|nagy|ido)[^"]*")'

def szoveg(fajl):
    s = open(fajl, encoding='utf-8').read()
    s = re.sub(r'<(script|style|svg)\b.*?</\1>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<title>.*?</title>', ' ', s, flags=re.S)
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'</?(div|p|h1|h2|h3|li|button|label|section|header|main|nav|footer|span class="(?:c|a|d|cimke|jobb)")\b[^>]*>', '\n', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s).replace(' ', ' ')
    sorok, elozo = [], None
    for l in s.split('\n'):
        l = re.sub(r'\s+', ' ', l).strip()
        if not l or l == elozo or l in ('9:41',) or re.fullmatch(r'[\d\s·•.,:/-]{1,6}', l):
            continue
        sorok.append(l); elozo = l
    return sorok

UTASITAS = """Magyar anyanyelvű szövegszerkesztő vagy. Egy magyar mobilapp (Adózz.hu: átalányadózó egyéni vállalkozóknak, saját könyvelővel; tegező, közvetlen, egyszerű hang) egy képernyőjének szövegeit kapod, soronként számozva.
Feladat: keresd meg, ami NEM értelmes vagy NEM magyaros:
- helyesírási, nyelvtani, ragozási, egyeztetési hiba; rossz vessző;
- tükörfordítás-ízű, idegen, körülményes vagy hivatalos-merev mondat, amit magyar ember nem így mondana;
- érthetetlen, kétértelmű vagy logikailag zavaros mondat; egymásnak ellentmondó állítás ugyanazon a képernyőn;
- tegezés/magázás keveredése; furcsa szóhasználat (pl. szakszó rossz helyen).
NE javasold: számok, összegek, dátumok, nevek, cégnevek, e-mail-címek, adószámok megváltoztatását; jogi/adózási tartalom megváltoztatását; ízlésbeli apróságot, ami már jó; hosszabbítást. Ne javasolj időígéretet ("X órán belül válaszol") és ne említs mesterséges intelligenciát.
Szakszavak, amik HELYESEK így: átalányadó, alanyi ÁFA-mentesség, szja-előleg, TB-járulék, szocho, iparűzési adó, Ügyfélkapu+, DÁP, NAV, meghatalmazás, kamarai hozzájárulás, kétlépcsős belépés, díjszámla, dosszié.
Az "eredeti" mező a sor szövegének PONTOS, betűhű részlete legyen (a legrövidebb részlet, ami a javítandót tartalmazza), a "javitott" ennek a cseréje.
Válasz CSAK JSON: {"javaslatok":[{"sor":<szám>,"eredeti":"...","javitott":"...","ok":"<rövid magyar indoklás>","sulyossag":"hiba"|"javasolt"}]}
"hiba" = helyesírási/nyelvtani hiba vagy értelmetlen/félreérthető mondat; "javasolt" = érthető, de nem magyaros/nem természetes. Ha minden rendben, üres lista."""

def hiv(uzenetek, max_tok=6000):
    test = json.dumps({'model': MODELL, 'messages': uzenetek, 'temperature': 0.2, 'max_tokens': max_tok, 'response_format': {'type': 'json_object'}}).encode()
    for prob in range(4):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                headers={'Authorization': 'Bearer ' + KULCS, 'Content-Type': 'application/json', 'X-Title': 'Adozz szovegellenorzes'})
            d = json.load(urllib.request.urlopen(req, timeout=180))
            tart = d['choices'][0]['message']['content']
            tart = re.sub(r'^```(?:json)?|```$', '', tart.strip(), flags=re.M).strip()
            return json.loads(tart), d.get('usage', {})
        except Exception as e:
            hiba = f'{type(e).__name__}: {str(e)[:200]}'
            time.sleep(3 * (prob + 1))
    return {'hiba': hiba}, {}

def egy(fajl):
    nev = os.path.basename(fajl)[:-5]
    sorok = szoveg(fajl)
    open(f'{KI}/{nev}.txt', 'w', encoding='utf-8').write('\n'.join(f'{i+1}. {l}' for i, l in enumerate(sorok)))
    eredm, hasz = hiv([{'role': 'system', 'content': UTASITAS}, {'role': 'user', 'content': f'Képernyő: {nev}\n\n' + '\n'.join(f'{i+1}. {l}' for i, l in enumerate(sorok))}])
    eredm['kepernyo'] = nev; eredm['usage'] = hasz
    for j in eredm.get('javaslatok', []):
        try: j['sor_szoveg'] = sorok[int(j['sor']) - 1]
        except Exception: j['sor_szoveg'] = ''
        j['pontos'] = bool(j.get('eredeti')) and j['eredeti'] in j.get('sor_szoveg', '')
    json.dump(eredm, open(f'{KI}/{nev}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return nev, sorok, eredm

fajlok = sorted(f for f in glob.glob('[0-9][0-9]_*.html'))
with ThreadPoolExecutor(6) as ex:
    eredmenyek = list(ex.map(egy, fajlok))

# képernyőkön átívelő egységesség (szóhasználat, megszólítás, gombfeliratok)
mind = '\n\n'.join(f'### {n}\n' + '\n'.join(s) for n, s, _ in eredmenyek)
egyseg, hasz2 = hiv([{'role': 'system', 'content': 'Magyar anyanyelvű szövegszerkesztő vagy. Egy magyar mobilapp összes képernyőjének szövegét kapod (### a képernyő neve). Keresd a képernyők KÖZÖTTI következetlenséget: ugyanarra a dologra más-más szó (pl. kétféle név egy funkcióra), eltérő gombfelirat ugyanarra a műveletre, tegezés/magázás keveredése, eltérő írásmód (pl. ÁFA/áfa, e-mail/email, nagybetűzés). Számokat, összegeket, neveket ne javíts. Válasz CSAK JSON: {"egyseg":[{"tema":"...","valtozatok":["...","..."],"kepernyok":["..."],"javaslat":"melyik legyen mindenhol és miért (rövid)"}]}'},
                       {'role': 'user', 'content': mind}], max_tok=8000)
egyseg['usage'] = hasz2
json.dump(egyseg, open(f'{KI}/_egyseg.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

osszes = [e for _, _, e in eredmenyek]
json.dump(osszes, open(f'{KI}/_osszes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
jav = [j for e in osszes for j in e.get('javaslatok', [])]
hibas = [e['kepernyo'] for e in osszes if 'hiba' in e]
tok_in = sum(e['usage'].get('prompt_tokens', 0) for e in osszes) + hasz2.get('prompt_tokens', 0)
tok_out = sum(e['usage'].get('completion_tokens', 0) for e in osszes) + hasz2.get('completion_tokens', 0)
koltseg = sum(float(e['usage'].get('cost', 0) or 0) for e in osszes) + float(hasz2.get('cost', 0) or 0)
print(f'modell: {MODELL}; képernyő: {len(osszes)}; javaslat: {len(jav)} (hiba: {sum(1 for j in jav if j.get("sulyossag")=="hiba")}, pontos egyezés: {sum(1 for j in jav if j.get("pontos"))}); egységesség-tétel: {len(egyseg.get("egyseg", []))}')
print(f'token be/ki: {tok_in}/{tok_out}; költség (OpenRouter szerint): {koltseg:.4f} $; sikertelen: {hibas or "nincs"}')
