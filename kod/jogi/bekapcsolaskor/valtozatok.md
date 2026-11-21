TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács.

# Kész szövegváltozatok bekapcsoláskor (nem jelenik meg az ügyfélnek)

Ez a fájl NINCS az `index.json`-ban, és a Docker-kép sem viszi (csak a gyökérbeli `*.md` kerül bele), ezért senki nem látja. Két helyzetre tartalmaz kész cseréket. Mindkettőnél: a régi fájlokat előbb `_regi/<ok>_elott_<dátum>/` alá kell másolni, az `index.json`-ban új verziót kell adni (README: `ÉÉÉÉ-HH-NN`, aznap második kiadás `.2`), utána `npm run minden`. A cserék után a szövegnek pontosan azt kell leírnia, ami fut.

## A) Ha a hirdetési mérést bekapcsoljuk (ADS_TRACKING_ENABLED=true)

Előfeltétel: a jogász az `UGYVED_KERDESEK_marketing.md` M5–M10 kérdéseire válaszolt; a tulaj eldöntötte a [TULAJ] pontokat (telefonszám, remarketing, megőrzés); a `[ELLENŐRIZNI]` jelölésű tényeket (Meta Controller Addendum, a DPF-tanúsítások, a sütik listája és élettartama, a cégcímek) a bekapcsolás napján ellenőrizték.

**adatkezeles.md**

- „Röviden”, a 3. hirdetési sor helyett: „Hirdetési mérést (Meta, Google) csak a hozzájárulásoddal végzünk: ha a weboldalon elfogadod, és onnan regisztrálsz (2.18. pont). Ha elutasítod, semmi nem változik.”
- 2.14., az „Elemző és hirdetési süti” sor helyett: „**Elemző és hirdetési süti:** elemző sütit nem használunk; a weboldal látogatottságát süti nélkül mérjük (2.17. pont). Hirdetési sütit (Meta, Google) csak akkor teszünk a böngésződbe, ha a süti-ablakban elfogadod (2.18. pont, Süti-tájékoztató).”
- 2.18. címe: „## 2.18. Hirdetéseink mérése (Meta és Google)”. Az első két bekezdés („Most nincs bekapcsolva.” és „Ha bekapcsoljuk, …”) helyére: „**Csak a hozzájárulásoddal.** <a bekapcsolás napja, szövegként, például: 2027. február 1.> óta a weboldalunkon a Meta és a Google hirdetési kódja csak akkor töltődik be, ha a süti-ablakban elfogadod, és a regisztrációdról vagy a fizetésedről csak akkor küldünk jelzést, ha a döntésedet a fiókodhoz kötöttük. Hozzájárulás nélkül is ugyanúgy regisztrálhatsz, és ugyanúgy használhatod a szolgáltatást.”
- 3.2., a „Meta és Google, hirdetési mérés” sor helyett: „**Meta és Google, hirdetési mérés:** csak ha hozzájárulsz (2.18. pont); a Metával a gyűjtésre és a továbbításra közös adatkezelők vagyunk.”
- „Röviden”, a „Követő sütit nem használunk.” mondat helyére: „Követő (hirdetési) sütit csak a hozzájárulásoddal használunk (2.18. pont).”
- 2.14., az „Amit most használunk” sorban a „A weboldalunk nem tesz sütit a böngésződbe;” rész helyére: „A weboldalunk egy sütiben megjegyzi, mit választottál a süti-ablakban (kj_hozzajarulas); hirdetési sütit csak akkor tesz, ha elfogadod;”
- 2.11., a „Kinek adjuk át” sor helyett: „**Kinek adjuk át:** senkinek; kivétel a hirdetési kattintás azonosítója, ha hozzájárultál (2.18. pont).”
- 9. pont: a változásról az e-mailes és appbeli előzetes értesítést a jogász döntése szerint (M14).

**suti.md**

