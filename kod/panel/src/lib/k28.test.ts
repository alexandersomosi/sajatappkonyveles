// SPEC §28 / §28.K panel rules (src/lib/k28.ts) + the change-kind rules added to src/lib/helyettunk.ts.
import { describe, expect, it } from 'vitest';
import {
  dijHibak,
  dijSzoveg,
  elonezetSorok,
  evesGombok,
  felreteszErtek,
  felreteszTipp,
  haviIlleszkedik,
  honapValt,
  honapokSzoveg,
  kezikonyvSzoveg,
  negyedevHatas,
  valaszidoTilos,
  valtozasMezok,
  zarolasCimke,
  zaroltMiert,
} from './k28';
import { aktivFazis, fazisKesz, fazisok, muveletAllapot, valtozasFajta, type MuveletKornyezet } from './helyettunk';
import type { AllowancePreview, InvoiceReserveView } from '../api/types';
import { CHANGE_HANDBOOK, LOCK_TEXTS } from '../_shared/bekotes';

/** szam() groups thousands with a no-break space; compare with plain spaces. */
const n = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

const tartalek = (o: Partial<InvoiceReserveView> = {}): InvoiceReserveView => ({
  year: 2026,
  reserveHuf: 31_000,
  rawHuf: 30_690,
  parts: { szjaHuf: 9_900, tbHuf: 12_210, szochoHuf: 8_580 },
  zone: 'teljes',
  crossesTaxFree: false,
  estimated: false,
  nextYear: false,
  line: '',
  listLine: 'Tegyél félre kb. 31 000 Ft-ot',
  partsText: 'SZJA, TB-járulék, szocho',
  thresholdText: null,
  ...o,
});

describe('Félretenni column (SPEC §28.1.9)', () => {
  it('shows the rounded amount, "—" for nincs_adat and a signed storno', () => {
    expect(n(felreteszErtek(tartalek()))).toBe('31 000 Ft');
    expect(n(felreteszErtek(tartalek({ zone: 'nincs_adat' })))).toBe('—');
    expect(n(felreteszErtek(undefined))).toBe('—');
    expect(n(felreteszErtek(tartalek({ reserveHuf: -30_000, zone: 'sztorno' })))).toBe('−30 000 Ft');
    expect(n(felreteszErtek(tartalek({ reserveHuf: 0, zone: 'adomentes' })))).toBe('0 Ft');
  });
  it('the tooltip names the parts and the zone in staff words (R3 example)', () => {
    const t = n(felreteszTipp(tartalek({ crossesTaxFree: true })));
    expect(t).toContain('SZJA + járulék');
    expect(t).toContain('SZJA 9 900 Ft');
    expect(t).toContain('TB 12 210 Ft');
    expect(t).toContain('szocho 8 580 Ft');
    expect(t).toContain('nyers 30 690 Ft');
    expect(t).toContain('adómentes rész');
  });
});

