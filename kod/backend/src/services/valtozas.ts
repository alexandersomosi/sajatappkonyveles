// SPEC §28.5 – change guides ("Változás-útmutatók") and the assisted path for changes ("Bejelentjük helyetted"), with the
// §28.K.1 prepayment (status 'dijra_var' until SimplePay FINISHED). Our accountant files ONLY as the client's registered
// meghatalmazott with his own login; no client login data is ever asked or stored. State machine of §28.5.5:
//   dijra_var → (visszahivas_kerve →) egyeztetve → meghatalmazas_el (change-ready) → ugyfel_engedelyezte (consent)
//   → bejelentes_bekuldve (ev-filed + NAV PDF) → kesz (change-done by csapat/admin – four eyes).
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { AssistView, ChangeData, ChangeFollowupView, ChangeGuidesView, FeeChargeView, Guide, GuideField, GuideStep } from '../_shared/api.js';
import { CHANGE_FOLLOWUP_LABELS, huLongDate, personaliseChangeGuide, type ChangeGuideData } from '../_shared/bekotes.js';
import {
  ASSIST_KIND_LABELS,
  CHANGE_ACTIVITY_MODES,
  CHANGE_ADOADAT_VALID_UNTIL,
  CHANGE_FOLLOWUP_KEYS,
  CHANGE_KIND_ICON,
  CHANGE_KINDS,
  CHANGE_RULES,
  CHANGE_TAX_ITEMS,
  CHANGE_TAX_ITEMS_CALL_FIRST,
  CHANGE_UGYSEGED_KINDS,
  GUIDE_ACTION_LABELS,
  SEAT_RIGHTS,
  STREET_TYPES,
  WORK_KINDS,
  changeFeeKind,
  type AssistStatus,
  type ChangeKind,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { assistRequests, clients, systemState } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { markdownToPdf } from '../lib/pdf.js';
import { accountantParams, notify } from '../notify/notify.js';
import { assistView, isOpenAssist, OPEN_ASSIST, type AssistRow } from './assist.js';
import { createCallback } from './callbacks.js';
import { cancelChargeFor, chargeById, createFeeCharge, feeChargeView, feeSetting } from './dijak.js';
import { steps } from './onboarding.js';
import { createDocumentFromBuffer } from './system-docs.js';
import { accountantUserOf, notifyQueueOwners, type StaffActor } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { fmt } from './kedvezmeny.js';
import { closePause, openPause } from './szuneteltetes.js';

export const isChangeKind = (k: string | null | undefined): k is ChangeKind => (CHANGE_KINDS as readonly string[]).includes(k ?? '');

/** env CHANGE_UGYSEGED_VALID_UNTIL (default 2026-12-31) – the EV register moves to the chamber in 2027. */
export function validUntilOf(deps: Deps, kind: ChangeKind): string {
  if (kind === 'valtozas_adoadat') return CHANGE_ADOADAT_VALID_UNTIL;
  return process.env.CHANGE_UGYSEGED_VALID_UNTIL && /^\d{4}-\d{2}-\d{2}$/.test(process.env.CHANGE_UGYSEGED_VALID_UNTIL) ? process.env.CHANGE_UGYSEGED_VALID_UNTIL : '2026-12-31';
}
const doneByFilerAllowed = () => process.env.CHANGE_DONE_BY_FILER_ALLOWED === 'true';

// ---------------------------------------------------------------------------------------------------------------------
// ChangeData validation (§28.5.6)
// ---------------------------------------------------------------------------------------------------------------------
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' });
const navAddress = z.strictObject({
  zip: z.string().trim().regex(/^[1-9]\d{3}$/, { error: 'Négyjegyű irányítószám kell (például 1136).' }),
  city: z.string().trim().min(1, { error: 'Írd be a települést.' }).max(60),
  district: z.string().trim().max(10).nullish(),
  streetName: z.string().trim().min(1, { error: 'Írd be a közterület nevét.' }).max(80),
  streetType: z.string().trim().min(1, { error: 'Válaszd ki a közterület jellegét.' }).max(30).refine((v) => (STREET_TYPES as readonly string[]).includes(v) || v.length > 0, { error: 'Válaszd ki a közterület jellegét.' }),
  houseNumber: z.string().trim().min(1, { error: 'Írd be a házszámot vagy a helyrajzi számot.' }).max(20),
  building: z.string().trim().max(10).nullish(),
  staircase: z.string().trim().max(10).nullish(),
  floor: z.string().trim().max(10).nullish(),
  door: z.string().trim().max(10).nullish(),
});
const activity = z.object({ key: z.string().max(80).nullable(), label: z.string().trim().min(1).max(200), main: z.boolean() }).passthrough();
export const changeDataSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('valtozas_szekhely'), address: navAddress, effectiveOn: iso, right: z.enum(SEAT_RIGHTS), provider: z.object({ name: z.string().trim().max(120), adoszam: z.string().trim().max(20) }).nullish(), alsoHomeAddress: z.boolean() }),
  z.strictObject({ kind: z.literal('valtozas_telephely'), address: navAddress, effectiveOn: iso, right: z.enum(SEAT_RIGHTS), label: z.string().trim().max(80).nullish() }),
  z.strictObject({ kind: z.literal('valtozas_tevekenyseg'), mode: z.enum(CHANGE_ACTIVITY_MODES), activities: z.array(activity).max(10), ownWords: z.string().trim().max(300).nullish(), keepOldMain: z.boolean(), effectiveOn: iso }),
  z.strictObject({ kind: z.literal('valtozas_szuneteltetes'), from: iso, to: iso.nullable() }),
  z.strictObject({ kind: z.literal('valtozas_adoadat'), items: z.array(z.enum(CHANGE_TAX_ITEMS)).min(1, { error: 'Válaszd ki, mi változik.' }), workKind: z.enum(WORK_KINDS).nullish(), effectiveOn: iso, note: z.string().trim().max(CHANGE_RULES.noteMaxChars).nullish() }),
  z.strictObject({ kind: z.literal('valtozas_folytatas'), from: iso }),
]) as unknown as z.ZodType<ChangeData>;

