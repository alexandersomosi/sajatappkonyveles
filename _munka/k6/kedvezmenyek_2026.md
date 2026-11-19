# 2026-os SZJA-kedvezmények átalányadózó egyéni vállalkozónak + „Ennyit tegyél félre” határadó-jegyzet

Kutatás a tulaj 11-19-i rendeléséhez („Ez mind az 5 kell”), 3. és 1. funkció. **Csak kutatás, kódváltozás nincs.**
Készült: 2026-11-19. Minden szám hivatalos forrásból (njt.hu hatályos szöveg 2026.10.01-i állapot, NAV 2026-os információs füzetek, NAV sajtóközlemények), kivéve ahol `[ELLENŐRIZENDŐ]` vagy `[KÖNYVELŐ]` jelzés áll.
A motorral számolt példák a mostani `kod/ado-motor/dist` (ENGINE_VERSION 1.0.0, rules 2026-01-01) futtatásából jönnek.

---

## 0. Röviden

- Az átalányadózó EV-nél **először az adómentes rész** (az éves minimálbér fele, 2026-ban 1 936 800 Ft) jön le, mert az nem is része az összevont adóalapnak. A kedvezmények **csak az adóköteles átalányjövedelmet** csökkentik (NAV 100. és 3. füzet). Utána a sorrend a Szja tv. 29/H. § szerint: 30 év alatti anyák → 2/3/4+ gyermekes anyák → CSED/GYED/örökbefogadói díj → 25 év alattiak → személyi → első házasok → családi.
- **TB-járulékot csak a családi kedvezmény** csökkenthet (családi járulékkedvezmény, Tbj. 34. §, 80. §), és csak a ki nem használt rész 15 %-ával. **Szochót egyik kedvezmény sem csökkent.** A többi kedvezmény (anyák, 25 év alattiak, személyi, első házasok) csak az SZJA-t viszi le.
- Az anyák kedvezményeinek (30 év alatti, 2, 3, 4+ gyermekes) **nincs felső határa**: az anya átalányjövedelme után 0 Ft SZJA. A járulék és a szocho marad.
- Az EV-nek nincs munkáltatója, ezért adóelőleg-nyilatkozatot sem ad. **A kedvezményt maga érvényesíti a negyedéves SZJA-előlegben** (Szja tv. 49. § (1), (4)), a végleges elszámolás a 26SZJA bevallásban van (2027. május 20.). Ha családi járulékkedvezményt is kér, akkor az SZJA-előleget is a negyedéves **2658-as** bevallásban vallja be (Szja tv. 49. § (6)). A családi járulékkedvezmény havi összegeit is ott vallja be.
- 2026-os számok: családi kedvezmény 133 340 / 266 660 / 440 000 Ft kedvezményezett eltartottanként havonta, tartósan betegnél +133 340 Ft. 25 év alattiak: havi max. 715 765 Ft (éves max. 8 589 180 Ft). Személyi kedvezmény: 107 600 Ft/hó. Első házasok: 33 335 Ft/hó a párnak összesen. A 2 gyermekes anyák 2026-ban akkor jogosultak, ha **1986-ban vagy később** születtek. A 3 gyermekes anyáké **2025-10-01-től** él, életkortól függetlenül.
- A motor ma **egyik kedvezményt sem számolja**, csak figyelmeztet (`kedvezmeny_nem_modellezett`). A hiányok listája a 8. pontban van.
- A „félretenni” szabályra javaslat (10. pont): **a számla miatti többletadót a motor különbségszámításával** adjuk meg (az egész év adója a számlával és nélküle), felfelé kerekítve ezer forintra. Főfoglalkozásúnál a **havi fix minimumjárulékot külön sorban** mutatjuk (101 682 Ft/hó, garantált bérminimumnál 117 558 Ft/hó). Ez a felbontás pontos: a számlánkénti tételek és a fix rész összege éppen az éves fizetendő. Az adómentes rész, a minimum járulékalap és a negyedéves göngyölítés miatti ugrásokat is lekezeli. Kiderült ugyanis, hogy **ugyanaz az éves bevétel az év elejére sűrítve sokkal több járulékkal jár**: a példában 639 954 Ft a különbség.

---

## 1. Források (mind megnyitva és elolvasva 2026-11-19-én)

| Azonosító | Forrás | Mire használtam |
|---|---|---|
| szja-tv | 1995. évi CXVII. tv. (Szja tv.), njt.hu, hatályos állapot: 2026.10.01. – https://njt.hu/jogszabaly/1995-117-00-00 | 29. §, 29/A–29/F. §, 29/H. §, 46. § (9), 47. § (4a), 48. § (3b)–(3c), 49. § (1), (1a), (4), (6)–(8), 53. § |
| tv-2025-13 | 2025. évi XIII. tv. a 30 év alatti anyák kedvezményéről (hatályos 2026.01.01.) – https://njt.hu/jogszabaly/2025-13-00-00 | 1–5. § |
| tv-2025-14 | 2025. évi XIV. tv. a két gyermeket nevelő anyák kedvezményéről (hatályos 2026.01.01.) – https://njt.hu/jogszabaly/2025-14-00-00 | 1. §, 4. § (bevezetés életkor szerint) |
| tv-2025-15 | 2025. évi XV. tv. a három gyermeket nevelő anyák kedvezményéről (hatályos 2025.10.01.) – https://njt.hu/jogszabaly/2025-15-00-00 | 1. §, 4. § |
| tv-2025-16 | 2025. évi XVI. tv. a CSED, GYED és örökbefogadói díj kedvezményéről (hatályos 2025.07.01.) – https://njt.hu/jogszabaly/2025-16-00-00 | 1. § |
| tbj | 2019. évi CXXII. tv. (Tbj.), hatályos állapot 2026.10.01. – https://njt.hu/jogszabaly/2019-122-00-00 | 34–36. § (családi járulékkedvezmény), 40. § (2)–(3), 42. § (2), 79–81. § |
| szocho-tv | 2018. évi LII. tv. (Szocho tv.), hatályos állapot 2026.10.01. – https://njt.hu/jogszabaly/2018-52-00-00 | 5. § (1a), 20. § (2), 34. § 16–17. pont |
| nav-73 | NAV 73. sz. információs füzet – Szja adóalap-kedvezmények (közzétéve 2026.03.19.) – https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/73.-Szja-adoalap-kedvezmenyek-2026.-03.19 | minden kedvezmény részletei, 2026-os összegek, évközi érvényesítés, nyilatkozatok tartalma |
| nav-100 | NAV 100. sz. füzet – Az egyéni vállalkozók átalányadózásának alapvető szabályai (2026.02.20.) – https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/100.-Az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-02.-20 | 3–4. pont (adómentes rész, kedvezmények átalánynál), 6. pont (járulék, szocho, családi járulékkedvezmény, nyugdíjas anyák szochója), példatáblák |
| nav-3 | NAV 3. sz. füzet – Az egyéni vállalkozók szja- és járulékkötelezettsége (2026.08.31.) – https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/03.-Az-egyeni-vallalkozok-szja--es-jarulekkotelezettsege-2026.-08.-31. | 2.5 pont (átalány + kedvezmények + 2658), 4.1 pont (családi járulékkedvezmény EV-nél) |
| nav-iden | NAV: Így adózunk idén (2026.01.05.) – https://nav.gov.hu/sajtoszoba/hirek/Igy_adozunk_iden | 2026-os változások összefoglalója (családi kedvezmény duplázás, anyák) |
| nav-jovore | NAV: Így adózunk jövőre (2025.12.22.) – https://nav.gov.hu/sajtoszoba/hirek/Igy_adozunk_jovore | 45 % költséghányad, adómentes rész, szocho minimum 100 % |
| nav-kalk | NAV családi adókedvezmény-kalkulátor 2026–2029 (csak a link a füzetlistán, nem használtam számításhoz) – https://nav.gov.hu/ugyfeliranytu/kalkulatorok/csaladi-adokedvezmeny-kalkulator-2026-2029 | ellenőrzéshez a könyvelőnek |

