# Kérdések Dávidnak – összefésült lista (2026-11-21)

**Mire szól:** minden nyitott szakmai kérdés egy helyen, duplikáció nélkül. Ez váltja a `DAVID_KERDESEK.md` 4 kérdését, a
`KONYVELO_LEFEDETTSEG.md` 13 új kérdését (együtt a „régi 17”), az éves terv D1–D33-át, a kritika K1–K11-ét, a felügyeleti
terv D1–D7-ét és az ellenőrök 11-21-i új pontjait. A régi jelölés minden kérdés végén ott van zárójelben.

**Hogyan válaszolj:** elég az „igen” / „nem” és egy rövid mondat. Ahol „igen” a válasz, az app úgy marad, ahogy most van.
Az **első 10 sürgős** (decemberi határidő vagy élesítés előtt kell).

---

## A 10 legsürgősebb

**1. A 2027-es kata (T/928) – te döntöd el ügyfelenként, és te rögzíted?**
- Kérdés: decemberben minden katás és átalányos ügyféllel megbeszéled a 2027-es módot (átalány / régi kata / új kata), és
  te rögzíted a panel „2027. évi adózási mód” kártyáján (bejelentés napja, ki adta be)?
- Megerősíted, hogy a **régi katában maradáshoz nem kell bejelentés**? A T/928/9 szerint a Kata tv. új 15/A. § (2) bekezdése:
  2027-től az maradhat, aki 2026. december 31-én katás volt, és azóta nem szűnt meg. **Új belépés a régi katába 2026.
  november 30. után hatálytalan** (15/A. § (1)) – vagyis aki még a régi katába akar lépni, annak **november 30-ig** kell
  bejelentenie. Az új kata választása 2026. december 1-jétől jelenthető be, és 2027. január 1-jén indul (16. § (1)).
- Miért kell: a januári kata február 12-én esedékes; ha nincs rögzített mód, január 1-jén az idei mód folytatódik.
- Most az appban: a kártya csak rögzít, **nem javasol** módot. Az új kata adatként rögzíthető, de a kapcsolója (`kata2027`)
  KI, ezért 2027-ben a kata-hónapok összeg nélkül állnak, emlékeztető nem megy, te feladatot kapsz.
  (ÉV-D24, K5)

**2. A 2027-es régi kata havi összegét te erősíted meg?**
- Kérdés: a törvény kihirdetése után te mondod meg a végleges összeget (a javaslat szerint 75 000 Ft, T/928/9 29. § a);
  ha nem fogadják el, marad 50 000 Ft), és addig az app nem mutat összeget?
- Miért kell: a januári tétel összege ettől függ.
- Most az appban: összeg nélkül; a tulaj egy kapcsolóval (`kata2027Osszeg`) kódmódosítás nélkül beállíthatja.
  (ÉV-D24, kód APRÓ 1)

**3. Mentes kata-hónapok: te jelented be 12-éig, és felvegyük az örökbefogadói díjat és a GYOD-ot?**
- Kérdés: a mentes hónapot (táppénz, CSED, GYED, GYES, GYET, ápolási díj stb.) csak te rögzíted, és te jelented be a NAV-nak
  a következő hónap 12-éig (T101E? melyik blokk)? Az örökbefogadói díj és a gyermekek otthongondozási díja (Kata tv. 7. § (8)
  a)) is mentes ok?
- Miért kell: bejelentés nélkül a hónap fizetendő marad; az ügyfél 50 000 Ft-ot fizethet feleslegesen.
- Most az appban: csak a könyvelő rögzít; a két új ok választható, „(még egyeztetjük)” jelöléssel; a 12-e előtt 3 nappal
  feladatot kapsz. (ÉV-D20, ÉV-D21, K9)

**4. A 30 napos záróhónap: ha a záróhónapban bevétel érkezett, fizetendő a hónap?**
- Kérdés: a Kata tv. 7. § (9) szerinti záróhónapot (az állapot legalább 30 napig tartott) akkor is mentesnek vesszük, ha a
  hónapban – az állapot vége után – bevétel érkezett?
- Miért kell: az ellenőr szerint a (9) bekezdésben nincs bevételi kivétel; most az app ilyenkor fizetendőnek veszi
  (50 000 Ft túlfizetés lehet, és a bejelentés elmarad). Ritkább eset: ha a 30 napba egy bevétel miatt nem mentes hónap is
  beleesik, azt az app kihagyja a számolásból.
- Most az appban: óvatos – fizetendő, bejelentési feladat nincs. (ellenőr 11-21: közepes 2 és alacsony 13)

