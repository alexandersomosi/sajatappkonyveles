// A „ma” a szerver szerint (ClientHome.today), hogy a viszonylagos idők („tegnap”, „hétfőn”) a szerverrel egyezzenek.
import { maiNap } from '../lib/format';

let szerverMa: string | null = null;
export function maBeallit(nap: string | null | undefined) {
  if (nap && /^\d{4}-\d{2}-\d{2}$/.test(nap)) szerverMa = nap;
}
export function ma(): string {
  return szerverMa ?? maiNap();
}
