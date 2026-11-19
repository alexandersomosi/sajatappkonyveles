# kod/jogi – jogi szövegek és PDF-ek

**TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács.** (Utolsó változás: 2026-11-19, SPEC §27 – „Intézzük helyetted”, egy megfogalmazás a kiállított számlákról, „anyukád”, belső jegyzetek nélküli ügyfélszövegek; a nyitott kérdések: `UGYVED_KERDESEK_k5.md`.) Minden szöveg vázlat, amelyet ügyvédnek át kell néznie, mielőtt valódi ügyfél elé kerül. A szövegekben szögletes zárójelben, kiemelve vannak a nyitott kérdések: **[JOGI]** = jogász dönt, **[TULAJ]** = a tulajdonos dönt, **[KÖNYVELŐ]** = a könyvelő erősíti meg, **[CÉGADAT]** = a Somosi Kft. adata hiányzik, **[ELLENŐRIZNI]** = külső adat, amelyet a szerződéskötéskor ellenőrizni kell, **[SIMPLEPAY]** = a SimplePay kötelező szövege jön a helyére.

A termék neve sehol nincs beégetve: a szövegekben `{{brand.name}}` áll, az értéke a `kod/shared/brand.json` → `name` mezőből jön (SPEC §3.4). A cégadatok ugyanonnan (`provider`).

## Mi van itt

| Fájl | docType | Kinek | Mire |
|---|---|---|---|
| `aszf.md` | `aszf` | ügyfél | Általános Szerződési Feltételek az előfizetéshez (Somosi Kft. a szolgáltató), a végén a Ptk. 6:78. § szerinti kiemelt feltételek |
| `adatkezeles.md` | `adatkezeles` | ügyfél | Adatkezelési tájékoztató (GDPR 13. cikk): célok, jogalapok, megőrzési idők, adatfeldolgozók, Pmt.-adatok, NAV-kulcsok, jogok |
| `megbizasi_szerzodes.md` | `megbizasi_szerzodes` | ügyfél | Megbízási szerződés minta: az ügyfél a Kft.-vel szerződik, a könyvelő a Kft. közreműködője; a GDPR 28. cikk szerinti „adatfeldolgozás a nevedben” pont benne van |
| `nav_meghatalmazas.md` | `nav_meghatalmazas` | ügyfél + könyvelő | ONYA/UJEGYKE útmutató, a bejelölendő ügycsoportok, jóváhagyás 4 napon belül, visszavonás, kitöltés a könyvelőnek |
| `sablonok/nav_meghatalmazas_okirat.md` | (a `nav_meghatalmazas` PDF-je) | ügyfél | Kinyomtatható / e-aláírható állandó meghatalmazás okirat (csak a `alairt_pdf` úthoz; az ONYA-hoz nem kell) |
| `adatfeldolgozoi.md` | `adatfeldolgozoi` | Kft. ↔ könyvelő | Adatfeldolgozói szerződés (GDPR 28. cikk), 1. melléklet: biztonsági intézkedések, 2. melléklet: további adatfeldolgozók. Az appban nem jelenik meg |
| `pmt_nyilatkozatok.md` | `pmt_nyilatkozatok` | ügyfél | Pénzmosás elleni azonosítás: miért, milyen fotó, milyen adat, a 4 nyilatkozat szövege (tényleges tulajdonos, kiemelt közszereplő, valóság, változásbejelentés) |
| `sablonok/pmt_adatlap.md` | (a `pmt_nyilatkozatok` PDF-je) | könyvelő | Kitöltött ügyfél-átvilágítási adatlap a Pmt. szerinti nyilvántartáshoz (titkosítva, csak a könyvelő látja) |
| `sablonok/ev_bejelentes_utasitas.md` | (önálló sablon, `sablonok/sablonok.json`) | ügyfél + könyvelő | **Új (11-19, SPEC §27.3.3):** „Utasítás a vállalkozásom bejelentésére” – az „Intézzük helyetted” úton az ügyfél appban adott engedélyéről készülő PDF: a jóváhagyott adatok, a nyilatkozat, az utasítás, időpont, ujjlenyomat. A backend tölti ki az engedélykor; dossziéba kerül (`szerzodes_alairt`, közös) |
| `sablonok/sablonok.json` | – | backend | Az önálló sablonok jegyzéke (név, fájl, **verzió**, cím). `AssistConsentSummary.version` = az utasítás itteni verziója |
| `UGYVED_KERDESEK_k5.md` | – | jogász, tulaj | **Új (11-19):** a 11-19-i változásokhoz tartozó rövid kérdéslista (zugírászat / Üttv. az egyéni vállalkozói nyilvántartási részre, díj, képernyőképek felhasználása, utasítás, megőrzés) |
| `simplepay_adattovabbitas.md` | `simplepay_adattovabbitas` | ügyfél | Adattovábbítási nyilatkozat – saját szavas vázlat, a SimplePay kötelező szövegére cserélendő |
| `simplepay_ismetlodo.md` | `simplepay_ismetlodo` | ügyfél | Ismétlődő bankkártyás fizetés nyilatkozata (alkalom, összeg, határidő paraméterekkel) – szintén cserélendő |
| `app_szovegek.json` → `app_szovegek.md` | `app_szovegek` | app + backend | Rövid szövegek: ár, megújulás, lemondás, kártyatörlés, fizetési eredmények (§9.5), azonosítás, fióktörlés, új vállalkozás (`uj_vallalkozas.*`), „Intézzük helyetted” (`helyettunk.*`, a shared ASSIST_TEXTS jogásznak szóló másolata), 13 GYIK (a 11-19-én változottaknál `elozo_kerdes` / `elozo_valasz`), és a `tartalom` blokkban a SPEC §26–§27 tartalomkulcsai közül a jogásznak szólók (visszahívás, ügyfél-értesítések, köztük a §27.8 „Intézzük helyetted” és kamara értesítései). **A JSON a forrás**, az .md ebből készül |
| `index.json` | – | backend | A dokumentumok listája (SPEC §21) + bővítések, lásd lent |
| `pdf_minta/*.pdf` | – | jogász, tulaj | Mintapéldányok kitalált adatokkal (Szabó Kata, Kovács Bence): minden PDF-es dokumentum, a megbízási szerződés elfogadás utáni másolata (`_elfogadva`), a kézzel kitölthető meghatalmazás (`_ures`), az ONYA-útmutató és a Pmt.-szöveg olvasható változata (`_szoveg`) |
| `_kepek/*.png` | – | – | A minták oldalképei (vizuális ellenőrzéshez; pdf.js-szel, headless Chrome-ban renderelve) |
| `_regi/` | – | – | Korábbi változatok (nem töröljük): `par26_elott_20261118_1130/` = a 2026-11-18 verzió; `par27_elott_20261119/` = a 2026-11-18.2 / .3 verzió (a 11-19-i változtatás előtt), amelyet a bekötés alatti fiókok (köztük a tulaj fiókjai) elfogadhattak (ÁSZF 11.3: kérésre elküldjük) |
| `src/` | – | backend | A kitöltő és a PDF-szedő (`@kezjegy/jogi` csomag) |
| `fonts/` | – | – | Geist Regular és SemiBold statikus példány (OFL, lásd `fonts/OFL.txt`) |
| `kepek/fejlec_guilloche.png` | – | – | A jóváhagyott fejléc-textúra (dizajn/C2_modern/assets/textura) |

