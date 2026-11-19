// Picks the NAV Online Számla client (SPEC §8, §11.6) – the real read-only XML client from
// @kezjegy/nav-kliens for every environment:
//  - demo: its in-process mock transport (fictional fixtures, same XML contract, never touches NAV);
//  - test / prod: HTTPS to api-test / api.onlineszamla.nav.gov.hu.
import brand from '../_shared/brand.json' with { type: 'json' };
import type { Config } from '../config.js';
import { createDemoTransport, createNavClient, NavError, type NavClient, type NavCredentials, type NavEnvironment, type NavSoftware } from './types.js';

export function navSoftware(cfg: Config): NavSoftware {
  return {
    softwareId: cfg.nav.softwareId,
    softwareName: brand.name,
    softwareMainVersion: cfg.nav.softwareVersion,
    softwareDevName: cfg.nav.devName,
    softwareDevContact: cfg.nav.devContact,
    softwareDevCountryCode: 'HU',
    softwareDevTaxNumber: cfg.nav.devTaxNumber || undefined,
  };
}

export type NavClientFactory = (env: NavEnvironment, creds: NavCredentials) => NavClient;

export function createNavFactory(cfg: Config, now: () => Date): NavClientFactory {
  return (env, creds) => {
    if (env === 'demo') {
      if (cfg.appEnv !== 'demo') throw new NavError({ code: 'NOT_CONFIGURED', kind: 'config', messageHu: 'A NAV-kapcsolat még nincs bekapcsolva.' });
      return createNavClient({ environment: 'demo', credentials: creds, software: navSoftware(cfg), transport: createDemoTransport(undefined, { now }), minIntervalMs: 0, now });
    }
    if (cfg.nav.mode !== env) throw new NavError({ code: 'NOT_CONFIGURED', kind: 'config', messageHu: `A szerver most ${cfg.nav.mode} NAV-módban fut, ez a kapcsolat ${env} módú.` });
    if (env === 'prod' && cfg.nav.softwareId === 'HU00000000KEZJEGY1') throw new NavError({ code: 'NOT_CONFIGURED', kind: 'config', messageHu: 'Éles NAV-hoz a Somosi Kft. szoftverazonosítója kell (NAV_SOFTWARE_ID).' });
    return createNavClient({ environment: env, credentials: creds, software: navSoftware(cfg), now });
  };
}
