# Külső szem (Gemini, OpenRouter): mennyire tűnik AI-generáltnak / sablonosnak a landing (2. kör előtt, tulaj 11-20 20:45).
# Egy hívás, 9 gépes képszelet (1440 css px, 2x -> 1000 px széles JPEG), két szerep: tapasztalt magyar webdizájner + átlagos magyar vállalkozó.
# Kulcs: HKCU\Environment OPENROUTER_API_KEY, csak a folyamatban (nem kerül fájlba/naplóba).
# Kimenet: landing_v2/_eszkoz/gemini_ai_hatas_2.json (2. kör UTÁN, 11-20 este; a gemini_ai_hatas.py másolata, új képekkel és kérdéssel) (képek base64 nélkül, usage + költség)
import base64, glob, io, json, os, re, sys, time, urllib.request, urllib.error, winreg, datetime
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SCR = 'D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad'
KEPEK = sorted(glob.glob(SCR + '/hq_kor2/gep_0[1-9].png'))
TEL = sorted(glob.glob(SCR + '/hq_kor2/tel_*.png'))
KI = 'C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_2.json'
MODELL = 'google/gemini-3.8-flash'
MAX_TOK = 6000

SZAKASZOK = ('fejléc → hős (bal: szürke előcím, cím, bevezető, sárga gomb + „Visszahívást kérek →” szöveglink, ár-sor; jobb: EGY telefon valósághű kerettel, csak árnyékkal, a képernyők maguktól váltakoznak) '
             '→ bizalmi sor (4 hasáb vonalakkal, ikon nélkül) → „Kiket könyvelünk?” (kétszínű cím, két hasáb vonallal) '
             '→ „Így indul a könyvelésed” (4 lépés keretes rácsban, szürke alap) → sötét „Mit kapsz” (7 lépés: szám + címke, cím, szöveg; a képen állóképként '
             'lépésenként egy telefon; élőben gépen ragadós telefon a jobb oldalon, görgetésre vált) + a szakasz végén a gépes app-kép '
             '→ „Ki könyvel neked?” + „Ezt csinálja a könyvelőd egy negyedévben” (vonalas lista) → biztonság (két hasáb vonalas tételekkel + 1 keretes figyelmeztetés) '
             '→ árak (szürke alap, egy fehér panel) → összevetés táblázat → sárga csíkos szaggatott doboz = BELSŐ HELYŐRZŐ, élesítés előtt kikerül, NE ÉRTÉKELD '
             '→ GYIK → kék záró sáv → sötét lábléc.')

RENDSZER = """Az Adózz.hu egy magyar online könyvelés-szolgáltatás alanyi áfamentes, átalányadózó és katás egyéni vállalkozóknak: nyilvántartásba vett, név szerint ismert könyvelő + mobilapp. 19 999 Ft/hó bruttó, éves zárás 14 999 Ft/év. Szolgáltató: Somosi Kft. A weboldalt főleg telefonon nézik majd.
Ez egy még NEM élő dizájnminta 2. változata. Az 1. változatot a tulaj és egy külső szem „tipikus AI/Tailwind-landingnak” találta (pasztell szakaszok, ikonos kártyák, „Neked ebből:” színes bal szegélyű dobozok, idővonal ikonokkal, 3 kis kártya, vezérlősor a hős-telefon alatt). A 2. változat ezeket kivette, és modern SaaS-oldalak (Qonto, Kontist, Attio, Stripe, Billingo) mintájára épült: fehér alap, 1 sötét és 1 kék sáv, vonalakkal tagolt hasábok, kevés doboz, Geist 600-as címek, valódi app-képek valósághű telefonkeretben.
Kötöttségek: arculat (kék #1428DB, sárga főgomb #FFC93C, sötét #10152B, Geist); nem lesz kitalált vélemény/ügyfélszám/statisztika/díj, könyvelő-fotó, AI-kép, MI-említés, válaszidő-ígéret (egy engedett mondat a záróban), külső betű/CDN. Az app-képeken a „Kovács Bence” név bemutató adat (külön tulaji döntés, most NE értékeld). Csak valós funkció. Az árak maradnak."""

