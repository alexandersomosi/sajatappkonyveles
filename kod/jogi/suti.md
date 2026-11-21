TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács.

# Süti-tájékoztató

Ez a tájékoztató felsorolja, milyen sütiket és hasonló technológiákat használunk a weboldalunkon, a webes appban és a telefonos appban: mit, mire, mennyi ideig, és hogyan dönthetsz róluk. Verzió: {{dok.verzio}}. Hatályos: {{dok.hatalyos}}. Ezekért felel: {{ceg.nev}} ({{ceg.szekhely}}; {{ceg.email}}). Azt, hogy milyen személyes adataidat kezeljük, az Adatkezelési tájékoztató írja le; ez a tájékoztató annak a 2.14., 2.17. és 2.18. pontját részletezi.

## Röviden

- A belépéshez és a felület működéséhez csak olyan sütit és tárolást használunk, amely nélkül a kért szolgáltatás nem működne (például hogy belépve maradj).
- A weboldalunk látogatottságát süti nélkül, saját szerverünkön mérjük, és a weboldal saját kódja a forrásodat a regisztrációs linkhez fűzi (3. pont). Ezekhez jogos érdekünk alapján nem kérünk hozzájárulást, ezért most nem jelenik meg süti-ablak (4. pont).
- Elemző sütit (például Google Analytics) nem használunk.
- Hirdetési sütit (Meta, Google) most nem használunk. Ha a hirdetési mérést bekapcsoljuk, ezek csak akkor kerülnek a böngésződbe, ha elfogadod (5. és 6. pont).

## 1. Mi a süti, és mi a hasonló technológia

A süti (cookie) egy kis szöveges adat, amelyet egy webhely a böngésződben tárol, és a böngésződ a következő kéréseknél visszaküld neki. Hasonló technológia a böngésző helyi tára (localStorage) és munkamenet-tára (sessionStorage), a telefonos app tárhelye, és minden olyan kód, amely a böngésződből vagy a telefonodról adatot olvas ki vagy küld el. A sütikre és a hasonló technológiákra az elektronikus hírközlésről szóló 2003. évi C. törvény 155. § (4) bekezdése vonatkozik (a 2002/58/EK irányelv 5. cikk (3) bekezdése szerint értelmezve). Hogy melyiket milyen alapon használjuk, tételenként írjuk. [JOGI: M3 – a helyes hivatkozás, mint az Adatkezelési tájékoztató 2.14. pontjában; M1 – a 3. pont tételeihez kell-e hozzájárulás]

Minden tételnél megadjuk: kié (saját, vagy egy másik cégé, azaz harmadik félé), hol él, mire való, meddig marad meg, és melyik csoportba tartozik:

- **feltétlenül szükséges:** nélküle a kért szolgáltatás nem működik; hozzájárulás nem kell, és nem kapcsolható ki (a böngésződben törölheted, de akkor például kijelentkezel);
- **statisztika:** a weboldal látogatottságának mérése (3. pont);
- **hirdetési mérés:** a hirdetéseink mérése a Metánál és a Google-nél; csak a hozzájárulásoddal, és most nincs bekapcsolva (5. pont).

## 2. Amit most használunk (feltétlenül szükséges)

**__Host-kj_rt – süti a webes appban**

- **Kié, hol:** saját; csak a webes app címén él, más webhely nem kapja meg.
- **Mire:** hogy belépve maradj. Egy véletlen, titkos frissítő kódot tartalmaz, amellyel a böngésződ új belépési engedélyt kér a szerverünktől.
- **Meddig:** legfeljebb 30 napig; ha 14 napig nem használod, a szerverünk érvényteleníti. Kijelentkezéskor töröljük. Munkatársaink felületén ugyanez a süti él, legfeljebb 7 napig, illetve 12 óra tétlenségig. [TULAJ: a munkatársi felület szerepeljen-e itt]
- **Jellemzők:** a böngészőben futó kód nem olvashatja ki (HttpOnly), csak titkosított kapcsolaton megy (Secure), és más webhelyről indított kéréshez a böngésző nem küldi el (SameSite=Strict).
- **Csoport és jogalap:** feltétlenül szükséges; szerződés.

