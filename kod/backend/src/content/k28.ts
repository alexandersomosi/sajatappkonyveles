// SPEC §28.9 + §28.K.19: editable content defaults of the five new features (félretenni, new-invoice notification,
// allowances, "Mennyit kerestem?", change guides) and of the evening orders A–N (fees, check-in, annual closing,
// reminders, lock, pause, EFO, calculator, adószám lookup, KATA, home, mailbox, suggested questions). Generated from the
// shared text constants (kod/shared/src/bekotes.ts) at start; DB rows in content_texts override them and
// /admin/szovegek edits them with the usual placeholder check. Content keys are lower snake case (/^[a-z0-9_.]{3,80}$/).
import {
  ALLOWANCE_CLIENT_LINES,
  ALLOWANCE_DOCUMENTS_TO_KEEP,
  ALLOWANCE_LABELS,
  ALLOWANCE_NOTIFICATION_TEXTS,
  ALLOWANCE_PANEL_TEXTS,
  ALLOWANCE_QUESTION_TEXTS,
  ALLOWANCE_REJECT_REASON_LABELS,
  ALLOWANCE_TEXTS,
  ANNUAL_CHECK_LABELS,
  ANNUAL_STATUS_CLIENT_TEXT,
  ANNUAL_TEXTS,
  ANYAK_LABELS,
  BUSINESS_MANUAL_TEXTS,
  CALCULATOR_TEXTS,
  CHANGE_CONSENT_TEXTS,
  CHANGE_FOLLOWUP_LABELS,
  CHANGE_FORM_TEXTS,
  CHANGE_HANDBOOK,
  CHANGE_NOTIFICATION_TEXTS,
  CHANGE_STATUS_CLIENT_TEXT,
  CHANGE_TEXTS,
  CHECKIN_ADMIN_TEXTS,
  CHECKIN_FOLLOWUP_TEXTS,
  CHECKIN_ITEM_TEXTS,
  CHECKIN_PANEL_TEXTS,
  CHECKIN_RESULT_TEXTS,
  CHECKIN_TEXTS,
  EARNINGS_TEXTS,
  EMPLOYER_ANSWER_LABELS,
  EMPLOYER_DECISION_CLIENT_TEXTS,
  EMPLOYER_DECISION_LABELS,
  EMPLOYER_TEXTS,
  EXPLAINERS_28,
  FEE_KIND_LABELS,
  FEE_TEXTS,
  HOME_K_TEXTS,
  K28_NOTIFICATION_TEXTS,
  KATA_TEXTS,
  LOCK_TEXTS,
  MAILBOX_TEXTS,
  NOTIFY_INVOICE_TEXTS,
  NOTIFY_SETTINGS_TEXTS,
  OTHER_INCOME_LABELS,
  PAUSE_TEXTS,
  REMINDER_TEXTS,
  RESERVE_PANEL_TEXTS,
  RESERVE_TEXTS,
  RESPONSE_TIME_DEFAULT_TEXT,
  SUGGESTED_QUESTIONS,
  TAXPAYER_LOOKUP_TEXTS,
} from '../_shared/bekotes.js';
import { snake } from './tulaj1119.js';

const keyOk = (k: string) => /^[a-z0-9_.]{3,80}$/.test(k);

/** Flattens a text constant into content keys: nested objects → dotted snake-case keys; arrays and non-strings are skipped. */
export function flatten(prefix: string, obj: unknown, out: Record<string, string>): void {
  if (typeof obj === 'string') {
    const k = prefix.toLowerCase();
    if (keyOk(k)) out[k] = obj;
    return;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) flatten(`${prefix}.${snake(k)}`, v, out);
}

