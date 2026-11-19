# Könyvelői és tulajdonosi felület (`kod/panel`)

React 19 + Vite 8 + TypeScript 5.9 + react-router 8 + TanStack Query 5. Statikus SPA; élesben a `kezjegy-web`
(Caddy, `:8081`) szolgálja ki a `https://konyvelo.45-94-65-74.sslip.io` alatt, az API ugyanazon a hoston
`/api/v1` (SPEC §3.1) – nincs CORS, a frissítő token HttpOnly sütiben jön (`kj_rt`, `X-Kezjegy: 1`).

A terméknév egyetlen helye: `kod/shared/brand.json → name` (a fejléc, a böngészőfül, a logó kezdőbetűje és a favicon is ebből jön).

## Parancsok

```bash
npm install            # .npmrc: legacy-peer-deps=true (az npm 10 arborist-hibája miatt a vitest opcionális peerjeivel)
npm run dev            # http://localhost:5174, /api -> VITE_API_PROXY (alap: http://localhost:8080)
npm run dev:mock       # backend nélkül: böngészőn belüli MINTA-API (src/mock), ?mock_role=accountant|admin|csapat|none
npm run typecheck
npm test               # vitest: formázók, validátorok, API-kliens (frissítés, hibák)
npm run build          # tsc + vite build -> dist/  + scripts/check-dist.mjs (nincs mock-kód, nincs source map)
npm run kepek          # build:mock + 68 képernyőkép 1440×900 -> _kepek/ (Chrome, külön --user-data-dir képenként; `node scripts/screenshots.mjs k3_` csak a §26-osak)
```

`predev`/`prebuild` futtatja a `sync`-et: `kod/shared` → `src/_shared/` (generált, ne szerkeszd) és a jóváhagyott
dizájnelemek → `public/a/` (3D ikonok, rajzolt könyvelő-karakter, illusztrációk, papír/guilloche textúra, rozetta,
favicon). A `public/a/` másolatai a mappában vannak, így a build a dizájnmappa nélkül is megy.

## Telepítés (az integrátornak)

`npm ci && npm run build`, majd a `dist/` tartalma → `/srv/kezjegy/web/panel/` (SPEC §20.1). A Caddy `try_files {path} /index.html`
kell (SPA). Futásidejű env nincs. CSP-kompatibilis: nincs inline script, a betű (Geist, `@fontsource-variable/geist`, OFL) a saját
hostról jön, külső hívás nincs.

## Mit tud (FUNKCIOK ↔ útvonal)

