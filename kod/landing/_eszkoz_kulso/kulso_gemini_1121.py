# Külső szemű átnézés (tulaj 11-21: "kívülről érteni lehet-e mindent"): kod/landing/dist (telt színes változat), 4 vevő + 1 szakember, Gemini (OpenRouter).
# Bemenet: kulso_1121/ (kulso_kep.cjs: telefon_0N.jpg 8 db, gep_0N.jpg 6 db, szoveg_gep.json, *.log a szeletek helyével).
# Kulcs: HKCU\Environment OPENROUTER_API_KEY, csak a folyamatban (soha nem kerül fájlba/naplóba). Keret: összesen 0,08 $.
# Kimenet: kod/landing/_eszkoz_kulso/gemini_kulso_2026-11-21.json
import base64, datetime, json, os, re, sys, time, urllib.error, urllib.request, winreg

ITT = os.path.dirname(os.path.abspath(__file__))
BE = os.path.join(ITT, 'kulso_1121')
KI_MAPPA = 'C:/Users/UpgradePC/konyvelo_app/kod/landing/_eszkoz_kulso'
KI = KI_MAPPA + '/gemini_kulso_2026-11-21.json'
MODELL = 'google/gemini-3.8-flash'
KERET = 0.08
PROBA = '--proba' in sys.argv

NEVEK = {'fejlec': '1. FEJLÉC', 'hos': '2. ELSŐ KÉPERNYŐ (hős)', 'bizalom': '3. „RÖVIDEN RÓLUNK” SÁV', 'kinek': '4. KINEK SZÓL',
         'hogyan': '5. „ÍGY INDUL A KÖNYVELÉSED”', 'mit-kapsz': '6. „MINDIG LÁTOD, MENNYIT TEGYÉL FÉLRE ADÓRA” (görgetős bemutató, 8 lépés)',
         'konyvelo': '7. „KI KÖNYVEL NEKED?”', 'biztonsag': '8. MEGHATALMAZÁS ÉS ADATOK', 'arak': '9. ÁRAK', 'osszevetes': '10. ÖSSZEVETÉS',
         'gyik': '11. GYIK (lenyitható kérdések)', 'visszahivas': '12. ZÁRÓ FELHÍVÁS', 'lablec': '13. LÁBLÉC'}


def tisztit(szakasz, t):
    sorok = t.split('\n')
    if szakasz == 'mit-kapsz':   # a színpad felugró értesítései a lépéseknél újra szerepelnek: a színpad blokkja kimarad
        try:
            a = sorok.index('app.adozz.hu'); b = sorok.index('-', a)
            sorok = sorok[:a] + ['[a telefon a bemutató színpadán: képernyője és felugró értesítései lépésenként váltanak, lásd a lépéseknél]'] + sorok[b:]
        except ValueError:
            pass
    ki = []
    for s in sorok:
        s = s.strip()
        if ki and ki[-1] in ('-', '###', '##', '#'):
            ki[-1] = ki[-1] + ' ' + s
        elif s:
            ki.append(s)
    return '\n'.join(ki)


def oldal():
    d = json.load(open(os.path.join(BE, 'szoveg_gep.json'), encoding='utf-8'))
    return [{'szakasz': NEVEK.get(b['szakasz'], b['szakasz']), 'szoveg': tisztit(b['szakasz'], b['szoveg'])} for b in d]


