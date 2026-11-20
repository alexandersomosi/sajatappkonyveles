# Külső szem (Gemini, OpenRouter) – a ragadós bemutató és a 2. kör javításai UTÁN (11-20 késő este).
# Ugyanaz a módszer, mint a gemini_ai_hatas_2_ujra.py-ban (két szerep, ugyanaz a JSON-séma), de:
#  - a 6 gépes képszelet (1440 css px, 2x -> 1000 px JPEG) a _kepek_tulajnak/kor2/gep_*.png-ből,
#  - + 4 telefonos görgetési kocka (390x844 @2x -> 500 px), mert a tulaj telefonon nézi; a „Mit kapsz” élőben ragadós.
# Kulcs: HKCU\Environment OPENROUTER_API_KEY, csak a folyamatban (nem kerül fájlba/naplóba).
# Kimenet: landing_v2/_eszkoz/gemini_ai_hatas_3.json (képek base64 nélkül, usage + költség)
import base64, glob, io, json, os, re, sys, time, urllib.request, urllib.error, winreg, datetime
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
ITT = os.path.dirname(os.path.abspath(__file__))
KOR2 = os.path.join(ITT, '..', '_kepek_tulajnak', 'kor2')
GEP = sorted(glob.glob(os.path.join(KOR2, 'gep_0[1-9].png')))
TEL = [os.path.join(KOR2, f'gorgetes_telefon_0{i}.png') for i in (1, 2, 4, 7)]
KI = os.path.join(ITT, 'gemini_ai_hatas_3.json')
MODELL = 'google/gemini-3.8-flash'
MAX_TOK = 7000

CIMKE = {
    1: 'fejléc; hős (bal: szürke előcím, cím, bevezető, sárga gomb + „Így indul a könyvelésed →” szöveglink, ár-sor, mikrosor; jobb: egyetlen telefon saját rajzolású valósághű kerettel, csak árnyékkal – élőben a képernyők maguktól váltakoznak, vezérlő nélkül); bizalmi sor (4 hasáb, cégadatokkal); „Átalányadózó és katás egyéni vállalkozókat könyvelünk” (két hasáb)',
    2: '„Így indul a könyvelésed” (01–04, vonalas rács); a sötét „Mit kapsz” szakasz: ÉLŐBEN RAGADÓS BEMUTATÓ – balra a 7 lépés szövege görög (az aktív kiemelt, sárga címkével, a többi halványabb), jobbra EGY telefon áll, és görgetésre lépésenként vált benne a képernyő (rövid animáció: értesítés, kiemelés, gomb), alatta 7 részes haladásjelző. A képen az első lépés állapota látszik.',
    3: '„Mit kapsz” vége (+ „Az appot gépen, böngészőből is megnyithatod…”, „Az app képei bemutató adatokkal készültek.”); „Ki könyvel neked?” osztott fej + „Ezt csinálja a könyvelőd egy negyedévben” vonalas lista; „Mit jelent a meghatalmazás…” eleje',
    4: 'biztonság (két hasáb + „Ha valaki a nevünkben keres”); „Mennyibe kerül?” (egy fehér panel: havidíj + „Benne van”, jobbra „Külön díjak”)',
    5: '„Miben más, mint egy hagyományos könyvelőiroda?” táblázat; GYIK (bal: cím, jobb: harmonika)',
    6: 'GYIK vége; kék záró sáv; sötét lábléc + impresszum',
}
TEL_CIMKE = {1: '1. lépés (Számlák)', 2: '2. lépés (Félretenni)', 4: '4. lépés (Fotózás)', 7: '7. lépés (Keretek)'}

