// Real NAV Online Számla client (test/prod). Wired to @kezjegy/nav-kliens at integration time;
// until then it returns null and NAV test/prod modes answer "not configured".
import type { NavClient, NavCredentials, NavEnvironment, NavSoftware } from '../adapters/nav-kliens.js';

export function realNavClient(_env: Exclude<NavEnvironment, 'demo'>, _creds: NavCredentials, _software: NavSoftware, _now: () => Date): NavClient | null {
  return null;
}
