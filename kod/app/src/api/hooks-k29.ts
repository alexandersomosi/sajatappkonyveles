// SPEC §29.1 (B1 backend, B3 screens) – card consent, hosted payment result, the due month ("Fizesd ki"), the payment
// list. The money state is ALWAYS read back from the server (never from a return URL).
import { useQuery } from '@tanstack/react-query';
import type { CardConsentView, CheckoutResultView, ClientPaymentItem, DuePaymentView, SubscriptionViewK29 } from '../_shared/k29';
import { get } from './http';
import { K } from './hooks';

export const K29 = {
  hozzajarulas: ['k29', 'hozzajarulas'] as const,
  eredmeny: (cs: string) => ['k29', 'eredmeny', cs] as const,
  esedekes: ['k29', 'esedekes'] as const,
  fizetesek: ['k29', 'fizetesek'] as const,
};

/** GET /client/subscription with the §29 fields (provider, cardInfo, monthlyHuf, due, consentNeeded). Same cache key. */
export const useElofizetesK29 = (enabled = true) => useQuery({ queryKey: K.elofizetes, queryFn: () => get<SubscriptionViewK29>('/client/subscription'), enabled });

/** The card consent filled with the client's own numbers – fetched fresh every time the card step opens. */
export const useKartyaEngedely = (enabled = true) =>
  useQuery({ queryKey: K29.hozzajarulas, queryFn: () => get<CardConsentView>('/client/subscription/consent'), enabled, staleTime: 0, refetchOnMount: 'always', retry: 1 });

/** The result screen polls this (≤ PAYMENT_RULES.resultPollSeconds) until the row is final. */
export const useFizetesEredmeny = (cs: string | null, poll: boolean) =>
  useQuery({ queryKey: K29.eredmeny(cs ?? ''), queryFn: () => get<CheckoutResultView>(`/client/payments/checkout/${encodeURIComponent(cs ?? '')}`), enabled: !!cs, refetchInterval: poll ? 2500 : false, staleTime: 0, retry: 1 });

export const useEsedekes = (enabled = true) => useQuery({ queryKey: K29.esedekes, queryFn: () => get<DuePaymentView | null>('/client/payments/due'), enabled, staleTime: 15_000, retry: 0 });

export const useFizetesek = (enabled = true) => useQuery({ queryKey: K29.fizetesek, queryFn: () => get<ClientPaymentItem[] | { items: ClientPaymentItem[] }>('/client/payments'), enabled, retry: 0 });
