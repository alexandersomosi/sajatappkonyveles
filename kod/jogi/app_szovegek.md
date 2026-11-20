TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács.

# Rövid jogi szövegek az appban

Verzió: 2026-11-20. Ez a fájl az app_szovegek.json-ból készül (npm run app-szovegek). Ne szerkeszd kézzel: a JSON-t írd át, és futtasd újra. A félkövér rész a szöveg kulcsa, az app ezzel hivatkozik rá.

## Ár

**ar.cim** – Havi {{dij.havi_brutto}}

**ar.rovid** – Havi {{dij.havi_brutto}}, bruttó. Bármikor lemondhatod.

**ar.mit_kapsz**

- Saját könyvelő, aki név szerint ismer.
- Kiszámolja, mennyi adót és járulékot kell fizetned, és beadja a bevallásaidat.
- A kiállított számláidat a NAV rendszeréből mi töltjük le, neked csak a nyugtákat és a kivonatot kell feltöltened.
- Szólunk a határidők előtt, és megmondjuk, hová utalj.
- Az appban bármikor kérdezhetsz a könyvelődtől, és igazolást is kérhetsz.

**ar.reszletek** – A díjat bankkártyával fizeted, havonta előre. Minden levonás után elektronikus számlát kapsz. Az adót továbbra is te fizeted be a NAV-nak; mi megmondjuk, mennyit és hová.

## Automatikus megújulás

**megujulas.rovid** – Az előfizetésed havonta magától megújul, amíg le nem mondod.

**megujulas.engedely** – {{elofizetes.alkalom}} alkalommal, alkalmanként legfeljebb {{elofizetes.max_osszeg}}, {{elofizetes.lejarat_ig}} vonhatunk le a kártyádról. Bármikor törölheted a kártyádat a Fiók oldalon.

**megujulas.kovetkezo** – Következő levonás: {{elofizetes.kovetkezo_levonas}}, {{dij.havi_brutto}}.

**megujulas.lejar_hamarosan** – A kártyád {{elofizetes.lejarat_ig}} lejár. Add meg az újat, hogy ne szakadjon meg a könyvelésed.

## Fizetés (SimplePay)

**fizetes.gomb** – Kártyás fizetés

**fizetes.simplepay_link** – Fizetési tájékoztató (SimplePay)

**fizetes.biztonsag** – A fizetés a SimplePay oldalán történik. A kártyád számát mi nem látjuk.

**fizetes.demo** – DEMO FIZETÉS – nem valódi kártya, nem vonunk le pénzt.

**fizetes.siker** – Sikeres tranzakció. SimplePay tranzakcióazonosító: {{simplepay.tranzakcio}}

**fizetes.sikertelen** – Sikertelen tranzakció. SimplePay tranzakcióazonosító: {{simplepay.tranzakcio}}. Kérjük, ellenőrizd a tranzakció során megadott adatok helyességét. Amennyiben minden adatot helyesen adtál meg, a visszautasítás okának kivizsgálása érdekében vedd fel a kapcsolatot kártyakibocsátó bankoddal.

**fizetes.megszakitva** – Megszakítottad a fizetést.

**fizetes.idotullepes** – Lejárt a tranzakció maximális ideje. Kezdd újra a fizetést.

**fizetes.levonas_sikertelen** – Nem sikerült levonni a havidíjat. Az első sikertelen próbától számítva 1, 3 és 7 nap múlva újra megpróbáljuk. Ha a bankod megerősítést kér, az appban a „Fizesd ki” gombbal fizeted ki. Ha lejárt vagy megváltozott a kártyád, add meg az újat.

**fizetes.szunetel_figyelmeztetes** – Ha {{elofizetes.szunetel_datum_ig}} nem rendeződik a díj, szüneteltetnünk kell a könyvelésedet. Közelgő határidőd: {{hatarido.kovetkezo}}.

**fizetes.szunetel** – Szünetel a könyvelésed, mert nem sikerült levonni a díjat. Az irataidat látod, de {{konyvelo.keresztnev}} most nem dolgozik rajtuk, és bevallást sem ad be. Add meg a kártyádat, és folytatjuk.

## Árváltozás

