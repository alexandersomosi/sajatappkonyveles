# Felhasználói próba Geminivel (11-20)

Modell: OpenRouter `google/gemini-3.8-flash`, 0,18 $. Persona: Szabó Péter, 34, budapesti rendezvényszervező, idén lett átalányadós EV, eddig papíros ismerős könyvelő, nem ért az adózáshoz, telefonon, sietve intéz mindent, Facebook-hirdetésből jött. 9 folyamatban nézte végig a 86 v2 képernyőt (nyers jegyzetek: `_eszkoz/user_teszt/*.json`). 56 gond (4 elakadás, 24 zavaró, 28 apró).

## Összbenyomás (Péter szavaival)

Az Adózz.hu felülete mobilról hihetetlenül letisztult, modern és laikusbarát: végre nem a bürokratikus bikkfanyelvet használja, hanem pont azt mondja meg, amit tudni akarok – mennyi adót tegyek félre, és mennyi tiszta pénzem marad. Hatalmas biztonságérzetet ad, hogy egy hús-vér könyvelő, Kovács Bence áll a háttérben, aki intézi a NAV-os ügyeket. Ugyanakkor két rendezvény közötti rohanásban több ponton leizzadtam: a hitelesítő appos belépéstől megrémültem, az alkalmi munkások (EFO) kapcsán elbizonytalanodtam, és rettenetesen arcul csapott, hogy a havi 20 ezer forinton felül még külön 15 ezret kérnek az éves zárásért és 5 ezret egy egyszerű székhelyátírásért. Emiatt az addig profi és emberi szolgáltatás hirtelen lehúzásszagúvá vált.

**Fizetne-e?** talán – Az app kezelhetősége, a tiszta adómegmondó funkció és Bence jelenléte pontosan az, amire rendezvényszervezőként szükségem van. De a kártyám megadása előtt mindenképp megvárom a visszahívást, hogy kiderüljön: mit kezdenek az alkalmi munkásaimmal (EFO), és hogy a havi 20 ezer forint kifizetése mellett tényleg le akarnak-e még húzni plusz 15 ezerrel az év végén.

## A 10 legfontosabb gond (Péter sorrendje)

