// Adatréteg: TanStack Query a SPEC §12.4 végpontjaira. A gyorsítótár miatt rossz hálózaton is látszik az utolsó állapot.
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  ClientHome, ClientProfile, ClientProfileInput, Deadline, DocumentDetail, DossierView, FeeInvoiceItem, Me,
  Message, NavInvoiceListItem, NotificationItem, OnboardingState, Page, PublicConfig, RequestSummary, SessionInfo,
  SubscriptionStartResult, SubscriptionView, TaxPeriodDetail, TaxPeriodSummary,
} from '../_shared/api';
import type {
  BusinessRegistrationAdoszamInput, BusinessRegistrationInput, BusinessRegistrationResponse, BusinessRegistrationView,
  BusinessRegistrationWithdrawInput, CallbackCreateInput, CallbackUpdateInput, CallbackView, ClientAccess, ClientCallbacks,
  ClientProfileStartInput, Explainer, Guide, GuideImageManifest,
  AssistConsentInput, AssistConsentSummary, AssistCreateInput, AssistCreateResult, AssistView, BusinessStatusInput,
  AllowanceAnswersInput, AllowanceClientPreview, AllowanceClientPreviewInput, AllowanceGateInput, AllowanceState, AnnualAnswersInput,
  AnnualApproveInput, AnnualView, AssistChangeUpdateInput, ChangeGuidesView, CheckinAnswerInput, CheckinView, EarningsView,
  EmployerAnswerInput, FeePayInput, FeePayStart, FeesView, NotificationSettingsPatch, ReserveCard, ReserveMarkInput, ReserveView,
} from '../_shared/api';
import type { BusinessStatus, GuideKind, LegalDocType, MeghatalmazasMethod, PaymentItemKind } from '../_shared/enums';
import { ApiHiba, del, feltolt, get, patch, post, put } from './http';
import { mediaUrl } from '../lib/media';

export const K = {
  config: ['config'] as const,
  me: ['me'] as const,
  home: ['home'] as const,
  onboarding: ['onboarding'] as const,
  profil: ['profil'] as const,
  kyc: ['kyc'] as const,
  idoszak: (id: string) => ['idoszak', id] as const,
  idoszakok: ['idoszakok'] as const,
  dossziek: ['dossziek'] as const,
  dosszie: (h: string) => ['dosszie', h] as const,
  irat: (id: string) => ['irat', id] as const,
  navSzamlak: (h: string) => ['navSzamlak', h] as const,
  navSzamla: (id: string) => ['navSzamla', id] as const,
  uzenetek: ['uzenetek'] as const,
  keresek: ['keresek'] as const,
  hataridok: ['hataridok'] as const,
  ertesitesek: ['ertesitesek'] as const,
  elofizetes: ['elofizetes'] as const,
  dijszamlak: ['dijszamlak'] as const,
  munkamenetek: ['munkamenetek'] as const,
  gyik: ['gyik'] as const,
  jogi: (t: string) => ['jogi', t] as const,
  exportok: ['exportok'] as const,
  // SPEC §26
  hozzaferes: ['hozzaferes'] as const,
  magyarazatok: ['magyarazatok'] as const,
  vallalkozas: ['vallalkozas'] as const,
  utmutato: (k: GuideKind) => ['utmutato', k] as const,
  utmutatoKepek: (k: GuideKind) => ['utmutatoKepek', k] as const,
  visszahivas: ['visszahivas'] as const,
  // SPEC §27
  segitseg: ['segitseg'] as const,
  engedely: (id: string) => ['engedely', id] as const,
};

export const useConfig = () => useQuery({ queryKey: K.config, queryFn: () => get<PublicConfig>('/config', { auth: false }), staleTime: 3600_000 });
export const useMe = () => useQuery({ queryKey: K.me, queryFn: () => get<Me>('/me') });
export const useHome = () => useQuery({ queryKey: K.home, queryFn: () => get<ClientHome>('/client/home') });
export const useOnboarding = () => useQuery({ queryKey: K.onboarding, queryFn: () => get<OnboardingState>('/client/onboarding') });
export const useProfil = () => useQuery({ queryKey: K.profil, queryFn: () => get<ClientProfile>('/client/profile') });
/** SPEC §31.6: the account's ad-measurement consent (enabled = false while the measurement is switched off: nothing to show). */
export interface HirdetesiHozzajarulas {
  enabled: boolean;
  given: boolean;
  meta: boolean;
  google: boolean;
  since: string | null;
}
export const useHirdetesiHozzajarulas = () => useQuery({ queryKey: ['hirdetesi-hozzajarulas'], queryFn: () => get<HirdetesiHozzajarulas>('/me/hirdetesi-hozzajarulas'), staleTime: 600_000, retry: false });
export const useKyc = () => useQuery({ queryKey: K.kyc, queryFn: () => get<{ status: string; reviewNote?: string }>('/client/kyc') });
export const useIdoszak = (id?: string) =>
  useQuery({ queryKey: K.idoszak(id ?? ''), queryFn: () => get<TaxPeriodDetail>(`/client/tax-periods/${encodeURIComponent(id ?? '')}`), enabled: !!id });