---

## 2. Közös szabályok átalányadózó EV-nél

### 2.1 Mire vonatkoznak a kedvezmények
- Szja tv. 29. §: az összevont adóalapba tartozik „átalányadózás esetén az egyéni vállalkozói … bevételből az átalányban megállapított jövedelem”.
- Az adómentes rész (az éves minimálbér felét meg nem haladó rész, Szja tv. 1. sz. melléklet 4.48.; 2026-ban **1 936 800 Ft**, nem arányosítandó) adómentes, tehát nem része az összevont adóalapnak. NAV 100 és NAV 3: az EV „az összevont adóalap részét képező **adóköteles** átalányban megállapított jövedelemből” érvényesítheti a kedvezményeket. **Tehát az adómentes rész jön először, a kedvezmények csak az e feletti részre hatnak.**
- Mind a négy anyakedvezmény, a 25 év alattiaké és a NÉTAK törvényi listájában szerepel: „a vállalkozói jövedelem szerinti adózást alkalmazó egyéni vállalkozó vállalkozói kivétje, **átalányadózás esetén az átalányban megállapított jövedelme**” (Szja tv. 29/D. § (2) ca), 29/F. § (2) ca), 2025. évi XIII. tv. 1. § (3) ca), XIV. és XV. tv. 1. § (2) ca)).
- A 89 %-os szabály (Szja tv. 29. § második mondata, 47. § (5)) az átalányadózó EV-re a NAV példái szerint nem vonatkozik: a NAV 100 példája 15 %-ot számol a teljes adóköteles átalányjövedelemre (1 913 200 × 15 % = 286 980). A motor is így számol, a NAV példáin ellenőrizve.

### 2.2 Érvényesítési sorrend (Szja tv. 29/H. §, 2026-tól)
1. 30 év alatti anyák kedvezménye
2. négy vagy több / három / két gyermeket nevelő anyák kedvezménye (egyszerre csak egy jogcím)
3. CSED, GYED, örökbefogadói díj kedvezménye
4. 25 év alatti fiatalok kedvezménye
5. személyi kedvezmény
6. első házasok kedvezménye
7. családi kedvezmény

29/H. § (2): ha az anya egész évben jogosult, de közben más jogcímen (például a 3 gyermekesből májusban 4 gyermekes lesz), akkor egész évre az **év első napján** érvényes jogcímet használja (ha több is van, ő választ). Ilyenkor nincs új nyilatkozat és nincs jövedelem-megosztás.

### 2.3 Évközi érvényesítés EV-nél
- Szja tv. 49. § (1): az adóelőleg-alapot csökkenti „az adóévben az adóelőleg megállapításánál általa vagy más jogosult által **korábban még nem érvényesített** kedvezmény”. Ez **göngyölítéses (év eleje óta számolt)** kedvezménykeretet jelent: ami egy korábbi negyedévben nem fogyott el, az később felhasználható.
- 49. § (4): az EV negyedévenként fizet előleget, a negyedévet követő hó 12-éig.
- NAV 73 (2.5): „Az egyéni vállalkozó … az adóelőleg megállapításakor **saját maga érvényesíti** a kedvezményt.” Munkáltató nélkül nincs adóelőleg-nyilatkozat.
- 49. § (6) és NAV 3 (2.5): ha az EV **családi járulékkedvezményt** akar év közben, akkor az átalányjövedelem SZJA-előlegét is **negyedévente állapítja meg és vallja be a 2658-as** bevallásban (különben az előleget csak megfizeti, és az éves bevallásban negyedéves bontásban szerepelteti).
- 49. § (1a): az anyakedvezmények alapjába tartozó jövedelem előlegalapja más kedvezménnyel nem csökkenthető. A ki nem használható családi kedvezmény 15 %-a családi járulékkedvezményként vehető igénybe.
- 49. § (7)–(8): ha az anyák vagy a 25 év alatti kedvezményére a jogosultság nem áll fenn a negyedév egészében, és az önálló tevékenység jövedelme másként nem állapítható meg, akkor a negyedéves előlegalapot a jogosultsági hónapok arányában kell megosztani. Az átalányadózónál a bevétel napra pontosan ismert (pénzforgalmi), ezért valószínűleg „másként megállapítható” `[KÖNYVELŐ]`.
- 46. § (9): a vállalkozói bevétel előlegét sem kell megfizetni, amíg az év elejétől összesítve (vagy az adott negyedévben) a fizetendő összeg nem haladja meg a 10 000 Ft-ot. A motor ezt nem modellezi, ez csak halasztás.
- Az éves elszámolás a 26SZJA bevallásban történik (2027. május 20.). Ha év közben nem kérte, a kedvezmény ott is érvényesíthető (NAV 73, 14. pont). A közös érvényesítés és a megosztás a bevallásban dől el, függetlenül attól, ki érvényesítette év közben (Szja tv. 29/B. § (1c)).
- Jogosulatlan évközi igénybevétel: visszafizetés és 12 % különbözeti bírság, ha a befizetési kötelezettség > 10 000 Ft (NAV 73, 13. pont; Tbj. 81. § (3)).

---

## 3. Kedvezményenként

