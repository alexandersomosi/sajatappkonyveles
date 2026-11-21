// k8 ALAP-B – the sample server of the bank transfer (export:minta, screenshots): /client/billing and
// /client/billing/transfer, a simplified copy of backend/src/services/atutalas.ts. Fictional data only.
import brand from '../../_shared/brand.json';
import { kozlemenyOf, orderNoOf, TRANSFER_STATUS_LABELS, type ClientBillingView, type TransferRequestView } from '../../_shared/k8';
import type { Keres, Valasz } from '../http';
import type { K29Kornyezet } from './k29';

type Kezelo = (m: RegExpMatchArray, q: URLSearchParams, test: Record<string, unknown>, k: Keres) => Valasz | Promise<Valasz> | undefined;

/** The sample state (module level: one sample client). */
const A: { method: 'kartya' | 'atutalas'; open: TransferRequestView[] } = { method: 'kartya', open: [] };
const UGYFELSZAM = 10482;

function diBekero(ma: string): TransferRequestView {
  const orderNo = orderNoOf(UGYFELSZAM, ma);
  const due = new Date(`${ma}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 8);
  const dueOn = due.toISOString().slice(0, 10);
  return {
    id: `minta-dijbekero-${ma}`,
    kind: 'elso_havi',
    period: null,
    amountHuf: 19_999,
    orderNo,
    kozlemeny: kozlemenyOf(UGYFELSZAM, orderNo, 'havi'),
    proformaNumber: 'DEMO-D-2026-000001',
    issuedOn: ma,
    dueOn,
    status: 'kiallitva',
    statusLabel: TRANSFER_STATUS_LABELS.kiallitva,
    paidOn: null,
    pdfFileId: 'minta-pdf',
    demo: true,
    payTo: { beneficiary: brand.provider.legalName, accountNo: brand.provider.bankAccount, iban: brand.provider.iban, swift: brand.provider.swift, kozlemeny: kozlemenyOf(UGYFELSZAM, orderNo, 'havi'), amountHuf: 19_999, dueOn },
  };
}

export function k8Utak(ut: (method: string, minta: string, f: Kezelo) => void, c: Pick<K29Kornyezet, 'ma' | 'aktiv' | 'ok' | 'hiba' | 'kell'>) {
  const nezet = (): ClientBillingView => ({
    method: A.method,
    transferAvailable: true,
    monthlyHuf: 19_999,
    open: A.open,
    recent: [],
    nextIssueOn: null,
    canSwitchToCard: A.method === 'atutalas' && !A.open.some((x) => x.kind === 'havi'),
    canSwitchToTransfer: A.method === 'kartya' && c.aktiv(),
    kozlemenyMode: 'havi',
  });
  ut('GET', '/client/billing', () => c.kell() ?? c.ok(nezet()));
  ut('POST', '/client/billing/transfer', (_m, _q, t) => {
    if (c.kell()) return c.kell()!;
    if (t.purpose !== 'subscribe' && t.purpose !== 'switch') return c.hiba(400, 'validation_failed', 'Ismeretlen művelet.');
    A.method = 'atutalas';
    if (t.purpose === 'subscribe' && !A.open.length) A.open = [diBekero(c.ma())];
    return c.ok(nezet());
  });
}
