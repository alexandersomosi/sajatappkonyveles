# Nyugodt privátbankos irány: négy változat (A–D)

2026-11-17. A tulaj döntése: „Nyugodt privátbankos irány a cél.” Ez a négy változat ezen belül tér el egymástól. Mind a négy egy kipróbált közös alapra épül, ezt lent írom le. A különbség négy dologban van: a mélyszín, a betű (talpas vagy letisztult groteszk), a sötét felület mennyisége, és egyetlen merész elem.

Előnézet a valódi betűkkel és színekkel, ugyanazzal a főoldallal mind a négy változatban:
- `C:/Users/UpgradePC/konyvelo_app/dizajn/iranyok_elonezet.png` (kép)
- `C:/Users/UpgradePC/konyvelo_app/dizajn/iranyok_elonezet.html` (ugyanez böngészőben; a betűket a Google Fontsról tölti)

A számok mintaszámok, nem adótanácsok. A példa egy főállású grafikus, 40% költséghányaddal, 2026 harmadik negyedévében. Bevétel júl.–szept. 2 940 000 Ft, idén eddig 8 420 000 Ft, fizetendő 820 260 Ft, október 12-ig.

---

## Közös alap (mind a négy változatban így van)

**Alap és lapok.** A háttér színezett, hideg tónusú (soha nem krém vagy bézs), rajta fehér lapok, árnyék nélkül. A háttér és a fehér lap kontrasztja 1,28–1,30. Ez jóval erősebb, mint az iOS megszokott #F2F2F7-e (kb. 1,1), mert a tulaj korábban azt kifogásolta, hogy „a fehér miatt egybefolyik minden”. A szakaszcím a lapon kívül, a háttéren áll: félkövér, 15 px, mondatkezdő nagybetűvel (pl. „Határok idén”), nem csupa nagybetűs címke.