## Futtatás

```
cd kod/jogi
npm install            # .npmrc: legacy-peer-deps (npm 10.9 + vitest 5 hiba, mint az ado-motornál)
npm run minden         # build → app_szovegek.md → ellenőrzés → 45 teszt → pdf_minta/
```

Külön-külön: `npm run build`, `npm run ellenoriz` (TERVEZET-sor, szűk Markdown, csak ismert helyőrzők, nincs beégetett márkanév, friss app_szovegek.md, és a SPEC §26 tartalmi szabályai: lásd lent), `npm test`, `npm run minta`.

Ha szöveget javítasz: az .md-t (vagy az app_szovegek.json-t) szerkeszd, írd át a verziót az `index.json`-ban (és a `requiresReconsent`-et, ha az ügyfeleknek újra el kell fogadniuk), majd `npm run minden`. **Verzió:** `ÉÉÉÉ-HH-NN`, ugyanazon a napon a második kiadás `ÉÉÉÉ-HH-NN.2` (…`.9`); szövegként rendezve is nő, a backend így a legújabbat veszi. Megjelent szövegen verzióemelés nélkül ne változtass: a backend a `legal_documents` sort docType + verzió szerint frissíti, és a régi elfogadások ugyanarra a verzióra mutatnának.

### Tartalmi szabályok (`src/szabalyok.ts`, az ellenőrző és a tesztek is futtatják)