- „Röviden”, a hirdetési sor helyett: „Hirdetési sütit (Meta, Google) csak akkor teszünk a böngésződbe, ha a süti-ablakban elfogadod (5. és 6. pont).”; az első sorból kikerül „ezért nem jelenik meg süti-ablak”.
- A 4. pont („Miért nincs most süti-ablak”) helyére: „## 4. A süti-ablak” + „Az első látogatáskor megkérdezünk, hogy hozzájárulsz-e a hirdetéseink méréséhez (6. pont). Amíg nem döntesz, hirdetési kód nem töltődik be.”
- Az 5. pont címe: „## 5. Hirdetési mérés (csak ha elfogadod)”; a „**Ez a rész most nem érvényes.** …” bekezdés helyére: „Ezek a sütik csak akkor kerülnek a böngésződbe, ha a süti-ablakban elfogadod. A részleteket az Adatkezelési tájékoztató 2.18. pontja írja le.”
- A 6. pont címéből kikerül „(ha a hirdetési mérést bekapcsoljuk)”.
- A `kj_hozzajarulas` tétel az 5. pontból a 2. pontba kerül (a bekapcsolás után bármely döntés után ott van a böngészőben).

**app_szovegek.json**

- `meres.lablec`: „Ez az oldal hirdetési sütit csak akkor használ, ha elfogadod. A látogatottságot saját szerverünkön, süti nélkül, összesítve mérjük.”
- A GYIK „Biztonságban vannak az adataim?” válasza igaz marad („Nem adjuk el az adataidat, és nem mutatunk hirdetést.”); ha mégis változik, `elozo_valasz` kell (README, SPEC §27.7.3).

## B) Ha a jogász szerint a látogatottság-méréshez is hozzájárulás kell (M1)

**Előfeltétel: a kapcsolót előbb el kell készíteni – most NINCS a kódban.** (Javasolt név: `meres.json` → `"statisztikaHozzajarulassal": true`; a `meres.js` ekkor a mérőkódot csak „Elfogadom” után tölti be, és a süti-ablak kikapcsolt hirdetési mérés mellett is megjelenik.) Amíg ez nincs meg, az alábbi szöveg nem élesíthető.

Ekkor a süti-ablak kikapcsolt hirdetési mérés mellett is megjelenik, egyetlen „Statisztika” kategóriával (`suti_ablak.statisztika`), és a mérőkód csak elfogadás után töltődik be.

**adatkezeles.md 2.17.**

- „Jogalap” sor helyett: „**Jogalap:** a hozzájárulásod (GDPR 6. cikk (1) bekezdés a) pont; a böngésződben futó mérőkódhoz az Eht. 155. § (4) bekezdése). A weboldal első megnyitásakor kérdezünk; amíg nem fogadod el, a mérőkód be sem töltődik. Ha elutasítod, az oldal ugyanúgy működik.”
- A „**Tiltakozhatsz a mérés ellen.** …” bekezdés helyére: „**Bármikor visszavonhatod.** A weboldal alján a „Süti-beállítások” linkkel, ugyanolyan egyszerűen, mint ahogy megadtad. Ettől kezdve nem mérünk. Mivel a látogatót nem tudjuk azonosítani, a már rögzített adatot nem tudjuk hozzád kötni és külön törölni (GDPR 11. cikk). A visszavonás a korábbi mérés jogszerűségét nem érinti.”
- A 6. pontban a „Tiltakozás” felsorolásából és a külön bekezdésből kikerül a 2.17.; a „Hozzájárulás visszavonása” sorba bekerül: „a weboldal látogatottságának mérését a weboldal alján a „Süti-beállítások” linkkel (2.17. pont)”.
- „Röviden”: „A weboldalunk látogatottságát csak a hozzájárulásoddal, saját szerverünkön, süti nélkül mérjük (2.17. pont).”

**suti.md**

- 3. pont, „Csoport és jogalap”: „statisztika; a hozzájárulásod (Adatkezelési tájékoztató 2.17. pont). Amíg nem fogadod el, a mérőkód be sem töltődik.”
- A `umami.disabled` tétel helyett a döntést a `kj_hozzajarulas` süti tárolja (5. pont tétele átkerül a 2. pontba, mert hirdetés nélkül is él).
- A 4. pont helyére: „## 4. A süti-ablak” + „Az első látogatáskor megkérdezünk, hogy mérhetjük-e a látogatottságot (statisztika, süti nélkül, saját szerverünkön). Az „Elfogadom” és az „Elutasítom” egyforma gomb; a döntésedet a „Süti-beállítások” linkkel bármikor megváltoztathatod.”
- „Röviden”: az első sorból kikerül „ezért nem jelenik meg süti-ablak”.

**app_szovegek.json**

- `meres.lablec`: „Ez az oldal nem használ sütit. A látogatottságot csak a hozzájárulásoddal, saját szerverünkön, süti nélkül mérjük.”
- A `meres.ne_merjetek*` kulcsok ekkor nem kellenek (a „Süti-beállítások” veszi át a szerepüket).