FELADAT = """Két szemmel nézd végig: TERVEZŐ (tapasztalt magyar webdizájner, felismeri a sablonos/AI-generált landingot) és VÁLLALKOZÓ (40 körüli villanyszerelő vagy kozmetikus, aki érzi, ha valami gépies vagy nem igazi cég).
Előbb a 9 gépes képszelet jön (1440 px, fentről lefelé), utána 3 telefonos kép (390 px széles nézet, egymás mellé tett szeletek, balról jobbra, fentről lefelé haladva).
Kérdés: maradt-e még AI/sablon-hatás, MI és MIÉRT; mi lett jó; mit tenne még egy valódi ügynökség, hogy kézzel tervezett, valódi magyar cég hatása legyen (a kötöttségeken belül). Csak a még MEGLÉVŐ problémákat írd, konkrétan (szakasz, elem, képszám), megvalósítható javítással. Ne javasolj új színt, ikonsort, kártyát vagy dobozt. Magyarul, tömören. Válasz CSAK JSON:
{"osszkep":{"tervezo_ai_hatas_1_10":<1=kézzel tervezett, 10=tiszta AI-sablon>,"vallalkozo_ai_hatas_1_10":<szám>,"tervezo_egy_mondatban":"...","vallalkozo_egy_mondatban":"...","legerosebb_maradt_ai_jel":"..."},
"maradt_ai_jelek":[{"resz":"...","kep":"<g3 vagy t2>","miert_ai":"...","javitas":"...","sulyossag":"nagy|közepes|kicsi"}],
"szoveg":[{"idezet":"<PONTOS idézet>","kep":"...","gond":"...","emberibb":"..."}],
"telefonon":[{"mi":"...","kep":"...","javitas":"..."}],
"jo_lett":["..."],
"top_5_javitas":["<rangsorolva>"]}"""


def kep(f, i):
    im = Image.open(f).convert('RGB')
    w = 1000
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode(), im.size


def montazs(fajlok):
    ims = [Image.open(f).convert('RGB') for f in fajlok]
    W = sum(i.width for i in ims) + 16 * (len(ims) - 1); H = max(i.height for i in ims)
    out = Image.new('RGB', (W, H), (190, 60, 60)); x = 0
    for i in ims: out.paste(i, (x, 0)); x += i.width + 16
    w = 1100; out = out.resize((w, round(H * w / W)), Image.LANCZOS)
    b = io.BytesIO(); out.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode(), out.size


def main():
    assert len(KEPEK) == 9, KEPEK
    tartalom = [{'type': 'text', 'text': 'Az oldal felépítése: ' + SZAKASZOK}]
    meretek = []
    for i, f in enumerate(KEPEK, 1):
        url, sz = kep(f, i); meretek.append(sz)
        tartalom.append({'type': 'text', 'text': f'g{i}. gépes szelet'})
        tartalom.append({'type': 'image_url', 'image_url': {'url': url}})
    for j, csop in enumerate([TEL[0:5], TEL[5:10], TEL[10:15]], 1):
        url, sz = montazs(csop); meretek.append(sz)
        tartalom.append({'type': 'text', 'text': f't{j}. telefonos kép ({len(csop)} szelet egymás mellett, balról jobbra = fentről lefelé)'})
        tartalom.append({'type': 'image_url', 'image_url': {'url': url}})
    tartalom.append({'type': 'text', 'text': FELADAT})
    uz = [{'role': 'system', 'content': RENDSZER}, {'role': 'user', 'content': tartalom}]
    if '--proba' in sys.argv:
        print('próba: képek', meretek, 'szöveg karakter', len(RENDSZER) + len(FELADAT)); return
    kulcs = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]
    test = json.dumps({'model': MODELL, 'messages': uz, 'temperature': 0.4, 'max_tokens': MAX_TOK,
                       'response_format': {'type': 'json_object'}, 'reasoning': {'effort': 'low'}, 'usage': {'include': True}}).encode()
    hiba = ''; valasz = None; u = {}; fin = None
    for prob in range(2):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                                         headers={'Authorization': 'Bearer ' + kulcs, 'Content-Type': 'application/json', 'X-Title': 'Adozz landing-ai-hatas-2'})
            r = json.load(urllib.request.urlopen(req, timeout=300))
            u = r.get('usage', {}) or {}
            ch = r['choices'][0]; fin = ch.get('finish_reason')
            t = re.sub(r'^```(?:json)?|```$', '', (ch['message'].get('content') or '').strip(), flags=re.M).strip()
            try:
                valasz = json.loads(t); hiba = ''
            except Exception:   # kifizetett válasz: nem kérjük újra, a nyerset mentjük
                valasz = {'nyers': t}; hiba = 'JSON-hiba'
            break
        except urllib.error.HTTPError as e:
            hiba = f'HTTP {e.code}: ' + e.read().decode('utf-8', 'replace')[:300]
            if e.code in (400, 401, 402, 403, 404): break
        except Exception as e:
            hiba = f'{type(e).__name__}: {str(e)[:150]}'
        time.sleep(5 * (prob + 1))
    koltseg = float(u.get('cost', 0) or 0)
    ki = {'ido': datetime.datetime.now().isoformat(timespec='seconds'), 'modell': MODELL, 'kepek': [os.path.basename(f) for f in KEPEK],
          'kep_meret': meretek, 'szakaszok': SZAKASZOK, 'rendszer': RENDSZER, 'feladat': FELADAT,
          'valasz': valasz, 'finish_reason': fin, 'hiba': hiba, 'usage': u, 'koltseg_usd': koltseg}
    json.dump(ki, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'kész: {KI} | hiba: {hiba or "nincs"} | finish: {fin} | tokenek be/ki: {u.get("prompt_tokens")}/{u.get("completion_tokens")} | költség: {koltseg:.4f} $')


if __name__ == '__main__':
    main()