**Gombok.** Négy szintje van, és ezek egymással sem keverhetők, a sorokkal sem:
- **Elsődleges:** kitöltött, teljes szélességű, 54 px magas. Képernyőnként csak egy van belőle, és ez az egyetlen kitöltött forma a képernyőn.
- **Másodlagos:** fehér gomb 1,5 px-es márkaszínű kerettel, 44 px magas. Csak akkora, amekkora a felirata.
- **Szöveges (harmadlagos):** márkaszínű, félkövér, aláhúzott szöveg, pl. „Másolás”, ami kattintás után ugyanabban a sorban „Kimásolva” lesz.
- **Veszélyes:** piros (#B42318), aláhúzott szöveg, pl. „Előfizetés lemondása”. A megerősítő lapon már kitöltött piros elsődleges gomb.

**Sorok.** Fehér lapon állnak, kitöltés és keret nélkül, hajszálvonallal elválasztva, jobb szélükön kis nyíl (›). Ha megnyomod, kicsit szürkébb lesz. Gombnak sosem néznek ki.

**Állapot.** A dossziéban mindig szöveg mutatja, mellette 4 vékony szegmens (feltöltve → látta → feldolgozva → beadva), pl. „Bence látta, kedd 14:05”. Színes, gomb alakú címkét soha nem kap.

**Pénz.**
- Az összeg és a határidő egy mondatban szerepel: „Október 12-ig fizess be 820 260 Ft-ot.”
- A számjegyek táblázatosak és jobbra zártak, az ezreseket keskeny, nem törő szóköz választja el.
- A „Ft” kisebb és halványabb, mint maga a szám.
- Minden adónem saját NAV-számlaszámot kap. A közlemény (adóazonosító jel) mellett egy „Másolás” gomb van.

**Szöveg.** Tegeződünk, mondatkezdő nagybetűt használunk, nincs angol maradvány és nincs „→” a gombokon. A gomb ugyanazt mondja, mint az eredménye: a „Befizettem” gomb után „Befizetve” jelenik meg.

**Méretek.** Szövegtörzs 16–17 px, 1,45-ös sorközzel. Címek: 32, 26 és 19 px.

**Mozgás.** Csak akkor van mozgás, ha valaki csinál valamit. Kivétel az egyetlen kiemelt pillanat, ami minden változatnál a saját merész eleméhez tartozik.

**Alsó sáv.** Főoldal, Dosszié, Üzenetek, Fiók. Kézzel rajzolt SVG-ikonok, emoji nincs.

**Webes változat.** Ugyanez a rendszer, egy középre zárt, 720 px-es oszlopban. Széles képernyőn a jobb oldali hasábba kerül a könyvelő és a teendők.

**Ez soha nem kerül bele:**
- krémszínű háttér;
- lila-kék színátmenet;
- majdnem fekete háttér savzöld kiemeléssel;
- csupa nagybetűs címke;
- egy kiemelt szó a címben;
- „A · B · C” stílusú, pontokkal tagolt adatsor;
- egyforma kártyák egyforma árnyékkal;
- AI-kép, 3D illusztráció, emoji;
- NAV-, bank- vagy postalogó.

---

## A: Palackzöld kivonat (munkanév: **Számadó**)

**Ötlet.** A régi bankok számlakivonatának nyugalma. A főoldalon egyetlen sötét felület van, a befizetési kivonat. Minden más világos. Ez a „klasszikus magánbank” változat, talpas betűvel.

**Merész elem.** A sötét palackzöld befizetési kivonat a főoldal tetején.
- A felső szélén egy keskeny gilos-szalag fut: a bankjegyek mélynyomású vonalhálójára utaló, matematikailag rajzolt hullámköteg. Tónusa a háttérével rokon (#2E6650 a #14402F-on), aranyat nem kap.
- Benne: a mondat nagy talpas betűvel, a három tétel (TB-járulék, szocho, SZJA-előleg), a közlemény a „Másolás” gombbal, végül a fehér „Befizettem” gomb.
- A kiemelt pillanat: a „Befizettem” után a kivonat egyetlen keskeny sorrá zárul: „Befizetve, október 9.”

**Paletta**

| Szerep | Szín |
|---|---|
| Palackzöld (márka, kivonat, elsődleges gomb) | #14402F |
| Gilosvonal (csak a kivonaton) | #2E6650 |
| Szöveg a kivonaton, másodlagos | #B8D0C5 |
| Alap (háttér) | #DCE5E0 |
| Lap | #FFFFFF |
| Tinta (szöveg) | #16231E |
| Másodlagos szöveg | #56655F |
| Szöveges gomb, link | #1B5A43 |
| Hajszálvonal | #D5DED9 |
| Halványzöld (monogram, kijelölés) | #E3EEE8 |
| Hiba / veszélyes | #B42318 |
| Figyelmeztetés (80%) | #8A5A00 |

**Betűk**
- **Literata** (TypeTogether, OFL, Google Fonts, opsz 7–72, 400–700): címek és minden összeg.
- **Atkinson Hyperlegible Next** (Braille Institute, OFL, 400/700): szöveg, gombok, azonosítók. A 0/O és az 1/l/I jól megkülönböztethető, ami az idősebbeknek is segít.
- Az Atkinson nullája áthúzott. Ez a számlaszámban és a közleményben jó, az összegekben viszont zavaró, ezért **összeg csak Literatával** szedhető.
- Az ő, Ő, ű és Ű betűt kirajzoltam és megnéztem: Literata 500/700, Atkinson 400/700.

**Csoportok és gombok**
- Az elsődleges gomb kitöltött zöld, 12 px-es sarokkal. A kivonaton belül fordított: fehér kitöltés, zöld felirat. Ez az egyetlen kitöltött forma a kivonaton.
- A másodlagos gomb fehér, zöld kerettel (pl. „Feltöltés” a teendőnél).
- A szöveges gomb aláhúzott zöld, a kivonaton aláhúzott fehér.
- A lapok sarka 14 px, a kivonaté 16 px.

**Sötét felület.** Egy lap: a kivonat.

**Magyar és pénzes finomság.** A gilos-szalag, de csak a kivonat felső szélén.

**Mire figyelj.**
- Egy sötét kártya a főoldal tetején emlékeztethet a banki „egyenleg-kártyára” (Kontist, N26). Ezért ez teljes szélességű kivonat, mondattal és táblázattal. Egyenleg nincs rajta, és nem bankkártya-arányú.
- A palackzöld messze van az OTP élénk fűzöldjétől, de ezt érdemes szem előtt tartani.

---

## B: Szilva és szárazpecsét (munkanév: **Rendben**)

**Ötlet.** A legvilágosabb, legcsendesebb változat. Sötét felülete nincs: a szín csak a szövegben, a vékony sávokban és az egyetlen kitöltött gombban jelenik meg. A bizalmat a lezárás adja: a könyvelő „lepecsételi” a hónapot.

**Merész elem.** A dombornyomott szárazpecsét, olyan, mint amilyen a bizonyítványokon van.
- Színe nincs, csak fény és árnyék. Körben ez áll rajta: „Kovács Bence könyvelő”, alul „2026. szeptember”, középen egy pipa.
- Két helyen jelenik meg: a dossziéban a lezárt hónap sorában, és a beadott tétel részleteinél.
- A kiemelt pillanat: amikor a könyvelő bead valamit, a pecsét egyszer „belenyomódik” (0,4 s).

**Paletta**

| Szerep | Szín |
|---|---|
| Szilva (márka, elsődleges gomb, sávok) | #4B1F45 |
| Szilva szöveg (link, szöveges gomb) | #6A2D61 |
| Alap | #E6E2E8 |
| Lap | #FFFFFF |
| Halvány szilva (monogram, kijelölés) | #F3EAF1 |
| Tinta | #241A23 |
| Másodlagos szöveg | #675C66 |
| Hajszálvonal | #E2DBE0 |
| Pecsét árnyéka / fénye | rgba(75,31,69,.42) / #FFFFFF |
| Hiba / veszélyes | #B42318 |

**Betű**
- **Schibsted Grotesk** (OFL, Google Fonts, 400–700), egyetlen családként.
- Címek: 600-as vastagság, enyhén szűkített betűközzel. Összegek: táblázatos számjegyekkel.
- Az ő, Ő, ű és Ű betűt kirajzoltam és megnéztem 400/600/700-as vastagságban.

**Csoportok és gombok**
- Az elsődleges gomb kitöltött szilva, teljesen lekerekített (pirula alakú), 54 px magas. A másodlagos ugyanilyen pirula, szilva kerettel. A szöveges gomb aláhúzott szilva.
- A sorok és a lapok szögletesek (18 px-es lapsarok), így már a formájuk alapján sem téveszthetők össze a gombokkal.
- Az állapotot 4 vékony szegmens és egy mondat mutatja.

**Sötét felület.** Nincs.

**Magyar és pénzes finomság.** A szárazpecsét, amely a hazai iratokon (bizonyítvány, közjegyzői irat) megszokott.

**Mire figyelj.**
- A szilva „szépségipari” hatású lehet. Ezt a hideg szürke alap és a visszafogottság ellensúlyozza.
- Ha a dombornyomás túl sok helyen szerepel, giccses lesz. Ezért csak a lezárt hónapon és a beadott tételen jelenik meg, és árnyékot az appban egyedül a pecsét kap.
- A „Rendben” köznapi szó, ezért nehezebb védjegyként levédetni.

---

## C: Tintakék levélpapír (munkanév: **Kézjegy**)

**Ötlet.** A privátbanki levél: a könyvelő havonta ír, és kézjeggyel látja el a levelet. Ez a legemberibb változat. Az „igazi könyvelő, nem robot” ígéretet közvetlenül megmutatja.

**Merész elem.** A havi levél a főoldal tetején. Egy fehér lap, amely rálóg a sötét fejlécre, és belső keretvonalat kap.
- Tartalma: keltezés („Budapest, 2026. október 2.”), megszólítás („Kedves Kata!”), két mondat, a tételek táblázata az összeggel, majd a könyvelő saját aláírása kék tollal, mellette a „Kérdésem van” gomb.
- Az aláírás SVG, a könyvelő egyszer adja le érintőképernyőn, a hozzájárulásával. Kitalált aláírás nem lehet.
- A feldolgozott dossziétételeknél a könyvelő kék monogramja (KB) áll, úgy, ahogy a papíron is szignálják az iratot.

**Paletta**

| Szerep | Szín |
|---|---|
| Tintakék (márka, fejléc, elsődleges gomb) | #17284A |
| Tintakék szöveg (link, szöveges gomb) | #22396A |
| Tollkék (csak aláírás és monogram) | #2546A6 |
| Alap | #DDE3EC |
| Lap | #FFFFFF |
| Tinta | #151C2A |
| Másodlagos szöveg | #596379 |
| Másodlagos szöveg a fejlécen | #AEBBD2 |
| A levél keretvonala | #C5CEDD |
| Hajszálvonal | #D6DCE5 |
| Hiba / veszélyes | #B42318 |

**Betűk**
- **Libre Caslon Condensed** (Impallari, OFL, Google Fonts, 400–700): cím, megszólítás, összegek. A keskeny Caslon a budapesti utcanévtáblák betűjére emlékeztet.
- **Archivo** (Omnibus-Type, OFL, 400/700, 96%-os szélességgel): szöveg és gombok.
- A Caslonnak nincs dőlt változata, ezért dőltet nem használunk. A monogram kézzel rajzolt SVG.
- Az ő, Ő, ű és Ű betűt kirajzoltam és megnéztem: Caslon 400/600, Archivo 400/700.

**Csoportok és gombok**
- Az elsődleges gomb kitöltött tintakék, 8 px-es sarokkal. Ez a legszögletesebb, legleveleszerűbb a négy közül.
- A másodlagos gomb fehér, tintakék kerettel. A szöveges gomb aláhúzott tintakék.
- A sötét fejlécben nincs gomb, csak a hónap és a könyvelő.
- A keretvonalat csak a levél kapja. A többi lap 12 px-es lekerekítésű, keret nélkül.

**Sötét felület.** Egy kb. 170 px magas fejlécsáv a fő képernyők tetején, erre lógnak rá a lapok.

**Magyar és pénzes finomság.** A kék tollas aláírás („kék tollal írd alá”) és az utcanévtáblás keskeny Caslon.

**Mire figyelj.**
- A sötétkéket sok könyvelő- és számlázóapp használja (Számlázz.hu, Dougs, Xero). Ettől a mélyebb, tintás árnyalat, a Caslon és a levélforma különbözteti meg.
- Ha a könyvelő nem ír levelet, a lap üres marad. Ezt a havi zárás folyamatának kell biztosítania.
- A „Kézjegy” név előtt a „Szignó” volt a jelölt, de az ütközik a Microsec e-Szignó aláíróappjával, ezért elvetettem.

---

## D: Pala és kockás lap (munkanév: **Tisztán**)

**Ötlet.** Átláthatóság: minden szám mellett ott van, hogyan jött ki. A „sötét előtér” a belépés, az ujjlenyomatos vagy arcos feloldás, a bekötés lépései és a befizetés megerősítése; ezek teljes képernyősen sötétek. A napi képernyők világosak.

**Merész elem.** A „Hogyan jött ki?” számolás kockás füzetlapon, az általános iskolai írásbeli összeadás mintájára.
- A rács 5 mm-es (18 px), halvány.
- A műveleti jel (−, =, ×) bal oldali oszlopban áll, a számok jobbra zárva, táblázatos számjegyekkel.
- A részeredmény alatt aláhúzás, a végösszeg alatt dupla vonal.
- Sorrend: bevétel − 40% költséghányad = jövedelem; × 15% SZJA-előleg, × 18,5% TB-járulék, × 13% szocho; = fizetendő.
- A kiemelt pillanat: első megnyitáskor a sorok egymás után „íródnak” (soronként 80 ms), és ez csak egyszer történik meg.

**Paletta**

| Szerep | Szín |
|---|---|
| Pala (márka, elsődleges gomb) | #2A4E57 |
| Előtér (belépés, bekötés, alsó sáv) | #1D373E |
| Alap | #DAE3E5 |
| Lap | #FFFFFF |
| Rácsvonal | #DCE8EA |
| Rácslap | #FBFDFD |
| Tinta | #132326 |
| Másodlagos szöveg | #536569 |
| Hajszálvonal | #D3DDDF |
| Halvány felirat a sötét sávon | #A9BFC4 |
| Hiba / veszélyes | #B42318 |
| Figyelmeztetés (80%) | #8A5A00 |

**Betűk**
- **Sofia Sans Condensed** (Lettersoup, OFL, Google Fonts, 600/700): címek és a nagy összegek.
- **Sofia Sans** (400/700): szöveg és a számolás számai.
- Ez egy betűcsalád két szélességben: szűkített címek, rendes szélességű szöveg.
- Az ő, Ő, ű és Ű betűt kirajzoltam és megnéztem: Condensed 600/700, Sans 400/700.

**Csoportok és gombok**
- Az elsődleges gomb kitöltött pala, 14 px-es sarokkal. A sötét előtéren fordított: fehér kitöltés, pala felirat.
- A másodlagos gomb fehér, pala kerettel. A szöveges gomb aláhúzott; az előtéren fehér, aláhúzott.
- Az alsó sáv sötét pala, az aktív fül fehér. Ez a napi képernyőkön is keretet ad.

**Sötét felület.** Az előtér képernyői teljesen sötétek, és a napi képernyőkön is sötét az alsó sáv. A napi tartalom világos.

**Magyar és pénzes finomság.** A kockás füzet, amin minden magyar megtanult írásban számolni.

**Mire figyelj.**
- A sötét kékeszöld közel áll a Kontist és az N26 színéhez. Ezért szürkébb és világosabb, és menta kiemelést nem kap.
- Ha a rács erős, gyerekes lesz. Ezért csak a számolásban van, és nagyon halvány.
- A Sofia Sansban az l és az I hasonló, de az azonosítók számjegyekből állnak, így ez itt nem okoz gondot.

---

## Összehasonlítás

| | A Számadó | B Rendben | C Kézjegy | D Tisztán |
|---|---|---|---|---|
| Mélyszín | palackzöld #14402F | szilva #4B1F45 | tintakék #17284A | pala #2A4E57 |
| Betű | talpas (Literata) + Atkinson | groteszk (Schibsted) | keskeny talpas (Caslon) + Archivo | keskeny groteszk (Sofia) |
| Sötét felület | egy kártya | semmi | fejlécsáv | előtér + alsó sáv |
| Merész elem | gilos kivonat | szárazpecsét | a könyvelő levele kézjeggyel | kockás számolás |
| Gomb formája | 12 px | pirula | 8 px | 14 px |
| Hangulat | klasszikus bank | csendes, könnyű | személyes, levélszerű | átlátható, pontos |
| Fő kockázat | „egyenleg-kártya” hatás | szépségipari szín | sötétkék a versenytársaknál | Kontist-közeli szín |

## Amit az AI-tervezési jelek miatt átírtam

- **A:** kezdetben sárgaréz vagy arany kiemelést kapott volna. A „sötétzöld + arany + talpas betű” viszont tipikus, generált „luxus” sablon, ezért kivettem; a gilos a háttér tónusában maradt. Az Atkinson áthúzott nullája az összegekben zavaró volt, ezért minden összeg Literata lett.
- **B:** a pecsét köriratát először pontokkal tagoltam („… • … •”). Ez a pontokkal tagolt adatsor jele, ezért két ívre bontottam, tagolójel nélkül. 70 px-en a pecsét szinte eltűnt, ezért 88 px lett, erősebb árnyékkal.
- **C:** az utcanévtábla vékony piros keretét elvetettem: a piros itt a hiba színe, és a hajszálkeretek „újságoldal” hatást keltettek volna. Egy keret maradt, csak a levélen. A monogram nem a Caslon gép által ferdített betűje, hanem kézzel rajzolt SVG. A név „Szignó”-ról „Kézjegy”-re változott.
- **D:** a réz kiemelést elvetettem, mert közel áll a terrakotta jelhez. A pala árnyalatot szürkébbre és világosabbra vettem, hogy elváljon az A zöldjétől és a Kontist kékeszöldjétől.
- **Mindegyik:** nincs csupa nagybetűs címke, nincs „→”, nincs egy kiemelt szó a címben. Az állapot szövegből és szegmensekből áll, a háttér erősebb az iOS-alapnál. Kontraszt (WCAG): a szöveg a lapon 16:1 felett, a másodlagos szöveg a háttéren 4,7–5,0:1, a fehér felirat a márkaszínen 9–14,6:1.

## Nevek

Gyors webes keresés 2026-11-17-én: a Számadó, a Rendben, a Kézjegy és a Tisztán névre nem találtam könyvelő- vagy pénzügyi appot. A Szignó ütközik (e-Szignó, Microsec). Végleges döntés előtt még kell: SZTNH védjegykeresés és .hu domain ellenőrzése. A „Számadó” a legjobban védhető (benne van az „adó” szó, és a számadó juhász is az, aki elszámol); a „Rendben” a leggyengébb.