export const useIdoszakok = (ev: number) =>
  useQuery({ queryKey: [...K.idoszakok, ev], queryFn: () => get<{ items: TaxPeriodSummary[] }>(`/client/tax-periods?year=${ev}`) });
export const useDossziek = (ev: number) =>
  useQuery({
    queryKey: [...K.dossziek, ev],
    queryFn: () => get<{ months: { month: string; label: string; documentCount: number; waitingCount: number; navInvoiceCount: number }[] }>(`/client/dossiers?year=${ev}`),
  });
export const useDosszie = (honap?: string) =>
  useQuery({ queryKey: K.dosszie(honap ?? ''), queryFn: () => get<DossierView>(`/client/dossiers/${honap}`), enabled: !!honap });
export const useIrat = (id?: string) => useQuery({ queryKey: K.irat(id ?? ''), queryFn: () => get<DocumentDetail>(`/client/documents/${id}`), enabled: !!id });
export const useNavSzamlak = (honap: string) =>
  useQuery({ queryKey: K.navSzamlak(honap), queryFn: () => get<{ items: NavInvoiceListItem[] }>(`/client/nav-invoices?month=${honap}`) });
export interface NavSzamlaReszlet {
  id: string;
  demo: boolean;
  invoiceNumber: string;
  operation: string;
  issueDate: string;
  deliveryDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  currency: string;
  netAmountHuf: number;
  vatAmountHuf: number;
  grossAmountHuf: number;
  vatExemption?: { case: string; reason: string };
  customer: { name?: string; taxNumber?: string };
  lines: { lineNo: number; description?: string; quantity?: number; unit?: string; unitPriceHuf?: number; netAmountHuf: number }[];
  receivedOn?: string;
  receivedOnEstimated?: boolean;
  /** SPEC §28.1.4: a félreteendő (aktív ügyfélnél). */
  reserve?: import('../_shared/api').InvoiceReserveView;
}
export const useNavSzamla = (id?: string) =>
  useQuery({ queryKey: K.navSzamla(id ?? ''), queryFn: () => get<NavSzamlaReszlet>(`/client/nav-invoices/${id}`), enabled: !!id });
export const useUzenetek = () =>
  useQuery({ queryKey: K.uzenetek, queryFn: () => get<Page<Message>>('/client/messages?limit=50'), refetchInterval: 30_000 });
export const useKeresek = () => useQuery({ queryKey: K.keresek, queryFn: () => get<{ items: RequestSummary[] }>('/client/requests') });
export const useHataridok = () => useQuery({ queryKey: K.hataridok, queryFn: () => get<{ items: Deadline[] }>('/client/deadlines') });
export const useErtesitesek = () => useQuery({ queryKey: K.ertesitesek, queryFn: () => get<Page<NotificationItem>>('/me/notifications') });
export const useElofizetes = () => useQuery({ queryKey: K.elofizetes, queryFn: () => get<SubscriptionView>('/client/subscription') });
export const useDijszamlak = () => useQuery({ queryKey: K.dijszamlak, queryFn: () => get<{ items: FeeInvoiceItem[] }>('/client/fee-invoices') });
export const useMunkamenetek = () => useQuery({ queryKey: K.munkamenetek, queryFn: () => get<{ items: SessionInfo[] }>('/auth/sessions') });
export const useGyik = () =>
  useQuery({ queryKey: K.gyik, queryFn: () => get<{ items: { id: string; question: string; answer: string }[] }>('/content/faq', { auth: false }), staleTime: 3600_000 });
export const useJogi = (tipus: string) =>
  useQuery({
    queryKey: K.jogi(tipus),
    queryFn: () => get<{ docType: LegalDocType; version: string; title: string; markdown: string }>(`/legal/${tipus}`, { auth: false }),
    staleTime: 3600_000,
  });