### 3.1 30 év alatti anyák kedvezménye (2025. évi XIII. tv., 2026-01-01-től új szabályok)
- **Ki:** az a nő, aki **az adóévet megelőző év december 31. után tölti be a 30. életévét** (2026-ban: 1996-01-01-jén vagy később született), és az adóévben a vér szerinti vagy örökbe fogadott gyermekére tekintettel (29/A. § (3) a)) vagy **magzatra** tekintettel (91. naptól, 29/A. § (3) b)) családi kedvezményre jogosult. 2026-tól a 2023 előtt született gyermekek után is jár (NAV 73, nav-iden). Nem jogosult a nevelőszülő, és az sem, aki a férje gyermekeit örökbefogadás nélkül neveli.
- **Mérték:** 2026-tól **nincs összeghatár** (NAV 73, 2.2), tehát a kedvezmény alapjába tartozó teljes jövedelem SZJA-mentes. 2023–2025-ben még az átlagkereset volt a felső határ.
- **Időszak:** havonta számol. A jogosultsági hónap az, amelyben a családi kedvezményre jogosultsága fennáll. Legkésőbb **annak az évnek az utolsó jogosultsági hónapjáig** jár, amelyben betölti a 30. évét.
- **Átalány:** az adóköteles átalányjövedelem teljes egészében mentes. Ha nem egész évben jogosult, a jövedelmet a jogosultsági hónapok arányában kell venni, ha másként nem állapítható meg (1. § (5)).
- **TB / szocho:** nem érinti. A családi kedvezményt ettől még igénybe veheti, és mivel nincs SZJA-alap, az **családi járulékkedvezménnyé** alakulhat (NAV 73, 2.5).
- **Kizár:** a sorrend miatt az anyák 2/3/4+ kedvezményéhez, a 25 év alattiakéhoz és a CSED/GYED-éhez nem marad alap. Személyi és első házasok csak más jövedelemre (például bérbeadásra) jöhet szóba.
- **Bevallás:** jogcím, gyermek neve és adóazonosító jele (magzatnál a várandósság időszaka), a jogosultság kezdete/vége, ha nem egész évben jogosult, és a kedvezmény alapja (1. § (6)).

### 3.2 Négy vagy több gyermeket nevelő anyák kedvezménye – NÉTAK (Szja tv. 29/D. §, 2020 óta)
- **Ki:** az a nő, aki vér szerinti vagy örökbe fogadó szülőként legalább 4 gyermek után családi pótlékra jogosult, vagy már nem jogosult, de a jogosultsága legalább 12 évig fennállt (a gyermek halála miatt megszűnt jogosultság is számít). **Nincs életkori határ, élete végéig jár.**
- **Mérték:** nincs felső határ.
- **Időszak:** a jogosultság annak a hónapnak az 1. napján nyílik meg, amelyben a feltétel bármely napon teljesül, és annak a hónapnak az utolsó napján szűnik meg, amelynek egészében már nem teljesül (29/D. § (4)). Ha nem egész évben jogosult, az önálló jövedelmet arányosan kell venni (29/D. § (5)).
- **Bevallás:** a gyermekek neve és adóazonosító jele (vagy természetes azonosítója), a jogosultság kezdete/vége és a kedvezmény alapja (29/D. § (6)).

### 3.3 Három gyermeket nevelő anyák kedvezménye (2025. évi XV. tv.)
- **Mikortól:** a **2025. szeptember 30. után** megszerzett jövedelemre (hatályos 2025-10-01-től). **Életkortól független** (a törvény preambuluma és a NAV 73 is ezt mondja).
- **Ki:** mint a NÉTAK, csak a gyermekek száma 3 (a 12 éves és az elhunyt gyermekre vonatkozó szabály ugyanaz).
- **Mérték:** nincs felső határ.
- A 2025-ös adóelőleg-nyilatkozatot a munkáltatónak folytatólagosnak kell tekintenie. EV-nél ez nem releváns, ő maga érvényesíti.

### 3.4 Két gyermeket nevelő anyák kedvezménye (2025. évi XIV. tv., 4. § – bevezetés életkor szerint)
| Ha a nő … | akkor ezen jövedelmekre jár (és utána élete végéig) |
|---|---|
| **2025-12-31 után** tölti be a 40. életévét (1986-ban vagy később született) | 2025-12-31 után megszerzett, azaz **2026-01-01-től** |
| 2026-12-31 után tölti be az 50. évét (1977-ben vagy később született) | **2027-01-01-től** |
| 2027-12-31 után tölti be a 60. évét (1968-ban vagy később született) | **2028-01-01-től** |
| mindenki más | **2029-01-01-től** |

- Ha a jogosultság egyszer megnyílt, a későbbi életkor nem számít, élete végéig megmarad.
- Feltétel: 2 gyermek után családi pótlékra jogosult, vagy a jogosultság legalább 12 évig fennállt (a gyermek halála is számít). Mérték: **nincs felső határ**.
- NAV 73 példák: ikrek születésekor a szülés hónapjának 1. napjától jár. Ha váláskor a gyermek az apához kerül, akkor annak a hónapnak a végéig jár.

### 3.5 CSED, GYED, örökbefogadói díj kedvezménye (2025. évi XVI. tv.)
- Ez magát az ellátást teszi SZJA-mentessé, a folyósító automatikusan alkalmazza. **Az EV átalányjövedelmét nem érinti.** A kérdőívben elég megkérdezni, mert ilyenkor kieső idő van (nincs minimum-járulékalap, a motor `kieso` szakaszként tudja kezelni).

### 3.6 25 év alatti fiatalok kedvezménye (Szja tv. 29/F. §)
- **Ki:** aki még nem töltötte be a 25. évét. Jogosultsági hónap minden olyan hónap, amelyben még nem töltötte be, **utoljára a 25. születésnap hónapja** (29/F. § (3)). Csak EGT-állampolgár vagy szomszédos ország állampolgára (29/F. § (6)).
- **Mérték 2026:** havonta legfeljebb **715 765 Ft** (a KSH 2025. júliusi teljes munkaidős bruttó átlagkeresete, Hivatalos Értesítő 52. sz., 2025.11.17.), ez havi 107 365 Ft adó. Teljes évre legfeljebb **8 589 180 Ft** adóalap (1 288 377 Ft adó) (NAV 73, 7.2). Az éves keret = jogosultsági hónapok × 715 765 Ft.
- **Átalány:** az **adóköteles** átalányjövedelemre jár, vagyis 2026-ban egy egész évben 25 év alatti EV-nek 1 936 800 + 8 589 180 = **10 525 980 Ft** átalányjövedelemig nincs SZJA-ja (45 %-nál ez 19 138 145 Ft bevétel). A kedvezmény csak a jogosultsági hónapokban szerzett jövedelemre jár, a fel nem használt keret nem vihető át későbbi hónapokra (NAV 73, 7.1). Év közbeni 25. születésnapnál arányosítás (29/F. § (4), 49. § (8)).
- **TB / szocho:** nem érinti.
- Munkavállalónál automatikus. Az EV maga alkalmazza az előlegben, és a bevallásban mindenképp szerepeltetni kell.