RENDSZER = """Az Adózz.hu egy magyar online könyvelés-szolgáltatás alanyi áfamentes, átalányadózó és katás egyéni vállalkozóknak: nyilvántartásba vett könyvelő + mobilapp (számlák a NAV Online Számlából, mennyit tegyél félre adóra, határidők, fotózott iratok, üzenet a könyvelőnek). 19 999 Ft/hó bruttó, éves zárás 14 999 Ft/év. Az app nem utal és nem von le pénzt, nem küld be semmit a NAV-nak; a bevallást a könyvelő adja be meghatalmazással. Szolgáltató: Somosi Kft. Az alapító YouTuber-vállalkozó, a weboldalt főleg telefonon nézik majd.
Ez egy még NEM élő dizájnminta értékesítő oldala. A tulaj célja: megbízható, valódi magyar cég benyomása (ő a Billingót és a Számlázz.hu-t hozta példának), emberi kéz munkája, NE sablonos „AI-landing” hatás.
Kötöttségek (a javaslataid ezeken belül maradjanak): az arculat marad (fő kék #1428DB, sárga főgomb #FFC93C, sötét #10152B, Geist betű, az appban Fluent Emoji Flat ikonok). Nem lesz: kitalált vélemény, ügyfélszám, statisztika, díj/elismerés; könyvelő-fotó vagy kitalált könyvelőnév (az app-képeken „a könyvelőd” áll, név nélkül, szándékosan); AI-val generált kép; mesterséges intelligencia említése; válaszidő-ígéret (egyetlen engedett mondat: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”); külső betű/CDN/követő kód; telefonszám a fejlécben (nincs ilyen). Csak valós funkciót mutathatunk. Az árak maradnak. Animáció csak transform/opacity. A „Mit kapsz” ragadós bemutatója a tulaj kifejezett kérése (görgetésre cserélődő szöveg, egyetlen telefon) – ezt magát ne kérdőjelezd meg, csak a kivitelét értékeld."""

FELADAT = """Két szemmel nézd végig a képeket: először a 6 gépes képszeletet (1440 px széles nézet, fentről lefelé), aztán 4 telefonos képernyőt (390x844, a „Mit kapsz” ragadós bemutató egy-egy lépése görgetés közben: fent az álló telefon, alatta a haladásjelző és a cserélődő lépésszöveg).
TERVEZŐ = tapasztalt magyar webdizájner, aki ügynökségnél dolgozott, és ránézésre felismeri a sablonos/AI-generált landingokat (pl. Tailwind/shadcn-ízű kártyarácsok, ikon+cím+2 sor kártyák, színes bal szegélyű „callout” dobozok, minden szakasz más pasztell háttér, gradiens ragyogás, eyebrow-címke minden szakasz fölött, egyforma lekerekítés és árnyék mindenen, kétszínű címek, hármas felsorolások, 01–04 számozott rácsok, lebegő „annotált demó” kártyák).
VÁLLALKOZÓ = átlagos magyar egyéni vállalkozó (40 körüli villanyszerelő vagy kozmetikus), aki nem ért a dizájnhoz, de érzi, ha valami „gépies”, „túl szép, hogy igaz legyen” vagy „nem igazi cég”.
Kérdések: tűnik-e AI-generáltnak/sablonosnak az oldal; MELY részek és MIÉRT; bizalomkeltő-e; mit tenne egy valódi magyar ügynökség másképp. Külön értékeld: (a) a telefonos ragadós bemutatót (olvasható-e a szöveg, jó-e a telefon mérete, hat-e hibásnak/takartnak valami a telefon képernyőjén, gépies-e), (b) a telefonokon belüli rétegeket (értesítés, kártya, kiemelő keret, „Megjelölve” gomb): valódi app-képernyőnek hatnak-e, vagy ráragasztott demó-elemnek.
Legyél őszinte és konkrét, ne udvariaskodj; ne ismételd magad; mindenhol add meg a kép jelét (G1–G6 gépes, T1–T4 telefonos). Magyarul, tömören. Válasz CSAK JSON:
{"osszkep":{"tervezo_ai_hatas_1_10":<1=kézzel tervezett, 10=tiszta AI-sablon>,"vallalkozo_ai_hatas_1_10":<szám>,"vallalkozo_bizalom_1_10":<1=nem adnám meg az adataimat, 10=nyugodtan regisztrálnék>,"tervezo_egy_mondatban":"...","vallalkozo_egy_mondatban":"...","legerosebb_ai_jel":"..."},
"ragados_bemutato_telefonon":{"ertekeles":"...","olvashato":true,"telefon_merete":"jó|kicsi|nagy","hibanak_hato_resz":"<konkrét, vagy üres>","javitas":"<konkrét, vagy üres>"},
"retegek_a_telefonon":[{"kep":"T1","mi":"...","valodi_appnak_hat":true,"miert":"...","javitas":"<vagy üres>"}],
"ai_jelek":[{"resz":"<szakasz + elem>","kep":"G1","tipus":"doboz|ikon|szín|szöveg|elrendezés|tipográfia|mozgás|ismétlődés","miert_ai":"...","ugynokseg_igy_csinalna":"<konkrét, megvalósítható>","sulyossag":"nagy|közepes|kicsi"}],
"szoveg_ai_jelek":[{"idezet":"<PONTOS idézet a képről>","kep":"G1","miert_ai":"...","emberibb":"<rövid, tegező, magyaros>"}],
"bizalom":{"kelt":["..."],"nem_kelt":[{"mi":"...","javitas":"..."}]},
"megtartando":["..."],
"top_5_javitas":["<rangsorolva, a legnagyobb hatású elöl>"]}"""


