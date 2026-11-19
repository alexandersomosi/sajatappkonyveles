// SPEC §28.1.3 – reserve per invoice ("Ennyit tegyél félre"), 2026, 45 %. Values from hand arithmetic and the
// engine runs quoted in the SPEC (11-19).

import { describe, expect, it } from 'vitest';
import { calculateYear, reserveSeries, roundReserve, type ReserveItemInput, type TaxProfileInput, type TaxStatus } from '../src/index.js';
import { prng } from './helpers.js';

const prof = (status: TaxStatus, extra: Partial<TaxProfileInput> = {}): TaxProfileInput => ({ year: 2026, costRatio: 45, status, guaranteedMinimum: false, ...extra });
let n = 0;
const item = (d: string, amountHuf: number, estimated = false): ReserveItemInput => {
  n++;
  const id = `i${String(n).padStart(4, '0')}`;
  return { id, arrivalKey: `${d}T08:00:00Z|${id}`, receivedOn: d, deliveryDate: d, amountHuf, countsForAtalany: true, countsForAfaLimit: true, ...(estimated ? { estimated: true } : {}) };
};
const mm = (m: number) => String(m).padStart(2, '0');
const monthsOf = (amount: number, day: number, months: number[]) => months.map((m) => item(`2026-${mm(m)}-${mm(day)}`, amount));
const L = (status: TaxStatus, items: ReserveItemInput[]) =>
  calculateYear({ profile: prof(status), revenue: items, asOf: '2026-12-31' }).quarters.reduce((s, q) => s + q.totalHuf, 0);

describe('rounding (rule 5)', () => {
  it('up for positive, towards zero for negative', () => {
    expect([roundReserve(9_900), roundReserve(30_690), roundReserve(1_000), roundReserve(0), roundReserve(-30_690), roundReserve(-999)]).toEqual([
      10_000, 31_000, 1_000, 0, -30_000, 0,
    ]);
  });
});