**arvaltozas.ertesites** – {{arvaltozas.datum_tol}} a havidíj {{arvaltozas.uj_ar}} lesz. Ha nem szeretnéd, addig díjmentesen lemondhatod.

## Lemondás

**lemondas.gomb** – Előfizetés lemondása

**lemondas.kerdes** – Biztosan lemondod?

**lemondas.kovetkezmeny**

- {{elofizetes.idoszak_vege_ig}} minden marad a régiben: {{konyvelo.keresztnev}} dolgozik, az app működik.
- Utána nem vonunk le több díjat.
- Ha a negyedév utolsó hónapját kifizetted, az arról szóló bevallást még beadjuk.
- A végén megszüntetjük a NAV-meghatalmazást (te is visszavonhatod az ONYA-ban).
- Az adataidat bármikor letöltheted: Fiók > Adataim letöltése.

**lemondas.megerosites** – Igen, lemondom

**lemondas.megse** – Mégis maradok

**lemondas.kesz** – Lemondtad. {{elofizetes.idoszak_vege_ig}} még minden működik. Ha meggondolod magad, itt visszavonhatod.

**lemondas.visszavon** – Mégis maradok

**lemondas.azonnali** – Azonnal szeretnél kilépni? Írj nekünk: {{ceg.email}}. A kifizetett hónapból hátralévő napok díját visszautaljuk.

## Kártya törlése

**kartya_torles.gomb** – Kártya törlése

**kartya_torles.kerdes** – Törlöd a kártyádat?

**kartya_torles.kovetkezmeny** – A kártyádat a fizetési szolgáltatónál is töröljük, és többé nem vonunk le róla. Az előfizetésed {{elofizetes.idoszak_vege_ig}} él; utána csak akkor folytatódik, ha új kártyát adsz meg.

**kartya_torles.kesz** – Töröltük a kártyádat. {{elofizetes.idoszak_vege_ig}} minden működik.

## A szerződés elfogadása

**szerzodes.bevezeto** – Olvasd el, és fogadd el egyenként. Mindegyiket letöltheted PDF-ben is.

**szerzodes.kiemelt_cim** – Erre külön figyelj

**szerzodes.kiemelt**

- Egyéni vállalkozóként szerződsz, ezért nincs 14 napos elállási jog. Helyette bármikor lemondhatod.
- A díjat havonta automatikusan levonjuk a kártyádról, amíg le nem mondod.
- Ha most indítod a vállalkozásodat, a bejelentés a te nyilatkozatod: te küldöd be, vagy ha kéred, a könyvelőd meghatalmazottként, az általad jóváhagyott adatokkal. Beküldés után nem vonható vissza, és az adatokért te felelsz.
- Ha a díj nem rendeződik, a könyvelés szünetel; előtte szólunk.
- Ha késve vagy hibásan adod át az adatokat, az ebből eredő kárért nem felelünk.
- Az ÁSZF-et értesítés mellett módosíthatjuk; ilyenkor díjmentesen kiléphetsz.

**szerzodes.elfogad_aszf** – Elolvastam és elfogadom az Általános Szerződési Feltételeket, a kiemelt feltételekkel együtt.

**szerzodes.elfogad_megbizas** – Elfogadom a Megbízási szerződést.

**szerzodes.tudomasul_adatkezeles** – Elolvastam az Adatkezelési tájékoztatót.

**szerzodes.simplepay_adattovabbitas** – Elfogadom az adattovábbítási nyilatkozatot (SimplePay).

**szerzodes.simplepay_ismetlodo** – Elfogadom az ismétlődő bankkártyás fizetésről szóló nyilatkozatot.

**szerzodes.pdf** – Letöltöm PDF-ben

**szerzodes.ujra_elfogadas** – Változott a(z) {{dok.cim}}. Nézd át, mi változott, és fogadd el, hogy folytathassuk.

## NAV-meghatalmazás

**meghatalmazas.miert** – Ahhoz, hogy {{konyvelo.keresztnev}} beadhassa a bevallásaidat, a NAV-nál meg kell hatalmaznod. Az ONYA-ban kb. 5 perc, papír és aláírás nem kell. Ha kéred, {{konyvelo.keresztnev}} küldi be, és neked csak jóvá kell hagynod.

