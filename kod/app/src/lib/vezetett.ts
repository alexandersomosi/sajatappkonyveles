// SPEC §29.10 G – the guided first run ("bevezető"). The existing step screens open with `?vezetett=<lépés>`; while such
// a screen is on top, these helpers send the client on to the NEXT step (`/bevezeto` asks the server) instead of the
// checklist, and "Vissza" opens the previous guided step. Without the param everything behaves as before.
import { router } from 'expo-router';

let aktiv: { kulcs: string; jel: number } | null = null;
let szamlalo = 0;

/** Kepernyo calls it when its route carries `vezetett`; returns the release function (only the owner clears it). */
export function vezetettJelol(kulcs: string): () => void {
  const jel = ++szamlalo;
  aktiv = { kulcs, jel };
  return () => {
    if (aktiv?.jel === jel) aktiv = null;
  };
}

/** The guided step on top (null outside the guided run). */
export const vezetettKulcs = (): string | null => aktiv?.kulcs ?? null;

/** After a successful save: in the guided run straight to the next step, otherwise the checklist (or `alap`). */
export function bekotesre(alap = '/bekotes'): void {
  const k = aktiv?.kulcs;
  if (k) {
    router.replace({ pathname: '/bevezeto', params: { utan: k } });
    return;
  }
  router.replace(alap as never);
}

/** "Vissza" that leaves the step screen: the previous guided step (on the first one: "Később folytatom"). */
export function vezetettVissza(): boolean {
  const k = aktiv?.kulcs;
  if (!k) return false;
  router.replace({ pathname: '/bevezeto', params: { vissza: k } });
  return true;
}

export { vezetettHref } from './bevezeto';
