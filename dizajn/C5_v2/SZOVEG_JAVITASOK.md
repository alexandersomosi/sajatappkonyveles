# Szövegjavítások a v2 képernyőkön (11-20)

Ellenőrzés: OpenRouter `google/gemini-3.8-flash` (3.8 Lite nincs; 86 képernyő, 91 javaslat + 8 egységességi tétel, 0,50 $), utána kézi bírálat.
A k8-ban (az app átépítésekor) ugyanezeket a szövegeket kell a valódi appban (kod/app) is így írni.

## Elfogadott javítások

| Képernyő | Eredeti | Javított |
|---|---|---|
| 01_fooldal | számlázhatsz ÁFA nélkül. Ennyi fér még az alanyi ÁFA-mentességbe. | ennyit számlázhatsz még ÁFA nélkül, az alanyi ÁFA-mentesség keretén belül. |
| 01_fooldal | bevételed jött be idén eddig. | bevételed volt idén eddig. |
| 10_belepes | Pár perc, és bekötünk. | Pár perc, és kész is vagy. |
| mind | Nézd meg a levélszemét mappát | Nézd meg a Spam (levélszemét) mappát |
| mind | tartalék kód | tartalékkód |
| 20_bevezeto | Betöltjük a lépéseidet | Betöltjük az adataidat |
| 21_udv* | Szia Péter! | Szia, Péter! |
| 21_udv* | A könyvelődnek az appban írsz | A könyvelődnek az appban írhatsz |
| 21_udv* | Szerződés és engedély a NAV-nál | Szerződés, majd meghatalmazás a NAV-nál |
| 24_var | most jóváhagyja | most hagyja jóvá |
| 24_var | Tovább: A kártyád megadása | Tovább: a kártyád megadása |
| 31_bekotes_adatok | 1. lap a 3-ból | 1. lépés a 3-ból |
| 33_bekotes_azonositas | Melyik igazolvánnyal azonosítasz? | Melyik igazolvánnyal azonosítod magad? |
| 33_bekotes_azonositas | Kártya formátumú | Kártyaformátumú |
| 36_bekotes_szerzodes | Általános Szerződési Feltételeket | általános szerződési feltételeket |
| 36_bekotes_szerzodes | Milyen adatodat | Milyen adataidat |
| 36_bekotes_szerzodes | az Adatkezelési tájékoztatót | az adatkezelési tájékoztatót |
| 36_bekotes_szerzodes | a Megbízási szerződést | a megbízási szerződést |
| 42_vallalkozas* | Mutasd mind | Mutasd mindet |
| 44_vallalkozas_engedely | Előre dátumot nem lehet megadni. | Jövőbeli dátumot nem lehet megadni. |
| 45_vallalkozas_feltoltes | DÁP alkalmazással | DÁP-alkalmazással |
| 46_vallalkozas_kamara | A kamarai tagsággal évi | A kamarai regisztrációval évi |
| mind | Vissza a Főoldalra | Vissza a főoldalra |
| 47_vallalkozas_utmutato | Itt választod ki, hogy nem kell ÁFÁ-t felszámolnod. | Itt választod ki, hogy ÁFA nélkül számlázhass. |
| 47_vallalkozas_utmutato | ha kimarad, idén ÁFÁ-t kell felszámolnod. | ha kimarad, idén nem számlázhatsz ÁFA nélkül. |
| 47_vallalkozas_utmutato | Így nem kell ÁFÁ-t felszámolnod, amíg | Így ÁFA nélkül számlázhatsz, amíg |
| 47_vallalkozas_utmutato | Hagyd | Hagyd üresen |
| 52_fizesd_ki | A(z) 2026. 10. 01.–10. 31. havidíja. | A 2026. októberi havidíjad. |
| 52_fizesd_ki | ezért most kézzel kell kifizetned. | ezért most itt kell kifizetned. |
| 52_fizesd_ki | Fizesd ki (19 999 Ft) | Kifizetem (19 999 Ft) |
| 83_dijak | Fizetek (4 999 Ft) | Kifizetem (4 999 Ft) |
| 53_hataridok | Feliratkozom a naptáramban | Hozzáadom a naptáramhoz |
| mind | az SZJA-t | az szja-t |
| mind | SZJA-előleg | szja-előleg |
| mind | SZJA, TB-járulék, szocho | Szja, TB-járulék, szocho |
| mind | SZJA-bevallás | Szja-bevallás |
| mind | kevesebb SZJA, | kevesebb szja, |
| 54_kereset | Ha így folytatod: kb. 19 400 000 Ft bevételből, kb. 1 980 000 Ft adóval. | Ha így folytatod, kb. 19 400 000 Ft bevételed lesz, és kb. 1 980 000 Ft adót fizetsz. |
| 56_ertesitesek | Megnézte az októberi számláidat, szólt, ha kérdése van. | Megnézte az októberi számláidat. Ha kérdése lesz, szól. |
| 56_ertesitesek | Mikről kérsz | Miről kérsz |
| 57_valtozott | Kezdtél munkaviszonyt? | Elkezdtél alkalmazottként is dolgozni? |
| 60_dosszie | Szja-előleg bevallás | Szja-előleg kiszámítása |
| 65_feltoltes | nyugta, levél, vagy kézzel | nyugta, levél vagy kézzel |
| 66_igazolasok | Kész igazolást itt letöltheted. | A kész igazolást itt töltheted le. |
| 67_igazolas | csak ebben a fájlban hiteles | csak elektronikus formában hiteles |
| 68_igazolas_uj* | áll rólad | szerepel rólad |
| mind | Most a Főoldalon látod | Most a főoldalon látod |
| mind | a Főoldalon | a főoldalon |
| 73_helyettunk | Ezen a számon hívjunk | Ezen a számon hívjunk? |
| 73_helyettunk | Megkapod az adószámodat. | Kiadja az adószámodat. |
| 73_helyettunk | Mentsd el a profilomba is | Mentsd el a fiókomba is |
| 75_keres_uj* | Bank, hitel, albérlet, ösztöndíj szokta kérni. | Hitelhez, albérlethez, ösztöndíjhoz kérik. |
| 75_keres_uj* | nem fér egy üzenetbe | nem fér bele egy üzenetbe |
| 76_jogi | Általános Szerződési Feltételek | Általános szerződési feltételek |
| 80_fiok | Amit rólad tárolunk, és a letöltésük | Amit rólad tárolunk, és hogyan töltheted le |
| 81_adataim | holnap 14:20-ig | Holnap 14:20-ig |
| 82_biztonsag | egymagában | önmagában |
| 82_biztonsag | (ez) | (ez az eszköz) |
| 85_elofizetes | Él | Aktív |
| 86_ertesitesi_beallitasok | Ha még hiányzik egy hónap iratai közül. | Ha egy hónap iratai közül még hiányzik valami. |
| 86_ertesitesi_beallitasok | Most hív kollégánk | Most hív a kollégánk |
| 87_ketlepcsos* | jelszavadat is megkérjük | jelszavadat is elkérjük |
| 87_ketlepcsos* | Mind kimásolom | Mindet kimásolom |
| 88_fiok_torlese | Sajnáljuk, hogy mész. | Sajnáljuk, hogy elmész. |
| 88_fiok_torlese | Miért mész? | Miért mész el? |
| 88_fiok_torlese | Stripe-nél | Stripe-nál |
| 88_fiok_torlese | 30 napig meggondolhatod: | 30 napig meggondolhatod magad: |
| 88_fiok_torlese | amit a törvény nem kötelez megőrizni | amit a törvény szerint nem kötelező megőrizni |
| 90_valtozas | munkaviszonyt kezdesz vagy befejezel | munkaviszonyod kezdődik vagy megszűnik |
| 91_valtozas_engedely | mielőtt engedélyezel | mielőtt engedélyt adsz |
| 93_valtozas_kerem* | Így megy | Így működik |
| 94_valtozas_utmutato | Válaszd | Válaszd ki |
| 94_valtozas_utmutato | előre fizetve | előre kell fizetni |
| 96_eves_kerdoiv | Ingatlant vagy autót adtam el | Ingatlan vagy autó eladása |
| 96_eves_kerdoiv | Külföldről | Külföldi jövedelem |
| 97_kedvezmenyek | kevesebb adót fizetsz. | kevesebb adót fizettél. |
| 97_kedvezmenyek | Kérdése van | Kérdés érkezett |
| 34_bekotes_elofizetes | Havi díj | Havidíj |