**meghatalmazas.jelszo** – Az Ügyfélkapu+- vagy DÁP-belépésedet senkinek ne add meg, nekünk sem. {{konyvelo.keresztnev}} a saját belépésével jár el.

**meghatalmazas.ugykorok**

- ADÓÜGYEK (kivéve egyes jövedéki ügyek)
- Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)

**meghatalmazas.jovahagyas** – {{konyvelo.keresztnev}} beküldte a meghatalmazást. 4 naptári napon belül hagyd jóvá az ONYA-ban, különben a NAV törli, és újra kell küldeni.

**meghatalmazas.visszavonas** – A meghatalmazást bármikor visszavonhatod az ONYA-ban. Előtte szólj, mert utána nem tudjuk beadni a bevallásaidat.

**meghatalmazas.uj_vallalkozas** – A meghatalmazás az adóazonosító jeledhez kötődik, ezért a bejelentésed beküldése után már megadhatod (ha a bejelentést is ránk bízod, már előtte): az új vállalkozásodra is érvényes lesz.

## Azonosítás (Pmt.)

**azonositas.miert** – A pénzmosás elleni törvény miatt minden könyvelőnek azonosítania kell az ügyfeleit. Ezért kérjük az okmányaid fotóját és néhány adatot.

**azonositas.titkositas** – Titkosítva tároljuk, csak {{konyvelo.keresztnev}} látja.

**azonositas.okmanyok** – Személyi igazolvány (két oldal), útlevél (adatoldal) vagy kártyás jogosítvány (két oldal).

**azonositas.lakcimkartya** – A lakcímkártyádnak csak a lakcímes oldalát fotózd le. A másik oldalán a személyi azonosítód van – azt nem kérjük.

**azonositas.megorzes** – A törvény szerint ezeket az együttműködésünk vége után 8 évig meg kell őriznünk. Utána töröljük.

**azonositas.foto_tipp** – Éles legyen, minden sarok látsszon, ne tükröződjön.

## Új vállalkozás indítása

**uj_vallalkozas.mit_teszunk** – Alapból útmutatót adunk képekkel és videóval, a bejelentést te küldöd be, és utána átnézzük a NAV-os értesítést. Ha nem boldogulsz vele, kérd: „Intézzétek helyettem”. Ilyenkor felhívunk, és {{konyvelo.keresztnev}} meghatalmazottként, a saját belépésével, az általad jóváhagyott adatokkal küldi be. A belépési adataidat egyik esetben sem kérjük el.

**uj_vallalkozas.felelosseg** – A bejelentés a te nyilatkozatod a NAV felé, akkor is, ha {{konyvelo.keresztnev}} küldi be helyetted. Az útmutató és a beküldött adatok a válaszaidból készülnek, ezért figyelj, hogy pontosak legyenek. Az adatok valóságáért te felelsz, és beküldés után a bejelentést nem lehet visszavonni.

**uj_vallalkozas.nem_taroljuk** – A bejelentéshez a TAJ-számodat, anyukád nevét és a születési adataidat nem kérjük el: ezeket a NAV-os űrlapba te írod be, vagy a NAV tölti ki. (Az azonosításnál a pénzmosás elleni törvény miatt néhányat később megadsz; TAJ-számot ott sem kérünk.)

**uj_vallalkozas.dij** – A havidíjat a szerződés és a kártyád megadása napjától fizeted. Ebben benne van a vállalkozásod elindítása is: az útmutató, az értesítés átnézése és a visszahívás.

**uj_vallalkozas.nyilvanos** – A székhelyed címe nyilvános lesz: bárki megnézheti a nyilvántartásban.

## Becslés

**becsles.megjegyzes** – Becslés. A végleges összeget a könyvelőd hagyja jóvá.

## Adataim letöltése

**adatok_letoltese.leiras** – Egy ZIP-fájlt készítünk minden adatodról és iratodról. Ha kész, szólunk. A letöltési link 24 óráig él.

## Fiók törlése

**fiok_torles.cim** – Fiók törlése

**fiok_torles.kovetkezmeny**