export const useExportok = () =>
  useQuery({ queryKey: K.exportok, queryFn: () => get<{ items: { id: string; status: 'keszul' | 'kesz' | 'lejart' | 'hiba'; createdAt: string; expiresAt: string | null }[] }>('/me/exports') });

/** Mutáció, ami siker után a megadott kulcsokat újratölti. */
function useValtoztat<V, R>(fn: (v: V) => Promise<R>, ujratolt: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of ujratolt) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

export const useBefizettem = () =>
  useValtoztat((v: { id: string; paidOn: string; kinds?: PaymentItemKind[] }) => post<TaxPeriodDetail>(`/client/tax-periods/${v.id}/mark-paid`, { paidOn: v.paidOn, kinds: v.kinds }), [K.home, ['idoszak'], K.hataridok]);
export const useMegsemFizettem = () =>
  useValtoztat((v: { id: string }) => post<TaxPeriodDetail>(`/client/tax-periods/${v.id}/unmark-paid`, {}), [K.home, ['idoszak'], K.hataridok]);
export const useUzenetKuld = () =>
  useValtoztat((v: { body: string; fileIds?: string[]; documentId?: string }) => post<Message>('/client/messages', v), [K.uzenetek]);
export const useKeresKuld = () =>
  useValtoztat(
    (v: { type: string; body: string; title?: string; certificate?: { certificateType: string; year?: number; purpose: string; language?: 'hu' | 'en' } }) => post<RequestSummary>('/client/requests', v),
    [K.keresek, K.uzenetek, K.home],
  );
export const useKeresVisszavon = () => useValtoztat((id: string) => post<RequestSummary>(`/client/requests/${id}/cancel`, {}), [K.keresek, K.uzenetek]);
export const useKeresKesz = () =>
  useValtoztat((v: { id: string; documentIds?: string[]; note?: string }) => post<RequestSummary>(`/client/requests/${v.id}/complete`, { documentIds: v.documentIds, note: v.note }), [K.keresek, K.home, ['dosszie'], K.hataridok, K.uzenetek, K.dossziek]);
export const useIratTorol = () => useValtoztat((id: string) => del<void>(`/client/documents/${id}`), [['dosszie'], K.home, K.dossziek]);
export const useProfilMent = () => useValtoztat((v: ClientProfileInput) => put<ClientProfile>('/client/profile', v), [K.profil, K.onboarding]);
export const useMeghatalmazas = () =>
  useValtoztat((v: { method: MeghatalmazasMethod; fileId?: string; approved?: true }) => post<OnboardingState>('/client/onboarding/meghatalmazas', v), [K.onboarding]);
export const useHozzajarul = () =>
  useValtoztat((v: { items: { docType: LegalDocType; version: string }[] }) => post<void>('/me/consents', v), [K.me, K.onboarding]);
export const useElofizetesInditas = () =>
  useValtoztat((v: { platform: 'app' | 'web'; acceptedDeclarations: true }) => post<SubscriptionStartResult>('/client/subscription/start', v), [K.elofizetes]);
export const useElofizetesLemond = () => useValtoztat(() => post<SubscriptionView>('/client/subscription/cancel', {}), [K.elofizetes, K.home]);
export const useElofizetesFolytat = () => useValtoztat(() => post<SubscriptionView>('/client/subscription/resume', {}), [K.elofizetes, K.home]);
export const useKartyaTorles = () => useValtoztat(() => post<SubscriptionView>('/client/subscription/card/delete', {}), [K.elofizetes, K.home]);
export const useErtesitesBeallit = () =>
  useValtoztat((v: { notificationPrefs: { kind: string; push: boolean; email: boolean }[] }) => patch<Me>('/me', v), [K.me]);
export const useOlvasott = () => useValtoztat((v: { ids?: string[]; all?: true }) => post<void>('/me/notifications/read', v), [K.ertesitesek]);
export const useExportKer = () => useValtoztat(() => post<{ exportId: string }>('/me/export', {}), [K.exportok]);

// ---------- SPEC §26: korlátozott mód, magyarázatok, új vállalkozás, útmutatók, visszahívás ----------
/** A /me már tartalmazza (Me.access); ez a külön végpont csak frissítéshez kell. */
export const useHozzaferesLekeres = (enabled = true) => useQuery({ queryKey: K.hozzaferes, queryFn: () => get<ClientAccess>('/client/access'), enabled, staleTime: 60_000 });
export const useMagyarazatok = () =>
  useQuery({ queryKey: K.magyarazatok, queryFn: () => get<{ items: Explainer[] }>('/client/explainers'), staleTime: 5 * 60_000, retry: 0 });
