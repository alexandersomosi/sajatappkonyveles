// k8 ALAP-B – bank transfer with a monthly díjbekérő (GET /client/billing, POST /client/billing/transfer) and the
// callback offer before the payment (POST /client/guided {action:'callback_offer_skip'}). The money state is always the
// server's: after a choice every payment-related cache is refreshed.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientBillingView, TransferChooseInput } from '../_shared/k8';
import type { GuidedView } from '../_shared/k29g';
import { get, post } from './http';
import { K } from './hooks';
import { K29 } from './hooks-k29';
import { KG } from './hooks-k29g';

export const K8 = {
  szamlazas: ['k8', 'szamlazas'] as const,
};

/** Card or transfer, the open díjbekérők with the transfer details, the switches. */
export const useSzamlazas = (enabled = true) => useQuery({ queryKey: K8.szamlazas, queryFn: () => get<ClientBillingView>('/client/billing'), enabled, staleTime: 0, retry: 1 });

/** "Átutalással fizetek" (purpose 'subscribe') / "Átváltok átutalásra" (purpose 'switch'). */
export function useAtutalasValasztas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TransferChooseInput) => post<ClientBillingView>('/client/billing/transfer', b),
    onSuccess: (v) => {
      qc.setQueryData(K8.szamlazas, v);
      void qc.invalidateQueries({ queryKey: K.elofizetes });
      void qc.invalidateQueries({ queryKey: K.onboarding });
      void qc.invalidateQueries({ queryKey: K29.szamlak });
      void qc.invalidateQueries({ queryKey: KG.guided });
    },
  });
}

/** "Nem kell, mehetünk tovább" on the callback offer. */
export function useAjanlatKihagyas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<GuidedView>('/client/guided', { action: 'callback_offer_skip' }),
    onSuccess: (v) => qc.setQueryData(KG.guided, v),
  });
}
