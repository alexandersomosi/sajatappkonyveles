import type { NavCredentials, NavSoftware } from '../src/types.js';

export const SOFTWARE: NavSoftware = {
  softwareId: 'HU00000000KEZJEGY1',
  softwareName: 'Kézjegy',
  softwareMainVersion: '1.0',
  softwareDevName: 'Somosi Kft.',
  softwareDevContact: 'demo@demo.kezjegy.test',
  softwareDevCountryCode: 'HU',
};

/** Fictional demo technical user of the demo client "Szabó Kata" (tax number from fixtures.json). */
export const KATA: NavCredentials = {
  login: 'demo68801234',
  password: 'demo-jelszo-68801234',
  signatureKey: 'demo-alairokulcs-68801234',
  exchangeKey: 'demo-cserekulcs-68801234',
  taxNumber: '68801234',
};

export const FIXED_NOW = new Date('2026-11-17T09:00:00.000Z');

export function seqIds(prefix = 'KJTEST'): () => string {
  let n = 0;
  return () => `${prefix}${String(++n).padStart(6, '0')}`;
}

export const noSleep = async (): Promise<void> => {};