/** notif.<kind>[.<variant>].title|body from a {title, body} or {variant: {title, body}} block. */
function notifTexts(kind: string, block: unknown, out: Record<string, string>, defaultVariant?: string): void {
  if (!block || typeof block !== 'object') return;
  const b = block as Record<string, unknown>;
  if (typeof b.title === 'string' && typeof b.body === 'string') {
    out[`notif.${kind}.title`] = b.title;
    out[`notif.${kind}.body`] = b.body;
  }
  let first: { title: string; body: string } | null = null;
  for (const [v, x] of Object.entries(b)) {
    if (!x || typeof x !== 'object') continue;
    const t = x as Record<string, unknown>;
    if (typeof t.title !== 'string' || typeof t.body !== 'string') continue;
    out[`notif.${kind}.${snake(v)}.title`] = t.title;
    out[`notif.${kind}.${snake(v)}.body`] = t.body;
    if (!first || v === defaultVariant) first = { title: t.title, body: t.body };
  }
  // a kind used only with variants still gets base keys (notify() falls back to them)
  if (first && !out[`notif.${kind}.title`]) {
    out[`notif.${kind}.title`] = first.title;
    out[`notif.${kind}.body`] = first.body;
  }
}

export function k28Defaults(): Record<string, string> {
  const out: Record<string, string> = {};
  // ---- §28.1 félretenni
  flatten('felretesz', RESERVE_TEXTS, out);
  flatten('felretesz.panel', RESERVE_PANEL_TEXTS, out);
  // ---- §28.2 new-invoice notification (+ e-mail body = in-app body + the footer line)
  for (const v of ['alap', 'kuszob', 'adomentes', 'tobb', 'tobb_adomentes'] as const) {
    const t = NOTIFY_INVOICE_TEXTS[v];
    const base = v === 'alap' ? 'notif.invoice_new' : `notif.invoice_new.${v}`;
    out[`${base}.title`] = t.title;
    out[`${base}.body`] = t.body;
    out[`email.invoice_new${v === 'alap' ? '' : `.${v}`}.body`] = `${t.body}\n\n${NOTIFY_INVOICE_TEXTS.emailFooter}`;
  }
  out['notif.invoice_new.rejtett.title'] = NOTIFY_INVOICE_TEXTS.rejtett.title;
  out['notif.invoice_new.rejtett.title_tobb'] = NOTIFY_INVOICE_TEXTS.rejtett.titleTobb;
  out['notif.invoice_new.rejtett.body'] = NOTIFY_INVOICE_TEXTS.rejtett.body;
  out['notif.invoice_new.magansz'] = NOTIFY_INVOICE_TEXTS.privatePerson;
  flatten('ertesitesek.beallitas', NOTIFY_SETTINGS_TEXTS, out);
  // ---- §28.3 allowances
  flatten('kedvezmeny', ALLOWANCE_TEXTS, out);
  flatten('kedvezmeny.cimke', ALLOWANCE_LABELS, out);
  flatten('kedvezmeny.cimke_anyak', ANYAK_LABELS, out);
  flatten('kedvezmeny.sor', ALLOWANCE_CLIENT_LINES, out);
  flatten('kedvezmeny.elutasitas', ALLOWANCE_REJECT_REASON_LABELS, out);
  flatten('kedvezmeny.irat', ALLOWANCE_DOCUMENTS_TO_KEEP, out);
  flatten('kedvezmeny.kerdoiv', ALLOWANCE_QUESTION_TEXTS, out);
  flatten('kedvezmeny.panel', ALLOWANCE_PANEL_TEXTS, out);
  notifTexts('allowance_submitted', ALLOWANCE_NOTIFICATION_TEXTS.allowance_submitted, out);
  notifTexts('allowance_decided', ALLOWANCE_NOTIFICATION_TEXTS.allowance_decided, out, 'reszben');
  notifTexts('allowance_check', ALLOWANCE_NOTIFICATION_TEXTS.allowance_check, out, 'ev_eleje');
  out['kedvezmeny.digest'] = ALLOWANCE_NOTIFICATION_TEXTS.digest;
  // ---- §28.4 earnings
  flatten('kereset', EARNINGS_TEXTS, out);
  // ---- §28.5 change guides
  flatten('valtozas', CHANGE_TEXTS, out);
  flatten('valtozas.allapot', CHANGE_STATUS_CLIENT_TEXT, out);
  flatten('valtozas.engedely', CHANGE_CONSENT_TEXTS, out);
  flatten('valtozas.kezikonyv', CHANGE_HANDBOOK, out);
  flatten('valtozas.utomunka', CHANGE_FOLLOWUP_LABELS, out);
  flatten('valtozas.urlap', CHANGE_FORM_TEXTS, out);
  for (const [kind, block] of Object.entries(CHANGE_NOTIFICATION_TEXTS)) {
    if (kind === 'digest') continue;
    if (kind === 'assist_change_done') {
      const b = block as typeof CHANGE_NOTIFICATION_TEXTS.assist_change_done;
      out['notif.assist_change_done.title'] = b.title;
      out['notif.assist_change_done.body'] = b.body;
      out['notif.assist_change_done.valtozas_szekhely.title'] = b.title;
      out['notif.assist_change_done.valtozas_szekhely.body'] = b.body + b.bodySzekhelyExtra;
      continue;
    }
    // variants of existing kinds: never overwrite the kind's own base keys (they live in defaults.hu.json)
    for (const [v, x] of Object.entries(block as Record<string, { title: string; body: string }>)) {
      out[`notif.${kind}.${v}.title`] = x.title;
      out[`notif.${kind}.${v}.body`] = x.body;
    }
  }
  out['valtozas.digest'] = CHANGE_NOTIFICATION_TEXTS.digest;
  // explainers (same key scheme as the onboarding explainers)
  for (const e of EXPLAINERS_28) {
    out[`bekotes.magyarazat.${e.key}.cim`] = e.title;
    out[`bekotes.magyarazat.${e.key}.mi`] = e.what;
    out[`bekotes.magyarazat.${e.key}.miert`] = e.why;
    out[`bekotes.magyarazat.${e.key}.hol`] = e.where;
  }
  // ---- §28.K
  flatten('dij', FEE_TEXTS, out);
  flatten('dij.fajta', FEE_KIND_LABELS, out);
  flatten('havi', CHECKIN_TEXTS, out);
  for (const [k, v] of Object.entries(CHECKIN_ITEM_TEXTS)) {
    out[`havi.kerdes.${k}`] = v.question;
    if (v.questionAlt) out[`havi.kerdes.${k}_mellek`] = v.questionAlt;
  }
  flatten('havi.kovetes', CHECKIN_FOLLOWUP_TEXTS, out);
  flatten('havi.eredmeny', CHECKIN_RESULT_TEXTS, out);
  flatten('havi.admin', CHECKIN_ADMIN_TEXTS, out);
  flatten('havi.panel', CHECKIN_PANEL_TEXTS, out);
  flatten('eves', ANNUAL_TEXTS, out);
  flatten('eves.allapot', ANNUAL_STATUS_CLIENT_TEXT, out);
  flatten('eves.jovedelem', OTHER_INCOME_LABELS, out);
  flatten('eves.ellenorzes', ANNUAL_CHECK_LABELS, out);
  flatten('emlekezteto', { groupTitle: REMINDER_TEXTS.groupTitle, groups: REMINDER_TEXTS.groups, groupSubs: REMINDER_TEXTS.groupSubs, nudgeSubjects: REMINDER_TEXTS.nudgeSubjects, staffDigest: REMINDER_TEXTS.staffDigest }, out);
  // reminder variants are variants of the kinds (tax_due_soon / request_reminder keep their own base keys)
  for (const kind of ['tax_due_soon', 'request_reminder'] as const)
    for (const [v, x] of Object.entries(REMINDER_TEXTS[kind])) {
      out[`notif.${kind}.${v}.title`] = x.title;
      out[`notif.${kind}.${v}.body`] = x.body;
    }
  notifTexts('upload_reminder', REMINDER_TEXTS.upload_reminder, out, 'kivonat');
  notifTexts('nudge', REMINDER_TEXTS.nudge, out, 'egy');
  notifTexts('annual_due', REMINDER_TEXTS.annual_due, out, 'kerdoiv');
  flatten('zarolas', LOCK_TEXTS, out);
  flatten('szunetel', PAUSE_TEXTS, out);
  flatten('alkalmazott', EMPLOYER_TEXTS, out);
  flatten('alkalmazott.valasz', EMPLOYER_ANSWER_LABELS, out);
  flatten('alkalmazott.dontes', EMPLOYER_DECISION_LABELS, out);
  flatten('alkalmazott.dontes_szoveg', EMPLOYER_DECISION_CLIENT_TEXTS, out);
  flatten('kalkulator', CALCULATOR_TEXTS, out);
  flatten('adoszam', TAXPAYER_LOOKUP_TEXTS, out);
  flatten('adoszam.kezi', BUSINESS_MANUAL_TEXTS, out);
  flatten('kata', KATA_TEXTS, out);
  flatten('fooldal', HOME_K_TEXTS, out);
  flatten('postafiok', MAILBOX_TEXTS, out);
  SUGGESTED_QUESTIONS.forEach((q, i) => (out[`uzenetek.javaslat.${i + 1}`] = q));
  out['uzenetek.valaszido'] = RESPONSE_TIME_DEFAULT_TEXT;
  for (const [kind, block] of Object.entries(K28_NOTIFICATION_TEXTS)) {
    const def: Record<string, string> = { fee_due: 'valtozas', annual_status: 'jovahagyasra_var', employer_decided: 'nincs_teendo', subscription_paused: 'kezdet', onboarding_task: 'adoszam' };
    notifTexts(kind, block, out, def[kind]);
  }
  // kata_business_invoice.staff is a nested {title, body} → notif.kata_business_invoice.staff.*
  // service_locked.hatarido likewise (notifTexts already wrote both).
  return out;
}