export const useVallalkozas = (enabled = true) =>
  useQuery({ queryKey: K.vallalkozas, queryFn: () => get<BusinessRegistrationResponse>('/client/business-registration'), enabled });
export const useUtmutato = (kind: GuideKind, enabled = true) =>
  useQuery({ queryKey: K.utmutato(kind), queryFn: () => get<Guide>(`/client/guides/${kind}`), enabled, retry: 0 });
/** <media>/utmutato/<kind>/kepek.json – 1 óra friss, utána a háttérben újratölt (SPEC §26.6.4). */
export const useUtmutatoKepek = (kind: GuideKind) =>
  useQuery({
    queryKey: K.utmutatoKepek(kind),
    queryFn: async () => {
      const r = await fetch(mediaUrl(`utmutato/${kind}/kepek.json`), { cache: 'no-cache' });
      if (!r.ok) throw new ApiHiba(r.status, 'nincs_kep', 'A képek most nem érhetők el.');
      return (await r.json()) as GuideImageManifest;
    },
    staleTime: 3600_000,
    gcTime: 24 * 3600_000,
    retry: 1,
  });
export const useVisszahivasok = (enabled = true) =>
  useQuery({ queryKey: K.visszahivas, queryFn: () => get<ClientCallbacks>('/client/callbacks'), enabled, refetchInterval: 60_000 });

const BEKOTES_KULCSOK: QueryKey[] = [K.onboarding, K.me, K.hozzaferes, K.vallalkozas, K.home];
export const useUzletiAllapot = () =>
  useValtoztat((v: BusinessStatusInput | { businessStatus: BusinessStatus }) => put<OnboardingState>('/client/onboarding/business-status', v), [...BEKOTES_KULCSOK, ['utmutato'], K.segitseg]);
export const useProfilIndulo = () => useValtoztat((v: ClientProfileStartInput) => put<ClientProfile>('/client/profile', v), [K.profil, ...BEKOTES_KULCSOK]);
/** 11-19 javítás: a "van" adatlap lapjai "Tovább"-ra (és útváltás előtt) piszkozatként mentődnek – lépést nem változtat. */
export const useProfilVazlat = () => useValtoztat((v: Partial<ClientProfileInput>) => put<ClientProfile>('/client/profile/draft', v), [K.profil]);
export const useVallalkozasMent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: BusinessRegistrationInput) => put<BusinessRegistrationView>('/client/business-registration', v),
    onSuccess: (r) => {
      qc.setQueryData<BusinessRegistrationResponse>(K.vallalkozas, { registration: r });
      void qc.invalidateQueries({ queryKey: K.onboarding });
    },
  });
};
export const useVallalkozasBekuld = () => useValtoztat(() => post<BusinessRegistrationView>('/client/business-registration/submit', {}), [...BEKOTES_KULCSOK, ['utmutato']]);
export const useVallalkozasBeadva = () =>
  useValtoztat(
    (v: { form: FormData; folyamat?: (a: number) => void }) => feltolt<BusinessRegistrationView>('/client/business-registration/filed', v.form, v.folyamat),
    [...BEKOTES_KULCSOK, ['dosszie']],
  );
export const useVallalkozasAdoszam = () =>
  useValtoztat((v: BusinessRegistrationAdoszamInput) => post<BusinessRegistrationView>('/client/business-registration/adoszam', v), BEKOTES_KULCSOK);
export const useVallalkozasLeallit = () =>
  useValtoztat((v: BusinessRegistrationWithdrawInput) => post<BusinessRegistrationView>('/client/business-registration/withdraw', v), [...BEKOTES_KULCSOK, ['utmutato']]);
export const useUtmutatoHaladas = (kind: GuideKind) =>
  useMutation({ mutationFn: (doneStepKeys: string[]) => put<{ doneStepKeys: string[] }>(`/client/guides/${kind}/progress`, { doneStepKeys }) });
export const useVisszahivasKer = () =>
  useValtoztat((v: CallbackCreateInput) => post<CallbackView>('/client/callbacks', v), [K.visszahivas, K.onboarding, K.profil]);
