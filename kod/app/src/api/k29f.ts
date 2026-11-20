// SPEC §29 F1, F2, F4 (B2): az igazolások, a bevételi kimutatás és a naptár-feliratkozás adatrétege.
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { CalendarFeedView, CertificateFormView, CertificateRequestInput, CertificateView, IncomeStatementMeta } from '../_shared/k29f';
import { del, get, post } from './http';

export const K29F = {
  igazolasok: ['igazolasok'] as const,
  igazolasUrlap: ['igazolasUrlap'] as const,
  igazolas: (id: string) => ['igazolas', id] as const,
  kimutatas: (from: string, to: string) => ['kimutatas', from, to] as const,
  naptar: ['naptar'] as const,
};

function useValtoz<V, R>(fn: (v: V) => Promise<R>, ervenytelen: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of ervenytelen) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

export const useIgazolasok = () => useQuery({ queryKey: K29F.igazolasok, queryFn: () => get<{ items: CertificateView[] }>('/client/certificates') });
export const useIgazolasUrlap = () => useQuery({ queryKey: K29F.igazolasUrlap, queryFn: () => get<CertificateFormView>('/client/certificates/form') });
export const useIgazolas = (id: string) => useQuery({ queryKey: K29F.igazolas(id), queryFn: () => get<CertificateView>(`/client/certificates/${encodeURIComponent(id)}`), enabled: Boolean(id) });
export const useIgazolasKuld = () => useValtoz((v: CertificateRequestInput) => post<CertificateView>('/client/certificates', v), [K29F.igazolasok, ['keresek'], ['home']]);
export const useIgazolasVisszavon = () => useValtoz((id: string) => post<CertificateView>(`/client/certificates/${encodeURIComponent(id)}/cancel`, {}), [K29F.igazolasok, ['keresek']]);

export const useKimutatas = (from: string, to: string) =>
  useQuery({ queryKey: K29F.kimutatas(from, to), queryFn: () => get<IncomeStatementMeta>(`/client/income-statement/meta?from=${from}&to=${to}`), enabled: Boolean(from && to) });
export const kimutatasUt = (from: string, to: string) => `/client/income-statement?from=${from}&to=${to}`;
export const useKimutatasEllenoriz = () => useValtoz((v: { from: string; to: string }) => post<IncomeStatementMeta>('/client/income-statement/review', v), [['kimutatas']]);
export const useKimutatasMent = () => useValtoz((v: { from: string; to: string }) => post<{ documentId: string }>('/client/income-statement/save', v), [['dossziek'], ['dosszie']]);

export const useNaptar = () => useQuery({ queryKey: K29F.naptar, queryFn: () => get<CalendarFeedView>('/client/calendar') });
export const useNaptarBe = () => useValtoz(() => post<CalendarFeedView>('/client/calendar', {}), [K29F.naptar]);
export const useNaptarKi = () => useValtoz(() => del<CalendarFeedView>('/client/calendar'), [K29F.naptar]);
export const naptarLinkek = (id: string) => get<{ google: string; outlook: string; ics: string }>(`/client/deadlines/${encodeURIComponent(id)}/calendar-links`);
