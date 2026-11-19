// LOCAL MOCK – SPEC §27 "Intézzük helyette" (assisted path) + the staff branch change + admin client block, only in
// `--mode mock` builds. Same rules as the contract (§27.3.4 state machine, §27.9.1 roles, §27.2.3 blockers), all data
// fictional (§27.7.4: Kiss Marika, Molnár Dávid, Balogh Ilona + a few more states). Never in a normal build.
import type { MockClient } from './data';
import { uid } from './data';
import type { CsapatKieg, MCb, MReg } from './csapat';
import type {
  AdminServiceStats,
  PathHistoryItem,
  StaffRef,
  TeamAssistDetail,
  TeamAssistRow,
  TeamClientCard,
  TeamRegistrationDetail,
  TeamSummary,
} from '../_shared/api';
import {
  ASSIST_ACTION_ROLES,
  ASSIST_BALL,
  ASSIST_CHECK_LABELS,
  ASSIST_CLOSE_REASON_LABELS,
  ASSIST_KIND_LABELS,
  ASSIST_OPEN_STATUSES,
  ASSIST_RULES,
  ASSIST_UJEGYKE_JOGCIM_DEFAULT,
  CALLBACK_RULES,
  PATH_CHANGE_BLOCKER_TEXT,
  REGISTRATION_STEP_STATUS,
  type AssistAction,
  type AssistCheckItem,
  type AssistCloseReason,
  type AssistJogcim,
  type AssistKind,
  type AssistStatus,
  type RegistrationStatus,
} from '../_shared/enums';
import { fazisElemek, kisbetu, labdaNalam, lejartJovahagyas, type PanelSzerep } from '../lib/helyettunk';
import { bpDate } from '../lib/format';

type H = (x: { q: URLSearchParams; body: Record<string, unknown>; form: FormData | null; p: Record<string, string> }) => unknown;
export interface HelyettunkCtx {
  on: (m: string, path: string, h: H) => void;
  clients: MockClient[];
  role: () => string;
  nowIso: () => string;
  hiba: (status: number, code: string, msg: string, extra?: Record<string, unknown>) => Error;
  logAudit: (action: string, c: MockClient | null, details?: Record<string, unknown> | null) => void;
  fileMeta: Map<string, { title: string; kind: 'kyc' | 'doc' }>;
  kieg: CsapatKieg;
  belso: {
    regs: MReg[];
    cbs: MCb[];
    card: (k: MockClient) => TeamClientCard;
    kliens: (id: string) => MockClient;
    nev: (k: MockClient) => string;
    en: () => StaffRef;
    regDetail: (r: MReg) => TeamRegistrationDetail;
    rowOf: (c: MCb) => { overdue: boolean; dueAt: string };
    allapot: (r: MReg, s: RegistrationStatus) => void;
    regNaplo: (r: MReg, action: string, text: string) => void;
    cb: (o: Partial<MCb> & Pick<MCb, 'id' | 'clientId' | 'topic' | 'source' | 'createdAt'>) => MCb;
    ago: (h: number) => string;
    BENCE_REF: StaffRef;
    ADMIN_REF: StaffRef;
    nyitottCb: (c: MCb) => boolean;
  };
}

interface MAssist {
  id: string;
  clientId: string;
  kind: AssistKind;
  status: AssistStatus;
  statusChangedAt: string;
  callbackId: string | null;
  registrationId: string | null;
  assignee: StaffRef | null;
  createdAt: string;
  agreedAt: string | null;
  checklist: Partial<Record<AssistCheckItem, { at: string; by: StaffRef }>>;
  jogcim: AssistJogcim;
  ujegykeFiledAt: string | null;
  approvalDueOn: string | null;
  approvalExpiresAt: string | null;
  reminders: number;
  expiredCount: number;
  clientApprovedAt: string | null;
  mhLiveAt: string | null;
  consent: { at: string; hash: string; version: string; blocks: { title: string; lines: string[] }[] } | null;
  consentValid: boolean;
  evFiledAt: string | null;
  staffNote: string | null;
  closedAt: string | null;
  closedReason: AssistCloseReason | null;
  timeline: { at: string; by: StaffRef | null; action: string; text: string }[];
}

const ORA = 3_600_000;
const UGYCSOPORT_ADO = 'ADÓÜGYEK (kivéve egyes jövedéki ügyek)';
const UGYCSOPORT_EV = 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)';