- **SPEC §27 (11-19):** a vállalkozás bejelentését a könyvelő csak **kérésre, meghatalmazottként, az ügyfél utasítása szerint** küldheti be („Intézzük helyetted”). Hiba, ha egy mondat feltétel nélkül azt állítja, hogy „mi bejelentjük”, ha szerinte a csapat (ügyfélszolgálat) küld be valamit, ha a „bejegyeztet…”, az „ügyintézési díj” vagy a nem tagadott „jogi képviselet” szerepel, vagy ha a belépési adatok megadására kér. A későbbi változások bejelentése a meghatalmazás alapján megengedett. A „soha nem kérjük el” (a belépést) mondat az ÁSZF-ben, az adatkezelési tájékoztatóban, a szerződésben, a meghatalmazás-leírásban és a „Bejelentitek helyettem…” GYIK-ben kötelező.
- Az ügyfél anyjának nevére az appban „anyukád”, a jogi szövegben „anyja születési neve” – a régi tegező alakot az ellenőrző hibának veszi (`anyadSzo`). A kiállított számlákról csak a shared `INVOICE_WORDING` szerint írunk (`szamlaTiltott` = a SPEC §27.5.4 tiltott mintái; az `elozo_*` GYIK-mezők szándékosan a régi szöveget őrzik, ezeket a teszt kihagyja).
- Időpontot foglalni már nem lehet: csak a megszűnéséről vagy a korábbi foglalásokról szólhat mondat (O2.5).
- A lakcímkártya hátoldalát soha nem kérjük (Pmt. 7. § (8), O7.4). Nincs „AI”, nincs magázás.
- 13 GYIK; a SPEC §26.2.7 / §27.10 öt kérdése szó szerint (a backend az élő adatbázisban a kérdés szövege alapján keres, ezért a meglévő 8 kérdés szövegét se írd át). Ha egy meglévő kérdés vagy válasz változik, az elemre kerül az `elozo_kerdes` (csak ha a kérdés változott) és az `elozo_valasz` = a pontos régi szöveg: a backend adatlépése (SPEC §27.7.3) csak akkor írja át az élő sort, ha még szó szerint a régi áll benne.
- `tartalom`: csak létező SPEC §26–§27 tartalomkulcs (`notif.<fajta>[.<változat>].title|body`, `email.…`, `visszahivas.*`); `{egy}` kapcsos helyőrző; a push-értesítésként is menő fajták szövegében nincs összeg, telefonszám, adószám; a `visszahivas.adatkezeles` = a SPEC §26.2.2 mondata.
- Az ÁSZF 13. pont kiemelt feltételei és az app `szerzodes.kiemelt` listája ugyanannyi pont; a `nav_meghatalmazas.md` bejelölt ügycsoportjai = `meghatalmazas.ugykorok`.
- Figyelmeztetés (nem hiba): ha a backend tartalom-alapértéke (`backend/src/content/defaults.hu.json`, `tulaj1118.ts`, `tulaj1119.ts`) más szöveget ad egy `tartalom`-kulcsra (a futó szerverben a jogi `tartalom` az utolsó szó, `backend/src/content.ts`), vagy ha egy `helyettunk.*` szöveg eltér a shared `ASSIST_TEXTS`-től (az app azt mutatja).
- Az önálló sablonok (`sablonok/sablonok.json`) fájljai léteznek, és minden `sablonok/*.md` vagy az index `pdfTemplate`-je, vagy a jegyzék eleme.

## A backendnek (SPEC §12, §21)

A csomag ESM, `dist/`-be épül, mint az ado-motor. Függőség: `"@kezjegy/jogi": "file:../jogi"`. A Docker-képbe a `kod/jogi` mappa kell (index.json, *.md, sablonok/, fonts/, kepek/, dist/).

```ts
import { betoltIndex, forras, kitoltottDokumentum, jogiPdf, appSzovegek } from '@kezjegy/jogi';

// induláskor: legal_documents upsert
for (const e of await betoltIndex()) { const f = await forras(e.docType); /* f.elem.version, f.sha256, f.elem.requiresReconsent */ }

// GET /legal/:docType → { docType, version, title, markdown }
const d = await kitoltottDokumentum('aszf');                       // márka + cég kitöltve, ügyféladat nélkül
// bejelentkezett ügyfélnek a megbízási szerződés a saját adataival:
const m = await kitoltottDokumentum('megbizasi_szerzodes', { adat: { 'ugyfel.nev': 'Szabó Kata', /* … */ } });

// GET /client/legal-pdf/:docType (megbizasi_szerzodes, nav_meghatalmazas) → application/pdf
const p = await jogiPdf('nav_meghatalmazas', { adat, hiany: 'ures' });   // p.pdf, p.fajlnev
// elfogadás után a szerződés másolata (dosszié: szerzodes_alairt, e-mail):
const s = await jogiPdf('megbizasi_szerzodes', { adat, hiany: 'ures', elfogadas: { nev, idopont: acceptedAt } });
// a Pmt.-adatlap a KYC elfogadásakor (kind 'kyc', csak a könyvelő):
const k = await jogiPdf('pmt_nyilatkozatok', { adat: { 'kyc.nev': …, 'nyilatkozat.sajat_nevben': 'x', /* … */ }, hiany: 'hiba' });

// appszövegek és GYIK (content_texts / faq_items seed)
const a = await appSzovegek();   // a.szovegek['lemondas.kovetkezmeny'], a.gyik[0..11], a.tartalom['visszahivas.adatkezeles']
```

