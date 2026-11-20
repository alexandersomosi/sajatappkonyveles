# Levél- és értesítésszövegek: mi érthető kívülről (Gemini-átnézés, 2026-11-20)

**Források:** `_szoveg/szovegek.json` (a backend `email.*` és `notif.*` szövegei, a `content.ts` DEFAULT_TEXTS kigyűjtése), `LEVEL_LEFEDETTSEG.md` 3. pont (javasolt új levelek, `javasolt_NN`), `0N_*.html` (mintalevelek, `minta_*`). A Gemini kifogásai: `_szoveg/_osszes.json` → `gondok`. Minden kifogást bíráló nézett át a kód alapján (`kod/backend/src/notify/notify.ts` + a hívó helyek).

**Fontos:** a Gemini a „kinek” mezőt egy hibás kulcsszavas becslésből kapta, ezért sok könyvelőnek, munkatársnak vagy adminnak szóló szöveget ügyfélszövegnek hitt. A valódi címzettet a bírálók a kódból állapították meg.

A kódhoz nem nyúltunk, mert más építés fut rajta. A javításokat a szövegek forrásában kell átvezetni (`kod/backend/src/_shared/*.ts`, `content/*.ts`), nem a json-ban.

---

## 1. Számok

| | db |
|---|---|
| Gemini-kifogás összesen | **121** (Gemini szerint 78 „fontos”, 43 „apró”) |
| jogos | **14** |
| részben jogos | **40** |
| nem jogos | **67** |
| **javítandó tétel (jogos + részben)** | **54**, ebből 17 fontos |

A 67 nem jogos kifogás oka (kb.):

- 44 téves címzett-becslés: könyvelőnek, munkatársnak vagy adminnak szóló szöveget ügyfélszemmel bírált.
- 11 a kigyűjtés mellékterméke: üresnek látszó cím vagy tárgy, dupla gomb, szakaszcím.
- 5 helyőrző-félreolvasás: a `{hatarido}` és a `{from}` már ragozva érkezik.
- 1 régi, már nem küldött fajta.
- 6 esetben a szöveg jó így.

**Szúrópróba:** 25 „régi” szöveget vetettünk össze a `szovegek.json`-nal (köztük a fee_invoice_issued, assist_mh_filed, callback_received, subscription_renewal_needed, a contract_terminated mind a 4 kulcsa, valamint az invoice_new.tobb és az allowance_decided.*). Mind a 25 betűre egyezik. A `javasolt_*` régi szövegei egyeznek a LEVEL_LEFEDETTSEG.md 3. pontjával.

---

## 2. Javítandó szövegek fontossági sorrendben

Jelölések:

- J = jogos, R = részben jogos.
- Cím **félkövér**, alatta a szöveg. A „(marad)” jelentése: a cím nem változik.
- † = az összeállításkor egységesítve, nem szó szerint a bíráló szövege (lásd a 2.4 pontot).

Minden új szöveg ugyanazokat a `{helyőrzőket}` használja, mint a régi. Egyetlen kivétel az allowance_decided.jovahagyva címe: ott a `{firstName}` a hívásban már ott van (accountantParams, kedvezmeny.ts:624), a testvérváltozatok is használják.

### 2.1 Fontos (kiküldve hibás vagy félrevezető, pénzt, határidőt vagy szerződést érint)