### 3.7 Személyi kedvezmény (Szja tv. 29/E. §)
- **Ki:** súlyosan fogyatékos magánszemély, azaz a 335/2009. (XII. 29.) Korm. rendeletben felsorolt betegségben szenved, vagy rokkantsági járadékban, illetve fogyatékossági támogatásban részesül.
- **Mérték:** jogosultsági hónaponként a minimálbér egyharmada száz forintra kerekítve: **2026-ban 107 600 Ft/hó** (16 140 Ft adó). Egész évre 1 291 200 Ft (193 680 Ft adó).
- **Időszak:** azok a hónapok, amelyekben a fogyatékos állapot legalább egy napig fennáll (orvosi igazolás szerinti kezdő/záró nap). Járadéknál a folyósítás hónapjai.
- **Igazolás:** orvosi igazolás (49/2009. EüM r.) vagy határozat. Nem kell csatolni, de az elévülésig meg kell őrizni.

### 3.8 Első házasok kedvezménye (Szja tv. 29/C. §)
- **Ki:** az a házaspár (bejegyzett élettárs is), ahol legalább az egyik fél az első házasságát köti. Életkortól független. EGT- vagy szomszédos országbeli állampolgár.
- **Mérték:** a párnak együtt jogosultsági hónaponként **33 335 Ft** adóalap (5 000 Ft adó). Szabadon megoszthatják, vagy egyikük veszi igénybe.
- **Időszak:** a házasságkötést **követő hónaptól legfeljebb 24 hónap**, amíg az életközösség fennáll. Ha mindkettő 25 év alatti: attól a hónaptól jár, amelyet megelőző hónapban valamelyikük betölti a 25. évét (29/F. § (5)).
- A régi „gyermek születéséig tart” korlát **már nincs a törvényben**. A NAV 73 kifejezetten leírja azt az esetet, amikor valaki az első házasok és a családi kedvezményre is jogosult (ezért van az első házasoké a családi előtt).
- **Bevallás:** közös nyilatkozat egymás adóazonosító jelével és a megosztással (29/C. § (6)).

### 3.9 Családi kedvezmény (Szja tv. 29/A–29/B. §)
- **2026-os összegek** (29/A. § (2), hatályos 2026-01-01-től; NAV 73, 10.4; nav-iden):

| eltartottak száma | kedvezmény kedvezményezett eltartottanként / hó | adóban |
|---|---|---|
| 1 | 133 340 Ft | 20 001 Ft |
| 2 | 266 660 Ft | 39 999 Ft |
| 3 vagy több | 440 000 Ft | 66 000 Ft |

  NAV 73 táblája: 2 eltartott és 1 kedvezményezett = 266 660 Ft; 2/2 = 533 320 Ft (79 998 Ft adó); 3/1 = 440 000; 3/2 = 880 000; 3/3 = 1 320 000 Ft (198 000 Ft adó).
  **Tartósan beteg vagy súlyosan fogyatékos** kedvezményezett eltartott után **+133 340 Ft/hó** (29/A. § (2a)).
- **Jogosult** (29/A. § (3)): aki családi pótlékra jogosult, és a vele közös háztartásban élő, családi pótlékra nem jogosult házastársa. A várandós nő és a házastársa (élettársa nem!) a 91. naptól. A saját jogán jogosult gyermek, illetve a rokkantsági járadékos, vagy egy általuk választott hozzátartozó. A családi pótlék tényleges folyósítása nem feltétel (NAV 73).
- **Kedvezményezett eltartott** (29/A. § (4)): akire családi pótlékot kap, a magzat (91. naptól a születésig), a saját jogán jogosult, a rokkantsági járadékos. **Eltartott** (29/A. § (5)): a kedvezményezett eltartottakon túl az is, akit a családi pótlék összegénél figyelembe vesznek (például első diplomáját szerző, nappalis, rendszeres jövedelem nélküli egyetemista). Ez az eltartotti létszámot (és vele a gyermekenkénti összeget) növeli, kedvezményt nem ad.
- **Jogosultsági hónap** (29/A. § (6)): a családi pótlékra jogosultság hónapjai. Várandósságnál a hónap, amelyben a 91. nap legalább egy napig fennáll, kivéve a születés hónapját, ha akkor megnyílik a családi pótlék.
- **Felváltva gondozott gyermek** (29/B. § (1e)): mindkét szülőnél kedvezményezett eltartott, de a kedvezmény 50 %-a jár, és a két szülő egymással nem érvényesítheti közösen.
- **Közös érvényesítés** (29/B. § (1a), (1c)): több jogosult (például házastársak, közös gyermekes élettársak) havonta egy keretet használ, amelyet szabadon feloszt. Ez lehet **év közben is és év végén is**. **Megosztás** a jogosultnak nem minősülő, közös háztartásban élő házastárssal vagy élettárssal (29/B. § (1b)): **csak az éves bevallásban**, és nem lehet azokra a hónapokra, amelyekben egyedülállóként kapja a családi pótlékot (kivéve Cst. 12. § (3)), vagy amelyekben közösen érvényesítették.
- **Bevallás:** a jogcím, minden eltartott adóazonosító jele (a magzat kivételével), hogy mely hónapokban minősült eltartottnak vagy kedvezményezett eltartottnak, és közös érvényesítésnél/megosztásnál a másik fél adóazonosító jele és a hónapok száma (29/B. § (2), (2a)).
- **Év közben** igénybe vett családi járulékkedvezmény csökkenti az év végén érvényesíthető családi kedvezményt (a csjk 667 %-ával, azaz a csjk / 0,15 összeggel; 29/B. § (6)).

### 3.10 Családi járulékkedvezmény (Tbj. 34–36. §, 80–81. §)
- **Ki:** az a **biztosított**, aki családi kedvezményre jogosult (megosztásnál a megosztással érintett biztosított házastárs/élettárs is). Biztosított a főfoglalkozású és a mellékállású EV is. A **nyugdíjas (kiegészítő tevékenységű) EV nem fizet TB-járulékot, így nincs mit csökkenteni.**
- **Összeg (éves):** a családi kedvezmény SZJA-ban ténylegesen fel nem használt részének 15 %-a, legfeljebb a TB-járulék (18,5 %) összege (34. § (3)). **Csak a TB-járulékot csökkenti, a szochót nem.** A biztosított ellátásait nem érinti (35. §).
- **Átalányadózó EV-re vonatkozó külön szabály** (34. § (6), 80. § (2); NAV 100, 6.1; NAV 3, 4.1):
  - Általában a göngyölítéssel megállapított járulékalapot terhelő TB-járulék erejéig.
  - **Főfoglalkozásúnál** (azaz nem a Tbj. 42. § (2) a)–b) szerinti mellékállású) **az adómentes résszel egyező járulékalap után fizetett járulékból is** levonható.
  - Ha a főfoglalkozású a **minimálbért** köteles járulékalapnak venni, akkor a csjk a minimálbérnek csak az **átalányjövedelmet (akkor is, ha adómentes) meg nem haladó része** utáni járulékból vonható le. **Ha abban a hónapban nem volt jövedelme, akkor nincs csjk.**