**`tartalom` blokk (SPEC §26.8.1, §26.11):** a kulcsok pontosan a `content_texts` kulcsai (`visszahivas.*`, `notif.<fajta>[.<változat>].title|body`). A helyőrző itt `{egy}` kapcsos zárójel, ezt a backend tölti ki; az `appSzovegek()` nem nyúl hozzá. A backend alapértékei egyezzenek vele; két szándékos eltérés a SPEC §26.11-től: `notif.callback_received.body` (+ „vagy a kártyaadataidat”), `notif.registration_checked.title` („Átnéztük a bejelentésedet” – az átnézésünk nem hatósági ellenőrzés). A GYIK négy új kérdését a backend egyszeri adatlépése (SPEC §26.9.3) veszi fel az élő adatbázisba; a meglévő sorokat nem írja felül.

- **Hiányzó adat:** `hiany: 'cimke'` → „[HIÁNYZÓ: az ügyfél neve]” (előnézet), `'ures'` → kipontozott vonal (kézzel kitölthető), `'hiba'` → `HianyzoAdatHiba` (éles PDF, ha minden adatnak meg kell lennie).
- **Biztonság:** a beillesztett ügyféladatból a `**`, a sortörés és a `{{ }}` kikerül (nem változtathatja meg a szöveg szerkezetét); egymenetes kitöltés.
- **Elfogadási záradék:** a PDF végére kerül: ki, mikor (budapesti idő), hogyan, melyik verzió, és a **kitöltött szöveg SHA-256** ujjlenyomata (`p.sha256` – ezt érdemes a `consents` sorhoz is eltárolni).
- **Olvasható változat PDF-ben:** `jogiPdf(docType, { pdfSablon: false })` – pl. az ONYA-útmutató; alapból a `pdfTemplate` (okirat, adatlap) készül.
- **Betűk:** `betuDir` paraméterrel a `FONT_DIR` is megadható; a fájlnevek `Geist-Regular.ttf`, `Geist-SemiBold.ttf`.
- **PDF-ek mérete:** ~95–155 KB (betűrészhalmaz + textúra); `textura: false` → kb. 30 KB-tal kisebb.

**SPEC §27 (11-19) – a backendnek és az integrátornak:**

- **Belső jegyzetek nélkül:** a `kitoltottDokumentum()` és a `jogiPdf()` az ügyfélnek szóló (`audience: 'ugyfel'`) dokumentumból kiveszi a `[JOGI…]`, `[TULAJ…]`, `[KÖNYVELŐ…]`, `[ELLENŐRIZNI…]` jegyzeteket (`belsoJegyzetek: true` → maradnak). A backend saját kitöltője (`backend/src/legal.ts`) ugyanezt teszi a `BELSO_JEGYZET_MINTA` mintájával és a `belsoJegyzetekNelkul()` sorkezelésével: `[ \t]*(**)?[(JOGI|TULAJ|KÖNYVELŐ|ELLENŐRIZNI|OWNER)(/…)*(: …)?](**)?` törlése, a kiürült sor (vagy üres listaelem) elhagyása, legfeljebb egy üres sor.
- **Az utasítás PDF-je („Intézzük helyetted”, SPEC §27.3.3):** `sablonok/ev_bejelentes_utasitas.md`, a verzió a `sablonok/sablonok.json`-ban (most `2026-11-19`; ez az `AssistConsentSummary.version`). A backend a `deps.legal.template('ev_bejelentes_utasitas.md')`-vel olvassa, és ezekkel tölti ki: `ugyfel.nev`, `utasitas.adoazonosito_jel_takart` („•••••••456”), `konyvelo.nev`, `konyvelo.nyilvantartasi_szam`, `utasitas.szekhely`, `utasitas.telephely`, `utasitas.tevekenysegek`, `utasitas.munkavegzes`, `utasitas.adozas`, `utasitas.kezdes` (a `blocks` sorai „; ”-vel egy sorba fűzve), `utasitas.nyilatkozat_szoveg` és `utasitas.utasitas_szoveg` (pontosan az appban mutatott `declarationText` / `instructionText`), `utasitas.idopont` („2026. november 19., 14:05”, Europe/Budapest), `utasitas.ujjlenyomat` (a `consent_hash`), `utasitas.verzio`. A beillesztett értékből a `**`, a sortörés és a `{{ }}` kerüljön ki (mint a jogi `biztonsagosErtek()`), és a belső jegyzet is (fent). Mintapéldány: `pdf_minta/ev_bejelentes_utasitas.pdf`; a jogi csomagban: `kitoltottSablon()` / `sablonPdf('ev_bejelentes_utasitas', { adat })`.
- **GYIK (SPEC §27.7.3):** a változott elemeken `elozo_kerdes` / `elozo_valasz` = a pontos régi szöveg (`{{helyőrzőkkel}}`); a backend mindkettőt `fillLegal()`-lal tölti ki, és csak akkor írja át az élő `faq_items` sort, ha a kérdése és a válasza még szó szerint a régi. Új kérdés: „Mit jelent, hogy jóvá kell hagynom a meghatalmazást?” (13.). Az átnevezett: „Miért nem ti jelentitek be a vállalkozásomat?” → „Bejelentitek helyettem a vállalkozásomat?”. Az `elozo_*` mezők szándékosan a régi (ma már tiltott) számla-megfogalmazást is tartalmazhatják: a SPEC §27.5.4 szövegellenőrzése ezeket hagyja ki, és az app másolata (`app/scripts/jogi-szovegek.mjs`) nyugodtan elhagyhatja őket.
- **Értesítések (SPEC §27.8):** a `tartalom` blokkban a hét új ügyfél-értesítés (`notif.assist_*`, `notif.kamara_reminder`, a változatokkal), a `visszahivas.csalas` és a `notif.callback_received.body` „…és nem lépünk be helyetted” kiegészítéssel, és az egy újrapróbálási mondat (`notif.subscription_payment_failed.body`: „1, 3 és 7 nap múlva”, mint a `RETRY_DAYS` és az ÁSZF 6.5.). A futó szerverben a jogi `tartalom` felülírja a kód alapértékét (`backend/src/content.ts`), ezért a helyőrzők pontosan a SPEC §27.8 szerintiek: `{firstName}`, `{hatarido}` („november 22-ig”), `{clientName}` nincs ügyfélszövegben.

