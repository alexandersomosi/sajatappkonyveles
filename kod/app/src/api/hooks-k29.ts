// SPEC §29.1 (B1 backend, B3 screens) – card consent, hosted payment result, the due month ("Fizesd ki"), the payment
// list, the fee invoices with storno. The money state is ALWAYS read back from the server (never from a return URL).
import { useQuery } from '@tanstack/react-query';
import type { FeeInvoiceItem } from '../_shared/api';
import type { CardConsentView, CheckoutResultView, ClientPaymentItem, DuePaymentView, FeeInvoiceItemK29, SubscriptionViewK29 } from '../_shared/k29';
import { ApiHiba, get } from './http';
import { K } from './hooks';

export const K29 = {
  hozzajarulas: (cel: string) => ['k29', 'hozzajarulas', cel] as const,
  eredmeny: (cs: string) => ['k29', 'eredmeny', cs] as const,
  esedekes: ['k29', 'esedekes'] as const,
  fizetesek: ['k29', 'fizetesek'] as const,
  szamlak: ['k29', 'szamlak'] as const,
};

/** GET /client/subscription with the §29 fields (provider, cardInfo, monthlyHuf, due, consentNeeded). Same cache key. */
export const useElofizetesK29 = (enabled = true) => useQuery({ queryKey: K.elofizetes, queryFn: () => get<SubscriptionViewK29>('/client/subscription'), enabled });

export type EngedelyCel = 'subscribe' | 'card_update' | 'restart' | 'fizesd_ki';
/** The card consent filled with the client's own numbers for this purpose – fetched fresh every time it is shown. */
export const useKartyaEngedely = (enabled = true, cel: EngedelyCel = 'subscribe') =>
  useQuery({ queryKey: K29.hozzajarulas(cel), queryFn: () => get<CardConsentView>(`/client/subscription/consent?purpose=${cel}`), enabled, staleTime: 0, refetchOnMount: 'always', retry: 1 });

/** The result screen polls this (≤ PAYMENT_RULES.resultPollSeconds) until the row is final. */
export const useFizetesEredmeny = (cs: string | null, poll: boolean, megszakitva = false) =>
  useQuery({
    queryKey: K29.eredmeny(cs ?? ''),
    queryFn: () => get<CheckoutResultView>(`/client/payments/checkout/${encodeURIComponent(cs ?? '')}${megszakitva ? '?megszakitva=1' : ''}`),
    enabled: !!cs,
    refetchInterval: poll ? 2500 : false,
    staleTime: 0,
    retry: 1,
  });

export const useEsedekes = (enabled = true) => useQuery({ queryKey: K29.esedekes, queryFn: () => get<DuePaymentView | null>('/client/payments/due'), enabled, staleTime: 15_000, retry: 0 });

export const useFizetesek = (enabled = true) => useQuery({ queryKey: K29.fizetesek, queryFn: () => get<ClientPaymentItem[] | { items: ClientPaymentItem[] }>('/client/payments'), enabled, retry: 0 });

/** Every fee invoice incl. storno / correction (B1: /client/fee-invoices/k29); an older server: the old list. */
export const useDijszamlakK29 = () =>
  useQuery({
    queryKey: K29.szamlak,
    queryFn: async () => {
      try {
        return (await get<{ items: FeeInvoiceItemK29[] }>('/client/fee-invoices/k29')).items;
      } catch (e) {
        if (e instanceof ApiHiba && e.status === 404) return (await get<{ items: FeeInvoiceItem[] }>('/client/fee-invoices')).items as FeeInvoiceItemK29[];
        throw e;
      }
    },
    retry: 0,
  });
