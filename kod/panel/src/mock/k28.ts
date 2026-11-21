// LOCAL MOCK – SPEC §28 (félretenni, notifications, allowances, "Mennyit kerestem?") and §28.K (fees, monthly
// check-in, annual closing, service lock, pause, EFO, adószám later, KATA), only in `--mode mock` builds.
// Everything is fictional (§28.11 / §28.K.21 seed personas). The numbers are a simplified copy of the engine rules
// (adómentes rész first, 15 % SZJA, 18.5 % TB + 13 % szocho, the monthly minimum for főfoglalkozású) so the screens
// show plausible values – the real values always come from kod/ado-motor through the backend.
import type { MockClient } from './data';
import { ts, uid, TODAY } from './data';
import { today } from '../lib/today';
import { KATA_EXEMPT_LABELS, type KataBreak, type KataMonthView, type KataYearView } from '../_shared/kata';
import type { AccClientRow, RevenueItem, Message } from '../_shared/api';
import type { YearOverviewRow } from '../_shared/eves';
import type {
  AccAllowanceItem,
  AccAllowanceView,
  AccAnnualView,
  AccClientDetail,
  AccNotificationLog,
  AccNotificationLogRow,
  AdminFeeChargeRow,
  AllowanceParams,
  AllowancePreview,
  AnnualAnswers,
  CsaladiMonthParam,
  EarningsCard,
  EarningsView,
  EmployerStatusView,
  FeeChargeView,
  FeeSettingView,
  InvoiceReserveView,
  KataHomeView,
  NavInvoiceDetail,
  PauseView,
  ReserveCard,
  ReserveListItem,
  ReserveView,
  ServiceLockView,
  TeamCheckinItem,
} from '../api/types';
import {
  ALLOWANCE_PENDING_STATUSES,
  ANNUAL_BALL,
  ANNUAL_CHECK_ITEMS,
  ANNUAL_RULES,
  EMPLOYER_DECISIONS_ALLOW_ACTIVATION,
  FEE_DEFAULTS,
  FEE_KINDS,
  KATA_RULES_2026,
  type AllowanceKind,
  type AllowanceStatus,
  type ClientFlag,
  type AnnualCheckItem,
  type AnnualStatus,
  type CheckinItem,
  type CheckinItemStatus,
  type EmployerDecision,
  type FeeChargeStatus,
  type FeeKind,
  type ReserveZone,
  type TaxRegime,
} from '../_shared/enums';
import {
  ALLOWANCE_CLIENT_LINES,
  ALLOWANCE_LABELS,
  ANNUAL_CHECK_LABELS,
  ANNUAL_STATUS_CLIENT_TEXT,
  ANYAK_LABELS,
  CHECKIN_ITEM_TEXTS,
  EARNINGS_TEXTS,
  FEE_CHARGE_STATUS_LABELS,
  FEE_KIND_LABELS,
  LOCK_TEXTS,
  PAUSE_TEXTS,
  RESERVE_TEXTS,
} from '../_shared/bekotes';

type H = (x: { q: URLSearchParams; body: Record<string, unknown>; form: FormData | null; p: Record<string, string> }) => unknown;
export interface K28Ctx {
  on: (m: string, path: string, h: H) => void;
  clients: MockClient[];
  role: () => string;
  nowIso: () => string;
  hiba: (status: number, code: string, msg: string, extra?: Record<string, unknown>) => Error;
  logAudit: (action: string, c: MockClient | null, details?: Record<string, unknown> | null) => void;
  inv: Map<string, NavInvoiceDetail[]>;
  revenue: Map<string, RevenueItem[]>;
  msgs: Map<string, Message[]>;
  fileMeta: Map<string, { title: string; kind: 'kyc' | 'doc' }>;
}
export interface K28Hooks {
  sor: (c: MockClient, r: AccClientRow) => AccClientRow;
  reszlet: (c: MockClient, d: AccClientDetail) => AccClientDetail;
  /** csapat may read the check-in queue (only items with an assist). */
  csapatUtvonal: (path: string) => boolean;
}

const nf = (n: number) => new Intl.NumberFormat('hu-HU').format(Math.round(n)).replace(/\s/g, ' ');
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);
const felfele = (n: number) => (n > 0 ? Math.ceil(n / 1000) * 1000 : n < 0 ? -Math.floor(-n / 1000) * 1000 : 0);
const plusNap = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

// 2026 rules used by the mock (the engine owns the real ones)
const TF = 1_936_800; // adómentes rész
const MIN_HAVI = 322_800; // minimálbér (TB + szocho base of a főfoglalkozású month)
const FIX_HAVI = Math.round(MIN_HAVI * 0.185) + Math.round(MIN_HAVI * 0.13); // 101 682

// ---------- personas ----------
const ID = {
  kata: 'c-kata',
  reka: 'c-reka',
  eszter: 'c-szabo-eszter',
  balint: 'c-toth-balint',
  adam: 'c-kovacs-adam',
  reka2: 'c-varga-reka2',
  greta: 'c-lakatos-greta',
  norbert: 'c-kiss-norbert',
  ilona: 'c-fazekas-ilona',
  tamas: 'c-barany-tamas',
  csilla: 'c-molnar-csilla',
  meszter: 'c-eszter',
  anna: 'c-anna',
  gabor: 'c-gabor',
} as const;