| # | kulcs | kinek | | mi a gond | régi | új |
|---|---|---|---|---|---|---|
| 1 | notif.contract_terminated.rendes | ügyfél (push + e-mail, nem kapcsolható ki) | J | A `{datum}` huLongDate („2026. december 31.”), így a kiküldött szöveg „…31.-ig” lesz. Nincs emailBodyKey, ezért az e-mail törzse is ez, és egy levélben „a levélben olvasod” értelmetlen. A „minden marad” homályos. | **Felmondtuk a szerződésedet**<br>{datum}-ig minden marad. A részleteket a levélben olvasod. | **Felmondtuk a szerződésedet** (marad)<br>A szerződésed {datum} napjával megszűnik, addig minden a megszokott módon megy tovább. A felmondó levelet az appban, a Dossziéban találod. † |
| 2 | notif.contract_terminated.ugyfel_kerte | ügyfél (push + e-mail) | J | Ugyanaz a „31.-ig” hiba és az önmagára mutató „levél”. A „minden marad” azonnali megszűnésnél nem is igaz. | **Megszűnik a szerződésed**<br>Ahogy kérted: {datum}-ig minden marad. A részleteket a levélben olvasod. | **Megszűnik a szerződésed** (marad)<br>Ahogy kérted, a szerződésed {datum} napjával megszűnik. A részleteket az appban, a Dossziéban lévő levélben olvasod. † |
| 3 | notif.contract_terminated.azonnali | ügyfél (push + e-mail) | J | Nem derül ki, melyik levélről van szó, e-mailben pedig önmagára mutat. A felmondó PDF a Dossziéban van (link: /dosszie). | **Felmondtuk a szerződésedet**<br>A szerződésed ma megszűnt. A részleteket a levélben olvasod. | **Felmondtuk a szerződésedet** (marad)<br>A szerződésed ma megszűnt. A felmondó levelet az appban, a Dossziéban találod. |
| 4 | notif.contract_terminated (alap, tartalék) | ügyfél | R | Ugyanaz a szöveg és ugyanaz a hiba, mint a rendes változatnál. | **Felmondtuk a szerződésedet**<br>{datum}-ig minden marad. A részleteket a levélben olvasod. | (marad)<br>Ugyanaz, mint az 1. sorban. † |
| 5 | email.contract_terminated.body | ügyfél (ma egyik hívó sem használja) | R | A `content/k29f.ts:66` a rendes törzsből és egy Dosszié-mondatból fűzi össze. Ha a rendes törzs javul, a Dosszié-mondat kétszer szerepelne. Saját tárgya nincs. | {datum}-ig minden marad. A részleteket a levélben olvasod.<br><br>A felmondó levelet az appban, a Dossziéban találod. | A szerződésed {datum} napjával megszűnik, addig minden a megszokott módon megy tovább.<br><br>A felmondó levelet az appban, a Dossziéban találod.<br>(A k29f.ts:66 összefűzést ki kell venni.) |
| 6 | notif.subscription_renewal_needed | ügyfél (push + e-mail) | J | A „kártyaengedély” zsargon. Ugyanez megy ki akkor is, amikor a levonás már meghiúsult (payments.ts:1164, :1225; subscription.ts:760, :767), ilyenkor a „Hamarosan… lejár” félrevezető. | **Hamarosan új kártyaengedély kell**<br>A kártyádra adott engedély lejár. A Fiók oldalon egy kattintással megújíthatod. | **Frissítsd a kártyádat**<br>Hogy a havidíjat továbbra is le tudjuk vonni, add meg újra a kártyádat a Fiók → Előfizetés oldalon. |
| 7 | notif.subscription_renewal_needed.nincs_kartya | ügyfél (push + e-mail) | J | A `{datum}` huDayMonth („november 25.”, payments.ts:1907), így a kiküldött szöveg „november 25.-n jár le”. A bíráló nem jelölte fontosnak, de látható nyelvi hiba megy ki. | **Adj meg kártyát a következő hónaphoz**<br>{datum}-n jár le a kifizetett időszakod. Adj meg kártyát, hogy minden menjen tovább: Fiók → Előfizetés. | **Adj meg kártyát a következő hónaphoz** (marad)<br>Lejár a kifizetett időszakod ({datum}). Adj meg kártyát, hogy minden menjen tovább: Fiók → Előfizetés. |
| 8 | minta_05_hatarido_emlekezteto | ügyfél (mintalevél; a backendben ez a tax_due_soon) | J | A „kb.” és a „becsült összegek” ellentmond a terméknek: emlékeztető csak a könyvelő által jóváhagyott összegre megy (jobs.ts:51, emlekezteto.ts:39). Rossz összeg utalására bátoríthat. | (előnézet: A IV. negyedévre kb. 154 000 Ft-ot kell befizetned.) … nagyjából ennyit kell utalnod: … Összesen (kb.) 154 000 Ft … Ezek becsült összegek a rögzített bevételeid alapján. A pontos utalási adatokat az appban találod. | (előnézet: A IV. negyedévre 154 000 Ft-ot kell befizetned.)<br>Szia Péter!<br>Közeleg a negyedéves befizetés. Bence kiszámolta és jóváhagyta: az október–decemberi bevételeid után ennyit kell utalnod:<br>Szja-előleg: 41 000 Ft · TB-járulék: 86 000 Ft · Szociális hozzájárulási adó: 27 000 Ft · Összesen: 154 000 Ft · Határidő: 2027. 01. 12.<br>A számlaszámokat az appban találod. Ha már elutaltad, jelezd ott.<br>[Megnézem az utalási adatokat] |
| 9 | notif.fee_invoice_issued | ügyfél (fizetés és díjszámla után) | J | A „Megérkezett a havidíj” kétértelmű: nem derül ki, ki kapott pénzt. Egyszeri díjaknál (dijak.ts:211, pl. éves zárás) a „havidíj” hamis. | **Megérkezett a havidíj: {amount}**<br>A díjról szóló bizonylatot a Fiók → Díjak és számlák alatt találod. | **Megkaptuk a befizetésed: {amount}**<br>Köszönjük! A számlát a Fiók → Díjak és számlák alatt találod. |
| 10 | notif.callback_received | ügyfél (e-mail) | J | Időígéretet tesz, de hiányzik belőle a kötelező „munkanapokon 9 és 17 óra között”. Aki péntek délután kér hívást, hétvégére várhatja. | **Megkaptuk a visszahívási kérésed**<br>Kollégánk 24–48 órán belül hív a {phoneMasked} számon. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted. | **Megkaptuk a visszahívási kérésed** (marad)<br>A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. A {phoneMasked} számon keresünk. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted. |
| 11 | notif.assist_mh_filed | ügyfél (push + e-mail) | J | Sem az ONYA, sem a meghatalmazás célja nincs elmagyarázva, pedig az ügyfél éppen azért kérte a segítséget, mert ezt nem ismeri. Határidős teendő. | **Hagyd jóvá a meghatalmazást {hatarido}**<br>{firstName} beküldte a NAV-nak. Lépj be az ONYA-ba, és hagyd jóvá. Kb. 3 perc, megmutatjuk, hogyan. | **Hagyd jóvá a meghatalmazást {hatarido}** (marad)<br>{firstName} beküldte a NAV-nak, hogy intézhesse helyetted a NAV-os ügyeidet. Hagyd jóvá a NAV online felületén (ONYA): kb. 3 perc, lépésről lépésre megmutatjuk. |
| 12 | notif.assist_mh_reminder.utolso_nap | ügyfél (push + e-mail) | R | A cím nem mondja meg, minek az utolsó napja. Nem derül ki, mit töröl a NAV, és mi lesz utána. Az ONYA itt sincs elmagyarázva. | **Ma van az utolsó nap**<br>Hagyd jóvá ma a meghatalmazást az ONYA-ban, különben a NAV törli. | **Ma hagyd jóvá a meghatalmazást**<br>Ma van az utolsó nap: lépj be a NAV online felületére (ONYA), és hagyd jóvá. Kb. 3 perc. Ha ma kimarad, a NAV törli a kérést, és újra kell kezdeni. |
| 13 | notif.onboarding_needs_fix.jovahagyas | ügyfél (acc.ts:433) | R | Kezdő vállalkozónak az „ONYA” a push címében érthetetlen. A `{note}` alapértéke a kódban van (acc.ts:433, „…Hagyd jóvá az ONYA-ban 4 napon belül.”), azt csak ott lehet javítani. | **Hagyd jóvá a meghatalmazást az ONYA-ban**<br>{note} | **Hagyd jóvá a meghatalmazást a NAV-nál**<br>{note} Az appban lépésről lépésre megmutatjuk, hogyan. |
| 14 | notif.tax_approved.overdue | ügyfél (push + e-mail) | R | A cím ugyanaz, mint a határidőn belüli változatnál, így semmi nem jelzi, hogy a határidő már lejárt. Riasztó hang viszont nem kell, mert a késés sokszor nem az ügyfél hibája (tax.ts:326: belépés előtti negyedév). Ugyanez igaz a .hipa_overdue címére. | **Megvan a {periodAdj} összeg: {amount}**<br>{firstName} kiszámolta és jóváhagyta. A határidő ({dueDateText}) már elmúlt, ezért mielőbb utald el, {transfersText}. | **Mielőbb utald el a {periodAdj} összeget: {amount}**<br>{firstName} kiszámolta és jóváhagyta. A határidő ({dueDateText}) már elmúlt, ezért ne várj vele: utald el {transfersText}.<br>† .hipa_overdue cím: **Mielőbb utald el az iparűzési adóelőleget: {amount}** |
| 15 | notif.service_locked.kezi | ügyfél (push + e-mail, nem kapcsolható ki) | R | A folytatás egyetlen útja, hogy írjon nekünk, a szöveg mégis csak „ha kérdésed van”-t mond. Okot nem adhatunk meg (nincs rá helyőrző). | **Szünetel a könyvelésed**<br>Írj nekünk az Üzenetek fülön, ha kérdésed van. | **Szünetel a könyvelésed** (marad)<br>Írj nekünk az Üzenetek fülön, és megbeszéljük, hogyan folytathatjuk. |
| 16 | notif.certificate_status.elutasitva | ügyfél (app + push) | R | Hiányzik a következő lépés. (A Gemini „A NAV elutasította” címe téves, mert a könyvelő döntött.) | **Nem adható ki az igazolás**<br>{tipus}: {ok} | **Nem adható ki az igazolás** (marad)<br>{tipus}: {ok}<br>Ha kérdésed van, írj a könyvelődnek az Üzenetekben.<br>(Opcionális, tulajdöntés: „Ha már kifizetted a díját, visszautaljuk.”) |
| 17 | javasolt_12 (admin törölte a kártyát) | ügyfél | R | Indoklás nélkül ijesztő („feltörték?”). Okot nem adhatunk meg, de kiutat igen. | **Töröltük a mentett kártyádat**<br>Az ügyfélszolgálat törölte a mentett bankkártyádat. Hogy a havidíj levonása ne akadjon el, adj meg új kártyát a Fiók → Előfizetés alatt. | **Töröltük a mentett kártyádat** (marad)<br>Az ügyfélszolgálat törölte a mentett bankkártyádat. Hogy a havidíj levonása ne akadjon el, adj meg új kártyát a Fiók → Előfizetés alatt. Ha nem tudsz róla, írj nekünk az Üzenetek fülön. |

