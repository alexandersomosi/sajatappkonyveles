// k7b (tulaj 11-20, dizajn/email/LEVEL_LEFEDETTSEG.md 3. pont 1–13 + SZOVEG_JAVITAS_LEVELEK.md): the texts of the new
// e-mails and of the in-app notifications that go with them. Editable like every content text (/admin/szovegek, DB
// rows in content_texts override them). Direct e-mails (sendTemplateMail) greet and sign like the other system mails;
// e-mails sent through a notification (NotifyInput.emailKey) get the link and the footer from the dispatcher.

/** email.<key>.subject|body (+ .<variant>.subject|body) and the notif.* rows of the new events. */
export const K7B_TEXTS: Record<string, string> = {
  // 1) Felmondás – the PDF letter attached (konzol-muveletek.ts terminateClient)
  'email.contract_terminated.subject': 'Felmondtuk a szerződésedet',
  'email.contract_terminated.body':
    'Szia {firstName}!\n\nA szerződésed {datum} napjával megszűnik, addig minden a megszokott módon megy tovább.\n\nA felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod.\n\n{brand}',
  'email.contract_terminated.azonnali.subject': 'Felmondtuk a szerződésedet',
  'email.contract_terminated.azonnali.body': 'Szia {firstName}!\n\nA szerződésed ma megszűnt.\n\nA felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod.\n\n{brand}',
  'email.contract_terminated.ugyfel_kerte.subject': 'Megszűnik a szerződésed',
  'email.contract_terminated.ugyfel_kerte.body':
    'Szia {firstName}!\n\nAhogy kérted, a szerződésed {datum} napjával megszűnik.\n\nA felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod.\n\n{brand}',
  'email.contract_terminated.ugyfel_kerte_azonnal.subject': 'Megszűnt a szerződésed',
  'email.contract_terminated.ugyfel_kerte_azonnal.body':
    'Szia {firstName}!\n\nAhogy kérted, a szerződésed ma megszűnt. A kifizetett hónapból hátralévő napok díját visszautaljuk.\n\nA felmondó levelet csatoltuk, és az appban, a Dossziéban is megtalálod.\n\n{brand}',

  // 2) Új üzenet (notify message_new, emailKey) – at most one a day per client
  'email.message_new.subject': '{firstName} üzenetet küldött',
  'email.message_new.body': 'Új üzeneted van. Az appban, az Üzenetek között olvashatod, és ott válaszolhatsz is rá.',
  'email.message_new_ugyfelszolgalat.subject': 'Új üzeneted jött az ügyfélszolgálattól',
  'email.message_new_ugyfelszolgalat.body': 'Új üzeneted van. Az appban, az Üzenetek között olvashatod, és ott válaszolhatsz is rá.',

  // 3) NAV-hiba (navsync.ts) – to the accountant and the admins, once per failure
  'email.nav_hiba.subject': 'NAV-hiba: {clientName} számlái nem jönnek',
  'email.nav_hiba.body':
    'Szia!\n\nA NAV-lekérdezés nem sikerült: {hiba}. Javítsd a technikai felhasználót az ügyfél adatlapján, a Bekötés fülön. Amíg nem javítod, a napi lekérdezés kihagyja ezt az ügyfelet.\n\n{brand}',
  'email.nav_hiba.admin.subject': 'NAV-hiba: {clientName} számlái nem jönnek',
  'email.nav_hiba.admin.body':
    'Szia!\n\n{clientName} NAV-lekérdezése nem sikerült: {hiba}. A könyvelőjének is szóltunk: ő javítja a technikai felhasználót az ügyfél adatlapján, a Bekötés fülön. Amíg nincs javítva, a napi lekérdezés kihagyja ezt az ügyfelet.\n\n{brand}',

  // 4–5) Megszűnt az előfizetés (the period end, or the admin set "megszűnt")
  'notif.subscription_canceled.megszunt.title': 'Megszűnt az előfizetésed',
  'notif.subscription_canceled.megszunt.body': '{datum} napjával megszűnt az előfizetésed, több díjat nem vonunk le. Az irataidat az appban továbbra is megnézheted.',
  'email.subscription_ended.subject': 'Megszűnt az előfizetésed',
  'email.subscription_ended.body': '{datum} napjával megszűnt az {brand}-előfizetésed, több díjat nem vonunk le. Az irataidat az appban továbbra is megnézheted.',
  'notif.assist_task.megszunt.title': 'Megszűnt: {clientName}',
  'notif.assist_task.megszunt.body': 'Megszűnt az előfizetése. Vond vissza a meghatalmazást a NAV-nál, és tiltsd le a technikai felhasználót.',
  'email.subscription_ended_konyvelo.subject': 'Megszűnt: {clientName}',
  'email.subscription_ended_konyvelo.body':
    '{clientName} előfizetése {datum} napjával megszűnt. Vond vissza a meghatalmazást a NAV-nál (8 napon belül), és tiltsd le a technikai felhasználót.',

  // 6) A felmondás hatályba lépett (the 06:10 job)
  'notif.contract_terminated.hatalyos.title': 'Megszűnt a szerződésed',
  'notif.contract_terminated.hatalyos.body': 'A felmondás mai nappal hatályos, a szolgáltatás véget ért. A felmondó levelet az appban, a Dossziéban találod.',
  'email.contract_terminated_hatalyos.subject': 'Megszűnt a szerződésed',
  'email.contract_terminated_hatalyos.body':
    'A felmondás mai nappal hatályos, a szolgáltatás véget ért, több díjat nem vonunk le. A felmondó levelet és az irataidat az appban, a Dossziéban továbbra is megtalálod.',

  // 7) Fióktörlés visszavonva
  'email.account_deletion_cancelled.subject': 'Visszavontad a fiókod törlését',
  'email.account_deletion_cancelled.body':
    'Szia!\n\nA fiókod megmarad, ugyanúgy használhatod.\n\nHa nem te voltál, állíts be új jelszót az appban az „Elfelejtettem a jelszavam” gombbal, és írj nekünk.\n\n{brand}',
  'email.account_deletion_cancelled.elofizetes.body':
    'Szia!\n\nA fiókod megmarad, ugyanúgy használhatod. Az előfizetésed a fizetett időszak végéig tart, a Fiók → Előfizetés alatt újraindíthatod.\n\nHa nem te voltál, állíts be új jelszót az appban az „Elfelejtettem a jelszavam” gombbal, és írj nekünk.\n\n{brand}',

  // 8) Fiók törölve (the address is read before the pseudonymisation)
  'email.account_deleted.subject': 'Töröltük az {brand}-fiókodat',
  'email.account_deleted.body':
    'Szia!\n\nA kérésedre töröltük az {brand}-fiókodat. Amit a törvény szerint meg kell őriznünk (például a számlákat), azt a megőrzési idő végéig zárolva tároljuk, utána töröljük.\n\n{brand}',

  // 9) Adatmásolat hiba
  'email.export_failed.subject': 'Nem készült el az adataid másolata',
  'email.export_failed.body': 'Szia!\n\nHiba történt az adataid másolatának készítésekor. Már dolgozunk rajta, és szólunk, amint letölthető.\n\n{brand}',
  'email.export_failed_admin.subject': 'Adatmásolat hiba: {clientName}',
  'email.export_failed_admin.body':
    'Szia!\n\n{clientName} adatmásolata nem készült el, és a rendszer nem próbálja újra. A kérés napja: {datum}. A GDPR szerint a kéréstől számított egy hónapon belül teljesíteni kell: nézd meg a hibát a szerver naplójában, és indíts új adatmásolatot a konzolban, az ügyfél lapján.\n\n{brand}',

  // 10) Már van fiókod (the sign-up answer is the same for a new and an existing address)
  'email.account_exists.subject': 'Már van fiókod az {brand}-ban',
  'email.account_exists.body':
    'Szia!\n\nEzzel a címmel most valaki regisztrálni próbált. Ha te voltál, lépj be az appban, vagy kérj új jelszót az „Elfelejtettem a jelszavam” gombbal: {appUrl}\n\nHa nem te voltál, nincs teendőd.\n\n{brand}',

  // 11) Árkedvezmény visszavonva (notify price_changed, variant visszavonva)
  'notif.price_changed.visszavonva.title': 'Változik a havidíjad',
  'notif.price_changed.visszavonva.body': '{datum} napjától a havidíjad {osszeg} Ft, mert megszűnt a kedvezményed. A részleteket a Fiók → Előfizetés alatt látod; ha kérdésed van, írj nekünk.',
  'email.price_discount_revoked.subject': 'Változik a havidíjad',
  'email.price_discount_revoked.body': '{datum} napjától a havidíjad {osszeg} Ft, mert megszűnt a kedvezményed. A részleteket a Fiók → Előfizetés alatt látod; ha kérdésed van, írj nekünk az appban.',

  // 12) Az ügyfélszolgálat törölte a mentett kártyát
  'email.card_deleted_by_admin.subject': 'Töröltük a mentett kártyádat',
  'email.card_deleted_by_admin.body':
    'Szia {firstName}!\n\nAz ügyfélszolgálat törölte a mentett bankkártyádat. Hogy a havidíj levonása ne akadjon el, adj meg új kártyát a Fiók → Előfizetés alatt. Ha nem tudsz róla, írj nekünk az Üzenetek fülön.\n\n{brand}',
  'email.card_deleted_by_admin.lemondva.body':
    'Szia {firstName}!\n\nAz ügyfélszolgálat törölte a mentett bankkártyádat. Az előfizetésed le van mondva, ezért nincs teendőd. Ha nem tudsz róla, írj nekünk az Üzenetek fülön.\n\n{brand}',

  // 13) Igazolás nem adható ki (notify certificate_status, variant elutasitva)
  'email.certificate_rejected.subject': 'Nem tudjuk kiadni az igazolásodat',
  'email.certificate_rejected.body':
    '{firstName} nem tudta kiadni ezt az igazolást: {tipus}. Az oka: {ok}.\n\nHa már kifizetted a díját, visszatérítjük. Ha kérdésed van, írj neki az appban, az Üzenetekben.',
};

export function k7bDefaults(): Record<string, string> {
  return { ...K7B_TEXTS };
}
