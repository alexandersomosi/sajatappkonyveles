// Exact integer money arithmetic. Forint amounts are integers; rates are permille/percent
// integers, so every product is an exact integer well below 2^53 and only the final division
// rounds – no floating-point rates anywhere.

/** a / b rounded half away from zero ("kerekítés forintra": 0.5 → 1). b must be a positive integer. */
export function roundDiv(a: number, b: number): number {
  if (!Number.isInteger(b) || b <= 0) throw new RangeError(`roundDiv: bad divisor ${b}`);
  if (!Number.isFinite(a)) throw new RangeError(`roundDiv: bad dividend ${a}`);
  if (a >= 0) return Math.floor((2 * a + b) / (2 * b));
  return -Math.floor((-2 * a + b) / (2 * b));
}

/** amount × permille / 1000, rounded half away from zero. */
export function permilleOf(amount: number, permille: number): number {
  return roundDiv(amount * permille, 1000);
}

/** amount × pct / 100, rounded half away from zero (pct is an integer). */
export function percentOf(amount: number, pct: number): number {
  return roundDiv(amount * pct, 100);
}

/** Non-negative rational n / d (d > 0) – used for the per-month cumulative base, which is rarely whole. */
export interface Ratio {
  n: number;
  d: number;
}

export function ratio(n: number, d = 1): Ratio {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0) throw new RangeError(`ratio: ${n}/${d}`);
  return { n, d };
}

export function ratioCompare(x: Ratio, y: Ratio): number {
  const l = x.n * y.d;
  const r = y.n * x.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

export function ratioMax(x: Ratio, y: Ratio): Ratio {
  return ratioCompare(x, y) >= 0 ? x : y;
}

export function ratioMin(x: Ratio, y: Ratio): Ratio {
  return ratioCompare(x, y) <= 0 ? x : y;
}

export function ratioRound(x: Ratio): number {
  return roundDiv(x.n, x.d);
}

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}
