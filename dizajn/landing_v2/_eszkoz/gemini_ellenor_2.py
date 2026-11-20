# Második külső szemű kör (Gemini, OpenRouter): az ÚJ mozgó bemutató (#mit-kapsz) és a fotó nélküli könyvelő-szakasz érthető-e.
# Egy hívás, 4 perszóna egy válaszban. Kulcs: HKCU\Environment OPENROUTER_API_KEY, csak a folyamatban (nem kerül fájlba/naplóba).
# Kimenet: landing_v2/_eszkoz/gemini_kulso_2.json (képek base64 nélkül)
import base64, io, json, re, sys, urllib.request, urllib.error, winreg, datetime
from html.parser import HTMLParser
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
L = 'C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2'
KI = L + '/_eszkoz/gemini_kulso_2.json'
MODELL = 'google/gemini-3.8-flash'


class Sz(HTMLParser):
    def __init__(s, cel):
        super().__init__(); s.cel = cel; s.mely = 0; s.ki = []; s.skip = 0

    def handle_starttag(s, t, a):
        a = dict(a)
        if s.mely == 0 and t == 'section' and a.get('id') == s.cel:
            s.mely = 1; return
        if s.mely:
            if t == 'section': s.mely += 1
            if t in ('svg', 'script', 'style'): s.skip += 1
            if t in ('h2', 'h3', 'p', 'li'): s.ki.append('\n' + ('## ' if t in ('h2', 'h3') else ''))
            elif t in ('div', 'span', 'b'): s.ki.append(' ')

    def handle_endtag(s, t):
        if s.mely:
            if t == 'section': s.mely -= 1
            if t in ('svg', 'script', 'style') and s.skip: s.skip -= 1

    def handle_data(s, d):
        if s.mely and not s.skip: s.ki.append(d)


def szoveg(cel):
    h = open(L + '/index.html', encoding='utf-8').read()
    # a mozgó rétegek (aria-hidden) szövegét külön írjuk le (RETEGEK), a kivonatból kihagyjuk
    h = re.sub(r'<div class="reteg" aria-hidden="true">.*?</div>\s*</div>\s*</div>\s*</div>', '</div></div></div>', h, flags=re.S)
    p = Sz(cel); p.feed(h)
    t = re.sub(r'[ \t\u00a0]+', ' ', ''.join(p.ki))
    return re.sub(r'\n\s*\n+', '\n', t).strip()


RETEGEK = """A telefonokon lépésenként ezek mozognak (görgetésre indulnak):
1. Számlák: felülről beúszik az értesítés „Új számla a NAV-tól – Napfény Étterem Kft. · 418 000 Ft”, a listába becsúszik a számla sora, keret villan köré, majd sárga buborék: „Ebből kb. 29 000 Ft-ot tegyél félre.”
2. Félretenni: alulról kártya: „Most legyen félretéve: kb. 250 000 Ft”, a szám 221 000-ről felpörög 250 000-re, mellette „+29 000 Ft”; koppintás a „Megjelölöm, hogy félretettem” gombra, ami zöld „Megjelölve” lesz.
3. Határidők: értesítés „Közeleg egy határidő – Szja-előleg, IV. negyedév: jan. 12.”, keret a számlaszám (10032000-06056353) körül, koppintás a „Másolom” gombra → „Kimásolva”.
4. Fotózás: kameranézetbe becsúszik egy papír (Papírbolt, nyomtatópapír), villan a vaku, a papír lerepül a Dosszié fülre, értesítés: „Elküldve a könyvelődnek”.
5. Dosszié: a Papírbolt-sor becsúszik az „Amit te küldtél” listába „Új” címkével, értesítés: „A könyvelőd átnézte az iratokat – 5 irat rendben”.
6. Üzenetek: megjelenik a kérdésed („Mennyit fizettem be eddig az adóból?”), gépelés-jelző, majd a könyvelő válasza („Eddig 317 000 Ft-ot…”), végül értesítés: „Megérkezett a befizetésed – A III. negyedéves szja-előleg rendben megérkezett.”
7. Keretek: kártya „Idei kereteid – Még 3 685 000 Ft”, a sáv 16 315 000 Ft-ig töltődik a 20 000 000 Ft-os keretből; keret a „Mennyit kerestem? Idén eddig kb. 14 527 000 Ft maradt neked” körül.
Asztali gépen a telefon ragadós (sticky), és görgetésre lépésenként vált; telefonon minden lépésnek saját kis telefonja van."""

APP = ("Az Adózz.hu egy magyar online könyvelés-szolgáltatás alanyi ÁFA-mentes, átalányadózó és katás egyéni vállalkozóknak: "
       "nyilvántartásba vett könyvelő + app. 19 999 Ft/hó bruttó, éves zárás 14 999 Ft/év. Az app nem utal és nem von le pénzt, "
       "nem küld be semmit a NAV-nak; a bevallást a könyvelő adja be. A könyvelőről fotó nem lesz.")