### Helyőrzők

A teljes lista a `src/helyorzok.ts`-ben (leírással és kitalált demóértékkel). A SPEC §21 listáján felül: `{{ceg.kepviselo}}`, `{{dok.verzio}}`, `{{dok.hatalyos}}`, `{{dok.cim}}` (automatikus), `{{ugyfel.email}}`, `{{konyvelo.keresztnev}}`, `{{konyvelo.cim}}`, `{{konyvelo.adoszam}}`, `{{elofizetes.alkalom}}`, `{{elofizetes.honapok}}`, `{{elofizetes.max_osszeg}}` (konfig, tartalékkal: 12 / 12 / havidíj), `{{elofizetes.lejarat_ig}}`, `{{elofizetes.idoszak_vege_ig}}`, `{{elofizetes.kovetkezo_levonas}}`, `{{elofizetes.szunetel_datum_ig}}`, `{{simplepay.tranzakcio}}`, `{{hatarido.kovetkezo}}`, `{{arvaltozas.datum_tol}}`, `{{arvaltozas.uj_ar}}`, `{{kyc.*}}`, `{{nyilatkozat.*}}` (jelölőnégyzet: `x` vagy szóköz). Az `_ig`/`_tol` végű kulcsok a raggal együtt várják az értéket („2027. január 8-ig”) – a `datumIg()` segít.

### Markdown

`#`, `##`, bekezdés, `- ` lista, `**félkövér**` (SPEC §21). Két visszafelé kompatibilis bővítés: `1. ` számozott lépés és `- [ ]` / `- [x]` jelölőnégyzet. Egy egyszerűbb szedő ezeket sima szövegként mutatja, ami így is olvasható.

## Fontos szakmai döntések a szövegekben

