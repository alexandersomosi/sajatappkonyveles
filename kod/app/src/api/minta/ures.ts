// Éles build: a MINTA-szerver helyett ez kerül be (metro.config.js). Ha mégis meghívnák, nem színlel sikert.
import type { Szallito } from '../http';

export const mintaSzallito: Szallito = async () => {
  throw new Error('A minta mód ebben a buildben nincs benne.');
};
export const mintaMa = () => null;
