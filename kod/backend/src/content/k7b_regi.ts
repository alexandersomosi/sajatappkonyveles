// k7b (2026-11-20, SZOVEG_JAVITAS_LEVELEK.md): content keys whose DEFAULT changed in the wording review → the OLD default
// text, word for word (generated from the DEFAULT_TEXTS before the change). content.ts lets a jogi text that still equals it
// be superseded by the new default; the data step data.k7b updates a live content_texts override only if it still equals
// this old text (an admin-edited text is never touched). Regenerate only together with a new wording change.
export const K7B_REGI: Record<string, string> = {
  "email.auth_staff_invite.body": "Szia!\n\nMeghívtunk a {brand} könyvelői felületére ({panelUrl}).\nA belépéshez kattints az „Elfelejtettem a jelszavam” gombra ezzel az e-mail-címmel, és add meg ezt a kódot:\n\n{code}\n\n15 percig érvényes; ha lejár, kérj újat ugyanott.\n\n{brand}", // szándékos: régi szöveg
  "email.auth_staff_invite_csapat.body": "Szia!\n\nMeghívtunk a {brand} ügyfélszolgálati felületére ({panelUrl}).\nA belépéshez kattints az „Elfelejtettem a jelszavam” gombra ezzel az e-mail-címmel, és add meg ezt a kódot:\n\n{code}\n\n15 percig érvényes; ha lejár, kérj újat ugyanott.\n\n{brand}", // szándékos: régi szöveg
  "email.contract_terminated.body": "{datum}-ig minden marad. A részleteket a levélben olvasod.\n\nA felmondó levelet az appban, a Dossziéban találod.", // szándékos: régi szöveg
  "email.invoice_new.adomentes.body": "{vevo}. Ebből most nem kell félretenned.\n\nAz összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz", // szándékos: régi szöveg
  "email.invoice_new.body": "{vevo}. Tegyél félre kb. {felre} Ft-ot.\n\nAz összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz", // szándékos: régi szöveg
  "email.invoice_new.kuszob.body": "{vevo}. Tegyél félre kb. {felre} Ft-ot. Elfogyott az adómentes részed.\n\nAz összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz", // szándékos: régi szöveg
  "email.invoice_new.tobb.body": "Tegyél félre kb. {felre} Ft-ot. Megnézem, melyik mennyi.\n\nAz összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz", // szándékos: régi szöveg
  "email.invoice_new.tobb_adomentes.body": "Ezekből most nem kell félretenned.\n\nAz összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz", // szándékos: régi szöveg
  "email.staff_client_removed.body": "Szia!\n\nAz admin {clientName} ügyfelet egy másik könyvelőhöz rendelte. Az adatait mostantól nem látod.\n\nHa erről nem tudtál, szólj még ma a cégvezetőnek.\n\n{brand}", // szándékos: régi szöveg
  "email.staff_client_removed.subject": "Ügyfelet vettek el tőled: {clientName}", // szándékos: régi szöveg
  "k29f.felmondas.notif_body": "{datum}-ig minden marad. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "k29f.felmondas.notif_body_client": "Ahogy kérted: {datum}-ig minden marad. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "k29f.felmondas.notif_body_now": "A szerződésed ma megszűnt. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "notif.allowance_decided.body": "Nézd meg, mi jár.", // szándékos: régi szöveg
  "notif.allowance_decided.elutasitva.body": "Egy kedvezmény most nem jár. Megnézem, miért.", // szándékos: régi szöveg
  "notif.allowance_decided.jovahagyva.title": "Jóváhagyta a kedvezményedet: {label}", // szándékos: régi szöveg
  "notif.allowance_decided.reszben.body": "Nézd meg, mi jár.", // szándékos: régi szöveg
  "notif.assist_mh_expired.body": "A NAV törölte a jóvá nem hagyott meghatalmazást. {firstName} újra beküldi, és szólunk.", // szándékos: régi szöveg
  "notif.assist_mh_expired.title": "Lejárt a 4 nap", // szándékos: régi szöveg
  "notif.assist_mh_filed.body": "{firstName} beküldte a NAV-nak. Lépj be az ONYA-ba, és hagyd jóvá. Kb. 3 perc, megmutatjuk, hogyan.", // szándékos: régi szöveg
  "notif.assist_mh_reminder.body": "Még {hatarido} van időd. Kb. 3 perc az ONYA-ban.", // szándékos: régi szöveg
  "notif.assist_mh_reminder.elso.body": "Még {hatarido} van időd. Kb. 3 perc az ONYA-ban.", // szándékos: régi szöveg
  "notif.assist_mh_reminder.utolso_nap.body": "Hagyd jóvá ma a meghatalmazást az ONYA-ban, különben a NAV törli.", // szándékos: régi szöveg
  "notif.assist_mh_reminder.utolso_nap.title": "Ma van az utolsó nap", // szándékos: régi szöveg
  "notif.assist_started.body": "Ha megadtad az adataidat és elfogadtad a szerződést, {firstName} beküldi a meghatalmazást. Utána értesítést kapsz, és 4 napod lesz jóváhagyni.", // szándékos: régi szöveg
  "notif.assist_task.ujra.body": "Küldd be újra a meghatalmazást.", // szándékos: régi szöveg
  "notif.assist_task.ujra.title": "Lejárt a 4 nap: {clientName}", // szándékos: régi szöveg
  "notif.callback_assigned.uj_szam.body": "{clientName} új telefonszámot adott meg.", // szándékos: régi szöveg
  "notif.callback_overdue.title": "Lejárt a 48 óra: {clientName}", // szándékos: régi szöveg
  "notif.callback_received.body": "Kollégánk 24–48 órán belül hív a {phoneMasked} számon. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat, és nem lépünk be helyetted.", // szándékos: régi szöveg
  "notif.certificate_status.elutasitva.body": "{tipus}: {ok}", // szándékos: régi szöveg
  "notif.client_path_changed.body": "{fromLabel} → {toLabel}", // szándékos: régi szöveg
  "notif.contract_terminated.azonnali.body": "A szerződésed ma megszűnt. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "notif.contract_terminated.body": "{datum}-ig minden marad. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "notif.contract_terminated.rendes.body": "{datum}-ig minden marad. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "notif.contract_terminated.ugyfel_kerte.body": "Ahogy kérted: {datum}-ig minden marad. A részleteket a levélben olvasod.", // szándékos: régi szöveg
  "notif.fee_invoice_issued.body": "A díjról szóló bizonylatot a Fiók → Díjak és számlák alatt találod.", // szándékos: régi szöveg
  "notif.fee_invoice_issued.title": "Megérkezett a havidíj: {amount}", // szándékos: régi szöveg
  "notif.income_statement_checked.body": "{from}–{to}: a PDF-en már rajta van az ellenőrzés.", // szándékos: régi szöveg
  "notif.invoice_new.adomentes.body": "{vevo}. Ebből most nem kell félretenned.", // szándékos: régi szöveg
  "notif.invoice_new.body": "{vevo}. Tegyél félre kb. {felre} Ft-ot.", // szándékos: régi szöveg
  "notif.invoice_new.kuszob.body": "{vevo}. Tegyél félre kb. {felre} Ft-ot. Elfogyott az adómentes részed.", // szándékos: régi szöveg
  "notif.invoice_new.tobb.body": "Tegyél félre kb. {felre} Ft-ot. Megnézem, melyik mennyi.", // szándékos: régi szöveg
  "notif.onboarding_done.body": "Innentől {firstName} intézi a könyvelésed. Itt látod majd, mit kell fizetned és mikor.", // szándékos: régi szöveg
  "notif.onboarding_done.title": "Kész: minden be van kötve", // szándékos: régi szöveg
  "notif.onboarding_needs_fix.jovahagyas.body": "{note}", // szándékos: régi szöveg
  "notif.onboarding_needs_fix.jovahagyas.title": "Hagyd jóvá a meghatalmazást az ONYA-ban", // szándékos: régi szöveg
  "notif.onboarding_task.adoszam.body": "Töltsd ki az ONYA-ból, amint él a meghatalmazás.", // szándékos: régi szöveg
  "notif.onboarding_task.body": "Töltsd ki az ONYA-ból, amint él a meghatalmazás.", // szándékos: régi szöveg
  "notif.price_changed.body": "{datum}-tól havi {osszeg} Ft. Ha nem szeretnéd, előtte lemondhatod: Fiók → Előfizetés.", // szándékos: régi szöveg
  "notif.registration_reminder.tevekenyseg_segitett.title": "Megírtuk a tevékenységed sorát", // szándékos: régi szöveg
  "notif.service_locked.body": "Nincs kifizetve a {mit}. Fizess, és {firstName} folytatja.", // szándékos: régi szöveg
  "notif.service_locked.kezi.body": "Írj nekünk az Üzenetek fülön, ha kérdésed van.", // szándékos: régi szöveg
  "notif.subscription_paused.body": "{from} a havidíj helyett havi {dij} Ft-ot fizetsz.", // szándékos: régi szöveg
  "notif.subscription_paused.kezdet.body": "{from} a havidíj helyett havi {dij} Ft-ot fizetsz.", // szándékos: régi szöveg
  "notif.subscription_paused.vege.body": "{from} ismét a havidíj jár.", // szándékos: régi szöveg
  "notif.subscription_paused.vege.title": "Újra dolgozol", // szándékos: régi szöveg
  "notif.subscription_renewal_needed.body": "A kártyádra adott engedély lejár. A Fiók oldalon egy kattintással megújíthatod.", // szándékos: régi szöveg
  "notif.subscription_renewal_needed.nincs_kartya.body": "{datum}-n jár le a kifizetett időszakod. Adj meg kártyát, hogy minden menjen tovább: Fiók → Előfizetés.", // szándékos: régi szöveg
  "notif.subscription_renewal_needed.title": "Hamarosan új kártyaengedély kell", // szándékos: régi szöveg
  "notif.tax_approved.hipa_overdue.title": "Megvan az iparűzési adóelőleg: {amount}", // szándékos: régi szöveg
  "notif.tax_approved.overdue.body": "{firstName} kiszámolta és jóváhagyta. A határidő ({dueDateText}) már elmúlt, ezért mielőbb utald el, {transfersText}.", // szándékos: régi szöveg
  "notif.tax_approved.overdue.title": "Megvan a {periodAdj} összeg: {amount}", // szándékos: régi szöveg
  "notif.tax_due_soon.kata_ma.body": "Utald el ma az 50 000 Ft-ot a {honap} hónapra.", // szándékos: régi szöveg
  "notif.tax_reopened.neutral.body": "A {period} összege nem változott, csak a kísérőlevél. Nézd meg az appban.", // szándékos: régi szöveg
  "zarolas.banner": "Szünetel a könyvelésed, mert nincs kifizetve a {mit} ({osszeg} Ft). Fizess, és {firstName} folytatja.", // szándékos: régi szöveg
};