### 2.2 Jogos, de nem sürgős

| # | kulcs | kinek | | mi a gond | régi | új |
|---|---|---|---|---|---|---|
| 18 | notif.allowance_decided.elutasitva | ügyfél (push + e-mail) | J | A „Megnézem, miért” egy gombfelirat, amely E/1-ben a szövegbe került. | **{firstName} átnézte a kedvezményeidet**<br>Egy kedvezmény most nem jár. Megnézem, miért. | (marad)<br>Egy kedvezmény most nem jár. Az appban megnézheted, miért. |
| 19 | notif.invoice_new.tobb | ügyfél (push) | J | A „Megnézem, melyik mennyi” gombfelirat, nem értesítés. | **{n} új kiállított számlád: összesen {osszeg} Ft**<br>Tegyél félre kb. {felre} Ft-ot. Megnézem, melyik mennyi. | (marad)<br>Tegyél félre kb. {felre} Ft-ot. Az appban látod, melyik után mennyit. |
| 20 | notif.allowance_decided.jovahagyva | ügyfél (push + e-mail) | J | A címben nincs alany, nem derül ki, ki hagyta jóvá. | **Jóváhagyta a kedvezményedet: {label}**<br>Már az adóelőlegedben számolunk vele. | **{firstName} jóváhagyta: {label}**<br>(a szöveg marad) |
| 21 | javasolt_14 (üdvözlő levél) | új regisztráló | J | A „bekötés” belső szó, az új felhasználó még nem tudja, mit jelent. | **Üdv az Adózz-ban!**<br>Örülünk, hogy itt vagy. Az appban lépésről lépésre végigvezetünk a bekötésen; ha elakadsz, kérj visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. | (marad)<br>Örülünk, hogy itt vagy. Az appban lépésről lépésre végigvezetünk az induláson, hogy a könyvelőd átvehesse az ügyeidet. Ha elakadsz, kérj visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. |
| 22 | javasolt_17 (éves zárás határideje) | ügyfél | J | Kiküldve „május 20-ig: éves kérdőív” lenne, ami esetlen. Igével kezdődő tárgy kell, mint a notif.annual_due.kerdoiv címe. | **{hatarido}: éves kérdőív**<br>Töltsd ki az éves kérdőívet {hatarido}, hogy {firstName} időben beadhassa a bevallásodat. | **Töltsd ki az éves kérdőívet {hatarido}**<br>(a szöveg marad) |

### 2.3 Részben jogos, apróbb javítások (témák szerint)