1. **Külön 14 999 Ft-os díj az éves zárásra a havi 19 999 Ft-os előfizetésen felül.** (95_eves_zaras, 83_dijak) – Évi 240 ezer forintot fizetnék ki, és pont azért váltanék ide az ismerős könyvelőtől, hogy ne érjen semmilyen váratlan kiadás. Egy kötelező éves bevallásért még egy '13. havi' díjat legombolni kifejezetten tisztességtelennek tűnik. *Javaslat:* Az éves zárás és az szja-bevallás legyen alapból benne a havi 19 999 Ft-os csomagban, ne kérjenek érte felárat.
2. **Azonnali bankkártya-megadás és fizetés még azelőtt, hogy a könyvelővel egy szót is beszéltem volna, vagy látnám az éles fiókomat.** (21_udv_b, 24_var, 34_bekotes_elofizetes) – Látatlanban, még a NAV-os jóváhagyás előtt nem szívesen adom meg a kártyámat, főleg ha nem tudom, alkalmas-e nekem a rendszer. *Javaslat:* Biztosítsanak legalább 7-14 napos ingyenes próbaidőszakot, vagy csak akkor terheljék a kártyát, ha Kovács Bence ténylegesen átvette és leokézta a fiókomat.
3. **Bizonytalanság és elakadás az alkalmi munkavállalók (EFO) kérdésénél.** (32_bekotes_alkalmazottak) – Rendezvényeken gyakran dolgozom beugró kisegítőkkel. Az a hibaüzenet, hogy 'bérszámfejtést nem vállalunk', teljesen megakaszt: nem tudom, hogy most elhajtanak-e, vagy keresnem kell még egy külön könyvelőt. *Javaslat:* Egyértelműen írják le az EFO választásakor: az egyszerűsített foglalkoztatás napi bejelentését vállalják-e (akár fix tételdíjért), vagy emiatt egyáltalán nem lehetek az ügyfelük.
4. **Ijesztő és laikusoknak érthetetlen 'hitelesítő appos' kétlépcsős azonosítás.** (14_ketlepcsos_belepes, 87_ketlepcsos) – Fogalmam sincs, mi az a Google Authenticator, nincs ilyen a telefonomon. Ha kötelezővé teszik, este a rendezvény után nem fogok tudni belépni és elakadok. *Javaslat:* Ajánljanak fel sima SMS-alapú megerősítést vagy e-mailes belépőkódot, amihez nem kell külön alkalmazásokkal bűvészkedni.
5. **Külön 4 999 Ft-os előre fizetendő díj székhelyváltoztatásért és egyéb alapvető NAV-os módosításokért.** (92_valtozas_fajta, 83_dijak) – A havi 20 ezer forintos díjat épp azért fizetném, hogy a könyvelőm meghatalmazással elintézze a NAV-os papírmunkámat, ne számlázzon minden egyes kattintásért külön. *Javaslat:* Évente legalább 1-2 alapadat-módosítás (pl. székhely vagy új tevékenységi kör) férjen bele az alapdíjba.
6. **A 24-48 órás visszahívási idő túl lassú és nincs konkrét időpontválasztó naptár.** (35_bekotes_idopont, 40_meghatalmazas, 71_visszahivas) – Rendezvényszervezőként folyton pörgök, nem tudok egy 2 napos idősávban készenlétben állni a telefonom mellett, és sürgős adóügyben a 48 óra rengeteg. *Javaslat:* Legyen egy naptár, ahol konkrét 15 perces idősávot foglalhatok a visszahívásra, vagy legyen gyors chat a sürgős kérdésekre.
7. **A 'Félretettem' gomb működése bizonytalan a főoldalon.** (01_fooldal) – Nem mertem rányomni, mert nem volt egyértelmű, hogy most azonnal levonja a pénzt a kártyámról és elutalja a NAV-nak, vagy ez csak egy pipa magamnak. *Javaslat:* A gomb szövege legyen egyértelmű: 'Megjelölöm: félretettem a saját számlámon'.
8. **A NAV határidőknél hiányoznak a közvetlen utalási adatok (számlaszám, közlemény).** (53_hataridok, 01_fooldal) – Mobilról fizetnék a bankomból, de keresgélnem kell a papírjaimban, hogy melyik NAV-os számlaszámra és milyen adószámmal vagy adóazonosítóval kell utalnom. *Javaslat:* A határidőre koppintva jelenjen meg egy egygombos 'Másolom a NAV számlaszámot' és 'Másolom a közleményt' doboz.
9. **A sematikus szürke csíkokkal rajzolt vázlat nem segít felismerni az igazi NAV-os felületet.** (40_meghatalmazas_b, 41_meghatalmazas_jovahagyas) – A NAV ONYA felületétől rettegek a legjobban. Ha csak üres szürke dobozokat látok vázlatként, nem fogom tudni, hova kell kattintani a valóságban. *Javaslat:* Valódi képernyőképet mutassanak a NAV felületéről, bekarikázva a jóváhagyás gombot.
10. **Túl hosszú és ijesztő lépéssorozatok a bevezetésnél ('Még 10 dolog kell tőled', '6/6 lépés' igazolásnál).** (30_bekotes, 50_fooldal_indulas, 68_igazolas_uj_b) – Amikor meglátom a 12 lépést meg a rengeteg adminisztrációt, elmegy a kedvem az egésztől, mert úgy érzem, órákig tartó bürokráciába csöppentem. *Javaslat:* Tördeljék kisebb, barátságosabb blokkokra a folyamatot (pl. 'Pár gyors adat, a többit Bence intézi'), és ne riogassanak hosszú visszaszámlálókkal.

## Ami a legjobban tetszett

