# Marketing: látogatók, források, kampánylinkek, hirdetési mérés (SPEC §31)

Ez a leírás neked szól: mi fut, hol nézed meg, hogyan készítesz kampánylinket a YouTube-videóidhoz, és lépésről lépésre
hogyan kapcsolod be később a Facebook/Instagram (Meta) és a Google hirdetési mérést. A műszaki szerződés: `SPEC.md` §31.

## 1. Mi fut, és mi nem

**Fut (a telepítés után):**

- **Saját statisztika-szerver (Umami).** Nyílt forrású (MIT licenc), a saját szerverünkön fut (`kezjegy-umami`, saját
  adatbázissal). Az adat nálunk marad, senkinek nem adjuk tovább. **Nem használ sütit**, és a böngészőben sem tárol semmit.
  Csak az adozz.hu nyitóoldalon mér; az appban (app.adozz.hu) nincs követőszkript.
- **A nyitóoldal saját szkriptje** (`js/meres.js`): a Regisztrálok, Belépés és Visszahívást kérek gomb továbbviszi az appba,
  honnan jött a látogató (a hirdetési link `utm_*` adatai, a hivatkozó oldal neve, az érkezési oldal). Csak a linkben, az
  eszközön semmit nem tárol. A statisztikába sem kattintás-azonosító (gclid, fbclid…), sem más paraméter nem kerül, csak az `utm_*`.
- **Marketing fül** a vezérlőpultodban (konyvelo.adozz.hu → Tulajdonos → Marketing). Csak te (admin) látod.

**Elő van készítve, de KI VAN KAPCSOLVA:** a Meta Pixel + Conversions API és a Google Ads címke + szerveroldali
konverzió. Most nincs hirdetési kód az oldalon, nincs süti-ablak, és semmilyen adat nem megy se a Metának, se a
Google-nek. A bekapcsolás lépései az 5. pontban vannak.

## 2. Hol nézed meg: a Marketing fül

Négy rész, felül időszakválasztóval (Ma, 7 nap, 30 nap, 90 nap vagy egyéni):

- **Látogatók és tölcsér:** hány látogató jött, honnan (YouTube, Google, Facebook, Instagram, TikTok, Közvetlen, Egyéb),
  és közülük hányan regisztráltak, töltötték ki az adataikat, fogadták el a szerződést, fizetnek. Telefon vagy gép, ország,
  város. Az oldal részei: a Regisztrálok, Belépés, Visszahívást kérek gombok és az e-mail-cím kattintásai, és hányan
  görgettek le az árakig. Visszahívás-kérések forrásonként.
- **Kampányok és linkek:** a kampánylink-készítő és a kampányok táblája (látogató → regisztrált → fizető → havi bevétel).
- **Pénz forrásonként:** most fizető ügyfelek és a havi bevételük (MRR) aszerint, honnan jöttek. Minden előfizetés a saját
  havidíjával számít (egyedi ár, kedvezmény, ingyenes hónap), ahogy a Konzol is számolja; ha ez eltér az Áttekintés
  számától, a fül kiírja, miért.
- **Hirdetések:** a hirdetési mérés állapota, és a **kézzel rögzített hirdetési költés** → költség/regisztráció,
  költség/fizető. A költést már most is beírhatod (a Meta vagy a Google felületéről), ehhez nem kell kulcs.

Jó tudni:

- A regisztrációk a regisztráció napja, a látogatók a látogatás napja szerint számítanak.
- A tesztfiókok (a saját próbaszkriptjeink) sehol nem számítanak bele.
- A DEMO szerveren a regisztrációk kitalált adatok: az arányokból ott ne vonj le következtetést.
- Az Instagram és a TikTok beépített böngészője gyakran nem árulja el, honnan jött a látogató (ilyenkor „Közvetlen”).
  A hirdetésblokkolók miatt a látogatók száma kevesebb lehet a valóságosnál. Ezért érdemes mindenhol kampánylinket használni.
- Ha a statisztika-szerver épp nem válaszol, a fül ezt kiírja, és csak a saját adatbázisunk számait mutatja (azok pontosak).
  Kitalált számot soha nem mutat.