export const useVisszahivasModosit = () =>
  useValtoztat((v: { id: string } & CallbackUpdateInput) => patch<CallbackView>(`/client/callbacks/${v.id}`, { ...v, id: undefined }), [K.visszahivas, K.onboarding]);
export const useHirdetesVisszavon = () => useValtoztat(() => post<{ withdrawn: number }>('/me/hirdetesi-hozzajarulas/visszavonas', {}), [['hirdetesi-hozzajarulas']]);
export const useVisszahivasLemond = () => useValtoztat((id: string) => post<CallbackView>(`/client/callbacks/${id}/cancel`, {}), [K.visszahivas, K.onboarding]);

// ---------- SPEC §27: „Intézzük helyetted” (assist), kamarai regisztráció ----------
const SEGITSEG_KULCSOK: QueryKey[] = [...BEKOTES_KULCSOK, K.segitseg, K.visszahivas, ['utmutato'], ['engedely']];
export const useSegitsegek = (enabled = true) =>
  useQuery({ queryKey: K.segitseg, queryFn: () => get<{ items: AssistView[] }>('/client/assist'), enabled, retry: 0 });
export const useSegitsegKer = () => useValtoztat((v: AssistCreateInput) => post<AssistCreateResult>('/client/assist', v), [...SEGITSEG_KULCSOK, K.profil]);
export const useSegitsegJovahagytam = () => useValtoztat((id: string) => post<AssistView>(`/client/assist/${id}/approved`, {}), SEGITSEG_KULCSOK);
/** 11-19 javítás: „Mégsem hagytam még jóvá” – a tévedésből megnyomott „Jóváhagytam” visszavonása. */
export const useSegitsegMegsemJovahagytam = () => useValtoztat((id: string) => post<AssistView>(`/client/assist/${id}/not-approved`, {}), SEGITSEG_KULCSOK);
export const useSegitsegLemond = () => useValtoztat((v: { id: string; note?: string }) => post<AssistView>(`/client/assist/${v.id}/cancel`, { note: v.note }), SEGITSEG_KULCSOK);
export const useEngedelyOsszegzes = (id?: string) =>
  useQuery({ queryKey: K.engedely(id ?? ''), queryFn: () => get<AssistConsentSummary>(`/client/assist/${id}/consent`), enabled: !!id, retry: 0 });
export const useEngedelyKuld = () =>
  useValtoztat((v: { id: string } & AssistConsentInput) => post<AssistView>(`/client/assist/${v.id}/consent`, { hash: v.hash, declaration: v.declaration, instruction: v.instruction }), SEGITSEG_KULCSOK);
export const useKamara = () => useValtoztat((v: { done: boolean }) => post<BusinessRegistrationView>('/client/business-registration/chamber', v), BEKOTES_KULCSOK);

// ---------- SPEC §28 + §28.K: félretenni, kereset, kedvezmények, változások, havi ellenőrzés, éves zárás, díjak ----------
export const K28 = {
  felretesz: (ev: number) => ['felretesz', ev] as const,
  kereset: (ev: number) => ['kereset', ev] as const,
  kedvezmenyek: (ev: number) => ['kedvezmenyek', ev] as const,
  valtozasok: ['valtozasok'] as const,
  havi: ['havi'] as const,
  eves: (ev: number) => ['eves', ev] as const,
  dijak: ['dijak'] as const,
};
const K28_HOME: QueryKey[] = [K.home, K.me];
export const useFelretesz = (ev: number) => useQuery({ queryKey: K28.felretesz(ev), queryFn: () => get<ReserveView>(`/client/reserve?year=${ev}`), retry: 0 });
export const useFelreteszJeloles = () =>
  useValtoztat((v: ReserveMarkInput) => put<ReserveCard>('/client/reserve/mark', v), [K.home, ['felretesz']]);
export const useKereset = (ev: number) => useQuery({ queryKey: K28.kereset(ev), queryFn: () => get<EarningsView>(`/client/earnings?year=${ev}`), retry: 0 });
export const useKedvezmenyek = (ev: number, enabled = true) =>
  useQuery({ queryKey: K28.kedvezmenyek(ev), queryFn: () => get<AllowanceState>(`/client/allowances?year=${ev}`), enabled, retry: 0 });
export const useKedvezmenyValasz = () =>
  useValtoztat((v: AllowanceAnswersInput) => put<AllowanceState>('/client/allowances/answers', v), [['kedvezmenyek'], ...K28_HOME, K.onboarding]);
