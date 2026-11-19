// NAV client types and errors come from the real package @kezjegy/nav-kliens (SPEC §8.5).
// The in-repo fallback (src/adapters/nav-kliens.ts) stays as the SPEC §3.2 thin adapter.
export {
  NavError,
  isNavError,
  demoCredentialsFor,
  createNavClient,
  createDemoTransport,
  type NavClient,
  type NavCredentials,
  type NavEnvironment,
  type NavSoftware,
  type NormalizedInvoice,
  type InvoiceDigest,
} from '@kezjegy/nav-kliens';