| # | kulcs | kinek | | mi a gond | régi | új |
|---|---|---|---|---|---|---|
| 23 | notif.assist_mh_reminder | ügyfél | R | Az ONYA magyarázat nélkül szerepel. | **Még nem hagytad jóvá a meghatalmazást**<br>Még {hatarido} van időd. Kb. 3 perc az ONYA-ban. | (marad)<br>Még {hatarido} van időd. Kb. 3 perc a NAV online felületén (ONYA), az appban megmutatjuk, hogyan. † |
| 24 | notif.assist_mh_reminder.elso | ügyfél | R | Ugyanaz, mint a 23. sorban. | ugyanaz | ugyanaz, mint a 23. sorban |
| 25 | notif.assist_mh_expired | ügyfél | R | A „Lejárt a 4 nap” push-címként rejtélyes, a „jóvá nem hagyott” kicsit hibáztató. | **Lejárt a 4 nap**<br>A NAV törölte a jóvá nem hagyott meghatalmazást. {firstName} újra beküldi, és szólunk. | **Újra beküldjük a meghatalmazást**<br>A 4 nap alatt nem érkezett jóváhagyás, ezért a NAV törölte a meghatalmazást. {firstName} újra beküldi, és szólunk, amikor jóváhagyhatod. |
| 26 | notif.assist_started | ügyfél | R | Nem derül ki, mire való a meghatalmazás. | **Beszéltünk – így haladunk**<br>Ha megadtad az adataidat és elfogadtad a szerződést, {firstName} beküldi a meghatalmazást. Utána értesítést kapsz, és 4 napod lesz jóváhagyni. | (marad)<br>Ha megadtad az adataidat és elfogadtad a szerződést, {firstName} beküldi a NAV-nak a meghatalmazást, hogy a nevedben intézhesse az ügyeidet. Utána értesítést kapsz, és 4 napod lesz jóváhagyni. |
| 27 | notif.assist_task.ujra | könyvelő (e-mail) | R | A „Lejárt a 4 nap” egy új kollégának rejtvény. | **Lejárt a 4 nap: {clientName}**<br>Küldd be újra a meghatalmazást. | **Küldd be újra a meghatalmazást: {clientName}**<br>4 napon belül nem lett jóváhagyva, ezért a NAV törölte. |
| 28 | notif.onboarding_task.adoszam | könyvelő (panel) | R | Nem mondja meg, mit és hova kell kitölteni. | **Adószám hiányzik: {clientName}**<br>Töltsd ki az ONYA-ból, amint él a meghatalmazás. | (marad)<br>Amint él a meghatalmazás, nézd meg az adószámát az ONYA-ban, és írd be az adatlapjára. |
| 29 | notif.invoice_new | ügyfél (push) | R | A `{vevo}` a vevő neve, magánszemélynél „Magánszemély”. A kiküldött szöveg így „Magánszemély. Tegyél félre…”, ami mondattöredék. A „Vevő:” előtag a .kuszob és .adomentes push-törzsbe is kell. | **Új kiállított számlád: {osszeg} Ft**<br>{vevo}. Tegyél félre kb. {felre} Ft-ot. | (marad)<br>Vevő: {vevo}. Tegyél félre kb. {felre} Ft-ot. |
| 30 | email.invoice_new | ügyfél (e-mail, alapból kikapcsolva) | R | Az első „mondat” egy puszta cégnév, és nem derül ki, hogy a félretett összeg az adóra kell. A link-sor új alakját mind az 5 számla-levélben egyformán kell használni (vagy egyikben sem). | {vevo}. Tegyél félre kb. {felre} Ft-ot.<br><br>Az összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz | Vevő: {vevo}. Ebből tegyél félre kb. {felre} Ft-ot adóra.<br><br>Az összes számládat és a félreteendő összeget az alkalmazásban látod: {appUrl}/felretesz |
| 31 | email.invoice_new.kuszob | ügyfél | R | A végére biggyesztett „Elfogyott az adómentes részed.” hirtelen: az ok a teendő elé kell. | {vevo}. Tegyél félre kb. {felre} Ft-ot. Elfogyott az adómentes részed.<br><br>Az összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz | Vevő: {vevo}. Ezzel elfogyott az adómentes részed, ezért ebből már tegyél félre kb. {felre} Ft-ot.<br><br>Az összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz |
| 32 | email.invoice_new.tobb | ügyfél | R | Ugyanaz a gombfelirat-mondat, mint a 19. sorban. | Tegyél félre kb. {felre} Ft-ot. Megnézem, melyik mennyi.<br><br>Az összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz | Tegyél félre kb. {felre} Ft-ot.<br><br>Hogy melyik számla után mennyit, az alkalmazásban látod: {appUrl}/felretesz |
| 33 | notif.service_locked | ügyfél (nem kapcsolható ki) | R | A „Fizess, és … folytatja” nyers, utasító. Ugyanez a mondat szerepel a zárolási bannerben is (_shared/bekotes.ts:3527). | **Szünetel a könyvelésed**<br>Nincs kifizetve a {mit}. Fizess, és {firstName} folytatja. | (marad)<br>Még nincs kifizetve a {mit}. Amint rendezed, {firstName} folytatja a munkát. |
| 34 | notif.subscription_paused (+ a .kezdet, mert a szöveg ugyanaz) | ügyfél | R | Érdemes kimondani, hogy ez a szünet idejére szóló kisebb díj. Így a mondat sem kisbetűs dátummal kezdődik. | **Szünetel a vállalkozásod**<br>{from} a havidíj helyett havi {dij} Ft-ot fizetsz. | (marad)<br>A szünet idejére {from} a havidíj helyett csak havi {dij} Ft-ot fizetsz. |
| 35 | notif.subscription_paused.vege | ügyfél | R | Az „Újra dolgozol” nem köti a címet a szünet végéhez. A „{from} ismét a havidíj jár” kétértelmű („jár” = neki jár?). | **Újra dolgozol**<br>{from} ismét a havidíj jár. | **Újraindult a vállalkozásod**<br>A szünet véget ért: {from} újra a rendes havidíjat fizeted. † |
| 36 | javasolt_11 (megszűnt az árkedvezmény) | ügyfél | R | Nem derül ki, hová fordulhat kérdéssel. huLongDate-tel a „{datum}-tól” „1.-tól” lenne. (A 30 napos előzetes értesítés tulajdöntés.) | **Változik a havidíjad**<br>{datum}-tól a havidíjad {osszeg} Ft, mert megszűnt a kedvezményed. A részleteket a Fiók → Előfizetés alatt látod. | (marad)<br>{datum} napjától a havidíjad {osszeg} Ft, mert megszűnt a kedvezményed. A részleteket a Fiók → Előfizetés alatt látod; ha kérdésed van, írj nekünk. |
| 37 | minta_04_dijbekero_atutalas | ügyfél (mintalevél) | R | Egy ismeretlen kedvezményezett utalásnál gyanús lehet. (A hiányzó tárgy és a dupla gomb csak kigyűjtési hiba.) | Kedvezményezett: Somosi Kft. | Kedvezményezett: Somosi Kft. (az Adózz.hu üzemeltetője) |
| 38 | notif.tax_reopened.neutral | ügyfél (push + e-mail) | R | Ugyanarra két szó szerepel („levelét” és „kísérőlevél”), és nem derül ki, kell-e tenni valamit. | **{firstName} pontosította a levelét**<br>A {period} összege nem változott, csak a kísérőlevél. Nézd meg az appban. | (marad)<br>A {period} fizetendője nem változott, csak a levél szövege. Az appban elolvashatod. |
| 39 | notif.tax_due_soon.kata_ma | katás ügyfél (ma nem küldjük) | R | Nem mondja meg, hol vannak az utalási adatok. Az „a {honap}” névelője magánhangzós hónapnál hibás („a október”). | **Ma van a kata határideje**<br>Utald el ma az 50 000 Ft-ot a {honap} hónapra. | (marad)<br>Utald el ma az 50 000 Ft-ot ({honap} havi kata). Az utalási adatokat az appban látod. |
| 40 | notif.onboarding_done | ügyfél (push + e-mail) | R | A „minden be van kötve” belső szó. Az „Itt látod majd” e-mailben félrevezető, hiszen ott az „itt” maga a levél. | **Kész: minden be van kötve**<br>Innentől {firstName} intézi a könyvelésed. Itt látod majd, mit kell fizetned és mikor. | **Minden kész, indul a könyvelésed**<br>Innentől {firstName} intézi a könyvelésed. Az appban mindig látod, mit kell fizetned és mikor. |
| 41 | notif.registration_reminder.tevekenyseg_segitett | ügyfél (segített út) | R | A „tevékenységed sora” az ÖVTJ-listára utal, amelyet a segített úton az ügyfél nem is lát. | **Megírtuk a tevékenységed sorát**<br>(szöveg) | **Kiválasztottuk a tevékenységed kódját**<br>(a szöveg marad) |
| 42 | notif.allowance_decided.reszben | ügyfél (ma nem küldjük) | R | Nem árulja el, hogy nem minden kérést fogadtak el. | **{firstName} átnézte a kedvezményeidet**<br>Nézd meg, mi jár. | (marad)<br>Van, ami jár, és van, ami most nem. Nézd meg, melyik. |
| 43 | notif.income_statement_checked | ügyfél (push + app) | R | A „rajta van az ellenőrzés” gépies. | **{firstName} ellenőrizte a bevételi kimutatásodat**<br>{from}–{to}: a PDF-en már rajta van az ellenőrzés. | (marad)<br>{from}–{to}: a letölthető PDF-en már látszik, hogy ellenőrizte. |
| 44 | javasolt_13 (igazolás nem adható ki) | ügyfél | R | Nincs következő lépés. Az „a(z) {tipus} igazolást” kétszer mondja ki az igazolást („Jövedelemigazolás igazolást”), és az „a(z)” is csúnya. | **Nem tudjuk kiadni az igazolásodat**<br>{firstName} nem tudta kiadni a(z) {tipus} igazolást: {ok}. Ha már kifizetted a díját, visszatérítjük. | (marad)<br>{firstName} nem tudta kiadni ezt az igazolást: {tipus}. Az oka: {ok}. Ha már kifizetted a díját, visszatérítjük. Ha kérdésed van, írj neki az appban, az Üzenetekben. |
| 45 | javasolt_19 (fiók letiltva) | ügyfél | R | Okot nem adhatunk meg, de a „miért?” kérdéssel is ide írhasson. | **Letiltottuk a fiókodat**<br>Letiltottuk az Adózz-fiókodat, ezért most nem tudsz belépni. Ha kérdésed van, válaszolj erre a levélre. | (marad)<br>Letiltottuk az Adózz-fiókodat, ezért most nem tudsz belépni. Ha nem tudod, miért, vagy szerinted tévedés, válaszolj erre a levélre, és segítünk. |
| 46 | javasolt_01 (felmondás PDF-fel) | ügyfél | R | huLongDate-tel a „{datum}-ig” „31.-ig” lenne. Levélben jobb kiírni, hogy a Dosszié az appban van. | **Felmondtuk a szerződésedet**<br>A szerződésed {datum}-ig érvényes, addig minden a megszokott módon megy. A felmondó levelet csatoltuk, és a Dossziéban is megtalálod. (Azonnali: A szerződésed ma megszűnt. A felmondó levelet csatoltuk, és a Dossziéban is megtalálod.) | (marad)<br>A szerződésed {datum} napjáig érvényes, addig minden a megszokott módon megy. A felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod. (Azonnali: A szerződésed ma megszűnt. A felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod.) |
| 47 | javasolt_04 (megszűnt az előfizetés) | ügyfél + könyvelő | R | A „{datum}-tól” „31.-tól” lenne. A könyvelői sort egységesíteni kell a meglévő felmondási feladattal: „a NAV-nál”, és „letiltás”, nem „törlés”. | **Megszűnt az előfizetésed** / **Megszűnt: {clientName}**<br>Ügyfélnek: {datum}-tól megszűnt az Adózz-előfizetésed, több díjat nem vonunk le. Az irataidat az appban továbbra is megnézheted.<br>Könyvelőnek: Vond vissza a meghatalmazást, és töröld a technikai felhasználót. | (marad)<br>Ügyfélnek: {datum} napjával megszűnt az Adózz-előfizetésed, több díjat nem vonunk le. Az irataidat az appban továbbra is megnézheted.<br>Könyvelőnek: Vond vissza a meghatalmazást a NAV-nál, és tiltsd le a technikai felhasználót. |
| 48 | email.staff_client_removed | az a könyvelő, akitől az ügyfelet elvették (admin.ts:94) | R | A tárgy feleslegesen vádló. | **Ügyfelet vettek el tőled: {clientName}**<br>Szia!<br><br>Az admin {clientName} ügyfelet egy másik könyvelőhöz rendelte. Az adatait mostantól nem látod.<br><br>Ha erről nem tudtál, szólj még ma a cégvezetőnek.<br><br>{brand} | **Másik könyvelőhöz került: {clientName}**<br>Szia!<br><br>Az admin {clientName} ügyfelet átadta egy másik könyvelőnek, ezért az adatait mostantól nem látod.<br><br>Ha erről nem tudtál, szólj még ma a cégvezetőnek.<br><br>{brand} |
| 49 | notif.callback_overdue | munkatárs + adminok (e-mail) | R | A „Lejárt a 48 óra” belső zsargon, és pontatlan is lehet, mert a határidő állítható (CALLBACK_DUE_HOURS). | **Lejárt a 48 óra: {clientName}**<br>A kérés {createdText} érkezett. Hívd vissza minél előbb. | **Lejárt a visszahívás határideje: {clientName}**<br>(a szöveg marad) |
| 50 | notif.callback_assigned.uj_szam | a visszahívást vivő munkatárs | R | A szöveg csak megismétli a címet, és nem mondja ki a lényeget: a szám most már hívható. | **Új telefonszám: {clientName}**<br>{clientName} új telefonszámot adott meg. | (marad)<br>Megadta az új számát, most már hívhatod. A visszahívásnál látod. |
| 51 | email.auth_staff_invite | új könyvelő | R | Nem mondja meg, miért az „Elfelejtettem a jelszavam” utat kell választani (még nincs jelszava), és hogy utána jelszót állít be. A „ha közben új kódot kaptál, az is jó” mondat (lásd az 52. sort) ide is kell. | **Meghívó a {brand} könyvelői felületére**<br>Szia!<br><br>Meghívtunk a {brand} könyvelői felületére ({panelUrl}).<br>A belépéshez kattints az „Elfelejtettem a jelszavam” gombra ezzel az e-mail-címmel, és add meg ezt a kódot:<br><br>{code}<br><br>15 percig érvényes; ha lejár, kérj újat ugyanott.<br><br>{brand} | (marad)<br>Szia!<br><br>Meghívtunk a {brand} könyvelői felületére ({panelUrl}).<br>Még nincs jelszavad, ezért első belépéskor kattints az „Elfelejtettem a jelszavam” gombra, írd be ezt az e-mail-címet, és add meg ezt a kódot:<br><br>{code}<br><br>Utána beállíthatod a jelszavadat. A kód 15 percig érvényes; ha lejár, kérj újat ugyanott.<br><br>{brand} |
| 52 | email.auth_staff_invite_csapat | új ügyfélszolgálati munkatárs (admin.ts:260) | R | Első belépésnél furcsa az „Elfelejtettem a jelszavam”. A „Kódot kérek” lépés egy második kódot is küld, így két kód közül kell választani. | **Meghívó a {brand} ügyfélszolgálati felületére**<br>…A belépéshez kattints az „Elfelejtettem a jelszavam” gombra ezzel az e-mail-címmel, és add meg ezt a kódot:<br><br>{code}<br><br>15 percig érvényes; ha lejár, kérj újat ugyanott.<br><br>{brand} | (marad)<br>Szia!<br><br>Meghívtunk a {brand} ügyfélszolgálati felületére ({panelUrl}).<br>Az első belépéskor te állítod be a jelszavadat: kattints az „Elfelejtettem a jelszavam” gombra, írd be ezt az e-mail-címet, és add meg ezt a kódot:<br><br>{code}<br><br>15 percig érvényes. Ha lejár, kérj újat ugyanott; ha közben új kódot kaptál, az is jó.<br><br>{brand} |
| 53 | notif.client_path_changed | csapat, admin és az ügyfél könyvelője (csak panel) | R | A puszta „{fromLabel} → {toLabel}” nem mondja meg, melyik kérdésről van szó. A címkék: „Már van vállalkozásom” / „Most indítom”. | **{clientName} módosította a válaszát**<br>{fromLabel} → {toLabel} | (marad)<br>Van már vállalkozása? Eddig: „{fromLabel}”, most: „{toLabel}”. † |
| 54 | javasolt_03 (NAV-hiba) | könyvelő + admin | R | A teendő megvan, de nem derül ki, hol kell javítani: az ügyfél Bekötés fülén (Bekotes.tsx:571). | **NAV-hiba: {clientName} számlái nem jönnek**<br>A NAV-lekérdezés nem sikerült: {hiba}. Amíg nem javítod a technikai felhasználót, a napi lekérdezés kihagyja ezt az ügyfelet. | (marad)<br>A NAV-lekérdezés nem sikerült: {hiba}. Javítsd a technikai felhasználót az ügyfél adatlapján, a Bekötés fülön. Amíg nem javítod, a napi lekérdezés kihagyja ezt az ügyfelet. |