## 3. Kampánylink a YouTube-videókhoz

1. Marketing → Kampányok és linkek → Kampánylink-készítő.
2. „Hova teszed?” → YouTube-videó leírása. „Kampány” → a videó címe (például: Átalányadó 2027 – röviden).
3. A kész link (például `https://adozz.hu/?utm_source=youtube&utm_medium=video&utm_campaign=atalanyado-2027-roviden`)
   a „Link másolása” gombbal megy a vágólapra. Ezt tedd a videó leírásába vagy a kitűzött kommentbe.
4. Ha ugyanannak a videónak két helyére teszel linket, a „Részlet” mezőbe írd, melyik (például leiras / komment).

A nevekből kisbetűs, ékezet nélküli változat lesz, hogy ugyanaz a kampány mindenhol egy sorban jelenjen meg.

## 4. A statisztika bekapcsolása (a telepítés után egyszer)

A telepítés (up.sh) elindítja a `kezjegy-umami` és `kezjegy-umami-db` konténert. Utána egyszer, a szerveren:

```bash
ssh appok-1 'bash /srv/kezjegy/deploy/umami-beallit.sh'
```

Ez a gyári admin jelszót azonnal véletlenre cseréli, létrehoz egy csak olvasó felhasználót a vezérlőpultnak, felveszi az
adozz.hu oldalt, és a hozzáférést a `.env`-be írja (előtte mentés: `_regi/env_<idő>`). Semmi titkot nem ír ki, csak az oldal
nyilvános azonosítóját. Ezt az azonosítót kell beírni a `kod/landing/meres.json` `umamiWebsiteId` mezőjébe, majd:
`node kod/landing/build.mjs` → `feltolt.sh` → `up.sh`. Ettől kezdve a nyitóoldal lábléce ezt írja: „Ez az oldal nem használ
sütit. A látogatottságot a saját szerverünkön mérjük, süti nélkül, összesítve.” (A korábbi „és nem követ” mondatot a build
magától cseréli.)

A látogató a láblécben ki is kapcsolhatja a mérést a saját gépén („Ne mérjétek a látogatásomat”), és
ha a böngészőjében be van kapcsolva a „Ne kövess” (Do Not Track) jelzés, nem mérjük.

Az Umami saját felülete nincs kint az interneten (a proxy csak a `/m/script.js`-t és a `/m/api/send`-et engedi át). Ha
egyszer mégis kellene: SSH-alagúton, a konténer belső címére (`docker inspect kezjegy-umami`), az admin jelszó a szerveren:
`/srv/kezjegy/.umami_beallitas` (600).

## 5. A hirdetési mérés bekapcsolása lépésről lépésre

**Előtte kötelező:** az ügyvéd átnézte a `kod/jogi/UGYVED_KERDESEK_marketing.md` kérdéseit, és jóváhagyta az adatkezelési
és a süti-tájékoztató hirdetési (bekapcsoláskori) változatát. Amíg ez nincs meg, a mérés maradjon kikapcsolva.

Fiókot létrehozni, belépni, kulcsot kérni a Metánál és a Google-nél csak te tudsz – ezeket a lépéseket te csinálod.

### 5.1 Meta (Facebook, Instagram)

1. business.facebook.com → Events Manager → Adatforrások összekapcsolása → Web → hozz létre egy adatkészletet (pixelt)
   „Adózz.hu” néven. A számokból álló azonosító a **pixel-azonosító** (nyilvános).
2. Az adatkészlet → Beállítások → Conversions API → „Manuális beállítás” → **Hozzáférési token létrehozása**. Ez a
   **titkos** kulcs: ne küldd el senkinek, ne tedd e-mailbe – a 5.3 pontbeli szkript kéri be.
3. Ugyanitt kapcsold KI az „Automatikus speciális egyeztetést” (automatic advanced matching) és az automatikus
   eseménykövetést: mi csak a regisztrációt és az első fizetést küldjük, a szerverről.
4. Próbához: Events Manager → Események tesztelése → a **Test Events kód** (élesben ezt üresen hagyod).
5. Javasolt: Business-beállítások → Márkabiztonság → Domainek → adozz.hu igazolása.