- Azonnal kilépünk minden eszközödről, és leállítjuk az előfizetést. A kártyádat is töröljük.
- 30 napig meggondolhatod magad: ha addig belépsz, visszavonhatod.
- Utána mindent törlünk, kivéve amit a törvény miatt meg kell őriznünk: az azonosítást és a díjszámlákat 8 évig, a könyvelési iratokat az adó elévüléséig. Ezeket elzárva, titkosítva tartjuk, és a határidő végén töröljük.
- Ha még fut egy negyedév, a bevallását nem adjuk be. Erről gondoskodnod kell.
- Előtte töltsd le az adataidat.

**fiok_torles.megerosites** – Törlöm a fiókomat

**fiok_torles.visszavon** – Mégsem törlöm

## Intézzük helyetted (segített ügyintézés)

**helyettunk.mi_ez** – Ha nem boldogulsz vele, intézzük helyetted: felhívunk, és {{konyvelo.keresztnev}} a saját belépésével, meghatalmazottként beküldi a NAV-meghatalmazást, és ha most indítod a vállalkozásodat, a bejelentésedet is. Neked csak jóvá kell hagynod. Ez a szolgáltatás része, külön nem fizetsz érte.

**helyettunk.soha_belepes** – Soha nem kérjük el az Ügyfélkapu+- vagy DÁP-belépésedet, a jelszavadat vagy a kódjaidat, és nem lépünk be helyetted. {{konyvelo.keresztnev}} a saját belépésével, meghatalmazottként jár el. Amit kell, te hagyod jóvá a NAV oldalán.

**helyettunk.jovahagyas** – Ha {{konyvelo.keresztnev}} küldi be a meghatalmazást, a NAV megkérdezi tőled, hogy rendben van-e. 4 naptári napon belül hagyd jóvá az ONYA-ban, a saját belépéseddel. Ha nem hagyod jóvá időben, a NAV törli, és {{konyvelo.keresztnev}} újra beküldi; más következménye nincs.

**helyettunk.engedely_nyilatkozat** – Rám nem vonatkozik egyik kizáró ok sem, és nincs másik élő egyéni vállalkozásom.

**helyettunk.engedely_utasitas** – Az adatokat én adtam meg és ellenőriztem. Kérem, hogy {{konyvelo.nev}} ezekkel az adatokkal, meghatalmazottként küldje be a vállalkozásom bejelentését. Tudom, hogy beküldés után nem lehet visszavonni, és a vállalkozásom a beküldés napján indul.

**helyettunk.engedely_nyilvanos** – A székhely címe nyilvános lesz: bárki megnézheti a nyilvántartásban.

**helyettunk.visszavonhatatlan** – A beküldött bejelentést nem lehet visszavonni és módosítani, csak változásbejelentéssel javítani. A vállalkozásod a beküldés napján indul. A beküldésig bármikor lemondhatod a kérést.

**helyettunk.ingyenes** – Ezért nem fizetsz külön.

**helyettunk.ervenyes** – A vállalkozás bejelentését 2026. december 31-ig tudjuk így intézni: 2027-től a nyilvántartást a kamara vezeti.

## Regisztráció

**regisztracio.aszf_link** – A regisztrációval még nem fizetsz semmit. A szerződést a következő lépésekben olvashatod el.

## Gyakori kérdések (GYIK)

**1. Mennyibe kerül, és mit kapok érte?**

Havi {{dij.havi_brutto}}, bruttó. Ezért saját könyvelőt kapsz, aki kiszámolja az adódat és a járulékaidat, beadja a negyedéves és az éves bevallásaidat, figyeli a határidőket, és válaszol a kérdéseidre. A kiállított számláidat a NAV rendszeréből mi töltjük le.

(A válasz 2026-11-19-én változott.)

**2. Az app adja be helyettem a bevallást?**

Nem. A bevallást mindig a könyvelőd adja be, miután átnézte. Az app csak becslést mutat, és segít, hogy minden irat meglegyen.

**3. Ki fizeti be az adót?**

Te, a saját bankodból. Mi megmondjuk, mennyit, mikorra, melyik számlaszámra és milyen közleménnyel. Ha befizetted, jelezd a „Már befizettem” gombbal, és a könyvelőd ellenőrzi.

