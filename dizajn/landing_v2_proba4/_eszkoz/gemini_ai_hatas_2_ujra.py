# Külső szem (Gemini, OpenRouter) – 2. kör UTÁN, ugyanazzal a módszerrel, mint a gemini_ai_hatas.py (1. kör, 11-20 20:48):
# egy hívás, 9 gépes képszelet (1440 css px, 2x -> 1000 px széles JPEG), két szerep (magyar webdizájner + átlagos vállalkozó),
# ugyanaz a JSON-séma (+ bizalmi pontszám és a tulaj által jelzett részek új megoldásának értékelése).
# Az építő saját, rövidebb 2. körös kérdése (gemini_ai_hatas_2.py) eredménye: gemini_ai_hatas_2_epito_2139.json (megőrizve).
# Kulcs: HKCU\Environment OPENROUTER_API_KEY, csak a folyamatban (nem kerül fájlba/naplóba).
# Kimenet: landing_v2/_eszkoz/gemini_ai_hatas_2.json (képek base64 nélkül, usage + költség)
import base64, glob, io, json, os, re, sys, time, urllib.request, urllib.error, winreg, datetime
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SCR = 'D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad'
KEPEK = sorted(glob.glob(SCR + '/hq_gemini2/gep_0[1-9].png'))
KI = 'C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_2.json'
MODELL = 'google/gemini-3.8-flash'
MAX_TOK = 7000

CIMKE = {
    1: 'fejléc (logó, menü, Belépés, sárga gomb); hős (bal: szürke előcím, cím, bevezető, sárga gomb + „Visszahívást kérek →” szöveglink, ár-sor, mikrosor; jobb: egyetlen telefon valósághű készülékkerettel, csak árnyékkal – élőben a képernyők maguktól váltakoznak, vezérlő nélkül); bizalmi sor (4 hasáb vonalakkal, ikon nélkül); „Kiket könyvelünk?” (kétszínű cím, két hasáb: „Neked szól, ha” / „Most nem neked szól, ha”)',
    2: '„Így indul a könyvelésed” (4 lépés, 01–04, vonallal elválasztott hasábok, világosszürke alap); a sötét „Mit kapsz” szakasz: kétszínű cím, 01 Számlák, 02 Félretenni eleje (bal: szám + címke, cím, szöveg; jobb: telefon). A telefonokon a felugró értesítés- és sárga kiemelő-rétegek élőben görgetésre animálódnak (gépen egy ragadós telefon vált), a kép az állóképet mutatja',
    3: '„Mit kapsz”: 02 Félretenni vége, 03 Határidők, 04 Fotózás',
    4: '„Mit kapsz”: 05 Dosszié, 06 Üzenetek, 07 Keretek eleje',
    5: '„Mit kapsz”: 07 vége; a szakasz végén „Gépen is ugyanaz az app” + a gépes app-kép (az előző változat 3 kis kártyája helyén); „Az app képei bemutató adatokkal készültek.”; fehér könyvelő-szakasz: „Ki könyvel neked?” osztott fej + „Ezt csinálja a könyvelőd egy negyedévben” vonalas lista (az előző változat idővonala és 3 doboza helyén)',
    6: 'könyvelő-lista vége; biztonság: „Mit jelent a meghatalmazás, és hol vannak az adataid?” (két hasáb vonalas tételekkel + „Ha valaki a nevünkben keres” vastag felső vonallal); „Mennyibe kerül?” eleje (szürke alap, egy fehér panel: bal havidíj + „Benne van” lista, jobb „Külön díjak”)',
    7: 'Árak vége (sárga gomb, apróbetű); „Miben más, mint egy hagyományos könyvelőiroda?” összevető táblázat; sárga csíkos szaggatott doboz = BELSŐ HELYŐRZŐ a későbbi valódi véleményeknek, élesítés előtt kikerül, EZT NE ÉRTÉKELD',
    8: 'GYIK (bal: cím + e-mail, jobb: harmonika, az első nyitva); kék záró sáv (bal: cím, sárga gomb; jobb, vonallal elválasztva: „Előbb beszélnél velünk?”); sötét lábléc + impresszum eleje',
    9: 'lábléc alja (impresszum vége, copyright, „Az app képei bemutató adatokkal készültek.”, „Ez az oldal nem használ sütit.”)',
}