describe('months (SPEC §28.3.6)', () => {
  it('reads a continuous range, a single month and a gappy list', () => {
    expect(honapokSzoveg([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('január–december');
    expect(honapokSzoveg([6, 7, 8, 9, 10, 11, 12])).toBe('június–december');
    expect(honapokSzoveg([8])).toBe('augusztus');
    expect(honapokSzoveg([3, 6, 9])).toBe('márc., jún., szept.');
    expect(honapokSzoveg([])).toBe('egy hónap sincs');
  });
  it('toggles a month and keeps the order', () => {
    expect(honapValt([1, 3], 2)).toEqual([1, 2, 3]);
    expect(honapValt([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe('allowance preview (SPEC §28.3.6)', () => {
  const pv: AllowancePreview = {
    without: { szjaHuf: 300_000, tbHuf: 400_000, szochoHuf: 280_000 },
    with: { szjaHuf: 0, tbHuf: 360_000, szochoHuf: 280_000 },
    savedHuf: 340_000,
    byKind: [],
    csaladiUnusedHuf: 1_200_000,
    annualCsjkPotentialHuf: 180_000,
    warnings: [],
  };
  it('writes the effect line and the unused-family-allowance line', () => {
    const s = elonezetSorok(pv);
    expect(n(s.fo)).toBe('Idei hatás (becslés): SZJA −300 000 Ft · TB −40 000 Ft (családi járulékkedvezmény) · Szocho változatlan.');
    expect(n(s.fel)).toContain('1 200 000 Ft');
    expect(n(s.fel)).toContain('180 000 Ft');
    expect(elonezetSorok({ ...pv, csaladiUnusedHuf: 0 }).fel).toBeNull();
  });
  it('splits the yearly saving over the quarters by the approved months', () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(negyedevHatas(pv, all, 4)).toBe(85_000);
    expect(negyedevHatas(pv, [10, 11, 12], 4)).toBe(340_000);
    expect(negyedevHatas(pv, [10, 11, 12], 1)).toBe(0);
    expect(negyedevHatas(pv, [], 1)).toBe(0);
  });
});

describe('change data rows (SPEC §28.5.5)', () => {
  it('lists the NAV address fields in form order with copy buttons', () => {
    const r = valtozasMezok({
      kind: 'valtozas_szekhely',
      address: { zip: '1117', city: 'Budapest', district: 'XI.', streetName: 'Próba', streetType: 'utca', houseNumber: '3', floor: '2', door: '5' },
      effectiveOn: '2026-12-01',
      right: 'berlet',
      provider: null,
      alsoHomeAddress: false,
    });
    expect(r.map((x) => x.cim)).toEqual(['Ország', 'Irányítószám', 'Település', 'Kerület', 'Közterület neve', 'Közterület jellege', 'Házszám / helyrajzi szám', 'Szint', 'Ajtó', 'Változás napja', 'Jogcím']);
    expect(r.find((x) => x.cim === 'Irányítószám')).toMatchObject({ ertek: '1117', masol: true });
    expect(r.find((x) => x.cim === 'Ország')?.masol).toBe(false);
  });
  it('szüneteltetés: start day, open end', () => {
    const r = valtozasMezok({ kind: 'valtozas_szuneteltetes', from: '2026-12-01', to: null });
    expect(r[0]!.cim).toBe('A szüneteltetés kezdő napja');
    expect(r[1]).toMatchObject({ ertek: 'nincs megadva', masol: false });
  });
  it('picks the handbook line per kind (Ügysegéd / szünetel / folytatás / T101E)', () => {
    expect(kezikonyvSzoveg('valtozas_szekhely')).toBe(CHANGE_HANDBOOK.ugyseged);
    expect(kezikonyvSzoveg('valtozas_szuneteltetes')).toBe(CHANGE_HANDBOOK.szunetel);
    expect(kezikonyvSzoveg('valtozas_folytatas')).toBe(CHANGE_HANDBOOK.folytatas);
    expect(kezikonyvSzoveg('valtozas_adoadat')).toBe(CHANGE_HANDBOOK.t101e);
  });
});

describe('change kinds on /helyettunk (SPEC §28.5.5)', () => {
  const k = (o: Partial<MuveletKornyezet>): MuveletKornyezet => ({
    status: 'egyeztetve',
    kind: 'valtozas_szekhely',
    szerep: 'konyvelo',
    sajatKonyvelo: true,
    allowed: ['adatok_rendben', 'lezaras'],
    hianyzo: 0,
    konyveloUtonev: 'Bence',
    answersMatchConsent: null,
    ...o,
  });
  it('knows the change kinds and their phases (hivas only after a callback)', () => {
    expect(valtozasFajta('valtozas_adoadat')).toBe(true);
    expect(valtozasFajta('meghatalmazas')).toBe(false);
    expect(fazisok('valtozas_szekhely', { status: 'egyeztetve', checklistPhases: ['valtozas_adatok', 'valtozas_bejelentes'] })).toEqual(['valtozas_adatok', 'valtozas_bejelentes']);
    expect(fazisok('valtozas_szekhely', { status: 'visszahivas_kerve' })).toEqual(['hivas', 'valtozas_adatok', 'valtozas_bejelentes']);
    expect(aktivFazis('egyeztetve', 'valtozas_szekhely')).toBe('valtozas_adatok');
    expect(aktivFazis('ugyfel_engedelyezte', 'valtozas_szekhely')).toBe('valtozas_bejelentes');
    expect(aktivFazis('dijra_var', 'valtozas_szekhely')).toBeNull();
    expect(fazisKesz('valtozas_adatok', 'meghatalmazas_el')).toBe(true);
    expect(fazisKesz('valtozas_bejelentes', 'ugyfel_engedelyezte')).toBe(false);
    expect(fazisKesz('valtozas_bejelentes', 'bejelentes_bekuldve')).toBe(true);
  });
  it('change-ready: own accountant, complete list; the EV buttons never show for a change', () => {
    expect(muveletAllapot('adatok_rendben', k({}))).toEqual({ mehet: true, miert: null });
    expect(muveletAllapot('adatok_rendben', k({ hianyzo: 2 }))?.miert).toBe('Még 2 pont van hátra a listából.');
    expect(muveletAllapot('ujegyke_bekuldve', k({}))).toBeNull();
    expect(muveletAllapot('adatok_rendben', k({ kind: 'meghatalmazas' }))).toBeNull();
  });
  it('four eyes on change-done: the accountant is refused unless the server allows it; csapat may', () => {
    const be = { status: 'bejelentes_bekuldve' as const };
    expect(muveletAllapot('valtozas_kesz', k({ ...be, allowed: ['lezaras'] }))?.mehet).toBe(false);
    expect(muveletAllapot('valtozas_kesz', k({ ...be, allowed: ['lezaras'] }))?.miert).toContain('Négy szem elve');
    expect(muveletAllapot('valtozas_kesz', k({ ...be, szerep: 'csapat', sajatKonyvelo: false, allowed: ['valtozas_kesz', 'lezaras'] }))).toEqual({ mehet: true, miert: null });
  });
  it('ev-filed for a change waits for the client consent; a service lock disables every filing', () => {
    expect(muveletAllapot('valtozas_bekuldve', k({ status: 'meghatalmazas_el', allowed: ['lezaras'] }))?.miert).toBe('Az ügyfél még nem engedélyezte a bejelentést.');
    expect(muveletAllapot('valtozas_bekuldve', k({ status: 'ugyfel_engedelyezte', allowed: ['bejelentes_bekuldve', 'lezaras'] }))).toEqual({ mehet: true, miert: null });
    expect(muveletAllapot('adatok_rendben', k({ zarolva: LOCK_TEXTS.panelDisabled }))).toEqual({ mehet: false, miert: LOCK_TEXTS.panelDisabled });
    expect(muveletAllapot('valtozas_bekuldve', k({ status: 'dijra_var' }))).toBeNull();
  });
});

describe('service lock (SPEC §28.K.5)', () => {
  it('writes the red chip with the date and the amount', () => {
    const l = { reasons: ['havidij' as const], since: '2026-11-02', amountHuf: 19_999, text: '', payRoute: '/fiok/elofizetes' };
    expect(n(zarolasCimke(l))).toBe('Zárolva: díj elmaradt (november 2. óta, 19 999 Ft)');
    expect(zaroltMiert(l)).toBe(LOCK_TEXTS.panelDisabled);
    expect(zaroltMiert(null)).toBeNull();
  });
});

describe('fee settings (SPEC §28.K.1)', () => {
  it('needs whole forints and a ≥ 30-day date for a monthly-fee rise', () => {
    const havi = { kind: 'havidij' as const, amountHuf: 19_999 };
    expect(dijHibak(havi, '19 999', '', '2026-11-19')).toEqual({});
    expect(dijHibak(havi, '19 999,5', '', '2026-11-19').amountHuf).toBeTruthy();
    expect(dijHibak(havi, '', '', '2026-11-19').amountHuf).toBeTruthy();
    expect(dijHibak(havi, '21 999', '', '2026-11-19').effectiveFrom).toContain('kötelező');
    expect(dijHibak(havi, '21 999', '2026-12-01', '2026-11-19').effectiveFrom).toContain('30');
    expect(dijHibak(havi, '21 999', '2026-12-19', '2026-11-19')).toEqual({});
    expect(dijHibak(havi, '17 999', '', '2026-11-19')).toEqual({});
    expect(dijHibak({ kind: 'valtozas_egyszeru', amountHuf: 4_999 }, '9 999', '', '2026-11-19')).toEqual({});
    expect(dijHibak({ kind: 'valtozas_egyszeru', amountHuf: 4_999 }, '0', '', '2026-11-19')).toEqual({});
  });
  it('prints the unit', () => {
    expect(n(dijSzoveg(4_999, 'alkalom'))).toBe('4 999 Ft / alkalom');
    expect(n(dijSzoveg(19_999, 'ho'))).toBe('19 999 Ft / hó');
    expect(n(dijSzoveg(14_999, 'ev'))).toBe('14 999 Ft / év');
  });
});

describe('check-in queue (SPEC §28.K.2)', () => {
  it('"Rád vár" is the accountant ball for him, the team ball for csapat', () => {
    expect(haviIlleszkedik({ status: 'uj', ball: 'konyvelo' }, 'nalam', 'konyvelo')).toBe(true);
    expect(haviIlleszkedik({ status: 'uj', ball: 'konyvelo' }, 'nalam', 'csapat')).toBe(false);
    expect(haviIlleszkedik({ status: 'csapatnal', ball: 'csapat' }, 'nalam', 'csapat')).toBe(true);
    expect(haviIlleszkedik({ status: 'dijra_var', ball: 'ugyfel' }, 'dijra_var', 'konyvelo')).toBe(true);
    expect(haviIlleszkedik({ status: 'dijra_var', ball: 'ugyfel' }, 'ugyfelnel', 'konyvelo')).toBe(true);
    expect(haviIlleszkedik({ status: 'kesz', ball: null }, 'nyitott', 'konyvelo')).toBe(false);
    expect(haviIlleszkedik({ status: 'nem_kell', ball: null }, 'kesz', 'admin')).toBe(true);
  });
});

describe('annual closing buttons (SPEC §28.K.3)', () => {
  it('shows the step that is due', () => {
    expect(evesGombok('konyvelonel', 'atalany')).toMatchObject({ tervezet: true, szja: true, hipa: false, szjaFelirat: 'Beadtam az SZJA-bevallást' });
    expect(evesGombok('jovahagyasra_var', 'kata').szjaFelirat).toBe('Beadtam a kata-nyilatkozatot');
    expect(evesGombok('beadva', 'atalany')).toMatchObject({ tervezet: false, szja: false, hipa: true });
    expect(evesGombok('dijra_var', 'atalany')).toMatchObject({ tervezet: false, szja: false, hipa: false });
  });
});

describe('no answer-time promise (SPEC §28.K.15)', () => {
  it('refuses the old texts and accepts the new default', () => {
    expect(valaszidoTilos('Munkanapokon 4 órán belül válaszol')).toBe(true);
    expect(valaszidoTilos('Nincs buta kérdés!')).toBe(true);
    expect(valaszidoTilos('A lehető leggyorsabban válaszol')).toBe(false);
  });
});