**4. Mi az a meghatalmazás, és visszavonhatom?**

A meghatalmazással a könyvelőd a NAV-nál a nevedben eljárhat: beadhatja a bevallásaidat és igazolást kérhet. Az ONYA-ban kb. 5 perc alatt beállítod; az appban képekkel és videóval megmutatjuk, hogyan. Vagy kérd, hogy a könyvelőd küldje be, és te csak jóváhagyod. Ugyanott bármikor visszavonhatod. A jelszavadat ehhez senkinek nem kell megadnod.

(A válasz 2026-11-19-én változott.)

**5. Mi történik, ha a könyvelő hibázik?**

Ha a mi hibánkból kell bírságot vagy pótlékot fizetned, azt megtérítjük. Maga az adó nem kár, azt hiba nélkül is meg kellett volna fizetni.

**6. Hogyan mondhatom le?**

Bármikor, az appban: Fiók > Előfizetés > Lemondás. A kifizetett hónap végéig minden működik, utána nem vonunk le több díjat. Ha a negyedév utolsó hónapját kifizetted, az arról szóló bevallást még beadjuk.

**7. Miért kell a személyim és a lakcímkártyám fotója?**

A pénzmosás elleni törvény miatt minden könyvelőnek azonosítania kell az ügyfeleit. A fotókat titkosítva tároljuk, csak a könyvelőd látja őket. A lakcímkártyának csak a lakcímes oldala kell.

**8. Biztonságban vannak az adataim?**

Igen. A fájljaidat titkosítva tároljuk európai szerveren, a NAV-kulcsaidat külön kulccsal. A könyvelési irataidat és az okmányaidat csak a könyvelőd látja; ügyfélszolgálatunk csak azt, ami a bekötéshez és a visszahíváshoz kell (például a vállalkozásod bejelentéséről szóló NAV-os értesítést). A hívásokat nem rögzítjük. Nem adjuk el az adataidat, és nem mutatunk hirdetést. Bármikor letöltheted vagy törölheted őket.

(A válasz 2026-11-19-én változott.)

**9. Hogyan kérhetek visszahívást?**

Minden lépésnél ott a „Kérj visszahívást” gomb, és a Fiók oldalon is megtalálod. Add meg a telefonszámodat, és írd le röviden, miben segítsünk. A csapatunkból valaki 24–48 órán belül hív, munkanapokon 9 és 17 óra között. Nem feltétlenül a könyvelőd hív elsőként. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted.

(A válasz 2026-11-19-én változott.)

**10. Még nincs vállalkozásom. Mit tegyek?**

Az első kérdésnél válaszd: „Még nincs, most indítanám”. Utána választhatsz. Magad jelented be: kitöltöd a rövid kérdőívet, és személyre szabott útmutatót kapsz képekkel és videóval arról, melyik képernyőn mit jelölj be; a NAV bejelentő oldalán (Vállalkozói Ügysegéd) te küldöd be, Ügyfélkapu+-szal vagy DÁP-pal, ingyen, utána pedig átnézzük a NAV-os értesítést. Vagy kéred, hogy intézzük helyetted: felhívunk, és a könyvelőd meghatalmazottként küldi be, az általad jóváhagyott adatokkal. Ha rossz gombot nyomtál, a Főoldalon a „Módosítom” gombbal átállíthatod.

(A válasz 2026-11-19-én változott.)

**11. Bejelentitek helyettem a vállalkozásomat?**

Igen, ha kéred. Koppints az „Intézzétek helyettem” gombra: felhívunk, átnézzük veled az adataidat, a könyvelőd pedig meghatalmazottként, a saját belépésével bejelenti. Neked csak a NAV oldalán kell jóváhagynod a meghatalmazást, és itt engedélyezned a bejelentést. A jelszavadat vagy a kódjaidat soha nem kérjük el. Ha inkább magad csinálod, lépésről lépésre megmutatjuk, kb. 10–15 perc.

Korábbi kérdés (2026-11-19-ig): „Miért nem ti jelentitek be a vállalkozásomat?”

**12. Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?**

