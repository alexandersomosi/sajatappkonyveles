// SPEC §29.1.14 – the owner's payment views (B3): subscriptions, every payment (Stripe / DEMO), fee invoices
// (Számlázz.hu), the payment block of Rendszer. Own file so the parallel k7 builders never edit the same one.
// Money actions go through the owner console of §29.9 (step-up + reason + audit): refund, invoice retry.
import { api, ApiError } from './client';
import type { AdminFeeInvoiceRow, AdminPaymentRow, AdminPaymentsSystemView, AdminSubscriptionRowK29 } from '../_shared/k29';

const q = (o: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(o).filter((x): x is [string, string] => !!x[1])).toString();
  return s ? `?${s}` : '';
};
/** The backend answers `{ items }` or a bare list – both are accepted. */
const lista = <T>(r: T[] | { items: T[] } | null | undefined): T[] => (Array.isArray(r) ? r : (r?.items ?? []));

export const k29Elofizetesek = async (o: { status?: string; problem?: string }) => lista(await api.get<AdminSubscriptionRowK29[] | { items: AdminSubscriptionRowK29[] }>(`/admin/k29/subscriptions${q(o)}`));
export const k29Fizetesek = async (o: { status?: string; kind?: string; provider?: string; clientId?: string; from?: string; to?: string }) => lista(await api.get<AdminPaymentRow[] | { items: AdminPaymentRow[] }>(`/admin/k29/payments${q(o)}`));
export const k29Dijszamlak = async (o: { status?: string }) => lista(await api.get<AdminFeeInvoiceRow[] | { items: AdminFeeInvoiceRow[] }>(`/admin/k29/fee-invoices${q(o)}`));
export const k29Rendszer = () => api.get<AdminPaymentsSystemView>('/admin/k29/system');

// ---------- owner console actions (§29.9.1: TOTP step-up for every write, reason where required) ----------
export const konzolMegerosites = (code: string) => api.post<{ verifiedAt?: string }>('/admin/console/step-up', { code });
export const konzolVisszaterites = (paymentId: string, b: { amountHuf: number; reason: string }) => api.post<{ refundedHuf: number; invoiceAction: string }>(`/admin/console/payments/${encodeURIComponent(paymentId)}/refund`, b);
/** "Újrapróbálom" (B1, /admin/k29/fee-invoices/:id/retry – queries Számlázz.hu first; no money moves, no step-up). */
export const szamlaUjra = (invoiceId: string) => api.post<{ result: unknown }>(`/admin/k29/fee-invoices/${encodeURIComponent(invoiceId)}/retry`, {});

/** 403 step_up_required → the code dialog, then the same action again. */
export const kellMegerosites = (e: unknown) => e instanceof ApiError && e.status === 403 && e.code === 'step_up_required';
/** The console needs the admin's own 2FA first (403 mfa_setup_required). */
export const kellKetlepcsos = (e: unknown) => e instanceof ApiError && e.status === 403 && (e.code === 'mfa_setup_required' || e.code === 'totp_setup_required');
/** A server without §29 (older build): the old SimplePay views are shown. */
export const nincsK29 = (e: unknown) => e instanceof ApiError && e.status === 404;

/** Stripe failure / decline codes in plain words (staff wording); unknown codes are shown as they are. */
const STRIPE_HIBA: Record<string, string> = {
  authentication_required: 'A bankja megerősítést kér (az ügyfél „Fizesd ki”-vel rendezi)',
  card_declined: 'A bank elutasította',
  generic_decline: 'A bank elutasította',
  insufficient_funds: 'Nincs elég fedezet',
  expired_card: 'Lejárt a kártya',
  incorrect_cvc: 'Hibás biztonsági kód',
  lost_card: 'Elveszettként jelentett kártya',
  stolen_card: 'Lopottként jelentett kártya',
  do_not_honor: 'A bank elutasította (ok nélkül)',
  processing_error: 'Feldolgozási hiba – újrapróbáljuk',
  card_velocity_exceeded: 'Kártyalimit túllépve',
};
export function stripeHiba(code: string | null | undefined): string | null {
  if (!code) return null;
  return STRIPE_HIBA[code] ?? null;
}

/** "Stripe teszt" | "Stripe éles" | "DEMO" | "SimplePay" (when the row has no label). */
export function szolgaltatoCimke(provider: string, mode: string): string {
  if (provider === 'stripe') return mode === 'live' ? 'Stripe éles' : 'Stripe teszt';
  if (provider === 'simplepay') return mode === 'live' ? 'SimplePay éles' : 'SimplePay';
  return 'DEMO';
}