**5. Az app előtti kata-hónapokat december 10-ig ellenőrzöd a folyószámlán, és „Rendben” csak kivonatsor alapján?**
- Kérdés: a január–októberi (az app indulása előtti) hónapokat december 10-ig átnézed a NAV-folyószámlán; „Rendben”-re csak
  akkor jelölöd, ha a befizetés sorát (dátum, összeg) látod a kivonaton – nem az egyenleg alapján?
- Miért kell: a 100 000 Ft-os év végi szabály előtt ki kell derülnie, ha valami nincs befizetve.
- Most az appban: ezeket az ügyfél nem látja, amíg te nem jelölöd; a csoportos „Rendben” kötelezően kéri a kivonat sorát;
  a határidőd december 10. (kritika 2.4, K11)

**6. Év végi 100 000 Ft-os szabály: elég a december 10-i és 22-i ellenőrzés, és az ügyfél december 16-án szól?**
- Kérdés: minden katásnál december 10-én és 22-én ellenőrzöd a végrehajtható nettó tartozást (Kata tv. 5. § (1) e)), és az
  ügyfél december 16-án csak akkor kap levelet, ha van jelöletlen, lejárt kata-tétele?
- Miért kell: 100 000 Ft feletti tartozásnál megszűnik a kata.
- Most az appban: pontosan így; a levél azt is megírja, hogy a határozat véglegessé válásáig befizetve a NAV visszavonja.
  (kritika 2.3)

**7. A NAV-folyószámla egyeztetése: ezt a rendet és ezeket az adónemeket fogadod el?**
- Kérdés: ellenőrzés a negyedéves határidő után 7 munkanappal, május 20. után, katásnál havonta a 12-e után 5 munkanappal és
  december 15-én; visszajárónál a várt dátum után; adónemek: 103, 406, 258, 288, 138, 215, 224 (bírság), 226 (mulasztási
  bírság) + egyéb. A meghatalmazásod kiterjed az adószámla megtekintésére (UJEGYKE D/1 vagy E/7)?
- Miért kell: ebből jönnek a könyvelői feladatok és a „rendben / eltérés” jelölések.
- Most az appban: pontosan így, munkanapra tolva; semmi nincs alapból bejelölve. (ÉV-D14, ÉV-D15, ÉV-D16, K8, FE-D6, régi 7)

**8. A közleménybe az adószám kerüljön (nem az adóazonosító jel)?**
- Kérdés: minden NAV-utalás (kata, szja-különbözet, önellenőrzés) közleménye az ügyfél adószáma?
- Miért kell: a fizetési lap ezt másoltatja az ügyféllel; a november havi katát december 14-ig utalják.
- Most az appban: adószám. (ÉV-D22)

**9. Kata-keret: 80 %-nál és túllépésnél szólunk, az év végi előrejelzést csak te látod?**
- Kérdés: a keret-figyelmeztetés 80 %-nál és 100 % fölött megy ki az ügyfélnek; az előrejelzést (pl. „év végére túlléphet”)
  csak a panel mutatja?
- Miért kell: év elején az előrejelzés félrevezető lehet.
- Most az appban: így; kapcsolóval (`kataElorejelzesUgyfelnek`) az ügyfélnek is bekapcsolható. (ÉV-D28)

**10. Év közbeni kata-megszűnés: te rögzíted, és mi jön utána?**
- Kérdés: ha a kata megszűnik (kifizetőtől kapott bevétel, főfoglalkozás elvesztése, nyugdíj), te jelented be 15 napon belül,
  te állítod át az appban (Adózási mód → a kata utolsó napja), és a nyilatkozat + különadó határideje a megszűnéstől 30 nap,
  munkanapra tolva? Utána átalány jön, vagy vállalkozói szja (amit az app nem kezel)? 2027-től ajánlod-e helyette az új
  katát (T/928/9 15. § (2): kifizetői bevétel miatti megszűnés után 15 napon belül választható)?
- Miért kell: amíg nincs rögzítve, az app tovább kéri a havi katát, és a keretet is mutatja.
- Most az appban: cégnek számlázásnál piros figyelmeztetés; a megszűnést te állítod át; a külön „Kata megszűnése” művelet
  (ok, bejelentési feladat, a jövőbeli tételek érvénytelenítése) még nem készült el. (K3, K4, ÉV-D25, ÉV-D23)

---

## Éves szja-bevallás (átalány)

11. **A tervezetet te készíted és adod be, és a végleges számokat te írod be az appba?** Miért: az ügyfél ezeket hagyja jóvá.
    Most: igen, a motor csak becsül; ha eltérsz, rövid indokot kér. (ÉV-D1)