describe('R1–R9', () => {
  it('R1 főfogl., only 120 000 on 01-15 → raw 0, adomentes, base 1 220 184', () => {
    const s = reserveSeries(prof('fofoglalkozasu'), [item('2026-01-15', 120_000)]);
    expect(s.baseHuf).toBe(1_220_184);
    expect(s.fixedByMonthHuf).toEqual(new Array(12).fill(101_682));
    expect(s.lines[0]).toMatchObject({ rawHuf: 0, reserveHuf: 0, zone: 'adomentes', crossesTaxFree: false });
  });

  it('R2 nyugdíjas, 1 000 000 on the 10th of Jan–Nov + 120 000 on 12-15 → 9 900 SZJA, reserve 10 000, csak_szja', () => {
    const s = reserveSeries(prof('nyugdijas'), [...monthsOf(1_000_000, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), item('2026-12-15', 120_000)]);
    expect(s.lines.at(-1)).toMatchObject({ rawHuf: 9_900, szjaHuf: 9_900, tbHuf: 0, szochoHuf: 0, reserveHuf: 10_000, zone: 'csak_szja' });
    expect(s.baseHuf).toBe(0);
  });

  it('R3 mellékállású and főfogl., 1 000 000 every month + 120 000 on 12-15 → 30 690 = 9 900 + 12 210 + 8 580, reserve 31 000, teljes', () => {
    for (const st of ['mellekallasu', 'fofoglalkozasu'] as const) {
      const s = reserveSeries(prof(st), [...monthsOf(1_000_000, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), item('2026-12-15', 120_000)]);
      expect(s.lines.at(-1)).toMatchObject({ rawHuf: 30_690, szjaHuf: 9_900, tbHuf: 12_210, szochoHuf: 8_580, reserveHuf: 31_000, zone: 'teljes' });
    }
  });

  it('R4 főfogl., 500 000 every month + 120 000 on 12-15 → 9 900, csak_szja (zone B)', () => {
    const s = reserveSeries(prof('fofoglalkozasu'), [...monthsOf(500_000, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), item('2026-12-15', 120_000)]);
    expect(s.lines.at(-1)).toMatchObject({ rawHuf: 9_900, zone: 'csak_szja' });
  });

  it('R5 főfogl., one 8 976 000 item on 02-10 → raw 1 089 954 (= 2 310 138 − 1 220 184), reserve 1 090 000', () => {
    const s = reserveSeries(prof('fofoglalkozasu'), [item('2026-02-10', 8_976_000)]);
    expect(s.totalHuf).toBe(2_310_138);
    expect(s.lines[0]).toMatchObject({ rawHuf: 1_089_954, reserveHuf: 1_090_000, zone: 'teljes', crossesTaxFree: true });
  });

  it('R6 telescoping: Σ raw + L(∅) = L(all) for főfogl. / mellékállású / nyugdíjas', () => {
    const series = () => [
      item('2026-01-20', 300_000),
      item('2026-02-05', 1_200_000),
      item('2026-03-30', 800_000),
      item('2026-05-12', 2_500_000),
      item('2026-07-01', 400_000),
      item('2026-09-15', 3_000_000),
      item('2026-11-02', 120_000),
    ];
    const f = reserveSeries(prof('fofoglalkozasu'), series());
    expect(f.lines.map((l) => l.rawHuf)).toEqual([0, 0, 0, 105_480, 33_000, 247_500, 9_900]);
    expect(f.lines.reduce((s, l) => s + l.rawHuf, 0) + f.baseHuf).toBe(1_616_064);
    expect(f.totalHuf).toBe(1_616_064);
    expect(f.lines.map((l) => l.crossesTaxFree)).toEqual([false, false, false, true, false, false, false]);
    const m = reserveSeries(prof('mellekallasu'), series());
    expect(m.lines.map((l) => l.rawHuf)).toEqual([0, 0, 0, 326_988, 102_300, 767_250, 30_690]);
    expect(m.totalHuf).toBe(1_227_228);
    const ny = reserveSeries(prof('nyugdijas'), series());
    expect(ny.lines.map((l) => l.rawHuf)).toEqual([0, 0, 0, 105_480, 33_000, 247_500, 9_900]);
    expect(ny.totalHuf).toBe(395_880);
  });

  it('R7 mellékállású even year + storno −120 000 on 12-15 → raw −30 690, reserve −30 000, sztorno', () => {
    const s = reserveSeries(prof('mellekallasu'), [...monthsOf(1_000_000, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), item('2026-12-15', -120_000)]);
    expect(s.lines.at(-1)).toMatchObject({ rawHuf: -30_690, reserveHuf: -30_000, zone: 'sztorno' });
  });

  it('R8 estimated receipt: no next quarter in December → same; on 03-20 → max(Q1, Q2-shifted)', () => {
    const dec = reserveSeries(prof('mellekallasu'), [...monthsOf(1_000_000, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), item('2026-12-15', 120_000, true)]);
    expect(dec.lines.at(-1)).toMatchObject({ rawHuf: 30_690, estimated: true });
    // főfogl., 1 000 000 every month; an estimated 3 000 000 on 03-20: in Q1 it is partly tax-free, shifted to April it
    // costs more (the minimum of Q1 is already paid) – the larger one wins.
    const base = monthsOf(1_000_000, 10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const est = { ...item('2026-03-20', 3_000_000, true), arrivalKey: '2026-12-31T23:00:00Z|zz' }; // arrives last
    const s = reserveSeries(prof('fofoglalkozasu'), [...base, est]);
    const asQ1 = L('fofoglalkozasu', [...base, { ...est, estimated: false }]) - L('fofoglalkozasu', base);
    const asQ2 = L('fofoglalkozasu', [...base, { ...est, receivedOn: '2026-04-01', deliveryDate: '2026-04-01' }]) - L('fofoglalkozasu', base);
    expect(s.lines.at(-1)!.rawHuf).toBe(Math.max(asQ1, asQ2));
  });

  it('R9 családi 2/2 approved (frame 6 399 840 > taxable 4 663 200), mellékállású, + 120 000 in December → kedvezmeny, raw 20 790', () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const p = prof('mellekallasu', { kedvezmenyek: { csaladi: { months: all.map((month) => ({ month, eltartott: 2, children: [{}, {}] })), csjkInYear: false } } });
    const s = reserveSeries(p, [...monthsOf(1_000_000, 10, all), item('2026-12-15', 120_000)]);
    expect(s.lines.at(-1)).toMatchObject({ szjaHuf: 0, tbHuf: 12_210, szochoHuf: 8_580, rawHuf: 20_790, reserveHuf: 21_000, zone: 'kedvezmeny' });
  });
});

describe('R10 property: Σ raw (no estimates) + base = total', () => {
  it('holds for random series', () => {
    const rnd = prng(2811);
    for (let t = 0; t < 25; t++) {
      const status = (['fofoglalkozasu', 'mellekallasu', 'nyugdijas'] as const)[t % 3]!;
      const k = 1 + Math.floor(rnd() * 15);
      const items: ReserveItemInput[] = [];
      for (let i = 0; i < k; i++) {
        const m = 1 + Math.floor(rnd() * 12);
        const d = 1 + Math.floor(rnd() * 28);
        const amount = Math.floor(rnd() * 3_000_000) - (rnd() < 0.1 ? 1_500_000 : 0);
        items.push(item(`2026-${mm(m)}-${mm(d)}`, amount));
      }
      const s = reserveSeries(prof(status, { guaranteedMinimum: t % 2 === 0 }), items);
      expect(s.lines.reduce((a, l) => a + l.rawHuf, 0) + s.baseHuf).toBe(s.totalHuf);
    }
  });
});
