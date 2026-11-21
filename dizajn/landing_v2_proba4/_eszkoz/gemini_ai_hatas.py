# Külső szem (Gemini, OpenRouter): mennyire tűnik AI-generáltnak / sablonosnak a landing (2. kör előtt, tulaj 11-20 20:45).
# Egy hívás, 9 gépes képszelet (1440 css px, 2x -> 1000 px széles JPEG), két szerep: tapasztalt magyar webdizájner + átlagos magyar vállalkozó.
# Kulcs: HKCU\Environment OPENROUTER_API_KEY, csak a folyamatban (nem kerül fájlba/naplóba).
# Kimenet: landing_v2/_eszkoz/gemini_ai_hatas_1.json (képek base64 nélkül, usage + költség)
import base64, glob, io, json, os, re, sys, time, urllib.request, urllib.error, winreg, datetime
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SCR = 'D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad'
KEPEK = sorted(glob.glob(SCR + '/hq_2040/gep_0[1-9].png'))
KI = 'C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_1.json'
MODELL = 'google/gemini-3.8-flash'
MAX_TOK = 7000

CIMKE = {
    1: 'fejléc; hős (bal: cím, szöveg, ár, gombok; jobb: telefon + mögötte böngészős app-kép és lila/kék doboz, alatta lejátszás-gomb + Főoldal/Dosszié/Üzenetek/Fotózás/Határidők fülgombok + felirat); kék bizalmi sáv 4 ikonnal; „Kinek szól” (zöld „igen” és rózsaszín „nem” kártya)',
    2: '„Hogyan működik” 4 számozott lépés-kártya sárgás alapon; a sötét „Mit kapsz” szakasz eleje: 1. Számlák (görgetésre mozgó telefon) + „Neked ebből:” kiemelő doboz',
    3: '„Mit kapsz”: 2. Félretenni, 3. Határidők (minden lépésnél: színes számkör + címke, nagy cím, szöveg, „Neked ebből:” színes bal szegélyű doboz, telefon lekerekített keretes panelben, mögötte színes ragyogás)',
    4: '„Mit kapsz”: 4. Fotózás, 5. Dosszié, 6. Üzenetek eleje',
    5: '„Mit kapsz”: 6. Üzenetek vége, 7. Keretek; a szakasz végi 3 kis kártya (Telefonon és gépen / A pénzed nálad marad / A NAV-hoz a könyvelőd fordul); a mentazöld könyvelő-szakasz eleje',
    6: 'Könyvelő-szakasz: bal „Egy negyedév a könyvelőddel” idővonal ikonokkal, jobb „Név szerint ismered” / „Egy szerződés, egy felelős” / „Amit soha nem kérünk el” dobozok; Biztonság (levendula alap, 2 felsorolásos kártya)',
    7: 'Árak (bal: havidíj + „Benne van” pipás lista + sárga gomb; jobb: külön díjak listája), alatta 3 pipás sor; „Összevetés” eleje',
    8: 'Összevetés táblázat (Adózz vs. hagyományos iroda); sárga csíkos szaggatott doboz = BELSŐ HELYŐRZŐ a későbbi valódi véleményeknek, élesítés előtt kikerül, EZT NE ÉRTÉKELD; GYIK (harmonika)',
    9: 'GYIK vége; záró kék CTA-sáv + „Előbb beszélnél velünk?” üveghatású doboz; sötét lábléc + impresszum',
}

RENDSZER = """Az Adózz.hu egy magyar online könyvelés-szolgáltatás alanyi ÁFA-mentes, átalányadózó és katás egyéni vállalkozóknak: nyilvántartásba vett, név szerint ismert könyvelő + mobilapp (számlák a NAV Online Számlából, mennyit tegyél félre adóra, határidők, fotózott iratok, üzenet a könyvelőnek). 19 999 Ft/hó bruttó, éves zárás 14 999 Ft/év. Az app nem utal és nem von le pénzt, nem küld be semmit a NAV-nak; a bevallást a könyvelő adja be meghatalmazással. Szolgáltató: Somosi Kft. Az alapító YouTuber-vállalkozó, a weboldalt főleg telefonon nézik majd.
Ez egy még NEM élő dizájnminta értékesítő oldala. A tulaj célja: megbízható, valódi magyar cég benyomása (ő a Billingót és a Számlázz.hu-t hozta példának), emberi kéz munkája, NE sablonos „AI-landing” hatás.
Kötöttségek (a javaslataid ezeken belül maradjanak): az arculat marad (fő kék #1428DB, sárga főgomb #FFC93C, sötét #10152B, Geist betű, az appban Fluent Emoji Flat ikonok), de a használatuk módja változhat. Nem lesz: kitalált vélemény, ügyfélszám, statisztika, díj/elismerés; könyvelő-fotó vagy kitalált könyvelőnév (az app-képeken a „Kovács Bence” bemutató adat); AI-val generált kép; mesterséges intelligencia említése; válaszidő-ígéret (egyetlen engedett mondat: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”); külső betű/CDN/követő kód. Csak valós funkciót mutathatunk. Az árak maradnak. Animáció csak transform/opacity.
Már eldöntött változások a hősben (ezekkel nem kell foglalkoznod): a böngészős app-kép, a lila/kék doboz és a telefon alatti gombsor + felirat kikerül, a telefon csak árnyékot kap, és az oldal minden telefonja valósághű készülékkeretet (mockupot) kap."""

