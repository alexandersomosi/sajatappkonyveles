// k8 ALAP-B (B11): the console's díjbekérő states (a red "Késik (n napja)") and the manual mark "Beérkezett, rögzítem":
// it asks for a reason (≥ 5 characters) and a confirmation, and sends the díjbekérő's own amount.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/k8', () => ({
  consoleTransferPaid: vi.fn(async () => ({ id: 'tr-2', status: 'fizetve' })),
  consoleTransferResend: vi.fn(async () => ({ ok: true })),
  consoleLock: vi.fn(async () => ({})),
  consoleTransfers: vi.fn(async () => ({ items: [] })),
  consoleTransferSummary: vi.fn(async () => ({ fizetett: 0, fizetettHuf: 0, var: 0, varHuf: 0, kesik: 0, kesikHuf: 0, ugyfelek: 0 })),
  consoleFizetesKapcsolok: vi.fn(async () => ({ atutalas: true, kesesLeallit: false, kozlemeny: 'havi' })),
  consoleFizetesKapcsolokMent: vi.fn(async () => ({ atutalas: true, kesesLeallit: false, kozlemeny: 'havi' })),
}));

import * as k8 from '../../../api/k8';
import { allapotCimke, KeziJelolesFiok, KEZI_OK } from './Atutalas';
import type { AdminTransferRow } from '../../../_shared/k8';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sor = { id: 'tr-2', clientId: 'cl-2', clientName: 'Átutaló Ágnes', customerNo: 10472, kind: 'havi', period: { start: '2026-11-09', end: '2026-12-09' }, amountHuf: 19_999, orderNo: 'ADZ-10472-2026-11', kozlemeny: 'ADZ-10472-2026-11', proformaNumber: 'DEMO-D-2026-000072', issuedOn: '2026-11-09', dueOn: '2026-11-17', status: 'kesik', statusLabel: 'Késik', daysLate: 4, paidOn: null, paidAmountHuf: null, paidSource: null, lastCheckedAt: null, remindersSent: [1, 4], pdfFileId: null, mode: 'demo' } as AdminTransferRow;

const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
const gomb = (szoveg: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === szoveg) as HTMLButtonElement | undefined;

let hely: HTMLDivElement;
let root: Root;
const kesz = vi.fn();
beforeEach(() => {
  hely = document.createElement('div');
  document.body.appendChild(hely);
  root = createRoot(hely);
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <KeziJelolesFiok r={sor} bezar={() => undefined} kesz={kesz} />
      </QueryClientProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  hely.remove();
  vi.clearAllMocks();
});

describe('konzol – átutalás', () => {
  it('állapotcímkék: a késő piros, a napok számával; a fizetett zöld; a váró info', () => {
    expect(allapotCimke(sor)).toEqual({ szoveg: 'Késik (4 napja)', osztaly: 'cimke hiba' });
    expect(allapotCimke({ status: 'fizetve', statusLabel: 'Fizetve', daysLate: 0 }).osztaly).toBe('cimke ok');
    expect(allapotCimke({ status: 'kiallitva', statusLabel: 'Vár', daysLate: 0 }).osztaly).toBe('cimke info');
  });

  it('a kézi rögzítés okot és megerősítést kér, és a díjbekérő összegét küldi', async () => {
    const ok = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(ok.value).toBe(KEZI_OK);
    act(() => {
      setValue.call(ok, 'ok');
      ok.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(gomb('Tovább')!.disabled).toBe(true);
    expect(document.body.textContent).toContain('Írd le röviden az okát.');
    act(() => {
      setValue.call(ok, 'Erste kivonat, 11-21');
      ok.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(gomb('Tovább')!.disabled).toBe(false);
    expect(k8.consoleTransferPaid).not.toHaveBeenCalled();
    act(() => gomb('Tovább')!.click());
    expect(document.body.textContent).toContain('Rögzíted: beérkezett 19');
    await act(async () => gomb('Megerősítem')!.click());
    expect(k8.consoleTransferPaid).toHaveBeenCalledWith('tr-2', expect.objectContaining({ amountHuf: 19_999, reason: 'Erste kivonat, 11-21' }));
    expect(kesz).toHaveBeenCalled();
  });
});