/** Date rules that need "today" (§28.5.6). Throws a field-level 400. */
export function checkChangeDates(deps: Deps, c: ChangeData): void {
  const today = todayBudapest(deps.now());
  if (c.kind === 'valtozas_szuneteltetes') {
    if (c.from < today) throw E.validation({ 'change.from': 'A szüneteltetés nem kezdődhet a múltban.' });
    if (c.from > addDays(today, CHANGE_RULES.szunetelStartMaxAheadDays)) throw E.validation({ 'change.from': `Legfeljebb ${CHANGE_RULES.szunetelStartMaxAheadDays} nappal előre.` });
    if (c.to && (c.to < c.from || c.to > `${Number(c.from.slice(0, 4)) + CHANGE_RULES.szunetelMaxYears}${c.from.slice(4)}`)) throw E.validation({ 'change.to': 'Legfeljebb két évig tarthat.' });
  }
  if (c.kind === 'valtozas_folytatas' && (c.from < today || c.from > addDays(today, CHANGE_RULES.folytatasMaxAheadDays))) throw E.validation({ 'change.from': 'Az újrakezdés napja ma vagy legfeljebb 60 nap múlva lehet.' });
  if (c.kind === 'valtozas_tevekenyseg' && !c.activities.length && !c.ownWords?.trim()) throw E.validation({ 'change.activities': 'Válassz legalább egy tevékenységet, vagy írd le a saját szavaiddal.' });
}

export function effectiveOnOf(c: ChangeData): string {
  return 'effectiveOn' in c ? c.effectiveOn : c.from;
}

// ---------------------------------------------------------------------------------------------------------------------
// guides (§28.5.2–§28.5.3)
// ---------------------------------------------------------------------------------------------------------------------
const progressKey = (clientId: string, kind: ChangeKind) => `valtozas_utmutato:${clientId}:${kind}`;