FELADAT = """Két szemmel nézd végig a 9 képszeletet (asztali gép, 1440 px széles nézet, fentről lefelé):
TERVEZŐ = tapasztalt magyar webdizájner, aki ügynökségnél dolgozott, és ránézésre felismeri a sablonos/AI-generált landingokat (pl. Tailwind/shadcn-ízű kártyarácsok, ikon+cím+2 sor kártyák, színes bal szegélyű „callout” dobozok, minden szakasz más pasztell háttér, gradiens ragyogás, eyebrow-címke minden szakasz fölött, egyforma lekerekítés és árnyék mindenen, „X. Y.” kétütemű címek, hármas felsorolások).
VÁLLALKOZÓ = átlagos magyar egyéni vállalkozó (40 körüli villanyszerelő vagy kozmetikus), aki nem ért a dizájnhoz, de érzi, ha valami „gépies”, „túl szép, hogy igaz legyen” vagy „nem igazi cég”.
Kérdések: tűnik-e AI-generáltnak/sablonosnak az oldal; MELY részek és MIÉRT (konkrétan: doboz, ikon, szín, szöveg, elrendezés, tipográfia, mozgás, ismétlődés); mi kelt bizalmat és mi nem; mit tenne egy valódi magyar ügynökség másképp, hogy kézzel tervezett, valódi cég hatása legyen. A tulaj külön AI-hatásúnak érezte: a „Mit kapsz” szakasz dobozait, különösen a „Neked ebből: …” kiemelőket; a szakasz végi 3 kis kártyát; a könyvelő-szakaszt (idővonal + 3 doboz). Ezekre adj külön, konkrét magyarázatot és megvalósítható javítást (CSS/elrendezés szinten), de az EGÉSZ oldalt nézd, mást is jelezz.
Legyél őszinte és konkrét, ne udvariaskodj; ne ismételd magad; mindenhol add meg a képszelet számát. Magyarul, tömören. Válasz CSAK JSON:
{"osszkep":{"tervezo_ai_hatas_1_10":<1=kézzel tervezett, 10=tiszta AI-sablon>,"vallalkozo_ai_hatas_1_10":<szám>,"tervezo_egy_mondatban":"...","vallalkozo_egy_mondatban":"...","legerosebb_ai_jel":"..."},
"ai_jelek":[{"resz":"<szakasz + elem>","kep":<szám>,"tipus":"doboz|ikon|szín|szöveg|elrendezés|tipográfia|mozgás|ismétlődés","miert_ai":"<miért ismerős ez AI/sablon-oldalakról>","ugynokseg_igy_csinalna":"<konkrét, megvalósítható>","sulyossag":"nagy|közepes|kicsi"}],
"tulaj_altal_jelzett":[{"resz":"Neked ebből dobozok|3 kis kártya a Mit kapsz végén|Mit kapsz lépés-elrendezés|könyvelő idővonal|könyvelő 3 doboz","miert_ai":"...","javitas":"<konkrét: mit vegyünk ki, mivé alakítsuk, milyen tipográfia/elrendezés>"}],
"szoveg_ai_jelek":[{"idezet":"<PONTOS idézet a képről>","kep":<szám>,"miert_ai":"...","emberibb":"<rövid, tegező, magyaros>"}],
"bizalom":{"kelt":[{"mi":"...","kep":<szám>,"miert":"..."}],"nem_kelt":[{"mi":"...","kep":<szám>,"miert":"...","javitas":"..."}]},
"megtartando":["<ami jó, ne nyúljunk hozzá>"],
"ugynokseg_maskepp":["<átfogó tervezési elv/döntés, amit egy valódi ügynökség másképp csinálna; pl. színhasználat, ritmus, tipográfiai hierarchia, kevesebb doboz>"],
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
        print('próba: képek', meretek, 'szöveg karakter', len(RENDSZER) + len(FELADAT)); return
    kulcs = winreg.QueryValueEx(winreg.OpenKey(winreg.HKEY_CURRENT_USER, 'Environment'), 'OPENROUTER_API_KEY')[0]
    test = json.dumps({'model': MODELL, 'messages': uz, 'temperature': 0.4, 'max_tokens': MAX_TOK,
                       'response_format': {'type': 'json_object'}, 'reasoning': {'effort': 'low'}, 'usage': {'include': True}}).encode()
    hiba = ''; valasz = None; u = {}; fin = None
    for prob in range(2):
        try:
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=test,
                                         headers={'Authorization': 'Bearer ' + kulcs, 'Content-Type': 'application/json', 'X-Title': 'Adozz landing-ai-hatas'})
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
          'kep_meret': meretek, 'cimkek': CIMKE, 'rendszer': RENDSZER, 'feladat': FELADAT,
          'valasz': valasz, 'finish_reason': fin, 'hiba': hiba, 'usage': u, 'koltseg_usd': koltseg}
    json.dump(ki, open(KI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'kész: {KI} | hiba: {hiba or "nincs"} | finish: {fin} | tokenek be/ki: {u.get("prompt_tokens")}/{u.get("completion_tokens")} | költség: {koltseg:.4f} $')


if __name__ == '__main__':
    main()