- **Havi összeg EV-nél** (80. § (2)): 15 % × (a családi kedvezmény havi összege − az átalányjövedelem havi összege után megállapított SZJA-előlegalap), ha ez pozitív. Legfeljebb a göngyölített (minimumnál a fenti módon korlátozott) alap utáni TB-járulék. NAV 100 példatábla „Csjk alapja” oszlopa: ha a hónap a minimumon van, az alap min(minimálbér, a havi jövedelem), jövedelem nélküli hónapban 0. Ha a hónap göngyölített alapon van, akkor a göngyölített alap, akkor is, ha abban a hónapban nem volt jövedelem.
- **Bevallás:** a 2658-ban (negyedéves, havi bontás). A TB-járulékból ennyit nem fizet be (80. § (4)). Az év közben jogszerűen érvényesített csjk végleges, nem kell újraszámolni (36. §). Az éves elszámolásban a még igényelhető részt az SZJA terhére kell elszámolni, a visszafizetendőt SZJA-ként kell befizetni (81. § (4)).
- Év közben csak az veheti igénybe, aki maga családi kedvezményre jogosult. A megosztásból jövő csjk csak az SZJA-bevallásban érvényesíthető (NAV 100).

---

## 4. Kölcsönhatások (mi mivel kombinálható)

| Kombináció | Szabály | Forrás |
|---|---|---|
| Adómentes rész + bármely kedvezmény | Előbb az adómentes rész, a kedvezmény csak az adóköteles átalányjövedelmet csökkenti | NAV 100 4., NAV 3 2.5 |
| 30 év alatti anya + 2/3/4+ anya / CSED-GYED / 25 év alatti | Formálisan mind jár, de a 30 év alattiaké az első és nincs határa, így a többihez **nem marad alap** | Szja tv. 29/H.; NAV 73 2.5 |
| Anyák (bármely) + családi kedvezmény | **Igen.** A családi kedvezmény SZJA-alap hiányában **családi járulékkedvezményként** érvényesül (TB-ből), vagy a házastárs veszi igénybe (közös érvényesítés) | Szja tv. 48. § (3c), 49. § (1a); NAV 73 2.5, 13. |
| Anyák (2/3/4+) között | Egyszerre csak egy jogcím. Ha év közben vált, az év első napján érvényes jogcím szól egész évre | Szja tv. 29/H. § (2) |
| 25 év alatti + első házasok | Ha mindkét házastárs 25 év alatti, az első házasoké később indul (a 25. születésnap utáni hónaptól) | Szja tv. 29/F. § (5) |
| Első házasok + családi | **Kombinálható** (a régi „gyermekig” korlát nincs). Sorrend: első házasok előbb | Szja tv. 29/C, 29/H; NAV 73 9. |
| Családi kedvezmény házastársak között | Közös érvényesítés év közben és év végén; megosztás (nem jogosult házastárssal/élettárssal) csak év végén; felváltva gondozott gyermeknél 50 %, egymással nem | Szja tv. 29/B. § |
| Családi kedvezmény + csjk | Ugyanaz a keret: amit csjk-ként elhasznált, az SZJA-ban már nem érvényesíthető (csjk/0,15) | Szja tv. 29/B. § (6); Tbj. 34. § (3) |
| Bármely kedvezmény + szocho | **Szochót egyik sem csökkent.** Kivétel-szerű szabály: anyakedvezményt érvényesítő **saját jogú nyugdíjas** EV-nek szochót kell fizetnie a kedvezmény alapjába tartozó jövedelem 4 × éves átlagkereset (2026: **34 356 720 Ft**) feletti része után. **Átalányadózónál ez gyakorlatilag elérhetetlen**: a maximális átalányjövedelem 45 %-nál 21 304 800 Ft, kiskereskedelemnél 19 368 000 Ft | Szocho tv. 5. § (1a), 20. § (2), 34. § 16–17.; NAV 100 6.3 |
| Bármely kedvezmény + TB-járulék | Csak a családi kedvezmény (csjk útján). A többi a járulékalapot és a járulékot sem érinti | Tbj. 34. §; NAV 73 11. |

---

## 5. Mit kér a könyvelő (kérdőív-mezők és dokumentumok)

Általános: születési dátum (25 és 30 év alatti, 2 gyermekes anyák korhatára), nem (az anyakedvezményekhez), állampolgárság (EGT / szomszédos: 25 év alatti, első házasok). **Az adóazonosító jeleket csak a könyvelő kezeli a panelen. Az ügyfél-appban nem kérjük gépelve, legfeljebb biztonságos feltöltésként.** `[KÖNYVELŐ dönt]`

| Kedvezmény | Adat | Dokumentum (megőrzendő) |
|---|---|---|
| 30 év alatti anyák | gyermek(ek) neve és adóazonosító jele, vagy várandósságnál a 91. nap éve/hónapja; a jogosultság kezdete/vége | születési anyakönyvi kivonat / örökbefogadási határozat; várandóssági orvosi igazolás |
| 2/3/4+ gyermekes anyák | a számító gyermekek listája: név, adóazonosító jel (vagy születési hely/idő), és hogy most jár-e családi pótlék, ≥ 12 évig járt-e, elhunyt-e; az anya születési éve (2 gyermekesnél 2026-ban ≥ 1986); a jogosultság kezdete/vége | családi pótlék határozat, igazolás a korábbi folyósításról |
| 25 év alatti | születési dátum (a hónapokat a motor számolja) | – |
| Személyi | az állapot kezdete/vége, vagy hogy végleges; a jogcím (betegség / rokkantsági járadék / fogyatékossági támogatás) | orvosi igazolás (49/2009. EüM r.) vagy határozat |
| Első házasok | a házasságkötés dátuma; első házasság-e (legalább az egyiknek); a házastárs neve és adóazonosító jele; a megosztás (Ft/hó vagy %); mindketten 25 év alattiak-e | házassági anyakönyvi kivonat |
| Családi | a jogosultság jogcíme (29/A. § (3) a–d); minden eltartott: név, adóazonosító jel, hónapok, kedvezményezett vagy csak eltartott (például nappalis egyetemista), tartósan beteg/súlyosan fogyatékos, felváltva gondozott; magzatnál a 91. nap dátuma; a házastárs/élettárs neve és adóazonosító jele, jogosult-e, a felosztás; kéri-e a családi járulékkedvezményt év közben | családi pótlék határozat, iskolalátogatási/hallgatói jogviszony-igazolás, orvosi igazolás (tartós betegség, várandósság), bírósági döntés/egyezség (felváltva gondozás) |
| CSED/GYED | időszak (kieső idő a járulékhoz) | folyósítói igazolás |

---

## 6. Számpéldák (2026, főfoglalkozású, 45 %, 12 000 000 Ft bevétel egyenletesen, a motor jelenlegi eredménye kedvezmény nélkül)

