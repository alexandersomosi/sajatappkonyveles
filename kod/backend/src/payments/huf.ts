// SPEC §29.1.1 / §29.2.2 – forint arithmetic. Stripe treats HUF as a TWO-decimal currency for charges (§29.20 [STR-CUR]):
// 19 999 Ft = 1999900. The fee invoice line is built from the gross price at 27 % ÁFA.

/** Whole forints → Stripe minor units. Refuses fractions, zero and negatives (a 0 Ft month never reaches Stripe). */
export function hufToStripe(n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('hufToStripe: pozitív egész forint kell.');
  return n * 100;
}

/** Stripe minor units → whole forints (a HUF charge is always a whole forint for us). */
export function stripeToHuf(a: number): number {
  if (!Number.isInteger(a) || a < 0 || a % 100 !== 0) throw new RangeError('stripeToHuf: egész forintnak megfelelő összeg kell.');
  return a / 100;
}

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * SPEC §29.2.2: one invoice line from a GROSS price at 27 % ÁFA: netto = round2(gross / 1.27), afa = round2(gross − netto).
 * `whole: true` is the fallback when the Számla Agent refuses the cents (netto = round(gross/1.27), afa = gross − netto).
 */
export function grossToLine(gross: number, o: { vatPct?: number; whole?: boolean } = {}): { netto: number; afa: number; brutto: number } {
  if (!Number.isInteger(gross)) throw new RangeError('grossToLine: egész forint kell.');
  const rate = 1 + (o.vatPct ?? 27) / 100;
  const netto = o.whole ? Math.round(gross / rate) : round2(gross / rate);
  const afa = round2(gross - netto);
  return { netto, afa, brutto: gross };
}

/** "19 999" (narrow no-break space like the rest of the app's amounts). */
export function fmtHuf(n: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(n);
}