**kj_rt – a telefonos appban**

- **Hol:** a telefonod védett tárhelyén (iPhone-on a kulcskarikában, Androidon a rendszer kulcstárolójával titkosítva); csak a mi appunk olvashatja.
- **Mire és meddig:** ugyanaz, mint a webes belépési sütinél: hogy belépve maradj; legfeljebb 30 napig, illetve 14 nap tétlenségig. Kijelentkezéskor töröljük.
- **Csoport:** feltétlenül szükséges.

**kj_bio – a telefonos appban**

- **Hol:** a telefonod védett tárhelyén.
- **Mire:** megjegyzi, hogy bekapcsoltad-e a biometrikus zárat (ujjlenyomat vagy arc). Az ujjlenyomatodat vagy az arcodat a telefonod ellenőrzi, mi ebből semmit nem kapunk (Adatkezelési tájékoztató 2.13. pont).
- **Meddig:** amíg ki nem kapcsolod, vagy az appot nem törlöd.
- **Csoport:** feltétlenül szükséges (az általad kért beállítás).

**kj_elokeszit_…, kj_video_… és kj_aktiv_kartya_… – a webes appban a böngésző helyi tárában, a telefonos appban a védett tárhelyen**

- **Mire:** a felület apró beállításai: az útmutatóban kipipált előkészítő lépések, hogy megnéztél-e már egy bemutató videót, és hogy elrejtettél-e egy kártyát a Főoldalon. A tartalmuk csak egy jelölés (például „1”) vagy a pipák listája. A kulcs neve a fiókod belső azonosítóját tartalmazza, hogy egy közös gépen ne keveredjenek több felhasználó beállításai.
- **Hova kerül:** sehova; a te eszközödön marad, nem küldjük el.
- **Meddig:** nem járnak le maguktól; a böngésződ adatainak, illetve az appnak a törléséig maradnak meg. [JOGI: M12 – javaslat: kijelentkezéskor törlődjenek]
- **Csoport:** feltétlenül szükséges (a felület általad kért működése).

**kj_reg_varakozo – a webes appban, a böngészőlap munkamenet-tárában**

- **Mire:** a regisztráció közben, amíg a megerősítő kódra vársz, megjegyzi az e-mail-címedet, hogy az oldal újratöltése után se kelljen újra beírnod.
- **Meddig:** a sikeres megerősítésig, legkésőbb a böngészőlap bezárásáig.
- **Csoport:** feltétlenül szükséges.

**A Google-belépés gombja – harmadik fél (Google)**

- **Hol:** a webes app belépő- és regisztrációs oldalán.
- **Mi történik:** a „Belépés Google-fiókkal” gomb megjelenítéséhez a böngésződ a Google szerveréről tölti be a Google kódját, már a gomb megjelenésekor, kattintás előtt is. Ekkor a Google megkapja a böngésződ szokásos adatait (például az IP-címedet), és a saját webcímein lévő sütijeit használhatja. Ha a gombra kattintasz, a belépést a Google intézi.
- **Sütik:** a Google saját sütijei, a Google szabályai szerint: policies.google.com/technologies/cookies. [ELLENŐRIZNI: tesz-e a Google-gomb sütit a mi webcímünkre, például g_state]
- **Csoport:** a Google-belépéshez szükséges. [JOGI: M11 – elég-e ez a tájékoztatás, vagy a kód csak kattintás után töltődjön be]

**A Stripe fizetési oldala – harmadik fél (Stripe)**

- **Mi történik:** a kártyád megadásához és a fizetéshez a Stripe saját oldalára irányítunk, a Stripe webcímére. Ott a Stripe saját sütijei érvényesek (például a visszaélések kiszűréséhez), ezekről a Stripe dönt: stripe.com/cookies-policy/legal. A mi oldalainkon nem fut Stripe-kód. [ELLENŐRIZNI: a Stripe sütiszabályzatának címe]