export const useKedvezmenyKapu = () =>
  useValtoztat((v: AllowanceGateInput) => post<AllowanceState>('/client/allowances/gate', v), [['kedvezmenyek'], ...K28_HOME, K.onboarding]);
export const useKedvezmenyBecsles = () => useMutation({ mutationFn: (v: AllowanceClientPreviewInput) => post<AllowanceClientPreview>('/client/allowances/preview', v) });
export const useValtozasok = () => useQuery({ queryKey: K28.valtozasok, queryFn: () => get<ChangeGuidesView>('/client/change-guides'), retry: 0 });
export const useValtozasKer = () =>
  useValtoztat((v: AssistCreateInput) => post<AssistCreateResult>('/client/assist', v), [...SEGITSEG_KULCSOK, K28.valtozasok, K28.dijak, K.home]);
export const useValtozasModosit = () =>
  useValtoztat((v: { id: string } & AssistChangeUpdateInput) => put<AssistView>(`/client/assist/${v.id}/change`, { change: v.change }), [...SEGITSEG_KULCSOK, K28.valtozasok]);
export const useHaviEllenorzes = (enabled = true) =>
  useQuery({ queryKey: K28.havi, queryFn: () => get<CheckinView | null>('/client/checkins/current'), enabled, retry: 0 });
export const useHaviValasz = () =>
  useValtoztat((v: { id: string; input: CheckinAnswerInput }) => post<CheckinView>(`/client/checkins/${v.id}`, v.input), [K28.havi, K.home, K28.dijak, K28.valtozasok, K.segitseg]);
/** SPEC §32.B: without a year the server picks it (last year when the client had a profile then – the closing in progress). */
export const useEvesZaras = (ev?: number) => useQuery({ queryKey: ev ? K28.eves(ev) : ['eves', 'alap'], queryFn: () => get<AnnualView | null>(ev ? `/client/annual?year=${ev}` : '/client/annual'), retry: 0 });
export const useEvesValasz = () =>
  useValtoztat((v: { id: string } & AnnualAnswersInput) => put<AnnualView>(`/client/annual/${v.id}/answers`, { answers: v.answers }), [['eves']]);
export const useEvesBekuld = () => useValtoztat((id: string) => post<AnnualView>(`/client/annual/${id}/submit`, {}), [['eves'], K.home, K28.dijak]);
export const useEvesJovahagy = () =>
  useValtoztat((v: { id: string } & AnnualApproveInput) => post<AnnualView>(`/client/annual/${v.id}/approve`, { hash: v.hash }), [['eves'], K.home]);
/** SPEC §32.B: „Megjelölöm, hogy megérkezett” (a visszajáró adó). */
export const useVisszajaroMegjott = () =>
  useValtoztat((v: { id: string; receivedOn: string; amountHuf?: number | null }) => post<AnnualView>(`/client/annual/${v.id}/refund-received`, { receivedOn: v.receivedOn, amountHuf: v.amountHuf ?? null }), [['eves'], K.home, K.hataridok]);
/** SPEC §32.B: az önellenőrzés (lista, részletek, jóváhagyás a látott tartalom hash-ével). */
export const useOnellenorzes = (id?: string) =>
  useQuery({ queryKey: ['onell', id ?? ''], queryFn: () => get<import('../_shared/eves').TaxCorrectionView>(`/client/corrections/${encodeURIComponent(id ?? '')}`), enabled: !!id, retry: 0 });
export const useOnellenorzesJovahagy = () =>
  useValtoztat((v: { id: string; hash: string }) => post<import('../_shared/eves').TaxCorrectionView>(`/client/corrections/${v.id}/approve`, { hash: v.hash }), [['onell'], ['eves'], K.home]);
export const useDijak = () => useQuery({ queryKey: K28.dijak, queryFn: () => get<FeesView>('/client/fees'), retry: 0 });
export const useDijFizet = () => useMutation({ mutationFn: (v: { id: string } & FeePayInput) => post<FeePayStart>(`/client/fees/${v.id}/pay`, { platform: v.platform }) });
export const useAlkalmazottValasz = () => useValtoztat((v: EmployerAnswerInput) => put<OnboardingState>('/client/onboarding/employer', v), [K.onboarding, K.home]);
export const useCsendesIdo = () => useValtoztat((v: { notificationSettings: NotificationSettingsPatch }) => patch<Me>('/me', v), [K.me]);
