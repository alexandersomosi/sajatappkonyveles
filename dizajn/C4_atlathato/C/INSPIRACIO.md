# C = a javított B: honnan jött az ötlet (2026-11-19 este)

Kiindulás: B (a tulaj választása, a lapos, 5 fülű alsó sávval együtt). C nem cseréli le B-t, csak tisztítja és
kisebbre veszi („Nem túl nagyok amúgy a dolgok?”). Képek: `fooldal.png`, `fooldal_teljes.png`, `urlap.png`, hunyorítás: `_hunyoritas.png`.

## Lépték (B → C)
Képernyőcím 31 → **26**, szakaszcím 20 kék → **18 sötét**, szöveg 17 → **16**, másodlagos 16 → **15** (7:1),
„2 / 12” 28 → **18 a csík mellett**, 3D ikon 36 → **28** (a sávban 30), fő gomb 56 → **52**, fülsor 56 → 52,
szakasz-térköz 22 → **16** (ritmus 4/8/12/16/24). Érintési felület mindenhol ≥ 44 pt. A főoldal görgetés nélkül elfér,
a gomb fölött kb. 45 px levegő marad.

## Mit honnan vettünk, és hogyan
| Forrás | Mit tanultunk | Hol van C-ben |
|---|---|---|
| Kontist, Accountable (store-képek) – https://play.google.com/store/apps/details?id=com.kontist, https://apps.apple.com/be/app/accountable-self-employed/id1384729810 | Felül egy színes blokk, benne csak a legfontosabb, a többi lent, csukva | Visszajött a kék sáv (#1428DB + rozetta): ki a könyvelőd → hol tartasz → mi a dolgod most |
| Shopify Setup guide – https://shopify.dev/docs/api/app-home/patterns/compositions/setup-guide | Egyszerre egy lépés van nyitva, a többi egy csukott sor; a haladás sima szöveg | A „most” a sávban nyitva; „Utána jön”: a következő lépés + „Még 8 lépés · Mutasd” |
| GOV.UK Task list – https://design-system.service.gov.uk/components/task-list/ | Sorrendhez kötött lépéseknél ne legyen szabad sorrendű lista; sorban cím + egy rövid sor | Csak a most + a következő látszik; a sorok ugyanúgy épülnek fel (cím, egy szürke sor, jobbra legfeljebb egy kapszula) |
| GOV.UK Question pages – https://design-system.service.gov.uk/patterns/question-pages/ | Egy kérdés oldalanként; a cím maga a felirat; a szakasz neve kis felirat; „X. kérdés az Y-ból” | Űrlap: nincs külön „Adószám” felirat; „1. kérdés a 3-ból” a 3 részes csík helyett (az ütközött a 12-essel) |
| NN/g Progressive disclosure – https://www.nngroup.com/articles/progressive-disclosure/ | Az első szinten csak a gyakori dolog; a rejtett tartalomhoz beszédes címke | A csupasz „i” kikerült a főoldalról: helyette egy sor ok („Hogy Bence intézhesse helyetted”); a többi lépés egy koppintásra |
| NN/g Visual hierarchy – https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ | Legfeljebb 3 betűméret; az élénk szín csak a legfontosabbé; hunyorítás-próba | Kék = sáv, fő gomb, link, aktív fül; a szakaszcímek sötétek. Elmosva (blur 6) a sáv és a fő gomb a két erős folt |
| NN/g F-minta – https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ | A bal szél és a sorok első szavai kapják a figyelmet | Egy bal oldali ikonoszlop, minden cím és szöveg ugyanazon a vonalon (54 px) kezdődik; a sorok főnévvel indulnak |
| NN/g Wizards + Progress indicators – https://www.nngroup.com/articles/wizards/, https://www.nngroup.com/articles/progress-indicators/ | Egy haladás-jelzés elég; a gomb neve a következő tett | „2 / 12 lépés kész” + csík egy sorban (a 3. szegmens halvány: itt tartasz); gomb: „Elolvasom a szerződést”, „Igen, ez az enyém” |
| NN/g Mobile onboarding – https://www.nngroup.com/articles/mobile-app-onboarding/ | Nincs bemutató előre; minden kérdésnél egy sor „miért”; legyen „később” | A videó csak link (1:47), nem kötelező; „Ebből kikeressük…” a kérdés alatt; „Most nem tudom” |
| Baymard Inline validation – https://baymard.com/blog/inline-form-validation | Ne jelezz hibát gépelés előtt; fix hosszúnál a végén ellenőrizz; a jó választ is jelezd | A 11. számjegy után ibolya 3D pipa a mezőben, alatta a megtalált cég |
| Billingo (magyar minta) – https://app.billingo.hu/demo, https://support.billingo.hu/content/1758920705 | Nyugodt, sűrű lépték; köznyelvi szavak; „Tovább”-os lépések, a cég kikeresése a névből/számból | Ez a léptékminta (a tulaj kérése); az adószámból kikeresett cég megerősítése |
| RLB / WebTax – https://docs.rlb.hu/manualpdfpage/1/partnerkoveto-szolgaltatas-hasznalata | A magyar programok már az első 8 számjegyből (törzsszám) kikeresik a céget | Viselkedési szabály a fejlesztésnek: a keresés a 8. számjegynél indul, a pipa a 11.-nél jön |
| Monzo Tax Pot – https://monzo.com/business-banking/features/tax-pots | Egy beállítás egy sor: bal oldalt címke + egy segédsor, jobbra egyetlen vezérlő | „Ha elakadsz” fejléce: cím balra, „Visszahívás” kapszula jobbra |

## Lépésszám (egyezik mindenhol)
2 kész + 1 most (Szerződés, kb. 3 perc) + 1 következő (Meghatalmazás a NAV-nál, kb. 5 perc) + 8 többi = **12**.
A csapat munkája (melyik tevékenységet jelöld be, kb. 1 munkanap) párhuzamos, nem számít bele a 12-be.

## Döntésre vár (tulaj)
- Az űrlap fő gombja „Tovább” helyett „Igen, ez az enyém”, és a lapon van egy „Nem, ez nem az enyém” is (a kiválasztott A-ban is így volt). Ha marad a „Tovább”, a „Nem…” kapszula kimehet.
- A kék sáv elmosva is erős folt, ugyanúgy, mint a jóváhagyott 03-as főoldalon. Ha csak a fő gomb legyen erős, a sávba elég Bence sora és a haladás, a „Jöhet a szerződés” pedig mehet a fehér részre.
