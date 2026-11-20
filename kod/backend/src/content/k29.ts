// SPEC §29.15 (B1): editable content defaults of the payments (Stripe / DEMO), the fee invoices and the prices –
// content keys k29.* plus the notif.<kind>[.<variant>] / email.<kind> texts the payment flows send. Generated from
// kod/shared/src/k29.ts at start; DB rows in content_texts override them (/admin/szovegek, placeholder check as usual).
import {
  CARD_CONSENT_TEXT,
  CARD_CONSENT_UI,
  DISPUTE_TEXTS,
  DUPLICATE_TEXTS,
  INVOICE_FAILED_TEXTS,
  INVOICE_LINE_TEXTS,
  INVOICE_TEXTS,
  NO_TRIAL_LINE,
  PAYMENT_FAIL_TEXTS,
  PAYMENT_SCREEN_TEXTS,
  PREDEBIT_TEXTS,
  REFUND_TEXTS,
  TAXPAYER_LOOKUP_K29,
} from '../_shared/k29.js';
import { flatten } from './k28.js';

export function k29Defaults(): Record<string, string> {
  const out: Record<string, string> = {};
  // ---- §29.1.3 card consent (the text the client accepts; its sha256 is stored with the consent)
  out['k29.consent.text'] = CARD_CONSENT_TEXT;
  flatten('k29.consent', { ...CARD_CONSENT_UI }, out);
  // ---- §29.1.13 screens
  flatten('k29.ui', PAYMENT_SCREEN_TEXTS, out);
  out['k29.ui.elso_honap'] = NO_TRIAL_LINE;
  // ---- §29.1.5 payment problems (always on)
  for (const [v, t] of Object.entries(PAYMENT_FAIL_TEXTS)) {
    out[`notif.payment_action_needed.${v}.title`] = t.title;
    out[`notif.payment_action_needed.${v}.body`] = t.body;
  }
  out['notif.payment_action_needed.title'] = PAYMENT_FAIL_TEXTS.elutasitva.title;
  out['notif.payment_action_needed.body'] = PAYMENT_FAIL_TEXTS.elutasitva.body;
  // ---- §29.1.6 pre-debit reminder (e-mail adds one line)
  out['notif.charge_upcoming.title'] = PREDEBIT_TEXTS.title;
  out['notif.charge_upcoming.body'] = PREDEBIT_TEXTS.body;
  out['email.charge_upcoming.body'] = `${PREDEBIT_TEXTS.body}\n\n${PREDEBIT_TEXTS.emailExtra}`;
  out['notif.subscription_renewal_needed.nincs_kartya.title'] = PREDEBIT_TEXTS.noCardTitle;
  out['notif.subscription_renewal_needed.nincs_kartya.body'] = PREDEBIT_TEXTS.noCardBody;
  // ---- §29.1.10 refunds, disputes, invoice alerts (admins)
  out['notif.payment_refunded.title'] = REFUND_TEXTS.title;
  out['notif.payment_refunded.body'] = REFUND_TEXTS.body;
  out['notif.payment_disputed.title'] = DISPUTE_TEXTS.title;
  out['notif.payment_disputed.body'] = DISPUTE_TEXTS.body;
  out['notif.payment_disputed.dupla.title'] = DUPLICATE_TEXTS.title;
  out['notif.payment_disputed.dupla.body'] = DUPLICATE_TEXTS.body;
  out['notif.payment_disputed.kulso_visszaterites.title'] = 'Visszatérítés a Stripe-ban: {clientName}';
  out['notif.payment_disputed.kulso_visszaterites.body'] = '{osszeg} Ft-ot a Stripe felületén térítettek vissza. A számla-sztornót / helyesbítést elindítottuk.';
  // k7c2: the admin alert says what really happened
  out['notif.payment_disputed.dupla_dij.title'] = 'Dupla díjfizetés – visszautaltuk: {clientName}';
  out['notif.payment_disputed.dupla_dij.body'] = 'Ugyanarra a díjra kétszer jött pénz. A másodikat ({osszeg} Ft) visszautaltuk, számla nem készült róla.';
  out['notif.payment_disputed.dupla_nem_ment.title'] = 'Dupla fizetés – NEM sikerült visszautalni: {clientName}';
  out['notif.payment_disputed.dupla_nem_ment.body'] = '{osszeg} Ft ment le kétszer. Az automatikus visszautalás nem sikerült, 15 percenként újrapróbáljuk. Ha sürgős, térítsd vissza kézzel a Fizetések oldalon.';
  out['notif.payment_disputed.osszeg_elteres.title'] = 'Eltérő összegű fizetés: {clientName}';
  out['notif.payment_disputed.osszeg_elteres.body'] = 'A Stripe más összeget vagy pénznemet jelzett, mint {osszeg} Ft. Nem könyveltük el – nézd meg a Stripe-ban.';
  out['notif.payment_disputed.felmondas_utan.title'] = 'Fizetés felmondás után: {clientName}';
  out['notif.payment_disputed.felmondas_utan.body'] = '{osszeg} Ft jött egy felmondott ügyféltől. A szolgáltatás nem hosszabbodott meg – ha nem jár, térítsd vissza a Fizetések oldalon.';
  out['notif.payment_disputed.szolgaltato_hiba.title'] = 'Nem sikerült levonni a havidíjat: {clientName}';
  out['notif.payment_disputed.szolgaltato_hiba.body'] = 'A Stripe visszautasította a kérést ({hiba}), a {osszeg} Ft nem ment le. Az ügyfelet megkértük, adjon meg kártyát; ha nem fizet, a szokásos rend szerint szünetel a könyvelése.';
  out['notif.payment_disputed.visszaterites_hiba.title'] = 'Nem ment át egy visszatérítés: {clientName}';
  out['notif.payment_disputed.visszaterites_hiba.body'] = '{osszeg} Ft nem került vissza az ügyfélhez. Nézd meg a Stripe-ban, és ha kell, javítsd a számlát.';
  out['notif.payment_disputed.vita_elveszett.title'] = 'Elvesztett vita: {clientName}';
  out['notif.payment_disputed.vita_elveszett.body'] = '{osszeg} Ft a bankján át visszakerült az ügyfélhez. A számla sztornóját / helyesbítését elindítottuk.';
  out['notif.invoice_failed.title'] = INVOICE_FAILED_TEXTS.title;
  out['notif.invoice_failed.body'] = INVOICE_FAILED_TEXTS.body;
  out['k29.chip.vitatott'] = DISPUTE_TEXTS.chip;
  // ---- §29.2 invoice texts (Számlázz.hu fields; the e-mail Számlázz.hu sends)
  out['k29.szamla.email_targy'] = INVOICE_TEXTS.emailTargy;
  out['k29.szamla.email_szoveg'] = INVOICE_TEXTS.emailSzoveg;
  flatten('k29.szamla.tetel', INVOICE_LINE_TEXTS, out);
  // ---- §29.9.4 manual lock (owner console)
  out['zarolas.mit.kezi'] = 'a könyvelésed';
  out['k29.zarolas.kezi_banner'] = 'Szünetel a könyvelésed. Írj nekünk, ha kérdésed van.';
  out['notif.service_locked.kezi.title'] = 'Szünetel a könyvelésed';
  out['notif.service_locked.kezi.body'] = 'Írj nekünk az Üzenetek fülön, és megbeszéljük, hogyan folytathatjuk.';
  // ---- §29.4.4 taxpayer lookup
  out['k29.adoszam.nem_elerheto'] = TAXPAYER_LOOKUP_K29.unavailableText;
  out['k29.adoszam.kezzel'] = TAXPAYER_LOOKUP_K29.manualButton;
  return out;
}
