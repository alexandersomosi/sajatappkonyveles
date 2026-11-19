// SPEC §28.K.7 – employees / EFO. We do not do payroll now: the client answers "Van alkalmazottad vagy egyszerűsített
// foglalkoztatottad (EFO)?" (onboarding + the monthly check); any answer except "Nincs" waits for the accountant's
// decision (individual offer, payroll elsewhere, decline). Until an activation-allowing decision exists the Előfizetés
// stays locked – no card is charged before it.
import { eq } from 'drizzle-orm';
import type { EmployerStatusView } from '../_shared/api.js';
import { EMPLOYER_DECISION_CLIENT_TEXTS } from '../_shared/bekotes.js';
import { EMPLOYER_DECISIONS_ALLOW_ACTIVATION, EMPLOYER_RULES, type EmployerAnswer, type EmployerDecision } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { clientEmployerStatus } from '../db/schema.js';
import { audit } from '../audit.js';
import { E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { accountantUserOf } from './team.js';
import { clientName, type ClientRow } from './people.js';

export type EmployerRow = typeof clientEmployerStatus.$inferSelect;

export async function employerRow(db: DbOrTx, clientId: string): Promise<EmployerRow | null> {
  const [r] = await db.select().from(clientEmployerStatus).where(eq(clientEmployerStatus.clientId, clientId)).limit(1);
  return r ?? null;
}

export function blocksActivation(r: Pick<EmployerRow, 'answer' | 'decision'> | null): boolean {
  if (!r || r.answer === 'nincs') return false;
  return !r.decision || !EMPLOYER_DECISIONS_ALLOW_ACTIVATION.includes(r.decision);
}

export function employerView(r: EmployerRow | null): EmployerStatusView | null {
  if (!r) return null;
  return {
    answer: r.answer,
    answeredAt: r.answeredAt.toISOString(),
    source: r.source,
    decision: r.decision,
    clientText: r.clientText,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    blocksActivation: blocksActivation(r),
  };
}

/** The client's answer (onboarding / monthly check). A changed non-"Nincs" answer resets the decision. */
export async function setEmployerAnswer(deps: Deps, db: DbOrTx, cl: ClientRow, answer: EmployerAnswer, source: 'onboarding' | 'havi_ellenorzes', userId: string): Promise<EmployerRow> {
  const prev = await employerRow(db, cl.id);
  const changed = !prev || prev.answer !== answer;
  const v = {
    answer,
    answeredAt: deps.now(),
    source,
    ...(changed ? { decision: null, clientText: null, decidedBy: null, decidedAt: null } : {}),
  };
  const [row] = await db.insert(clientEmployerStatus).values({ clientId: cl.id, ...v }).onConflictDoUpdate({ target: clientEmployerStatus.clientId, set: v }).returning();
  await audit(db, { action: 'employer.answered', actorUserId: userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { answer, source } });
  if (answer !== 'nincs' && changed) {
    const acc = await accountantUserOf(db, cl);
    if (acc) await notify(deps, db, { userId: acc.userId, kind: 'employer_reported', params: { clientName: clientName(cl) }, link: `/ugyfelek/${cl.id}` });
  }
  return row!;
}

/** POST /acc/clients/:id/employer */
export async function decideEmployer(
  deps: Deps,
  db: DbOrTx,
  cl: ClientRow,
  d: { decision: EmployerDecision; clientText?: string; staffNote?: string; offerAmountText?: string },
  actor: { userId: string; role: string },
): Promise<EmployerRow> {
  const prev = await employerRow(db, cl.id);
  if (!prev) throw E.conflict('Az ügyfél még nem válaszolt az alkalmazottakról.');
  const text = (d.clientText?.trim() || EMPLOYER_DECISION_CLIENT_TEXTS[d.decision] || '').slice(0, EMPLOYER_RULES.clientTextMaxChars);
  if (d.decision !== 'nincs_teendo' && !text) throw E.validation({ clientText: 'Írd meg az ügyfélnek, mit döntöttél.' });
  const clientText = d.offerAmountText?.trim() ? `${text}\nAjánlat: ${d.offerAmountText.trim().slice(0, 120)}` : text;
  const [row] = await db
    .update(clientEmployerStatus)
    .set({ decision: d.decision, clientText: clientText || null, staffNote: d.staffNote?.slice(0, 1000) ?? prev.staffNote, decidedBy: actor.userId, decidedAt: deps.now() })
    .where(eq(clientEmployerStatus.clientId, cl.id))
    .returning();
  await audit(db, { action: 'employer.decided', actorUserId: actor.userId, actorRole: actor.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { decision: d.decision } });
  await notify(deps, db, { userId: cl.userId, kind: 'employer_decided', variant: d.decision, params: await accountantParams(db, cl.accountantId), link: '/' });
  return row!;
}