12. **Az ügyfél-jóváhagyás határideje május 10. (katánál február 18.)?** Most: így, 7/3/1 nappal előtte e-mail is megy. (ÉV-D2)
13. **A TB és a szocho csak a 2658-ban rendeződik, az éves bevallásban nincs különbözetük – így írjuk ki?** Most: így
    („Ezeket negyedévente fizetted…”). (ÉV-D3)
14. **Mellékállású és nyugdíjas ügyfélnél mi legyen a „Járulékok” blokk pontos szövege (jogszabályhellyel)?** Most: semleges
    szöveg, a nulla blokk kimarad. (K2)
15. **A csjk éves elszámolását összegként te írod be; a 12 %-os különbözeti bírság melyik adónemre és számlára megy?** Most:
    a különbözetben marad, külön tétel nincs (`csjkBirsagTetel` KI). (ÉV-D4, K8)
16. **Visszajárónál mindig kiutalást kérsz (nem átvezetést)?** Most: kiutalás az alapértelmezés. (ÉV-D5)
17. **A kedvezményeket negyedévente, az előlegben érvényesíted? Az utólag jóváhagyott családi járulékkedvezmény lezárt
    negyedévekre eső része „az éves bevallásban” jön vissza?** Most: így írjuk; a panel „Hatás” blokkja a válasz után javul.
    (ÉV-D6, régi 2)
18. **Alulfizetett negyedéves előlegre az app ne számoljon késedelmi pótlékot, csak jelezze?** Most: nem számol. (ÉV-D7)
19. **Év közben kezdő (nem áttérő) EV-nél is a teljes 1 936 800 Ft adómentes rész jár?** Most: a teljes összeg. (ÉV-D8)
20. **Részletfizetést az app ne ajánljon; ha kell, te intézed?** Most: nem ajánl (`reszletfizetesSzoveg` KI). (ÉV-D9)
21. **Ki számolja és ellenőrzi az éves különbözetet (szja, HIPA), és legyen-e fizetési tétel az appban?** Most: te írod be,
    beadás után fizetési tétel lesz (szja: május 20., NAV 103). (régi 6)

## Önellenőrzés

22. **Nyomtatványok: 26SZJA, 2658, 26HIPAK önellenőrzés jelleggel, '26KATA – jók?** (ÉV-D10)
23. **Lezárt negyedév különbözete: te döntesz, hogy átvitel a következő negyedévbe vagy önellenőrzés; az 1 000 Ft-os küszöb
    adónként értendő?** Most: adónként tiltjuk az 1 000 Ft alatti sort (Art. 56. § (3)). (ÉV-D11, ellenőr A7)
24. **Pótlék: kamat/365, 3 tizedesre csonkítva, ismételtnél ×1,5, a napok az esedékességet követő naptól a beadás napjáig;
    forintra kerekítünk (a szochót is), az 5 000 Ft-os plafont az egész javításra vesszük – egyezik a NAV-kalkulátorral?**
    Most: így; a beadáskor a tényleges napra újraszámoljuk. Kérdés: adónemenként kell-e a plafon? (ÉV-D12, ellenőr A8, A10)
25. **Az ügyfél jóváhagyását a javára szóló önellenőrzésnél is kérjük; telefonos egyeztetés rögzítve elég?** Most: igen, a
    telefonos utat rögzíteni kell. (ÉV-D13)
26. **Mikor alkalmazod az Art. 211. § (3) a) pótlékmentességet, és hogyan kezeled a 212. § (5) göngyölített (ÁFA) javítást?**
    Most: jelölő; a göngyölítettnél a pótlékot kézzel adod meg. (K6)
27. **A HIPA-önellenőrzés pótléka és különbözete melyik önkormányzati számlára megy (településenként te adod meg)?** Most: a
    különbözet az önkormányzat számlájára; pótléktételt az app nem tesz, és nem is kér rá jóváhagyást. (K7)

## Iparűzési adó (HIPA)

28. **Alapértelmezés a sávos módszer; a kulcsot és a számlaszámot te adod meg településenként; kell-e külön önkormányzati
    meghatalmazás?** (ÉV-D29, régi 15)
29. **Sávosnál az első évben nincs előleg (Htv. 41. § (4) b))?** Most: nincs. (ÉV-D30, régi 14)
30. **Katásnál is sávos a HIPA (Htv. 39/A., 52. § 22. h)); van-e még katás tételes HIPA 2026-ban?** (ÉV-D31, régi 13)
31. **A HIPA-különbözethez nem kérünk külön ügyfél-jóváhagyást?** Most: az szja-/kata-összesítővel együtt látja. (ÉV-D32)
32. **Ha az adó nem több az előlegnél és nincs bevallás, a következő évi előleg alapja a befizetett előleg (Htv. 39/A. §
    (8)–(9))?** Most: így írjuk a következő évbe; több adónál a bevallás kötelező (a panel nem engedi „bevallás nélkül”).
    (ellenőr K5)