- Átalányjövedelem 6 600 000 Ft, adóköteles 4 663 200 Ft.
- Kedvezmény nélkül (motor, egész év): SZJA 699 480 + TB 862 692 + szocho 606 216 = **2 168 388 Ft**.
- **Két gyermek (2/2 eltartott), a keretet teljesen az EV használja:** keret 12 × 533 320 = 6 399 840 Ft > adóköteles 4 663 200 → **SZJA 0**. A maradék 1 736 640 Ft keret 15 %-a = **260 496 Ft csjk** (a TB-plafon 862 692 Ft, nem köt). TB 602 196 + szocho 606 216 = **1 208 412 Ft** (megtakarítás 959 976 Ft = a teljes keret 15 %-a). *Ez az éves nézet. Az évközi havi csjk-mechanika más ütemezést adhat, az éves bevallás rendezi* `[KÖNYVELŐ]`.
- **2 gyermekes anya, 1986 után született, és a családi kedvezményt is ő veszi igénybe:** SZJA 0 (anyakedvezmény). A családi keret 15 %-a (959 976 Ft) csjk lehetne, de legfeljebb a TB 862 692 Ft → TB 0. Csak a **szocho 606 216 Ft** marad. Ha a férj munkavállaló, jobb lehet, ha a családi kedvezményt (vagy egy részét) a férj veszi igénybe a bérénél: ez családi döntés, a könyvelő tanácsolja.
- **25 év alatti egész évben:** adóköteles 4 663 200 < 8 589 180 → SZJA 0. TB 862 692 + szocho 606 216 = 1 468 908 Ft.
- NAV-példák tesztnek: NAV 100 6.1 csjk-tábla (Csjk alapja: I. n. év 968 400, I–II. 1 491 200, I–III. 1 814 000, I–IV. 2 459 600); NAV 73 13. „angoltanárnő” példája (840 000 − 3 × 266 660 = 40 020 előlegalap → 6 003 Ft, 10 000 Ft alatt nem kell fizetni; adószámos magánszemély, nem EV, de a göngyölített keret logikáját mutatja).

---

## 7. Mit nem tudunk biztosan `[KÖNYVELŐ]`

1. A 49. § (7)–(8) szerinti „másként nem állapítható meg” arányosítás az átalányadózónál, amikor a jogosultság év közben nyílik vagy szűnik (például szülés júliusban): a pénzforgalmi bevétel hónapjai szerint, vagy a hónapok arányában? A javaslat: a bevétel hónapja szerint, a könyvelő megerősítésével.
2. Az adómentes rész „elfogyásának” sorrendje részéves anyakedvezménynél: a január–júniusi jövedelem fogyasztja el először (kronologikusan)? A motor göngyölítéses logikája ezt adja.
3. Csjk főfoglalkozásúnál **garantált bérminimum** esetén: a Tbj. 34. § (6) és a 80. § (2) a „minimálbér” szót használja. A Tbj. EV-fogalma (NAV 100 6.1) szerint a minimálbér a garantált bérminimumot is jelentheti, ezt a könyvelő erősítse meg.
4. A családi kedvezmény év közbeni elosztása az EV és a munkavállaló házastárs között (melyiknél érdemesebb).
5. A 2027-es értékek: a 25 év alatti 2027-es havi kerete (KSH 2026. júliusi átlagkereset) és a 2027-es minimálbér (ebből a személyi kedvezmény és az adómentes rész) még nincs a motorban (2027 draft).

---

## 8. Mit NEM tud a motor (kod/ado-motor, 2026-11-19)

Átnézve: `src/types.ts`, `src/validate.ts`, `src/engine/year.ts`, `src/engine/meters.ts`, `src/rules/2026.ts`, `src/rules/2027.ts`, `src/rules/types.ts`, `test/*` (egyetlen kedvezmény-teszt: `esetek.test.ts` „allowances are not modelled but announced”), valamint a backend `client_tax_profiles.allowances` és a panel/kliens zod-sémái.

**Kedvezmények (3. funkció):**
1. **Egyik kedvezményt sem alkalmazza.** `profile.allowances` jelenléte csak a `kedvezmeny_nem_modellezett` (ugyfel) figyelmeztetést adja, a számok nem változnak (`year.ts` 373. sor). `szjaCum = 15 % × taxableYTD` mindig.
2. **Hiányos az adatmodell:** `allowances: { kind: 'csaladi' | 'fiatal_25' | 'anyak' | 'egyeb'; note? }[]`. Nincs benne: születési dátum, nem; a 30 év alatti / 2 / 3 / 4+ gyermekes anyák szétválasztása; személyi; első házasok; eltartottak és kedvezményezett eltartottak száma havonta; tartósan beteg (+133 340); felváltva gondozott (50 %); közös érvényesítés/megosztás aránya; jogosultsági hónapok (kezdet/vég); csjk kérése év közben; a könyvelői jóváhagyás állapota. A backend (`schema.ts` 349–350, `acc.ts` 306, `client.ts` 134) ugyanezt a szegény sémát tárolja (max. 6 elem, 200 karakteres megjegyzés).
3. **Nincsenek kedvezmény-értékek a `TaxRules`-ban:** családi 133 340 / 266 660 / 440 000 és +133 340; első házasok 33 335; személyi = kerekítés100(minimálbér / 3) = 107 600; 25 év alatti havi plafon 715 765; 4 × éves átlagkereset 34 356 720; a 2 gyermekes anyák születési év határa (2026: 1986-01-01, 2027: 1977-01-01, 2028: 1968-01-01, 2029: nincs); a 30 év alattiak szabálya (az előző év dec. 31. után tölti be a 30-at); a 3 gyermekes anyák kezdete 2025-10-01. A 2027-es draft sem tartalmazza ezeket.
4. **Nincs sorrend-logika** (29/H. §), nincs anyai jogcímválasztás (29/H. § (2)), nincs göngyölített (YTD) kedvezménykeret az előlegben (49. § (1)).
5. **Nincs családi járulékkedvezmény:** havi számítás (80. § (2)), a göngyölített vagy minimum-alap szerinti plafon, a főfoglalkozású adómentes-rész szabálya, minimumon „min(minimálbér, havi jövedelem)” alap, jövedelem nélküli minimum-hónapban 0, mellékállásnál csak a göngyölített alap, nyugdíjasnál nincs. A `PaymentLine` TB-összege nem csökken, nincs „csjk” magyarázatsor.
6. **Nincs havi jogosultság-naptár** a kedvezményekhez (25. születésnap hónapja, házasság +1…+24 hónap, gyermek/magzat hónapjai, anyai jogosultság nyílása és szűnése), és nincs a 49. § (7)–(8) szerinti negyedéves arányosítás.
7. **Nincs 2658 / SZJA-bevallási eltérés:** csjk esetén az SZJA-előleget is a 2658-ban kell bevallani (49. § (6)). A `deadlinesFor` és a magyarázat ezt nem jelzi.
8. **Nincs éves elszámolás (26SZJA):** az év végi kedvezmény-érvényesítés, visszatérítés, a családi kedvezmény csökkentése a csjk/0,15 összeggel (29/B. § (6)), és 10 000 Ft felett a 12 % különbözeti bírság kockázata. A motor csak negyedéves előleget számol.
9. **Nincs a nyugdíjas anyák szochója** 34 356 720 Ft felett (Szocho tv. 5. § (1a)). Átalánynál elérhetetlen, elég egy védő ellenőrzés.
10. A **46. § (9) 10 000 Ft-os előleg-küszöböt** nem modellezi (az előleg 0-tól fizetendőként jelenik meg). Ez kisebb dolog, csak halasztás.
11. A magyarázat (`explanation.ts`) nem tud kedvezmény-sort, az ügyfélszöveg nem mutatja a kedvezmény hatását („a családi kedvezményed miatt X Ft-tal kevesebb”).
12. **Nincs teszt:** a NAV 100 csjk-táblája és a NAV 73 példái nincsenek tesztben.