1. **AVDH nincs** (2025 óta megszűnt, SPEC §10.1). A meghatalmazást az ügyfél maga jelenti be az ONYA-ban (UJEGYKE, „Meghatalmazó”), csatolmány és aláírás nélkül; vagy a könyvelő jelenti be, és az ügyfél **4 naptári napon belül** jóváhagyja (NAV GYIK).
2. **Ügycsoportok:** főlap D blokk 1. sor „ADÓÜGYEK (kivéve egyes jövedéki ügyek)” + UJEGYKE-5 (Vegyes ügyek) 3. sor „Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)”. Az ADÓÜGYEK kell a NAV Online Számla elsődleges felhasználói joghoz is (NAV: Az Online Számla rendszer használata). Fizetési kedvezmény csak külön kérésre. Iratátvételre kijelölés: üres. Jogcím: **9 – könyvelő** a nyilvántartási számmal (UJEGYKE kitöltési útmutató 2026.01.01.).
3. **Lakcímkártya: csak a lakcímes oldal.** A Pmt. 7. § (8) a lakcímkártya személyi azonosítót igazoló oldalának másolását kifejezetten kizárja. A SPEC §10.3 és a panel `addressBack` mezője ezért **nem kérhető** – lásd SPEC §24 jegyzet.
4. **Az ügyfél nem fogyasztó** (egyéni vállalkozóként, a vállalkozása érdekében szerződik) → nincs 14 napos elállás, de bármikor, díjmentesen lemondhat; a kifizetett hónap végéig él a szolgáltatás. [JOGI]
5. **Lemondás és a negyedév:** ha a negyedév utolsó hónapját kifizette, a negyedéves bevallást még beadjuk. Azonnali felmondásnál a hátralévő napok díját visszautaljuk (a backendben nincs automatikus visszatérítés – a SimplePay kereskedői felületen kézzel). [TULAJ]
6. **Felelősség:** a mi hibánkból eredő bírságot és pótlékot megtérítjük; az adó maga nem kár. Felső határ [TULAJ/JOGI], a szándékos és súlyosan gondatlan károkozásra nem vonatkozik.
7. **Szerepek (GDPR):** a Kft. az adatkezelő; a könyvelő a Kft. adatfeldolgozója; az ügyfél vevőinek adataiban a Kft. az ügyfél adatfeldolgozója. [JOGI] – lásd lent.
8. **SimplePay-szövegek:** a két nyilatkozat saját szavas vázlat a kötelező elemekkel; élesítés előtt a SimplePay által adott pontos szövegre kell cserélni.
9. **Új vállalkozás – két út (tulaj, 11-19; SPEC §27.3).** Alapból az ügyfél maga jelenti be: útmutatót, jelölt NAV-képeket, videót adunk, és átnézzük a NAV-os értesítést (ÁSZF 4/A.). **Kérésre („Intézzük helyetted”, ÁSZF 4/C.)** visszahívás után a könyvelő a saját belépésével, a NAV-nál nyilvántartott állandó meghatalmazottként (UJEGYKE, mindkét ügycsoport) beküldi a meghatalmazást, az ügyfél 4 naptári napon belül jóváhagyja az ONYA-ban; új vállalkozásnál az ügyfél az appban átnézi az adatokat, megteszi a nyilatkozatát és írásban engedélyezi a bejelentést (`sablonok/ev_bejelentes_utasitas.md`), és a könyvelő pontosan ezekkel az adatokkal küldi be a Vállalkozói Ügysegédben. A bejelentés az ügyfél írásbeli jognyilatkozata marad (Evectv. 6. § (4)), beküldés után nem vonható vissza. Az ügyfél belépését soha nem kérjük el, nem lépünk be helyette, és nem irányítjuk távolról a gépét (a DÁP szerint ez jogellenes). A csapat (ügyfélszolgálat) a NAV-nál nem jár el. **[JOGI]** az egyéni vállalkozói nyilvántartási (nem adóügyi) részre: Üttv. 2. §, 4. §, Btk. 286. § – addig a szerveren kikapcsolható (`ASSIST_EV_ENABLED`), és 2026-12-31 után magától kikapcsol.
10. **Díj új vállalkozásnál:** alapból az adószám rögzítése után indul (SPEC §26.1.7 `adoszam_utan`); addig az útmutató, az átnézés és a visszahívás ingyenes. Ha a tulaj az `azonnal`-t választja, írd át: ÁSZF 2.3. utolsó mondat és 4/A.6., megbízási szerződés 2.7. és 5.1., GYIK 12., `uj_vallalkozas.dij`, „Röviden” 5. pont.
11. **Visszahívás:** 24–48 órás vállalás (nem garancia), munkanapokon 9–17, bárki hívhat a csapatból, a hívást nem rögzítjük, rövid jegyzet készül, az összefoglaló üzenetben is megy; telefonon nem véglegesítünk adót és határidőt (ÁSZF 4/B., megbízás 6.6.). Jogalap: szerződés / szerződés előtti lépés, hozzájárulás-pipa nincs; megőrzés: a lezárás után 1 év.
12. **Adatminimalizálás:** TAJ, anyja neve, születési hely/idő, állampolgárság, a székhely-jogcím irata – új vállalkozásnál nem kérjük (az ügyfél a NAV-os űrlapba írja, vagy a NAV tölti ki); ha a NAV-os értesítésen szerepelnek, csak az irat részeként, titkosítva tároljuk (Adatkezelési tájékoztató 2.15.). Az „Intézzük helyetted” engedélyénél az IP-címből csak vissza nem fejthető kódot tárolunk (mint az elfogadásoknál), belépési adatot semmit (2.16.).
13. **Ki mit lát:** az ügyfélszolgálat (szerep `csapat`) csak a bekötés alatti üzeneteket, a visszahívásokat, az új vállalkozások adatait (a NAV-os értesítéssel) és az „Intézzük helyetted” kéréseket (az adóazonosító jelet takarva) látja; a teljes telefonszámot csak az, aki a hívást intézi; a teljes adóazonosító jelet a beküldéshez csak a könyvelő (naplózva) (Adatkezelési tájékoztató 3.4., 2.16., SPEC §26.4, §27.6.3).
14. **Újraelfogadás:** a 2026-11-18.2 és a 2026-11-19 változatoknál is `requiresReconsent: false` (SPEC §26.12, §27.10): a tulaj élő, bekötés alatti fiókjai nem akadhatnak el. Az élesítés előtt a jogász dönti el, kell-e újra elfogadtatni.
15. **Belső jegyzetek (11-19, k3 kör 2 tulaj 12):** a `[JOGI…]`, `[TULAJ…]`, `[KÖNYVELŐ…]`, `[ELLENŐRIZNI…]` jegyzetek a forrásban maradnak, de az ügyfélnek szóló kitöltött szövegből és PDF-ből kikerülnek (`belsoJegyzetekNelkul`, minta: `BELSO_JEGYZET_MINTA`; a belső adatfeldolgozói szerződésben maradnak). A `[CÉGADAT: …]` és a `[SIMPLEPAY: …]` hiányzó értéket jelöl, az kitöltésig látszik. Ahol a jegyzet egy értéket pótolt (felelősségi korlát, számlázó és telefonszolgáltató), a szövegben `[CÉGADAT: …]` áll.
16. **Névelő:** a kitöltő a „a(z) {{…}}” alakot a kitöltött érték szerint „a” / „az” alakra írja (`nevelokFeloldasa`, ugyanaz a szabály, mint a backend `huArticle()`-je); a minták már nem írnak „a(z)”-t.

