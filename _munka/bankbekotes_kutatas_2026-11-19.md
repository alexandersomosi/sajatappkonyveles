# Bankbekötés – kutatás 2026-11-19

**Röviden:** két cég jöhet szóba, akik a magyar bankok többségét lefedik és új ügyfelet is vállalnak: az **Aggreg8** (magyar) és az **Enable Banking** (finn). A többi bezárt, vagy nincs bizonyíték arra, hogy Magyarországon működik.

**1. Szolgáltatók, a legjobb elöl**
1. **Aggreg8 Kft. (Szeged).** Rajta van az MNB listáján (2026-04-15).
   - Bankok a logóik alapján: OTP, K&H, MBH, Erste, Raiffeisen, UniCredit, CIB, Gránit, MagNet, BinX, Revolut, Wise.
   - Új ügyfelet vállal (ingyenes demó). Az ára nem nyilvános.
   - Saját engedély nélkül is használhatod: van API (programozói csatlakozás), és van kész webes felület, ahonnan e-mailben linket küldesz az ügyfélnek.
   - Kis cégnek is jó. Vigyázz: 2024-ben MNB-bírságot kapott, és nem írják ki, hogy a vállalkozói számlák is mennek-e.
2. **Enable Banking (Finnország).** Az ő engedélyük alatt dolgozhatsz.
   - A hivatalos magyar oldaluk: OTP (magán és üzleti), K&H, Raiffeisen, MBH (3 külön bekötés).
   - A 2025–26-os változásnaplóik szerint karbantartják ezeket is: Erste, UniCredit, CIB, MagNet, Gránit, Wise. A magyar Revolutnál csak fizetés látszik.
   - Új ügyfelet vállalnak (2026-ban van árajánlatkérő űrlap). Az ár forgalomarányos, havi minimumdíjjal, nem nyilvános.
   - A saját számláiddal ingyen kipróbálhatod. Ügyfeleknek csak szerződés és cégellenőrzés után nyithatod meg.
   - Az ügyfél jóváhagyása a legtöbb banknál 180 napig él.
3. **finAPI (Németország).** Magyarország szerepel náluk, üzleti számlákkal együtt. A banklistát csak kérésre adják (2023-ban a magyar bankok 67%-át fedték le).
   - Csak nekik van nyilvános áruk: 200 ügyfélig kb. 100 € + 200 € licencdíj + esetleg 20 € = **kb. 320 €/hó**. Van 30 napos próba.
4. **Salt Edge.** Kölcsönadja az engedélyét. 2020-ban ez kötötte a Billingót 9 magyar bankhoz. Ma nincs nyilvános magyar lista és ár, ezért csak harmadikként kérdezd.

Ezek nem jók:
- **GoCardless:** új regisztráció LEZÁRVA.
- **Tink, Yapily, TrueLayer, Plaid:** nincs bizonyíték, hogy Magyarországon működnek; a Yapily saját listáján nincs rajta.
- **Token.io:** sok magyar bank van a térképén, de nem derül ki, hogy adatlekérés is megy-e.
- **Számlázz.hu és Billingo:** van saját MNB-engedélyük, de nem láttam, hogy másnak árulnák.

**2. Ki kit használ**
- **Novitax könyvelőprogram:** Aggreg8 (a hivatalos súgójuk szerint a könyvelő egyedi linket küld az ügyfélnek).
- **Számlázz.hu Autokassza:** saját engedély. Bankok: CIB, K&H, MagNet, 3× MBH, OTP, UniCredit, Wise. Erste, Raiffeisen, Revolut, Gránit NINCS.
- **Billingo:** 2020-ban Salt Edge, ma valószínűleg saját engedély (ezt csak az MNB-listából gondolom). Egy szponzorált cikk szerint ezeket a bankokat köti be: Erste, K&H, MBH, OTP, Raiffeisen, Revolut, Wise.
- **Bankmonitor:** Aggreg8 (2022-es adat).
- **Koin app (Bank360):** azt írja, saját engedélye van, és a Mastercarddal dolgozik. Az MNB listáján nincs rajta, ezért bizonytalan.

**3. Kiváltja a hivatalos PDF-kivonatot?**
Nem teljesen. A bank csak a tételeket adja át (dátum, összeg, partner, közlemény), aláírt kivonatot nem. A NAV 2026-os tájékoztatója szerint viszont az átalányadós vállalkozó, ha nem von le áfát, csak bevételi nyilvántartást vezet, ehhez kivonat nem kötelező. Ha mégis kell (például NAV-ellenőrzésnél), az ügyfél letölti a bankjától.
Korlátok:
- Az első lekérés kb. 90 napra megy vissza.
- Az ügyfélnek 90 vagy 180 naponta újra jóvá kell hagynia a bankjában.
- Sok vállalkozó magánszámlát használ, ezért a magán- és az üzleti számlának is mennie kell.

**4. Javaslat és a te teendőid**
Először az **Aggreg8**-tól és az **Enable Banking**-től kérj ajánlatot. Ezeket kérdezd meg:
- Melyik bank működik ma élesben magán- ÉS vállalkozói számlával? Megy-e a Revolut és a Wise?
- Mennyi a havi minimumdíj, és mennyi az ár 50 és 200 ügyfélnél?

