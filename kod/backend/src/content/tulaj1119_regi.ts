// SPEC §27.7.3 (3): content keys whose DEFAULT changed in §27 → the OLD default text, word for word (generated from
// kod/_regi/shared_src_elotte_tulaj1119 + the content files before 11-19). The data step updates a live content_texts
// override only if it still equals this old text; content.ts lets a jogi text that still equals it be superseded.
// Regenerate only together with a new §27 wording change.
export const TULAJ1119_REGI: Record<string, string> = {
  "bekotes.magyarazat.adoszam.miert": "Ezen a számon fut a vállalkozásod a NAV-nál. Ezzel kérjük le a számláidat, és ezt írod a befizetéseid közleményébe.", // szándékos: régi szöveg
  "bekotes.magyarazat.alanyi_afa_mentesseg.mi": "Ha az éves bevételed nem éri el a 20 millió forintot (2026), nem kell ÁFÁ-t felszámolnod és ÁFA-bevallást adnod.", // szándékos: régi szöveg
  "bekotes.magyarazat.jogallas.hol": "Mellékállású vagy, ha mellette legalább heti 36 órás munkaviszonyod van, vagy nappali tagozaton tanulsz. Nyugdíj mellett akkor vagy, ha már saját jogú nyugdíjas vagy. Minden más esetben főállású vagy.", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_bekotes.cim": "Számlák bekötése", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_bekotes.hol": "Neked ezzel nincs teendőd, ezt {firstName} intézi, ha megvan a meghatalmazás.", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_bekotes.mi": "{firstName} összeköti a fiókodat a NAV Online Számlával, hogy a kiállított számláid maguktól megérkezzenek.", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_bekotes.miert": "Így nem kell egyenként feltöltened a számláidat, és mindig látod, mennyit kell fizetned.", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_igazolas_pdf.cim": "A NAV-os igazolás", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_igazolas_pdf.hol": "A bejelentés végén, a „Megtekintés” lapon tudod letölteni. Ha elmentetted a telefonodra, a letöltések között találod. Fotó is jó, ha minden olvasható rajta.", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_igazolas_pdf.mi": "A bejelentés után a Vállalkozói Ügysegéd egy értesítést ad PDF-ben arról, hogy beküldted.", // szándékos: régi szöveg
  "bekotes.magyarazat.nav_meghatalmazas.hol": "Az ONYA-ban adod meg (onya.nav.gov.hu), Ügyfélkapu+-szal vagy DÁP-pal. Lépésről lépésre megmutatjuk, videóval és képekkel. Kb. 5 perc.", // szándékos: régi szöveg
  "bekotes.magyarazat.szuletesi_adatok.cim": "Születési adatok, anyád neve", // szándékos: régi szöveg
  "bekotes.magyarazat.szuletesi_adatok.hol": "A személyi igazolványodon. Ha a NAV-os űrlapon valami nem stimmel, ne ott javítsd: fordulj a NAV-hoz.", // szándékos: régi szöveg
  "bekotes.magyarazat.szuletesi_adatok.mi": "A születési neved, a születési helyed és időd, anyád születési neve és az állampolgárságod.", // szándékos: régi szöveg
  "bekotes.magyarazat.szuletesi_adatok.miert": "A bejelentésben a törvény kéri. A NAV-os űrlap általában maga kitölti a nyilvántartásból, neked csak át kell nézned. Mi ezeket nem kérjük el ehhez.", // szándékos: régi szöveg
  "bekotes.magyarazat.taj_szam.miert": "A NAV-os bejelentéshez kell. Mi nem kérjük el és nem tároljuk: a bejelentésbe te írod be, ha a képernyő kéri.", // szándékos: régi szöveg
  "bekotes.magyarazat.ugyfelkapu_dap.miert": "Ezzel lépsz be a NAV oldalaira. Így te magad jelentheted be a vállalkozásodat, és te adhatod meg a meghatalmazást.", // szándékos: régi szöveg
  "bekotes.magyarazat.vallalkozas_van_e.hol": "Ha nem tudod biztosan, nézd meg egy korábbi számládat vagy a NAV leveleit. Ha így sem világos, kérj visszahívást, és megnézzük együtt.", // szándékos: régi szöveg
  "bekotes.magyarazat.vallalkozas_van_e.miert": "Ha már van vállalkozásod, átvesszük a könyvelését. Ha még nincs, lépésről lépésre megmutatjuk, mit hova jelölj, és te magad jelented be. Kb. negyedóra az egész.", // szándékos: régi szöveg
  "bekotes.magyarazat.vallalkozoi_ugyseged.mi": "A NAV internetes felülete, ahol egyéni vállalkozást lehet bejelenteni. 2026 februárja óta itt kell intézni. Mobilon is jól használható.", // szándékos: régi szöveg
  "bekotes.magyarazat.varhato_bevetel.miert": "ÁFA nélkül, alanyi adómentesen évi 20 millió forintig dolgozhatsz (2026). Szolgáltatásunk most az ÁFA-mentes vállalkozóknak szól. Átalányadózóként 2026-ban legfeljebb 38 736 000 Ft lehet az éves bevételed; ha év közben indulsz, ez arányosan kevesebb.", // szándékos: régi szöveg
  "bekotes.zarolt.nav_bekotes": "Ha megvan az adószámod, a könyvelőd beköti a számláidat.", // szándékos: régi szöveg
  "korlatozott.dosszie": "A bekötés után nyílik meg. Akkor ide kerülnek a számláid a NAV-tól és az irataid.", // szándékos: régi szöveg
  "korlatozott.nav_szamlak": "A bekötés után nyílik meg. A számláidat a NAV-meghatalmazás után kérjük le.", // szándékos: régi szöveg
  "notif.callback_received.body": "Kollégánk 24–48 órán belül hív a {phoneMasked} számon. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat.", // szándékos: régi szöveg
  "notif.registration_checked.body": "Átnéztük a NAV-os igazolást. Ha megjött az adószámod, írd be az alkalmazásban.", // szándékos: régi szöveg
  "notif.registration_done.body": "Rögzítettük az adószámodat. Jöhet a következő lépés: a NAV-meghatalmazás, lépésről lépésre segítünk.", // szándékos: régi szöveg
  "notif.registration_reminder.adatlap.title": "Folytasd az adatlapot", // szándékos: régi szöveg
  "notif.registration_submitted.title": "{clientName} feltöltötte a NAV-os igazolást", // szándékos: régi szöveg
  "vallalkozas.allapot.beadva": "Megkaptuk a NAV-os igazolást. Átnézzük, és szólunk, ha minden rendben.", // szándékos: régi szöveg
  "vallalkozas.allapot.ellenorizve": "Rendben van a bejelentésed. Várjuk az adószámodat. Ha megjött, írd be te is.", // szándékos: régi szöveg
  "vallalkozas.allapot.kitoltes": "Még nem küldted el az adataidat. Bármikor folytathatod, ahol abbahagytad.", // szándékos: régi szöveg
  "vallalkozas.allapot.utmutato": "Kész a személyre szabott útmutatód. Kövesd lépésről lépésre, és küldd be a bejelentést a NAV-nak.", // szándékos: régi szöveg
  "vallalkozas.hint.jarulek_fo": "Főállásban akkor is fizetsz havonta legalább {amount} járulékot (TB + szocho), ha kevés a bevételed. Negyedévente egyben utalod.", // szándékos: régi szöveg
  "visszahivas.csalas": "Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban.", // szándékos: régi szöveg
};