A havidíjat a szerződés és a kártya megadása napjától fizeted. Ebben benne van a vállalkozásod elindítása is: az útmutató, az értesítés átnézése és a visszahívás.

(A válasz 2026-11-19-én változott.)

**13. Mit jelent, hogy jóvá kell hagynom a meghatalmazást?**

Ha a könyvelőd küldi be a meghatalmazást, a NAV megkérdezi tőled, hogy rendben van-e. Az ONYA-ban hagyod jóvá, Ügyfélkapu+-szal vagy DÁP-pal, 4 naptári napon belül. Az alkalmazásban lépésről lépésre megmutatjuk, és emlékeztetünk. Ha kifutsz az időből, a NAV törli, és a könyvelőd újra beküldi.

## Visszahívás és értesítések (a szerver tartalomszövegei)

Ezeket a szerver küldi (értesítés az appban, push, e-mail), a kulcs a SPEC §26–§27 tartalomkulcsa. A {kapcsos zárójeles} rész futás közben töltődik ki: {firstName} = a könyvelő keresztneve, {phoneMasked} = a telefonszám takarva (csak az utolsó két számjegy látszik), {when} = időpont (például „ma 14:20”), {staffFirstName} = a hívó munkatárs keresztneve, {callerId} = a szám, amelyről hívunk, {reasonText} = a lezárás oka, {hatarido} = a határidő „-ig” raggal (például „november 22-ig”). Az e-mail tárgya a cím, a szövege a szöveg és egy „Megnyitom” link. A pontozott kulcsvég (például .elso, .utolso_nap, .ujra) ugyanannak az értesítésnek egy változata.

**visszahivas.igeret** – Kollégánk 24–48 órán belül felhív. Munkanapokon 9 és 17 óra között telefonálunk. Nem feltétlenül {firstName} hív elsőként, hanem valaki a csapatunkból.

**visszahivas.hivoszam** – Erről a számról hívunk: {callerId}

**visszahivas.csalas** – Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban.

**visszahivas.adatkezeles** – A megadott számon ezzel a kéréssel kapcsolatban hívunk. A hívásról rövid jegyzetet írunk, a hívást nem rögzítjük. Részletek az Adatkezelési tájékoztatóban.

**notif.callback_received.title** – Megkaptuk a visszahívási kérésed

**notif.callback_received.body** – Kollégánk 24–48 órán belül hív a {phoneMasked} számon. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted.

**notif.callback_received.regi_idopont.title** – Időpont helyett visszahívás

**notif.callback_received.regi_idopont.body** – Időpontfoglalás helyett mostantól visszahívást kérhetsz. A korábban egyeztetett hívásod megmaradt: kollégánk {when} körül hív.

**notif.callback_calling.title** – Most hív kollégánk, {staffFirstName}

**notif.callback_calling.body** – Ha nem tudod felvenni, újra próbáljuk.

**notif.callback_missed.title** – Kerestünk, de nem értünk el

**notif.callback_missed.body** – {when} hívtunk. Újra próbáljuk. Ha más számon érünk el, írd át az alkalmazásban.

**notif.callback_wrong_number.title** – Javítsd ki a telefonszámodat

**notif.callback_wrong_number.body** – A megadott számon nem értünk el. Írd be a jó számot, és újra hívunk.

**notif.callback_done.title** – Beszéltünk – köszönjük!

**notif.callback_done.body** – Ha még kérdésed van, írj nekünk az Üzenetekben.

**notif.callback_unreached.title** – Nem értünk el telefonon

**notif.callback_unreached.body** – Háromszor próbáltuk. Írj nekünk üzenetet, vagy kérj új visszahívást.

**notif.callback_closed.title** – Lezártuk a visszahívási kérésed

**notif.callback_closed.body** – {reasonText}

**notif.registration_reminder.title** – Folytasd a vállalkozásod bejelentését

**notif.registration_reminder.body** – Az útmutatód készen áll. Pár perc az egész, és ha elakadsz, kérj visszahívást.

**notif.registration_reminder.adatlap.title** – Folytasd a kérdőívet

**notif.registration_reminder.adatlap.body** – Ott folytathatod, ahol abbahagytad. Utána elkészül a személyre szabott útmutatód.

