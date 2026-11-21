// SPEC §32.B (éves ciklus, F2/F3): editable content defaults generated from kod/shared/src/eves.ts at start; DB rows in
// content_texts override them and /admin/szovegek edits them with the usual placeholder check.
//   eves.ciklus.*            – the client's annual screens (summary, refund card, timeline, önellenőrzés)
//   eves.panel.*, onell.panel.*, folyoszamla.panel.*, ev_attekinto.* – the accountant's wording
//   notif.annual_status.*, notif.correction_status.*, notif.tax_due_soon.(eves|kata_kulonado|hipa_eves|onell),
//   notif.tax_payment_verified.*, notif.tax_task.* and email.<kind>.<variant>.body
import { EVES_EMAIL_TEXTS, EVES_NOTIFICATION_TEXTS, EVES_PANEL_TEXTS, EVES_TEXTS, EV_ATTEKINTO_TEXTS, FOLYOSZAMLA_TEXTS, ONELL_PANEL_TEXTS } from '../_shared/eves.js';
import { flatten } from './k28.js';
import { snake } from './tulaj1119.js';

export function evesDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  flatten('eves.ciklus', EVES_TEXTS, out);
  flatten('eves.panel', EVES_PANEL_TEXTS, out);
  flatten('onell.panel', ONELL_PANEL_TEXTS, out);
  flatten('folyoszamla.panel', FOLYOSZAMLA_TEXTS, out);
  flatten('ev_attekinto', EV_ATTEKINTO_TEXTS, out);
  for (const [kind, block] of Object.entries(EVES_NOTIFICATION_TEXTS)) {
    for (const [v, t] of Object.entries(block as Record<string, { title: string; body: string }>)) {
      out[`notif.${kind}.${snake(v)}.title`] = t.title;
      out[`notif.${kind}.${snake(v)}.body`] = t.body;
    }
  }
  // correction_status is used only with variants; its base keys (notify() falls back to them) are the first variant's
  out['notif.correction_status.title'] = EVES_NOTIFICATION_TEXTS.correction_status.jovahagyasra_var.title;
  out['notif.correction_status.body'] = EVES_NOTIFICATION_TEXTS.correction_status.jovahagyasra_var.body;
  for (const [k, body] of Object.entries(EVES_EMAIL_TEXTS)) out[`email.${k}.body`] = body;
  return out;
}