Könyvelő
- `/ugyfelek` (20) – szűrők darabszámmal: Bekötés alatt · Rendben · Hiányzik valami · Határ közelében · Díj elmaradt · Mind; keresés; következő határidő, kérések, új iratok, ÁFA-keret.
- `/ugyfelek/:id/…` (21) fülek: **Áttekintés** (adatok, adóazonosító „Mutasd”, 2026-os adóprofil: 45/80/90 %, jogállás, garantált bérminimum, ÖVTJ, iparűzési adó, szünetelés/kieső idő, előző könyvelő adatai; keretek; előfizetés; belső jegyzet) · **Bekötés** (2–7: mérföldkövek, lépések jóváhagyása/visszaküldése megjegyzéssel, meghatalmazás „Ellenőriztem a NAV-nál”, Pmt.-azonosítás megtekintése és elbírálása, **NAV-kapcsolat**: technikai felhasználó írásvédett mentése, ellenőrzés, lehívás, napló, súgó §8.6) · **Dosszié** (12–15, 23: hónapváltó, húzd-ide feltöltés több fájllal/egy iratba fűzve, láthatóság, állapot soronként és tömegesen, irat-részlet előnézettel és megjegyzéssel az ügyfélnek; „Bence látta” automatikusan) · **Kiállított számlák** (12, 33: a NAV Online Számlából naponta letöltött számlák listája, részlet, bevétel napjának javítása; az útvonal `nav` maradt) · **Bevételek** (9, 22, 27: havi oszlopdiagram, kézi tétel, kizárás okkal, CSV) · **Adó** (8, 22, 23: negyedévek, ado-motor eredménye havi bontásban, figyelmeztetések, „Hogyan jött ki?” pontosan úgy, ahogy az ügyfél látja, levél kézírásos aláírással, kézi módosítás indoklással, **Jóváhagyom és elküldöm** megerősítéssel, befizetés ellenőrzése/eltérés, **Beadva**: 2658 PDF + NAV-visszaigazolás feltöltése, újranyitás okkal) · **Üzenetek** (16, 24: csevegés, csatolmány, sablonok) · **Kérések** (17, 24: mindkét irány, új kérés mintákkal, lezárás, igazolás eredményének csatolása) · **Visszahívások** (SPEC §26.3.5: az ügyfél visszahívásai olvasásra, a neki átadottak megnyitása, „Visszahívás felvétele”, a régi foglalt időpontok olvasásra) · **Napló** (28). Új vállalkozásnál a Bekötés fülön a „Vállalkozás bejelentése” lépés csak összefoglaló (a csapat dolga, nem „Rád vár”); a Pmt.-nézőben nincs lakcímkártya-hátoldal.
- `/hatarido-figyelo` (25) heti tábla előző/következő héttel + lemaradás; `/keresek` (17, 24) sor igazolásokkal; `/sablonok` (24); `/visszahivasok` (csak a neki átadott visszahívások; a menüben akkor jelenik meg, ha már kapott egyet); `/export` (27) CSV; `/naplo` (28); `/beallitasok` (válaszidő, havi kivonatkérés, jelszó, kétlépcsős belépés QR-ral, munkamenetek, aláírás-előnézet). Időpontfoglalás nincs többé (SPEC §26.2.9): `/idopontok` → `/visszahivasok`, a régi oldal kódja `_regi/idopontok_kivezetve_2026-11-18/`.

Tulajdonos (admin)
- `/admin` (29, 30) MRR, KPI-k, díjbevétel havonta, bekötési tölcsér, könyvelők terhelése · `/admin/ugyfelek` (29, 30) üzleti adatok + könyvelőcsere · `/admin/elofizetesek`, `/admin/fizetesek` (29) újrapróbálás, lemondás, hibakódok · `/admin/konyvelok` (30) terhelés, meghívás (névragozással §16) · `/admin/forrasok` (31) UTM + ajánlókódok · `/admin/szovegek` (32) GYIK és értesítés/e-mail szövegek kitöltendő-rész-ellenőrzéssel és előnézettel · `/admin/naplo` (28, 35) · `/admin/demo-postafiok` (csak DEMO) · `/admin/rendszer` (33, 35) integrációk módja, háttérfolyamat, NAV-lehívás, mentés kora.
- A tulajdonos szerepkör üzleti adatot lát; iratot, üzenetet, azonosítást, NAV-adatot nem (SPEC §1, §4.2).
- §26: `/admin/csapat` munkatársak (meghívás, felfüggesztés/visszakapcsolás, terhelés), `/admin` két új csempe (visszahívások, vállalkozás-indítás), és ugyanaz a `/visszahivasok` + `/vallalkozas-inditas`, mint a csapatnak (mások visszahívását „Átveszem tőle”).

