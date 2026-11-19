// Resolving "who is this" for the ownership guard (SPEC §4.2) and public person views.
import { and, eq } from 'drizzle-orm';
import type { AccountantPublic } from '../_shared/api.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients } from '../db/schema.js';
import { E } from '../lib/errors.js';

export type ClientRow = typeof clients.$inferSelect;
export type AccountantRow = typeof accountants.$inferSelect;

export async function clientOfUser(db: DbOrTx, userId: string): Promise<ClientRow> {
  const [c] = await db.select().from(clients).where(eq(clients.userId, userId)).limit(1);
  if (!c) throw E.notFound('Ehhez a fiókhoz nem tartozik ügyféladat.');
  return c;
}

/** A deactivated accountant (offboarded subcontractor) is treated as non-existent: 404 everywhere. */
export async function accountantOfUser(db: DbOrTx, userId: string): Promise<AccountantRow> {
  const [a] = await db.select().from(accountants).where(eq(accountants.userId, userId)).limit(1);
  if (!a || !a.active) throw E.notFound();
  return a;
}

/** Accountant routes: the client must be assigned to this accountant, else 404 (no enumeration). */
export async function assignedClient(db: DbOrTx, accountantId: string, clientId: string): Promise<ClientRow> {
  const [c] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.accountantId, accountantId)))
    .limit(1);
  if (!c) throw E.notFound();
  return c;
}

export function accountantPublic(a: AccountantRow | null | undefined): AccountantPublic {
  if (!a)
    return {
      id: '',
      displayName: 'Hamarosan kiderül',
      firstName: 'A könyvelőd',
      nameForms: { with: 'a könyvelőddel', from: 'a könyvelődtől', onto: 'a könyvelődre', acc: 'a könyvelődet' },
      title: 'Mérlegképes könyvelő',
      registrationNumber: '',
      avatarKey: 'karakter_1_lapos',
      signatureSvgPath: null,
      responseTimeText: 'A lehető leggyorsabban válaszol',
    };
  return {
    id: a.id,
    displayName: a.displayName,
    firstName: a.firstName,
    nameForms: {
      with: a.nameWith ?? `${a.firstName}val`,
      from: a.nameFrom ?? `${a.firstName}tól`,
      onto: a.nameOnto ?? `${a.firstName}ra`,
      acc: a.nameAcc ?? `${a.firstName}t`,
    },
    title: a.title,
    registrationNumber: a.registrationNumber ?? '',
    avatarKey: a.avatarKey,
    signatureSvgPath: a.signatureSvgPath,
    responseTimeText: a.responseTimeText,
  };
}

export async function accountantById(db: DbOrTx, id: string | null | undefined): Promise<AccountantRow | null> {
  if (!id) return null;
  const [a] = await db.select().from(accountants).where(eq(accountants.id, id)).limit(1);
  return a ?? null;
}

export function clientName(c: Pick<ClientRow, 'lastName' | 'firstName'>): string {
  return `${c.lastName} ${c.firstName}`.trim();
}

const WORDS = ['nulla', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc', 'tíz'];
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}