PERSZ = """Négy olvasó (mindegyik a saját szemével nézze, E/1-ben válaszoljon):
A) Szabó Péter, 34, kezdő átalányadós webfejlesztő; attól félt, hogy „csak egy algoritmus dobálja a számokat”, és nem értette, ki látja a befizetését.
B) Kiss Anna, 41, katás kozmetikus, most irodánál 15 000 Ft/hó; a mostani könyvelője személyesen elérhető.
C) Tóth Gábor, 52, gyanakvó villanyszerelő; fél, hogy ha a könyvelő hibázik, őt bünteti a NAV.
D) Nagy Lili, 26, induló grafikus, most indítja a vállalkozását."""
FELADAT = """Ez az oldal két ÚJ szakaszának második körös ellenőrzése. Csak ezekről írj. Szabályok: ne javasolj kitalált véleményt, ügyfélszámot, statisztikát,
válaszidő-ígéretet, könyvelő-fotót vagy kitalált nevet, mesterséges intelligenciát; csak valós, az oldalon szereplő funkciókra építs. Magyarul, tömören.
Válasz CSAK JSON:
{"perszonak":[{"kod":"A","sajat_szavaimmal":"<1-2 mondat: mit csinál nekem az app, a bemutató alapján>","melyik_lepes_gyozott_meg":"<lépés száma + miért>",
"nem_ertem":[{"idezet":"<PONTOS idézet>","miert":"...","uj_szoveg":"..."}],"konyvelo_bizalom_1_10":<szám>,"konyvelo_miert":"<1 mondat>",
"megvennem":"igen"|"talán"|"nem","miert":"<1 mondat>"}],
"kozos":{"erthetoseg_1_10":<szám>,"tul_sok_vagy_tul_hosszu":"<1 mondat>","legfontosabb_3_javitas":["...","...","..."]}}"""


def kep(f, cim, levag=None):
    im = Image.open(f).convert('RGB')
    if levag: im = im.crop(levag)
    if im.width > 390: im = im.resize((390, round(im.height * 390 / im.width)))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=80)
    return cim, 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    kepek = [kep('vk/m_9.5.png', '1. lépés mozgás közben (telefon)'), kep('vk/m_13.5.png', '2. lépés mozgás közben'),
             kep('vk/m_19.png', '3. lépés'), kep('vk/m_28.5.png', '6. lépés (üzenetek)'),
             kep(L + '/landing_mobil.png', 'A könyvelő-szakasz (telefon, állókép)', (0, 12345 * 2, 780, (12345 + 844) * 2)),
             kep(L + '/landing_mobil.png', 'A könyvelő-szakasz folytatása', (0, (12345 + 844) * 2, 780, (12345 + 1710) * 2))]
    t1, t2 = szoveg('mit-kapsz'), szoveg('konyvelo')
    tartalom = [{'type': 'text', 'text': '=== 5. MIT KAPSZ (új, mozgó bemutató) – szöveg ===\n' + t1 + '\n\n' + RETEGEK +
                 '\n\n=== 6. A KÖNYVELŐD (új, fotó nélkül) – szöveg ===\n' + t2}]
    for c, u in kepek:
        tartalom.append({'type': 'text', 'text': c}); tartalom.append({'type': 'image_url', 'image_url': {'url': u}})
    tartalom.append({'type': 'text', 'text': PERSZ + '\n\n' + FELADAT})
    msgs = [{'role': 'system', 'content': APP}, {'role': 'user', 'content': tartalom}]
    if '--proba' in sys.argv:
        print(t1[:1200]); print('...'); print(t2); print('kepek', len(kepek), 'karakter', len(t1) + len(t2)); return
    k = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]
    test = json.dumps({'model': MODELL, 'messages': msgs, 'temperature': 0.4, 'max_tokens': 3500, 'response_format': {'type': 'json_object'},
                       'reasoning': {'effort': 'low'}, 'usage': {'include': True}}).encode()
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                                 headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Title': 'Adozz landing-atnezes 2'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode('utf-8', 'replace')[:300]); return
    u = r.get('usage', {}) or {}
    t = re.sub(r'^```(?:json)?|```$', '', (r['choices'][0]['message'].get('content') or '').strip(), flags=re.M).strip()
    try:
        v = json.loads(t)
    except Exception:
        v = {'nyers': t}
    c = float(u.get('cost', 0) or 0)
    json.dump({'modell': MODELL, 'datum': datetime.datetime.now().isoformat(timespec='seconds'), 'kepek': [c_ for c_, _ in kepek],
               'valasz': v, 'usage': u, 'koltseg': c}, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'koltseg {c:.4f} $ | be {u.get("prompt_tokens")} ki {u.get("completion_tokens")} | finish {r["choices"][0].get("finish_reason")}')
    print(json.dumps(v, ensure_ascii=False, indent=1))


main()