## Kérdések a jogásznak

A 2026-11-19-i változások („Intézzük helyetted”) kérdései külön, röviden: **`UGYVED_KERDESEK_k5.md`**. Az alábbi lista a korábbi (11-18-i) kérdéseké; a 12. pont az „Intézzük helyetted” miatt tovább élesedett.

1. Elég-e a fotós okmányfeltöltés a Pmt. szerinti azonosításhoz személyes jelenlét vagy auditált elektronikus hírközlő eszköz (Pmt. 7. § (10)) nélkül? Ha nem: kellene-e auditált videóhívás (az időpontfoglalás 11-18-án megszűnt, helyette telefonos visszahívás van, ez azonosításra nem alkalmas), vagy más szolgáltató átvilágítására támaszkodhatunk-e?
2. A Somosi Kft.-nek kell-e könyvviteli/adótanácsadói tevékenységi kör és nyilvántartott szakember, ha a munkát alvállalkozó könyvelő végzi? Pmt.-szolgáltatónak minősül-e a Kft. (belső szabályzat, kijelölt személy, bejelentkezés a NAV pénzügyi információs egységénél)?
3. A NAV-meghatalmazás a könyvelőnek (9-es jogcím) vagy a Kft.-nek (15-ös jogcím, ha jogosult) szóljon? A 15-ös esetén könyvelőcserénél nem kell új meghatalmazás.
4. A könyvelő a NAV előtti képviseletben és a saját Pmt.-kötelezettségeiben önálló adatkezelő-e (az adatfeldolgozói szerződés 5.3. pontja), és jó-e, hogy az ügyfél vevőinek adataiban a Kft. az ügyfél adatfeldolgozója?
5. Megfelel-e az elektronikus (jelölőnégyzetes, bejelentkezett fiókból tett, időbélyeggel és ujjlenyomattal tárolt) elfogadás a megbízási szerződéshez (Ptk. 6:7. § (3) írásbeliség, Ptk. 6:82. §)?
6. Kizárható-e a fogyasztói minőség, és mi a helyes illetékességi kikötés?
7. A felelősség felső határa és a szakmai felelősségbiztosítás.
8. A push-értesítések harmadik országba továbbítása (Expo, USA): jogalap (DPF/SCC); javaslat: a push szövegébe ne kerüljön összeg.
9. Megőrzés a szerződés vége után (könyvelési iratok az elévülésig, jogos érdek alapján).
10. DÁP eAláírás használható-e egyéni vállalkozóként a meghatalmazáshoz (DÁP szerint magáncélra szól).
11. Kell-e adatvédelmi tisztviselő.
12. Az új vállalkozás bejelentéséhez adott útmutató és a feltöltött NAV-os igazolás átnézése nem minősül-e ügyvédi tevékenységnek (Üttv. 2. §, 4. §)? Maradhat-e a fizetős meghatalmazásban az „Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)” ügycsoport (Üttv., Btk. 286. §)? Ha nem: a `meghatalmazas.ugykorok` listából és a `nav_meghatalmazas.md`-ből kell kivenni (az app és az útmutató ebből dolgozik), **és a meghatalmazás-videóból is**: a `video/meghatalmazas/forgatokonyv.json` m18–m19 sora („A vegyes ügyeknél jelöld az egyéni vállalkozói nyilvántartást is”) és a 13-as kép (`utmutato_kepek/meghatalmazas/13_ev_nyilvantartas`) kikerül, majd `python video/vallalkozas_bejelentes/eszkoz/epit.py meghatalmazas` és `bash kod/deploy/feltolt.sh --media` – különben a videó mást mond, mint az útmutató.
13. A szerződéskötés előtt, ingyen adott útmutatóra (ÁSZF 4/A.) elég-e az ÁSZF, vagy a regisztrációkor külön rövid feltételt kell elfogadtatni; milyen felelősség áll fenn az útmutató hibájáért?
14. A visszahívás adatainak jogalapja (GDPR 6. cikk (1) b), hozzájárulás nélkül) és megőrzése (1 év a lezárás után); elég-e a „nem rögzítjük” tájékoztatás; a hívásjegyzet érintetti hozzáférése.
15. A NAV hivatalos képernyőképeinek felhasználása az útmutatóban és a videókban (Szjt. 1. § (4): hivatalos közlemény-e a NAV segédlete; a felületek grafikai elemei) – lásd `utmutato_kepek/forrasok.md`.
16. A nyilvántartás nyilvános adatainak pontos köre (Evectv. 12. §) – az ÁSZF 4/A.4. erre hivatkozik.
17. A meg nem kötött szerződés (elállt új vállalkozás) adatainak megőrzése: fióktörlésig, legfeljebb 1 évig az utolsó belépés után (Adatkezelési tájékoztató 2.15.) – az automatikus törlés még nincs a rendszerben.
18. Az új ÁSZF / adatkezelési tájékoztató / megbízási szerződés (2026-11-18.2) miatt kell-e újra elfogadtatni (`requiresReconsent`).
19. A könyvelő adóazonosító jelének megmutatása a hozzá rendelt ügyfeleknek a meghatalmazáshoz (adatfeldolgozói szerződés 14.3.) – jogalap.

