# Felhasználói próba Geminivel (tulaj 11-20: "nézze át, mintha ő user lenne; mondd el neki, milyen app, milyen szituációban").
# A v2 képernyőket útvonalanként (folyamatonként) mutatjuk meg egy kitalált felhasználónak (persona), aki hangosan gondolkodik.
# Használat (C5_v2-ből): python _eszkoz/user_teszt.py [modell]   Kulcs: HKCU\Environment OPENROUTER_API_KEY (csak a folyamatban).
# Kimenet: _eszkoz/user_teszt/NN_folyamat.json + _osszegzes.json
import base64, glob, io, json, os, re, sys, time, urllib.request, winreg
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

MODELL = sys.argv[1] if len(sys.argv) > 1 else 'google/gemini-3.8-flash'
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
KI = '_eszkoz/user_teszt'; os.makedirs(KI, exist_ok=True)
KULCS = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]

APP = """AZ APP: Adózz.hu – magyar mobilapp átalányadózó egyéni vállalkozóknak. Havi 19 999 Ft-ért saját, valódi (ember) könyvelőt kapsz – a mintában Kovács Bencét –, aki az appon keresztül intézi a könyvelésedet, a bevallásaidat és meghatalmazással a NAV-os ügyeidet. Neked annyi a dolgod, hogy lefotózod vagy feltöltöd a számláidat és irataidat; az app megmutatja, mennyit tegyél félre adóra, mikor mi a határidő, mennyi pénzed marad, és bármikor üzenhetsz a könyvelődnek vagy visszahívást kérhetsz. Ha még nincs vállalkozásod, segít elindítani. A képernyők DIZÁJNMINTÁK kitalált (demo) adatokkal – nem kattinthatók, de úgy nézd őket, mintha az igazi appot használnád."""

PERSONA = """TE: Szabó Péter vagy, 34 éves rendezvényszervező Budapesten. Idén januárban lettél egyéni vállalkozó, átalányadózással; két cégnek (Napfény Étterem Kft., Gyöngyvirág Rendezvényház Kft.) számlázol. Eddig egy ismerős könyvelő intézte papíron: drága volt, lassan válaszolt, és sosem tudtad, mennyit kell félretenned adóra – tavaly egyszer meglepett egy nagy befizetés. Az adózáshoz nem értesz, a NAV-tól kicsit tartasz, a szakszavakat nem szereted. Mindent telefonon intézel, általában este vagy két rendezvény között, sietve. Egy Facebook-hirdetésből töltötted le az appot, és azon gondolkodsz, megéri-e havi 19 999 Ft-ot fizetni érte."""

FOLYAMATOK = [
 ('1_belepes', 'Most töltötted le az appot, és először nyitod meg: regisztrálsz, belépsz, megerősíted az e-mail-címed (és megnézed, mi van, ha elfelejted a jelszavad).', ['10', '11', '15', '12', '13', '14', '16']),
 ('2_bevezeto', 'Regisztráció után az app bevezet: üdvözöl, elmondja, mi vár rád, és elkéri az adószámodat.', ['20', '21', '22', '23', '24', '25']),
 ('3_bekotes', 'Most kötöd be magad: megadod az adataidat, azonosítod magad, előfizetsz, időpontot választasz és elfogadod a szerződést.', ['50', '30', '31', '32', '33', '34', '35', '36']),
 ('4_nav_vallalkozas', 'Meghatalmazást adsz a könyvelődnek a NAV-nál. (Képzeld el azt is, hogy még nem lenne vállalkozásod: az app ebben is végigvezetne.)', ['40', '41', '42', '43', '44', '45', '46', '47']),
 ('5_fooldal_penz', 'Pár hónapja használod. Megnyitod a főoldalt: mennyit tegyél félre, mennyit kerestél, mik a határidők, mit kell fizetni.', ['01', '51', '52', '53', '54', '55', '56', '57']),
 ('6_dosszie', 'Számlákat, nyugtákat fotózol és töltesz fel, megnézed a dossziédat, és igazolást kérsz (pl. albérlethez).', ['60', '61', '62', '63', '64', '65', '66', '67', '68']),
 ('7_uzenetek', 'Kérdésed van: írsz a könyvelődnek, visszahívást kérsz, megnézed a gyakori kérdéseket és a kéréseidet.', ['70', '71', '72', '73', '74', '75', '76']),
 ('8_fiok', 'A fiókodat nézed: adataid, biztonság, díjak és díjszámlák, előfizetés, értesítések, kétlépcsős belépés – és megnézed, hogyan tudnád törölni a fiókod.', ['80', '81', '82', '83', '84', '85', '86', '87', '88', '89']),
 ('9_valtozas_eves', 'Változás történt (pl. költözöl), év vége van (éves zárás, kérdőív), és megnézed, jár-e valami kedvezmény.', ['90', '91', '92', '93', '94', '95', '96', '97', '98']),
]