RENDSZER = """Az Adózz.hu egy magyar online könyvelés-szolgáltatás alanyi áfamentes, átalányadózó és katás egyéni vállalkozóknak: nyilvántartásba vett, név szerint ismert könyvelő + mobilapp (számlák a NAV Online Számlából, mennyit tegyél félre adóra, határidők, fotózott iratok, üzenet a könyvelőnek). 19 999 Ft/hó bruttó, éves zárás 14 999 Ft/év. Az app nem utal és nem von le pénzt, nem küld be semmit a NAV-nak; a bevallást a könyvelő adja be meghatalmazással. Szolgáltató: Somosi Kft. Az alapító YouTuber-vállalkozó, a weboldalt főleg telefonon nézik majd.
Ez egy még NEM élő dizájnminta értékesítő oldala. A tulaj célja: megbízható, valódi magyar cég benyomása (ő a Billingót és a Számlázz.hu-t hozta példának), emberi kéz munkája, NE sablonos „AI-landing” hatás.
Kötöttségek (a javaslataid ezeken belül maradjanak): az arculat marad (fő kék #1428DB, sárga főgomb #FFC93C, sötét #10152B, Geist betű, az appban Fluent Emoji Flat ikonok), de a használatuk módja változhat. Nem lesz: kitalált vélemény, ügyfélszám, statisztika, díj/elismerés; könyvelő-fotó vagy kitalált könyvelőnév (az app-képeken a „Kovács Bence” bemutató adat, erről külön tulaji döntés lesz, most NE értékeld); AI-val generált kép; mesterséges intelligencia említése; válaszidő-ígéret (egyetlen engedett mondat: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”); külső betű/CDN/követő kód. Csak valós funkciót mutathatunk. Az árak maradnak. Animáció csak transform/opacity."""

FELADAT = """Két szemmel nézd végig a 9 képszeletet (asztali gép, 1440 px széles nézet, fentről lefelé):
TERVEZŐ = tapasztalt magyar webdizájner, aki ügynökségnél dolgozott, és ránézésre felismeri a sablonos/AI-generált landingokat (pl. Tailwind/shadcn-ízű kártyarácsok, ikon+cím+2 sor kártyák, színes bal szegélyű „callout” dobozok, minden szakasz más pasztell háttér, gradiens ragyogás, eyebrow-címke minden szakasz fölött, egyforma lekerekítés és árnyék mindenen, „X. Y.” kétütemű címek, kétszínű (sötét + szürke) címek, hármas felsorolások, 01–04 számozott rácsok).
VÁLLALKOZÓ = átlagos magyar egyéni vállalkozó (40 körüli villanyszerelő vagy kozmetikus), aki nem ért a dizájnhoz, de érzi, ha valami „gépies”, „túl szép, hogy igaz legyen” vagy „nem igazi cég”.
Kérdések: tűnik-e AI-generáltnak/sablonosnak az oldal; MELY részek és MIÉRT (konkrétan: doboz, ikon, szín, szöveg, elrendezés, tipográfia, mozgás, ismétlődés); bizalomkeltő-e, mi kelt bizalmat és mi nem; mit tenne egy valódi magyar ügynökség másképp, hogy kézzel tervezett, valódi cég hatása legyen.
A tulaj az oldal ELŐZŐ változatában külön AI-hatásúnak érezte: a hős telefonja körüli elemeket (mögötte gépes kép és színes doboz, alatta gombsor), a „Mit kapsz” szakasz dobozait (különösen a „Neked ebből: …” színes bal szegélyű kiemelőket), a szakasz végi 3 kis ikonos kártyát, és a könyvelő-szakaszt (ikonos idővonal + 3 doboz). Ezek helyén most az 1., a 2–5. és az 5–6. képszeleten látható megoldás áll. Ezekre adj külön, konkrét értékelést: maradt-e AI-hatás, miért, és ha kell, megvalósítható javítást (CSS/elrendezés szinten). De az EGÉSZ oldalt nézd, mást is jelezz.
Legyél őszinte és konkrét, ne udvariaskodj; ne ismételd magad; mindenhol add meg a képszelet számát. Magyarul, tömören. Válasz CSAK JSON:
{"osszkep":{"tervezo_ai_hatas_1_10":<1=kézzel tervezett, 10=tiszta AI-sablon>,"vallalkozo_ai_hatas_1_10":<szám>,"vallalkozo_bizalom_1_10":<1=nem adnám meg az adataimat, 10=nyugodtan regisztrálnék>,"tervezo_egy_mondatban":"...","vallalkozo_egy_mondatban":"...","legerosebb_ai_jel":"..."},
"ai_jelek":[{"resz":"<szakasz + elem>","kep":<szám>,"tipus":"doboz|ikon|szín|szöveg|elrendezés|tipográfia|mozgás|ismétlődés","miert_ai":"<miért ismerős ez AI/sablon-oldalakról>","ugynokseg_igy_csinalna":"<konkrét, megvalósítható>","sulyossag":"nagy|közepes|kicsi"}],
"tulaj_altal_jelzett":[{"resz":"hős telefon|Mit kapsz lépés-elrendezés|Mit kapsz vége (gépes app-kép)|könyvelő-szakasz","maradt_ai_hatas":"nincs|kicsi|közepes|nagy","miert":"...","javitas":"<konkrét, vagy üres, ha nem kell>"}],
"szoveg_ai_jelek":[{"idezet":"<PONTOS idézet a képről>","kep":<szám>,"miert_ai":"...","emberibb":"<rövid, tegező, magyaros>"}],
"bizalom":{"kelt":[{"mi":"...","kep":<szám>,"miert":"..."}],"nem_kelt":[{"mi":"...","kep":<szám>,"miert":"...","javitas":"..."}]},
"megtartando":["<ami jó, ne nyúljunk hozzá>"],
"ugynokseg_maskepp":["<átfogó tervezési elv/döntés, amit egy valódi ügynökség másképp csinálna>"],
"top_7_javitas":["<rangsorolva, a legnagyobb hatású elöl>"]}"""