export function installHelyettunk(x: HelyettunkCtx): void {
  const { on, belso: b } = x;
  const nowMs = () => Date.parse(x.nowIso());
  const ago = b.ago;
  const ANNA = b.regs.find((r) => r.assignee?.role === 'csapat')?.assignee ?? { userId: 'u-anna', name: 'Nagy Anna', firstName: 'Anna', role: 'csapat' };
  const BENCE = b.BENCE_REF;
  const plusNap = (d: string, n: number) => {
    const t = new Date(`${d}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  };
  /** + n working days (Mon–Fri), same time of day (mock of backend lib/munkanap.ts addWorkingDays). */
  const munkanap = (iso: string, n: number) => {
    const t = new Date(iso);
    let m = n;
    while (m > 0) {
      t.setUTCDate(t.getUTCDate() + 1);
      const d = t.getUTCDay();
      if (d !== 0 && d !== 6) m--;
    }
    return t.toISOString();
  };
  const pipak = (items: AssistCheckItem[], by: StaffRef, at: string) => Object.fromEntries(items.map((i) => [i, { at, by }])) as MAssist['checklist'];
  const tl = (h: number, by: StaffRef | null, action: string, text: string) => ({ at: ago(h), by, action, text });

  // ---------- demo assists (SPEC §27.7.4 + states for the queue) ----------
  const marikaFiled = ago(24);
  const liliFiled = ago(6 * 24);
  const assists: MAssist[] = [
    {
      id: 'as-marika',
      clientId: 'c-marika',
      kind: 'vallalkozas_bejelentes',
      status: 'meghatalmazas_bekuldve',
      statusChangedAt: marikaFiled,
      callbackId: 'cb-marika',
      registrationId: 'reg-marika',
      assignee: ANNA,
      createdAt: ago(60),
      agreedAt: ago(48),
      checklist: { ...pipak(fazisElemek('vallalkozas_bejelentes', 'hivas'), ANNA, ago(48)), ...pipak(fazisElemek('vallalkozas_bejelentes', 'ujegyke'), BENCE, marikaFiled) },
      jogcim: '9',
      ujegykeFiledAt: marikaFiled,
      approvalDueOn: plusNap(bpDate(marikaFiled), ASSIST_RULES.shownApprovalDays),
      approvalExpiresAt: new Date(Date.parse(marikaFiled) + ASSIST_RULES.navApprovalDays * 24 * ORA).toISOString(),
      reminders: 1,
      expiredCount: 0,
      clientApprovedAt: null,
      mhLiveAt: null,
      consent: null,
      consentValid: false,
      evFiledAt: null,
      staffNote: 'DÁP-ja van, a lánya segít neki a jóváhagyásban.',
      closedAt: null,
      closedReason: null,
      timeline: [
        tl(60, null, 'assist.created', 'Kérte az appban: „Intézzétek helyettem” – vállalkozás bejelentése'),
        tl(48, ANNA, 'assist.agreed', 'Anna felhívta, egyeztettek – elindította'),
        tl(24, BENCE, 'assist.ujegyke_filed', 'Bence beküldte az UJEGYKE-t meghatalmazottként (jogcím 9)'),
        tl(0.5, null, 'assist.reminder', 'Emlékeztetőt kapott: még nem hagyta jóvá'),
      ],
    },
    {
      id: 'as-david',
      clientId: 'c-david',
      kind: 'meghatalmazas',
      status: 'egyeztetve',
      statusChangedAt: ago(20),
      callbackId: 'cb-david',
      registrationId: null,
      assignee: ANNA,
      createdAt: ago(30),
      agreedAt: ago(20),
      checklist: pipak(fazisElemek('meghatalmazas', 'hivas'), ANNA, ago(20)),
      jogcim: '9',
      ujegykeFiledAt: null,
      approvalDueOn: null,
      approvalExpiresAt: null,
      reminders: 0,
      expiredCount: 0,
      clientApprovedAt: null,
      mhLiveAt: null,
      consent: null,
      consentValid: false,
      evFiledAt: null,
      staffNote: null,
      closedAt: null,
      closedReason: null,
      timeline: [tl(30, null, 'assist.created', 'Kérte az appban: „Megcsináljuk helyetted a meghatalmazást”'), tl(20, ANNA, 'assist.agreed', 'Anna felhívta, egyeztettek – elindította')],
    },
    {
      id: 'as-ilona',
      clientId: 'c-ilona',
      kind: 'vallalkozas_bejelentes',
      status: 'visszahivas_kerve',
      statusChangedAt: ago(20),
      callbackId: 'cb-ilona',
      registrationId: 'reg-ilona',
      assignee: null,
      createdAt: ago(20),
      agreedAt: null,
      checklist: {},
      jogcim: '9',
      ujegykeFiledAt: null,
      approvalDueOn: null,
      approvalExpiresAt: null,
      reminders: 0,
      expiredCount: 0,
      clientApprovedAt: null,
      mhLiveAt: null,
      consent: null,
      consentValid: false,
      evFiledAt: null,
      staffNote: null,
      closedAt: null,
      closedReason: null,
      timeline: [tl(20, null, 'assist.created', 'Kérte az appban: „Intézzétek helyettem” – vállalkozás bejelentése')],
    },
    {
      id: 'as-timea',
      clientId: 'c-timea',
      kind: 'vallalkozas_bejelentes',
      status: 'ugyfel_engedelyezte',
      statusChangedAt: ago(26),
      callbackId: null,
      registrationId: 'reg-timea',
      assignee: ANNA,
      createdAt: ago(200),
      agreedAt: ago(190),
      checklist: { ...pipak(fazisElemek('vallalkozas_bejelentes', 'hivas'), ANNA, ago(190)), ...pipak(fazisElemek('vallalkozas_bejelentes', 'ujegyke'), BENCE, ago(170)) },
      jogcim: '9',
      ujegykeFiledAt: ago(170),
      approvalDueOn: plusNap(bpDate(ago(170)), 3),
      approvalExpiresAt: new Date(Date.parse(ago(170)) + 96 * ORA).toISOString(),
      reminders: 1,
      expiredCount: 0,
      clientApprovedAt: ago(150),
      mhLiveAt: ago(140),
      consent: {
        at: ago(26),
        hash: '6f1c0a9e4b7d2c3a',
        version: '2026-11-19.1',
        blocks: [
          { title: 'Rólad (a NAV tölti ki)', lines: ['Vass Tímea', 'adóazonosító jel: •••••••081'] },
          { title: 'Székhely', lines: ['9021 Győr, Szalon utca 4.', 'bérleti szerződés alapján'] },
          { title: 'Telephely, fióktelep', lines: ['Nincs'] },
          { title: 'Tevékenységek', lines: ['960200 – Fodrászat és egyéb szépségápolás (fő)'] },
          { title: 'Munkavégzés jellege', lines: ['Főfoglalkozású'] },
          { title: 'Adózás', lines: ['Átalányadózás: igen · Alanyi ÁFA-mentesség: igen · Kata: nem · Pénzforgalmi elszámolás: nem · Közösségi adószám: nem'] },
          { title: 'Kezdés napja', lines: ['A beküldés napja, várhatóan november 18. Előre dátumot nem lehet megadni.'] },
        ],
      },
      consentValid: true,
      evFiledAt: null,
      staffNote: null,
      closedAt: null,
      closedReason: null,
      timeline: [
        tl(200, null, 'assist.created', 'Kérte az appban: „Intézzétek helyettem” – vállalkozás bejelentése'),
        tl(190, ANNA, 'assist.agreed', 'Anna felhívta, egyeztettek – elindította'),
        tl(170, BENCE, 'assist.ujegyke_filed', 'Bence beküldte az UJEGYKE-t meghatalmazottként (jogcím 9)'),
        tl(150, null, 'assist.client_approved', 'Az ügyfél jelezte: jóváhagyta az ONYA-ban'),
        tl(140, BENCE, 'assist.mh_live', 'Bence ellenőrizte: él a meghatalmazás'),
        tl(26, null, 'assist.consent_given', 'Az ügyfél átnézte az adatait, és engedélyezte a bejelentést (utasítás PDF a dossziéban)'),
      ],
    },
    {
      id: 'as-lili',
      clientId: 'c-lili',
      kind: 'meghatalmazas',
      status: 'meghatalmazas_lejart',
      statusChangedAt: ago(6 * 24 - 98),
      callbackId: null,
      registrationId: null,
      assignee: ANNA,
      createdAt: ago(8 * 24),
      agreedAt: ago(7 * 24),
      checklist: { ...pipak(fazisElemek('meghatalmazas', 'hivas'), ANNA, ago(7 * 24)), ...pipak(fazisElemek('meghatalmazas', 'ujegyke'), BENCE, liliFiled) },
      jogcim: '9',
      ujegykeFiledAt: liliFiled,
      approvalDueOn: plusNap(bpDate(liliFiled), 3),
      approvalExpiresAt: new Date(Date.parse(liliFiled) + 96 * ORA).toISOString(),
      reminders: 3,
      expiredCount: 1,
      clientApprovedAt: null,
      mhLiveAt: null,
      consent: null,
      consentValid: false,
      evFiledAt: null,
      staffNote: 'Kétszer hívtam, nem vette fel.',
      closedAt: null,
      closedReason: null,
      timeline: [
        tl(8 * 24, null, 'assist.created', 'Kérte az appban: „Megcsináljuk helyetted a meghatalmazást”'),
        tl(7 * 24, ANNA, 'assist.agreed', 'Anna felhívta, egyeztettek – elindította'),
        tl(6 * 24, BENCE, 'assist.ujegyke_filed', 'Bence beküldte az UJEGYKE-t meghatalmazottként (jogcím 9)'),
        tl(6 * 24 - 98, null, 'assist.expired', 'Lejárt a 4 nap: a NAV törölte a jóvá nem hagyott meghatalmazást'),
      ],
    },
    {
      id: 'as-nora',
      clientId: 'c-nora',
      kind: 'meghatalmazas',
      status: 'kesz',
      statusChangedAt: ago(30),
      callbackId: null,
      registrationId: null,
      assignee: ANNA,
      createdAt: ago(120),
      agreedAt: ago(110),
      checklist: { ...pipak(fazisElemek('meghatalmazas', 'hivas'), ANNA, ago(110)), ...pipak(fazisElemek('meghatalmazas', 'ujegyke'), BENCE, ago(100)) },
      jogcim: '9',
      ujegykeFiledAt: ago(100),
      approvalDueOn: plusNap(bpDate(ago(100)), 3),
      approvalExpiresAt: new Date(Date.parse(ago(100)) + 96 * ORA).toISOString(),
      reminders: 1,
      expiredCount: 0,
      clientApprovedAt: ago(60),
      mhLiveAt: ago(30),
      consent: null,
      consentValid: false,
      evFiledAt: null,
      staffNote: null,
      closedAt: ago(30),
      closedReason: null,
      timeline: [
        tl(120, null, 'assist.created', 'Kérte az appban: „Megcsináljuk helyetted a meghatalmazást”'),
        tl(110, ANNA, 'assist.agreed', 'Anna felhívta, egyeztettek – elindította'),
        tl(100, BENCE, 'assist.ujegyke_filed', 'Bence beküldte az UJEGYKE-t meghatalmazottként (jogcím 9)'),
        tl(60, null, 'assist.client_approved', 'Az ügyfél jelezte: jóváhagyta az ONYA-ban'),
        tl(30, BENCE, 'assist.mh_live', 'Bence ellenőrizte: él a meghatalmazás – kész'),
      ],
    },
  ];
  // Step rows in line with the demo states (mock only).
  for (const a of assists) {
    const k = x.clients.find((c) => c.id === a.clientId);
    const st = k?.steps.find((s) => s.step === 'meghatalmazas');
    if (!k || !st) continue;
    if (a.status === 'kesz') st.status = 'kesz';
    else if (a.status === 'egyeztetve' || a.status === 'meghatalmazas_jovahagyva') st.status = 'konyvelore_var';
    else if (a.status === 'meghatalmazas_bekuldve' || a.status === 'meghatalmazas_lejart') st.status = 'ugyfelre_var';
    else if (a.status === 'meghatalmazas_el' || a.status === 'ugyfel_engedelyezte') st.status = 'kesz';
    if (a.status !== 'visszahivas_kerve') st.data = { method: 'onya_konyvelo', submittedAt: a.agreedAt ?? a.createdAt };
  }
  const lili = x.clients.find((c) => c.id === 'c-lili');
  if (lili) {
    lili.adoazonositoJel = '8449393221';
    lili.businessStatus = 'van';
  }

  // ---------- branch history (SPEC §27.2.5) + blocked logins (§27.6.4) ----------
  const utvonal = new Map<string, PathHistoryItem[]>([
    ['c-gergely', [{ at: ago(5), from: 'inditas', to: 'van', by: 'ugyfel', note: null }]],
    ['c-dora', [{ at: ago(26.5), from: null, to: 'inditas', by: 'ugyfel', note: null }]],
    ['c-timea', [{ at: ago(210), from: 'van', to: 'inditas', by: 'csapat', note: 'Telefonon kiderült: még nincs vállalkozása, rossz gombot nyomott.' }]],
  ]);
  const letiltva = new Map<string, { at: string; reason: string }>();

  // ---------- views ----------
  const kliens = b.kliens;
  const szerep = (): PanelSzerep => (x.role() === 'csapat' ? 'csapat' : x.role() === 'admin' ? 'admin' : 'konyvelo');
  const szerepKulcs = (): 'csapat' | 'konyvelo' | 'admin' => szerep();
  const nyitott = (a: MAssist) => ASSIST_OPEN_STATUSES.includes(a.status);
  const regOf = (a: MAssist) => (a.registrationId ? b.regs.find((r) => r.id === a.registrationId) : undefined);
  const szerzodesKesz = (a: MAssist) => kliens(a.clientId).steps.find((s) => s.step === 'szerzodes')?.status === 'kesz';
  const napja = (iso: string) => Math.max(0, Math.floor((nowMs() - Date.parse(iso)) / 86_400_000));
  const lejar = (a: MAssist) => (a.approvalDueOn ? new Date(`${a.approvalDueOn}T22:59:00Z`).toISOString() : null);
  const kovHatarido = (a: MAssist): TeamAssistRow['nextDue'] => {
    const m = (at: string | null, what: string) => (at ? { at, what, overdue: nowMs() > Date.parse(at) } : null);
    switch (a.status) {
      case 'visszahivas_kerve': {
        const c = b.cbs.find((k) => k.id === a.callbackId);
        return m(c?.dueAt ?? new Date(Date.parse(a.createdAt) + CALLBACK_RULES.dueHours * ORA).toISOString(), 'Visszahívás');
      }
      case 'egyeztetve':
        return m(munkanap(a.agreedAt ?? a.statusChangedAt, 1), 'UJEGYKE beküldése');
      case 'meghatalmazas_bekuldve':
        return m(lejar(a), 'Ügyfél jóváhagyása');
      case 'meghatalmazas_lejart':
        return m(munkanap(a.statusChangedAt, 1), 'UJEGYKE újraküldése');
      case 'meghatalmazas_jovahagyva':
        return m(munkanap(a.clientApprovedAt ?? a.statusChangedAt, 1), 'Ellenőrzés az ONYA-ban');
      case 'ugyfel_engedelyezte':
        return m(munkanap(a.consent?.at ?? a.statusChangedAt, 1), 'Bejelentés beküldése');
      case 'bejelentes_bekuldve':
        return m(munkanap(a.evFiledAt ?? a.statusChangedAt, 1), 'Átnézés és adószám');
      default:
        return null;
    }
  };
  const sor = (a: MAssist): TeamAssistRow => {
    const k = kliens(a.clientId);
    const card = b.card(k);
    return {
      id: a.id,
      client: { id: k.id, name: b.nev(k), lifecycle: k.lifecycle },
      kind: a.kind,
      status: a.status,
      ball: ASSIST_BALL[a.status],
      statusSince: a.statusChangedAt,
      daysInStatus: napja(a.statusChangedAt),
      nextDue: kovHatarido(a),
      approvalDueOn: a.approvalDueOn,
      callbackId: a.callbackId,
      registrationId: a.registrationId,
      accountant: card.accountant,
      assignee: a.assignee,
      createdAt: a.createdAt,
    };
  };
  const megengedett = (a: MAssist): AssistAction[] => {
    const r = szerepKulcs();
    const jelolt: Partial<Record<AssistStatus, AssistAction[]>> = {
      visszahivas_kerve: ['egyeztetve', 'lezaras'],
      egyeztetve: [...(szerzodesKesz(a) ? (['ujegyke_bekuldve'] as AssistAction[]) : []), 'lezaras'],
      meghatalmazas_bekuldve: ['lejart', 'meghatalmazas_el', 'lezaras'],
      meghatalmazas_lejart: ['ujegyke_bekuldve', 'lezaras'],
      meghatalmazas_jovahagyva: ['meghatalmazas_el', 'lezaras'],
      meghatalmazas_el: ['lezaras'],
      ugyfel_engedelyezte: [...(a.consentValid ? (['bejelentes_bekuldve'] as AssistAction[]) : []), 'lezaras'],
      bejelentes_bekuldve: ['lezaras'],
    };
    return (jelolt[a.status] ?? []).filter((m) => (ASSIST_ACTION_ROLES[m] as readonly string[]).includes(r));
  };
  const reszlet = (a: MAssist): TeamAssistDetail & { approval: unknown } => {
    const k = kliens(a.clientId);
    const r = szerep();
    const teljes = r !== 'csapat';
    if (teljes) x.logAudit('assist.data_viewed', k);
    const tax = k.adoazonositoJel;
    return {
      ...sor(a),
      clientCard: b.card(k),
      checklist: (a.kind === 'meghatalmazas' ? (['hivas', 'ujegyke'] as const) : (['hivas', 'ujegyke', 'bejelentes'] as const)).map((phase) => ({
        phase,
        title: phase,
        items: fazisElemek(a.kind, phase).map((item) => {
          const t = a.checklist[item];
          return { item, label: ASSIST_CHECK_LABELS[item], done: !!t, doneAt: t?.at ?? null, by: t?.by ?? null };
        }),
      })),
      filingData: tax
        ? {
            name: b.nev(k),
            adoazonositoJel: teljes ? tax : null,
            adoazonositoJelMasked: `${'•'.repeat(7)}${tax.slice(-3)}`,
            jogcim: a.jogcim,
            ugycsoportok: a.kind === 'vallalkozas_bejelentes' ? [UGYCSOPORT_ADO, UGYCSOPORT_EV] : [UGYCSOPORT_ADO],
          }
        : null,
      consentSnapshot: a.consent,
      answersMatchConsent: a.consent ? a.consentValid : null,
      timeline: a.timeline.slice().sort((p, q) => q.at.localeCompare(p.at)),
      allowedActions: megengedett(a),
      staffNote: a.staffNote,
      approval: a.ujegykeFiledAt
        ? { filedAt: a.ujegykeFiledAt, dueOn: a.approvalDueOn, expiresAt: a.approvalExpiresAt, remindersSent: a.reminders, clientApprovedAt: a.clientApprovedAt, expiredCount: a.expiredCount }
        : null,
    };
  };
  const keres = (id: string) => {
    const a = assists.find((k) => k.id === id);
    if (!a || x.role() === 'none') throw x.hiba(404, 'not_found', 'Nincs ilyen kérés, vagy nincs hozzá jogod.');
    return a;
  };
  const naplo = (a: MAssist, action: string, text: string) => {
    a.timeline.push({ at: x.nowIso(), by: b.en(), action, text });
    x.logAudit(action, kliens(a.clientId));
  };
  const allit = (a: MAssist, s: AssistStatus) => {
    a.status = s;
    a.statusChangedAt = x.nowIso();
    if (!ASSIST_OPEN_STATUSES.includes(s)) a.closedAt = x.nowIso();
  };
  const lepes = (a: MAssist, status: 'konyvelore_var' | 'ugyfelre_var' | 'kesz') => {
    const st = kliens(a.clientId).steps.find((s) => s.step === 'meghatalmazas');
    if (st) {
      st.status = status;
      st.data = { method: 'onya_konyvelo', submittedAt: st.data?.submittedAt ?? x.nowIso() };
      if (status === 'kesz') st.completedAt = x.nowIso();
    }
  };
  const kell = (a: MAssist, m: AssistAction) => {
    if (!megengedett(a).includes(m)) {
      if (m === 'ujegyke_bekuldve' && !szerzodesKesz(a)) throw x.hiba(409, 'assist_wrong_status', 'Előbb az ügyfélnek el kell fogadnia a szerződést.');
      if (!(ASSIST_ACTION_ROLES[m] as readonly string[]).includes(szerepKulcs())) throw x.hiba(403, 'forbidden', 'Ezt csak a könyvelője teheti meg, a saját belépésével.');
      throw x.hiba(409, 'assist_wrong_status', 'Ebben az állapotban ez nem lehetséges.');
    }
  };
  const teljesLista = (a: MAssist, phase: 'hivas' | 'ujegyke' | 'bejelentes', items: unknown) => {
    const kapott = Array.isArray(items) ? (items as AssistCheckItem[]) : [];
    const hiany = fazisElemek(a.kind, phase).filter((i) => !kapott.includes(i));
    if (hiany.length) throw x.hiba(400, 'assist_checklist_incomplete', 'Minden pontot pipálj ki.', { fields: Object.fromEntries(hiany.map((i) => [i, ASSIST_CHECK_LABELS[i]])) });
    const most = x.nowIso();
    for (const i of kapott) if (!a.checklist[i]) a.checklist[i] = { at: most, by: b.en() };
  };

  // ---------- hooks into the shapes of csapat.ts ----------
  x.kieg.kartya = (k, c) => {
    const nyitottA = assists.filter((a) => a.clientId === k.id && nyitott(a));
    const utolso = nyitottA[0] ?? assists.filter((a) => a.clientId === k.id).sort((p, q) => q.statusChangedAt.localeCompare(p.statusChangedAt))[0];
    const r = b.regs.filter((g) => g.clientId === k.id).sort((p, q) => q.statusSince.localeCompare(p.statusSince))[0];
    return {
      ...c,
      businessStatus: k.businessStatus ?? c.businessStatus,
      pathHistory: (utvonal.get(k.id) ?? []).slice().sort((p, q) => q.at.localeCompare(p.at)).slice(0, 5),
      assist: utolso ? { id: utolso.id, kind: utolso.kind, status: utolso.status } : null,
      registrationMode: k.businessStatus === 'inditas' ? (r?.mode ?? 'onallo') : null,
    };
  };
  x.kieg.regSor = (r, row) => ({ ...row, assistId: assists.find((a) => a.registrationId === r.id && a.kind === 'vallalkozas_bejelentes')?.id ?? null });
  x.kieg.osszeg = (s: TeamSummary) => {
    const ma = bpDate(x.nowIso());
    const lathato = assists;
    return {
      ...s,
      assists: {
        open: lathato.filter(nyitott).length,
        waitingOnMe: lathato.filter((a) => labdaNalam({ status: a.status, ball: ASSIST_BALL[a.status] }, szerep(), b.en().userId)).length,
        approvalOverdue: lathato.filter((a) => lejartJovahagyas({ status: a.status, approvalDueOn: a.approvalDueOn }, ma)).length,
        mine: lathato.filter((a) => nyitott(a) && a.assignee?.userId === b.en().userId).length,
      },
    };
  };
  x.kieg.szolg = (s: AdminServiceStats) => {
    const honap = x.nowIso().slice(0, 7);
    const kesz = assists.filter((a) => a.status === 'kesz' && nowMs() - Date.parse(a.closedAt ?? a.statusChangedAt) <= 30 * 86_400_000);
    const napok = kesz.map((a) => (Date.parse(a.closedAt ?? a.statusChangedAt) - Date.parse(a.createdAt)) / 86_400_000).sort((p, q) => p - q);
    return {
      ...s,
      assists: {
        open: assists.filter(nyitott).length,
        doneThisMonth: assists.filter((a) => a.status === 'kesz' && (a.closedAt ?? '').startsWith(honap)).length,
        expiredApprovals30d: assists.reduce((n, a) => n + a.expiredCount, 0),
        medianDaysToDone30d: napok.length ? Math.round(napok[Math.floor((napok.length - 1) / 2)]! * 10) / 10 : null,
      },
    };
  };
  x.kieg.ellenorzes = (r) => {
    const beküldte = r.history.find((h) => h.action === 'assist.ev_filed')?.by?.userId;
    if (beküldte && beküldte === b.en().userId) throw x.hiba(403, 'forbidden', 'Négy szem elve: más nézze át.');
  };

  // ---------- endpoints (SPEC §27.9.1) ----------
  on('GET', '/team/assists', ({ q }) => {
    const f = q.get('filter') ?? 'nyitott';
    const kind = q.get('kind');
    const s = (q.get('q') ?? '').toLowerCase();
    const ma = bpDate(x.nowIso());
    const items = assists
      .filter((a) => {
        if (kind && a.kind !== kind) return false;
        const r = { status: a.status, ball: ASSIST_BALL[a.status], approvalDueOn: a.approvalDueOn };
        if (f === 'nyitott' && !nyitott(a)) return false;
        if (f === 'nalam' && !labdaNalam(r, szerep(), b.en().userId)) return false;
        if (f === 'ugyfelre_var' && !(nyitott(a) && r.ball === 'ugyfel')) return false;
        if (f === 'lejart' && !lejartJovahagyas(r, ma)) return false;
        if (f === 'kesz' && a.status !== 'kesz') return false;
        return !s || b.nev(kliens(a.clientId)).toLowerCase().includes(s);
      })
      .map(sor);
    return { items, nextCursor: null };
  });
  on('GET', '/team/assists/:id', ({ p }) => reszlet(keres(p.id!)));
  on('POST', '/team/clients/:clientId/assists', ({ p, body }) => {
    const k = kliens(p.clientId!);
    const kind = body.kind as AssistKind;
    if (assists.some((a) => a.clientId === k.id && a.kind === kind && nyitott(a))) throw x.hiba(409, 'assist_already_open', 'Már van ilyen nyitott kérése.');
    const most = x.nowIso();
    const topic = kind === 'vallalkozas_bejelentes' ? 'vallalkozas_bejelentes_helyettem' : 'meghatalmazas_helyettem';
    let cbNyitott = b.cbs.find((c) => c.clientId === k.id && b.nyitottCb(c));
    if (cbNyitott) {
      cbNyitott.topic = topic;
      if (body.note) cbNyitott.note = [cbNyitott.note, `— Intézzük helyette kérés: ${String(body.note)}`].filter(Boolean).join('\n');
    } else {
      const utolso = b.cbs.filter((c) => c.clientId === k.id).sort((p2, q2) => q2.createdAt.localeCompare(p2.createdAt))[0];
      // the call usually just happened (the drawer's "Kéri, hogy intézzük helyette?"): link it instead of a new one
      cbNyitott = utolso && Date.now() - Date.parse(utolso.closedAt ?? utolso.createdAt) < 3 * 24 * ORA ? utolso : undefined;
      if (cbNyitott) cbNyitott.topic = topic;
    }
    const r = b.regs.filter((g) => g.clientId === k.id && g.status !== 'elallt').sort((p2, q2) => q2.statusSince.localeCompare(p2.statusSince))[0];
    if (kind === 'vallalkozas_bejelentes' && r) r.mode = 'segitett';
    const a: MAssist = {
      id: uid('as'),
      clientId: k.id,
      kind,
      status: 'visszahivas_kerve',
      statusChangedAt: most,
      callbackId: cbNyitott?.id ?? null,
      registrationId: kind === 'vallalkozas_bejelentes' ? (r?.id ?? null) : null,
      assignee: x.role() === 'accountant' ? null : b.en(),
      createdAt: most,
      agreedAt: null,
      checklist: {},
      jogcim: ASSIST_UJEGYKE_JOGCIM_DEFAULT as AssistJogcim,
      ujegykeFiledAt: null,
      approvalDueOn: null,
      approvalExpiresAt: null,
      reminders: 0,
      expiredCount: 0,
      clientApprovedAt: null,
      mhLiveAt: null,
      consent: null,
      consentValid: false,
      evFiledAt: null,
      staffNote: body.note ? String(body.note) : null,
      closedAt: null,
      closedReason: null,
      timeline: [{ at: most, by: b.en(), action: 'assist.created', text: `${b.en().firstName} felvette: ${kisbetu(ASSIST_KIND_LABELS[kind])}` }],
    };
    assists.unshift(a);
    x.logAudit('assist.created', k);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/agreed', ({ p, body }) => {
    const a = keres(p.id!);
    kell(a, 'egyeztetve');
    teljesLista(a, 'hivas', body.items);
    a.agreedAt = x.nowIso();
    allit(a, 'egyeztetve');
    lepes(a, 'konyvelore_var');
    naplo(a, 'assist.agreed', `${b.en().firstName}: egyeztettünk – elindította`);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/ujegyke-filed', ({ p, body }) => {
    const a = keres(p.id!);
    kell(a, 'ujegyke_bekuldve');
    teljesLista(a, 'ujegyke', body.items);
    const most = x.nowIso();
    a.jogcim = (body.jogcim as AssistJogcim) ?? a.jogcim;
    a.ujegykeFiledAt = most;
    a.approvalDueOn = plusNap(bpDate(most), ASSIST_RULES.shownApprovalDays);
    a.approvalExpiresAt = new Date(nowMs() + ASSIST_RULES.navApprovalDays * 24 * ORA).toISOString();
    a.reminders = 0;
    allit(a, 'meghatalmazas_bekuldve');
    lepes(a, 'ugyfelre_var');
    naplo(a, 'assist.ujegyke_filed', `${b.en().firstName} beküldte az UJEGYKE-t meghatalmazottként (jogcím ${a.jogcim})`);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/expired', ({ p }) => {
    const a = keres(p.id!);
    kell(a, 'lejart');
    a.expiredCount++;
    allit(a, 'meghatalmazas_lejart');
    naplo(a, 'assist.expired', `${b.en().firstName} lejártnak jelölte: újra kell küldeni`);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/mh-live', ({ p }) => {
    const a = keres(p.id!);
    kell(a, 'meghatalmazas_el');
    a.mhLiveAt = x.nowIso();
    lepes(a, 'kesz');
    if (a.kind === 'meghatalmazas') allit(a, 'kesz');
    else allit(a, a.consent && a.consentValid ? 'ugyfel_engedelyezte' : 'meghatalmazas_el');
    naplo(a, 'assist.mh_live', `${b.en().firstName} ellenőrizte: él a meghatalmazás`);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/ev-filed', ({ p, form }) => {
    const a = keres(p.id!);
    kell(a, 'bejelentes_bekuldve');
    if (!form?.get('file')) throw x.hiba(400, 'validation_failed', 'Töltsd fel a NAV-os értesítést.');
    teljesLista(a, 'bejelentes', JSON.parse(String(form.get('items') ?? '[]')));
    const r = regOf(a);
    const most = x.nowIso();
    a.evFiledAt = most;
    allit(a, 'bejelentes_bekuldve');
    if (r) {
      const fileId = uid('f');
      x.fileMeta.set(fileId, { title: `MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS (${b.nev(kliens(a.clientId))})`, kind: 'doc' });
      r.filed = { filedOn: String(form.get('filedOn') ?? bpDate(most)), channel: 'meghatalmazott', documentId: uid('d'), fileId, mime: 'application/pdf', uploadedAt: most };
      if (form.get('adoszam')) r.adoszam = String(form.get('adoszam'));
      if (form.get('evNyilvantartasiSzam')) r.ev = String(form.get('evNyilvantartasiSzam'));
      b.allapot(r, 'beadva');
      r.history.push({ at: most, by: b.en(), action: 'assist.ev_filed', text: `${b.en().firstName} beküldte meghatalmazottként, feltöltötte a NAV-os értesítést` });
    }
    naplo(a, 'assist.ev_filed', `${b.en().firstName} beküldte a bejelentést meghatalmazottként`);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/close', ({ p, body }) => {
    const a = keres(p.id!);
    kell(a, 'lezaras');
    const reason = body.reason as AssistCloseReason;
    a.closedReason = reason;
    allit(a, 'lezarva');
    const r = regOf(a);
    if (r && !r.filed) r.mode = 'onallo';
    if (body.note) a.staffNote = [a.staffNote, String(body.note)].filter(Boolean).join('\n');
    naplo(a, 'assist.closed', `${b.en().firstName} lezárta: ${ASSIST_CLOSE_REASON_LABELS[reason].toLowerCase()}`);
    return reszlet(a);
  });
  on('POST', '/team/assists/:id/assign', ({ p, body }) => {
    const a = keres(p.id!);
    if (x.role() === 'accountant') throw x.hiba(403, 'forbidden', 'Gazdát a csapat ad.');
    a.assignee = body.userId ? b.en() : null;
    naplo(a, 'assist.assigned', body.userId ? `${b.en().firstName} magára vette` : `${b.en().firstName} leadta`);
    return reszlet(a);
  });
  on('PATCH', '/team/assists/:id', ({ p, body }) => {
    const a = keres(p.id!);
    if ('staffNote' in body) a.staffNote = (body.staffNote as string | null) ?? null;
    for (const c of (body.check as { item: AssistCheckItem; done: boolean }[] | undefined) ?? []) {
      if (c.done) a.checklist[c.item] = { at: x.nowIso(), by: b.en() };
      else delete a.checklist[c.item];
      x.logAudit('assist.check_ticked', kliens(a.clientId));
    }
    return reszlet(a);
  });

  // ---------- staff branch change (SPEC §27.2.3) ----------
  on('POST', '/team/clients/:clientId/path', ({ p, body }) => {
    if (x.role() !== 'csapat' && x.role() !== 'admin') throw x.hiba(403, 'forbidden', 'Ezt a csapat vagy a tulajdonos teheti meg.');
    const k = kliens(p.clientId!);
    const cel = body.businessStatus as 'van' | 'inditas';
    const note = String(body.note ?? '').trim();
    if (!note || note.length > 500) throw x.hiba(400, 'validation_failed', 'Írd le röviden, miért állítod át (legfeljebb 500 karakter).');
    if (k.lifecycle !== 'bekotes_alatt') throw x.hiba(409, 'path_change_needs_callback', PATH_CHANGE_BLOCKER_TEXT.nem_bekotes_alatt);
    const r = b.regs.filter((g) => g.clientId === k.id).sort((p2, q2) => q2.statusSince.localeCompare(p2.statusSince))[0];
    if (r && ['beadva', 'javitas', 'ellenorizve', 'kesz'].includes(r.status)) throw x.hiba(409, 'path_change_needs_callback', PATH_CHANGE_BLOCKER_TEXT.bejelentes_bekuldve);
    const elotte = k.businessStatus ?? null;
    if (elotte === cel) throw x.hiba(409, 'conflict', 'Már ez az útvonala.');
    const most = x.nowIso();
    if (cel === 'van') {
      if (r && r.status !== 'elallt') {
        b.allapot(r, 'elallt');
        r.pathChangedAt = most;
        r.history.push({ at: most, by: b.en(), action: 'team.path_changed', text: `${b.en().firstName} átállította: már van vállalkozása` });
      }
      for (const a of assists.filter((q) => q.clientId === k.id && q.kind === 'vallalkozas_bejelentes' && nyitott(q))) {
        if (a.ujegykeFiledAt) {
          a.kind = 'meghatalmazas';
          a.registrationId = null;
          naplo(a, 'assist.converted', 'Útvonalat váltott: meghatalmazásként fut tovább');
        } else {
          a.closedReason = 'utvaltas';
          allit(a, 'lezarva');
          naplo(a, 'assist.closed', 'Lezárva: útvonalat váltott (már van vállalkozása)');
        }
      }
    } else {
      if (r && r.status === 'elallt' && !r.filed) {
        r.status = r.answers.activities.length ? 'utmutato' : 'kitoltes';
        r.statusSince = most;
        r.pathChangedAt = null;
        r.history.push({ at: most, by: b.en(), action: 'team.path_changed', text: `${b.en().firstName} átállította: most indítja – a kérdőív megmaradt` });
      }
      if (body.clearAdoszam) k.adoszam = null;
    }
    k.businessStatus = cel;
    const st = k.steps.find((s) => s.step === 'vallalkozas_inditas');
    if (st) st.status = cel === 'van' ? 'kihagyva' : REGISTRATION_STEP_STATUS[(r?.status ?? 'kitoltes') as RegistrationStatus];
    const lista = utvonal.get(k.id) ?? [];
    lista.push({ at: most, from: elotte, to: cel, by: x.role() === 'admin' ? 'admin' : 'csapat', note });
    utvonal.set(k.id, lista);
    x.logAudit('team.path_changed', k, { from: elotte, to: cel });
    return b.card(k);
  });

  // ---------- admin: block / unblock a client (round-2 security finding 9) ----------
  const csakAdmin = () => {
    if (x.role() !== 'admin') throw x.hiba(404, 'not_found', 'Nincs ilyen oldal.');
  };
  on('POST', '/admin/clients/:id/disable', ({ p, body }) => {
    csakAdmin();
    const k = kliens(p.id!);
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 3) throw x.hiba(400, 'validation_failed', 'Írd le az okát.');
    letiltva.set(k.id, { at: x.nowIso(), reason });
    x.logAudit('client.disabled', k);
    return undefined;
  });
  on('POST', '/admin/clients/:id/enable', ({ p, body }) => {
    csakAdmin();
    const k = kliens(p.id!);
    if (String(body.reason ?? '').trim().length < 3) throw x.hiba(400, 'validation_failed', 'Írd le az okát.');
    letiltva.delete(k.id);
    x.logAudit('client.enabled', k);
    return undefined;
  });
  // ---------- staff in-panel notifications (SPEC §27.8, mock) ----------
  const ertesites = (id: string, kind: string, title: string, body: string, link: string, h: number, olvasott = false) => ({
    id,
    kind,
    title,
    body,
    link,
    createdAt: ago(h),
    readAt: olvasott ? ago(h - 0.2) : null,
    kinek: [] as string[],
  });
  const ertesitesek = [
    { ...ertesites('n-gergely', 'client_path_changed', 'Szűcs Gergely módosította a válaszát', 'Most indítom → Már van vállalkozásom', '/vallalkozas-inditas/reg-gergely', 5), kinek: ['csapat', 'admin', 'accountant'] },
    { ...ertesites('n-ilona', 'callback_new', 'Új visszahívási kérés: Balogh Ilona', 'Intézzétek helyettem: vállalkozás bejelentése', '/visszahivasok?nyit=cb-ilona', 20), kinek: ['csapat', 'admin'] },
    { ...ertesites('n-david', 'assist_task', 'Küldd be a meghatalmazást: Molnár Dávid', `Egyeztettünk vele. UJEGYKE meghatalmazottként: ${UGYCSOPORT_ADO}.`, '/helyettunk/as-david', 20), kinek: ['accountant'] },
    { ...ertesites('n-timea', 'assist_task', 'Beküldheted: Vass Tímea bejelentése', 'Engedélyezte a bejelentést. Küldd be a Vállalkozói Ügysegédben, meghatalmazottként.', '/helyettunk/as-timea', 26), kinek: ['accountant'] },
    { ...ertesites('n-lili', 'assist_task', 'Lejárt a 4 nap: Farkas Lili', 'Küldd be újra a meghatalmazást.', '/helyettunk/as-lili', 6 * 24 - 98, true), kinek: ['accountant'] },
  ];
  on('GET', '/me/notifications', () => {
    const r = x.role();
    const items = ertesitesek.filter((n) => n.kinek.includes(r)).map(({ kinek: _k, ...n }) => n);
    return { items, nextCursor: null, hasUnread: items.some((n) => !n.readAt) };
  });
  on('POST', '/me/notifications/read', ({ body }) => {
    const ids = (body.ids as string[] | undefined) ?? null;
    for (const n of ertesitesek) if (n.kinek.includes(x.role()) && (body.all || ids?.includes(n.id)) && !n.readAt) n.readAt = x.nowIso();
    return undefined;
  });

  // demo: one blocked account so the list shows both states
  letiltva.set('c-gabor', { at: ago(70), reason: 'Tömeges, értelmetlen feltöltések (MINTA).' });
  exportLetiltva = (id) => letiltva.get(id) ?? null;
}

/** Read by the admin client list of server.ts (mock only). */
export let exportLetiltva: (id: string) => { at: string; reason: string } | null = () => null;
