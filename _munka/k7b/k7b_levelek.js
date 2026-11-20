export const meta = {
  name: 'adozz-k7b-hianyzo-levelek',
  description: 'Adózz.hu k7b: a 13 hiányzó / hiányos levél beépítése a backendbe (felmondás PDF, új üzenet, NAV-hiba, megszűnés, fióktörlés, árkedvezmény, kártyatörlés, már van fiókod, elutasított igazolás) + tesztek + ellenőrzés + biztonságos telepítés',
  phases: [
    { title: 'Építés', detail: 'egy építő, sorban' },
    { title: 'Ellenőrzés', detail: 'helyesség/biztonság + szöveg' },
    { title: 'Javítás és telepítés', detail: 'javítás, tesztek, pg_dump, deploy, ellenőrzés' },
  ],
}
const P = 'C:/Users/UpgradePC/konyvelo_app'
const K = P + '/kod'
const CTX = `PROJEKT: Adózz.hu (${K}: backend Hono+Drizzle+Postgres, app Expo, panel). Szerver: appok-1, /srv/kezjegy (konténerek kezjegy-api, -worker, -web, -db, -proxy); a telepítés módja: ${K}/deploy/README.md. SZABÁLYOK: semmit ne törölj (régi fájl -> _regi/); élő adatbázis: telepítés ELŐTT pg_dump, csak hozzáadó migráció; a tulaj fiókjai (alex@, tulaj@) és a demo belépők működjenek tovább; titkot/kulcsot soha ne írj ki, a /srv/kezjegy/.env értékeit ne olvasd; nincs AI-említés; nincs válaszidő-ígéret (egyetlen engedett: "A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között."); szövegek tegezők, rövidek, magyarosak, "a(z)" nélkül (vagy a meglévő a/az-javító segédfüggvénnyel). A levelek most a meglévő keretben mennek (notify/mailer.ts htmlOf) – az új dizájnsablon (dizajn/email/sablon.html) a k8 része, most NEM kell.`
const FELADAT = `FORRÁS: ${P}/dizajn/email/LEVEL_LEFEDETTSEG.md (2. pont: esemény-táblázat fájl:sor hivatkozásokkal; 3. pont: a hiányzó levelek tárgyával és szövegével) és ${P}/dizajn/email/SZOVEG_JAVITAS_LEVELEK.md (ha már létezik: javított szövegek). A tulaj 11-20 kérte ("a 8-at csináld meg"), hogy ezek készüljenek el MOST – a 3. pont 1–13. tétele:
1) Felmondás PDF-fel e-mailben (kötelező; a notify nem visz csatolmányt -> közvetlen küldés a contracts.ts szerződéslevelének mintájára).
2) Új üzenet: a message_new e-mail-alapértéke legyen BEKAPCSOLVA (aki kifejezetten kikapcsolta, annál maradjon ki); legfeljebb napi egy levél üzenetszálanként/ügyfelenként (összevonás), hogy ne legyen spam.
3) NAV-hiba: ha az ügyfél NAV-lekérdezése hibás technikai felhasználó vagy jogosultság miatt elakad, a könyvelő és az admin kapjon e-mailt (egyszer, nem minden nap ugyanarról; újra csak ha megjavult, majd megint elromlik).
4–5) Megszűnt előfizetés (rendes megszűnés és admin "megszűnt" állapot): ügyfél e-mail + könyvelőnek feladat/e-mail (meghatalmazás visszavonása, technikai felhasználó törlése).
6) Felmondás hatálybalépése: ügyfél e-mail.
7–9) Fióktörlés visszavonva; fiók törölve (az álnevesítés ELŐTT küldve); adatmásolat-hiba (ügyfél + admin).
10) "Már van fiókod": regisztrációkor létező címnél a válasz NE árulja el, hogy a cím létezik (ugyanaz a válasz, mint új címnél), helyette a cím tulajdonosa kapjon levelet (belépés / elfelejtett jelszó). Az app regisztrációs képernyője ehhez igazodjon (ugyanaz az "ellenőrizd a postafiókodat" állapot). Ellenőrizd, hogy ez nem töri el a meglévő regisztrációs/e-mail-megerősítési folyamatot és a teszteket.
11) Árkedvezmény visszavonása: ügyfél e-mail ("Változik a havidíjad"). A hatályosság kérdése (azonnal vagy 30 nap múlva) NYITOTT tulaj-döntés: most a mostani működés marad (azonnali), csak az értesítés készül, és a szöveg a tényleges hatálydátumot írja.
12) Admin törölte a mentett kártyát: ügyfél e-mail.
13) Igazolás nem adható ki (elutasítva): ügyfél e-mail is (most csak push).
14) SZÖVEGJAVÍTÁSOK: a ${P}/dizajn/email/SZOVEG_JAVITAS_LEVELEK.md összes "jogos" és "részben jogos" tételét (54, ebből 17 fontos) vezesd át a forrásba (_shared/*.ts, content/*.ts – a fájl megmondja, hol), a † jelölt egységesítésekkel együtt; és javítsd a fájlban talált két kódhibát (zarolas.ts:82 "havidíj és a éves zárás díja" ragozás; content/k29f.ts:66 a felmondás-levélben duplán kerülne a Dosszié-mondat). A notif.price_changed.body pontra végződő dátum utáni kötőjeles ragot is.
Minden új levélhez: a szöveg a content rendszerben legyen (email.<kulcs>.subject/body a meglévő minta szerint, szerkeszthető), sablon-kulcs a mailer.send template mezőben, és teszt (a meglévő backend tesztek mintájára: a levél kimegy / nem megy ki duplán / a demo outboxba kerül).`