### 2.4 Mit egységesítettünk az összeállításkor (†)

- **contract_terminated (1, 2, 4. sor):** a bírálók három különböző mondatot javasoltak („napjáig … utána megszűnik”, „napjával megszűnik”, „napján megszűnik”). Mindenhol ugyanaz lett: „A szerződésed {datum} napjával megszűnik”. Az ugyfel_kerte változatból kimaradt az „addig minden … megy tovább”, mert ügyfélkérésre azonnali megszűnés is lehet (konzol-muveletek.ts:526). A levél minden változatnál bekerül a Dossziéba (konzol-muveletek.ts:509–523).
- **assist_mh_reminder (23. sor):** az alapváltozat bírálója „a NAV ONYA oldalán” alakot javasolt. Itt is ugyanaz lett, mint az .elso, a mh_filed és az utolso_nap szövegében: „a NAV online felületén (ONYA)”.
- **tax_approved.hipa_overdue címe (14. sor):** a bíráló csak jelezte, hogy ezt is javítani kell, szöveget nem adott hozzá.
- **subscription_paused.vege (35. sor):** a „{from} újra…” kisbetűs dátummal kezdené a mondatot, ezért kapott egy „A szünet véget ért:” bevezetőt.
- **client_path_changed (53. sor):** a „Most: Most indítom.” ismétlés helyett idézőjelek kerültek a címkék köré.