## Kata – egyéb

33. **A '26KATA nyilatkozat minden katásnak kötelező, február 25-ig?** Most: minden katásnak kiírjuk. (ÉV-D19, régi 12)
34. **Elég a katás kérdőív február 5-i határideje?** (ÉV-D26)
35. **Vegyes év (átalány ↔ kata év közben): az első változatban kézzel számolod a negyedéveket?** Most: panel-jelzés,
    kézi számolás. (ÉV-D27)
36. **A bevételnél kell-e kifizető-adat (név, adószám) az új kata miatt?** Most: nincs ilyen mező. (K5)

## Átalány – általános (a korábbi kérdésekből)

37. **Félretenni-szabály: a számla miatti adónövekedés, ezresre felfelé – vállalod így?** (régi 1)
38. **A várandósság 91. napja, a költséghányad tevékenységváltásnál, a HIPA költözésnél – jól kezeljük?** (régi 3)
39. **Négy szem: a változás lezárását ne az jelölje, aki beküldte; kell-e második ellenőr a negyedéves jóváhagyáshoz vagy
    a beadáshoz?** (régi 4, régi 5)
40. **A 35 tevékenység ÖVTJ-kódja; a „Fotózás” valóban a 80 %-os listán van; a 80 % csak kizárólag listás tevékenységnél
    jár?** (régi 8)
41. **A nappali tagozatos tanuló főfoglalkozásúként számol?** (régi 9)
42. **Devizás számlánál a számlán szereplő árfolyam a jó?** (régi 10)
43. **Közösségi adószámos, alanyi mentes ügyfélnél melyik nyomtatvány kell (65-ös, A60), és mit vállalunk ebből?** (régi 11)
44. **A 2658 M-lapjához kell TAJ és születési adat, vagy az ONYA előtölti?** (régi 16)
45. **A 2026-os szabályértékek (költséghányad 45 %, szocho-minimum, adómentes rész, keretek, nyomtatványok, a kétgyermekes
    anyák évhatára) rendben?** (régi 17)
46. **Év közbeni EV-megszűnésnél (átalány) melyik bevallást, milyen határidővel adod be, és jár-e rá az éves zárás díja?**
    Most: a megszűnt ügyfél éves zárása kapcsolóval kézzel nyitható (alapból KI). (K1)
47. **A kamarai hozzájárulás és a NAV-levelek válaszhatárideje bekerüljön az idővonalba (forrással)?** (K10)
48. **Túlfizetésnél az átvezetést/kiutalást csak az ügyfél kérésére adod be?** (ÉV-D17)
49. **Később regisztrálnál NAV M2M-felhasználóként (adószámla-lekérdezés)?** (ÉV-D18)
50. **A 2027-es munkarend-rendelet szombati munkanapjánál a korábbi dátumot mutatjuk?** Most: igen (a 2026-12-12 már nem
    munkanap, a novemberi kata határideje 12-14). (ÉV-D33)

## Felügyelet (riasztások)

51. **Hibás NAV-letöltésnél hány nappal a határidő előtt kell beavatkozni?** (FE-D1)
52. **Kimaradt befizetési emlékeztetőt pótoljunk késve automatikusan, és ki szól az ügyfélnek?** (FE-D2)
53. **Hibás NAV-kapcsolatnál az ügyfél is kapjon jelzést?** (FE-D3)
54. **Látszódjon a szintetikus tesztügyfél a panelen (rejtve, kapcsolóval)?** (FE-D4)
55. **Kérsz te is riasztást, és milyen csatornán?** (FE-D5)
56. **A díjszámla kiállításának határideje a fizetés után (Áfa tv.)?** (FE-D7)

---

**Ügyvédnek, nem Dávidnak:** beküldheti-e Dávid meghatalmazottként a változásbejelentést (`kod/jogi/UGYVED_KERDESEK_k5.md`);
az ÁSZF javítása az éves zárás 14 999 Ft-os díja előtt, és a katás csomag a T/928 miatt (T1, T-K5).

**Forrás a T/928-hoz:** T/928/9 egységes javaslat (2026-11-20), https://www.parlament.hu/irom43/00928/00928-0009.pdf – 14. §
(hatálybalépés 2026-12-01), 15. § (átmenet), 16. § (1) (választás 2026-12-01-től, hatály 2027-01-01), 28. § (Kata tv. 15/A. §),
29. § (75 000 / 100 000 Ft). **Még nincs kihirdetve.**
