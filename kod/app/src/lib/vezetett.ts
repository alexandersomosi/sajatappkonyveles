// SPEC §29.10 G – the guided first run ("bevezető"). The existing step screens open with `?vezetett=<lépés>`; while such
// a screen is on top, these helpers send the client on to the NEXT step (`/bevezeto` asks the server) instead of the
// checklist, and "Vissza" opens the previous guided step. Without the param everything behaves as before.
import { router } from 'expo-router';

// k7c: a stack, not one slot – a guided screen can push another guided screen on top of itself (the meghatalmazás step →
// "Intézzük helyetted" with the same `vezetett`); when the top one closes, the one below must be guided again.
const verem: { kulcs: string; jel: number }[] = [];
let szamlalo = 0;

/** Kepernyo calls it when its route carries `vezetett`; returns the release function (it removes only its own entry). */
export function vezetettJelol(kulcs: string): () => void {
  const jel = ++szamlalo;
  verem.push({ kulcs, jel });
  return () => {
    const i = verem.findIndex((x) => x.jel === jel);
    if (i >= 0) verem.splice(i, 1);
  };
}

const aktivKulcs = (): string | null => verem[verem.length - 1]?.kulcs ?? null;

/** The guided step on top (null outside the guided run). */
export const vezetettKulcs = (): string | null => aktivKulcs();

/** After a successful save: in the guided run straight to the next step, otherwise the checklist (or `alap`). */
export function bekotesre(alap = '/bekotes'): void {
  const k = aktivKulcs();
  if (k) {
    router.replace({ pathname: '/bevezeto', params: { utan: k } });
    return;
  }
  router.replace(alap as never);
}

/** "Vissza" that leaves the step screen: the previous guided step (on the first one: "Később folytatom"). */
export function vezetettVissza(): boolean {
  const k = aktivKulcs();
  if (!k) return false;
  router.replace({ pathname: '/bevezeto', params: { vissza: k } });
  return true;
}

export { vezetettHref } from './bevezeto';
