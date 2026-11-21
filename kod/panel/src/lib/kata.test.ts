// SPEC §32 – the panel's KATA rules (lib/kata.ts) and the KATA texts the accountant sees.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bejelentesKell, honapban, kataHonapCimke, kataSavSzin, kataSzunetHiba, kijelolheto } from './kata';
import { KATA_EXEMPT_KINDS, KATA_EXEMPT_PANEL_LABELS, KATA_PANEL_TEXTS, type KataMonthView } from '../_shared/kata';

const honap = (o: Partial<KataMonthView> = {}): KataMonthView => ({
  periodId: 'p1',
  month: 11,
  monthKey: '2026-11',
  label: 'november',
  status: 'fizetendo',
  liable: true,
  exemptReason: null,
  exemptReasonLabel: null,
  exemptLostByRevenue: false,
  amountHuf: 50_000,
  dueDate: '2026-12-14',
  overdue: false,
  markedPaidOn: null,
  verification: null,
  backfilled: false,
  paidButExempt: false,
  ...o,
});

describe('KATA month chip', () => {
  it('status → chip text and colour', () => {
    expect(kataHonapCimke(honap())).toEqual({ szoveg: 'Fizetendő', tipus: 'semleges' });
    expect(kataHonapCimke(honap({ overdue: true }))).toEqual({ szoveg: 'Fizetendő – lejárt', tipus: 'hiba' });
    expect(kataHonapCimke(honap({ status: 'befizetve_jelezve' })).tipus).toBe('info');
    expect(kataHonapCimke(honap({ status: 'ellenorizve' })).tipus).toBe('ok');
    expect(kataHonapCimke(honap({ status: 'mentes', exemptReasonLabel: 'táppénz' })).szoveg).toBe('Mentes – táppénz');
    expect(kataHonapCimke(honap({ status: 'nincs_osszeg' })).szoveg).toBe('Összeg nincs megerősítve');
    expect(kataHonapCimke(honap({ status: 'ellenorizetlen' })).tipus).toBe('figyel');
    expect(kataHonapCimke(honap({ status: 'befizetve_jelezve', paidButExempt: true }))).toEqual({ szoveg: 'Befizette, de mentes', tipus: 'hiba' });
  });
  it('group "Rendben": marked, unmarked and pre-app months; never a free, verified or unconfirmed one', () => {
    expect(kijelolheto(honap())).toBe(true);
    expect(kijelolheto(honap({ status: 'befizetve_jelezve' }))).toBe(true);
    expect(kijelolheto(honap({ status: 'ellenorizetlen' }))).toBe(true);
    expect(kijelolheto(honap({ status: 'ellenorizve' }))).toBe(false);
    expect(kijelolheto(honap({ status: 'mentes' }))).toBe(false);
    expect(kijelolheto(honap({ status: 'nincs_osszeg' }))).toBe(false);
    expect(kijelolheto(honap({ periodId: null }))).toBe(false);
  });
});

describe('free months (Kata tv. 7. § (8)–(10))', () => {
  it('validation', () => {
    expect(kataSzunetHiba([{ from: '2026-03-01', to: '2026-03-31', kind: 'tappenz' }], 2026, '2026-11-21')).toBeNull();
    expect(kataSzunetHiba([{ from: '2026-03-31', to: '2026-03-01', kind: 'tappenz' }], 2026, '2026-11-21')).toBe('A kezdet nem lehet a vég után.');
    expect(kataSzunetHiba([{ from: '2025-03-01', to: '2025-03-31', kind: 'csed' }], 2026, '2026-11-21')).toBe('Az időszaknak 2026-re kell esnie.');
    expect(kataSzunetHiba([{ from: '', to: '2026-03-31', kind: 'gyed' }], 2026, '2026-11-21')).toContain('ÉÉÉÉ-HH-NN');
    expect(kataSzunetHiba([{ from: '2026-03-01', to: '2026-03-31', kind: 'gyed', reportedOn: '2026-12-01' }], 2026, '2026-11-21')).toContain('jövőben');
  });
  it('notice only for a)–c); every reason has a panel label naming the paragraph; the plan-external ones wait for Dávid', () => {
    expect(bejelentesKell('szunetel')).toBe(false);
    expect(bejelentesKell('tappenz')).toBe(true);
    for (const k of KATA_EXEMPT_KINDS) expect(KATA_EXEMPT_PANEL_LABELS[k]).toMatch(/7\. § \(8\)/);
    // javító kör 11-21: no internal marker on the panel – "(még egyeztetjük)"
    expect(KATA_EXEMPT_PANEL_LABELS.orokbefogadoi_dij).toContain('(még egyeztetjük)');
    expect(KATA_EXEMPT_PANEL_LABELS.gyod).toContain('(még egyeztetjük)');
    expect(Object.values(KATA_EXEMPT_PANEL_LABELS).join(' ')).not.toContain('Dávid');
  });
});

describe('the bar and the texts', () => {
  it('colour by level', () => {
    expect(kataSavSzin('rendben')).toBe('var(--tintakek)');
    expect(kataSavSzin('figyelem')).toBe('var(--borostyan)');
    expect(kataSavSzin('tullepve')).toBe('var(--veszely)');
  });
  it('no "a(z)", no time promise, the T/928 note says it is not law yet', () => {
    const all = JSON.stringify(KATA_PANEL_TEXTS);
    expect(all).not.toMatch(/a\(z\)/i);
    expect(all).not.toMatch(/órán belül|munkanapon belül/);
    expect(KATA_PANEL_TEXTS.tervezet2027).toContain('T/928 nincs kihirdetve');
    expect(KATA_PANEL_TEXTS.valtozatMegjegyzes).toContain('nem javasol');
  });
  it('H8: the panel does not put a fixed accountant name into the client texts', () => {
    const src = readFileSync(join(__dirname, '../pages/acc/ugyfel/K28Kartyak.tsx'), 'utf8');
    expect(src).not.toMatch(/replace\('\{firstName\}', 'Bence'\)/);
  });
});

describe('honapban (javító kör 11-21)', () => {
  it('the inessive of a month name, capitalised', () => {
    expect(honapban('szeptember')).toBe('Szeptemberben');
    expect(honapban('január')).toBe('Januárban');
    expect(honapban('március')).toBe('Márciusban');
    expect(honapban('október')).toBe('Októberben');
    expect(honapban('április')).toBe('Áprilisban');
    expect(honapban('november')).toBe('Novemberben');
  });
});
