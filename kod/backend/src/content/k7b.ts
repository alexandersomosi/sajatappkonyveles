// k7b (tulaj 11-20, dizajn/email/LEVEL_LEFEDETTSEG.md 3. pont 1–13 + SZOVEG_JAVITAS_LEVELEK.md): the texts of the new
// e-mails and of the in-app notifications that go with them. Editable like every content text (/admin/szovegek, DB
// rows in content_texts override them). Direct e-mails (sendTemplateMail) greet and sign like the other system mails;
// e-mails sent through a notification (NotifyInput.emailKey) get the link and the footer from the dispatcher.

/** email.<key>.subject|body (+ .<variant>.subject|body) and the notif.* rows of the new events. */
export const K7B_TEXTS: Record<string, string> = {
  // 1) Felmondás – the PDF letter attached (konzol-muveletek.ts terminateClient)
  'email.contract_terminated.subject': 'Felmondtuk a szerződésedet',
  'email.contract_terminated.body':
    'Szia {firstName}!\n\nA szerződésed {datum} napjával megszűnik, addig minden a megszokott módon megy tovább. A részleteket a csatolt felmondó levélben olvasod; az appban, a Dossziéban is megtalálod.\n\nHa kérdésed van, írj nekünk az appban, az Üzenetek fülön.\n\n{brand}',
  'email.contract_terminated.azonnali.subject': 'Felmondtuk a szerződésedet',
  'email.contract_terminated.azonnali.body':
    'Szia {firstName}!\n\nA szerződésed ma megszűnt. Az okát és az elszámolást a csatolt felmondó levélben olvasod; az appban, a Dossziéban is megtalálod.\n\nMostantól a könyvelőd nem intézi az adóügyeidet. Ha a vállalkozásod tovább működik, a bevallásaidról és a befizetéseidről innentől neked kell gondoskodnod, vagy megbízhatsz vele egy másik könyvelőt.\n\n{brand}',
  'email.contract_terminated.ugyfel_kerte.subject': 'Megszűnik a szerződésed',
  'email.contract_terminated.ugyfel_kerte.body':
    'Szia {firstName}!\n\nAhogy kérted, a szerződésed {datum} napjával megszűnik, addig minden a megszokott módon megy tovább.\n\nA felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod. Ha kérdésed van, írj nekünk az appban, az Üzenetek fülön.\n\n{brand}',
  'email.contract_terminated.ugyfel_kerte_azonnal.subject': 'Megszűnt a szerződésed',
  // no refund (nothing was paid for the running period, or the refund could not be started – the letter shows the settlement)
  'email.contract_terminated.ugyfel_kerte_azonnal.body':
    'Szia {firstName}!\n\nAhogy kérted, a szerződésed ma megszűnt. Az elszámolást a csatolt felmondó levélben olvasod; az appban, a Dossziéban is megtalálod.\n\nMostantól a könyvelőd nem intézi az adóügyeidet. Ha a vállalkozásod tovább működik, a bevallásaidról és a befizetéseidről innentől neked kell gondoskodnod, vagy megbízhatsz vele egy másik könyvelőt.\n\n{brand}',
  // the pro-rata refund (ÁSZF 8.3) was started at the payment provider
  'email.contract_terminated.ugyfel_kerte_azonnal_visszaterites.subject': 'Megszűnt a szerződésed',
  'email.contract_terminated.ugyfel_kerte_azonnal_visszaterites.body':
    'Szia {firstName}!\n\nAhogy kérted, a szerződésed ma megszűnt. A kifizetett időszakodból hátralévő napok díját, {osszeg} Ft-ot visszatérítjük a kártyádra. A részleteket a csatolt felmondó levélben olvasod; az appban, a Dossziéban is megtalálod.\n\nMostantól a könyvelőd nem intézi az adóügyeidet. Ha a vállalkozásod tovább működik, a bevallásaidról és a befizetéseidről innentől neked kell gondoskodnod, vagy megbízhatsz vele egy másik könyvelőt.\n\n{brand}',

  // 2) Új üzenet (notify message_new, emailKey) – at most one a day per client
  'email.message_new.subject': '{firstName} üzenetet küldött',
  'email.message_new.body': 'Új üzeneted van. Az appban, az Üzenetek között olvashatod, és ott válaszolhatsz is rá.',
  'email.message_new_ugyfelszolgalat.subject': 'Új üzeneted jött az ügyfélszolgálattól',
  'email.message_new_ugyfelszolgalat.body': 'Új üzeneted van. Az appban, az Üzenetek között olvashatod, és ott válaszolhatsz is rá.',

  // 3) NAV-hiba (navsync.ts) – to the accountant and the admins, once per failure
  'email.nav_hiba.subject': 'NAV-hiba: {clientName} számlái nem jönnek',
  'email.nav_hiba.body':
    'Szia!\n\n{clientName} NAV-lekérdezése nem sikerült: {hiba}. Ilyenkor általában megváltozott a technikai felhasználó jelszava vagy kulcsa, vagy elvették a jogosultságát az Online Számlában.\n\nAdd meg újra az adatait az ügyfél adatlapján, a Bekötés fülön (NAV-kapcsolat → Új adatok megadása). Amíg nem javítod, a napi lekérdezés kihagyja ezt az ügyfelet, és az új számlái nem töltődnek le.\n\n{brand}',
  'email.nav_hiba.admin.subject': 'NAV-hiba: {clientName} számlái nem jönnek',
  'email.nav_hiba.admin.body':
    'Szia!\n\n{clientName} NAV-lekérdezése nem sikerült: {hiba}. A technikai felhasználó adatait a könyvelője adja meg újra az ügyfél adatlapján, a Bekötés fülön (NAV-kapcsolat → Új adatok megadása). Ha az ügyfélnek nincs könyvelője, rendeld hozzá valakihez. Amíg nincs javítva, a napi lekérdezés kihagyja ezt az ügyfelet.\n\n{brand}',

  // 4–5) Megszűnt az előfizetés (the period end, or the admin set "megszűnt")
  'notif.subscription_canceled.megszunt.title': 'Megszűnt az előfizetésed',
  'notif.subscription_canceled.megszunt.body': 'Az előfizetésed {datum} napjával megszűnt, több díjat nem vonunk le. Az irataidat továbbra is megnézheted és letöltheted.',
  'email.subscription_ended.subject': 'Megszűnt az előfizetésed',
  'email.subscription_ended.body':
    'Az {brand}-előfizetésed {datum} napjával megszűnt, több díjat nem vonunk le.\n\nMostantól a könyvelőd nem intézi az adóügyeidet. Ha a vállalkozásod tovább működik, a bevallásaidról és a befizetéseidről innentől neked kell gondoskodnod, vagy megbízhatsz vele egy másik könyvelőt.\n\nAz irataidat az appban továbbra is megnézheted és letöltheted.',
  'notif.assist_task.megszunt.title': 'Megszűnt: {clientName}',
  'notif.assist_task.megszunt.body': 'Megszűnt az előfizetése ({datum}). Vond vissza a meghatalmazást a NAV-nál (8 napon belül), és az Online Számla rendszerben tiltsd le a technikai felhasználót.',
  'email.subscription_ended_konyvelo.subject': 'Megszűnt: {clientName}',
  'email.subscription_ended_konyvelo.body':
    '{clientName} előfizetése {datum} napjával megszűnt. Vond vissza a meghatalmazást a NAV-nál (8 napon belül), és az Online Számla rendszerben tiltsd le a technikai felhasználót.',

  // 6) A felmondás hatályba lépett (the 06:10 job)
  'notif.contract_terminated.hatalyos.title': 'Megszűnt a szerződésed',
  'notif.contract_terminated.hatalyos.body': 'Ma lépett hatályba a felmondás, a szolgáltatás véget ért. A felmondó levelet és az irataidat a Dossziéban továbbra is megtalálod.',
  'email.contract_terminated_hatalyos.subject': 'Megszűnt a szerződésed',
  'email.contract_terminated_hatalyos.body':
    'Ma lépett hatályba a felmondás: a szerződésed megszűnt, és több díjat nem vonunk le.\n\nMostantól a könyvelőd nem intézi az adóügyeidet. Ha a vállalkozásod tovább működik, a bevallásaidról és a befizetéseidről innentől neked kell gondoskodnod, vagy megbízhatsz vele egy másik könyvelőt.\n\nA felmondó levelet és az irataidat az appban, a Dossziéban továbbra is megtalálod és letöltheted.',

  // 7) Fióktörlés visszavonva
  'email.account_deletion_cancelled.subject': 'Visszavontad a fiókod törlését',
  'email.account_deletion_cancelled.body':
    'Szia!\n\nA fiókod megmarad, ugyanúgy használhatod.\n\nHa nem te voltál, állíts be új jelszót az appban az „Elfelejtettem a jelszavam” gombbal, és írj nekünk.\n\n{brand}',
  'email.account_deletion_cancelled.elofizetes.body':
    'Szia!\n\nA fiókod megmarad, ugyanúgy használhatod.\n\nAz előfizetésed viszont lemondva maradt: a kifizetett időszak végéig minden megy tovább, utána leáll. Ha maradnál, a Fiók → Előfizetés alatt nyomd meg a „Mégis maradok” gombot: {appUrl}/fiok/elofizetes\n\nHa nem te voltál, állíts be új jelszót az appban az „Elfelejtettem a jelszavam” gombbal, és írj nekünk.\n\n{brand}',

  // 8) Fiók törölve (the address is read before the pseudonymisation)
  'email.account_deleted.subject': 'Töröltük az {brand}-fiókodat',
  'email.account_deleted.body':
    'Szia!\n\nA kérésedre töröltük az {brand}-fiókodat, ezzel a címmel már nem tudsz belépni. Amit a törvény szerint meg kell őriznünk (például a számlákat és a könyvelési iratokat), azt a megőrzési idő végéig zárolva tároljuk, utána töröljük.\n\nHa később újra használnád, bármikor regisztrálhatsz.\n\n{brand}',

  // 9) Adatmásolat hiba
  'email.export_failed.subject': 'Nem készült el az adataid másolata',
  'email.export_failed.body': 'Szia!\n\nHiba történt az adataid másolatának készítésekor. Már dolgozunk rajta, és szólunk, amint letölthető. Neked nem kell újra kérned.\n\n{brand}',
  'email.export_failed_admin.subject': 'Nem készült el az adatmásolat: {clientName}',
  'email.export_failed_admin.body':
    'Szia!\n\n{clientName} adatmásolata nem készült el, és a rendszer magától nem próbálja újra. A kérés napja: {datum}; a GDPR szerint a kéréstől számított egy hónapon belül teljesíteni kell. Indíts új másolatot a konzolban, az ügyfél kártyáján az „Adatexport (GDPR)” művelettel; ha az is elakad, a hiba okát a szerver naplójában találod.\n\n{brand}',

  // 10) Már van fiókod (the sign-up answer is the same for a new and an existing address)
  'email.account_exists.subject': 'Már van fiókod az {brand}ban',
  'email.account_exists.body':
    'Szia!\n\nMost valaki ezzel az e-mail-címmel próbált regisztrálni, de ehhez a címhez már tartozik fiók nálunk. Ezért új fiókot nem nyitottunk, és kódot sem küldtünk.\n\nHa te voltál, lépj be a meglévő fiókodba. Ha nem emlékszel a jelszavadra, a belépésnél kérj újat az „Elfelejtettem a jelszavam” gombbal: {appUrl}\n\nHa nem te voltál, nincs teendőd: a fiókodhoz ezzel senki nem fért hozzá.\n\n{brand}',
  // an earlier sign-up whose code was never typed in: signing in with that password sends a new code (auth.ts /login)
  'email.account_exists.megerositetlen.body':
    'Szia!\n\nMost valaki ezzel az e-mail-címmel próbált regisztrálni, de ehhez a címhez már tartozik fiók nálunk, csak a regisztráció nincs befejezve. Ezért új fiókot nem nyitottunk.\n\nHa korábban te regisztráltál, lépj be az appban az akkor megadott jelszóval: ekkor küldünk egy új kódot, és azzal befejezheted a regisztrációt. Ha nem emlékszel a jelszóra, a belépésnél kérj újat az „Elfelejtettem a jelszavam” gombbal: {appUrl}\n\nHa nem te voltál, nincs teendőd.\n\n{brand}',

  // 11) Árkedvezmény visszavonva (notify price_changed, variant visszavonva)
  'notif.price_changed.visszavonva.title': 'Változik a havidíjad',
  'notif.price_changed.visszavonva.body': 'Megszűnt a kedvezményed, ezért {datum} napjától a havidíjad {osszeg} Ft. A részleteket a Fiók → Előfizetés alatt látod; ha kérdésed van, írj nekünk.',
  'email.price_discount_revoked.subject': 'Változik a havidíjad',
  'email.price_discount_revoked.body': 'Megszűnt a kedvezményed, ezért {datum} napjától a havidíjad {osszeg} Ft. A részleteket a Fiók → Előfizetés alatt látod; ha kérdésed van, írj nekünk az appban, az Üzenetek fülön.',

  // 12) Az ügyfélszolgálat törölte a mentett kártyát
  'email.card_deleted_by_admin.subject': 'Töröltük a mentett kártyádat',
  'email.card_deleted_by_admin.body':
    'Szia {firstName}!\n\nAz ügyfélszolgálat törölte a mentett bankkártyádat, ezzel semmit nem vontunk le róla. Hogy a következő havidíj levonása ne akadjon el, adj meg új kártyát a Fiók → Előfizetés alatt, a „Kártya megadása” gombbal: {appUrl}/fiok/elofizetes\n\nHa nem te kérted a törlést, vagy kérdésed van, írj nekünk az appban, az Üzenetek fülön.\n\n{brand}',
  'email.card_deleted_by_admin.lemondva.body':
    'Szia {firstName}!\n\nAz ügyfélszolgálat törölte a mentett bankkártyádat, ezzel semmit nem vontunk le róla. Az előfizetésed le van mondva, így kártya nem is kell hozzá: nincs teendőd.\n\nHa nem te kérted a törlést, vagy kérdésed van, írj nekünk az appban, az Üzenetek fülön.\n\n{brand}',
  // no running subscription yet (not started, or its first payment is still open)
  'email.card_deleted_by_admin.nincs_elofizetes.body':
    'Szia {firstName}!\n\nAz ügyfélszolgálat törölte a mentett bankkártyádat, ezzel semmit nem vontunk le róla. Amikor elindítod az előfizetésedet, a Fiók → Előfizetés alatt adhatsz meg új kártyát: {appUrl}/fiok/elofizetes\n\nHa nem te kérted a törlést, vagy kérdésed van, írj nekünk az appban, az Üzenetek fülön.\n\n{brand}',

  // 13) Igazolás nem adható ki (notify certificate_status, variant elutasitva)
  'email.certificate_rejected.subject': 'Nem tudjuk kiadni az igazolásodat',
  'email.certificate_rejected.body':
    '{firstName} nem tudta kiadni ezt az igazolást: {tipus}. Az oka: {ok}.\n\nHa már kifizetted a díját, visszatérítjük; ha még nem, már nem kell kifizetned. Ha kérdésed van, írj neki az appban, az Üzenetekben.',
};

export function k7bDefaults(): Record<string, string> {
  return { ...K7B_TEXTS };
}