FELADAT = """Most ezt csinálod: {mit}
Nézd végig az alábbi képernyőket a megadott sorrendben, és gondolkodj hangosan PÉTERKÉNT (nem szakértőként, nem tervezőként): mit értesz azonnal, mit nem, hol akadnál el vagy bizonytalanodnál el, mi hiányzik, mi túl sok, mitől lennél bizalmatlan, mi tetszik, és a végén: ez alapján maradnál-e/fizetnél-e. Légy őszinte és konkrét (idézd a szöveget, ha arról beszélsz). Ne dicsérj udvariasságból. A demo adatok (nevek, összegek) kitaláltak – ezeken ne akadj fenn, csak ha egymásnak ellentmondanak.
Válasz CSAK JSON:
{{"benyomas":"<2-4 mondat Péter hangján>",
 "kepernyok":[{{"kepernyo":"<fájlnév>","gondolatok":"<Péter hangos gondolkodása, 1-3 mondat>",
   "gondok":[{{"mi":"<konkrét gond>","sulyossag":"elakadok"|"zavar"|"apro","javaslat":"<mit szeretne Péter helyette>"}}],
   "tetszik":["<rövid>"]}}],
 "hianyzik":["<amit ebben a részben keresett, de nem talált>"],
 "maradnek":"<igen/talán/nem + 1 mondat miért>"}}"""

def kep(nev):
    im = Image.open(nev).convert('RGB')
    w = 585; im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=82, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

def hiv(uzenetek, max_tok=12000):
    test = json.dumps({'model': MODELL, 'messages': uzenetek, 'temperature': 0.4, 'max_tokens': max_tok, 'response_format': {'type': 'json_object'}, 'reasoning': {'effort': 'low'}}).encode()
    hiba = ''
    for prob in range(3):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                headers={'Authorization': 'Bearer ' + KULCS, 'Content-Type': 'application/json', 'X-Title': 'Adozz user teszt'})
            d = json.load(urllib.request.urlopen(req, timeout=300))
            t = re.sub(r'^```(?:json)?|```$', '', d['choices'][0]['message']['content'].strip(), flags=re.M).strip()
            return json.loads(t), d.get('usage', {})
        except urllib.error.HTTPError as e:
            hiba = f'HTTP {e.code}: {e.read()[:300]!r}'
            if e.code in (402, 401, 403): break
        except Exception as e:
            hiba = f'{type(e).__name__}: {str(e)[:200]}'
        time.sleep(4 * (prob + 1))
    return {'hiba': hiba}, {}

def folyamat(f):
    nev, mit, szamok = f
    tartalom = [{'type': 'text', 'text': FELADAT.format(mit=mit) + '\n\nA képernyők sorban:'}]
    fajlok = []
    for sz in szamok:
        for p in sorted(glob.glob(f'{sz}_*.png')):
            fajlok.append(p)
            tartalom.append({'type': 'text', 'text': f'Képernyő: {p[:-4]}'})
            tartalom.append({'type': 'image_url', 'image_url': {'url': kep(p)}})
    e, u = hiv([{'role': 'system', 'content': APP + '\n\n' + PERSONA}, {'role': 'user', 'content': tartalom}])
    e['folyamat'] = nev; e['fajlok'] = fajlok; e['usage'] = u
    json.dump(e, open(f'{KI}/{nev}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return e

with ThreadPoolExecutor(5) as ex:
    eredm = list(ex.map(folyamat, FOLYAMATOK))

jo = [e for e in eredm if 'hiba' not in e]
ossz, u2 = hiv([{'role': 'system', 'content': APP + '\n\n' + PERSONA},
    {'role': 'user', 'content': 'Végigmentél az egész appon. Itt vannak a saját jegyzeteid részenként (JSON):\n' + json.dumps([{k: e.get(k) for k in ('folyamat', 'benyomas', 'kepernyok', 'hianyzik', 'maradnek')} for e in jo], ensure_ascii=False) +
     '\n\nPéterként foglald össze: összbenyomás; a 10 legfontosabb gond fontossági sorrendben (ami miatt elakadnál vagy nem fizetnél); a 5 legjobb dolog; mi hiányzik leginkább; fizetnél-e havi 19 999 Ft-ot és miért. Válasz CSAK JSON: {"osszbenyomas":"...","top_gondok":[{"mi":"...","hol":"<képernyő(k)>","miert_fontos":"...","javaslat":"..."}],"legjobb":["..."],"hianyzik":["..."],"fizetnek":"igen/talán/nem + indoklás"}'}], max_tok=6000)
ossz['usage'] = u2
json.dump(ossz, open(f'{KI}/_osszegzes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
koltseg = sum(float(e.get('usage', {}).get('cost', 0) or 0) for e in eredm) + float(u2.get('cost', 0) or 0)
print(f'modell {MODELL}; folyamat ok: {len(jo)}/{len(eredm)}; hibák: {[e["folyamat"] + ": " + e["hiba"][:120] for e in eredm if "hiba" in e] or "nincs"}; összegzés: {"hiba" not in ossz}; költség: {koltseg:.3f} $')