phase('Építés')
const epit = await agent(`${CTX}\n\n${FELADAT}\n\nÉPÍTŐ: valósítsd meg mind a 13 pontot a ${K}/backend (és a 10. ponthoz az app) kódjában. Futtasd a backend teljes tesztkészletét (és a típusellenőrzést), mind zöld legyen. MÉG NE telepíts. Válasz: pontonként mit csináltál (fájl:sor), a tesztek eredménye, és ami nyitva maradt.`, { label: 'epito', phase: 'Építés' })

phase('Ellenőrzés')
const [hely, szoveg] = await parallel([
  () => agent(`${CTX}\n\n${FELADAT}\n\nAz építő jelentése:\n${epit}\n\nELLENŐR (helyesség + biztonság): próbáld bebizonyítani, hogy valami NEM jó: hiányzó pont, dupla levél, rossz címzett, levél a már törölt/álnevesített címre, a "már van fiókod" ágon szivárgás (eltérő válasz, időzítés, státuszkód), eltört regisztráció/megerősítés, migráció hiánya, tesztek zöldje csalással. Futtasd a teszteket. Válasz: talált gondok súlyossággal (blokkoló/fontos/apró), fájl:sor.`, { label: 'ell:helyesseg', phase: 'Ellenőrzés' }),
  () => agent(`${CTX}\n\n${FELADAT}\n\nAz építő jelentése:\n${epit}\n\nELLENŐR (szöveg): olvasd el az ÖSSZES új/módosított levél tárgyát és szövegét a content-ben, mintha az ügyfél (nem ért az adózáshoz) vagy egy új könyvelő olvasná: érthető-e, kiderül-e mi történt és mi a teendő, magyaros-e, nincs-e "a(z)", időígéret, ijesztő hang, belső zsargon (bekötés, ONYA, technikai felhasználó – könyvelőnek mehet, ügyfélnek magyarázat kell). Válasz: kulcsonként javasolt pontos új szöveg, ha kell.`, { label: 'ell:szoveg', phase: 'Ellenőrzés' }),
])

phase('Javítás és telepítés')
const vege = await agent(`${CTX}\n\n${FELADAT}\n\nÉPÍTŐ JELENTÉSE:\n${epit}\n\nHELYESSÉGI ELLENŐR:\n${hely}\n\nSZÖVEGES ELLENŐR:\n${szoveg}\n\nJAVÍTÓ + TELEPÍTŐ: javítsd a blokkoló és fontos gondokat és a szövegeket, a teljes tesztkészlet legyen zöld (és a típusellenőrzés). Utána telepíts a ${K}/deploy/README.md szerint, biztonságosan: pg_dump ELŐTTE (a backups mappába), csak hozzáadó migráció, backend + worker (+ web, ha az app változott), majd ellenőrzés: az API egészséges, a szerver naplójában nincs új hiba, és demo módban egy próba: egy-két új levél a demo outboxba kerül (ne küldj valódi levelet valódi címre). Frissítsd a ${P}/dizajn/email/LEVEL_LEFEDETTSEG.md-t (mi készült el), és a ${K}/SPEC.md-be írj egy rövid k7b szakaszt. Válasz MAGYARUL, röviden a tulajnak: mi készült el pontonként egy mondatban, mi élő, mi maradt nyitva.`, { label: 'javito+telepito', phase: 'Javítás és telepítés' })
return vege
