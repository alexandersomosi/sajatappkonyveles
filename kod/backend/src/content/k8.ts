// k8 ALAP-B: editable content defaults (/admin/szovegek) of the bank transfer (díjbekérő, reminders), our own fee-invoice
// mail, the callback offer before the payment, the staff mail footer and the JL letters of dizajn/email/LEVEL_LEFEDETTSEG.md
// (3. pont 14–21). Tegező, short, no "a(z)", no time promise except the one allowed callback sentence.
// The plain-text mail bodies are also the source of the HTML template (notify/sablon.ts): a paragraph of "Kulcs: érték"
// lines becomes the key–value table, "Tipp: …" the tip block, a lone 6-digit code the code block.
import { CALLBACK_OFFER_TEXTS, LOCK_ELOFIZETES_VISSZAHIVAS_UTAN, TRANSFER_TEXTS } from '../_shared/k8.js';
import { flatten } from './k28.js';

export const CALLBACK_PROMISE = 'A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.';

export function k8Defaults(): Record<string, string> {
  const out: Record<string, string> = {};
  flatten('k8.ui', TRANSFER_TEXTS, out);
  flatten('k8.visszahivas_ajanlat', CALLBACK_OFFER_TEXTS, out);
  out[LOCK_ELOFIZETES_VISSZAHIVAS_UTAN] = 'Visszahívást kértél: az előfizetés a beszélgetés után nyílik meg.';
  out['zarolas.mit.atutalas_kesik'] = 'havidíj';

  // ---- díjbekérő (own mail with the PDF; the in-app row + push without a second mail) ----
  out['notif.transfer_request.title'] = 'Díjbekérő: {osszeg} Ft';
  out['notif.transfer_request.body'] = 'Utald el {hataridoIg}. Az utalási adatokat a Fiók → Előfizetés alatt találod.';
  out['email.transfer_request.subject'] = 'Díjbekérő a havidíjról: {osszeg} Ft';
  out['email.transfer_request.body'] = [
    'Szia, {keresztnev}!',
    'Itt vannak a havidíjad utalási adatai{idoszakSzoveg}:',
    'Összeg: {osszeg} Ft\nHatáridő: {hatarido}\nKedvezményezett: {kedvezmenyezett}\nSzámlaszám: {szamlaszam}\nKözlemény: {kozlemeny}',
    'A közleményt pontosan így írd be, ebből tudjuk, hogy a te utalásod érkezett.',
    '{elsoSor}A díjbekérő PDF-je csatolva van ehhez a levélhez. A díjszámlát az utalás beérkezése után küldjük.',
    '{link}',
  ].join('\n\n');
  out['email.transfer_request.gomb'] = 'Megnézem az utalási adatokat';
  out['k8.email.elso_sor'] = 'Amint megérkezik az utalás, bekapcsoljuk a könyvelést. ';

  // ---- reminders after the due day (1., 4., 8. nap) ----
  out['notif.transfer_reminder.title'] = 'Még nem érkezett meg a havidíjad';
  out['notif.transfer_reminder.body'] = 'A határidő {hatarido} volt ({osszeg} Ft). Ha már elutaltad, nincs teendőd. Ha még nem, az utalási adatokat a Fiók → Előfizetés alatt találod.';
  out['email.transfer_reminder.subject'] = 'Még nem érkezett meg a havidíjad';
  out['email.transfer_reminder.body'] = [
    'Szia, {keresztnev}!',
    'Még nem érkezett meg a havidíjad.',
    'Összeg: {osszeg} Ft\nHatáridő: {hatarido}\nSzámlaszám: {szamlaszam}\nKözlemény: {kozlemeny}',
    'Ha már elutaltad, nincs teendőd: amint megérkezik, rögzítjük.',
  ].join('\n\n');
  out['email.transfer_reminder.gomb'] = 'Megnézem az utalási adatokat';

  // ---- our own fee-invoice mail (Számlázz.hu sendEmail=false, K8_TERV:22) ----
  out['email.fee_invoice.subject'] = 'Számla: {megnevezes}';
  out['email.fee_invoice.body'] = ['Szia, {keresztnev}!', 'Elkészült a számlád: {megnevezes}.', 'Összeg: {osszeg} Ft\nSzámlaszám: {szamlaszam}\nFizetés: {fizetes}', 'A számla PDF-je csatolva van ehhez a levélhez. Az appban is megtalálod: Fiók → Díjak és számlák.', '{link}'].join('\n\n');
  out['email.fee_invoice.havidij.subject'] = 'Számla a havidíjról ({idoszak})';
  out['email.fee_invoice.havidij.body'] = ['Szia, {keresztnev}!', 'Elkészült a havidíjad számlája ({idoszak}).', 'Összeg: {osszeg} Ft\nSzámlaszám: {szamlaszam}\nFizetés: {fizetes}', 'A számla PDF-je csatolva van ehhez a levélhez. Az appban is megtalálod: Fiók → Díjak és számlák.', '{link}'].join('\n\n');
  out['email.fee_invoice.sztorno.subject'] = 'Sztornó számla: {eredeti}';
  out['email.fee_invoice.sztorno.body'] = ['Szia, {keresztnev}!', 'Visszautaltuk a díjat, ezért sztornóztuk a számlát ({eredeti}).', 'Sztornó számla: {szamlaszam}\nÖsszeg: {osszeg} Ft', 'A sztornó számla PDF-je csatolva van ehhez a levélhez.', '{link}'].join('\n\n');
  out['email.fee_invoice.helyesbito.subject'] = 'Helyesbítő számla: {eredeti}';
  out['email.fee_invoice.helyesbito.body'] = ['Szia, {keresztnev}!', 'A díj egy részét visszautaltuk, ezért helyesbítő számlát állítottunk ki ({eredeti}).', 'Helyesbítő számla: {szamlaszam}\nÖsszeg: {osszeg} Ft', 'A számla PDF-je csatolva van ehhez a levélhez.', '{link}'].join('\n\n');
  out['email.fee_invoice.gomb'] = 'Megnézem a számláimat';
  out['k8.fizetes.kartya'] = 'Kártyával fizetve';
  out['k8.fizetes.atutalas'] = 'Átutalással fizetve';

  // ---- staff footer of the notification mails (the client's "Fiók → Értesítések" does not exist for them) ----
  out['email.generic.footer_munkatars'] = '\n\n—\n{brand} · Ezt a levelet azért kaptad, mert az {brand} munkatársa vagy. Ügyféladatot ne továbbíts belőle.';

  // ---- button labels of notification mails (dispatchPending: the trailing link becomes this button) ----
  out['email.tax_due_soon.gomb'] = 'Megnézem az utalási adatokat';
  out['email.charge_upcoming.gomb'] = 'Megnézem az előfizetésemet';
  out['email.payment_action_needed.gomb'] = 'Kifizetem';
  out['email.message_new.gomb'] = 'Elolvasom';
  out['email.annual_due.gomb'] = 'Megnézem';
  out['email.request_new.gomb'] = 'Megnézem a kérést';

  // ---- JL letters (LEVEL_LEFEDETTSEG 3. pont 14–19) ----
  out['email.welcome.subject'] = 'Üdv az Adózzban!';
  out['email.welcome.body'] = ['Szia, {keresztnev}!', `Örülünk, hogy itt vagy. Az appban lépésről lépésre végigvezetünk a bekötésen. Ha elakadsz, kérj visszahívást. ${CALLBACK_PROMISE}`, '{link}'].join('\n\n');
  out['email.welcome.gomb'] = 'Folytatom a bekötést';
  out['email.subscription_started.subject'] = 'Elindult az előfizetésed';
  out['email.subscription_started.body'] = ['Szia, {keresztnev}!', 'Sikerült az első fizetés, elindult az előfizetésed. A számlát külön levélben küldjük.', '{link}'].join('\n\n');
  out['email.subscription_started.gomb'] = 'Megnyitom az appot';
  out['email.account_locked.subject'] = 'Zároltuk a belépést a fiókodba';
  out['email.account_locked.body'] = ['Szia!', 'Többször rossz jelszóval próbáltak belépni a fiókodba, ezért {perc} percre zároltuk a belépést.', 'Ha nem te voltál, állíts be új jelszót az „Elfelejtettem a jelszavam” gombbal.'].join('\n\n');
  out['email.guided_continue.subject'] = 'Folytasd ott, ahol abbahagytad';
  out['email.guided_continue.body'] = ['Szia, {keresztnev}!', 'Már csak pár lépés, és elkezdjük a könyvelésedet. Az appban onnan folytatod, ahol abbahagytad.', '{link}'].join('\n\n');
  out['email.guided_continue.gomb'] = 'Folytatom';
  out['notif.guided_continue.title'] = 'Folytasd ott, ahol abbahagytad';
  out['notif.guided_continue.body'] = 'Már csak pár lépés, és elkezdjük a könyvelésedet.';
  out['email.fee_waived.subject'] = 'Elengedtük a díjat';
  out['email.fee_waived.body'] = ['Szia, {keresztnev}!', 'Ezt a díjat nem kell kifizetned: {label} ({osszeg} Ft).', '{link}'].join('\n\n');
  out['email.fee_waived.gomb'] = 'Megnézem a díjaimat';
  out['email.account_disabled.subject'] = 'Letiltottuk a fiókodat';
  out['email.account_disabled.body'] = ['Szia!', 'Letiltottuk az Adózz-fiókodat, ezért most nem tudsz belépni.', 'Ha kérdésed van, írj nekünk: {support}'].join('\n\n');
  out['email.account_enabled.subject'] = 'Újra használhatod a fiókodat';
  out['email.account_enabled.body'] = ['Szia!', 'Feloldottuk az Adózz-fiókodat, újra be tudsz lépni.', '{link}'].join('\n\n');
  out['email.account_enabled.gomb'] = 'Belépek';
  // 20–21: lines of the staff digest (jobs.ts jobStaffDigest)
  out['k8.digest.uj_ugyfel'] = 'Új ügyfeled: {clientName} (a bekötés elején tart).';
  out['k8.digest.sikertelen_levonas'] = 'Nem sikerült levonni {clientName} havidíját ({osszeg} Ft).';
  out['k8.digest.atutalas_kesik'] = 'Késik {clientName} átutalása ({osszeg} Ft, határidő: {hatarido}).';

  // ---- console (panel) ----
  out['k8.konzol.kapcsolo_figyelmeztetes'] = 'Élesben csak az ÁSZF frissítése után kapcsold be.';
  out['k8.konzol.kezi_jeloles_ok'] = 'Beérkezett az utalás, kézzel rögzítem.';
  out['k8.konzol.felfuggesztes_ok'] = 'Átutalás késik';
  return out;
}
