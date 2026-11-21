// A fülsor (telefon) és a bal menü (gép) közös állapota: bekötés alatt a Főoldal-fülön a teendők száma, az Üzeneteken az
// olvasatlanok, és a Fotózás csak a könyvelő nyitott dokumentum-kérésére tölt fel (SPEC §26.5.1–2). Korábban a
// keret.tsx-ben volt; most mindkét navigáció innen olvas (K8_VEGREHAJTAS 3. fejezet).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Me, Message, OnboardingState, RequestSummary } from '../_shared/api';
import { get } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { maiNap } from '../lib/format';
import { utEpit } from '../lib/ut';
import { useZarolt } from './Zarolt';

/** A könyvelő nyitott dokumentum-kérése: bekötés alatt csak erre lehet feltölteni (SPEC §26.5.2 'feltoltes'). */
export function nyitottDokumentumKeres(items: RequestSummary[] | undefined): RequestSummary | undefined {
  return items?.find((r) => r.direction === 'konyvelotol' && r.type === 'dokumentum' && (r.status === 'nyitott' || r.status === 'folyamatban'));
}

export function useFulAllapot() {
  // 'me' is FETCHED here (not only read from the cache): a screen opened cold (web reload, push tap, share intent)
  // that does not call useMe itself must still know whether the client is restricted (review k3c2).
  const bent = useAuth().allapot === 'bent';
  const me = useQuery<Me>({ queryKey: ['me'], queryFn: () => get<Me>('/me'), enabled: bent, staleTime: 60_000 });
  const korlatozott = me.data?.client?.lifecycle === 'bekotes_alatt';
  // Bekötés alatt a fülsor maga is lekéri (percenként legfeljebb egyszer) a bekötést és a kéréseket, hogy a Főoldal
  // jelvénye és a Fotózás gomb felirata minden képernyőn igaz legyen, ne csak ott, ahol épp a tárban van.
  const onb = useQuery<OnboardingState>({ queryKey: ['onboarding'], queryFn: () => get<OnboardingState>('/client/onboarding'), enabled: korlatozott, staleTime: 60_000 });
  const ker = useQuery<{ items: RequestSummary[] }>({ queryKey: ['keresek'], queryFn: () => get<{ items: RequestSummary[] }>('/client/requests'), enabled: korlatozott, staleTime: 60_000 });
  // Az üzeneteket csak a tárból olvassuk (nem kérdezünk): ha a képernyő már betöltötte, látszik a pötty.
  const uz = useQuery<{ items: Message[] }>({ queryKey: ['uzenetek'], queryFn: () => get<{ items: Message[] }>('/client/messages?limit=50'), enabled: false });
  // SPEC §27.4.2 (k3_kor2 tulaj 11): a jelvény = a sáv „Még N dolog” = a zárt lap „a tiéd” = journey.todoCount.
  const keresekDb = (ker.data?.items ?? []).filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')).length;
  const fooldal = korlatozott && onb.data ? (onb.data.journey?.todoCount ?? utEpit({ o: onb.data, keresekDb, ma: maiNap() }).todoCount) : 0;
  const uzenetek = (uz.data?.items ?? []).filter((m) => m.sender !== 'en' && m.sender !== 'rendszer' && !m.readByClientAt).length;
  return { korlatozott, fooldal, uzenetek, nyitottKeres: korlatozott ? nyitottDokumentumKeres(ker.data?.items) : undefined, accountant: me.data?.accountant ?? null };
}

/** A Fotózás fül/menüpont felolvasói címkéje. */
export function fotoCimke(a: { korlatozott: boolean; nyitottKeres?: RequestSummary }): string {
  return !a.korlatozott
    ? 'Fotózás: irat lefotózása'
    : a.nyitottKeres
      ? `Fotózás: ${a.nyitottKeres.title} feltöltése, a könyvelőd kérte`
      : 'Fotózás: a bekötés után nyílik meg. Addig csak a könyvelőd kérésére tölthetsz fel.';
}

/** A Fotózás fül/menüpont: bekötés alatt csak a könyvelő nyitott dokumentum-kérésére tölt fel, különben a zárolt lap. */
export function useFotozasNyit() {
  const qc = useQueryClient();
  const zarolt = useZarolt();
  return async (korlatozott: boolean) => {
    if (!korlatozott) return router.push('/fotozas');
    try {
      const k = await qc.fetchQuery({ queryKey: ['keresek'], queryFn: () => get<{ items: RequestSummary[] }>('/client/requests'), staleTime: 30_000 });
      const nyitott = nyitottDokumentumKeres(k.items);
      if (nyitott) return router.push({ pathname: '/feltoltes', params: { keres: nyitott.id, kategoria: /kivonat/i.test(nyitott.title) ? 'bankszamlakivonat' : 'egyeb' } });
    } catch {
      /* ha nem érjük el, a zárolt lapot mutatjuk */
    }
    zarolt({ feature: 'feltoltes' });
  };
}