def kepek():
    ki = []
    for nev, log, felirat in (('telefon', 'telefon.log', 'TELEFON (390 px széles kijelző)'), ('gep', None, 'GÉP (1440 px széles böngésző)')):
        helyek = None
        if log:
            helyek = json.loads(open(os.path.join(BE, log), encoding='utf-8').read().strip().splitlines()[-1])['helyek']
        else:
            helyek = GEP_HELYEK
        for h in helyek:
            f = os.path.join(BE, f'{nev}_{h["n"]:02d}.jpg')
            b = open(f, 'rb').read()
            cim = f'{felirat}, {h["n"]}/{len(helyek)}. szelet: ' + ', '.join(NEVEK.get(s, s).split(' ', 1)[1] if ' ' in NEVEK.get(s, s) else s for s in h['szakaszok'])
            ki.append({'cim': cim, 'fajl': os.path.basename(f), 'kb': len(b) // 1024, 'url': 'data:image/jpeg;base64,' + base64.b64encode(b).decode()})
    return ki


# a gépi futás kimenete (kulso_kep.cjs, 1440 px, 6 szelet)
GEP_HELYEK = [{"n": 1, "szakaszok": ["fejlec", "hos", "bizalom", "kinek"]}, {"n": 2, "szakaszok": ["hogyan", "mit-kapsz"]},
              {"n": 3, "szakaszok": ["mit-kapsz", "konyvelo"]}, {"n": 4, "szakaszok": ["konyvelo", "biztonsag", "arak"]},
              {"n": 5, "szakaszok": ["arak", "osszevetes", "gyik"]}, {"n": 6, "szakaszok": ["gyik", "visszahivas", "lablec"]}]

RENDSZER = """Egy magyar weboldalt mutatunk neked: az Adózz.hu értékesítő (nyitó)oldalát, ahogy egy idegen látja, aki egy hirdetésről vagy keresésből érkezik. A termékről SEMMI mást nem tudsz, csak amit az oldalon látsz és olvasol: ne egészítsd ki saját szakmai tudással, és ne találgasd jóindulatúan, mit akart mondani a készítő. Ha valami nem derül ki, vagy nem érted, mondd ki.
A KÉPEKRŐL: telefonos (390 px széles kijelző) és gépi (1440 px széles böngésző) képernyőkép-szeletek, fentről lefelé, az egész oldal. Élőben két rész mozog: (1) fent a telefonon és a gépen az app képernyői váltakoznak (főoldal, dosszié, fotózás, üzenetek); (2) a „Mindig látod, mennyit tegyél félre adóra” szakasz görgetésre lépésenként vált (8 lépés: Számlák, Félretenni, Határidők, Fotózás, Dosszié, Üzenetek, Keretek, Böngészőben): a telefon képernyője vált, és kis értesítések ugranak fel rajta. A telefonos képen ez a szakasz az első lépésen áll, a többi lépés szövege a szövegkivonatban van. A GYIK kérdései élőben lenyithatók, a kivonatban a válaszok is ott vannak. A [kép: …] jelölés a kép leírása, nem látható felirat. Az app képernyőin bemutató adatok vannak (ezt az oldal is kiírja).
SZABÁLYOK: magyarul, őszintén, kritikusan, a megadott szerep szemével és szavaival (E/1). Ne dicsérj udvariasságból. Ahol az oldalról idézel, BETŰRE PONTOSAN idézz a szövegkivonatból. Ha szöveget javasolsz, ne találj ki új tényt, árat, funkciót, határidőt vagy véleményt. Tömören: minden szöveges mező legfeljebb 1–2 mondat."""

KERDESEK = """Nézd végig az oldalt (a teljes látható szöveg szakaszonként + a képszeletek) a TE szemeddel.
1) 5 másodperc után (csak az első képernyő alapján) mit gondolsz, mi ez, és kinek szól?
2) Mit kapsz a havidíjért, és mit csinál az app? Mi kerül külön pénzbe?
3) Mit NEM értesz? Idézd pontosan a mondatot, szót vagy rövidítést (pl. ONYA, NAV-meghatalmazás, átalány, kata-keret, szocho, iparűzési adó, éves zárás, alanyi áfamentes, DÁP, Ügyfélkapu+, NAV Online Számla, dosszié – csak ami TÉNYLEG gondot okoz neked, és ami még ezeken kívül).
4) Mi győzne meg, mi tart vissza, és mi hiányzik a döntéshez?
5) Bízol-e benne, és miért?
6) Mely rész zavaros, túl hosszú vagy ismétlődő?"""

JSON_VEVO = """Válasz CSAK JSON, tömören (a listák legfeljebb a jelzett elemszámúak):
{"perszona":"<név>",
 "ot_masodperc":{"mi_ez_szerintem":"...","kinek_szol":"...","nekem_szol":"igen"|"részben"|"nem","eltalalta":"igen"|"részben"|"nem"},
 "havidij":{"erti":"igen"|"részben"|"nem","mit_kapok_a_havidijert":"...","mit_csinal_az_app":"...","mi_kerul_kulon":"...","ami_homalyos":"..."},
 "nem_ertem":[{"idezet":"<PONTOS szó/mondat>","szakasz":"...","miert":"...","javaslat":"<rövid új szöveg vagy null>"}],   (max 6, a legfontosabb elöl)
 "meggyozne":[{"mi":"...","idezet":"<pontos mondat vagy null>"}],   (max 3)
 "visszatart":[{"mi":"...","idezet":"<pontos mondat vagy null>"}],   (max 3)
 "hianyzik_a_donteshez":["..."],   (max 3)
 "bizalom":{"pont_1_10":<szám>,"miert":"..."},
 "zavaros_hosszu_ismetlodo":[{"hol":"<szakasz>","tipus":"zavaros"|"túl hosszú"|"ismétlődő","idezet":"<pontos részlet>","miert":"..."}],   (max 4)
 "mit_tennek":"regisztrálnék"|"előbb visszahívást kérnék"|"elmenteném későbbre"|"elmennék","miert":"<1 mondat, E/1>"}"""

JSON_SZAKEMBER = """Válasz CSAK JSON, tömören (a listák legfeljebb a jelzett elemszámúak):
{"perszona":"<név>",
 "ot_masodperc":{"mi_ez_egy_latogato_szerint":"...","kinek_szol":"...","eltalalja_e":"igen"|"részben"|"nem","miert":"..."},
 "havidij":{"ertheto":"igen"|"részben"|"nem","mit_kap_a_havidijert_a_latogato_szerint":"...","mit_csinal_az_app":"...","mi_kerul_kulon":"...","ami_homalyos":"..."},
 "nem_ertheto":[{"idezet":"<PONTOS szó/mondat>","szakasz":"...","miert":"...","javaslat":"<rövid új szöveg vagy null>"}],   (max 7, a legfontosabb elöl)
 "meggyozne":[{"mi":"...","idezet":"<pontos mondat vagy null>"}],   (max 3)
 "visszatart":[{"mi":"...","idezet":"<pontos mondat vagy null>"}],   (max 3)
 "hianyzik_a_donteshez":["..."],   (max 3)
 "bizalom":{"pont_1_10":<szám>,"miert":"..."},
 "zavaros_hosszu_ismetlodo":[{"hol":"<szakasz>","tipus":"zavaros"|"túl hosszú"|"ismétlődő","idezet":"<pontos részlet>","miert":"..."}],   (max 5)
 "szakmai":{"elrendezes":["..."],"hierarchia":["..."],"cta":["..."],"szinek":["..."],"telefon_vs_gep":["..."]},   (mindegyik max 3 pont, konkrétan, szakaszra mutatva)
 "top_javitasok":[{"mit":"...","hol":"...","miert":"..."}]}   (max 5, a legnagyobb hatású elöl)"""

PERSZONAK = [
    ('a', 'Szabó Péter', 'Szabó Péter vagy, 34 éves rendezvényszervező. Idén lettél átalányadós egyéni vállalkozó, az adózáshoz nem értesz, a szakszavakat nem szereted. Telefonon görgetsz, sietve, két munka között.', JSON_VEVO, 3500),
    ('b', 'Kiss Anna', 'Kiss Anna vagy, 41 éves fodrász, 6 éve katás. Most egy hagyományos könyvelőirodához jársz, ismered a könyvelődet. Azt mérlegeled, megéri-e váltani, és mi lenne jobb vagy rosszabb.', JSON_VEVO, 3500),
    ('c', 'Tóth Gábor', 'Tóth Gábor vagy, 52 éves villanyszerelő, átalányadós. Gyanakvó vagy az online szolgáltatásokkal, félsz a NAV-tól és attól, hogy valaki visszaél az adataiddal vagy a meghatalmazással. Minden apró betűt elolvasol.', JSON_VEVO, 3500),
    ('d', 'Nagy Lili', 'Nagy Lili vagy, 26 éves grafikus. Most indítanád a vállalkozásodat, még nem tudod, átalányadó vagy kata, és fogalmad sincs, mi vár rád. Sokat használsz appokat, a jó dizájnt értékeled, a drága vagy unalmas dolgokat elgörgeted.', JSON_VEVO, 3500),
    ('e', 'Szakember', 'Tapasztalt magyar webdizájner és konverziós (CRO) szakember vagy, sok magyar KKV- és előfizetéses szolgáltatás oldalával a hátad mögött. Most nem vevőként nézed: azt ítéled meg, egy átlagos magyar egyéni vállalkozó kívülről mindent ért-e, és az oldal mennyire vezeti el a regisztrációig. A kérdésekre egy tipikus látogató szemével felelj, utána add hozzá a szakmai részt: elrendezés, hierarchia, CTA-k (gombok, feliratok, elhelyezés, ismétlés), színek, telefon és gép különbségei.', JSON_SZAKEMBER, 4500),
]


def kulcs():
    return winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]


def keret_allapot(k):
    try:
        req = urllib.request.Request('https://openrouter.ai/api/v1/key', headers={'Authorization': 'Bearer ' + k})
        d = json.load(urllib.request.urlopen(req, timeout=30)).get('data', {})
        return {'limit_remaining': d.get('limit_remaining'), 'usage': d.get('usage')}
    except Exception as e:
        return {'hiba': f'{type(e).__name__}'}


def hiv(k, uz, max_tokens):
    test = json.dumps({'model': MODELL, 'messages': uz, 'temperature': 0.4, 'max_tokens': max_tokens,
                       'response_format': {'type': 'json_object'}, 'reasoning': {'effort': 'low'}, 'usage': {'include': True}}).encode()
    hiba = ''
    for prob in range(2):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                                         headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Title': 'Adozz landing-kulso'})
            r = json.load(urllib.request.urlopen(req, timeout=240))
            u = r.get('usage', {}) or {}
            ch = r['choices'][0]
            t = re.sub(r'^```(?:json)?|```$', '', (ch['message'].get('content') or '').strip(), flags=re.M).strip()
            try:
                return json.loads(t), u, ch.get('finish_reason'), ''
            except Exception:   # kifizetett válasz: nem kérjük újra, a nyers szöveget mentjük
                return {'nyers': t}, u, ch.get('finish_reason'), 'JSON-hiba'
        except urllib.error.HTTPError as e:
            hiba = f'HTTP {e.code}: ' + e.read().decode('utf-8', 'replace')[:300]
            if e.code in (400, 401, 402, 403, 404):
                break
        except Exception as e:
            hiba = f'{type(e).__name__}: {str(e)[:150]}'
        time.sleep(5)
    return None, {}, None, hiba


def uzenetek(old, kp, szerep, json_minta, gyors=True):
    t = [{'type': 'text', 'text': 'AZ OLDAL TELJES LÁTHATÓ SZÖVEGE, SZAKASZONKÉNT (# és ## = címsor, - = listaelem, [kérdés] = lenyitható GYIK-kérdés, [kép: …] = kép leírása):\n\n' +
          '\n\n'.join(f'=== {b["szakasz"]} ===\n{b["szoveg"]}' for b in old)}]
    if kp:
        t.append({'type': 'text', 'text': f'KÉPERNYŐKÉP-SZELETEK ({len(kp)} db: előbb a telefon, aztán a gép, mindkettő fentről lefelé):'})
        for x in kp:
            t.append({'type': 'text', 'text': x['cim']})
            t.append({'type': 'image_url', 'image_url': {'url': x['url']}})
    vege = {'type': 'text', 'text': '(Vége az oldalnak.)'}
    if gyors:
        vege['cache_control'] = {'type': 'ephemeral'}
    t.append(vege)
    t.append({'type': 'text', 'text': 'KI VAGY: ' + szerep + '\n\n' + KERDESEK + '\n\n' + json_minta})
    return [{'role': 'system', 'content': RENDSZER}, {'role': 'user', 'content': t}]


def main():
    old, kp = oldal(), kepek()
    print(f'szakasz: {len(old)}, szöveg: {sum(len(b["szoveg"]) for b in old)} karakter, kép: {len(kp)} ({sum(x["kb"] for x in kp)} KB)')
    if PROBA:
        json.dump(old, open(os.path.join(BE, 'kivonat_tisztitott.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        for x in kp: print(' ', x['fajl'], x['kb'], 'KB |', x['cim'])
        return
    os.makedirs(KI_MAPPA, exist_ok=True)
    k = kulcs()
    elotte = keret_allapot(k)
    print('OpenRouter keret előtte:', elotte)
    if isinstance(elotte.get('limit_remaining'), (int, float)) and elotte['limit_remaining'] < KERET + 0.02:
        print('túl kicsi a keret, nincs hívás'); return
    er = {'modell': MODELL, 'datum': datetime.datetime.now().isoformat(timespec='seconds'),
          'oldal': 'kod/landing/dist/index.html (telt színes változat, 11-21 11:37-es build; az élő adozz.hu szövege azonos)',
          'kepek': [{'fajl': x['fajl'], 'cim': x['cim']} for x in kp], 'oldal_szovege': old, 'keret_elotte': elotte, 'keret_osszesen': KERET,
          'perszonak': [], 'koltseg_osszes': 0.0}
    kolt, utolso, gyors = 0.0, None, True
    for kod, nev, szerep, minta, max_tok in PERSZONAK:
        becsles = (utolso * (1.35 if kod == 'e' else 1.15)) if utolso else 0.02
        kepes = True
        if kolt + becsles > KERET:
            if kolt + becsles * 0.45 <= KERET:
                kepes = False   # olcsóbb: csak a szöveg
            else:
                print(f'{nev}: kihagyva (keret: {kolt:.4f} + becslés {becsles:.4f} > {KERET})')
                er['perszonak'].append({'kod': kod, 'nev': nev, 'kihagyva': 'költségkeret'}); continue
        t0 = time.time()
        v, u, fin, hiba = hiv(k, uzenetek(old, kp if kepes else [], szerep, minta, gyors), max_tok)
        if v is None and hiba.startswith('HTTP 400') and gyors:
            gyors = False
            v, u, fin, hiba = hiv(k, uzenetek(old, kp if kepes else [], szerep, minta, gyors), max_tok)
        c = float(u.get('cost', 0) or 0)
        kolt += c
        if c and kepes:
            utolso = c
        cache = (u.get('prompt_tokens_details') or {}).get('cached_tokens')
        print(f'{nev}: {"OK" if v and not hiba else "HIBA " + hiba} | képek: {"igen" if kepes else "nem"} | be {u.get("prompt_tokens")} (gyorsítótár {cache}) '
              f'ki {u.get("completion_tokens")} | {fin} | {c:.4f} $ | össz {kolt:.4f} $ | {time.time() - t0:.0f} s', flush=True)
        er['perszonak'].append({'kod': kod, 'nev': nev, 'kepekkel': kepes, 'valasz': v, 'hiba': hiba, 'finish': fin, 'usage': u, 'koltseg': c})
        er['koltseg_osszes'] = round(kolt, 5)
        json.dump(er, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    er['keret_utana'] = keret_allapot(k)
    json.dump(er, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'kész: {KI} | összes költség: {kolt:.4f} $ | keret utána: {er["keret_utana"]}')


if __name__ == '__main__':
    main()
