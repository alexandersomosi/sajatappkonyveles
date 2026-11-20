// SPEC §29.15: editable content defaults of the new features (F1 certificates, F2 income statement, F3 closing,
// F4 calendar, F9 console) – content keys k29f.* plus the notif.<kind>[.<variant>] texts they send. Generated from
// kod/shared/src/k29f.ts at start; DB rows in content_texts override them (/admin/szovegek).
import {
  CALENDAR_TEXTS,
  CERT_FORM_TEXTS,
  CERT_NOTIFICATION_TEXTS,
  CERT_PANEL_TEXTS,
  CERT_STATUS_TEXTS,
  CLOSING_FOLLOWUP_LABELS,
  CLOSING_TEXTS,
  CONSOLE_NOTIFICATION_TEXTS,
  CONSOLE_TEXTS,
  INCOME_NOTIFICATION_TEXTS,
  INCOME_STATEMENT_TEXTS,
  TERMINATION_TEXTS,
} from '../_shared/k29f.js';
import { flatten } from './k28.js';

function notif(kind: string, block: unknown, out: Record<string, string>): void {
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
    out[`notif.${kind}.${v}.title`] = t.title;
    out[`notif.${kind}.${v}.body`] = t.body;
    first ??= { title: t.title, body: t.body };
  }
  if (first && !out[`notif.${kind}.title`]) {
    out[`notif.${kind}.title`] = first.title;
    out[`notif.${kind}.body`] = first.body;
  }
}

export function k29fDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  // F1
  flatten('k29f.cert.form', CERT_FORM_TEXTS, out);
  flatten('k29f.cert.status', CERT_STATUS_TEXTS, out);
  flatten('k29f.cert.panel', CERT_PANEL_TEXTS, out);
  notif('certificate_requested', CERT_NOTIFICATION_TEXTS.certificate_requested, out);
  notif('certificate_status', CERT_NOTIFICATION_TEXTS.certificate_status, out);
  out['email.certificate_status.kesz.body'] = `${CERT_NOTIFICATION_TEXTS.certificate_status.kesz.body}\n\nAz elektronikus igazolás csak az eredeti fájlban hiteles: az appból töltsd le, és úgy küldd tovább.`;
  // F2
  flatten('k29f.kimutatas', INCOME_STATEMENT_TEXTS, out);
  notif('income_statement_review', INCOME_NOTIFICATION_TEXTS.income_statement_review, out);
  notif('income_statement_checked', INCOME_NOTIFICATION_TEXTS.income_statement_checked, out);
  // F3 – the hub row of the new change kind (the other kinds come from CHANGE_TEXTS in content/k28.ts)
  out['valtozas.sorok.valtozas_megszuntetes.title'] = CLOSING_TEXTS.hubRow.title;
  out['valtozas.sorok.valtozas_megszuntetes.line'] = CLOSING_TEXTS.hubRow.line;
  flatten('k29f.megszuntetes', CLOSING_TEXTS, out);
  flatten('valtozas.utomunka', CLOSING_FOLLOWUP_LABELS, out);
  // F4
  flatten('k29f.naptar', CALENDAR_TEXTS, out);
  // F9
  flatten('k29f.konzol', CONSOLE_TEXTS, out);
  flatten('k29f.felmondas', TERMINATION_TEXTS, out);
  notif('contract_terminated', CONSOLE_NOTIFICATION_TEXTS.contract_terminated, out);
  out['email.contract_terminated.body'] = `${CONSOLE_NOTIFICATION_TEXTS.contract_terminated.rendes.body}\n\nA felmondó levelet az appban, a Dossziéban találod.`;
  notif('contract_reactivated', CONSOLE_NOTIFICATION_TEXTS.contract_reactivated, out);
  out['notif.price_changed.title'] = CONSOLE_NOTIFICATION_TEXTS.price_changed.title;
  out['notif.price_changed.body'] = CONSOLE_NOTIFICATION_TEXTS.price_changed.body;
  out['notif.price_changed.lower.title'] = CONSOLE_NOTIFICATION_TEXTS.price_changed.lower.title;
  out['notif.price_changed.lower.body'] = CONSOLE_NOTIFICATION_TEXTS.price_changed.lower.body;
  notif('profile_changed_by_admin', CONSOLE_NOTIFICATION_TEXTS.profile_changed_by_admin, out);
  notif('announcement', CONSOLE_NOTIFICATION_TEXTS.announcement, out);
  out['notif.assist_task.felmondas.title'] = 'Felmondás: {clientName}';
  out['notif.assist_task.felmondas.body'] = `${TERMINATION_TEXTS.accTaskMeghatalmazas}; ${TERMINATION_TEXTS.accTaskTechUser.toLowerCase()}.`;
  out['notif.subscription_canceled.megszuntetes.title'] = 'Lezártuk a vállalkozásod ügyeit';
  out['notif.subscription_canceled.megszuntetes.body'] = CLOSING_TEXTS.subscriptionClosed;
  return out;
}