export function installK28(x: K28Ctx): K28Hooks {
  const { on } = x;
  const kliens = (id: string) => {
    const c = x.clients.find((k) => k.id === id);
    if (!c) throw x.hiba(404, 'not_found', 'Nincs ilyen ügyfél, vagy nincs hozzá jogod.');
    return c;
  };
  const nev = (c: MockClient) => `${c.lastName} ${c.firstName}`;
  const en = () =>
    x.role() === 'admin'
      ? { userId: 'u-admin', name: 'Demo Tulajdonos', firstName: 'Tulajdonos', role: 'admin' as const }
      : x.role() === 'csapat'
        ? { userId: 'u-anna', name: 'Nagy Anna', firstName: 'Anna', role: 'csapat' as const }
        : { userId: 'u-bence', name: 'Kovács Bence', firstName: 'Bence', role: 'accountant' as const };

  // ---------- synthetic invoices for the personas (the fixture clients keep theirs) ----------
  const szamla = (c: MockClient, n: number, issueDate: string, customer: string | null, amount: number, o: { paidAfter?: number; cash?: boolean; taxNumber?: string | null; payer?: 'maganszemely' | 'kifizeto' } = {}) => {
    const id = `inv-${c.id}-${n}`;
    const revId = `rev-${c.id}-${n}`;
    const paymentDate = o.cash ? issueDate : plusNap(issueDate, o.paidAfter ?? 8);
    const receivedOn = paymentDate;
    const estimated = receivedOn > TODAY;
    const row: NavInvoiceDetail = {
      id,
      invoiceNumber: `${c.lastName.slice(0, 2).toUpperCase()}-2026-${String(n).padStart(3, '0')}`,
      issueDate,
      customerName: customer,
      grossAmountHuf: amount,
      status: issueDate < '2026-10-01' ? 'beadva' : issueDate < '2026-11-01' ? 'feldolgozva' : 'feltoltve',
      demo: true,
      operation: 'CREATE',
      deliveryDate: issueDate,
      paymentDate,
      paymentMethod: o.cash ? 'CASH' : 'TRANSFER',
      customerTaxNumber: o.taxNumber ?? null,
      revenueItemId: revId,
      receivedOn,
      receivedOnEstimated: estimated,
      currency: 'HUF',
      netHuf: amount,
      vatHuf: 0,
      vatExemption: { case: 'AAM', reason: 'Alanyi adómentes (MINTA)' },
      lines: [{ lineNo: 1, description: 'Szolgáltatás (MINTA)', quantity: 1, unit: 'db', unitPriceHuf: amount, netAmountHuf: amount }],
      payerKind: o.payer ?? (customer ? 'kifizeto' : 'maganszemely'),
    } as NavInvoiceDetail;
    const rev: RevenueItem = {
      id: revId,
      source: 'nav_szamla',
      navInvoiceId: id,
      receivedOn,
      receivedOnEstimated: estimated,
      deliveryDate: issueDate,
      amountHuf: amount,
      description: `${row.invoiceNumber} · ${customer ?? 'Magánszemély'}`,
      countsForAtalany: true,
      countsForAfaLimit: true,
    };
    return { row, rev };
  };
  const toltes = (id: string, list: { row: NavInvoiceDetail; rev: RevenueItem }[]) => {
    const meglevo = x.inv.get(id) ?? [];
    if (meglevo.length) return;
    x.inv.set(id, list.map((l) => l.row).filter((r) => r.issueDate <= TODAY));
    x.revenue.set(id, list.filter((l) => l.row.issueDate <= TODAY).map((l) => l.rev).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn)));
  };
  {
    const e = x.clients.find((c) => c.id === ID.eszter);
    if (e) {
      const l = [];
      let n = 1;
      for (let m = 1; m <= 11; m++) {
        const mm = String(m).padStart(2, '0');
        l.push(szamla(e, n++, `2026-${mm}-05`, 'Bodza Kiadó Kft.', 380_000, { taxNumber: '12345678-2-41' }));
        l.push(szamla(e, n++, `2026-${mm}-12`, 'Csipke Műhely Bt.', 220_000, { taxNumber: '23456789-2-13' }));
        if (m % 2 === 0) l.push(szamla(e, n++, `2026-${mm}-20`, null, 45_000, { cash: true }));
      }
      toltes(e.id, l);
    }
    const b = x.clients.find((c) => c.id === ID.balint);
    if (b) {
      const l = [];
      let n = 1;
      for (let m = 3; m <= 10; m++) {
        const mm = String(m).padStart(2, '0');
        l.push(szamla(b, n++, `2026-${mm}-07`, 'Pixel Pékség Kft.', 700_000, { taxNumber: '34567890-2-42' }));
        l.push(szamla(b, n++, `2026-${mm}-21`, 'Zöld Kert Bt.', 500_000, { taxNumber: '45678901-2-05' }));
      }
      l.push(szamla(b, n++, '2026-11-05', 'Pixel Pékség Kft.', 700_000, { taxNumber: '34567890-2-42' }));
      // the two newest: downloaded by this morning's NAV sync (the notification demo)
      l.push(szamla(b, n++, '2026-11-16', 'Bodza Kiadó Kft.', 120_000, { taxNumber: '12345678-2-41' }));
      l.push(szamla(b, n++, '2026-11-16', 'Zöld Kert Bt.', 180_000, { taxNumber: '45678901-2-05' }));
      toltes(b.id, l);
    }
    const g = x.clients.find((c) => c.id === ID.greta);
    if (g) {
      const l = [];
      let n = 1;
      for (let m = 1; m <= 11; m++) {
        const mm = String(m).padStart(2, '0');
        for (const d of ['04', '11', '18', '25']) if (`2026-${mm}-${d}` <= TODAY) l.push(szamla(g, n++, `2026-${mm}-${d}`, null, 285_000, { cash: true, payer: 'maganszemely' }));
      }
      l.push(szamla(g, n++, '2026-11-10', 'Bodza Kiadó Kft.', 450_000, { paidAfter: 15, taxNumber: '12345678-2-41', payer: 'kifizeto' }));
      toltes(g.id, l);
    }
  }

  // ---------- regime / lock / pause / employer / adószám ----------
  const regime = new Map<string, TaxRegime>([[ID.greta, 'kata']]);
  const lock = new Map<string, ServiceLockView>([
    [
      ID.ilona,
      {
        reasons: ['havidij'],
        since: '2026-11-02',
        amountHuf: 19_999,
        text: fill(LOCK_TEXTS.banner, { mit: LOCK_TEXTS.mit.havidij, osszeg: nf(19_999), firstName: 'Bence' }),
        payRoute: '/fiok/elofizetes',
      },
    ],
  ]);
  const pause = new Map<string, PauseView>([
    [ID.csilla, { from: '2026-10-01', to: null, source: 'valtozas', amountHuf: 2_999, demo: true, text: fill(PAUSE_TEXTS.cardBody, { from: '2026. október 1', dij: nf(2_999), havidij: '19 999 Ft' }) }],
  ]);
  const employer = new Map<string, EmployerStatusView>([
    [ID.tamas, { answer: 'efo', answeredAt: ts('2026-11-14', '19:22'), source: 'onboarding', decision: null, clientText: null, decidedAt: null, blocksActivation: true }],
  ]);
  const adoszamPending = new Set<string>([ID.tamas]);

  // ---------- reserve + earnings (simplified engine copy, see the file header) ----------
  type Sor = { rev: RevenueItem; reserve: InvoiceReserveView };
  const szazalek = (c: MockClient) => 1 - (c.taxProfile?.costRatio ?? 45) / 100;
  const sorok = (c: MockClient, year: number): Sor[] => {
    const items = (x.revenue.get(c.id) ?? []).filter((r) => r.receivedOn.startsWith(String(year)) && r.countsForAtalany).slice();
    items.sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.id.localeCompare(b.id));
    const s = szazalek(c);
    const status = c.taxProfile?.status ?? 'fofoglalkozasu';
    const kedv = allowanceState(c.id);
    const szjaMentes = kedv?.items.some((i) => i.status === 'jovahagyva' && (i.kind === 'anyak' || i.kind === 'anya30')) ?? false;
    let cum = 0;
    const qBase: Record<number, number> = {};
    const out: Sor[] = [];
    for (const r of items) {
      const q = Math.floor((Number(r.receivedOn.slice(5, 7)) - 1) / 3) + 1;
      const inc = r.amountHuf * s;
      const elotte = cum;
      cum += inc;
      const taxable = Math.max(0, cum - TF) - Math.max(0, elotte - TF);
      let szja = szjaMentes ? 0 : taxable * 0.15;
      let jar = 0;
      if (status === 'mellekallasu') jar = taxable * 0.315;
      else if (status === 'fofoglalkozasu') {
        const minQ = 3 * MIN_HAVI;
        const b0 = qBase[q] ?? 0;
        const b1 = b0 + taxable;
        qBase[q] = b1;
        jar = (Math.max(minQ, b1) - Math.max(minQ, b0)) * 0.315;
      }
      if (kedv?.items.some((i) => i.status === 'jovahagyva' && i.kind === 'fiatal25')) szja = Math.max(0, szja - 0.15 * Math.min(taxable, 715_765));
      const tb = Math.round(jar * (18.5 / 31.5));
      const szocho = Math.round(jar - tb);
      szja = Math.round(szja);
      const raw = szja + tb + szocho;
      const crosses = elotte <= TF && cum > TF;
      const zone: ReserveZone = raw === 0 ? (cum <= TF ? 'adomentes' : 'nem_novel') : szja === 0 ? 'kedvezmeny' : tb + szocho === 0 ? 'csak_szja' : 'teljes';
      const felre = felfele(raw);
      const osszeg = nf(r.amountHuf);
      const line =
        zone === 'adomentes'
          ? fill(RESERVE_TEXTS.sor.adomentes, { osszeg })
          : zone === 'nem_novel'
            ? fill(RESERVE_TEXTS.sor.nem_novel, { osszeg })
            : fill(RESERVE_TEXTS.sor.teljes, { osszeg, felre: nf(felre) });
      out.push({
        rev: r,
        reserve: {
          year,
          reserveHuf: felre,
          rawHuf: raw,
          parts: { szjaHuf: szja, tbHuf: tb, szochoHuf: szocho },
          zone,
          crossesTaxFree: crosses,
          estimated: r.receivedOnEstimated,
          nextYear: false,
          line,
          listLine: felre > 0 ? fill(RESERVE_TEXTS.lista.felre, { felre: nf(felre) }) : zone === 'adomentes' ? RESERVE_TEXTS.lista.adomentes : RESERVE_TEXTS.lista.nem_novel,
          partsText: zone === 'csak_szja' ? 'SZJA' : zone === 'teljes' ? 'SZJA, TB-járulék, szocho' : zone === 'kedvezmeny' ? 'TB-járulék, szocho' : null,
          thresholdText: crosses ? RESERVE_TEXTS.kuszob : null,
        },
      });
    }
    return out;
  };
  const fixHavi = (c: MockClient) => (c.taxProfile?.status === 'fofoglalkozasu' ? FIX_HAVI : 0);
  const hipaEv = (c: MockClient, year: number) => Math.round(sorok(c, year).reduce((a, s) => a + s.rev.amountHuf, 0) * szazalek(c) * 0.02 * (12 / Math.max(1, honapMa(year))));
  const honapMa = (year: number) => (today().startsWith(String(year)) ? Number(today().slice(5, 7)) : 12);
  const reserveCard = (c: MockClient, year: number): ReserveCard => {
    const ma = today();
    const ss = sorok(c, year).filter((s) => s.rev.receivedOn <= ma);
    const mo = honapMa(year);
    const zartQ = Math.floor((mo - 1) / 3); // quarters ended before today
    const invoicesHuf = ss.reduce((a, s) => a + s.reserve.reserveHuf, 0);
    const fixedHuf = fixHavi(c) * mo;
    const hipaAnnual = hipaEv(c, year);
    const hipaHuf = Math.round((hipaAnnual * mo) / 12);
    const A = invoicesHuf + fixedHuf + hipaHuf;
    const B =
      ss.filter((s) => Math.floor((Number(s.rev.receivedOn.slice(5, 7)) - 1) / 3) < zartQ).reduce((a, s) => a + s.reserve.reserveHuf, 0) +
      fixHavi(c) * zartQ * 3 +
      (zartQ >= 1 ? Math.round(hipaAnnual / 2) : 0);
    const keep = Math.max(0, felfele(A - B));
    const fn = 'Bence';
    const reasons: ReserveCard['estimateReasons'] = [];
    if (ss.some((s) => s.reserve.estimated)) reasons.push({ code: 'fizetesi_hatarido', text: RESERVE_TEXTS.becsles.fizetesi_hatarido });
    if (c.taxProfile?.costRatioSource === 'ugyfel_javaslat') reasons.push({ code: 'profil_nincs_megerositve', text: fill(RESERVE_TEXTS.becsles.profil_nincs_megerositve, { firstName: fn }) });
    if (allowanceState(c.id)?.items.some((i) => ALLOWANCE_PENDING_STATUSES.includes(i.status)))
      reasons.push({ code: 'kedvezmeny_jovahagyasra_var', text: fill(RESERVE_TEXTS.becsles.kedvezmeny_jovahagyasra_var, { firstName: fn }) });
    return {
      year,
      keepNowHuf: keep,
      accruedHuf: A,
      invoicesHuf,
      fixedHuf,
      fixedMonthlyHuf: fixHavi(c),
      hipaHuf,
      hipaAnnualHuf: hipaAnnual,
      dueOrPaidHuf: B,
      nextDue: { dueDate: '2027-01-12', label: 'IV. negyedév' },
      estimateReasons: reasons,
      sentence: keep > 0 ? fill(RESERVE_TEXTS.kartya.sentence, { keepNow: nf(keep) }) : RESERVE_TEXTS.kartya.sentenceZero,
      detail: fill(RESERVE_TEXTS.kartya.detail, { A: nf(A), B: nf(B) }),
      footnote: fill(RESERVE_TEXTS.kartya.footnote, { firstName: fn }),
      markedHuf: c.id === ID.balint ? 150_000 : null,
      ring: c.id === ID.balint ? { ratio: Math.min(1, 150_000 / Math.max(1, keep)), remainingHuf: Math.max(0, keep - 150_000), line: `Még ${nf(Math.max(0, keep - 150_000))} Ft-ot tegyél félre.` } : null,
    };
  };
  const reserveView = (c: MockClient, year: number): ReserveView => {
    const ss = sorok(c, year);
    const months: ReserveView['months'] = [];
    for (let m = 12; m >= 1; m--) {
      const mm = `${year}-${String(m).padStart(2, '0')}`;
      const items: ReserveListItem[] = ss
        .filter((s) => s.rev.receivedOn.startsWith(mm))
        .map((s) => ({
          revenueItemId: s.rev.id,
          navInvoiceId: s.rev.navInvoiceId ?? null,
          title: s.rev.source === 'kezi' ? `Kézi tétel: ${s.rev.description}` : (s.rev.description.split(' · ')[1] || 'Magánszemély'),
          sub: s.rev.description.split(' · ')[0] ?? '',
          receivedOn: s.rev.receivedOn,
          amountHuf: s.rev.amountHuf,
          reserve: s.reserve,
        }));
      if (items.length) months.push({ month: m, label: `${year}. ${HONAP[m - 1]}`, items });
    }
    return { card: reserveCard(c, year), months };
  };
  const earnings = (c: MockClient, year: number): EarningsView => {
    const ss = sorok(c, year);
    const mo = honapMa(year);
    const hipaAnnual = hipaEv(c, year);
    const months = [] as EarningsView['months'];
    for (let m = 1; m <= mo; m++) {
      const mm = `${year}-${String(m).padStart(2, '0')}`;
      const its = ss.filter((s) => s.rev.receivedOn.startsWith(mm) && s.rev.receivedOn <= today());
      const rev = its.reduce((a, s) => a + s.rev.amountHuf, 0);
      const szja = its.reduce((a, s) => a + s.reserve.parts.szjaHuf, 0);
      const fix = fixHavi(c);
      const tbFix = fix ? Math.round(MIN_HAVI * 0.185) : 0;
      const tb = its.reduce((a, s) => a + s.reserve.parts.tbHuf, 0) + tbFix;
      const szocho = its.reduce((a, s) => a + s.reserve.parts.szochoHuf, 0) + (fix - tbFix);
      const hipa = Math.round(hipaAnnual / 12);
      const taxes = szja + tb + szocho + hipa;
      const q = Math.floor((m - 1) / 3) + 1;
      const basis = q <= 2 ? 'befizetve' : q === 3 ? 'jovahagyva' : 'becsles';
      months.push({
        month: m,
        label: HONAP[m - 1]!,
        revenueHuf: rev,
        taxesHuf: taxes,
        parts: { szjaHuf: szja, tbHuf: tb, szochoHuf: szocho, hipaHuf: hipa },
        netHuf: rev - taxes,
        basis,
        note: rev === 0 && fix ? EARNINGS_TEXTS.noRevenueNote : null,
      });
    }
    const ytd = months.reduce((a, m) => ({ revenueHuf: a.revenueHuf + m.revenueHuf, taxesHuf: a.taxesHuf + m.taxesHuf, netHuf: a.netHuf + m.netHuf }), { revenueHuf: 0, taxesHuf: 0, netHuf: 0 });
    const reliable = mo >= 3;
    const kerek = (n: number) => Math.round(n / 10_000) * 10_000;
    const projRev = reliable ? kerek((ytd.revenueHuf * 12) / mo) : null;
    const projTax = reliable ? kerek((ytd.taxesHuf * 12) / mo) : null;
    return {
      year,
      months,
      ytd,
      projection: {
        reliable,
        revenueHuf: projRev,
        taxesHuf: projTax,
        netHuf: projRev !== null && projTax !== null ? projRev - projTax : null,
        text: reliable ? fill(EARNINGS_TEXTS.cardProjection, { projNet: nf((projRev ?? 0) - (projTax ?? 0)) }) : EARNINGS_TEXTS.projectionNotYet,
      },
      line: EARNINGS_TEXTS.line,
      disclaimer: fill(EARNINGS_TEXTS.disclaimer, { firstName: 'Bence' }),
    };
  };
  const earningsCard = (c: MockClient, year: number): EarningsCard => {
    const e = earnings(c, year);
    return {
      ytdNetHuf: e.ytd.netHuf,
      ytdRevenueHuf: e.ytd.revenueHuf,
      ytdTaxesHuf: e.ytd.taxesHuf,
      sentence: fill(EARNINGS_TEXTS.cardSentence, { ytdNet: nf(e.ytd.netHuf) }),
      sub: fill(EARNINGS_TEXTS.cardSub, { ytdRevenue: nf(e.ytd.revenueHuf), ytdTaxes: nf(e.ytd.taxesHuf) }),
      projectionText: e.projection.reliable ? e.projection.text : null,
    };
  };
  const vanSzamla = (c: MockClient) => (x.revenue.get(c.id) ?? []).length > 0;

  // ---------- KATA (Gréta) ----------
  const kataView = (c: MockClient): KataHomeView => {
    const items = (x.revenue.get(c.id) ?? []).filter((r) => r.receivedOn.startsWith('2026') && r.receivedOn <= today());
    const rev = items.reduce((a, r) => a + r.amountHuf, 0);
    const liable = Array.from({ length: Number(today().slice(5, 7)) }, (_, i) => i + 1);
    const limit = 12 * KATA_RULES_2026.monthlyLimitHuf;
    const pct = Math.round((rev / limit) * 100);
    const biz = (x.inv.get(c.id) ?? []).filter((i) => (i as NavInvoiceDetail & { payerKind?: string }).payerKind === 'kifizeto');
    return {
      revenueHuf: rev,
      limitHuf: limit,
      usedPct: pct,
      level: pct >= 100 ? 'tullepve' : pct >= 80 ? 'figyelem' : 'rendben',
      liableMonths: liable,
      kulonadoEstimateHuf: 0,
      nextPayment: { amountHuf: KATA_RULES_2026.monthlyHuf, dueDate: '2026-12-14', accountName: KATA_RULES_2026.accountName, accountNumber: KATA_RULES_2026.accountNumber, iban: KATA_RULES_2026.iban, reference: c.adoszam ?? '' },
      businessInvoices: biz.map((i) => ({ navInvoiceId: i.id, customerName: i.customerName, amountHuf: i.grossAmountHuf, payerKind: 'kifizeto', endsOn: i.paymentDate && i.paymentDate <= today() ? plusNap(i.paymentDate, -1) : null, reportBy: i.paymentDate && i.paymentDate <= today() ? plusNap(i.paymentDate, 15) : null })),
      infoCardSeen: true,
    };
  };

  // ---------- allowances ----------
  type AState = Omit<AccAllowanceView, 'items'> & { items: AccAllowanceItem[] };
  const allowances = new Map<string, AState>();
  const honapokSzoveg = (ms: number[]) => {
    if (!ms.length) return '–';
    const s = [...ms].sort((a, b) => a - b);
    const folytonos = s.every((m, i) => i === 0 || m === s[i - 1]! + 1);
    if (folytonos) return s.length === 1 ? HONAP[s[0]! - 1]! : `${HONAP[s[0]! - 1]}–${HONAP[s[s.length - 1]! - 1]}`;
    return s.map((m) => HONAP[m - 1]!.slice(0, 3) + '.').join(', ');
  };
  const csaladiHonap = (n: number, share: number): CsaladiMonthParam[] =>
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, eltartott: n, children: Array.from({ length: n }, () => ({ felvaltva: false, tartosBeteg: false })), sharePct: share }));
  const tetel = (kind: AllowanceKind, status: AllowanceStatus, months: number[], params: AllowanceParams, reasons: string[], o: Partial<AccAllowanceItem> = {}): AccAllowanceItem => ({
    kind,
    label: kind === 'anyak' && params.anyakJogcim ? ANYAK_LABELS[params.anyakJogcim] : ALLOWANCE_LABELS[kind],
    line: ALLOWANCE_CLIENT_LINES[kind],
    status,
    statusText: status === 'jovahagyva' ? 'Jóváhagyva' : status === 'kerdes' ? 'Kérdeztél' : status === 'elutasitva' ? 'Nem jár' : 'Döntésre vár',
    months,
    monthsText: honapokSzoveg(months),
    inYear: true,
    effectYearHuf: null,
    question: null,
    rejectText: null,
    params,
    paramsPrev: null,
    proposal: { months, params, reasons },
    decidedBy: null,
    decidedAt: null,
    staffNote: null,
    warnings: [],
    documents: [],
    ...o,
  });
  allowances.set(ID.eszter, {
    year: 2026,
    answers: {
      birthMonth: '1990-04',
      children: [
        { potlek: 'most', sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null },
        { potlek: 'most', sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null },
      ],
      otherDependants: 0,
      pregnancy: null,
      mother: true,
      csaladiWho: 'kozosen',
      csaladiSharePct: 50,
      csjkWish: 'konyvelo_donti',
      marriage: null,
      disability: null,
      benefit: null,
      healthConsent: false,
      note: 'A férjem is egyéni vállalkozó, a családi kedvezményt felezzük.',
    },
    version: 1,
    submittedAt: ts('2026-11-16', '20:41'),
    healthConsentAt: null,
    legacy: [{ kind: 'csaladi', note: 'Két gyermek (régi jelzés a bekötéskor)' }],
    items: [
      tetel('anyak', 'javasolt', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { anyakJogcim: 'ket' }, ['Két saját gyermek, akikre családi pótlékot kap', 'Született: 1990 (1986 vagy később – 2026-ban jár)'], {
        documents: [{ label: 'a családi pótlékról szóló határozat', keep: true }],
      }),
      tetel('csaladi', 'javasolt', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], { csaladi: csaladiHonap(2, 50), csjkInYear: false }, [
        '2 kedvezményezett eltartott egész évben',
        'Megosztva a párjával: 50%',
        'Az anyák kedvezménye után SZJA-ból nem marad alap – a családi kedvezmény a TB-járulékból térülhet (járulékkedvezmény)',
      ], { documents: [{ label: 'a családi pótlékról szóló határozat', keep: true }] }),
    ],
  });
  allowances.set(ID.balint, {
    year: 2026,
    answers: { birthMonth: '2002-03', children: [], otherDependants: 0, pregnancy: null, mother: null, csaladiWho: null, csaladiSharePct: null, csjkWish: null, marriage: null, disability: null, benefit: null, healthConsent: false, note: null },
    version: 1,
    submittedAt: ts('2026-10-02', '18:05'),
    healthConsentAt: null,
    legacy: [],
    items: [
      tetel('fiatal25', 'jovahagyva', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], {}, ['Született: 2002. március – 2026-ban egész évben 25 év alatti'], {
        decidedBy: 'Kovács Bence',
        decidedAt: ts('2026-10-03', '09:12'),
        effectYearHuf: 214_000,
        statusText: 'Jóváhagyva',
      }),
    ],
  });
  allowances.set(ID.meszter, {
    year: 2026,
    answers: {
      birthMonth: '1993-08',
      children: [],
      otherDependants: 0,
      pregnancy: null,
      mother: null,
      csaladiWho: null,
      csaladiSharePct: null,
      csjkWish: null,
      marriage: { month: '2026-05', first: true, who: 'kozosen' },
      disability: null,
      benefit: { fromMonth: '2026-08', toMonth: '2026-09' },
      healthConsent: false,
      note: null,
    },
    version: 2,
    submittedAt: ts('2026-11-12', '21:03'),
    healthConsentAt: null,
    legacy: [],
    items: [
      tetel('elso_hazasok', 'javasolt', [6, 7, 8, 9, 10, 11, 12], { elsoHazasokMonthlyHuf: 16_667 }, ['Esküvő: 2026. május, első házasság', 'Megosztva: fele-fele (16 667 Ft/hó, a házastársánál 16 668)'], {
        documents: [{ label: 'a házassági anyakönyvi kivonat', keep: true }],
      }),
      tetel('csed_gyed', 'javasolt', [8, 9], {}, ['Táppénz: augusztus–szeptember'], { warnings: ['Kieső időként vedd fel az adóprofilba: ezekre a hónapokra nincs minimum járulék.'] }),
    ],
  });
  function allowanceState(id: string): AState | undefined {
    return allowances.get(id);
  }
  const fuggo = (id: string) => (allowances.get(id)?.items ?? []).filter((i) => ALLOWANCE_PENDING_STATUSES.includes(i.status)).length;

  /** Rough effect of the allowances on one year (the engine computes the real one). */
  const elonezet = (c: MockClient, decisions: { kind: AllowanceKind; months: number[]; params?: AllowanceParams; inYear: boolean }[]): AllowancePreview => {
    const ss = sorok(c, 2026);
    const mo = honapMa(2026);
    const eddig = ss.reduce((a, s) => a + s.rev.amountHuf, 0) || c.afaUsed;
    const evBevetel = (eddig * 12) / Math.max(1, mo);
    const jov = evBevetel * szazalek(c);
    const taxable = Math.max(0, jov - TF);
    const szja0 = Math.round(taxable * 0.15);
    const fofogl = c.taxProfile?.status === 'fofoglalkozasu';
    const tbBase = fofogl ? Math.max(12 * MIN_HAVI, taxable) : taxable;
    const tb0 = Math.round(tbBase * 0.185);
    const szocho0 = Math.round(tbBase * 0.13);
    let alap = taxable;
    const byKind: AllowancePreview['byKind'] = [];
    let csaladiUnused = 0;
    let csjk = 0;
    let potential = 0;
    const warnings: string[] = [];
    const sorrend: AllowanceKind[] = ['anya30', 'anyak', 'fiatal25', 'szemelyi', 'elso_hazasok', 'csaladi'];
    for (const k of sorrend) {
      const d = decisions.find((x) => x.kind === k && x.inYear);
      if (!d) continue;
      const arany = d.months.length / 12;
      let csok = 0;
      if (k === 'anya30' || k === 'anyak') csok = alap * arany;
      else if (k === 'fiatal25') csok = Math.min(alap, 715_765 * d.months.length);
      else if (k === 'szemelyi') csok = Math.min(alap, 107_600 * d.months.length);
      else if (k === 'elso_hazasok') csok = Math.min(alap, (d.params?.elsoHazasokMonthlyHuf ?? 33_335) * d.months.length);
      else if (k === 'csaladi') {
        const per = (n: number) => (n >= 3 ? 440_000 : n === 2 ? 266_660 : n === 1 ? 133_340 : 0);
        const keret = (d.params?.csaladi ?? []).filter((m) => d.months.includes(m.month)).reduce((a, m) => a + per(m.eltartott) * m.children.length * ((m.sharePct ?? 100) / 100), 0);
        csok = Math.min(alap, keret);
        csaladiUnused = Math.max(0, keret - csok);
        const lehetseges = Math.round(Math.min(csaladiUnused * 0.15, tb0));
        if (d.params?.csjkInYear) csjk = lehetseges;
        else potential = lehetseges;
        if (c.taxProfile?.status === 'nyugdijas' && d.params?.csjkInYear) warnings.push('Nyugdíjasnak nem jár családi járulékkedvezmény.');
      }
      alap -= csok;
      byKind.push({ kind: k, szjaSavedHuf: Math.round(csok * 0.15), csjkHuf: k === 'csaladi' ? csjk : 0 });
    }
    const szja1 = Math.round(Math.max(0, alap) * 0.15);
    return {
      without: { szjaHuf: szja0, tbHuf: tb0, szochoHuf: szocho0 },
      with: { szjaHuf: szja1, tbHuf: tb0 - csjk, szochoHuf: szocho0 },
      savedHuf: szja0 - szja1 + csjk,
      byKind,
      csaladiUnusedHuf: Math.round(csaladiUnused),
      annualCsjkPotentialHuf: potential,
      warnings,
    };
  };

  on('GET', '/acc/clients/:id/allowances', ({ p, q }) => {
    const c = kliens(p.id!);
    if (regime.get(c.id) === 'kata') throw x.hiba(409, 'not_for_regime', 'Katás ügyfélnél az adókedvezmények nem hatnak a katára.');
    const st = allowances.get(c.id);
    const year = Number(q.get('year') ?? 2026);
    if (!st) return { year, answers: null, version: 0, submittedAt: null, healthConsentAt: null, legacy: [], items: [] } satisfies AccAllowanceView;
    // effect estimate of the approved items
    const d = st.items.filter((i) => i.status === 'jovahagyva').map((i) => ({ kind: i.kind, months: i.months, params: i.params, inYear: i.inYear }));
    const pv = elonezet(c, d);
    for (const i of st.items) i.effectYearHuf = i.status === 'jovahagyva' ? Math.max(0, felfele((pv.byKind.find((b) => b.kind === i.kind)?.szjaSavedHuf ?? 0) + (pv.byKind.find((b) => b.kind === i.kind)?.csjkHuf ?? 0))) : null;
    return { ...st, year };
  });
  on('POST', '/acc/clients/:id/allowances/preview', ({ p, body }) => {
    const c = kliens(p.id!);
    return elonezet(c, (body.decisions as { kind: AllowanceKind; months: number[]; params?: AllowanceParams; inYear: boolean }[]) ?? []);
  });
  on('POST', '/acc/clients/:id/allowances/:kind/decision', ({ p, body }) => {
    const c = kliens(p.id!);
    if (lock.has(c.id)) throw x.hiba(403, 'service_locked', LOCK_TEXTS.panelDisabled);
    const st = allowances.get(c.id);
    const it = st?.items.find((i) => i.kind === p.kind);
    if (!st || !it) throw x.hiba(404, 'not_found', 'Nincs ilyen tétel.');
    const status = body.status as 'jovahagyva' | 'kerdes' | 'elutasitva';
    if ((status === 'kerdes' || status === 'elutasitva') && !String(body.clientText ?? '').trim()) throw x.hiba(400, 'validation_failed', 'Írd meg az ügyfélnek is.', { fields: { clientText: 'Kötelező.' } });
    it.status = status;
    if (Array.isArray(body.months)) it.months = (body.months as number[]).slice().sort((a, b) => a - b);
    it.monthsText = honapokSzoveg(it.months);
    if (body.params) it.params = body.params as AllowanceParams;
    if (typeof body.inYear === 'boolean') it.inYear = body.inYear;
    if (it.kind === 'anyak' && it.params.anyakJogcim) it.label = ANYAK_LABELS[it.params.anyakJogcim];
    it.decidedBy = en().name;
    it.decidedAt = x.nowIso();
    it.staffNote = (body.staffNote as string) ?? it.staffNote;
    it.question = status === 'kerdes' ? String(body.clientText) : null;
    it.rejectText = status === 'elutasitva' ? String(body.clientText) : null;
    it.statusText = status === 'jovahagyva' ? 'Jóváhagyva' : status === 'kerdes' ? 'Kérdeztél' : 'Nem jár';
    if (status === 'kerdes') {
      const l = x.msgs.get(c.id) ?? [];
      // newest first, like POST /acc/clients/:id/messages in server.ts
      l.unshift({ id: uid('m'), kind: 'szoveg', sender: 'en', body: `Kedvezmény (${it.label}): ${String(body.clientText)}`, attachments: [], createdAt: x.nowIso() });
      x.msgs.set(c.id, l);
    }
    x.logAudit('allowance.decided', c, { kind: it.kind, status, months: it.months.length });
    return { ...st };
  });

  // ---------- annual closing ----------
  type AnnRow = AccAnnualView & { clientId: string };
  let annual: AnnRow[] | null = null;
  const evesSzoveg = (s: AnnualStatus, dij: number) => fill(ANNUAL_STATUS_CLIENT_TEXT[s], { firstName: 'Bence', dij: nf(dij), hatarido: 'március 15-ig' });
  const annualAll = (): AnnRow[] => {
    if (annual) return annual;
    const nyitva2026 = today() >= `2027-${ANNUAL_RULES.openMonthDay}`;
    const lista: { clientId: string; year: number; regime: TaxRegime; status: AnnualStatus; answers?: Partial<AnnualAnswers>; checks?: AnnualCheckItem[]; draft?: boolean; fee?: FeeChargeStatus }[] = [
      { clientId: ID.kata, year: 2025, regime: 'atalany', status: 'kesz', checks: [...ANNUAL_CHECK_ITEMS].filter((i) => i !== 'kata_beadva'), fee: 'fizetve', draft: true },
      { clientId: ID.csilla, year: 2025, regime: 'atalany', status: 'kesz', checks: [...ANNUAL_CHECK_ITEMS].filter((i) => i !== 'kata_beadva'), fee: 'fizetve', draft: true },
    ];
    if (nyitva2026) {
      lista.push(
        { clientId: ID.kata, year: 2026, regime: 'atalany', status: 'konyvelonel', answers: { otherIncomes: ['munkaber'], allowancesOk: true, hipaPlace: 'csak_szekhely', municipalityLetter: false, onePercent: { civilAdoszam: '18000000-1-41', egyhazTechnikaiSzam: null }, missingDocuments: false, message: 'Decemberben volt egy kis megbízásos munkám is, a papírját feltöltöttem.' }, checks: ['kerdoiv_atnezve'], fee: 'fizetve' },
        { clientId: ID.eszter, year: 2026, regime: 'atalany', status: 'dijra_var', answers: { otherIncomes: ['nem_volt'], allowancesOk: true, hipaPlace: 'mas_telepulesen_is', hipaOtherTowns: [{ town: 'Szentendre', days: 14 }], municipalityLetter: true, missingDocuments: true }, fee: 'nyitott' },
        { clientId: ID.greta, year: 2026, regime: 'kata', status: 'jovahagyasra_var', answers: { otherIncomes: ['nem_volt'], allowancesOk: null, hipaPlace: 'csak_szekhely', municipalityLetter: false, missingDocuments: false }, checks: ['kerdoiv_atnezve', 'jovedelmek_rendben', 'hipa_adatok_rendben', 'tervezet_feltoltve'], fee: 'fizetve', draft: true },
        { clientId: ID.balint, year: 2026, regime: 'atalany', status: 'kerdoiv' },
      );
    } else {
      for (const id of [ID.kata, ID.eszter, ID.balint, ID.greta, ID.csilla]) lista.push({ clientId: id, year: 2026, regime: regime.get(id) ?? 'atalany', status: 'nem_indult' });
    }
    annual = lista.map((l) => {
      const c = kliens(l.clientId);
      const dij = FEE_DEFAULTS.eves_zaras.amountHuf;
      const id = `an-${l.clientId}-${l.year}`;
      const answers: AnnualAnswers | null = l.answers
        ? {
            otherIncomes: [],
            otherIncomeNote: null,
            allowancesOk: null,
            hipaPlace: null,
            hipaOtherTowns: [],
            municipalityLetter: null,
            onePercent: null,
            refundAccountMasked: '•••• •••• •••• 4471',
            missingDocuments: null,
            message: null,
            ...l.answers,
          }
        : null;
      const fee: FeeChargeView | null = l.fee
        ? {
            id: `fc-${id}`,
            kind: 'eves_zaras',
            label: FEE_KIND_LABELS.eves_zaras,
            amountHuf: dij,
            demo: true,
            status: l.fee,
            statusText: FEE_CHARGE_STATUS_LABELS[l.fee],
            purpose: { type: 'eves_zaras', annualId: id },
            dueOn: null,
            createdAt: ts(`${l.year + 1}-02-20`, '19:40'),
            paidAt: l.fee === 'fizetve' ? ts(`${l.year + 1}-02-20`, '19:42') : null,
            feeInvoice: null,
            canPay: l.fee === 'nyitott',
          }
        : null;
      const draftDoc = l.draft
        ? ({ id: `d-${id}`, title: `${l.regime === 'kata' ? `'${String(l.year).slice(2)}KATA` : `${String(l.year).slice(2)}SZJA`} – tervezet (MINTA)`, category: 'bevallas', status: 'feldolgozva', dossierMonth: `${l.year + 1}-02`, createdAt: ts(`${l.year + 1}-03-02`, '10:00'), source: 'konyvelo', fileId: `f-${id}`, mime: 'application/pdf', sizeBytes: 81_234, pageCount: 6, thumbUrl: null } as unknown as AccAnnualView['draft'])
        : null;
      if (draftDoc) x.fileMeta.set(`f-${id}`, { title: `MINTA – bevallás-tervezet (${nev(c)})`, kind: 'doc' });
      return {
        clientId: l.clientId,
        id,
        year: l.year,
        regime: l.regime,
        status: l.status,
        statusText: evesSzoveg(l.status, dij),
        questionnaireDue: `${l.year + 1}-${l.regime === 'kata' ? ANNUAL_RULES.questionnaireDue.kata : ANNUAL_RULES.questionnaireDue.atalany}`,
        legalDue: { szja: l.regime === 'kata' ? null : `${l.year + 1}-${ANNUAL_RULES.legalDue.szja}`, kata: l.regime === 'kata' ? `${l.year + 1}-${ANNUAL_RULES.legalDue.kata}` : null, hipa: `${l.year + 1}-${ANNUAL_RULES.legalDue.hipa}` },
        answers,
        feeCharge: fee,
        draft: draftDoc,
        approval: l.status === 'beadva' || l.status === 'kesz' ? { at: ts(`${l.year + 1}-03-05`, '20:11'), hash: 'minta-hash-7f3a' } : null,
        nextAction: l.status === 'kerdoiv' ? 'kitoltes' : l.status === 'dijra_var' ? 'fizetes' : l.status === 'jovahagyasra_var' ? 'jovahagyas' : null,
        canEdit: l.status === 'kerdoiv',
        checklist: ANNUAL_CHECK_ITEMS.filter((i) => (l.regime === 'kata' ? i !== 'szja_beadva' && i !== 'kedvezmenyek_rendben' : i !== 'kata_beadva')).map((i) => ({
          item: i,
          label: ANNUAL_CHECK_LABELS[i],
          done: (l.checks ?? []).includes(i),
          doneAt: (l.checks ?? []).includes(i) ? ts(`${l.year + 1}-03-02`, '10:00') : null,
          by: (l.checks ?? []).includes(i) ? { userId: 'u-bence', name: 'Kovács Bence', firstName: 'Bence', role: 'accountant' } : null,
        })),
        documents: draftDoc ? [draftDoc] : [],
        refundAccount: answers ? 'HU42 1177 3016 1111 1018 0000 4471' : null,
      } as AnnRow;
    });
    return annual;
  };
  const annualOf = (clientId: string, year: number) => annualAll().find((a) => a.clientId === clientId && a.year === year) ?? null;
  const annualWaiting = (clientId: string) => annualAll().some((a) => a.clientId === clientId && ANNUAL_BALL[a.status] === 'konyvelo');
  const kiAnnual = (a: AnnRow): AccAnnualView => {
    const { clientId: _c, ...rest } = a;
    void _c;
    return { ...rest, statusText: evesSzoveg(a.status, a.feeCharge?.amountHuf ?? FEE_DEFAULTS.eves_zaras.amountHuf) };
  };
  const findAnnual = (cid: string, aid: string) => {
    const a = annualAll().find((r) => r.id === aid && r.clientId === cid);
    if (!a) throw x.hiba(404, 'not_found', 'Nincs ilyen éves zárás.');
    if (lock.has(cid)) throw x.hiba(403, 'service_locked', LOCK_TEXTS.panelDisabled);
    return a;
  };
  const pipal = (a: AnnRow, item: AnnualCheckItem, done = true) => {
    const r = a.checklist.find((i) => i.item === item);
    if (r) {
      r.done = done;
      r.doneAt = done ? x.nowIso() : null;
      r.by = done ? { userId: en().userId, name: en().name, firstName: en().firstName, role: 'accountant' } : null;
    }
  };
  on('GET', '/acc/clients/:id/annual', ({ p, q }) => {
    const c = kliens(p.id!);
    const a = annualOf(c.id, Number(q.get('year') ?? 2026));
    return a ? kiAnnual(a) : null;
  });
  on('POST', '/acc/clients/:id/annual/:aid/check', ({ p, body }) => {
    const a = findAnnual(p.id!, p.aid!);
    pipal(a, body.item as AnnualCheckItem, !!body.done);
    return kiAnnual(a);
  });
  on('POST', '/acc/clients/:id/annual/:aid/draft', ({ p, form }) => {
    const a = findAnnual(p.id!, p.aid!);
    if (a.status !== 'konyvelonel' && a.status !== 'jovahagyasra_var') throw x.hiba(409, 'annual_wrong_status', 'Ebben az állapotban nem tölthetsz fel tervezetet.');
    const f = form?.get('file') as File | null;
    if (!f) throw x.hiba(400, 'validation_failed', 'Válaszd ki a tervezetet.');
    const fileId = uid('f');
    x.fileMeta.set(fileId, { title: `MINTA – ${f.name}`, kind: 'doc' });
    a.draft = { id: uid('d'), title: f.name, category: 'bevallas', status: 'feldolgozva', fileId, mime: f.type || 'application/pdf' } as unknown as AccAnnualView['draft'];
    a.documents = [a.draft!, ...a.documents];
    a.status = 'jovahagyasra_var';
    a.nextAction = 'jovahagyas';
    pipal(a, 'tervezet_feltoltve');
    x.logAudit('annual.draft_uploaded', kliens(a.clientId));
    return kiAnnual(a);
  });
  const beadas = (mit: 'szja' | 'hipa') => ({ p, form }: { p: Record<string, string>; form: FormData | null }) => {
    const a = findAnnual(p.id!, p.aid!);
    if (mit === 'szja' && a.status !== 'jovahagyasra_var' && a.status !== 'konyvelonel') throw x.hiba(409, 'annual_wrong_status', 'Előbb a tervezet és az ügyfél jóváhagyása kell.');
    if (mit === 'hipa' && a.status !== 'beadva') throw x.hiba(409, 'annual_wrong_status', 'Előbb az SZJA-bevallás (kata-nyilatkozat) beadása.');
    if (mit === 'szja' && !form?.get('file')) throw x.hiba(400, 'validation_failed', 'Töltsd fel a NAV-visszaigazolást.');
    if (mit === 'szja') {
      a.status = 'beadva';
      if (!a.approval) a.approval = { at: x.nowIso(), hash: 'minta-hash-telefonos-egyeztetes' };
      pipal(a, 'ugyfel_jovahagyta');
      pipal(a, a.regime === 'kata' ? 'kata_beadva' : 'szja_beadva');
      pipal(a, 'visszaigazolas_feltoltve');
    } else {
      a.status = 'kesz';
      pipal(a, 'hipa_beadva');
    }
    a.nextAction = null;
    x.logAudit(`annual.filed_${mit}`, kliens(a.clientId));
    return kiAnnual(a);
  };
  on('POST', '/acc/clients/:id/annual/:aid/filed-szja', beadas('szja'));
  on('POST', '/acc/clients/:id/annual/:aid/filed-hipa', beadas('hipa'));
  // SPEC §32.B (mock): amounts, HIPA, refund, close / open, önellenőrzés, folyószámla, áttekintő – enough for the screens
  on('PUT', '/acc/clients/:id/annual/:aid/amounts', ({ p, body }) => {
    const a = findAnnual(p.id!, p.aid!);
    if (a.status !== 'konyvelonel' && a.status !== 'jovahagyasra_var') throw x.hiba(409, 'annual_wrong_status', 'Ebben az állapotban nem írhatod be az összegeket.');
    const b = body as Record<string, unknown>;
    const n = (k: string) => (typeof b[k] === 'number' ? (b[k] as number) : 0);
    const diffHuf = a.regime === 'kata' ? n('kulonadoHuf') : n('szjaHuf') - n('advancesHuf') + n('csjkHuf');
    (a as AccAnnualView).amounts = { ...(b as object), regime: a.regime, diffHuf, matchesDraft: Boolean(b.matchesDraft) } as AccAnnualView['amounts'];
    if (a.status === 'jovahagyasra_var') a.approval = null;
    return kiAnnual(a);
  });
  on('PUT', '/acc/clients/:id/annual/:aid/hipa', ({ p, body }) => {
    const a = findAnnual(p.id!, p.aid!);
    const b = body as { notNeeded?: boolean; taxHuf?: number; advancesHuf?: number; returnNeeded?: boolean };
    (a as AccAnnualView).hipa = b.notNeeded
      ? { needed: false, taxHuf: null, advancesHuf: null, diffHuf: null, returnNeeded: null, filedOn: null, filingRef: null, periodId: null }
      : { needed: true, taxHuf: b.taxHuf ?? null, advancesHuf: b.advancesHuf ?? 0, diffHuf: (b.taxHuf ?? 0) - (b.advancesHuf ?? 0), returnNeeded: b.returnNeeded ?? null, filedOn: null, filingRef: null, periodId: null };
    return kiAnnual(a);
  });
  on('POST', '/acc/clients/:id/annual/:aid/refund', ({ p }) => kiAnnual(findAnnual(p.id!, p.aid!)));
  on('POST', '/acc/clients/:id/annual/:aid/close', ({ p, body }) => {
    const a = findAnnual(p.id!, p.aid!);
    a.status = 'kesz';
    (a as AccAnnualView).closedManuallyReason = String((body as { reason?: string }).reason ?? '');
    return kiAnnual(a);
  });
  on('POST', '/acc/clients/:id/annual/open', () => {
    throw x.hiba(409, 'annual_wrong_status', 'A megszűnt ügyfél éves zárása ki van kapcsolva (MINTA).');
  });
  on('GET', '/acc/clients/:id/corrections', () => ({ items: [] }));
  on('POST', '/acc/clients/:id/corrections', () => {
    throw x.hiba(409, 'correction_wrong_status', 'MINTA: csak beadott bevallást lehet önellenőrzéssel javítani.');
  });
  on('GET', '/acc/clients/:id/reconciliations', () => ({ items: [] }));
  on('GET', '/acc/clients/:id/reconciliations/expected', ({ q }) => ({
    asOf: q.get('asOf') ?? today(),
    adonemek: ['103', '406', '258', '138', '215', '224', '226'].map((a) => ({ adonem: a, label: { '103': 'Szja', '406': 'TB-járulék', '258': 'Szocho', '138': 'Késedelmi pótlék', '215': 'Önellenőrzési pótlék', '224': 'Bírság', '226': 'Mulasztási bírság' }[a]!, expectedUnmarkedHuf: 0, expectedMarkedHuf: 0 })),
    openItems: [],
    suggestedNextCheckOn: today(),
    kata: false,
  }));
  on('POST', '/acc/clients/:id/reconciliations', () => {
    throw x.hiba(409, 'conflict', 'MINTA: az egyeztetést itt nem mentjük.');
  });
  // k8 FELÜLET-P: a few fictional rows, so the year overview (SPEC §32.B) can be checked in the v2 look (mock only).
  on('GET', '/acc/overview/year', ({ q }) => {
    const ev = Number(q.get('year') ?? 2026);
    const negyedev = (allapot: YearOverviewRow['quarters'][number]['state'][], beadva = 3) =>
      allapot.map((state, i) => ({ key: `${ev}-Q${i + 1}`, state, filed: i < beadva, overdue: false }));
    const sorok: YearOverviewRow[] = [
      { clientId: 'c-kata', name: 'Szabó Kata', lifecycle: 'aktiv', regime: 'atalany', flags: [], quarters: negyedev(['ellenorizve', 'ellenorizve', 'ellenorizve', 'becsles']), kata: null, reconciliation: { asOf: `${ev}-10-31`, status: 'rendben', nextCheckOn: `${ev + 1}-01-31`, overdue: false, resolved: true }, annual: { status: 'konyvelonel', ball: 'konyvelo' }, difference: null, hipa: { advance: 'jovahagyva', annual: 'nincs' }, openCorrections: 0, missing: ['IV. negyedév: jóváhagyás'], ball: 'konyvelo', overdue: false, waitingOnMe: true },
      { clientId: 'c-reka', name: 'Varga Réka', lifecycle: 'aktiv', regime: 'atalany', flags: [], quarters: negyedev(['ellenorizve', 'jelolve', 'elteres', 'nincs'], 2), kata: null, reconciliation: { asOf: `${ev}-09-30`, status: 'hatralek', nextCheckOn: `${ev}-11-15`, overdue: true, resolved: false }, annual: { status: 'kerdoiv', ball: 'ugyfel' }, difference: { diffHuf: 41_200, settled: false, label: 'fizetendő' }, hipa: { advance: 'jelolve', annual: 'nincs' }, openCorrections: 1, missing: ['III. negyedév: eltérés a befizetésben', 'Folyószámla: hátralék', 'Éves kérdőív'], ball: 'ugyfel', overdue: true, waitingOnClient: true },
      { clientId: 'c-lakatos-greta', name: 'Lakatos Gréta', lifecycle: 'aktiv', regime: 'kata', flags: [], quarters: [], kata: { ok: 9, open: 1, unverified: 0, exempt: 0, beforeApp: 0 }, reconciliation: null, annual: { status: 'jovahagyasra_var', ball: 'ugyfel' }, difference: null, hipa: { advance: 'nem_kell', annual: 'nem_kell' }, openCorrections: 0, missing: ['Október: kata-befizetés'], ball: 'ugyfel', overdue: false, waitingOnClient: true },
      { clientId: 'c-szabo-eszter', name: 'Szabó Eszter', lifecycle: 'aktiv', regime: 'atalany', flags: [], quarters: negyedev(['ellenorizve', 'ellenorizve', 'jovahagyva', 'nincs_fizetendo']), kata: null, reconciliation: { asOf: `${ev}-10-31`, status: 'rendben', nextCheckOn: null, overdue: false, resolved: true }, annual: { status: 'kesz', ball: null }, difference: { diffHuf: -12_800, settled: true, label: 'visszajár' }, hipa: { advance: 'ellenorizve', annual: 'beadva' }, openCorrections: 0, missing: [], ball: null, overdue: false },
    ];
    const f = q.get('filter') ?? q.get('szuro') ?? 'mind';
    const szur: Record<string, (r: YearOverviewRow) => boolean> = { mind: () => true, hianyzik: (r) => r.missing.length > 0, ram_var: (r) => !!r.waitingOnMe, ugyfelre_var: (r) => !!r.waitingOnClient, lejart: (r) => r.overdue, kata: (r) => r.regime === 'kata', atalany: (r) => r.regime === 'atalany' };
    const counts = Object.fromEntries(Object.entries(szur).map(([k, fn]) => [k, sorok.filter(fn).length])) as Record<string, number>;
    return { year: ev, rows: sorok.filter(szur[f] ?? szur.mind!), counts };
  });

  // ---------- employer / adószám / regime ----------
  on('POST', '/acc/clients/:id/employer', ({ p, body }) => {
    const c = kliens(p.id!);
    const e = employer.get(c.id);
    if (!e) throw x.hiba(404, 'not_found', 'Az ügyfél nem jelzett alkalmazottat.');
    const decision = body.decision as EmployerDecision;
    const text = String(body.clientText ?? '').trim();
    if (decision !== 'nincs_teendo' && !text) throw x.hiba(400, 'validation_failed', 'Írd meg az ügyfélnek is.', { fields: { clientText: 'Kötelező.' } });
    e.decision = decision;
    e.clientText = text || null;
    e.decidedAt = x.nowIso();
    e.blocksActivation = !EMPLOYER_DECISIONS_ALLOW_ACTIVATION.includes(decision);
    x.logAudit('employer.decided', c, { decision });
    return { ok: true };
  });
  on('POST', '/acc/clients/:id/adoszam', ({ p, body }) => {
    const c = kliens(p.id!);
    const a = String(body.adoszam ?? '').trim();
    if (!/^\d{8}-\d-\d{2}$/.test(a)) throw x.hiba(400, 'validation_failed', 'Formátum: 12345678-1-23.', { fields: { adoszam: 'Formátum: 12345678-1-23.' } });
    c.adoszam = a;
    adoszamPending.delete(c.id);
    x.logAudit('client.adoszam_set', c);
    return { ok: true };
  });
  // ---------- SPEC §32 KATA months (mock: January–September verified, October marked, November to pay) ----------
  const kataAllapot = new Map<string, { breaks: KataBreak[]; ok: Set<string>; marked: Set<string> }>();
  const kataAll = (id: string) => {
    let st = kataAllapot.get(id);
    if (!st) {
      st = { breaks: [], ok: new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((m) => `2026-${m}`)), marked: new Set(['2026-10']) };
      kataAllapot.set(id, st);
    }
    return st;
  };
  const HONAPNEV = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const kataYear = (c: MockClient, year: number): KataYearView => {
    const st = kataAll(c.id);
    const hv = kataView(c);
    const utolso = Number(today().slice(5, 7));
    const months: KataMonthView[] = [];
    for (let m = 1; m <= utolso; m++) {
      const mk = `${year}-${String(m).padStart(2, '0')}`;
      const br = st.breaks.find((b) => b.from <= `${mk}-01` && b.to >= `${mk}-28`);
      const due = m === 12 ? `${year + 1}-01-12` : m === 11 ? '2026-12-14' : `${year}-${String(m + 1).padStart(2, '0')}-12`;
      const status: KataMonthView['status'] = br ? 'mentes' : st.ok.has(mk) ? 'ellenorizve' : st.marked.has(mk) ? 'befizetve_jelezve' : 'fizetendo';
      months.push({
        periodId: `kata-${c.id}-${mk}`,
        month: m,
        monthKey: mk,
        label: HONAPNEV[m - 1]!,
        status,
        liable: !br,
        exemptReason: br?.kind ?? null,
        exemptReasonLabel: br ? KATA_EXEMPT_LABELS[br.kind] : null,
        exemptLostByRevenue: false,
        amountHuf: br ? 0 : KATA_RULES_2026.monthlyHuf,
        dueDate: due,
        overdue: status === 'fizetendo' && due < today(),
        markedPaidOn: st.marked.has(mk) ? '2026-11-10' : null,
        verification: st.ok.has(mk) ? 'rendben' : null,
        backfilled: false,
        paidButExempt: false,
        reportDue: br && br.kind !== 'szunetel' && !br.reportedOn ? due : null,
      });
    }
    const liable = months.filter((x) => x.liable).length + (12 - utolso);
    const limit = Math.min(18_000_000, liable * 1_500_000);
    return {
      year,
      variant: 'regi',
      fofoglalkozasu: true,
      kataFrom: `${year}-01-01`,
      kataTo: null,
      monthlyHuf: KATA_RULES_2026.monthlyHuf,
      draftNote: null,
      months,
      meter: {
        usedHuf: hv.revenueHuf,
        limitHuf: limit,
        pct: Math.floor((hv.revenueHuf / limit) * 100),
        level: hv.level,
        liableMonths: liable,
        limitLine: liable >= 12 ? 'Kereted: 18 000 000 Ft' : `Kereted: ${liable} hónap × 1 500 000 Ft`,
        remainingLine: null,
        warningLine: null,
        remainingHuf: Math.max(0, limit - hv.revenueHuf),
        overHuf: Math.max(0, hv.revenueHuf - limit),
        projectedHuf: hv.revenueHuf,
        projectedOverHuf: 0,
        kulonadoEstimateHuf: 0,
        kulonadoDue: '2027-02-25',
        draft: false,
      },
      nextPayable: null,
      breaks: st.breaks,
      toVerify: months.filter((x) => x.status === 'befizetve_jelezve').length,
    };
  };
  on('GET', '/acc/clients/:id/kata', ({ p, q }) => {
    const c = kliens(p.id!);
    if (regime.get(c.id) !== 'kata') throw x.hiba(404, 'not_found', 'Ebben az évben az ügyfél nem katás.');
    return kataYear(c, Number(q.get('year') ?? today().slice(0, 4)));
  });
  on('PUT', '/acc/clients/:id/kata/breaks', ({ p, body }) => {
    const c = kliens(p.id!);
    kataAll(c.id).breaks = (body.breaks as KataBreak[]) ?? [];
    x.logAudit('kata.breaks_saved', c);
    return kataYear(c, Number(body.year));
  });
  on('POST', '/acc/clients/:id/kata/verify', ({ p, body }) => {
    const c = kliens(p.id!);
    const st = kataAll(c.id);
    for (const id of (body.periodIds as string[]) ?? []) {
      const mk = id.slice(-7);
      st.ok.add(mk);
      st.marked.delete(mk);
    }
    x.logAudit('kata.verified', c);
    return kataYear(c, Number(today().slice(0, 4)));
  });
  on('POST', '/acc/clients/:id/tax-regime', ({ p, body }) => {
    const c = kliens(p.id!);
    regime.set(c.id, body.regime as TaxRegime);
    x.logAudit('tax_regime.set', c, { regime: body.regime });
    return { ok: true };
  });

  // ---------- notification log (PANEL CONTRACT ADDITION) ----------
  const ertesites = (kind: AccNotificationLogRow['kind'], variant: string | null, title: string, body: string, createdAt: string, push: Partial<AccNotificationLogRow['push']>, o: Partial<AccNotificationLogRow> = {}): AccNotificationLogRow => ({
    id: uid('n'),
    kind,
    variant,
    title,
    body,
    link: null,
    createdAt,
    readAt: null,
    push: { wanted: true, sentAt: null, notBefore: null, skipped: null, amountsShown: false, ...push },
    email: null,
    ...o,
  });
  const naplok = new Map<string, AccNotificationLogRow[]>([
    [
      ID.balint,
      [
        ertesites('invoice_new', 'tobb', '2 új kiállított számlád: összesen 300 000 Ft', 'Tegyél félre kb. 52 000 Ft-ot. Megnézem, melyik mennyi.', ts('2026-11-17', '05:31'), { sentAt: ts('2026-11-17', '08:00'), notBefore: ts('2026-11-17', '08:00'), amountsShown: true }, { link: '/felretesz', readAt: ts('2026-11-17', '08:12') }),
        ertesites('invoice_new', null, 'Új kiállított számlád: 700 000 Ft', 'Pixel Pékség Kft. Tegyél félre kb. 122 000 Ft-ot.', ts('2026-11-06', '05:30'), { sentAt: ts('2026-11-06', '08:00'), notBefore: ts('2026-11-06', '08:00'), amountsShown: true }, { link: '/szamla/inv-c-toth-balint-17', readAt: ts('2026-11-06', '09:40') }),
        ertesites('allowance_decided', 'jovahagyva', 'Jóváhagyta Bence: 25 év alattiak kedvezménye', 'Idén kb. 214 000 Ft-tal kevesebb adót fizetsz.', ts('2026-10-03', '09:12'), { sentAt: ts('2026-10-03', '09:12') }, { readAt: ts('2026-10-03', '12:30'), email: { sentAt: ts('2026-10-03', '09:13') } }),
        ertesites('tax_due_soon', null, 'Közeleg a befizetés: október 12.', 'A III. negyedév adója: 196 000 Ft.', ts('2026-10-05', '08:00'), { sentAt: ts('2026-10-05', '08:00') }, { readAt: ts('2026-10-05', '08:31') }),
      ],
    ],
    [
      ID.kata,
      [
        ertesites('invoice_new', null, 'Új kiállított számlád: 254 000 Ft', 'Tegyél félre kb. 65 000 Ft-ot.', ts('2026-11-14', '05:30'), { sentAt: ts('2026-11-14', '07:00'), notBefore: ts('2026-11-14', '07:00'), amountsShown: false }),
        ertesites('checkin_due', null, 'Változott valami október óta?', 'Pár igen–nem kérdés, kb. 1 perc.', ts('2026-11-02', '09:00'), { sentAt: ts('2026-11-02', '09:00') }, { readAt: ts('2026-11-02', '19:44') }),
        ertesites('invoice_new', 'tobb', '3 új kiállított számlád: összesen 612 000 Ft', 'Tegyél félre kb. 157 000 Ft-ot. Megnézem, melyik mennyi.', ts('2026-10-21', '05:30'), { skipped: 'napi_limit' }, { readAt: ts('2026-10-21', '18:02') }),
      ],
    ],
    [
      ID.greta,
      [
        ertesites('kata_business_invoice', null, 'Cégnek számláztál – vigyázz a katádra', 'Bodza Kiadó Kft., 450 000 Ft. Ha kifizeti, megszűnik a katád. Beszélj Bencével, mielőtt fizet.', ts('2026-11-11', '05:30'), { sentAt: ts('2026-11-11', '08:00'), notBefore: ts('2026-11-11', '08:00'), amountsShown: true }, { email: { sentAt: ts('2026-11-11', '05:31') } }),
      ],
    ],
    [ID.ilona, [ertesites('service_locked', null, 'Szünetel a könyvelésed', 'Nincs kifizetve a havidíj. Fizess, és Bence folytatja.', ts('2026-11-02', '06:20'), { sentAt: ts('2026-11-02', '08:00'), notBefore: ts('2026-11-02', '08:00') }, { email: { sentAt: ts('2026-11-02', '06:21') } })]],
  ]);
  on('GET', '/acc/clients/:id/notifications', ({ p }) => {
    const c = kliens(p.id!);
    const items = (naplok.get(c.id) ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const skipped: AccNotificationLog['skippedInvoices'] =
      c.id === ID.balint
        ? [{ navInvoiceId: 'inv-c-toth-balint-1', invoiceNumber: 'TÓ-2026-001', issueDate: '2026-03-07', grossAmountHuf: 700_000, state: 'kihagyva_elso_szinkron' }]
        : c.id === ID.kata
          ? [{ navInvoiceId: 'inv-kata-x', invoiceNumber: 'SZK-2026-118', issueDate: '2026-10-30', grossAmountHuf: -38_000, state: 'kihagyva_modositas' }]
          : [];
    return {
      items,
      nextCursor: null,
      settings: c.id === ID.kata ? { quietEnabled: true, quietFrom: 21, quietTo: 7, pushShowAmounts: false } : null,
      skippedInvoices: skipped,
    } satisfies AccNotificationLog;
  });

  // ---------- fees (admin) ----------
  const ADMIN = { userId: 'u-admin', name: 'Demo Tulajdonos', firstName: 'Tulajdonos', role: 'admin' as const };
  const fees: FeeSettingView[] = FEE_KINDS.map((k) => ({
    kind: k,
    label: FEE_KIND_LABELS[k],
    amountHuf: FEE_DEFAULTS[k].amountHuf,
    unit: FEE_DEFAULTS[k].unit,
    confirmed: FEE_DEFAULTS[k].confirmed,
    confirmedAt: FEE_DEFAULTS[k].confirmed ? ts('2026-11-19', k === 'havidij' ? '19:30' : '17:25') : null,
    confirmedBy: FEE_DEFAULTS[k].confirmed ? ADMIN : null,
    effectiveFrom: null,
    cardLimitAffected: 0,
    history: [
      { amountHuf: FEE_DEFAULTS[k].amountHuf, confirmed: FEE_DEFAULTS[k].confirmed, changedBy: ADMIN, changedAt: ts('2026-11-19', '21:00'), note: FEE_DEFAULTS[k].note },
      ...(k === 'havidij' ? [{ amountHuf: 20_000, confirmed: true, changedBy: ADMIN, changedAt: ts('2026-01-02', '10:00'), note: 'Induló ár' }] : []),
    ],
  }));
  const kellAdmin = () => {
    if (x.role() !== 'admin') throw x.hiba(403, 'forbidden', 'Ezt csak a tulajdonos állíthatja.');
  };
  on('GET', '/admin/fees', () => {
    kellAdmin();
    return { items: fees };
  });
  on('PUT', '/admin/fees', ({ body }) => {
    kellAdmin();
    const f = fees.find((x) => x.kind === body.kind);
    if (!f) throw x.hiba(404, 'not_found', 'Nincs ilyen díj.');
    const uj = Number(body.amountHuf);
    if (!Number.isInteger(uj) || uj < 0 || uj > 1_000_000) throw x.hiba(400, 'validation_failed', 'Egész forintösszeg kell, 0 és 1 000 000 között.', { fields: { amountHuf: 'Egész forintösszeg kell.' } });
    const havi = f.kind === 'havidij' || f.kind === 'havidij_kata';
    if (havi && uj > f.amountHuf) {
      const eff = String(body.effectiveFrom ?? '');
      if (!eff || eff < plusNap(today(), 30)) throw x.hiba(400, 'validation_failed', 'Áremelésnél legalább 30 nappal későbbi kezdőnap kell.', { fields: { effectiveFrom: 'Legalább 30 nap múlva.' } });
      f.effectiveFrom = eff;
      f.cardLimitAffected = uj > 20_000 ? x.clients.filter((c) => c.sub?.status === 'active').length : 0;
    } else f.effectiveFrom = havi ? (body.effectiveFrom ? String(body.effectiveFrom) : null) : null;
    f.amountHuf = uj;
    f.confirmed = false;
    f.confirmedAt = null;
    f.confirmedBy = null;
    f.history.unshift({ amountHuf: uj, confirmed: false, changedBy: ADMIN, changedAt: x.nowIso(), note: (body.note as string) || null });
    x.logAudit('fee.setting_changed', null, { kind: f.kind });
    return { items: fees };
  });
  on('POST', '/admin/fees/:kind/confirm', ({ p }) => {
    kellAdmin();
    const f = fees.find((x) => x.kind === p.kind);
    if (!f) throw x.hiba(404, 'not_found', 'Nincs ilyen díj.');
    f.confirmed = true;
    f.confirmedAt = x.nowIso();
    f.confirmedBy = ADMIN;
    f.history.unshift({ amountHuf: f.amountHuf, confirmed: true, changedBy: ADMIN, changedAt: x.nowIso(), note: 'Megerősítve' });
    x.logAudit('fee.setting_confirmed', null, { kind: f.kind });
    return { items: fees };
  });
  const charge = (cid: string, kind: FeeKind, status: FeeChargeStatus, purposeId: string, at: string): AdminFeeChargeRow => {
    const c = kliens(cid);
    return {
      id: `fc-${cid}-${kind}`,
      kind,
      label: FEE_KIND_LABELS[kind],
      amountHuf: FEE_DEFAULTS[kind].amountHuf,
      demo: true,
      status,
      statusText: FEE_CHARGE_STATUS_LABELS[status],
      purpose: { type: 'valtozas', assistId: purposeId },
      dueOn: null,
      createdAt: at,
      paidAt: status === 'fizetve' || status === 'visszaterites_kell' ? at : null,
      feeInvoice: null,
      canPay: status === 'nyitott',
      client: { id: c.id, name: nev(c) },
    };
  };
  const charges: AdminFeeChargeRow[] = [
    charge(ID.norbert, 'valtozas_jogallas', 'nyitott', 'as-norbert', ts('2026-11-15', '18:20')),
    charge(ID.adam, 'valtozas_egyszeru', 'fizetve', 'as-adam', ts('2026-11-09', '20:02')),
    charge(ID.anna, 'valtozas_egyszeru', 'visszaterites_kell', 'as-anna-telephely', ts('2026-11-04', '11:15')),
  ];
  on('GET', '/admin/fee-charges', ({ q }) => {
    kellAdmin();
    const s = q.get('status');
    return { items: charges.filter((c) => !s || c.status === s) };
  });
  on('POST', '/admin/fee-charges/:id/waive', ({ p, body }) => {
    kellAdmin();
    const c = charges.find((x) => x.id === p.id);
    if (!c) throw x.hiba(404, 'not_found', 'Nincs ilyen díj.');
    if (!String(body.reason ?? '').trim()) throw x.hiba(400, 'validation_failed', 'Írd meg az okát.', { fields: { reason: 'Kötelező.' } });
    c.status = 'elengedve';
    c.statusText = FEE_CHARGE_STATUS_LABELS.elengedve;
    c.canPay = false;
    x.logAudit('fee.waived', null, { kind: c.kind });
    return { ok: true };
  });
  on('POST', '/admin/fee-charges/:id/refunded', ({ p }) => {
    kellAdmin();
    const c = charges.find((x) => x.id === p.id);
    if (!c || c.status !== 'visszaterites_kell') throw x.hiba(409, 'fee_wrong_status', 'Ez a díj nem vár visszatérítésre.');
    c.status = 'visszaterites_megtortent';
    c.statusText = FEE_CHARGE_STATUS_LABELS.visszaterites_megtortent;
    x.logAudit('fee.refunded', null, { kind: c.kind });
    return { ok: true };
  });

  // ---------- monthly check-in queue ----------
  type CI = TeamCheckinItem;
  const ci = (cid: string, item: CheckinItem, status: CheckinItemStatus, o: Partial<CI> = {}): CI => {
    const c = kliens(cid);
    return {
      id: `ci-${cid}-${item}`,
      checkinId: `ch-${cid}-2026-10`,
      client: { id: c.id, name: nev(c), lifecycle: c.lifecycle },
      period: '2026-10',
      item,
      itemLabel: CHECKIN_ITEM_TEXTS[item].question,
      how: null,
      status,
      fee: null,
      ball: status === 'dijra_var' || status === 'ugyfel_intezi' ? 'ugyfel' : status === 'csapatnal' ? 'csapat' : status === 'kesz' || status === 'nem_kell' ? null : 'konyvelo',
      since: ts('2026-11-03', '19:10'),
      details: { item },
      assistId: null,
      staffNote: null,
      ...o,
    };
  };
  const checkins: CI[] = [
    ci(ID.norbert, 'munkaviszony', 'dijra_var', {
      how: 'helyettunk',
      fee: { kind: 'valtozas_jogallas', amountHuf: 7_999, status: 'nyitott' },
      assistId: 'as-norbert',
      since: ts('2026-11-15', '18:20'),
      details: { item: 'munkaviszony', since: '2026-11-03', weeklyHours: 'legalabb_36', how: 'helyettunk' },
    }),
    ci(ID.adam, 'koltozes', 'csapatnal', { how: 'helyettunk', fee: { kind: 'valtozas_egyszeru', amountHuf: 4_999, status: 'fizetve' }, assistId: 'as-adam', since: ts('2026-11-09', '20:02'), details: { item: 'koltozes', choice: 'szekhely', how: 'helyettunk' } }),
    ci(ID.eszter, 'csalad', 'uj', { how: 'kerdes', since: ts('2026-11-16', '20:41'), details: { item: 'csalad' } }),
    ci(ID.anna, 'tevekenyseg', 'ugyfel_intezi', { how: 'magatol', since: ts('2026-11-05', '08:30'), details: { item: 'tevekenyseg', how: 'magatol' } }),
    ci(ID.greta, 'kata_ceges', 'uj', { how: 'kerdes', since: ts('2026-11-10', '21:15'), details: { item: 'kata_ceges', how: 'kerdes' } }),
    ci(ID.csilla, 'folytatas', 'uj', { how: 'kerdes', since: ts('2026-11-04', '07:55'), details: { item: 'folytatas', how: 'kerdes' } }),
    ci(ID.meszter, 'egyeb', 'uj', { since: ts('2026-11-06', '12:40'), details: { item: 'egyeb', text: 'Vettem egy új laptopot a munkához. Ez számít valahol?' } }),
    ci(ID.kata, 'tevekenyseg', 'kesz', { how: 'magatol', since: ts('2026-10-06', '10:00'), period: '2026-09', details: { item: 'tevekenyseg', how: 'magatol' } }),
  ];
  on('GET', '/acc/checkin-items', ({ q }) => {
    const s = q.get('status') ?? 'nyitott';
    const lathato = x.role() === 'csapat' ? checkins.filter((c) => c.assistId) : checkins;
    const items = lathato.filter((c) => (s === 'mind' ? true : s === 'nyitott' ? c.status !== 'kesz' && c.status !== 'nem_kell' : c.status === s));
    return { items: items.slice().sort((a, b) => a.since.localeCompare(b.since)) };
  });
  on('POST', '/acc/checkin-items/:id', ({ p, body }) => {
    if (x.role() === 'csapat') throw x.hiba(403, 'forbidden', 'Erről a könyvelő dönt.');
    const it = checkins.find((c) => c.id === p.id);
    if (!it) throw x.hiba(404, 'not_found', 'Nincs ilyen tétel.');
    const st = body.status as 'nem_kell' | 'kesz' | 'csapatnal';
    if (st === 'nem_kell' && !String(body.clientText ?? '').trim()) throw x.hiba(400, 'validation_failed', 'Írd meg az ügyfélnek, miért nem kell teendő.', { fields: { clientText: 'Kötelező.' } });
    it.status = st;
    it.ball = st === 'csapatnal' ? 'csapat' : null;
    it.staffNote = (body.staffNote as string) ?? it.staffNote;
    x.logAudit('checkin.item_decided', kliens(it.client.id), { item: it.item, status: st, apply: (body.apply as string[] | undefined)?.length ?? 0 });
    return it;
  });

  // ---------- hooks into the list row and the client detail ----------
  const sor = (c: MockClient, r: AccClientRow): AccClientRow => {
    const flags: ClientFlag[] = r.flags.filter((f) => f !== 'rendben');
    if (lock.has(c.id) && !flags.includes('zarolva')) flags.push('zarolva');
    if (regime.get(c.id) === 'kata' && kataView(c).businessInvoices.length && !flags.includes('kata_figyelem')) flags.push('kata_figyelem');
    if (!flags.length && c.lifecycle === 'aktiv') flags.push('rendben');
    return {
      ...r,
      flags,
      allowancesPending: fuggo(c.id),
      taxRegime: regime.get(c.id) ?? 'atalany',
      serviceLocked: lock.has(c.id),
      annualWaiting: annualWaiting(c.id),
      checkinOpenItems: checkins.filter((i) => i.client.id === c.id && i.status !== 'kesz' && i.status !== 'nem_kell').length,
      adoszamPending: adoszamPending.has(c.id),
    };
  };
  const reszlet = (c: MockClient, d: AccClientDetail): AccClientDetail => {
    const kata = regime.get(c.id) === 'kata';
    const year = 2026;
    const vanAdat = c.lifecycle === 'aktiv' && !!c.taxProfile && (vanSzamla(c) || c.key !== 'extra');
    const flags = sor(c, { ...(d as unknown as AccClientRow), flags: d.flags }).flags;
    return {
      ...d,
      flags,
      adoszam: c.adoszam,
      allowancesPending: fuggo(c.id),
      reserve: vanAdat && !kata ? reserveCard(c, year) : null,
      earnings: vanAdat && !kata ? earningsCard(c, year) : null,
      taxRegime: kata ? 'kata' : 'atalany',
      kata: kata ? kataView(c) : null,
      serviceLock: lock.get(c.id) ?? null,
      pause: pause.get(c.id) ?? null,
      employer: employer.get(c.id) ?? null,
      annual: (() => {
        const a = annualOf(c.id, year) ?? annualOf(c.id, year - 1);
        return a ? kiAnnual(a) : null;
      })(),
      adoszamPending: adoszamPending.has(c.id),
      checkinOpenItems: checkins.filter((i) => i.client.id === c.id && i.status !== 'kesz' && i.status !== 'nem_kell').length,
      mailboxAddress: c.lifecycle === 'aktiv' ? `${c.personalCode.toLowerCase()}@posta.demo.kezjegy.test` : null,
    };
  };
  on('GET', '/acc/clients/:id/reserve', ({ p, q }) => {
    const c = kliens(p.id!);
    if (c.lifecycle !== 'aktiv' && c.lifecycle !== 'felfuggesztve') throw x.hiba(403, 'locked_until_active', 'A bekötés után nyílik meg.');
    return reserveView(c, Number(q.get('year') ?? 2026));
  });
  on('GET', '/acc/clients/:id/earnings', ({ p, q }) => {
    const c = kliens(p.id!);
    if (c.lifecycle !== 'aktiv' && c.lifecycle !== 'felfuggesztve') throw x.hiba(403, 'locked_until_active', 'A bekötés után nyílik meg.');
    return earnings(c, Number(q.get('year') ?? 2026));
  });

  return {
    sor,
    reszlet,
    csapatUtvonal: (path) => path === '/acc/checkin-items',
  };
}