/** SPEC §28.9 / §28.K.19: placeholders allowed per new content group. */
export const GROUP_PLACEHOLDERS_K28: [string, string[]][] = [
  ['felretesz.', ['firstName', 'felre', 'osszeg', 'keepNow', 'A', 'B', 'fixedMonthly', 'hipaAnnual', 'havi', 'szja', 'tb', 'szocho', 'jovedelemArany', 'description', 'refund', 'datum', 'n', 'u', 'negyedev', 'honapok', 'hipa']],
  ['kedvezmeny.', ['firstName', 'n', 'savedYtd', 'question', 'monthsText', 'effectYear', 'rejectText', 'x', 'y', 'u', 'c', 'at']],
  ['kereset.', ['firstName', 'ytdNet', 'ytdRevenue', 'ytdTaxes', 'projNet', 'projRev', 'projTaxes', 'year', 'honap', 'rev', 'taxes', 'refund']],
  ['valtozas.', ['firstName', 'firstNameWith', 'kindLabel', 'konyveloNev', 'valtozasNapja', 'clientName', 'n']],
  ['dij.', ['firstName', 'dij', 'label', 'unit', 'date', 'admin', 'n', 'clientName', 'honap']],
  ['havi.', ['firstName', 'firstNameWith', 'honap', 'i', 'n', 'status', 'date']],
  ['eves.', ['firstName', 'ev', 'dij', 'hatarido', 'n']],
  ['emlekezteto.', ['firstName', 'n']],
  ['zarolas.', ['firstName', 'mit', 'osszeg', 'date', 'since', 'n']],
  ['szunetel.', ['from', 'dij', 'havidij']],
  ['alkalmazott.', ['firstName', 'firstNameWith', 'clientName']],
  ['fooldal.', ['firstName', 'n', 'osszeg', 'hatarido', 'limit', 'refund']],
  ['uzenetek.', ['firstName']],
];