Ezeket neked kell intézned, én senkit nem keresek meg:
- Felveszed velük a kapcsolatot, megkötöd a szerződést, átmész a cégellenőrzésükön.
- Adatvédelem: kell egy adatkezelési tájékoztató és egy adatfeldolgozói szerződés a szolgáltatóval, és ezt bele kell írni az ügyfélszerződésbe is.
- MNB: ha a szolgáltató engedélye alatt mész, saját bejegyzés valószínűleg nem kell (a Billingo 2020-ban így ment). Ezt egy ügyvéd vagy egy MNB-konzultáció erősítse meg. Saját engedély: 2 millió Ft díj + kötelező biztosítás, ez most nem éri meg.

---
SOURCES (checked 2026-11-19)
- MNB AIS/PIS provider list (updated 2026-04-15) [official]: https://www.mnb.hu/penzforgalom/a-nyilt-bankolashoz-kapcsolodo-penzforgalmi-szolgaltatok-es-harmadik-fel-szolgaltatok-adatai/szamlainformacios-es-fizetes-kezdemenyezesi-szolgaltatast-nyujto-penzforgalmi-szolgaltatok
- Aggreg8 bank logos, API and dashboard, no prices [secondary, vendor]: https://aggreg8.io/ and https://aggreg8.io/businesses
- Aggreg8 MNB supervisory decision 2024 (title only) [uncertain]: https://alk.mnb.hu/data/cms2627629/keksz_43900230.pdf
- Novitax B-API uses Aggreg8, 180-day consent, 90 days back, unique client link [official]: https://tudastar.novitax.hu/bankszamla-szinkronizalasa-b-api-program-hasznalatahoz/?pdf=14532
- Enable Banking Hungary page [official]: https://enablebanking.com/docs/markets/hu/
- Enable Banking FAQ (volume pricing, monthly minimum, 180 days, business accounts, contract and KYB) [official]: https://enablebanking.com/docs/faq
- Enable Banking changelogs (Gránit and MBH Dec 2025; UniCredit Mar 2026; Erste and MBH Jun 2026; Erste, UniCredit and Wise Jul 2025) [official]: https://enablebanking.com/blog/2026/01/15/enable-banking-changelog-december-2025 , https://enablebanking.com/blog/2026/04/08/enable-banking-changelogmarch-2026 , https://enablebanking.com/blog/2026/07/08/enable-banking-changelog-june-2026 , https://enablebanking.com/blog/2025/08/22/changelog-july-2025
- Enable Banking CIB, MagNet and Revolut HU entries (seen only in search snippets) [uncertain]: https://enablebanking.com/blog/2025/11/05/enable-banking-changelog-october-2025
- Enable Banking free restricted mode [official, from earlier research, not re-opened]: https://enablebanking.com/docs/api/linked-accounts/
- finAPI prices [official]: https://www.finapi.io/en/prices/
- finAPI country coverage, Hungary AIS [official]: https://finapi.io/en/products/country-coverage
- finAPI Hungary 67% of banks, Sept 2023 [secondary, old]: https://thepaypers.com/payments/company-information/finapi
- Salt Edge Partner Program (no HU list, no price) [official]: https://www.saltedge.com/products/account_information/partner_program
- Salt Edge and Billingo, 2020, 9 HU banks [official, outdated]: https://blog.saltedge.com/billingo-salt-edge-open-banking/
- GoCardless sign-ups disabled [official]: https://bankaccountdata.gocardless.com/new-signups-disabled
- Token.io coverage (HU banks listed, AIS status per bank unclear) [uncertain]: https://token.io/coverage
- Yapily coverage, no Hungary [official, from earlier research, not re-opened]: https://yapily.com/coverage
- Számlázz.hu Autokassza banks and 90/180-day renewal [official]: https://tudastar.szamlazz.hu/en/gyik/autokassza-bank-integration
- Billingo Bankszinkron bank list (sponsored by BinX, updated 2026-06-01) [secondary]: https://biztosdontes.hu/cikkek/vallalkozoi-mobilbank-amit-a-konyvelod-is-hasznalhat
- Raiffeisen guide for Billingo Bankszinkron, 90 days back [official, undated]: https://www.raiffeisen.hu/documents/10423/0/Bankszinkron_Raiffeisen_Billingo.pdf
- Bankmonitor uses Aggreg8 (2022) [official, may be outdated; earlier research, not re-opened]: https://bankmonitor.hu/mediatar/cikk/uj-folyamat-a-babavaronal-bekerjuk-helyetted-a-szamlakivonatot/
- Bank360 Koin (banks, licence claim H-EN-I-460/2024, not on MNB list) [uncertain]: https://bank360.hu/bank360-koin
- NAV 2026 átalányadó guide, section 5: only a revenue record is required [official]: https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fnezzen-utana%2Finf_fuz%2F2026%2F100.-az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-01.-14
- OTP authenticated e-statements (e-signature and time stamp) [official]: https://www.otpbank.hu/portal/hu/mkv/egyeb/hiteles-elektronikus-kivonatok
- MNB fee for AIS-only registration, HUF 2,000,000 (decree 23/2026) [official, earlier research]: https://njt.jog.gov.hu/eli/R/2026/MNB/23
- AIS-only firms: notification instead of licence, and insurance duty (Fsztv. 20/A, 13/A) [official, earlier research]: https://njt.jog.gov.hu/jogszabaly/2013-235-00-00