- A hatalmas összegű adófigyelmeztetés a főoldalon ('Most kb. 250 000 Ft legyen félretéve'), ami azonnal leveszi a tavalyi meglepetés adófizetések stresszét.
- Hogy valódi emberi könyvelőt kapok (Kovács Bence neve és arca ott van), aki intézi a NAV-os meghatalmazást és a bevallásokat helyettem anélkül, hogy elkérné az Ügyfélkapu jelszavamat.
- A 'Mennyit keresel valójában?' képernyő, ami tisztán megmutatja a zsebre tehető tiszta hasznot a levonások után.
- A chat és az egygombos hivatalos igazoláskérés (hitelhez, albérlethez), ami teljesen kiváltja az állami portálokon való vadászatot.
- A teljesen közérthető, emberi nyelv és az őszinte jogi/lemondási tájékoztatók, amikből zéró bürokrata bikkfanyelvvel azonnal megértem a lényeget.

## Ami hiányzott

- Egyértelmű előzetes tájékoztatás az extra költségekről (hogy az éves zárás +15 000 Ft, a székhelyátírás +5 000 Ft), mielőtt regisztrálok.
- SMS-es kétlépcsős azonosítási lehetőség a bonyolult hitelesítő appok helyett.
- Konkrét időpontválasztó naptár Bence visszahívásához a tág 24-48 órás ablak helyett.
- Azonnali utalási adatok (NAV számlaszám és közlemény egy kattintásos másolása) a határidők kártyánál.

## Besorolás (Claude)

- Üzleti döntés (tulaj): éves zárás külön díja (14 999), változásbejelentés díja (4 999), kártya a bekötés elején / próbaidő nincs, EFO-s alkalmazottak vállalása, 24–48 órás visszahívás (szabály) vs. időpontfoglalás.
- Dizájn/szöveg, megcsinálható: „Félretettem” gomb egyértelműsítése (csak jelölés, nem von le pénzt); határidőnél NAV-számlaszám + közlemény másolása; kétlépcsős belépésnél a hitelesítő app elmagyarázása + e-mailes kód lehetősége; 55 kimutatás hivatalos/nem hivatalos tisztázása; EFO-szöveg tisztázása; a lépésszámok barátságosabb megfogalmazása.
- Nem valós gond: a NAV-útmutatók szürke vázlatai csak a mintában vannak; az élő appban valódi (kitakart) NAV-képek vannak.

## Tulaj döntései (11-20)

- **Kártya csak a beszélgetés után.** A beszélgetés Bencével nem kötelező (35: „Beszélnél előbb Bencével?” – „Időpontot kérek” vagy „Nem kell, mehetünk tovább”). A kártyát (34, előfizetés) csak utána kérjük. Próbaidő továbbra sincs. Lépéslisták: 21_udv_b 5 lépés (24_var: 2 / 5), 30/50 bekötés 13 lépés (6. beszélgetés, 7. előfizetés).
- **Bérszámfejtés felárért, egyedi ajánlattal.** Alkalmazott és alkalmi munkás (EFO) is. A pontos árat Bence mondja meg a beszélgetésen, konkrét összeg nincs kiírva (32, 57, 72, 83: „felár, egyedi ajánlat”).
- **Kétlépcsős belépés = e-mailes kód.** Nincs hitelesítő app, QR-kód és tartalékkód (14, 82, 87, 87_b, 87_c, 88). A régi tartalékkódos képernyő: _regi/87_ketlepcsos_b_tartalekkod.html.
- **Gomb: „Megjelölöm, hogy félretettem”** (01, 51), alatta: „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.”
- **Határidőknél NAV-számlaszám + közlemény, másolással:** új 53_hataridok_b (szja-előleg 10032000-06056353, TB-járulék 10032000-06055802, szocho 10032000-06055912; közlemény: az ügyfél adószáma).
- **Határidők tartalmi javítása:** az átalányadós EV negyedévente fizet, a negyedévet követő hónap 12-éig. A IV. negyedév határideje 2027. január 12. (nem dec. 12.), „Havi TB-járulék” helyett „TB-járulék és szocho, IV. negyedév”; éves bevallás 2027. május 20. (01, 53, 56).
- **Egyelőre változatlan (nem döntött róla):** a plusz díjak (éves zárás 14 999 Ft, változás bejelentése 4 999 Ft) és a 24–48 órás visszahívás.