def kep(f, w):
    im = Image.open(f).convert('RGB')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode(), im.size


def main():
    assert len(GEP) == 6, GEP
    assert all(os.path.exists(f) for f in TEL), TEL
    tartalom = [{'type': 'text', 'text': 'GÉPES KÉPSZELETEK (1440 px széles nézet, fentről lefelé, közvetlenül egymás alá illeszkednek):'}]
    meretek = []
    for i, f in enumerate(GEP, 1):
        url, sz = kep(f, 1000); meretek.append(sz)
        tartalom.append({'type': 'text', 'text': f'G{i}: {CIMKE[i]}'})
        tartalom.append({'type': 'image_url', 'image_url': {'url': url}})
    tartalom.append({'type': 'text', 'text': 'TELEFONOS KÉPERNYŐK (390x844, görgetés közben, a „Mit kapsz” ragadós bemutató):'})
    for j, (f, i) in enumerate(zip(TEL, (1, 2, 4, 7)), 1):
        url, sz = kep(f, 500); meretek.append(sz)
        tartalom.append({'type': 'text', 'text': f'T{j}: {TEL_CIMKE[i]}'})
        tartalom.append({'type': 'image_url', 'image_url': {'url': url}})
    tartalom.append({'type': 'text', 'text': FELADAT})
    uz = [{'role': 'system', 'content': RENDSZER}, {'role': 'user', 'content': tartalom}]
    if '--proba' in sys.argv:
        print('próba: képek', meretek); return
    kulcs = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]
    test = json.dumps({'model': MODELL, 'messages': uz, 'temperature': 0.4, 'max_tokens': MAX_TOK,
                       'response_format': {'type': 'json_object'}, 'reasoning': {'effort': 'low'}, 'usage': {'include': True}}).encode()
    hiba = ''; valasz = None; u = {}; fin = None
    for prob in range(2):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                                         headers={'Authorization': 'Bearer ' + kulcs, 'Content-Type': 'application/json', 'X-Title': 'Adozz landing-ai-hatas-3'})
            r = json.load(urllib.request.urlopen(req, timeout=300))
            u = r.get('usage', {}) or {}
            ch = r['choices'][0]; fin = ch.get('finish_reason')
            t = re.sub(r'^```(?:json)?|```$', '', (ch['message'].get('content') or '').strip(), flags=re.M).strip()
            try:
                valasz = json.loads(t); hiba = ''
            except Exception:
                valasz = {'nyers': t}; hiba = 'JSON-hiba'
            break
        except urllib.error.HTTPError as e:
            hiba = f'HTTP {e.code}: ' + e.read().decode('utf-8', 'replace')[:300]
            if e.code not in (429, 500, 502, 503, 504): break
        except Exception as e:
            hiba = f'{type(e).__name__}: {str(e)[:150]}'; break
        time.sleep(5 * (prob + 1))
    koltseg = float(u.get('cost', 0) or 0)
    ki = {'ido': datetime.datetime.now().isoformat(timespec='seconds'), 'modell': MODELL,
          'kepek': [os.path.basename(f) for f in GEP + TEL], 'kep_meret': meretek, 'cimkek': CIMKE, 'rendszer': RENDSZER, 'feladat': FELADAT,
          'valasz': valasz, 'finish_reason': fin, 'hiba': hiba, 'usage': u, 'koltseg_usd': koltseg}
    json.dump(ki, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'kész: {KI} | hiba: {hiba or "nincs"} | finish: {fin} | tokenek be/ki: {u.get("prompt_tokens")}/{u.get("completion_tokens")} | költség: {koltseg:.4f} $')


if __name__ == '__main__':
    main()