Ügyfélszolgálat (szerepkör `csapat`, SPEC §26.3–§26.4) – csak ezt a négy menüpontot látja, kezdőlap `/visszahivasok`
- `/visszahivasok` sor: szűrők darabszámmal (Nyitott, Lejárt, Enyém, Nincs gazdája, Lezárt, Mind), téma, keresés; lejárt elöl, határidő-visszaszámlálás (24 óráig semleges, utána borostyán, 48 óra után piros), kísérletek „1/3”; 480 px-es fiók: **Magamra veszem** (csak utána látszik a teljes szám, Másolás + tel: link), **Most hívom** (15 perc), **Hívás eredménye** (beszéltünk + összefoglaló az ügyfélnek, nem vette fel, foglalt, hibás szám, később kérte + időpont; 120 perces figyelmeztetés), **Átadom** (csapat, tulajdonos, az ügyfél könyvelője, vissza a sorba), **Lezárom hívás nélkül** (ok + megjegyzés), belső jegyzet automatikus mentéssel, hívások, előzmények.
- `/vallalkozas-inditas` tábla (≥ 1280 px oszlopok: Adatokat tölt · Útmutatónál · Ellenőrzésre vár · Javításra vár · Adószámra vár · Kész 30 nap, alatta Elállt; keskenyebben szűrő + táblázat), borostyán jel, ha > 3 napja az útmutatónál vagy > 1 napja vár ránk, óra-ikon, ha visszahívást kért. `/vallalkozas-inditas/:id`: **Adatok** (javítható fiókban, ÖVTJ-kód tevékenységenként, a javaslatok, belső jegyzet) · **Útmutató és NAV-os igazolás** (haladás, beküldés napja és módja, a feltöltött kép nagyítható, a PDF új lapon nyílik – a panel CSP-je nem enged keretet; 9 pontos ellenőrzés → **Rendben, ellenőriztem** / **Javítást kérek**) · **Adószám** (ellenőrző számjegy, ÁFA-kód ≠ 1 esetén borostyán figyelmeztetés, nyilvántartási szám, nyilvántartásba vétel napja → **Rögzítem**), gazda, előzmények. A csapat maga semmit nem ad be a NAV-nál: alapból az ügyfél küldi be az útmutatónk alapján, kérésére („Intézzük helyette”) a könyvelője meghatalmazottként, a saját belépésével; aki beküldte, az nem nézheti át (négy szem elve).
- `/uzenetek` csak a bekötés alatt álló ügyfelek beszélgetései (olvasatlan jelzés, csatolmány); az ügyfél „Anna · ügyfélszolgálat” néven látja. `/beallitasok`: csak biztonság.

Belépés: `/belepes` (e-mail + jelszó, utána TOTP vagy visszaállító kód), `/jelszo` (e-mail-kódos visszaállítás),
`/ketlepcsos-beallitas` (kötelező 2FA, ha a backend `403 totp_setup_required`-et ad – SPEC §24 panel-megjegyzés).
Ügyfél-szerepkörrel a panel nem enged be. Google-belépés a panelen nincs (a könyvelőket és a munkatársakat a tulajdonos hívja meg).
Minden oldal szerepkörhöz kötött (`App.tsx` `Csak`); a menü a `src/lib/csapat.ts` `menuCsoportok` szerint épül (tesztelve). A tiltást az API is betartja (SPEC §26.4).

## Dizájn