---

## 3. Nem jogos kifogások (67), egy sorban okkal

**Téves címzett-becslés: valójában könyvelőnek, munkatársnak vagy adminnak szól, és nekik érthető (44)**
- notif.client_message_new: könyvelői panel-jelvény, push és e-mail ki.
- notif.client_marked_paid: könyvelői panelsor, a tömörség ott nem hiba.
- notif.client_request_new: könyvelőnek szól, csak appon belül.
- notif.client_document_uploaded: könyvelői panel-jelvény.
- notif.onboarding_needs_review: könyvelőnek szól, a `{step}` kész magyar mondat.
- notif.onboarding_needs_review.uj_vallalkozas: könyvelőnek világos.
- notif.callback_new: munkatársnak egyértelmű.
- notif.callback_assigned: munkatársnak szól (callbacks.ts:351, 465).
- notif.registration_submitted: notifyQueueOwners küldi munkatársnak.
- notif.registration_submitted.tevekenyseg: az ÖVTJ és a Javítom gomb munkatársnak ismert.
- notif.assist_task: könyvelői feladat.
- notif.assist_task.ujegyke: az UJEGYKE könyvelőnek ismert NAV-nyomtatvány.
- notif.assist_task.ellenorzes: könyvelőnek szóló ONYA-utasítás.
- notif.assist_task.bejelentes: könyvelői feladat.
- notif.assist_task.ellenorzes_kesik: munkatársi feladat, a gombnevek a panel saját gombjai.
- notif.assist_task.atnezes: munkatársi feladat.
- notif.assist_task.kesik: belső határidő-figyelmeztetés.
- notif.assist_task.valtozas_adatok: könyvelőnek érthető.
- notif.assist_task.valtozas_bekuldes: könyvelőnek szól.
- notif.assist_task.valtozas_atnezes: munkatársi feladat.
- notif.assist_task.felmondas: könyvelői feladat (ÁSZF 8.6).
- notif.assist_approval_overdue: munkatársnak szól, a „Hívd fel” helyes utasítás.
- notif.allowance_submitted: könyvelői jelvény.
- notif.annual_submitted: könyvelőnek szól, a `{feeState}` magyar szöveg, nem kód.
- notif.client_locked: könyvelőnek szól, az ügyfél a service_locked szövegét kapja.
- notif.checkin_change: könyvelői jelvény.
- notif.employer_reported: könyvelői döntési feladat, az EFO ismert neki.
- notif.onboarding_task: könyvelői szöveg, jelenleg ki sem megy.
- notif.onboarding_task.adozasi_mod: könyvelői szöveg, nincs küldő helye.
- notif.certificate_requested: könyvelőnek szól.
- notif.income_statement_review: könyvelői feladat.
- notif.payment_disputed: adminriasztás.
- notif.payment_disputed.dupla: adminriasztás.
- notif.payment_disputed.dupla_dij: adminriasztás, ezért kell a `{clientName}`.
- notif.payment_disputed.dupla_nem_ment: adminteendő.
- notif.payment_disputed.kulso_visszaterites: adminriasztás.
- notif.payment_disputed.osszeg_elteres: adminriasztás.
- notif.payment_disputed.felmondas_utan: adminteendő.
- notif.payment_disputed.szolgaltato_hiba: adminriasztás, az ügyfél külön értesítést kap.
- notif.payment_disputed.visszaterites_hiba: adminriasztás, a „Nézd meg a Stripe-ban” neki szól.
- notif.payment_disputed.vita_elveszett: adminriasztás.
- notif.invoice_failed: adminriasztás.
- notif.message_new.accountant_changed: valóban az ügyfélnek szól, és érthető, a kifogás a becslésből jött.
- javasolt_20: munkatársi összesítő, a „bekötés” a panel ismert fogalma.