### 5.2 Google Ads

1. ads.google.com → Eszközök → Konverziók → Új konverziós művelet → **Importálás** → „Webhely – kattintásokból”. Két
   művelet: „Regisztráció” és „Első fizetés” (érték: a havidíj, HUF). A műveletek **számazonosítója** kell.
2. Beállítás → Fiókbeállítások → **Automatikus címkézés: be**.
3. Google-címke (AW-…): Eszközök → Google-címke → a címke azonosítója (**AW-123456789**, nyilvános).
4. console.cloud.google.com → új projekt („adozz-hirdetes”) → API-k → **Data Manager API engedélyezése** →
   IAM → Szolgáltatásfiókok → új szolgáltatásfiók → Kulcsok → JSON-kulcs letöltése a gépedre. Ez **titkos** fájl.
5. Google Ads → Rendszergazda → Hozzáférés és biztonság → Felhasználók → „+”: a szolgáltatásfiók e-mail-címe,
   **Standard** hozzáféréssel.
6. A konverziós művelet létrehozása után 4–6 órát várj az első feltöltéssel.

### 5.3 A kulcsok felvitele (a gépedről)

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\hirdetes_kulcsok.ps1
```

A szkript a titkos tokent és a Google JSON-fájlt megjelenítés nélkül kéri be, a nyilvános azonosítókat ellenőrzi, és ha
kéred, a gépeden (HKCU) is megőrzi őket. A szerveren előbb menti a `.env`-et (`_regi/env_<idő>`), a Google-kulcs a
`/srv/kezjegy/hirdetes/google.json` fájlba kerül (600), és újraindítja az API-t. Ha az API nem indul el, visszaállítja a régi
`.env`-et. A végén megkérdezi, bekapcsolja-e a mérést: **először nemmel válaszolj**, és csak a 5.5 pont után kapcsold be.

### 5.4 A nyitóoldal: süti-ablak és CSP

1. `kod/landing/meres.json` → `"hirdetes": true` → `node kod/landing/build.mjs`. Ettől kerül az oldalba a süti-ablak
   („Elfogadom” és „Elutasítom” egyforma gombok, Beállítások partnerenként, alapból minden kikapcsolva, a láblécből
   bármikor újranyitható) és a Meta/Google betöltő kód. A kód akkor is csak akkor fut, ha a szerver kapcsolója be van
   kapcsolva, és csak az „Elfogadom” után tölti be a Meta és a Google szkriptjét (alap „consent mode”: elfogadás előtt a
   Google felé sem megy semmi). A lábléc szövege magától átíródik.
2. `kod/deploy/proxy/caddy/sites/adozz.caddy` → az `adozz.hu` blokkban az `import kezjegy_csp_landing` sort cseréld erre:
   `import kezjegy_csp_landing_hirdetes` (a kész változat ugyanabban a fájlban van; csak a Meta és a Google címeit engedi).
3. `feltolt.sh` → `up.sh` (az up.sh ellenőrzi és újratölti a proxyt: `atallas.sh frissit`).

### 5.5 A tájékoztatók élesítése, próba, bekapcsolás

1. A jogi szövegek bekapcsoláskori változatát (`kod/jogi/bekapcsolaskor/`) az ügyvéd jóváhagyása után be kell vezetni az
   adatkezelési és a süti-tájékoztatóba (új verzió az `index.json`-ban), és az `ADS_NOTICE_VERSION` értékét emelni kell
   (a süti-ablak ettől mindenkit újra megkérdez).
2. Próba: a szkriptet futtasd a Meta Test Events kóddal, a Google-höz állítsd `GOOGLE_DM_VALIDATE_ONLY=true`-ra; regisztrálj
   egy tesztfiókkal „Elfogadom” után, és nézd meg a Meta Események tesztelése oldalát és a Google Ads konverziós
   diagnosztikáját. A vezérlőpult Hirdetések része mutatja: elküldve / várakozik / hibás.
3. Ha minden rendben: futtasd újra a szkriptet teszt kód nélkül, és válaszolj igennel a bekapcsolásra.

### 5.6 Mi megy ki, és mi nem

- Csak annak a látogatónak az adata, aki a süti-ablakban elfogadta (partnerenként külön). A döntést a szerver naplózza
  (`marketing_consents`, álnevesítve), a regisztrációkor a fiókhoz kapcsolja, és minden küldés előtt újra ellenőrzi.
- Esemény: „regisztrált” (CompleteRegistration) és „első fizetés” (Subscribe, összeggel). Adat: SHA-256-tal hash-elt (álnevesített, nem titkosított)
  e-mail-cím, a kattintás-azonosító (gclid / fbclid), a regisztráció böngészőjének adata (a Meta weboldali eseményhez
  kötelező), az esemény ideje és összege. Telefonszám csak `ADS_SEND_PHONE=true` esetén (alapból nem).
- **Adóadat, név, cím, adóazonosító soha.**
- Visszavonás: a látogató a láblécben („Süti-beállítások”), a regisztrált ügyfél az appban (Fiók → Adataim → Hirdetési
  mérés → Visszavonom). Visszavonás után semmi nem megy ki, a még el nem küldött események elvesznek.

### 5.7 Kikapcsolás

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\hirdetes_kulcsok.ps1 -Kikapcsol
```