**notif.registration_needs_fix.title** – Egy dolgot javítanod kell a bejelentéseden

**notif.registration_needs_fix.body** – Megírtuk az alkalmazásban, mit és hogyan.

**notif.registration_checked.title** – Átnéztük a bejelentésedet

**notif.registration_checked.body** – Átnéztük a NAV-os értesítést. Ha megjött az adószámod, írd be az alkalmazásban.

**notif.registration_done.title** – Elindult a vállalkozásod!

**notif.registration_done.body** – Rögzítettük az adószámodat. Jöhet a következő lépés.

**notif.subscription_payment_failed.title** – Nem sikerült levonni a havidíjat

**notif.subscription_payment_failed.body** – Az első sikertelen próbától számítva 1, 3 és 7 nap múlva újra megpróbáljuk. Ha a kártyád lejárt vagy letiltották, cseréld le a Fiók oldalon.

**notif.assist_started.title** – Beszéltünk – így haladunk

**notif.assist_started.body** – Ha megadtad az adataidat és elfogadtad a szerződést, {firstName} beküldi a meghatalmazást. Utána értesítést kapsz, és 4 napod lesz jóváhagyni.

**notif.assist_mh_filed.title** – Hagyd jóvá a meghatalmazást {hatarido}

**notif.assist_mh_filed.body** – {firstName} beküldte a NAV-nak. Lépj be az ONYA-ba, és hagyd jóvá. Kb. 3 perc, megmutatjuk, hogyan.

**notif.assist_mh_reminder.title** – Még nem hagytad jóvá a meghatalmazást

**notif.assist_mh_reminder.body** – Még {hatarido} van időd. Kb. 3 perc az ONYA-ban.

**notif.assist_mh_reminder.elso.title** – Még nem hagytad jóvá a meghatalmazást

**notif.assist_mh_reminder.elso.body** – Még {hatarido} van időd. Kb. 3 perc az ONYA-ban.

**notif.assist_mh_reminder.utolso_nap.title** – Ma van az utolsó nap

**notif.assist_mh_reminder.utolso_nap.body** – Hagyd jóvá ma a meghatalmazást az ONYA-ban, különben a NAV törli.

**notif.assist_mh_expired.title** – Lejárt a 4 nap

**notif.assist_mh_expired.body** – A NAV törölte a jóvá nem hagyott meghatalmazást. {firstName} újra beküldi, és szólunk.

**notif.assist_consent_needed.title** – Él a meghatalmazás – nézd át az adataidat

**notif.assist_consent_needed.body** – Ha rendben vannak, engedélyezd a bejelentést. Kb. 2 perc.

**notif.assist_consent_needed.ujra.title** – Engedélyezd újra a bejelentést

**notif.assist_consent_needed.ujra.body** – Módosult a kérdőív, ezért nézd át újra.

**notif.assist_ev_filed.title** – {firstName} beküldte a bejelentésedet!

**notif.assist_ev_filed.body** – Elment a NAV-hoz. Rögzítjük az adószámodat, és szólunk.

**notif.kamara_reminder.title** – Ne felejtsd el: kamarai regisztráció

**notif.kamara_reminder.body** – {hatarido} regisztrálj a kamaránál. Kb. 10 perc.

Eltérés a SPEC szövegétől: notif.callback_received.body: „vagy a kártyaadataidat, és nem lépünk be helyetted” (egyezzen a visszahivas.csalas szöveggel, SPEC §27.3.7). notif.registration_checked.title: „Rendben van a bejelentésed” helyett „Átnéztük a bejelentésedet” (az átnézésünk nem hatósági ellenőrzés, ÁSZF 4/A.3.). notif.assist_ev_filed.title: „Bejelentettük a vállalkozásodat!” helyett „{firstName} beküldte a bejelentésedet!” (a bejelentést a könyvelő küldi be meghatalmazottként, nem a cég – ÁSZF 4/C.6.). notif.registration_done.body: a SPEC §27.8 alapszövege; a kamarai határidőt a kamara_reminder viszi. notif.assist_mh_reminder: az alap kulcs = az „elso” változat (ha a szerver változat nélkül küldi).