**Amit nem használunk:** elemző sütit, közösségimédia-gombot, más webhelyről betöltött betűtípust vagy videót. A bemutató videókat a saját szerverünkről játsszuk le, és a lejátszást nem mérjük.

## 3. A weboldal látogatottságának mérése (süti nélkül)

**A weboldal saját kódja (js/meres.js)**

- **Kié, hol:** saját, a weboldalunkon (adozz.hu).
- **Mire:** ha a weboldalról az appba lépsz (Regisztrálok, Belépés, Visszahívást kérek), a linkhez hozzáfűzi a kampányjelöléseket (utm_), annak a webhelynek a nevét, ahonnan jöttél, és a weboldal oldalát, ahol beléptél; ezeket a regisztrációkor eltároljuk (Adatkezelési tájékoztató 2.11. pont). Ha a látogatottság mérése be van kapcsolva, ez a kód tölti be a mérőkódot (lent), és előtte a webcímből a kampányjelöléseken kívül mindent levág. A gombokra kattintást a mérőkódnak küldi el, várakozás nélkül.
- **Meddig:** nem tesz sütit, és magától nem ír semmit a böngésződbe (csak ha a „Ne mérjétek a látogatásomat” kapcsolót használod, lent).
- **Csoport és jogalap:** a regisztráció forrásának megjegyzése; jogos érdek (Adatkezelési tájékoztató 2.11. pont).

**A mérőkód (Umami)**

- **Mi ez:** a bemutató weboldalunkon egy, a saját szerverünkről betöltött mérőkód fut (a nyílt forráskódú Umami). Nem tesz sütit, és nem ír semmit a böngésződbe. A webes és a telefonos appban nincs ilyen mérőkód.
- **Mit olvas ki a böngésződből:** a képernyő méretét, a böngésző nyelvét, a „Ne kövessenek” (Do Not Track) beállítást, és azt, hogy bekapcsoltad-e a „Ne mérjétek a látogatásomat” beállítást.
- **Mit küld a szerverünknek:** a meglátogatott oldal címét és webcímét (csak a kampányjelölésekkel, az utm_ kezdetűekkel; minden mást még a böngésződben levágunk), az oldalt, ahonnan jöttél, a kattintásokat (például a Regisztrálok gombra) és azt, hogy elgörgettél-e az árakig. A szerver ezen felül, mint minden webes kérésnél, látja az IP-címedet és a böngésződ típusát; az IP-címedet nem tároljuk.
- **Hova kerül:** csak a saját szerverünkre. Senki más nem kapja meg, a Meta és a Google sem, és a fiókoddal nem kötjük össze.
- **Csoport és jogalap:** statisztika; jogos érdek (Adatkezelési tájékoztató 2.17. pont). [JOGI: M1 – kell-e hozzájárulás; ha igen, a mérés a süti-ablakba kerül „Statisztika” néven, lásd bekapcsolaskor/valtozatok.md]

**umami.disabled – a weboldalon, a böngésző helyi tárában, csak ha kéred**

- **Mire:** ha a weboldal alján bekapcsolod a „Ne mérjétek a látogatásomat” kapcsolót, ezzel jegyezzük meg ezen a böngészőn, hogy ne mérjünk.
- **Meddig:** amíg vissza nem kapcsolod, vagy a böngésződ adatait nem törlöd.
- **Csoport:** feltétlenül szükséges (a te kérésedre tároljuk).

Ha a böngésződben bekapcsoltad a „Ne kövessenek” (Do Not Track) jelzést, a mérőkód akkor sem mér.

## 4. Miért nincs most süti-ablak

