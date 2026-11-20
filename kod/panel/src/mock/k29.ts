// Panel mock – SPEC §29.1.14 (B3): /admin/k29/{subscriptions,payments,fee-invoices,system} with made-up rows, and the
// console's money actions used by these pages (step-up, refund, invoice retry) when the console mock does not answer.
import type { AdminFeeInvoiceRow, AdminPaymentRow, AdminPaymentsSystemView, AdminSubscriptionRowK29 } from '../_shared/k29';
import type { MockClient } from './data';

type Ctx = { q: URLSearchParams; body: Record<string, unknown>; p: Record<string, string> };
export interface K29Ctx {
  on: (m: string, path: string, h: (x: Ctx) => unknown) => void;
  clients: MockClient[];
  nev: (c: MockClient) => string;
  nowIso: () => string;
  hiba: (status: number, code: string, msg: string, extra?: Record<string, unknown>) => Error;
  logAudit: (action: string, c: MockClient | null, details?: Record<string, unknown> | null) => void;
  requireAdmin: () => void;
}

const HAVIDIJ = 19_999;
const kartya = (mask: string | null) => (mask ? `DEMO •••• ${mask.replace(/\D/g, '').slice(-4)}` : null);

export function installK29(x: K29Ctx): void {
  const { on, clients, nev } = x;
  let lepesIdo = 0;
  const elofizetesek = (): AdminSubscriptionRowK29[] =>
    clients
      .filter((c) => c.sub)
      .map((c, i) => ({
        id: `sub-${c.id}`,
        client: { id: c.id, name: nev(c) },
        provider: 'demo',
        mode: 'demo',
        providerLabel: 'DEMO',
        status: c.sub!.status,
        currentPeriodEnd: c.sub!.nextChargeAt?.slice(0, 10) ?? null,
        nextChargeAt: c.sub!.nextChargeAt,
        nextChargeHuf: c.lifecycle === 'felfuggesztve' ? 2_999 : HAVIDIJ,
        cardLabel: kartya(c.sub!.cardMask),
        failedAttempts: c.sub!.failedAttempts,
        lastFailureCode: c.sub!.lastFailureCode,
        graceUntil: c.sub!.graceUntil,
        cancelAtPeriodEnd: c.sub!.cancelAtPeriodEnd,
        openAuthPayment: c.sub!.status === 'past_due' && i % 2 === 0,
        isTest: false,
      }));
  const fizetesek: AdminPaymentRow[] = [];
  const szamlak: AdminFeeInvoiceRow[] = [];
  const kezd = () => {
    if (fizetesek.length) return;
    const aktiv = clients.filter((c) => c.sub);
    aktiv.forEach((c, i) => {
      const sikeres: AdminPaymentRow = {
        id: `fiz-${c.id}-1`, client: { id: c.id, name: nev(c) }, kind: i === 0 ? 'elso_havi' : 'havi', provider: 'demo', mode: 'demo', amountHuf: HAVIDIJ, status: 'sikeres', initiated: i === 0 ? 'ugyfel' : 'utemezo', offSession: i !== 0,
        period: { start: '2026-11-08', end: '2026-12-08' }, cardLabel: kartya(c.sub!.cardMask), failureCode: null, declineCode: null, refundedHuf: i === 2 ? 5_000 : 0, refundableHuf: i === 2 ? HAVIDIJ - 5_000 : HAVIDIJ, disputeStatus: null, stripeUrl: null,
        invoice: { id: `szla-${c.id}-1`, number: `DEMO-2026-${100 + i}`, status: 'kiallitva', kind: 'szamla' }, createdAt: '2026-11-08T05:00:02Z', succeededAt: '2026-11-08T05:00:04Z',
      };
      fizetesek.push(sikeres);
      szamlak.push({
        id: `szla-${c.id}-1`, client: sikeres.client, kind: 'szamla', status: 'kiallitva', number: `DEMO-2026-${100 + i}`, issuedOn: '2026-11-08', amountHuf: HAVIDIJ, provider: 'demo', account: 'demo', externalKey: `ADZ-${c.id.replace(/-/g, '').slice(0, 20)}`,
        attempts: 1, nextRetryAt: null, errorCode: null, error: null, fileId: null, paymentId: sikeres.id, stornoOf: null, createdAt: '2026-11-08T05:00:05Z',
      });
      if (c.sub!.status === 'past_due' || c.sub!.failedAttempts > 0) {
        fizetesek.push({
          ...sikeres, id: `fiz-${c.id}-2`, kind: 'havi', initiated: 'utemezo', status: i % 2 === 0 ? 'hitelesites_kell' : 'sikertelen', failureCode: i % 2 === 0 ? 'authentication_required' : 'card_declined', declineCode: i % 2 === 0 ? null : 'insufficient_funds',
          refundedHuf: 0, refundableHuf: 0, invoice: null, createdAt: '2026-11-15T05:00:02Z', succeededAt: null, period: { start: '2026-11-15', end: '2026-12-15' },
        });
      }
    });
    const elso = aktiv[0];
    if (elso) {
      szamlak.unshift({
        id: 'szla-hiba-1', client: { id: elso.id, name: nev(elso) }, kind: 'szamla', status: 'hiba', number: null, issuedOn: null, amountHuf: 14_999, provider: 'szamlazzhu', account: 'teszt', externalKey: 'ADZ-0f3c1e9a7b2d4c6e8a10',
        attempts: 5, nextRetryAt: null, errorCode: '57', error: 'A vevő irányítószáma hiányzik.', fileId: null, paymentId: 'fiz-eves-1', stornoOf: null, createdAt: '2026-11-19T09:12:00Z',
      });
      fizetesek.unshift({
        id: 'fiz-eves-1', client: { id: elso.id, name: nev(elso) }, kind: 'egyszeri', provider: 'demo', mode: 'demo', amountHuf: 14_999, status: 'sikeres', initiated: 'ugyfel', offSession: false, period: null, cardLabel: kartya(elso.sub!.cardMask),
        failureCode: null, declineCode: null, refundedHuf: 0, refundableHuf: 14_999, disputeStatus: 'needs_response', stripeUrl: null, invoice: { id: 'szla-hiba-1', number: null, status: 'hiba', kind: 'szamla' }, createdAt: '2026-11-19T09:11:40Z', succeededAt: '2026-11-19T09:11:44Z',
      });
    }
  };

  on('GET', '/admin/k29/subscriptions', ({ q }) => {
    x.requireAdmin();
    const st = q.get('status');
    const pr = q.get('problem');
    return { items: elofizetesek().filter((r) => (!st || r.status === st) && (!pr || r.openAuthPayment)) };
  });
  on('GET', '/admin/k29/payments', ({ q }) => {
    x.requireAdmin();
    kezd();
    const st = q.get('status');
    return { items: fizetesek.filter((r) => !st || r.status === st) };
  });
  on('GET', '/admin/k29/fee-invoices', ({ q }) => {
    x.requireAdmin();
    kezd();
    const st = q.get('status');
    return { items: szamlak.filter((r) => !st || r.status === st) };
  });
  on('GET', '/admin/k29/system', (): AdminPaymentsSystemView => {
    x.requireAdmin();
    kezd();
    return {
      paymentProvider: 'demo', stripe: 'off', webhookSecret: 'hianyzik', lastWebhookAt: null, unprocessedEvents: 0, stuckEvents: 0, lastReconcileAt: new Date(Date.now() - 6 * 60_000).toISOString(),
      invoiceMode: 'demo', szamlazzhuAccount: null, openInvoiceErrors: szamlak.filter((s) => s.status === 'hiba').length, invoicesInProgress: szamlak.filter((s) => s.status === 'folyamatban').length,
      openPaymentProblems: fizetesek.filter((f) => ['sikertelen', 'hitelesites_kell', 'bizonytalan'].includes(f.status)).length, disputes: fizetesek.filter((f) => f.disputeStatus).length,
    };
  });
  // the console's money actions (§29.9): a step-up is valid for 10 minutes
  on('POST', '/admin/console/step-up', ({ body }) => {
    x.requireAdmin();
    if (!/^\d{6}$/.test(String(body.code ?? ''))) throw x.hiba(400, 'invalid_code', 'Hibás kód. A minta-módban bármely 6 jegyű kód jó.');
    lepesIdo = Date.now();
    return { verifiedAt: x.nowIso() };
  });
  const kellLepes = () => {
    if (Date.now() - lepesIdo > 10 * 60_000) throw x.hiba(403, 'step_up_required', 'Erősítsd meg a kódoddal.');
  };
  on('POST', '/admin/console/payments/:id/refund', ({ p, body }) => {
    x.requireAdmin();
    kellLepes();
    kezd();
    const f = fizetesek.find((r) => r.id === p.id);
    if (!f) throw x.hiba(404, 'not_found', 'Nincs ilyen fizetés.');
    const n = Number(body.amountHuf);
    if (!Number.isInteger(n) || n < 1 || n > f.refundableHuf) throw x.hiba(400, 'validation_failed', 'Hibás összeg.');
    if (String(body.reason ?? '').trim().length < 5) throw x.hiba(422, 'reason_required', 'Írd le az okát.');
    f.refundedHuf += n;
    f.refundableHuf -= n;
    const teljes = f.refundableHuf === 0;
    x.logAudit('admin.payment_refunded', clients.find((c) => c.id === f.client.id) ?? null, { amountHuf: n, reason: body.reason });
    return { refundedHuf: n, invoiceAction: teljes ? 'sztorno' : 'helyesbito' };
  });
  on('POST', '/admin/k29/fee-invoices/:id/retry', ({ p }) => {
    x.requireAdmin();
    kezd();
    const s = szamlak.find((r) => r.id === p.id);
    if (!s) throw x.hiba(404, 'not_found', 'Nincs ilyen számla.');
    s.status = 'folyamatban';
    s.nextRetryAt = new Date(Date.now() + 2 * 60_000).toISOString();
    return {};
  });
}