Ettől a szerver azonnal „kikapcsolva” állapotba kerül: a süti-ablak nem jelenik meg, a Meta és a Google kódja nem töltődik be,
és nem megy ki adat. Ha végleg nem kell: `meres.json` → `"hirdetes": false`, build, és az `adozz.caddy`-ben vissza a
`kezjegy_csp_landing`.

## 6. Nyitott döntések

- **[TULAJ]** Melyik havi bevétel a mérvadó (a Marketing fül az előfizetésenkénti összeget mutatja, az Áttekintés a
  fizetők száma × havidíj).
- **[TULAJ/JOGI]** Mennyi ideig őrizzük a statisztika nyers adatait (az Umami magától nem töröl), a forrásadatokat, a
  kattintás-azonosítókat és a hozzájárulási naplót.
- **[TULAJ/JOGI]** Napi vagy havi „só” a látogatói kódhoz (`SALT_ROTATION` az `.env.umami`-ban; most a gyári havi).
- **[TULAJ]** Kell-e városszintű adat, vagy elég az ország.
- **[TULAJ/JOGI]** Telefonszám is menjen-e a hirdetési partnereknek (alapból nem).
- **[JOGI]** Kell-e hozzájárulás a süti nélküli mérésre (Eht. 155. § (4), EDPB 2/2023) – ha igen, a süti-ablak a statisztikát
  is kérdezi; a kérdéslista: `kod/jogi/UGYVED_KERDESEK_marketing.md`.
- **[JOGI]** A Google-belépés szkriptje a belépő és regisztrációs oldalon kattintás előtt töltődik be.

## 7. Fájlok

- Közös szabály (csatorna, slug, link): `kod/shared/src/marketing.ts`
- Backend: `services/marketing.ts`, `services/umami.ts`, `services/hirdetes.ts`, `routes/admin-marketing.ts`,
  `routes/public-marketing.ts`, migráció `0020_marketing_enumok.sql`, `0021_marketing.sql`, teszt `test/marketing.test.ts`
- Vezérlőpult: `panel/src/pages/admin/Marketing.tsx`, `panel/src/lib/marketing.ts`
- App: `app/src/lib/forras.ts` (a regisztráció, a Google/Apple-gomb, a belépés és a visszahívás küldi)
- Nyitóoldal: `landing/meres.json`, `landing/meres-sablon.js`, `landing/hirdetes-sablon.js`, `landing/build.mjs`, teszt `landing/meres.test.mjs`
- Telepítés: `deploy/docker-compose.yml` (kezjegy-umami, kezjegy-umami-db), `deploy/umami-beallit.sh`, `deploy/gen-env.sh`,
  `deploy/proxy/caddy/sites/adozz.caddy`, `deploy/up.sh`, `deploy/backup.sh`
- Kulcsok: `C:\Users\UpgradePC\konyvelo_app\hirdetes_kulcsok.ps1`