A 2. pont tételei feltétlenül szükségesek, a 3. pont tételeit pedig jogos érdekünk alapján, süti nélkül használjuk, és tiltakozhatsz ellenük (Adatkezelési tájékoztató 2.11. és 2.17. pont). Amíg a hirdetési mérés ki van kapcsolva, nincs mihez hozzájárulást kérnünk, ezért nem jelenik meg süti-ablak. A weboldalon és az appban most nincs hirdetési kód, és hirdetési sütit nem teszünk a böngésződbe. [JOGI: M1 – ha a 3. ponthoz hozzájárulás kell, a süti-ablak „Statisztika” csoporttal már most megjelenik (bekapcsolaskor/valtozatok.md B)]

## 5. Ha bekapcsoljuk a hirdetési mérést (most nincs bekapcsolva)

**Ez a rész most nem érvényes.** Csak attól kezdve, hogy a hirdetési mérést bekapcsoljuk, és csak akkor, ha elfogadod. Előtte ezt a tájékoztatót új verzióval frissítjük. Azt, hogy mit kap ilyenkor a Meta és a Google, a közös adatkezelést és az Egyesült Államokba továbbítást az Adatkezelési tájékoztató 2.18. pontja írja le.

**kj_hozzajarulas – a döntésedet tároló süti**

- **Kié, hol:** saját, a weboldalunk címén.
- **Mire:** megjegyzi, mit választottál a süti-ablakban (partnerenként) és melyik szövegváltozatra, hogy ne kérdezzünk minden oldalon újra; ha elfogadtad, a döntésed véletlen azonosítóját is, amellyel a regisztrációkor a döntésedet a fiókodhoz kötjük (Adatkezelési tájékoztató 2.18. pont). Mást nem tárol (időpontot sem).
- **Meddig:** 180 napig, utána újra megkérdezünk. Ha elfogadtad, a weboldal minden látogatáskor megkérdezi a szerverünket, érvényes-e még a döntésed (például nem vontad-e vissza az appban); ha nem, a hirdetési sütiket törli, és újra megkérdez. [TULAJ/JOGI: M8 – az élettartam]
- **Csoport:** feltétlenül szükséges (a döntésed tiszteletben tartásához). [JOGI: M8 – a magyar jogban nincs kifejezett szabály rá; a francia adatvédelmi hatóság (CNIL) iránymutatása kivételnek tekinti]

**Meta (Facebook, Instagram) – hirdetési mérés, csak ha elfogadod**

- **_fbp:** süti a weboldalunk címén, a Meta képpontkódja (Meta Pixel) teszi; a böngésződet a Meta számára megkülönböztető azonosító; 90 nap.
- **_fbc:** süti a weboldalunk címén; annak a Facebook- vagy Instagram-hirdetésnek a kattintás-azonosítója (fbclid), amelyből jöttél; 90 nap.
- **A Meta saját webcímein (például facebook.com) lévő sütik:** főleg akkor, ha be vagy jelentkezve a Facebookra vagy az Instagramra; ezekről a Meta dönt: facebook.com/privacy/policies/cookies. [ELLENŐRIZNI: a Meta sütijeinek hatályos listája és élettartama a bekapcsoláskor]
- **Szolgáltató:** Meta Platforms Ireland Limited (Írország); az adat az Egyesült Államokba is kerülhet (Adatkezelési tájékoztató 2.18. pont).

**Google (Google Ads) – hirdetési mérés, csak ha elfogadod**

