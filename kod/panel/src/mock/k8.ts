// k8 ALAP-B – the panel mock of the bank transfer (npm run dev:mock / kepek): the console's díjbekérő table and tile, the
// manual mark, resend, the payment switches, the DEMO outbox's "Levél képe" link. Fictional data only.
import type { AdminTransferRow, AdminTransferSummary, FizetesKapcsolok } from '../_shared/k8';

type H = (r: { q: URLSearchParams; body: Record<string, unknown>; form: FormData | null; p: Record<string, string> }) => unknown;

export interface K8Ctx {
  on: (m: string, path: string, h: H) => void;
  nowIso: () => string;
  hiba: (status: number, code: string, msg: string, extra?: Record<string, unknown>) => Error;
  requireAdmin: () => void;
}

const sor = (id: string, nev: string, no: number, status: AdminTransferRow['status'], issuedOn: string, dueOn: string, daysLate: number, paidOn: string | null): AdminTransferRow => ({
  id,
  clientId: `cl-${id}`,
  clientName: nev,
  customerNo: no,
  kind: 'havi',
  period: { start: issuedOn, end: `${issuedOn.slice(0, 5)}${String(Number(issuedOn.slice(5, 7)) + 1).padStart(2, '0')}${issuedOn.slice(7)}` },
  amountHuf: 19_999,
  orderNo: `ADZ-${no}-${issuedOn.slice(0, 7)}`,
  kozlemeny: `ADZ-${no}-${issuedOn.slice(0, 7)}`,
  proformaNumber: `DEMO-D-2026-00${no % 100}`,
  issuedOn,
  dueOn,
  status,
  statusLabel: status === 'kesik' ? 'Késik' : status === 'fizetve' ? 'Fizetve' : 'Vár',
  daysLate,
  paidOn,
  paidAmountHuf: paidOn ? 19_999 : null,
  paidSource: paidOn ? 'demo' : null,
  lastCheckedAt: '2026-11-21T08:00:00Z',
  remindersSent: daysLate >= 4 ? [1, 4] : daysLate >= 1 ? [1] : [],
  pdfFileId: null,
  mode: 'demo',
});

export function installK8(x: K8Ctx): void {
  const { on } = x;
  const sorok: AdminTransferRow[] = [
    sor('tr-1', 'Utaló Péter', 10471, 'fizetve', '2026-11-01', '2026-11-09', 0, '2026-11-04'),
    sor('tr-2', 'Átutaló Ágnes', 10472, 'kesik', '2026-11-09', '2026-11-17', 4, null),
    sor('tr-3', 'Kiss Zoé', 10482, 'kiallitva', '2026-11-20', '2026-11-28', 0, null),
  ];
  let kapcsolok: FizetesKapcsolok = { atutalas: true, kesesLeallit: false, kozlemeny: 'havi' };
  on('GET', '/admin/console/transfers', ({ q }) => {
    x.requireAdmin();
    const st = q.get('status');
    const map: Record<string, AdminTransferRow['status']> = { fizetett: 'fizetve', var: 'kiallitva', kesik: 'kesik', hiba: 'hiba' };
    return { items: sorok.filter((r) => (!st || r.status === map[st]) && (!q.get('clientId') || r.clientId === q.get('clientId'))) };
  });
  on('GET', '/admin/console/transfers/summary', () => {
    x.requireAdmin();
    const n = (s: AdminTransferRow['status']) => sorok.filter((r) => r.status === s);
    const s: AdminTransferSummary = { fizetett: n('fizetve').length, fizetettHuf: n('fizetve').length * 19_999, var: n('kiallitva').length, varHuf: n('kiallitva').length * 19_999, kesik: n('kesik').length, kesikHuf: n('kesik').length * 19_999, ugyfelek: 3 };
    return s;
  });
  on('POST', '/admin/console/transfers/:id/paid', ({ p, body }) => {
    x.requireAdmin();
    const r = sorok.find((s) => s.id === p.id);
    if (!r) throw x.hiba(404, 'not_found', 'Nincs ilyen díjbekérő.');
    if (Number(body.amountHuf) !== r.amountHuf) throw x.hiba(409, 'osszeg_elteres', 'Az összeg nem egyezik a díjbekérővel.');
    if (String(body.reason ?? '').trim().length < 5) throw x.hiba(400, 'validation_failed', 'Írd be, miért rögzíted kézzel.');
    Object.assign(r, { status: 'fizetve', statusLabel: 'Fizetve', paidOn: String(body.paidOn), paidSource: 'kezi', daysLate: 0 });
    return { id: r.id, status: 'fizetve' };
  });
  on('POST', '/admin/console/transfers/:id/resend', () => {
    x.requireAdmin();
    return { ok: true };
  });
  on('GET', '/admin/console/switches/fizetes', () => {
    x.requireAdmin();
    return kapcsolok;
  });
  on('PUT', '/admin/console/switches/fizetes', ({ body }) => {
    x.requireAdmin();
    const { reason: _r, ...patch } = body as Partial<FizetesKapcsolok> & { reason?: string };
    kapcsolok = { ...kapcsolok, ...patch };
    return kapcsolok;
  });
  on('GET', '/admin/demo-outbox/:id/html', () => {
    x.requireAdmin();
    return { url: 'about:blank' };
  });
}