export async function changeProgress(db: DbOrTx, clientId: string, kind: ChangeKind): Promise<string[]> {
  const [r] = await db.select().from(systemState).where(eq(systemState.key, progressKey(clientId, kind))).limit(1);
  const v = (r?.value as { done?: unknown } | null)?.done;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export async function setChangeProgress(deps: Deps, db: DbOrTx, clientId: string, kind: ChangeKind, done: string[]): Promise<void> {
  const value = { done: [...new Set(done)].slice(0, 40) };
  await db.insert(systemState).values({ key: progressKey(clientId, kind), value }).onConflictDoUpdate({ target: systemState.key, set: { value, updatedAt: deps.now() } });
}

async function latestChange(db: DbOrTx, clientId: string, kind: ChangeKind): Promise<AssistRow | null> {
  const [r] = await db.select().from(assistRequests).where(and(eq(assistRequests.clientId, clientId), eq(assistRequests.kind, kind))).orderBy(desc(assistRequests.createdAt)).limit(1);
  return r ?? null;
}

export async function buildChangeGuide(deps: Deps, db: DbOrTx, cl: ClientRow, kind: ChangeKind): Promise<Guide> {
  const open = await latestChange(db, cl.id, kind);
  const params = await accountantParams(db, cl.accountantId);
  const p = personaliseChangeGuide(kind, {
    change: open && isOpenAssist(open.status) && open.changeData ? (open.changeData as unknown as ChangeGuideData) : null,
    firstName: String(params.firstName),
    progress: await changeProgress(db, cl.id, kind),
    ugysegedValidUntil: validUntilOf(deps, kind),
  });
  const steps: GuideStep[] = p.steps.map((st) => ({ ...st, fields: st.fields.map((f): GuideField => ({ ...f, actionLabel: GUIDE_ACTION_LABELS[f.action] })) }));
  const outdated = todayBudapest(deps.now()) > p.validUntil;
  return {
    kind,
    version: p.version,
    title: p.title,
    intro: p.intro,
    outro: p.outro,
    video: null,
    prepare: [],
    steps,
    imagesManifest: `utmutato/${kind}/kepek.json`,
    outdated,
    outdatedText: outdated ? await deps.content.render('valtozas.elavult', params).then((t) => t || '2027-től a vállalkozói nyilvántartást a kamara vezeti. Ezt az útmutatót frissítjük; addig kérj visszahívást, és segítünk.') : null,
    ...(kind === 'valtozas_tevekenyseg' ? { activityPending: p.activityPending } : {}),
  };
}

export async function changeGuidesView(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<ChangeGuidesView> {
  const today = todayBudapest(deps.now());
  const items: ChangeGuidesView['items'] = [];
  for (const kind of CHANGE_KINDS) {
    const open = await latestChange(db, cl.id, kind);
    items.push({
      kind,
      title: await deps.content.get(`valtozas.sorok.${kind}.title`),
      line: await deps.content.get(`valtozas.sorok.${kind}.line`),
      icon: CHANGE_KIND_ICON[kind],
      outdated: today > validUntilOf(deps, kind),
      openAssist: open && isOpenAssist(open.status) ? await changeAssistView(deps, db, open) : null,
    });
  }
  return { items };
}

// ---------------------------------------------------------------------------------------------------------------------
// the client's view of a change assist
// ---------------------------------------------------------------------------------------------------------------------
export async function changeAssistView(deps: Deps, db: DbOrTx, row: AssistRow): Promise<AssistView> {
  const base = await assistView(deps, db, row);
  if (!isChangeKind(row.kind)) return base;
  const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
  const params = await accountantParams(db, cl?.accountantId);
  const ch = await chargeById(db, row.feeChargeId);
  const key = `valtozas.allapot.${row.status}`;
  const statusText = (await deps.content.exists(key)) ? await deps.content.render(key, { ...params, dij: ch ? fmt(ch.amountHuf) : '' }) : base.statusText;
  const c = row.changeData ?? null;
  return {
    ...base,
    statusText,
    ball: row.status === 'dijra_var' ? 'ugyfel' : base.ball,
    canConsent: row.status === 'meghatalmazas_el' && !row.consentValid,
    change: c,
    activityPending: Boolean(c && c.kind === 'valtozas_tevekenyseg' && (c.ownWords?.trim() || c.activities.some((a) => !a.key))),
    feeCharge: ch ? await feeChargeView(deps, db, ch) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// create / edit (client)
// ---------------------------------------------------------------------------------------------------------------------
export interface ChangeRequestInput {
  cl: ClientRow;
  kind: ChangeKind;
  change: ChangeData;
  callback?: boolean;
  phone?: string;
  window?: 'barmikor' | 'delelott' | 'delutan';
  note?: string | null;
  source: string;
  by: { userId: string };
}

export async function requestChangeAssist(deps: Deps, db: DbOrTx, i: ChangeRequestInput): Promise<{ row: AssistRow; callbackId: string | null; feeCharge: FeeChargeView | null }> {
  const { cl, kind, change } = i;
  if (change.kind !== kind) throw E.validation({ 'change.kind': 'A változás fajtája nem egyezik.' });
  checkChangeDates(deps, change);
  const st = await steps(db, cl.id);
  if (st.get('szerzodes')?.status !== 'kesz') throw E.stepLocked('Előbb fogadd el a szerződést.');
  if (todayBudapest(deps.now()) > validUntilOf(deps, kind)) throw new ApiError(409, 'assist_disabled', 'Ezt most nem tudjuk helyetted bejelenteni: 2027-től a vállalkozói nyilvántartást a kamara vezeti. Kérj visszahívást, és segítünk.');
  const [same] = await db.select().from(assistRequests).where(and(eq(assistRequests.clientId, cl.id), eq(assistRequests.kind, kind), inArray(assistRequests.status, [...OPEN_ASSIST, 'dijra_var'] as AssistStatus[]))).limit(1);
  if (same) throw new ApiError(409, 'assist_already_open', 'Ezt már kérted. Az állapotát a Változás a vállalkozásodban oldalon látod.', undefined, { assist: await changeAssistView(deps, db, same) });
  const items = change.kind === 'valtozas_adoadat' ? change.items : [];
  const callFirst = items.some((x) => CHANGE_TAX_ITEMS_CALL_FIRST.includes(x));
  const wantCall = Boolean(i.callback) || callFirst;
  const feeKind = callFirst ? null : changeFeeKind(kind, items);
  const now = deps.now();
  const [row0] = await db
    .insert(assistRequests)
    .values({ clientId: cl.id, kind, status: 'egyeztetve', statusChangedAt: now, createdByRole: 'client', createdByUserId: i.by.userId, changeData: change, changeEffectiveOn: effectiveOnOf(change), createdAt: now, updatedAt: now })
    .returning();
  let row = row0!;
  let callbackId: string | null = null;
  if (wantCall) {
    const cb = await createCallback(deps, db, {
      cl,
      ...(i.phone ? { phone: i.phone } : {}),
      topic: 'valtozas_helyettem',
      window: i.window ?? 'barmikor',
      note: i.note ?? null,
      source: 'helyettunk_valtozas',
      createdByRole: 'client',
      createdByUserId: i.by.userId,
    } as Parameters<typeof createCallback>[2]);
    callbackId = cb.id;
  }
  const charge = feeKind ? await createFeeCharge(deps, db, cl, feeKind, { type: 'valtozas', assistId: row.id }, i.by.userId) : null;
  const status: AssistStatus = charge ? 'dijra_var' : wantCall ? 'visszahivas_kerve' : 'egyeztetve';
  row = ((await db.update(assistRequests).set({ status, callbackId, feeChargeId: charge?.id ?? null }).where(eq(assistRequests.id, row.id)).returning())[0] ?? row) as AssistRow;
  await audit(db, { action: 'assist.created', actorUserId: i.by.userId, actorRole: 'client', targetType: 'assist', targetId: row!.id, clientId: cl.id, details: { kind, source: i.source, withCallback: wantCall, fee: feeKind } });
  if (status === 'egyeztetve') {
    const acc = await accountantUserOf(db, cl);
    if (acc) await notify(deps, db, { userId: acc.userId, kind: 'assist_task', variant: 'valtozas_adatok', params: { clientName: clientName(cl), kindLabel: ASSIST_KIND_LABELS[kind] }, link: `/helyettunk/${row!.id}` });
  }
  if (charge) {
    const params = await accountantParams(db, cl.accountantId);
    await notify(deps, db, { userId: cl.userId, kind: 'fee_due', variant: 'valtozas', params: { ...params, dij: fmt(charge.amountHuf) }, link: '/fiok/dijak', noPush: true });
  }
  return { row: row!, callbackId, feeCharge: charge ? await feeChargeView(deps, db, charge) : null };
}

/** PUT /client/assist/:id/change – allowed until 'bejelentes_bekuldve'; invalidates the consent. */
export async function updateChangeData(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, change: ChangeData, userId: string): Promise<AssistRow> {
  const [row] = await db.select().from(assistRequests).where(and(eq(assistRequests.id, id), eq(assistRequests.clientId, cl.id))).limit(1).for('update');
  if (!row || !isChangeKind(row.kind)) throw E.notFound();
  if (change.kind !== row.kind) throw E.validation({ 'change.kind': 'A változás fajtája nem egyezik.' });
  if (!['dijra_var', 'visszahivas_kerve', 'egyeztetve', 'meghatalmazas_el', 'ugyfel_engedelyezte'].includes(row.status)) throw new ApiError(409, 'assist_wrong_status', 'Ezt már beküldtük, nem módosítható. Írj nekünk, ha valami nem stimmel.');
  checkChangeDates(deps, change);
  const back: AssistStatus = row.status === 'ugyfel_engedelyezte' ? 'meghatalmazas_el' : row.status;
  const [u] = await db
    .update(assistRequests)
    .set({ changeData: change, changeEffectiveOn: effectiveOnOf(change), consentValid: false, status: back, ...(back !== row.status ? { statusChangedAt: deps.now() } : {}), updatedAt: deps.now() })
    .where(eq(assistRequests.id, row.id))
    .returning();
  await audit(db, { action: 'assist.change_updated', actorUserId: userId, actorRole: 'client', targetType: 'assist', targetId: row.id, clientId: cl.id, details: { kind: row.kind, consentInvalidated: row.consentValid } });
  return u!;
}

// ---------------------------------------------------------------------------------------------------------------------
// consent (§28.5.5, the §27.3.3 S17 pattern)
// ---------------------------------------------------------------------------------------------------------------------
export const CHANGE_CONSENT_VERSION = '2026-11-19';

export function addressLine(a: { zip: string; city: string; district?: string | null; streetName: string; streetType: string; houseNumber: string; building?: string | null; staircase?: string | null; floor?: string | null; door?: string | null }): string {
  const extra = [a.building && `${a.building}. épület`, a.staircase && `${a.staircase}. lépcsőház`, a.floor && `${a.floor}. emelet`, a.door && `${a.door}. ajtó`].filter(Boolean).join(', ');
  return `${a.zip} ${a.city}${a.district ? ` ${a.district}. kerület` : ''}, ${a.streetName} ${a.streetType} ${a.houseNumber}.${extra ? ` ${extra}` : ''}`;
}

export function changeBlocks(c: ChangeData): { key: string; title: string; lines: string[]; editRoute: string | null }[] {
  const edit = `/valtozas/${c.kind}/urlap`;
  switch (c.kind) {
    case 'valtozas_szekhely':
      return [
        { key: 'cim', title: 'Az új székhely', lines: [addressLine(c.address), 'Ez a cím nyilvános lesz.'], editRoute: edit },
        { key: 'datum', title: 'Mikortól', lines: [huLongDate(c.effectiveOn)], editRoute: edit },
        { key: 'jogcim', title: 'Jogcím', lines: [c.right, ...(c.provider ? [`Székhelyszolgáltató: ${c.provider.name}`] : [])], editRoute: edit },
      ];
    case 'valtozas_telephely':
      return [
        { key: 'cim', title: 'Az új telephely', lines: [addressLine(c.address)], editRoute: edit },
        { key: 'datum', title: 'Mikortól', lines: [huLongDate(c.effectiveOn)], editRoute: edit },
      ];
    case 'valtozas_tevekenyseg':
      return [
        { key: 'mi', title: 'Mi változik', lines: [c.mode === 'uj_fo' ? 'Új fő tevékenység' : c.mode === 'uj_mellek' ? 'Új tevékenység a mostani mellett' : 'Egy tevékenység befejezése'], editRoute: edit },
        { key: 'tevekenyseg', title: 'Tevékenység', lines: [...c.activities.map((a) => a.label), ...(c.ownWords ? [c.ownWords] : [])], editRoute: edit },
        { key: 'datum', title: 'Mikortól', lines: [huLongDate(c.effectiveOn)], editRoute: edit },
      ];
    case 'valtozas_szuneteltetes':
      return [{ key: 'datum', title: 'Szüneteltetés', lines: [`Kezdete: ${huLongDate(c.from)}`, ...(c.to ? [`Vége: ${huLongDate(c.to)}`] : [])], editRoute: edit }];
    case 'valtozas_folytatas':
      return [{ key: 'datum', title: 'Újrakezdés', lines: [`Napja: ${huLongDate(c.from)}`], editRoute: edit }];
    case 'valtozas_adoadat':
      return [
        { key: 'mi', title: 'Mi változik', lines: c.items.map(String), editRoute: edit },
        { key: 'datum', title: 'Mikortól', lines: [huLongDate(c.effectiveOn)], editRoute: edit },
      ];
  }
}

export function changeConsentHash(blocks: ReturnType<typeof changeBlocks>, version: string): string {
  return createHash('sha256').update(JSON.stringify({ version, blocks: blocks.map((b) => ({ key: b.key, title: b.title, lines: b.lines })) })).digest('hex');
}

export async function changeConsentSummary(deps: Deps, db: DbOrTx, row: AssistRow) {
  const c = row.changeData;
  if (!c) throw E.notFound();
  const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
  const acc = cl ? await accountantUserOf(db, cl) : null;
  const params = await accountantParams(db, cl?.accountantId);
  const blocks = changeBlocks(c);
  const p = { ...params, valtozasNapja: huLongDate(effectiveOnOf(c)), konyveloNev: acc?.name ?? String(params.firstName) };
  return {
    version: CHANGE_CONSENT_VERSION,
    hash: changeConsentHash(blocks, CHANGE_CONSENT_VERSION),
    blocks,
    declarationText: await deps.content.render('valtozas.engedely.declaration', p),
    instructionText: await deps.content.render('valtozas.engedely.instruction', p),
    publicNote: c.kind === 'valtozas_szekhely' ? 'Az új székhely címe nyilvános lesz.' : '',
    missing: [] as string[],
    canConsent: row.status === 'meghatalmazas_el' || (row.status === 'ugyfel_engedelyezte' && !row.consentValid),
  };
}

export async function giveChangeConsent(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, hash: string, ctx: { userId: string; ipHmac: string; ua: string }): Promise<AssistRow> {
  const [row] = await db.select().from(assistRequests).where(and(eq(assistRequests.id, id), eq(assistRequests.clientId, cl.id))).limit(1).for('update');
  if (!row || !isChangeKind(row.kind)) throw E.notFound();
  if (row.status === 'ugyfel_engedelyezte' && row.consentValid && row.consentHash === hash) return row;
  if (row.status !== 'meghatalmazas_el' && row.status !== 'ugyfel_engedelyezte') throw new ApiError(409, 'assist_wrong_status', 'Ezt most nem tudod engedélyezni.');
  const sum = await changeConsentSummary(deps, db, row);
  if (sum.hash !== hash) throw new ApiError(409, 'assist_consent_stale', await deps.content.get('valtozas.engedely.stale'));
  const now = deps.now();
  const md = [
    `# Utasítás a változás bejelentésére`,
    ``,
    `Ügyfél: ${clientName(cl)}`,
    `Változás: ${ASSIST_KIND_LABELS[row.kind]}`,
    ``,
    ...sum.blocks.flatMap((b) => [`## ${b.title}`, ...b.lines.map((l) => `- ${l}`), '']),
    sum.declarationText,
    '',
    sum.instructionText,
    '',
    `Az alkalmazásban elektronikusan elfogadva: ${now.toISOString()}`,
    `Ellenőrző kód: ${hash}`,
    `Verzió: ${CHANGE_CONSENT_VERSION}`,
  ].join('\n');
  let docId: string | null = null;
  try {
    const pdf = await markdownToPdf(deps.cfg.fontDir, 'Utasítás a változás bejelentésére', md);
    docId = await createDocumentFromBuffer(deps, db, {
      clientId: cl.id,
      category: 'egyeb',
      title: `Utasítás: ${ASSIST_KIND_LABELS[row.kind]}`,
      month: todayBudapest(now).slice(0, 7),
      data: pdf,
      mime: 'application/pdf',
      fileName: 'valtozas_utasitas.pdf',
      source: 'rendszer',
      status: 'feldolgozva',
      by: ctx.userId,
      visibility: 'kozos',
    } as Parameters<typeof createDocumentFromBuffer>[2]);
  } catch {
    docId = null;
  }
  const [u] = await db
    .update(assistRequests)
    .set({ status: 'ugyfel_engedelyezte', statusChangedAt: now, consentAt: now, consentHash: hash, consentVersion: CHANGE_CONSENT_VERSION, consentSnapshot: sum.blocks.map((b) => ({ key: b.key, title: b.title, lines: b.lines })), consentIp: ctx.ipHmac, consentUserAgent: ctx.ua.slice(0, 120), consentValid: true, consentDocumentId: docId, updatedAt: now })
    .where(eq(assistRequests.id, row.id))
    .returning();
  await audit(db, { action: 'assist.consent_given', actorUserId: ctx.userId, actorRole: 'client', targetType: 'assist', targetId: row.id, clientId: cl.id, details: { kind: row.kind, version: CHANGE_CONSENT_VERSION } });
  const acc = await accountantUserOf(db, cl);
  if (acc) await notify(deps, db, { userId: acc.userId, kind: 'assist_task', variant: 'valtozas_bekuldes', params: { clientName: clientName(cl), kindLabel: ASSIST_KIND_LABELS[row.kind] }, link: `/helyettunk/${row.id}` });
  return u!;
}

// ---------------------------------------------------------------------------------------------------------------------
// staff actions
// ---------------------------------------------------------------------------------------------------------------------
function missingItems(row: AssistRow, needed: readonly string[]): string[] {
  return needed.filter((i) => !row.checklist?.[i]);
}

/** POST /team/assists/:id/change-ready (konyvelo, admin; the 'valtozas_adatok' phase complete) → meghatalmazas_el. */
export async function changeReady(deps: Deps, db: DbOrTx, actor: StaffActor, row: AssistRow, cl: ClientRow, kind: 'konyvelo' | 'admin' | 'csapat'): Promise<AssistRow> {
  if (kind === 'csapat') throw E.forbidden('Ezt a könyvelő jelöli.');
  if (row.status === 'dijra_var') throw new ApiError(409, 'fee_unpaid', 'Ehhez előbb ki kell fizetni a díjat.');
  if (row.status !== 'egyeztetve') throw new ApiError(409, 'assist_wrong_status', 'Ez most nem jelölhető.');
  const need = ['adatok_teljesek', 'meghatalmazas_lefedi', 'datum_rendben', ...(row.kind === 'valtozas_szekhely' || row.kind === 'valtozas_telephely' ? ['jogcim_rendben'] : []), ...(row.kind === 'valtozas_tevekenyseg' ? ['ovtj_rendben'] : [])];
  const miss = missingItems(row, need);
  if (miss.length) throw new ApiError(400, 'assist_checklist_incomplete', 'Előbb pipáld ki az összes pontot.', Object.fromEntries(miss.map((m) => [m, 'Pipáld ki.'])));
  const now = deps.now();
  const [u] = await db.update(assistRequests).set({ status: 'meghatalmazas_el', statusChangedAt: now, changeReadyAt: now, changeReadyBy: actor.userId, updatedAt: now }).where(eq(assistRequests.id, row.id)).returning();
  await audit(db, { action: 'assist.change_ready', actorUserId: actor.userId, actorRole: actor.role, targetType: 'assist', targetId: row.id, clientId: cl.id, details: { kind: row.kind } });
  await notify(deps, db, { userId: cl.userId, kind: 'assist_consent_needed', variant: 'valtozas', params: await accountantParams(db, cl.accountantId), link: `/valtozas/engedely?assist=${row.id}` });
  return u!;
}

/** ev-filed for a change kind: the NAV értesítés is uploaded by the route (document category nav_visszaigazolas). */
export async function changeFiled(deps: Deps, db: DbOrTx, actor: StaffActor, row: AssistRow, cl: ClientRow, kind: 'konyvelo' | 'admin' | 'csapat'): Promise<AssistRow> {
  if (kind === 'csapat') throw E.forbidden('Ezt csak a könyvelő küldheti be, a saját belépésével.');
  if (row.status !== 'ugyfel_engedelyezte' || !row.consentValid) throw new ApiError(409, 'assist_wrong_status', 'Előbb az ügyfélnek engedélyeznie kell a bejelentést.');
  const miss = missingItems(row, ['kepviseletvalaszto', 'adatok_egyeznek', 'valtozas_bekuldve']);
  if (miss.length) throw new ApiError(400, 'assist_checklist_incomplete', 'Előbb pipáld ki az összes pontot.', Object.fromEntries(miss.map((m) => [m, 'Pipáld ki.'])));
  const now = deps.now();
  const [u] = await db.update(assistRequests).set({ status: 'bejelentes_bekuldve', statusChangedAt: now, evFiledAt: now, evFiledBy: actor.userId, updatedAt: now }).where(eq(assistRequests.id, row.id)).returning();
  await audit(db, { action: 'assist.ev_filed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'assist', targetId: row.id, clientId: cl.id, details: { kind: row.kind } });
  await notify(deps, db, { userId: cl.userId, kind: 'assist_ev_filed', variant: 'valtozas', params: await accountantParams(db, cl.accountantId), link: '/valtozas' });
  await notifyQueueOwners(deps, db, { kind: 'assist_task', variant: 'valtozas_atnezes', params: { clientName: clientName(cl), firstName: actor.firstName, kindLabel: ASSIST_KIND_LABELS[row.kind] }, link: `/helyettunk/${row.id}` }, { except: actor.userId });
  return u!;
}

export function followupViews(row: AssistRow, refs: Map<string, NonNullable<ChangeFollowupView['by']>>): ChangeFollowupView[] {
  if (!isChangeKind(row.kind)) return [];
  const c = row.changeData;
  const p: Record<string, string> = {
    from: c && 'from' in c ? huLongDate(c.from) : c && 'effectiveOn' in c ? huLongDate(c.effectiveOn) : '',
    to: c && c.kind === 'valtozas_szuneteltetes' && c.to ? huLongDate(c.to) : 'nyitott',
    date: c ? huLongDate(effectiveOnOf(c)) : '',
  };
  return CHANGE_FOLLOWUP_KEYS[row.kind].map((key) => {
    const f = row.followups?.[key];
    const label = (CHANGE_FOLLOWUP_LABELS[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => p[k] ?? '');
    return { key, label, done: Boolean(f?.done), doneAt: f?.at ?? null, by: f?.by ? (refs.get(f.by) ?? null) : null };
  });
}

/** POST /team/assists/:id/change-done (csapat, admin; the filer only with CHANGE_DONE_BY_FILER_ALLOWED) → kesz. */
export async function changeDone(deps: Deps, db: DbOrTx, actor: StaffActor, row: AssistRow, cl: ClientRow, kind: 'konyvelo' | 'admin' | 'csapat', followups: string[] = []): Promise<AssistRow> {
  if (row.status !== 'bejelentes_bekuldve') throw new ApiError(409, 'assist_wrong_status', 'Ez most nem zárható le.');
  if (kind === 'konyvelo' && !doneByFilerAllowed()) throw E.forbidden('A lezárást a csapat vagy az admin végzi (négy szem elve).');
  if (row.evFiledBy === actor.userId && !doneByFilerAllowed()) throw E.forbidden('Aki beküldte, nem zárhatja le (négy szem elve).');
  const now = deps.now();
  const keys = CHANGE_FOLLOWUP_KEYS[row.kind as ChangeKind] ?? [];
  const fu: AssistRow['followups'] = Object.fromEntries(keys.map((k) => [k, { done: followups.includes(k), at: followups.includes(k) ? now.toISOString() : null, by: followups.includes(k) ? actor.userId : null }]));
  const [u] = await db.update(assistRequests).set({ status: 'kesz', statusChangedAt: now, changeDoneAt: now, changeDoneBy: actor.userId, followups: fu, updatedAt: now }).where(eq(assistRequests.id, row.id)).returning();
  await audit(db, { action: 'assist.change_done', actorUserId: actor.userId, actorRole: actor.role, targetType: 'assist', targetId: row.id, clientId: cl.id, details: { kind: row.kind, followups: followups.length } });
  await notify(deps, db, { userId: cl.userId, kind: 'assist_change_done', ...(row.kind === 'valtozas_szekhely' ? { variant: 'valtozas_szekhely' } : {}), params: { kindLabel: ASSIST_KIND_LABELS[row.kind] }, link: '/valtozas' });
  return u!;
}

/** PATCH /team/assists/:id/followups { key, done } – each audited; the szünetel ones also open/close the pause. */
export async function patchFollowup(deps: Deps, db: DbOrTx, actor: StaffActor, row: AssistRow, cl: ClientRow, key: string, done: boolean): Promise<AssistRow> {
  if (!isChangeKind(row.kind) || !CHANGE_FOLLOWUP_KEYS[row.kind].includes(key)) throw E.validation({ key: 'Ismeretlen teendő.' });
  if (actor.role === 'csapat') throw E.forbidden();
  const now = deps.now();
  const fu = { ...(row.followups ?? {}), [key]: { done, at: done ? now.toISOString() : null, by: done ? actor.userId : null } };
  const [u] = await db.update(assistRequests).set({ followups: fu, updatedAt: now }).where(eq(assistRequests.id, row.id)).returning();
  await audit(db, { action: 'assist.followup', actorUserId: actor.userId, actorRole: actor.role, targetType: 'assist', targetId: row.id, clientId: cl.id, details: { key, done } });
  const c = row.changeData;
  if (done && key === 'szunetel_dij' && c?.kind === 'valtozas_szuneteltetes') await openPause(deps, db, cl.id, c.from, { to: c.to, source: 'valtozas', by: actor.userId });
  if (done && key === 'szunetel_dij_lezaras' && c?.kind === 'valtozas_folytatas') await closePause(deps, db, cl.id, addDays(c.from, -1), actor.userId);
  return u!;
}

/** A cancelled / closed change assist cancels its unpaid charge (or flags a refund when no work started). */
export async function onChangeAssistEnded(deps: Deps, db: DbOrTx, row: AssistRow): Promise<void> {
  const started = Object.keys(row.checklist ?? {}).some((k) => ['adatok_teljesek', 'jogcim_rendben', 'ovtj_rendben', 'meghatalmazas_lefedi', 'datum_rendben'].includes(k));
  await cancelChargeFor(deps, db, row.feeChargeId, started);
}

export { feeSetting };