- **_gcl_au:** süti a weboldalunk címén; a hirdetésekből érkezett látogatások és regisztrációk mérése; 90 nap.
- **_gcl_aw:** süti a weboldalunk címén; annak a Google-hirdetésnek a kattintás-azonosítója (gclid), amelyből jöttél; 90 nap.
- **_gcl_gb:** süti a weboldalunk címén; a kattintás-azonosító egy másik formája (gbraid); 90 nap.
- **A Google saját webcímein lévő sütik:** IDE (doubleclick.net, 13 hónap), test_cookie (doubleclick.net, 15 perc), DSID (doubleclick.net, 2 hét), id (doubleclick.net, 13 hónap), RUL (doubleclick.net, 12 hónap), APC (doubleclick.net, 6 hónap), ar_debug (90 nap), NID (google.com, 6 hónap), GCL_AW_P (90 nap), Conversion (googleadservices.com, 90 nap). Ezekről a Google dönt: policies.google.com/technologies/cookies és business.safety.google/adscookies. [ELLENŐRIZNI: a lista és az élettartamok a bekapcsoláskor]
- **Szolgáltató:** Google Ireland Limited (Írország); az adat az Egyesült Államokba is kerülhet (Adatkezelési tájékoztató 2.18. pont).
- **Google Analytics nincs:** ezért _ga süti sincs. [TULAJ: ha mégis kell, itt fel kell venni (_ga és _ga_…, 2 év), és külön hozzájárulási csoport kell hozzá]

## 6. Hogyan döntesz, és hogyan vonod vissza (ha a hirdetési mérést bekapcsoljuk)

- **Az első látogatáskor** egy ablakban kérdezünk, két egyforma gombbal: „Elfogadom” és „Elutasítom”; mellettük a „Beállítások”. A beállításokban partnerenként (Meta, Google) dönthetsz, ott alapból minden ki van kapcsolva. A feltétlenül szükséges tárolást tájékoztatásul látod, az nem kapcsolható ki. Személyre szabott hirdetést (remarketinget) nem kínálunk fel.
- **Amíg nem döntesz,** semmilyen hirdetési kód nem töltődik be. Az ablak bezárása, figyelmen kívül hagyása vagy az oldal görgetése nem hozzájárulás.
- **Elutasítással is minden működik:** a weboldalt ugyanúgy használhatod, és ugyanúgy regisztrálhatsz.
- **Ha regisztrálsz:** ha elfogadtad, és a weboldalunkról 7 napon belül regisztrálsz, a döntésedet a fiókodhoz kötjük, és a regisztrációdról és az első fizetésedről is jelzést küldünk annak a partnernek, amelyiknek hozzájárultál (Adatkezelési tájékoztató 2.18. pont). Az appban a Fiók > Adataim oldalon látod és visszavonhatod.
- **Visszavonás:** a weboldal minden oldalának alján ott a „Süti-beállítások” link; ugyanolyan egyszerű, mint az elfogadás. Visszavonáskor a weboldalunk címén lévő hirdetési sütiket (_fbp, _fbc, _gcl_…) töröljük, a hirdetési kódokat többé nem töltjük be, és a szerverünk sem küld rólad jelzést – akkor sem, ha a döntésedet már a fiókodhoz kötöttük. Ha az appban vonod vissza, a weboldal a következő megnyitáskor törli a hirdetési sütiket, és újra megkérdez. A visszavonás a korábbi adatkezelés jogszerűségét nem érinti.
- **Újrakérdezés:** ha ez a tájékoztató vagy a partnerek listája változik, újra megkérdezünk; egyébként 6 hónap után.

## 7. Hogyan törölheted magad

A böngésződ beállításaiban bármikor törölheted a sütiket és a webhelyek tárolt adatait, és le is tilthatod őket (a legtöbb böngészőben az adatvédelmi beállítások között). Ha a webes app belépési sütijét törlöd, kijelentkezel. A telefonos app tárolt adatai az app törlésével törlődnek. A Meta és a Google saját webcímein lévő sütiket mi nem tudjuk törölni: ezeket a böngésződben, illetve a Facebook- vagy a Google-fiókod adatvédelmi és hirdetési beállításaiban kezelheted (a Google-nél például a „Saját hirdetési központ” oldalon). [ELLENŐRIZNI: a beállítások pontos neve a bekapcsoláskor]

## 8. Változások

Ha a sütik vagy a hasonló technológiák listája változik, ezt a tájékoztatót új verzióval frissítjük. Ha a hirdetési mérést bekapcsoljuk, előbb ezt a tájékoztatót frissítjük, és csak utána kérdezünk. Kérdésed van? Írj nekünk: {{ceg.email}}.