## A tulajdonos teendői

- Cégadatok a `kod/shared/brand.json` → `provider`-be: székhely, adószám, cégjegyzékszám, ügyfélszolgálati e-mail (és ha kell, `representative`: az ügyvezető neve). Utána `npm run minta`.
- Döntések: türelmi idő (alap: 14 nap), késedelmi kamat (alap: nincs), az éves SZJA-bevallás a megszűnéskor, visszatérítés azonnali felmondásnál, válaszidő-vállalás, külön munkák árai, a Kft. ÁFA-helyzete, a korábbi időpontok, a visszahívások és a hirdetési adatok megőrzése, számlázó szolgáltató, mentési hely.
- SimplePay-szerződéskor: a két kötelező szöveg, az adatkezelési tájékoztató linkje, a pontos cégnév és székhely.
- Az alvállalkozói (fő) szerződés a könyvelővel – ez még nincs megírva, csak az adatfeldolgozói melléklete.
- Új döntések (SPEC §26.15): mikor indul a díj új vállalkozásnál (alap: adószám után – ha `azonnal`, lásd fent a 10. pontot); milyen számról hívunk vissza (`CALLBACK_CALLER_ID`), és ha telefonközpontot használunk, ki az (adatfeldolgozó); a 48 óra naptári vagy munkaórában; az ügyfélszolgálat munkatársai munkaviszonyban vagy megbízással dolgoznak-e; a visszahívási adatok és az elállt új vállalkozások adatainak megőrzési ideje.
- 2027. január 1. előtt: az új vállalkozás útmutatóját és az ÁSZF 4/A.5. pontját frissíteni kell (a nyilvántartást a kamara veszi át).

## Források

- NAV – Állandó meghatalmazás (GYIK): https://nav.gov.hu/ugyfeliranytu/valaszol-a-nav/allando-meghatalmazas
- NAV – UJEGYKE kitöltési útmutató (2026.01.01.), nyomtatvány 13.0: https://nav.gov.hu/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/UJEGYKE
- NAV – Az Online Számla rendszer használata (elsődleges felhasználó, technikai felhasználó): https://nav.gov.hu/Elethelyzetek-adozasa/vallalkozas/Regisztracio-az-Online-Szamla-rendszerben
- NAV – A Vállalkozói Ügysegéd útmutatója (2026.03.19.): https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fvallalkozoknak%2Findulo-vallalkozas%2Fkapcsolodo-tartalmak%2Fa-vallalkozoi-ugyseged-utmutatoja
- Evectv. (2009. évi CXV. tv.) 3., 6. § (4), 12., 16. §; 2027-től: 2026. évi III. tv. (kamarai nyilvántartás): https://net.jogtar.hu/jogszabaly?docid=a0900115.tv
- Art. 16. § (2), 1. melléklet (bejelentkezési adatok, ÁFA- és átalányadó-választás): https://net.jogtar.hu/jogszabaly?docid=a1700150.tv
- Üttv. (2017. évi LXXVIII. tv.) 2., 4. §; Szjt. (1999. évi LXXVI. tv.) 1. § (4)
- SPEC §26 (tulaj-kérések 11-18), különösen §26.1.4, §26.2, §26.4, §26.12
- Pmt. (2017. évi LIII. tv.): https://njt.jog.gov.hu/jogszabaly/2017-53-00-00 – 1. § (1) h), 4. §, 5. § f), 7. § (2) a), (8), (10), 8. §, 12. § (3), 56–58. §
- Art. (2017. évi CL. tv.) 202. § – elévülés; Számv. tv. (2000. évi C.) 169. §; Ptk. 6:22., 6:78., 6:82., 6:152., 6:272. §; Eht. 155. § (4); Ekertv. (2001. évi CVIII.); GDPR; Infotv. (2011. évi CXII.)
- SimplePay fejlesztői dokumentáció (SPEC §25)
