// SPEC §32 (éves ciklus és KATA, F0 + F1a): editable content defaults generated from kod/shared/src/kata.ts at start;
// DB rows in content_texts override them and /admin/szovegek edits them with the usual placeholder check.
//   kata.f1.*         – Főoldal / Határidők lines of a KATA client (KATA_F1_TEXTS)
//   fizetes.*         – the shared payment sheet /fizetes/[id] (PAYMENT_SHEET_TEXTS)
//   kata.mentes_ok.*  – the free-month reasons (KATA_EXEMPT_LABELS)
//   kata.panel.*      – the accountant's wording (KATA_PANEL_TEXTS)
//   notif.tax_due_soon.kata|kata_ma|kata_lejart|kata_ev_vege, notif.limit_warning.kata*, notif.tax_payment_verified.kata,
//   notif.tax_payment_mismatch.kata, notif.tax_task.* and email.tax_due_soon.kata_ev_vege.body
import { KATA_EXEMPT_LABELS, KATA_F1_TEXTS, KATA_NOTIFICATION_TEXTS, KATA_PANEL_TEXTS, PAYMENT_SHEET_TEXTS } from '../_shared/kata.js';
import { flatten } from './k28.js';
import { snake } from './tulaj1119.js';

export function kataDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  flatten('kata.f1', KATA_F1_TEXTS, out);
  flatten('fizetes', PAYMENT_SHEET_TEXTS, out);
  flatten('kata.mentes_ok', KATA_EXEMPT_LABELS, out);
  flatten('kata.panel', KATA_PANEL_TEXTS, out);
  for (const kind of ['tax_due_soon', 'limit_warning', 'tax_payment_verified', 'tax_payment_mismatch', 'tax_task'] as const) {
    for (const [v, t] of Object.entries(KATA_NOTIFICATION_TEXTS[kind] as Record<string, { title: string; body: string }>)) {
      out[`notif.${kind}.${snake(v)}.title`] = t.title;
      out[`notif.${kind}.${snake(v)}.body`] = t.body;
    }
  }
  // tax_task is used only with variants; its base keys (notify() falls back to them) are the first variant's
  out['notif.tax_task.title'] = KATA_NOTIFICATION_TEXTS.tax_task.kata_ev_vege.title;
  out['notif.tax_task.body'] = KATA_NOTIFICATION_TEXTS.tax_task.kata_ev_vege.body;
  out['email.tax_due_soon.kata_ev_vege.body'] = KATA_NOTIFICATION_TEXTS.kataEvVegeEmail;
  return out;
}

/** The content key of a KATA_F1_TEXTS entry ('keretCim' → 'kata.f1.keret_cim'). */
export function kataF1Key(k: keyof typeof KATA_F1_TEXTS): string {
  return `kata.f1.${snake(k)}`;
}