## Elvetett javaslatok (miért)

- „6 jegyű” → „6-jegyű”: számjeggyel írt számnév után a -jegyű különírandó (6 jegyű), a javaslat hibás.
- „Erősítsd meg az e-mail-címed.” → felkiáltójel: a címek az appban egységesen ponttal zárulnak.
- „bemutató videó” → „bemutatóvideó”: mindkét írásmód elfogadható, maradt.
- „Ha a bankod megerősítést kér, ott adod meg.”: természetes magyar mondat, maradt.
- Vaku „auto”: a fényképezőkben bevett felirat, maradt.
- „Kovács Bence , a könyvelőd”, „Ft ,”, „Ft -ot”, „Még nincs oldal Tedd”, „ÁFA mentes”: a szövegkinyerés hibája (a képernyőn helyes), nem valós hiba.
- „A bekötés általában” (visszahívás témája): érthető választási lehetőség, maradt.
- Igazolások hivatalos neve (KOMA / nullás igazolás): tartalmi kérdés, a könyvelővel kell egyeztetni.
- Visszahívás-gombok egységesítése: a kártyákon a rövid „Visszahívás” marad (jóváhagyott főoldal).

## Egységesítési döntések

- szja: kisbetűvel (mondat elején „Szja”), mint a NAV-nál; nem SZJA.
- ÁFA: nagybetűvel marad (ÁFA nélkül, ÁFA-mentesség); a toldalékos „ÁFÁ-t” alakot kerüljük, átfogalmazzuk.
- főoldal: mondat közben kisbetűvel; havidíj: egybe; fiók (nem profil); fizetés gomb: „Kifizetem (… Ft)”.
