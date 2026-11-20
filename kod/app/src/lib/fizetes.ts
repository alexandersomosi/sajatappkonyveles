// SPEC §29.1.13 – card saving, "Fizesd ki" and one-off fees with Stripe (or the DEMO pay page). The hosted page opens in
// the browser: natively as an auth session (expo-web-browser `openAuthSessionAsync`, the back URL is
// kezjegy://elofizetes/eredmeny?cs=…&cel=…), on the web with a full redirect (the back URL returns to the same host).
// The money state is NEVER decided here: the result screen asks the server (GET /client/payments/checkout/:cs).
// `lib/simplepay.ts` stays for PAYMENT_PROVIDER=simplepay.
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import type { CardConsentView, DuePayInput, FeePayInputK29, FeePayResultK29, HostedCel, HostedStartResult, SubscriptionStartInputK29 } from '../_shared/k29';
import { post } from '../api/http';
import { SEMA } from '../config';

const platform = (): 'app' | 'web' => (Platform.OS === 'web' ? 'web' : 'app');

/** /config gains paymentProvider (§29.14): stripe | demo | simplepay | disabled. An older server = SimplePay. */
export function fizetesSzolgaltato(cfg: unknown): string {
  const c = cfg as { paymentProvider?: string } | undefined;
  return c?.paymentProvider ?? (c ? 'simplepay' : 'demo');
}
/** The web origin the client started on (adozz.hu or sslip): the back URL returns there (the refresh cookie is host-bound). */
export function visszaOrigin(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return window.location.origin;
}

/** Opens the hosted page and, natively, routes the return to the result screen. */
export async function hostedNyit(url: string, cel: HostedCel, paymentId?: string): Promise<void> {
  // MINTA (no server): the made-up page is the result screen itself
  if (url.startsWith('minta:') || url.startsWith('/')) {
    const cs = url.startsWith('minta:') ? url.slice(6) : `MINTA-${paymentId ?? '1'}`;
    router.push({ pathname: '/elofizetes/eredmeny', params: { cs, cel } });
    return;
  }
  if (!/^https:\/\//.test(url)) throw new Error('Érvénytelen fizetési cím érkezett. Próbáld újra később.');
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return;
  }
  const e = await WebBrowser.openAuthSessionAsync(url, `${SEMA}://elofizetes`);
  if (e.type === 'success' && e.url) {
    const { queryParams } = Linking.parse(e.url);
    const q = (k: string) => (queryParams?.[k] == null ? undefined : String(queryParams[k]));
    router.push({ pathname: '/elofizetes/eredmeny', params: { cs: q('cs') ?? '', cel: q('cel') ?? cel, ...(q('megszakitva') ? { megszakitva: '1' } : {}) } });
  } else {
    // the client closed the browser: nothing was confirmed on our side (the server decides; the session expires)
    router.push({ pathname: '/elofizetes/eredmeny', params: { cel, megszakitva: '1' } });
  }
}

/** First month + card (subscribe / restart) or card change (card_update) – after the consent was shown and accepted. */
export async function kartyaMentes(purpose: SubscriptionStartInputK29['purpose'], consent: Pick<CardConsentView, 'version' | 'sha256'>): Promise<HostedStartResult> {
  const r = await post<HostedStartResult>('/client/subscription/start', {
    platform: platform(),
    purpose,
    consentVersion: consent.version,
    consentSha256: consent.sha256,
    ...(visszaOrigin() ? { returnOrigin: visszaOrigin() } : {}),
  } satisfies SubscriptionStartInputK29);
  await hostedNyit(r.url, r.cel ?? 'elofizetes', r.paymentId);
  return r;
}

/** "Fizesd ki": the due month on a hosted page (the bank may ask for its check there). */
export async function fizesdKi(consent?: Pick<CardConsentView, 'version' | 'sha256'> | null): Promise<HostedStartResult> {
  const r = await post<HostedStartResult>('/client/payments/due/pay', {
    platform: platform(),
    ...(visszaOrigin() ? { returnOrigin: visszaOrigin() } : {}),
    ...(consent ? { consentVersion: consent.version, consentSha256: consent.sha256 } : {}),
  } satisfies DuePayInput);
  await hostedNyit(r.url, r.cel ?? 'fizesd-ki', r.paymentId);
  return r;
}

/**
 * A one-off fee: with the saved card after the client's tap (`useSavedCard`), or on a hosted page ("Másik kártyával").
 * 'sikeres' / 'sikertelen' come back to the screen; 'atiranyitas' opens the bank's check or the Stripe page.
 */
export async function dijFizetesK29(id: string, useSavedCard: boolean): Promise<FeePayResultK29> {
  const r = await post<FeePayResultK29>(`/client/fees/${encodeURIComponent(id)}/pay`, { platform: platform(), useSavedCard, ...(visszaOrigin() ? { returnOrigin: visszaOrigin() } : {}) } satisfies FeePayInputK29);
  if (r.result === 'atiranyitas') await hostedNyit(r.url, 'dij', r.paymentId);
  return r;
}