Kézjegy C2 asztali méretben: Geist, kék (#1428DB, 11-18 17:50) sáv a guilloche-rozettával és a nagy számmal, színezett alap (#E4E8F3)
fehér lapokkal, a könyvelő levele papíron kézírásos aláírással. Ikon kizárólag a jóváhagyott 3D PNG (`src/ui/Icon3d.tsx`):
a 16 alap + a 04-es képernyőn már használt `szamlak`, `boritek`, `bevallas` és az árnyék nélküli/`befizetve_jel` változatok.
Vonalas ikon, ikonkészlet, ikon mögötti kör nincs. A könyvelő a rajzolt karakter (`karakter_1_lapos`). Kapszula = gomb,
18 px = lap, 12 px = mező/csempe, 6 px = állapotcímke, 4 px = a levél; árnyék csak lebegő rétegen (fiók-lap, felugró, levél).

## Mappák

```
src/api/        client.ts (token, frissítés, hibák, feltöltés-folyamatjelző), endpoints.ts (MINDEN hívás), types.ts (panel DTO-k)
src/auth/       munkamenet, belépés, jelszó, 2FA
src/layout/     oldalsáv + tartalom
src/pages/acc/  könyvelői oldalak; ugyfel/ = az ügyfél-adatlap fülei
src/pages/admin tulajdonosi oldalak
src/pages/csapat ügyfélszolgálat (SPEC §26): Visszahívások, Vállalkozás-indítás (+ részlet), Üzenetek, „Visszahívás felvétele”
src/pages/kozos közös darabok (napló-tábla, üzenetbuborék)
src/ui/         3D ikon, fejléc, fiók-lap, levél + aláírás, mérő, oszlopdiagram, állapotok
src/lib/        magyar formázás (Ft, dátum, Europe/Budapest), validátorok, címkék
src/mock/       CSAK `--mode mock`: böngészőn belüli MINTA-API kitalált adatokkal (fixtures.json) – normál buildben nincs benne
scripts/        sync-assets, gen-paths, check-dist, screenshots
_kepek/         képernyőképek
```

## 1. ellenőrző kör javításai (2026-11-19)

- **Adó fül:** „Eltérés” tételnél „Rendben, pótolta” (soronként és összesítve), a visszajelzés azt mondja, ami igaz („a másik tételnél az
  eltérés még nyitva van”). Kézi módosítással jóváhagyott negyedévnél a számítás áthúzva, mellette a jóváhagyott összeg; a „Hogyan jött ki?”
  előnézet azt mutatja, amit az ügyfél lát; az indok mezője: „kötelező – az ügyfél is látja”. Beadás után a kijelölt negyedév marad.
- **1280×720:** mind a tíz ügyfél-fül elfér (≤ 1360 px: kisebb köz, szükség esetén tördel), a havi adótábla, az ügyféllista, a csapat- és az
  előfizetés-tábla nem lóg ki. A csevegő magassága az ablakhoz igazodik (`ui/useCsevegoMagassag.ts`), az író sor mindig látszik.
- **Kétlépcsős belépés:** 403 `reauth_required` → „Mostani jelszó” mező a fiókban (`KetlepcsosBeallitas`).
- **Fiók-lap:** beírt szöveggel a bezárás (kattintás mellé, Esc, „Bezár”) előbb rákérdez („Elvetem / Folytatom”).
- ÖVTJ’25 kód (6 számjegy, ellenőrzéssel), egysoros szegmensek, teljes lenyíló érték; egy MRR-meghatározás a két admin oldalon
  (`admin/dashboard.mrrHuf`), világos „Ft” a kék sávon, külön tanács a sikertelen kártyaregisztrációhoz; a naplóban magyar kulcsok,
  belső azonosító sehol; „2658-as”; mérföldkövek: tömör korong, kész = ibolya pecsét; pipa-jel helyett pecsét vagy szó.
- Ellenőrző szkriptek: `scripts/jav1/` – `panel_helyi.mjs` (14 ellenőrzés a valódi backenddel; a harness: `../app/scripts/jav1/harness.mjs`),
  `panel_mock.mjs` (mock képek 1280 és 1440 px-en, túlcsordulás-méréssel). Képek: `_kepek/jav1_*`.

## Tulaj-kérések 11-19 (SPEC §27) – panel

- **Intézzük helyette** (`/helyettunk`, menü: Visszahívások és Vállalkozás-indítás között; csapat és tulajdonos mindig, a könyvelő akkor,
  ha ügyfelének volt ilyen kérése). Sor: szűrők darabszámmal (Nyitott · Nálam · Ügyfélre vár · Lejárt jóváhagyás · Kész · Mind),
  fajta, keresés; oszlopok: Ügyfél · Mit kért · Állapot · Kinél a labda · Következő határidő (visszaszámlálás, „Jóváhagyás: nov. 19.”) ·
  Napja · Kié. A szűrés és a számlálás helyben, a `GET /team/assists?filter=mind` listából (`src/lib/helyettunk.ts`, tesztelve).
- `/helyettunk/:id`: felül egy „Most” sáv (ki mit csinál most, határidő). 1. oszlop: ügyfélkártya útvonal-előzménnyel és
  „Útvonal módosítása” gombbal, **Adatok a beküldéshez** (név, adóazonosító jel – a könyvelőnek és a tulajdonosnak „Mutasd”, a csapatnak
  csak maszkolva –, jogcím, ügycsoportok másolás-gombbal), **Amit az ügyfél engedélyezett** (a befagyasztott adatok, időpont, változat;
  piros sor, ha a kérdőív azóta változott), a kérdőív olvasásra. 2. oszlop: a **belépési adat soha** szabály, az összecsukható
  „Így küldd be meghatalmazottként” kézikönyv, a **4 napos jóváhagyás** időzítője (beküldve, az ügyfélnek mondott nap, a NAV törlési
  ideje, emlékeztetők), és fázisonként a pipalista (automatikus mentés, ki és mikor pipálta) a fázis gombjával: „Egyeztettünk – elindítom”,
  „Beküldtem az UJEGYKE-t” (jogcím), „Él a meghatalmazás”, „Lejárt – újra kell küldeni” (csak a határidő után), „Beküldtem a bejelentést”
  (értesítés-fájl, beküldés napja, adószám, nyilvántartási szám). A letiltott gomb alatt ott az ok (pl. „Ezt csak Bence küldheti be, a saját
  belépésével.”). 3. oszlop: gazda, belső jegyzet, idővonal, „Lezárom” okkal.
- **Visszahívások**: „…_helyettem” témánál kiemelt sáv a kérés állapotával; „Beszéltünk” után a hívás pipalistája és „Egyeztettünk –
  elindítom” / „Később”; más témánál „Kéri, hogy intézzük helyette?”; az útvonal és a módosítása a fiókban (hívás után).
- **Vállalkozás-indítás**: „Intézzük helyette” címke és szűrő, a kérés állapota a kártyán; „Útvonalat váltott – már van vállalkozása”
  az Elállt helyett; a részletnél kiemelt sáv, ügyfélkártya útvonallal, négy szem elve az ellenőrzésnél.
- **Könyvelő, Bekötés fül**: „Útvonal és Intézzük helyette” lap (előzmények, a kérés, „Rád vár”), a meghatalmazás-lépésnél a kérés lépései.
- **Tulajdonos**: „Intézzük helyette” csempe az Áttekintésen; az Ügyfelek listán **Fiók letiltása / Engedélyezem** (ok kötelező, megerősítés).
- **Értesítések** (oldalsáv): a munkatárs saját értesítései (`/me/notifications`) olvasatlan-számmal, kattintásra a hivatkozott oldal.
- Szóhasználat: „Kiállított számlák” (fül, dosszié-szakasz, bevételek), „Letöltöttük”; `src/lib/szoveg.test.ts` figyeli a tiltott
  mondatokat (`INVOICE_WORDING_FORBIDDEN_PATTERNS`), az „anyád/édesanyád” szót, a köztartozásmentességi igazolás egy alakját és a
  beégetett terméknevet. A 2FA-titok Geist, táblázatos számjegyekkel; a munkamenet-címke a `brand.json`-ból; a járulékbevallás
  száma az évből jön (2658 → 2758).
- MINTA: `?mock_role=csapat|accountant|admin`; Kiss Marika (jóváhagyásra vár), Molnár Dávid (egyeztetve, Bencénél a labda),
  Balogh Ilona (hívásra vár), Vass Tímea (engedélyezte – beküldhető), Farkas Lili (lejárt a 4 nap), Kertész Nóra (kész),
  Szűcs Gergely (útvonalat váltott). Képek: `node scripts/screenshots.mjs k5_` → `_kepek/k5_*.png` (`KEPEK_PORT` állítható).

## SPEC §28 + §28.K (tulaj-kérések 11-19, k6) – panel

- **Ügyfél-adatlap:** új fül **Kedvezmények** (Adó és Üzenetek között, jelvény = `allowancesPending`; katásnál és üres bekötésnél rejtve): balra az ügyfél válaszai
  személyzeti szavakkal (verzió, egészségügyi hozzájárulás ideje, megjegyzés, régi jelzés, „Kérés küldése” a gyermekek adóazonosítójára), jobbra tételenként:
  javaslat okai, figyelmeztetések, 12 hónap-kapcsoló, anyák jogcíme, első házasok Ft/hó, családi havi táblázat (összecsukva, ha minden hónap azonos),
  „Év közben, az előlegben”, „Családi járulékkedvezmény év közben”, **élő hatás-becslés** (`POST …/allowances/preview`, 400 ms) az évre **és negyedévenként**
  (a mostani negyedév kiemelve), **Jóváhagyom / Kérdezek / Nem jár**; a CSED/GYED tétel „Kieső időként felveszem” → Áttekintés adóprofil előtöltött kieső
  szakasszal, mentés után a tétel jóváhagyva (`?kieso=&ig=&kedvezmeny=csed_gyed`). Új fül **Éves zárás** (§28.K.3): év-váltó, állapot, határidők, díj (DEMO),
  a kérdőív válaszai (visszatérítési számla „Mutasd”), iratok, ellenőrzőlista, „Tervezet feltöltése”, „Beadtam az SZJA-bevallást / a kata-nyilatkozatot”,
  „Beadtam a HIPA-bevallást”. **Napló** fülön „Értesítések, amiket kapott” (értesítési napló, lásd lent).
- **Áttekintés** (C-stílusú kártyák, szakaszok közt 8 px `#EEF1F8` sáv): „Ezt látja az ügyfél” (Félretenni most + Mennyit keresett; fiókban a számlánkénti
  félretenni-tábla és a havi kereset-tábla, csak olvasásra), Kata-kártya (keret-mérő, következő befizetés, céges számla figyelmeztetés), Szünetel,
  Alkalmazottak/EFO döntés (§28.K.7, szöveg az ügyfélnek kötelező, kivéve „nincs teendő”), „Adószám hiányzik – töltsd ki az ONYA-ból” (§28.K.9),
  Adózási mód átállítása (átalány ↔ kata, dátummal), havi ellenőrzés tételei, továbbító e-mail-cím (DEMO).
- **Zárolás** (§28.K.5): piros sáv minden fül tetején + fejléc-címke „Zárolva: díj elmaradt (… óta, … Ft)”; letiltva (súgószöveggel): negyedév
  jóváhagyása, beadás, új kérés, kedvezmény-döntés, éves zárás lépései, adószám rögzítése, „Intézzük helyette” beküldő gombjai.
- **Kiállított számlák / Bevételek:** „Félretenni” oszlop (a sor `reserve` mezője, vagy `GET /acc/clients/:id/reserve` szerint `navInvoiceId` /
  `revenueItemId` alapján), tooltip: részek + zóna személyzeti szóval; katásnál a vevő típusa („cég – a katát megszünteti”).
- **Ügyfelek lista:** új szűrő „Zárolva”, plusz-chipek: „Kedvezmény vár (n)”, „Éves zárás: n vár rád”, „Havi változás (n)”, „Kata (n)”; sorcímkék.
- **Új oldalak:** `/havi-valtozasok` (könyvelő, tulajdonos; csapat csak az „Intézzük helyette” kérést kapott tételeket, olvasásra) – szűrők, tétel-fiók
  döntéssel (kész / csapat intézi / nem kell teendő + indok), egy kattintásos hatások (adóprofil, szünetelés, kedvezmény-újranézés, alkalmazott-döntés);
  `/admin/dijak` – díjbeállítások (Módosítom / Megerősítem / Előzmények, havidíj-emelésnél ≥ 30 nap), egyszeri díjak (Visszatérítettem / Elengedem okkal).
- **`/helyettunk`:** „Változások (mind)” szűrő; a 6 változás-fajta részlete: díj-sáv (előre fizetendő, DEMO), „Az új adatok” mezőnként másolás-gombbal,
  `CHANGE_HANDBOOK`, fázisok `valtozas_adatok` → „Adatok rendben – engedélyt kérek”, `valtozas_bejelentes` → NAV-értesítés + „Beküldtem a
  változásbejelentést”, majd négy szem: „A NAV elfogadta – lezárom” (csapat/tulajdonos), utána „Utómunka nálunk” pipalista „Megnyitom” linkkel
  (az adóprofil-szerkesztő előtöltve, pl. `?szunetel=…`). Saját állapot-feliratok a változás-fajtákra (`allapotFelirat`).
- **Beállítások:** a válaszidő-mező nem fogad időígéretet (`RESPONSE_TIME_FORBIDDEN_PATTERNS`, §28.K.15). **Szövegek:** új csoportok és események (§28.9,
  §28.K.19), minta-helyettesítők. **Tipográfia (§28.K.10 panel):** oldalcím 24, szakaszcím 18 sötét, gombok 38–40, ikonok 28, fülek 14; a régi stílus
  `_regi/styles_elotte_k6_1119/`.
- k5-maradványok: #5 (csapat-üzenetlista: útvonalváltásnál nem „elállt”, „Most ez jön nála: …”) és #12 („lehívás” → „letöltés a NAV rendszeréből”) javítva.
- MINTA: §28.11 / §28.K.21 személyek (`src/mock/k28.ts`, `data.ts`): Szabó Eszter (kedvezmény vár), Tóth Bálint (fiatal25, értesítési napló), Kovács Ádám
  (székhely, engedélyre vár), Varga Réka-Demo (szüneteltetés beküldve), Lakatos Gréta (kata, céges számla), Kiss Norbert (havi változás, díjra vár),
  Fazekas Ilona (zárolva), Bárány Tamás (EFO + adószám később), Molnár Csilla (szünetel); Molnár Eszter (első házasok + CSED). `?mock_today=2027-03-20`
  = későbbi „ma” az éves zárás képeihez. Képek: `node scripts/screenshots.mjs k6_` (1440), `KEPEK_SZEL=1280 node scripts/screenshots.mjs k6_…` (1280).

### §28 builder notes (B3 → B1/B0; szerződés-kiegészítések, a panel opcionálisan olvassa)
> **Integrátor k6, 11-19:** az 1. (`GET /acc/clients/:id/notifications`), a 2. (`GET /admin/fee-charges?status=`) és a 3. pont (`?status=nyitott|mind`, csapat olvashatja a `GET /acc/checkin-items`-t), valamint a `POST /acc/clients/:id/adoszam` (§28.K.9) a backendben megvan (`backend/src/routes/acc-k28.ts`, teszt: `backend/test/k6-integ.test.ts`). Nyitva: 5. (`TeamThreadRow.journeyNext/pathChanged`) és az `AdminClientRow.serviceLock`.
1. **`GET /acc/clients/:id/notifications?cursor=`** (A saját ügyfél, AD; csapat 404) → `AccNotificationLog` (`src/api/types.ts`): `items[]` = az ügyfél
   értesítései (`kind`, `variant`, `title`, `body` = a megjelenített szöveg, `link`, `createdAt`, `readAt`, `push { wanted, sentAt, notBefore, skipped:
   'csendes_ido'|'napi_limit'|'kikapcsolva'|'nincs_eszkoz'|null, amountsShown }`, `email { sentAt } | null`), `settings` (az ügyfél
   `NotificationSettings`-e vagy null), `skippedInvoices[]` (az utolsó 30 nap ki nem értesített kiállított számlái a `notify_state` okkal). Push-tokent,
   e-mail-címet nem ad vissza. Audit nem kell (saját ügyfél adata).
2. **`GET /admin/fee-charges?status=`** (AD) → `{ items: AdminFeeChargeRow[] }` (= `FeeChargeView` + `client { id, name }`) – a §28.K.1 csak a
   `waive` / `refunded` POST-ot nevezi meg; a lista kell a visszatérítéshez.
3. `GET /acc/checkin-items` és `GET /admin/fees` válasza lehet tömb vagy `{ items }` – a panel mindkettőt elfogadja. `GET /acc/checkin-items?status=mind`
   kell (a panel helyben szűr). Csapatnak ez az egy `/acc/` útvonal nyitott (csak az assist-os tételek).
4. `GET /acc/clients/:id/annual?year=` → `AccAnnualView | null` (null = arra az évre nincs sor). Feltöltések multipartban: `draft` (`file`),
   `filed-szja` (`file`, `filedOn`), `filed-hipa` (`file` nem kötelező, `filedOn`).
5. `TeamThreadRow` + `journeyNext?: string | null` és `pathChanged?: boolean` (k5 #5) – ha megvannak, a csapat-üzenetlista ezt mutatja.
6. A „Kieső időként felveszem” után a panel a `csed_gyed` tételre `{ status: 'jovahagyva', months, inYear: true }` döntést küld – a backend fogadja el
   `csed_gyed`-re is (az nem megy a motorba, csak lezárja a tételt).
7. A változás-fajtáknál a `TeamAssistDetail.checklist` csak a ténylegesen meglévő fázisokat adja (a `hivas` csak visszahíváskor) – a panel ebből dönti el,
   mutat-e hívás-fázist.
