// k7b (KONYVELO_LEFEDETTSEG, 1. hiba): the iparűzési adóelőleg is approved on the panel's Adó tab – amount + the
// önkormányzat's account number → "Jóváhagyom és elküldöm" → confirmation → POST /acc/tax-periods/:id/hipa-approve.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/endpoints', () => ({
  accHipaApprove: vi.fn(async () => ({ ok: true })),
  accReopen: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../../auth/Auth', () => ({ useAuth: () => ({ user: { role: 'accountant' } }) }));

import * as ep from '../../../api/endpoints';
import { HipaIdoszak, hipaSzamlaJo } from './Ado';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const p = { id: 'per-hipa-1', kind: 'hipa', periodKey: '2026-HIPA-2', year: 2026, dueDate: '2099-09-15', calcStatus: 'nincs_szamolva', paymentStatus: 'nincs', filingStatus: 'nincs' } as never;
const c = { id: 'cl-1', firstName: 'Kata', lastName: 'Szabó', lifecycle: 'aktiv', serviceLock: null, taxProfile: null } as never;

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
function ir(input: HTMLInputElement, ertek: string) {
  act(() => {
    setValue.call(input, ertek);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const gomb = (szoveg: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === szoveg) as HTMLButtonElement | undefined;

let hely: HTMLDivElement;
let root: Root;
beforeEach(() => {
  hely = document.createElement('div');
  document.body.appendChild(hely);
  root = createRoot(hely);
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <HipaIdoszak p={p} c={c} />
      </QueryClientProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  hely.remove();
  vi.clearAllMocks();
});

describe('iparűzési adóelőleg jóváhagyása (panel, Adó fül)', () => {
  it('a számlaszám formája: 2×8 vagy 3×8 számjegy kötőjellel', () => {
    expect(hipaSzamlaJo('11784009-15400017-03540000')).toBe(true);
    expect(hipaSzamlaJo(' 11784009-15400017 ')).toBe(true);
    expect(hipaSzamlaJo('11784009154000170354')).toBe(false);
    expect(hipaSzamlaJo('1178400-15400017')).toBe(false);
  });

  it('összeg + számlaszám → „Jóváhagyom és elküldöm” → megerősítés → a végpont a beírt adatokkal', async () => {
    const [osszeg, szamla] = [...hely.querySelectorAll('input')] as HTMLInputElement[];
    expect(gomb('Jóváhagyom és elküldöm')!.disabled).toBe(true);
    ir(osszeg!, '42 000');
    ir(szamla!, '11784009-1540001');
    expect(gomb('Jóváhagyom és elküldöm')!.disabled).toBe(true); // rossz számlaszám
    expect(hely.textContent).toContain('2×8 vagy 3×8 számjegy');
    ir(szamla!, '11784009-15400017-03540000');
    expect(gomb('Jóváhagyom és elküldöm')!.disabled).toBe(false);
    act(() => gomb('Jóváhagyom és elküldöm')!.click());
    expect(document.body.textContent).toContain('Elküldöd Kata részére?');
    await act(async () => gomb('Igen, jóváhagyom és elküldöm')!.click());
    expect(ep.accHipaApprove).toHaveBeenCalledWith('per-hipa-1', { amountHuf: 42_000, accountNumber: '11784009-15400017-03540000' });
  });

  it('0 Ft: számlaszám nélkül is jóváhagyható (nincs fizetendő)', async () => {
    const [osszeg] = [...hely.querySelectorAll('input')] as HTMLInputElement[];
    ir(osszeg!, '0');
    expect(gomb('Jóváhagyom és elküldöm')!.disabled).toBe(false);
    act(() => gomb('Jóváhagyom és elküldöm')!.click());
    await act(async () => gomb('Igen, jóváhagyom és elküldöm')!.click());
    expect(ep.accHipaApprove).toHaveBeenCalledWith('per-hipa-1', { amountHuf: 0, accountNumber: null });
  });
});
