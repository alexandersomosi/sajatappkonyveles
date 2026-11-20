// SPEC §29.10 G – the guided first run: GET/POST /client/guided (own file, so the parallel k7 builders never edit the
// same hooks file). The money hooks of §29.1 live in hooks-k29.ts.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BusinessIdentityInput, ClientProfile, OnboardingState, TaxpayerLookupResult } from '../_shared/api';
import type { GuidedActionInput, GuidedView } from '../_shared/k29g';
import { get, post } from './http';
import { K } from './hooks';

export const KG = { guided: ['guided'] as const };

/** Always fresh when a guided screen opens: a step was just saved somewhere else. */
export const useGuided = (enabled = true) =>
  useQuery({ queryKey: KG.guided, queryFn: () => get<GuidedView>('/client/guided'), enabled, staleTime: 0, refetchOnMount: 'always', retry: 1 });

export function useGuidedAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: GuidedActionInput) => post<GuidedView>('/client/guided', v),
    onSuccess: (v) => {
      if (v && Array.isArray(v.steps)) qc.setQueryData(KG.guided, v);
      else void qc.invalidateQueries({ queryKey: KG.guided });
    },
  });
}

/** §28.K.9 / §29.4.4 (B1 backend): the adószám lookup – never cached on the phone. */
export const useAdoszamKereses = () => useMutation({ mutationFn: (torzsszam: string) => post<TaxpayerLookupResult & { cached?: boolean }>('/client/onboarding/taxpayer-lookup', { torzsszam }) });

export function useVallalkozasAdatok() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: BusinessIdentityInput) => post<ClientProfile | OnboardingState | null>('/client/onboarding/business-identity', v),
    onSuccess: () => {
      for (const k of [K.profil, K.onboarding, KG.guided]) void qc.invalidateQueries({ queryKey: k });
    },
  });
}