**A kigyűjtés mellékterméke (11)**
- notif.tax_payment_mismatch.hipa: a cím nem üres, a notify() a szülőkulcs címére esik vissza.
- notif.tax_payment_verified.hipa: ugyanígy a szülőkulcs címét kapja.
- notif.appointment_booked.video: ugyanígy a szülőkulcs címét kapja, és ráadásul régi, már nem küldött fajta.
- email.invoice_new.adomentes: a tárgy az értesítés címe, nem hiányzik.
- email.invoice_new.tobb_adomentes: a tárgy az értesítés címe.
- email.registration_needs_fix: a tárgy a notif.registration_needs_fix.title.
- email.generic: ez lábléc (footer), nem önálló levél.
- javasolt_00: a LEVEL_LEFEDETTSEG.md 3. pontjának fejléce.
- javasolt_05: utalás a 4. pont két levelére, nem hiányzó sablon.
- minta_03_dijszamla: a „dupla gomb” az Outlook VML-tartaléka.
- minta_06_visszahivas: a tárgy megvan, és a kötelező visszahívás-mondatot használja.

**Helyőrző félreolvasása: a `{hatarido}` és a `{from}` már ragozva jön (5)**
- notif.tax_approved: behelyettesítve kerek mondat („Utald el október 12-ig, két külön utalással.”).
- notif.annual_due: „…március 15-ig” helyes.
- notif.annual_due.kerdoiv: „…május 20-ig” helyes.
- notif.annual_due.jovahagyas: „…november 18-ig” helyes.
- notif.subscription_paused.kezdet: „március 1-jétől” helyes (a 34. sor szerinti pontosítás ide is átvehető).