**1. és 4. funkcióhoz:**
13. **Nincs számlánkénti határadó / „félretenni” API.** Ma ehhez két `calculateYear` hívás különbségét kellene a backendben összerakni.
14. **Nincs év végi adó-előrejelzés:** csak a `asOf`-ig elkezdett negyedéveket adja vissza, a jövőbeli negyedéveket nem. A lineáris előrejelzés csak a mérőkben (bevétel) van, adóra nem.
15. **Nincs havi nettó jövedelem** („Mennyit kerestem?”): az SZJA negyedéves (nincs havi bontás), a HIPA éves, és a `MonthLine`-ban nincs SZJA.
16. HIPA: csak a sávos módszer van. Az általános (`altalanos`) módszer `null`, és a sávhatár-ugrások (12 M / 18 M / 25 M) nincsenek határadóként kezelve.
17. Egy jogállás egész évre (mellékállás→fő váltás nincs dátumozva). Ez a félretenni-szabályt is torzítja, ha a 36 órás munkaviszony év közben megszűnik.

---

## 9. Javasolt motorbővítés (vázlat a 3. funkcióhoz)

```ts
// TaxProfileInput (additív, minden mező opcionális; a régi `allowances` megmarad, csak warning)
person?: { birthDate?: ISODate; female?: boolean };
kedvezmenyek?: {
  anya30?: { months: number[] };                       // 1..12, ahol a családi kedvezményre jogosult saját gyermek/magzat után
  anyak?: { jogcim: 'ketgyermekes' | 'haromgyermekes' | 'negyplusz'; fromMonth: number; toMonth: number };
  fiatal25?: true;                                      // a hónapokat a birthDate-ből számoljuk
  szemelyi?: { months: number[] };
  elsoHazasok?: { marriedOn: ISODate; bothUnder25?: boolean; sharePct: number };   // a pár keretéből az EV-re eső %
  csaladi?: { months: { month: number; eltartott: number; kedvezmenyezett: number; tartosBeteg: number; felvaltva: number }[];
              sharePct: number;                         // közös érvényesítésnél az EV-re eső rész
              jarulekkedvezmenyEvkozben: boolean };
  approvedBy?: 'konyvelo';                              // csak a jóváhagyott kedvezmény számít a számokban
};
```

Algoritmus negyedévenként (q), YTD:
1. `taxableYTD` mint ma (adómentes rész le).
2. Anyai mentes rész = a jogosultsági hónapok átalányjövedelméből az adóköteles rész (kronologikus adómentes-fogyasztás) → `exemptYTD`.
3. A 25 év alatti keret = min(jogosult hónapok adóköteles jövedelme, hónapok × 715 765).
4. Személyi + első házasok + családi keret YTD (hónapok × összeg × share) → SZJA-alap csökkentése a 29/H sorrendjében.
5. `szjaCum = 15 % × max(0, taxableYTD − kedvezmények)`, előleg = szjaCum − korábbi előlegek (≥ 0).
6. Csjk havonta (80. § (2)): 15 % × max(0, havi családi keret − havi SZJA-alap), plafon = 18,5 % × (göngyölített alap; minimumon min(minimum, havi jövedelem); jövedelem nélküli minimum-hónapban 0); a csjk-val elhasznált keret csökkenti a további SZJA-keretet (/0,15).
7. Új magyarázatsorok (`kind: 'sor'`): „Családi kedvezmény (2 gyermek)”, „Anyák kedvezménye – nem kell SZJA”, „Családi járulékkedvezmény (TB-ből)”. Az ügyfél-figyelmeztetés csak akkor jelenjen meg, ha van nem jóváhagyott kedvezmény.
8. Tesztek: a NAV 100 csjk-táblája (2 459 600 éves alap), a 6. pont példái, a 2 gyermekes anyák 1985-12-31 / 1986-01-01 határa, a 30 év alatti 1995/1996 határa, a 25. születésnap hónapja, első házasok +24 hónap és a 25 év alattiak csúsztatása, felváltva gondozás 50 %, tartósan beteg +133 340.

---

## 10. Tervezési jegyzet az 1. funkcióhoz – „Ennyit tegyél félre”

### 10.1 Egy forint plusz bevétel határadója 2026-ban (kedvezmény nélkül)

Jövedelemhányad s = 100 % − költséghányad: 45 % → 0,55; 80 % → 0,20; 90 % → 0,10.
Kulcsok: SZJA 15 %, TB 18,5 %, szocho 13 % (együtt 46,5 %; járulék+szocho 31,5 %).

| Zóna (az év eleje óta összesített helyzet) | Főfoglalkozású | Mellékállású | Nyugdíjas |
|---|---|---|---|
| **A** – az átalányjövedelem ≤ 1 936 800 Ft (adómentes rész) | **0 %** (de a havi fix minimum jár: 101 682 Ft/hó, garantáltnál 117 558 Ft/hó) | **0 %** | **0 %** |
| **B** – az adómentes rész felett, de a negyedév göngyölített alapja még a minimum alatt | csak SZJA: 15 % × s → **8,25 % / 3 % / 1,5 %** | – | – |
| **C** – az adómentes rész felett, és a göngyölített alap a minimum felett (mellékállásnál nincs minimum) | 46,5 % × s → **25,575 % / 9,3 % / 4,65 %** | **25,575 % / 9,3 % / 4,65 %** | SZJA: **8,25 % / 3 % / 1,5 %** |

Egy **120 000 Ft-os számla** a motor szerint (decemberi számla, egyenletes év mellett, `marg.mjs` futtatás):

