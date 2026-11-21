// SPEC §32.B – the annual-cycle cards render and send what the server expects: the amounts (with the live difference),
// the refund buttons, the folyószámla form (nothing ticked by default; "rendben" only with the exact amount), the
// önellenőrzés list.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/endpoints', () => ({
  accAnnualAmounts: vi.fn(async () => ({})),
  accAnnualRefund: vi.fn(async () => ({})),
  accAnnualFile: vi.fn(async () => ({})),
  accVerifyPayment: vi.fn(async () => ({})),
  accReconciliations: vi.fn(async () => ({ items: [] })),
  accReconExpected: vi.fn(async () => ({
    asOf: '2027-04-20',
    adonemek: [
      { adonem: '103', label: 'Szja', expectedUnmarkedHuf: 0, expectedMarkedHuf: 30_000 },
      { adonem: '224', label: 'Bírság', expectedUnmarkedHuf: 0, expectedMarkedHuf: 0 },
    ],
    openItems: [{ itemId: 'it-1', periodId: 'p-1', periodLabel: 'IV. negyedév', label: 'SZJA-előleg', adonem: '103', amountHuf: 30_000, dueDate: '2027-01-12', markedPaidOn: '2027-01-10' }],
    suggestedNextCheckOn: '2027-05-10',
    kata: false,
  })),
  accReconSave: vi.fn(async () => ({})),
  accCorrections: vi.fn(async () => ({ items: [] })),
}));

import * as ep from '../../../api/endpoints';
import { KulonbozetKartya, OsszegekKartya } from './EvesCiklus';
import Folyoszamla from './Folyoszamla';
import Onellenorzes from './Onellenorzes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const c = { id: 'cl-1', firstName: 'Éva', lastName: 'Éves', lifecycle: 'aktiv', serviceLock: null, taxProfile: null, flags: [] } as never;
const alap = {
  id: 'an-1',
  year: 2026,
  regime: 'atalany',
  status: 'konyvelonel',
  approval: null,
  amounts: null,
  prefill: { szjaHuf: 140_000, advancesHuf: 120_000 },
  engineEstimate: { diffHuf: 20_000, szjaHuf: 140_000, advancesHuf: 120_000, byQuarter: [] },
  warnings: ['Előbb egyeztesd a folyószámlát: van ellenőrizetlen negyedéves előleg.'],
  settlement: null,
  hipa: null,
};
const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
function ir(input: HTMLInputElement, ertek: string) {
  act(() => {
    setValue.call(input, ertek);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const gomb = (szoveg: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === szoveg) as HTMLButtonElement | undefined;
const tick = () => act(async () => new Promise((r) => setTimeout(r, 0)));
async function var_(fn: () => unknown) {
  for (let i = 0; i < 20 && !fn(); i++) await tick();
}

let hely: HTMLDivElement;
let root: Root;
function render(el: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>{el}</MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
beforeEach(() => {
  hely = document.createElement('div');
  document.body.appendChild(hely);
  root = createRoot(hely);
});
afterEach(() => {
  act(() => root.unmount());
  hely.remove();
  vi.clearAllMocks();
});

describe('Összegek kártya', () => {
  it('prefilled from the app, the live difference, the warning; saves the numbers with "egyeznek"', async () => {
    render(<OsszegekKartya c={c} a={alap as never} frissit={() => {}} zarolt={null} />);
    expect(hely.textContent).toContain('Fizetendő: 20');
    expect(hely.textContent).toContain('egyeztesd a folyószámlát');
    const inputs = [...hely.querySelectorAll('input.doboz.szam')] as HTMLInputElement[];
    ir(inputs[5]!, '150000'); // A
    expect(hely.textContent).toContain('Fizetendő: 30');
    const egyezik = [...hely.querySelectorAll('input[type=checkbox]')].at(-1) as HTMLInputElement;
    act(() => egyezik.click());
    act(() => gomb('Mentés')!.click());
    await tick();
    expect(ep.accAnnualAmounts).toHaveBeenCalledWith('cl-1', 'an-1', expect.objectContaining({ szjaHuf: 150_000, advancesHuf: 120_000, matchesDraft: true }));
  });
});

describe('Különbözet / visszajáró kártya', () => {
  it('a refund waiting: "Megérkezett" sends the status', async () => {
    const a = { ...alap, status: 'beadva', settlement: { diffHuf: -20_000, filedOn: '2027-04-20', filingRef: 'IKT-1', periodId: null, paymentStatus: null, text: 'Beadtuk.', refund: { expectedBy: '2027-05-20', status: 'var', receivedOn: null, receivedHuf: null, markedBy: null, note: null, title: 'Visszajár: 20 000 Ft', text: 'A NAV utalja.', canMark: true } } };
    render(<KulonbozetKartya c={c} a={a as never} frissit={() => {}} zarolt={null} />);
    expect(hely.textContent).toContain('IKT-1');
    act(() => gomb('Megérkezett')!.click());
    await tick();
    expect(ep.accAnnualRefund).toHaveBeenCalledWith('cl-1', 'an-1', expect.objectContaining({ status: 'megerkezett' }));
  });
});

describe('Folyószámla', () => {
  it('nothing ticked by default; a wrong statement amount blocks "rendben"; 224 is a row', async () => {
    render(<Folyoszamla c={c} />);
    await var_(() => gomb('Új egyeztetés'));
    act(() => gomb('Új egyeztetés')!.click());
    await var_(() => hely.textContent?.includes('224 Bírság'));
    expect(hely.textContent).toContain('224 Bírság');
    const lattam = [...hely.querySelectorAll('.eves-lepes input[type=checkbox]')] as HTMLInputElement[];
    expect(lattam.every((x) => !x.checked)).toBe(true);
    act(() => lattam[0]!.click());
    const osszeg = hely.querySelector('input[placeholder="Összeg a kivonaton"]') as HTMLInputElement;
    ir(osszeg, '29000');
    expect(hely.textContent).toContain('eltérésként');
  });
});

describe('Önellenőrzés fül', () => {
  it('empty list and the "Új önellenőrzés" button', async () => {
    render(<Onellenorzes c={c} />);
    await var_(() => hely.textContent?.includes('Még nincs'));
    expect(hely.textContent).toContain('Még nincs önellenőrzés');
    expect(gomb('Új önellenőrzés')).toBeTruthy();
  });
});
