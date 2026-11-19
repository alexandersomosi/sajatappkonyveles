import { describe, expect, it } from 'vitest';
import { decimalToForint } from '../src/money.js';
import { budapestDate, splitDateWindows, splitTimeWindows, daysBetween } from '../src/windows.js';
import { isValidTaxNumber, normalizeTaxNumber } from '../src/validate.js';
import { NavError } from '../src/errors.js';

describe('decimalToForint', () => {
  it.each([
    ['167000', 167000],
    ['167000.00', 167000],
    ['930000.49', 930000],
    ['930000.5', 930001],
    ['-480.50', -481],
    ['-0.4', 0],
    ['+12', 12],
    ['0', 0],
  ])('%s → %d', (s, n) => {
    expect(decimalToForint(s)).toBe(n);
    expect(Object.is(decimalToForint(s), -0)).toBe(false);
  });
  it('rejects garbage and out-of-range values', () => {
    expect(() => decimalToForint('12,5')).toThrow(NavError);
    expect(() => decimalToForint('1e5')).toThrow(NavError);
    expect(() => decimalToForint('99999999999999999999')).toThrow(NavError);
  });
});

describe('35-day windows', () => {
  it('splits a year into ≤ 35-day inclusive windows without gaps', () => {
    const w = splitDateWindows('2026-01-01', '2026-11-17');
    expect(w[0]).toEqual({ from: '2026-01-01', to: '2026-02-04' });
    for (const x of w) expect(daysBetween(x.from, x.to)).toBeLessThanOrEqual(34);
    for (let i = 1; i < w.length; i++) expect(daysBetween(w[i - 1]!.to, w[i]!.from)).toBe(1);
    expect(w.at(-1)!.to).toBe('2026-11-17');
    expect(w).toHaveLength(10);
  });
  it('single day and empty ranges', () => {
    expect(splitDateWindows('2026-03-01', '2026-03-01')).toEqual([{ from: '2026-03-01', to: '2026-03-01' }]);
    expect(splitDateWindows('2026-03-02', '2026-03-01')).toEqual([]);
  });
  it('crosses a leap day correctly', () => {
    const w = splitDateWindows('2028-02-01', '2028-03-31');
    expect(w[0]).toEqual({ from: '2028-02-01', to: '2028-03-06' });
  });
  it('time windows are < 35 days and contiguous to the millisecond', () => {
    const w = splitTimeWindows('2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    expect(w.length).toBe(3);
    for (const x of w) expect(Date.parse(x.to) - Date.parse(x.from)).toBeLessThan(35 * 86_400_000);
    for (let i = 1; i < w.length; i++) expect(Date.parse(w[i]!.from) - Date.parse(w[i - 1]!.to)).toBe(1);
    expect(w.at(-1)!.to).toBe('2026-04-01T00:00:00.000Z');
  });
  it('Budapest business date', () => {
    expect(budapestDate(new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18');
    expect(budapestDate(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(budapestDate(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });
});

describe('tax numbers', () => {
  it('check digit (fixture and NAV sample numbers)', () => {
    expect(isValidTaxNumber('68801234')).toBe(true);
    expect(isValidTaxNumber('68904564')).toBe(true);
    expect(isValidTaxNumber('68707893')).toBe(true);
    expect(isValidTaxNumber('99204059')).toBe(true);
    expect(isValidTaxNumber('68801235')).toBe(false);
    expect(isValidTaxNumber('6880123')).toBe(false);
  });
  it('normalizes a full adószám', () => {
    expect(normalizeTaxNumber('68801234-1-41')).toBe('68801234');
    expect(normalizeTaxNumber(' 68801234141 ')).toBe('68801234');
    expect(() => normalizeTaxNumber('68801235-1-41')).toThrow(NavError);
  });
});