| | 45 % | 80 % | 90 % |
|---|---|---|---|
| fő, A zóna | 0 | 0 | 0 |
| fő, B zóna | 9 900 (→ kb. 10 000) | 3 600 (→ kb. 4 000) | 1 800 (→ kb. 2 000) |
| fő / mellék, C zóna | 30 690 = 9 900 SZJA + 12 210 TB + 8 580 szocho (→ kb. 31 000) | 11 160 (→ kb. 12 000) | 5 580 (→ kb. 6 000) |
| nyugdíjas az adómentes rész felett | 9 900 (→ kb. 10 000) | 3 600 | 1 800 |

A tulaj példájában szereplő „kb. 22 000 Ft” (18,3 %) egyik zónának sem felel meg, csak illusztráció volt. A valós értékek 0, kb. 10 000 vagy kb. 31 000 Ft (45 %).

### 10.2 Küszöbök éves bevételben (egész éves működés, egyenletes bevétel)

| | 45 % | 80 % | 90 % |
|---|---|---|---|
| adómentes rész elfogy (jövedelem 1 936 800) | 3 521 455 Ft | 9 684 000 Ft | 19 368 000 Ft |
| fő: a járulék a minimum fölé megy, minimálbérnél (jövedelem 1 936 800 + 12 × 322 800 = 5 810 400) | 10 564 364 Ft | 29 052 000 Ft | 58 104 000 Ft |
| ugyanez garantált bérminimumnál (jövedelem 6 415 200) | 11 664 000 Ft | 32 076 000 Ft | 64 152 000 Ft |

A motor egész éves fix összege főfoglalkozásúnál: 12 × 101 682 = **1 220 184 Ft** (minimálbér).

### 10.3 Az ok, amiért nem lehet egy fix % – a negyedéves göngyölítés
Tbj. 40. § (2): a negyedév alapja = az év eleje óta számolt adóköteles jövedelem **mínusz a korábbi negyedévekben ténylegesen figyelembe vett alapok** (a minimumot is beleértve; ezt a NAV 100 példája is mutatja: 83 460 = (1 813 200 − 677 880 − 968 400) / 2). Ezért ha a bevétel az év elejére sűrűsödik, az első negyedév a minimum fölé megy, a későbbiek mégis minimumot fizetnek.
Motoros példa (fő, 45 %, 8 976 000 Ft bevétel, 3 000 000 Ft adóköteles):
- egy összegben februárban: **2 310 138 Ft** (TB 1 092 462, szocho 767 676, SZJA 450 000)
- negyedévente egyenlően: **1 670 184 Ft** (TB 716 616, szocho 503 568, SZJA 450 000)
- **különbség: 639 954 Ft** ugyanarra az éves bevételre.
Ugyanígy: az adómentes rész felett az SZJA határadója ugrásszerűen 0-ról 15 % × s-re vált. A HIPA sávos, lépcsős (2 %-nál +70 000 Ft 12 M-nál és +50 000 Ft 18 M-nál, 25 M felett a sávos módszer megszűnik). A 20 M Ft alanyi ÁFA-határ felett ÁFA-kötelezettség jön. Ez utóbbi kettő nem forintonkénti határadó, hanem lépcső, ezért külön kezelendő.

### 10.4 Javasolt szabály (amit a könyvelő vállalhat)
**„A számla miatti többletadó” = L(az év összes bevétele ezzel a számlával) − L(nélküle)**, ahol L = a motor egész évi SZJA + TB + szocho összege (Q1–Q4, a még hátralévő hónapok bevétel nélkül, azaz minimummal). Felfelé kerekítve a következő ezer forintra, „kb.” előtaggal.
- **Pontos és teleszkópos:** ha a számlákat beérkezési sorrendben vesszük, a számlánkénti tételek + L(üres év) (a fix minimum) összege **pontosan** az éves fizetendő, így év végére sem marad alul tartalék. Az ezresre kerekítés miatt kicsit felülbecsül (konzervatív).
- Magától kezeli az adómentes részt, a minimumot, a negyedéves göngyölítést (az év eleji sűrítés drágább), a jogállást (fő, mellék, nyugdíjas) és a költséghányadot. Később, ha a motor kezeli őket, a **jóváhagyott** kedvezményeket is (anyák → az SZJA-rész 0; családi → az SZJA-rész csökken, a csjk a TB-t is).
- A **fix havi minimum** (fő: 101 682 Ft/hó, garantáltnál 117 558 Ft/hó) **nem számlához kötött**, külön sorban mutatjuk a kezdőképernyőn („Havi fix járulék – bevételtől függetlenül”).
- A HIPA-t nem számlánként adjuk, hanem az éves sávbecslésből külön sorban („Iparűzési adó: évente kb. X Ft”). Sávhatár átlépésekor értesítés.
- A számla dátuma: a motor a pénz beérkezésének napját nézi (pénzforgalmi). Kiállított számlánál a fizetési határidő a becsült beérkezés (`estimated: true`). A decemberben kiállított, januárban fizetett számla a következő év adómentes részébe eshet.
- **Konzervatív tartalék a bizonytalanságra:** ha a számla beérkezése a következő negyedévre/évre csúszhat, a két lehetőség közül a nagyobb többletet mutassuk.

Kezdőképernyő („idén eddig”):
- **Félretenni javasolt** = Σ számlánkénti többletadó (év eleje óta) + fix minimum × eltelt hónapok (fő) + HIPA időarányos becslés.
- **Ebből már fizetendő** = a lezárt negyedévek (jóváhagyott) összegei + a futó negyedév becslése.
- **Még félreteendő** = a kettő különbsége (ha negatív: „eddig minden megvan”).

### 10.5 Szövegjavaslatok (tegező, rövid; nem „a NAV-tól jött számla”)
- A zóna: „Új kiállított számlád: 120 000 Ft. Ez még az adómentes részbe esik, utána nem kell külön félretenned.” (Főfoglalkozásúnál mellé: „A havi fix járulékot ettől függetlenül fizeted.”)
- B zóna: „120 000 Ft-os számla – ebből kb. 10 000 Ft-ot tegyél félre (SZJA).”
- C zóna: „120 000 Ft-os számla – ebből kb. 31 000 Ft-ot tegyél félre (SZJA, TB-járulék, szocho).”
- Küszöbátlépés: „Ezzel a számlával elfogyott az adómentes részed. Innentől minden számlánál félre kell tenned.”
- Egy mondatos magyarázat (info gomb): „Annyit mutatunk, amennyivel ez a számla növeli az idei adódat. Az év elején kevesebb, később több lehet, mert az első 1 936 800 Ft jövedelmed adómentes, a járulékból pedig havonta egy minimumot mindenképp fizetsz.”

---

*Megjegyzés:* a 29/A. § (2) összegei, a 715 765 Ft, a 107 600 Ft és a 34 356 720 Ft a NAV 73 (2026.03.19.) és a NAV 100 (2026.02.20.) füzetből, illetve az njt.hu 2026.10.01-i hatályos szövegéből egyeznek. A 2026. év közben (2026.10.01-ig) ezekben nem találtam módosítást.