def kep(f, i):
    im = Image.open(f).convert('RGB')
    w = 1000
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode(), im.size


def main():
    assert len(KEPEK) == 9, KEPEK
    tartalom = [{'type': 'text', 'text': 'AZ OLDAL 9 KÉPSZELETE (asztali gép, fentről lefelé, a szeletek közvetlenül egymás alá illeszkednek):'}]
    meretek = []
    for i, f in enumerate(KEPEK, 1):
        url, sz = kep(f, i); meretek.append(sz)
        tartalom.append({'type': 'text', 'text': f'{i}. szelet: {CIMKE[i]}'})
        tartalom.append({'type': 'image_url', 'image_url': {'url': url}})
    tartalom.append({'type': 'text', 'text': FELADAT})
    uz = [{'role': 'system', 'content': RENDSZER}, {'role': 'user', 'content': tartalom}]
    if '--proba' in sys.argv:
        print('próba: képek', meretek, 'szöveg karakter', len(RENDSZER) + len(FELADAT) + sum(len(c) for c in CIMKE.values())); return
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
            if e.code not in (429, 500, 502, 503, 504): break   # csak ki nem fizetett hibánál próbáljuk újra
        except Exception as e:   # időtúllépésnél nem kérjük újra (lehet, hogy már fizettünk érte)
            hiba = f'{type(e).__name__}: {str(e)[:150]}'; break
        time.sleep(5 * (prob + 1))
    koltseg = float(u.get('cost', 0) or 0)
    ki = {'ido': datetime.datetime.now().isoformat(timespec='seconds'), 'modell': MODELL, 'kepek': [os.path.basename(f) for f in KEPEK],
          'kep_mappa': os.path.dirname(KEPEK[0]), 'kep_meret': meretek, 'cimkek': CIMKE, 'rendszer': RENDSZER, 'feladat': FELADAT,
          'valasz': valasz, 'finish_reason': fin, 'hiba': hiba, 'usage': u, 'koltseg_usd': koltseg}
    json.dump(ki, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'kész: {KI} | hiba: {hiba or "nincs"} | finish: {fin} | tokenek be/ki: {u.get("prompt_tokens")}/{u.get("completion_tokens")} | költség: {koltseg:.4f} $')


if __name__ == '__main__':
    main()