**Régi, nem küldött fajta (1)**
- notif.appointment_cancelled: a LEGACY_NOTIFICATION_KINDS része, a visszahívás váltotta.

**A szöveg jó így (6)**
- notif.tax_payment_mismatch: a teendő egyértelmű, a Gemini javítása gyakorlatilag ugyanaz.
- notif.invoice_new.rejtett: a cím és a szöveg nem ismétli egymást.
- notif.employer_decided.egyedi_elfogadva: a „bekötés” az ügyfélappban is látható kifejezés.
- notif.nudge.tobb: összefoglaló push. A Gemini „Kezdőlap”-ja rossz, a fül neve Főoldal.
- notif.tax_due_soon.kata: csak katás ügyfél kapná, és érthető.
- javasolt_06: a Dosszié az ügyfélapp valódi fülneve.

---

## 4. Tanulság: visszatérő hibák

1. **Ragozás a dátum-helyőrzők után (valódi, kiküldött hiba).** A huLongDate („2026. december 31.”) és a huDayMonth („november 25.”) ponttal végződik, ezért a `{datum}-ig`, `{datum}-n` és `{datum}-tól` kiküldve „31.-ig”, „25.-n”, „1.-tól” lesz. Érintett: a contract_terminated mind a 4 kulcsa, az email.contract_terminated, a subscription_renewal_needed.nincs_kartya, a **notif.price_changed.body** (konzol-muveletek.ts:216; ezt a Gemini nem jelezte), valamint a javasolt_01, 04 és 11.
   - Szabály: helyőrző után ne álljon kötőjeles rag. Vagy „{datum} napjáig / napjával / napjától”, vagy ragozott formázó (huDayMonthIg, huDayMonthTol, huDayMonthAn), ahogy a `{hatarido}` és a `{from}` már helyesen csinálja.
   - Rokon hibák: „a {honap}” (→ „a október”) és „a(z) {tipus}”.
2. **Szakszó magyarázat nélkül az ügyfélnek.** Ilyen az ONYA, a meghatalmazás célja, a „bekötés”, a „kártyaengedély” és a „tevékenységed sora”.
   - Szabály: az ügyfélnek első említéskor „a NAV online felületén (ONYA)”, és mindig egy félmondat arról, mire jó („hogy intézhesse helyetted a NAV-os ügyeidet”).
3. **Gombfelirat került a szövegbe E/1-ben.** Például „Megnézem, melyik mennyi.” és „Megnézem, miért.” A szöveg leírja, hol van a válasz („Az appban látod…”), a gomb maradjon gomb.
4. **Önmagára mutató vagy homályos helymegjelölés.** Például „A részleteket a levélben olvasod” egy levélben, vagy „Itt látod majd” egy e-mailben. Mindig nevezzük meg a helyet: „az appban, a Dossziéban”, „Fiók → Előfizetés”, „az Üzenetek fülön”.
5. **Push-cím, amely önmagában nem mond semmit.** Például „Ma van az utolsó nap”, „Lejárt a 4 nap”, „Lejárt a 48 óra”, „Újra dolgozol”, vagy a lejárt határidős változat, amelynek ugyanaz a címe, mint a normálnak. A címnek a listában, kontextus nélkül is érthetőnek kell lennie: mi történt, vagy mit kell tenni.
6. **Hiányzó következő lépés elutasításnál, zárolásnál, törlésnél.** Ide tartozik a certificate_status.elutasitva, a service_locked.kezi, a javasolt_12 és a javasolt_13. Mindig legyen kiút („írj … az Üzenetekben”), kitalált ok nélkül.
7. **Az „üres push-cím” nem valós hiba.** A notify() variánsonként visszaesik a szülőkulcs címére, az e-mail tárgya pedig mindig az értesítés címe (az `email.*.body` kulcsoknak nincs saját tárgya). Csak a kigyűjtő szkript mutatta üresnek. A következő Gemini-futásnál a feloldott címet és a valódi címzettet kell átadni: a címzettet a notify.ts KIND_DEFAULTS `to` mezőjéből, nem kulcsszóból.
8. **Időígéret csak a kötelező mondattal, szó szerint:** „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.” (a callback_received sértette).
9. **„Kb.” vagy „becsült” ott, ahol az összeg jóváhagyott** (minta_05). Ez rossz összeg utalására bátoríthat.

**A kódban javítandó, a szövegek miatt kiderült hibák:**

- `services/zarolas.ts:82`: a `parts.join(' és a ')` miatt a kiküldött szöveg „havidíj és a éves zárás díja” lesz („az éves” helyett).
- `content/k29f.ts:66`: az email.contract_terminated.body a rendes törzsből van összefűzve. A javítás után a Dosszié-mondat kétszer szerepelne, és a kulcsot ma egyik hívó sem használja.
- `routes/acc.ts:433`: a `{note}` alapértéke ponttal zárul, így a „{note} Az appban…” rendben van. A könyvelő saját `b.note` szövegének végén viszont hiányozhat a pont.
- `_shared/bekotes.ts:3527`: a zárolási banner ugyanazt a „Fizess, és {firstName} folytatja.” mondatot használja. Ha a service_locked változik, ezt is át kell írni.
- A bírálók további, nem ellenőrzött jelzései: a `jobs.ts:98` nyers lépéskulcsot fűz a `{step}`-be, a `client.ts:953` pedig a client_request_new fajtával jelzi a teljesített kérést.
