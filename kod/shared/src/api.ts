// API DTO types (response/request shapes). Source of truth: kod/SPEC.md §12.
// Money = integer forint. Business dates = 'YYYY-MM-DD' (Europe/Budapest). Timestamps = ISO-8601 UTC.
import type {
  AccessMode,
  AppointmentChannel,
  AppointmentStatus,
  BusinessStatus,
  CallbackAttemptOutcome,
  CallbackCloseReason,
  CallbackSource,
  CallbackStatus,
  CallbackTopic,
  CallbackWindow,
  CertificateType,
  ClientFeature,
  ClientFlag,
  ClientLifecycle,
  CostClass,
  CostRatio,
  DocumentCategory,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  EuPartnerAnswer,
  FeatureState,
  FilingChannel,
  GuideAction,
  GuideImageKind,
  GuideKind,
  HeroState,
  Icon3d,
  Icon3dAny,
  IllustrationAny,
  LegalDocType,
  MeghatalmazasMethod,
  Milestone,
  NewBusinessChargePolicy,
  NotificationKind,
  OnboardingPath,
  OnboardingStep,
  PaymentItemKind,
  PaymentMode,
  RegistrationCheckItem,
  RegistrationStatus,
  RegistrationWithdrawReason,
  RequestDirection,
  RequestStatus,
  RequestType,
  RevenueBand,
  SeatKind,
  SeatRight,
  StaffRole,
  StartPlan,
  StepStatus,
  SubscriptionStatus,
  TaxStatus,
  CalcStatus,
  PaymentStatus,
  FilingStatus,
  UserRole,
  ActivityAnswer,
  ClientKind,
  VideoName,
  WorkKind,
  // SPEC §27
  AssistAction,
  AssistCheckItem,
  AssistCheckPhase,
  AssistCloseReason,
  AssistJogcim,
  AssistKind,
  AssistStatus,
  JourneyActor,
  JourneyRowState,
  JourneyStepKey,
  JourneyVariant,
  PathChangeBlocker,
  RegistrationMode,
} from './enums';

export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // '2026-11-17T09:20:00Z'
export type MonthKey = string; // 'YYYY-MM'

export interface ApiError {
  /** `feature` is set on 403 'locked_until_active' (SPEC §26.5). */
  error: { code: string; message: string; fields?: Record<string, string>; feature?: ClientFeature };
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------- system ----------
export interface PublicConfig {
  brand: { name: string; tagline: string; subline: string; priceHufMonthlyGross: number };
  appEnv: 'demo' | 'production';
  demo: boolean;
  features: { googleSignIn: boolean; appleSignIn: boolean; totp: true };
  googleClientIds: { web?: string; android?: string; ios?: string };
  legal: Partial<Record<LegalDocType, string>>; // docType -> current version
  simplepayMode: PaymentMode;
  /** SPEC §26.7: absolute base of the videos and guide images, `${APP_PUBLIC_URL}/media/`. Web uses '/media/'. */
  mediaBaseUrl?: string;
  /** SPEC §26.1.7: when a new-business client is charged first. */
  newBusinessChargePolicy?: NewBusinessChargePolicy;
}
export interface Health {
  ok: boolean;
  version: string;
  db: 'ok' | 'hiba';
  appEnv: 'demo' | 'production';
  modes: { nav: string; simplepay: string; mail: string; push: string; invoice: string };
  googleSignIn: boolean;
  appleSignIn: boolean;
}

// ---------- auth ----------
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  emailVerified: boolean;
  totpEnabled: boolean;
}
export interface AuthResult {
  accessToken: string;
  accessTokenExpiresAt: ISODateTime;
  refreshToken?: string; // native only
  user: AuthUser;
  isNewUser?: boolean;
}
export interface MfaRequired {
  error: { code: 'mfa_required'; message: string };
  mfaToken: string;
}
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string };
  platform: 'web' | 'android' | 'ios';
}
export interface LoginInput {
  email: string;
  password: string;
  clientKind: ClientKind;
}
export interface SessionInfo {
  id: string;
  clientKind: ClientKind;
  userAgent: string;
  lastUsedAt: ISODateTime;
  current: boolean;
}

// ---------- people ----------
export interface AccountantPublic {
  id: string;
  displayName: string; // "Kovács Bence"
  firstName: string; // "Bence"
  nameForms: { with: string; from: string; onto: string; acc: string }; // Bencével, Bencétől, Bencére, Bencét
  title: string; // "Mérlegképes könyvelő"
  registrationNumber: string;
  avatarKey: string; // "karakter_1_lapos"
  signatureSvgPath: string | null;
  responseTimeText: string;
}
export interface ClientSummary {
  id: string;
  firstName: string;
  lastName: string;
  lifecycle: ClientLifecycle;
  onboardingComplete: boolean;
  personalReferralCode: string | null;
}
export interface Me {
  user: AuthUser;
  client?: ClientSummary;
  accountant?: AccountantPublic; // client's assigned accountant
  staffAccountantId?: string; // when the user IS an accountant
  /** SPEC §26.4: when the user is a team member (role 'csapat'). */
  teamMember?: { firstName: string; displayName: string };
  /** SPEC §26.5: clients only – what is usable now (restricted before activation). */
  access?: ClientAccess;
  notificationPrefs: { kind: NotificationKind; push: boolean; email: boolean }[];
  consentsNeeded: LegalDocType[];
}

// ---------- onboarding ----------
export interface OnboardingStepState {
  step: OnboardingStep;
  status: StepStatus;
  note?: string;
  completedAt?: ISODateTime;
  /** SPEC §26.1.6: the step is shown but cannot be started yet on this path (reason is plain Hungarian). */
  locked?: boolean;
  lockedReason?: string;
  data?: { method?: MeghatalmazasMethod; submittedAt?: ISODateTime };
}
export interface OnboardingState {
  /** In ONBOARDING_STEP_ORDER[path ?? 'van'] order; the legacy 'idopont' step is never listed (SPEC §26.2.9). */
  steps: OnboardingStepState[];
  milestones: { key: Milestone; label: string; done: boolean; current: boolean; sub?: string }[];
  todoCount: number;
  accountant: AccountantPublic;
  /** SPEC §26.1.1: clients.business_status; null = the "Van már egyéni vállalkozásod?" question is still open. */
  path: OnboardingPath | null;
  /** New-business path only. */
  registration: { id: string; status: RegistrationStatus; statusText: string } | null;
  /** The open callback request, if any (SPEC §26.2). */
  callback: CallbackView | null;
  /** @deprecated SPEC §26.2.9 – always false; appointment booking is retired. */
  appointmentsEnabled: boolean;
  meghatalmazasMethods: MeghatalmazasMethod[];
  /** Client view only: what the client needs to file UJEGYKE in ONYA on their own (SPEC §10.2). */
  onyaGuide?: { accountantTaxId: string | null; accountantName: string | null; ugykorok: string[] };
  /**
   * SPEC §27.4: the ONE progress list of the app (replaces "A lépések" + "Hol tartunk" in the app; `steps` and
   * `milestones` stay for the panel and old app builds). Always sent by a backend that implements §27.
   */
  journey?: JourneyView;
  /** SPEC §27.2: can the branch answer be changed now, and if not, why. */
  pathChange?: PathChangeInfo;
  /** SPEC §27.3: the client's assisted requests (open ones first, then the last closed one per kind). */
  assists?: AssistView[];
  /** SPEC §27.3: new-business path only – who files the EV bejelentés. null on 'van' / unanswered. */
  registrationMode?: RegistrationMode | null;
}
export interface ClientProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
  adoazonositoJel: string;
  adoszam: string; // 12345678-1-23
  evNyilvantartasiSzam?: string;
  address: { zip: string; city: string; line: string };
  hqMunicipality: string;
  activityText: string;
  activityAnswer: ActivityAnswer;
  taxStatus: TaxStatus;
  evSince: ISODate;
  previousAccountant?: string;
  hasSeparateBusinessAccount: boolean;
}
/**
 * SPEC §26.1.2: PUT /client/profile on the new-business path ("Rólad" page only). The business fields are filled by
 * the backend when the registration reaches 'kesz'.
 */
export interface ClientProfileStartInput {
  firstName: string;
  lastName: string;
  phone: string;
  adoazonositoJel?: string; // may be omitted once stored
  address: { zip: string; city: string; line: string };
}
/** PUT /client/profile: adoazonositoJel may be omitted once it is stored (keeps the stored one). */
export type ClientProfileUpdate = Omit<ClientProfileInput, 'adoazonositoJel'> & { adoazonositoJel?: string };
export interface ClientProfile extends Omit<ClientProfileInput, 'adoazonositoJel' | 'activityAnswer' | 'taxStatus' | 'hasSeparateBusinessAccount'> {
  /** null until the client answered the questionnaire: the app never pre-selects an answer that changes the tax. */
  activityAnswer: ClientProfileInput['activityAnswer'] | null;
  taxStatus: ClientProfileInput['taxStatus'] | null;
  hasSeparateBusinessAccount: boolean | null;
  adoazonositoJelMasked: string; // "•••••••456"
  suggestedCostRatio: CostRatio;
  confirmedCostRatio: CostRatio | null;
}

// ---------- money / tax ----------
export interface Meter {
  usedHuf: number;
  limitHuf: number;
  projectedHuf: number;
  ratio: number; // 0..1+
  warning: boolean;
  sentence: string;
}
export interface PaymentItem {
  id: string;
  kind: PaymentItemKind;
  label: string; // "TB-járulék"
  sublabel?: string; // "szociális hozzájárulási adó"
  amountHuf: number;
  dueDate: ISODate;
  accountName: string;
  accountNumber: string; // "10032000-06055802"
  iban: string;
  reference: string; // közlemény
  markedPaidAt?: ISODateTime;
  markedPaidOn?: ISODate;
  verifiedAt?: ISODateTime;
  verification?: 'rendben' | 'elteres';
}
export interface Letter {
  greeting: string; // "Kedves Kata!"
  body: string;
  signedBy: string; // "Kovács Bence"
  signedRole: string; // "könyvelőd"
  date: ISODate;
}
export interface Hero {
  state: HeroState;
  periodId?: string;
  periodKey?: string; // "2026-Q3"
  periodLabel?: string; // "III. negyedév"
  amountHuf?: number;
  dueDate?: ISODate;
  daysLeft?: number;
  paidOn?: ISODate;
  verified?: boolean;
  note?: string;
}
export interface ExplanationLine {
  label: string;
  amountHuf?: number;
  op?: '+' | '−' | '=';
  note?: string;
}
export interface Explanation {
  intro: string;
  lines: ExplanationLine[];
  result: string;
}
export interface TaxPeriodSummary {
  id: string;
  periodKey: string;
  kind: 'negyedev' | 'hipa';
  label: string;
  dueDate: ISODate;
  calcStatus: CalcStatus;
  paymentStatus: PaymentStatus;
  filingStatus: FilingStatus;
  totalHuf: number | null;
}
export interface TaxPeriodDetail extends TaxPeriodSummary {
  items: PaymentItem[];
  explanation: Explanation | null;
  disclaimer: string | null; // set while not approved
  letter: Letter | null;
  filed: { filedOn: ISODate; documents: DocumentListItem[] } | null;
}
export interface Deadline {
  id: string;
  kind: 'befizetes' | 'bevallas' | 'keres' | 'idopont' | 'egyeb';
  title: string;
  dueDate: ISODate;
  daysLeft: number;
  amountHuf?: number;
  status: 'kesz' | 'nyitott' | 'lejart';
  /** Payments only: false while the client has marked it paid but the accountant has not verified it yet. */
  verified?: boolean;
  /** Payments only: true while the amount is still an estimate (the accountant has not approved it yet). */
  estimate?: boolean;
  link: string; // in-app route
}

// ---------- documents ----------
export interface DocumentListItem {
  id: string;
  title: string;
  category: DocumentCategory;
  source: DocumentSource;
  status: DocumentStatus;
  statusLabel: string; // already personalised ("Bence látta")
  statusAt: ISODateTime;
  dossierMonth: MonthKey;
  icon: Icon3d;
  pageCount: number;
  amountHuf?: number;
  thumbFileId?: string;
  visibility?: DocumentVisibility; // accountant views only
}
export interface DocumentDetail extends DocumentListItem {
  versions: { id: string; versionNo: number; fileId: string; pageCount: number; createdAt: ISODateTime }[];
  history: { status: DocumentStatus; label: string; at: ISODateTime; by?: string }[];
  accountantComment?: string;
  clientNote?: string;
  documentDate?: ISODate;
  relatedRevenueMonth?: MonthKey;
}
export interface DossierView {
  month: MonthKey;
  label: string; // "Október"
  headline: string; // "8 irat, ebből egy még Bencére vár."
  review?: { by: AccountantPublic; at: ISODateTime; okCount: number; note?: string };
  sentByMe: DocumentListItem[];
  fromNav: {
    invoices: { count: number; status: DocumentStatus; statusLabel: string; statusAt: ISODateTime | null; totalHuf: number; demo: boolean };
    letters: DocumentListItem[];
  };
  filedByAccountant: DocumentListItem[];
  /** Signed contracts and other agreements (no workflow status). */
  contracts: DocumentListItem[];
  openRequests: RequestSummary[];
}
export interface NavInvoiceListItem {
  id: string;
  invoiceNumber: string;
  issueDate: ISODate;
  customerName: string | null;
  grossAmountHuf: number;
  status: DocumentStatus;
  demo: boolean;
}

// ---------- home ----------
export interface ClientHome {
  today: ISODate;
  demo: boolean;
  client: { id: string; firstName: string; lifecycle: ClientLifecycle; onboardingComplete: boolean };
  accountant: AccountantPublic;
  hero: Hero;
  letter: Letter | null;
  paymentItems: PaymentItem[];
  requestsFromAccountant: RequestSummary[];
  limits: {
    afa: Meter;
    atalanyCap: Meter;
    adomentes: { reached: boolean; reachedMonth: number | null; limitHuf: number; sentence: string };
  };
  revenueByMonth: { month: number; amountHuf: number }[];
  currentDossier: { month: MonthKey; label: string; items: DocumentListItem[]; totalCount: number };
  nextDeadline: Deadline | null;
  /** Shown as a home banner when the service is ending or ended (cancelled subscription, cancelled deletion). */
  serviceNotice?: { kind: 'megszunik' | 'megszunt'; endsOn: ISODate | null; canResume: boolean };
}

// ---------- messages / requests ----------
export interface Message {
  id: string;
  kind: 'szoveg' | 'keres_kartya' | 'rendszer';
  body: string;
  sender: 'en' | 'konyvelo' | 'ugyfel' | 'rendszer' | 'csapat'; // 'en' = the caller
  /** SPEC §26.4.4: for 'csapat' messages "Anna · ügyfélszolgálat"; for the accountant his displayName. */
  senderName?: string;
  createdAt: ISODateTime;
  attachments: { fileId: string; displayName: string; mime: string }[];
  request?: RequestSummary;
  document?: DocumentListItem;
  readByAccountantAt?: ISODateTime;
  readByClientAt?: ISODateTime;
}
export interface RequestSummary {
  id: string;
  direction: RequestDirection;
  type: RequestType;
  title: string;
  body: string;
  status: RequestStatus;
  statusLabel: string;
  dueDate?: ISODate;
  createdAt: ISODateTime;
  dossierMonth?: MonthKey;
  certificate?: { certificateType: CertificateType; year?: number; purpose: string; language: 'hu' | 'en'; submittedToNavAt?: ISODate };
  resultDocumentId?: string;
}

// ---------- appointments ----------
/** @deprecated SPEC §26.2.9 – appointment booking is retired; old rows stay readable. */
export interface Appointment {
  id: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  channel: AppointmentChannel;
  status: AppointmentStatus;
  videoLink?: string;
  topic?: string;
}

// ---------- subscription ----------
export interface SubscriptionView {
  status: SubscriptionStatus;
  mode: PaymentMode;
  priceHuf: number;
  currentPeriodEnd?: ISODate;
  nextChargeAt?: ISODateTime;
  cancelAtPeriodEnd: boolean;
  card?: { mask: string; expiry: ISODate; tokensLeft: number; tokensUntil: ISODateTime };
  failedAttempts: number;
  graceUntil?: ISODate;
  /**
   * What a new card registration pays for (SimplePay registers a card with a payment): the month
   * that starts on this day. For a paid, running period this is currentPeriodEnd (no day is paid twice).
   */
  nextPaidPeriodStart?: ISODate;
}
export interface SubscriptionStartResult {
  paymentUrl: string;
  orderRef: string;
  tokenInfo: { times: number; maxAmountHuf: number; until: ISODateTime };
  /** The month this payment covers. */
  period: { start: ISODate; end: ISODate };
}
export interface FeeInvoiceItem {
  id: string;
  number: string;
  issuedOn: ISODate;
  amountHuf: number;
  demo: boolean;
  fileId: string;
}

// ---------- notifications ----------
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  createdAt: ISODateTime;
  readAt: ISODateTime | null;
}

// ---------- accountant panel ----------
export interface AccClientRow {
  id: string;
  name: string;
  lifecycle: ClientLifecycle;
  flags: ClientFlag[];
  nextDeadline?: Deadline;
  openRequestsFromClient: number;
  openRequestsToClient: number;
  waitingDocuments: number;
  lastUploadAt?: ISODateTime;
  afaRatio: number;
  subscriptionStatus: SubscriptionStatus | null;
  onboardingMilestone: Milestone | null;
  /**
   * 11-19 javítás: the same journey the client sees ("Így halad a bekötésed") – done/total of the required rows and what
   * comes next (the client's current row, else what others work on). Only during onboarding.
   */
  onboardingJourney?: { done: number; total: number; next: string | null; nextActor: string | null; waiting: string | null } | null;
}
export interface RevenueItem {
  id: string;
  source: 'nav_szamla' | 'kezi';
  navInvoiceId?: string;
  documentId?: string;
  receivedOn: ISODate;
  receivedOnEstimated: boolean;
  deliveryDate: ISODate;
  amountHuf: number;
  description: string;
  countsForAtalany: boolean;
  countsForAfaLimit: boolean;
  excludedReason?: string;
}
export interface TaxCalculation {
  id: string;
  taxPeriodId: string;
  version: number;
  engineVersion: string;
  rulesVersion: string;
  asOf: ISODate;
  result: unknown; // @kezjegy/ado-motor QuarterResult (+ YearResult context)
  overrides: { tbHuf?: number; szochoHuf?: number; szjaAdvanceHuf?: number; reason: string } | null;
  letterText: string | null;
  approvedAt: ISODateTime | null;
  approvedBy: string | null;
}
export interface TaxProfile {
  year: number;
  costRatio: CostRatio;
  costRatioSource: 'ugyfel_javaslat' | 'konyvelo_megerositette';
  status: TaxStatus;
  guaranteedMinimum: boolean;
  atalanyFrom?: ISODate;
  insuranceBreaks: { from: ISODate; to: ISODate; kind: 'szunetel' | 'kieso' }[];
  hipa: { method: 'savos' | 'altalanos' | 'nincs'; ratePct: number; accountNumber?: string };
  priorOverrides?: { throughQuarter: 1 | 2 | 3; priorActualBaseSum: number; priorSzjaAdvanceSum: number };
}

// =====================================================================================================================
// SPEC §26 – owner orders 11-18 (new business, callback, restricted mode, explainers, guides, videos, team role)
// =====================================================================================================================
export interface Address {
  zip: string;
  city: string;
  line: string;
}
/** Staff member as other staff see it. */
export interface StaffRef {
  userId: string;
  name: string; // "Nagy Anna"
  firstName: string; // "Anna"
  role: StaffRole;
}

// ---------- §26.5 restricted mode ----------
export interface ClientAccessFeature {
  feature: ClientFeature;
  state: FeatureState;
  label: string;
  /** Filled lock reason ({firstName} replaced); null when 'nyitva'. */
  reason: string | null;
}
export interface ClientAccess {
  mode: AccessMode;
  features: ClientAccessFeature[];
  /** "Még 3 lépés, és minden megnyílik." – null when mode 'teljes'. */
  activationHint: string | null;
}

// ---------- §26.8 explainers ----------
export interface Explainer {
  key: string; // ExplainerKey (bekotes.ts)
  title: string;
  what: string;
  why: string;
  where: string;
  icon: Icon3dAny;
  illustration?: IllustrationAny;
  step?: OnboardingStep;
  fields: string[];
}

// ---------- §26.1 new business ----------
export interface BusinessActivityChoice {
  /** BUSINESS_ACTIVITIES key; null = the client's own words (label = his text). */
  key: string | null;
  label: string;
  main: boolean;
  /** Filled by [KÖNYVELŐ] in the shared list, or by the team in the pipeline. */
  ovtjKod: string | null;
  /** The exact KSH ÖVTJ'25 line label of ovtjKod (team or [KÖNYVELŐ]); optional. */
  ovtjNev?: string | null;
  /** What to type into the NAV activity search. */
  navKereso: string | null;
}
export interface SeatAnswer {
  kind: SeatKind;
  /** null when kind 'lakcim' (the profile address is used). */
  address: Address | null;
  right: SeatRight | null;
  provider: { name: string; adoszam: string } | null;
}
/** PUT /client/business-registration – every field optional (draft save); validated per field when present. */
export interface BusinessRegistrationInput {
  declarations?: { noExclusion: boolean; singleBusiness: boolean };
  revenueBand?: RevenueBand;
  activities?: { key: string | null; label?: string; main: boolean }[];
  activityFreeText?: string | null;
  seat?: { kind: SeatKind; address?: Address | null; right?: SeatRight | null; provider?: { name: string; adoszam: string } | null };
  otherSites?: { address: Address }[];
  workKind?: WorkKind;
  euPartner?: EuPartnerAnswer;
  startPlan?: StartPlan;
  startDate?: ISODate | null;
  hasSeparateBusinessAccount?: boolean | null;
}
/** Stored answers as the client and the team see them (null = not answered yet). */
export interface BusinessRegistrationAnswers {
  declarations: { noExclusion: boolean; singleBusiness: boolean; acceptedAt: ISODateTime } | null;
  revenueBand: RevenueBand | null;
  activities: BusinessActivityChoice[];
  activityFreeText: string | null;
  seat: SeatAnswer | null;
  /** 'telephely' when in the seat's settlement, else 'fioktelep' (computed by the backend). */
  otherSites: { address: Address; kind: 'telephely' | 'fioktelep' }[];
  workKind: WorkKind | null;
  euPartner: EuPartnerAnswer | null;
  startPlan: StartPlan | null;
  startDate: ISODate | null;
  hasSeparateBusinessAccount: boolean | null;
}
/** Computed by the backend with @kezjegy/ado-motor (RULES_2026); suggestion only, the accountant confirms. */
export interface BusinessRegistrationHints {
  costClass: CostClass | null;
  costRatio: CostRatio | null;
  /** "A tevékenységed alapján a költséghányadod várhatóan 45%. Bence megerősíti." */
  costRatioText: string | null;
  /** Főállásban: TB + szocho on the monthly minimum (2026: 101 682 Ft); null otherwise. */
  minimumMonthlyContributionHuf: number | null;
  contributionText: string | null;
  afaLimitHuf: number; // 20 000 000 (2026)
  /** Átalány cap, prorated by days from the planned start (38 736 000 for a full 2026). */
  atalanyCapHuf: number;
  qualificationNote: string | null;
  /** When set, the path cannot continue (the app shows the text + "Kérj visszahívást"). */
  stop: { code: 'tobb_20m' | 'kizaro_ok' | 'mar_van_vallalkozas'; text: string } | null;
}
export interface BusinessRegistrationView {
  id: string;
  status: RegistrationStatus;
  statusText: string;
  answers: BusinessRegistrationAnswers;
  hints: BusinessRegistrationHints;
  /** Field ids still missing before submit (empty when submittable). */
  missing: string[];
  canEdit: boolean; // kitoltes | utmutato | javitas
  canWithdraw: boolean; // any open status
  submittedAt: ISODateTime | null;
  guideOpenedAt: ISODateTime | null;
  guideProgress: string[]; // done step keys
  filed: { filedOn: ISODate; channel: FilingChannel; documentId: string; fileId: string; uploadedAt: ISODateTime } | null;
  fixNote: string | null;
  checkedAt: ISODateTime | null;
  adoszam: string | null;
  evNyilvantartasiSzam: string | null;
  registeredOn: ISODate | null;
  doneAt: ISODateTime | null;
  withdrawnAt: ISODateTime | null;
  withdrawReason: RegistrationWithdrawReason | null;
  updatedAt: ISODateTime;
  /** True while an activity has no exact ÖVTJ line yet: the team writes it, the guide holds the filing steps. */
  activityPending?: boolean;
  /** SPEC §27.3: 'onallo' (client files with the guide) or 'segitett' (our accountant files as meghatalmazott). */
  mode?: RegistrationMode;
  /** SPEC §27.4.4 S12: kamarai regisztráció – due = filing day + 5 working days; doneAt = the client ticked "Megcsináltam". */
  chamber?: { dueOn: ISODate | null; doneAt: ISODateTime | null } | null;
}
/** GET /client/business-registration */
export interface BusinessRegistrationResponse {
  registration: BusinessRegistrationView | null;
}
/** POST /client/business-registration/filed – multipart: `file` (PDF or image) + these fields. */
export interface BusinessRegistrationFiledInput {
  filedOn: ISODate;
  channel: FilingChannel;
  adoszam?: string;
  evNyilvantartasiSzam?: string;
}
export interface BusinessRegistrationAdoszamInput {
  adoszam: string;
  evNyilvantartasiSzam?: string;
  registeredOn?: ISODate;
}
export interface BusinessRegistrationWithdrawInput {
  reason: RegistrationWithdrawReason;
  note?: string;
}

// ---------- §26.6 guides ----------
export interface VideoRef {
  name: VideoName;
  title: string;
  /** File names relative to the media base (VIDEO_FILES). */
  mp4: string;
  poster: string;
  vtt: string;
  durationSec?: number;
}
export interface GuideField {
  label: string;
  action: GuideAction;
  actionLabel: string; // GUIDE_ACTION_LABELS
  value?: string;
  why?: string;
  /** Text for the copy button (only when the template says copy): a code, a search word or one address part. */
  copyValue?: string;
}
export interface GuideStep {
  key: string; // GUIDE_STEP_KEYS[kind]
  n: number; // 1-based
  screenTitle: string;
  text: string;
  fields: GuideField[];
  warning?: string;
  link?: { label: string; url: string };
  ownApp: boolean;
  /** Whose screen: NAV (default), the chamber's site, or our app (step header). */
  screenKind?: 'nav' | 'kamara' | 'app';
  /** "Várd meg, amíg megírjuk" – shown instead of letting the client go on (e.g. the ÖVTJ line is not known yet). */
  hold?: string;
  /** = key; resolved by the app through the GuideImageManifest. */
  imageKey: string;
  done: boolean;
}
export interface GuidePrepareItem {
  key: string;
  label: string;
  note: string;
  explainerKey: string;
  storedByUs: boolean;
  /** The line about what we ask for (e.g. "A bejelentéshez nem kérjük el. Az azonosításnál … kell."). */
  privacyNote?: string | null;
}
export interface Guide {
  kind: GuideKind;
  /** e.g. "2026-11-18" – changes when the template changes. */
  version: string;
  title: string;
  intro: string;
  outro: string;
  /** SPEC §27.3.6: null for 'meghatalmazas_jovahagyas' (no video; the card is not shown). */
  video: VideoRef | null;
  /** SPEC §27.3.6: approval guide only – the shown due date of the client's ONYA approval. */
  approvalDue?: { dueOn: ISODate; dueText: string; daysLeft: number; lastDay: boolean; afterDue?: boolean } | null;
  /** Only for 'vallalkozas_bejelentes' (the "Készítsd elő" list); [] for the other. */
  prepare: GuidePrepareItem[];
  steps: GuideStep[];
  /** Relative to the media base: "utmutato/<kind>/kepek.json". */
  imagesManifest: string;
  /** true after the template's validUntil (2027: the chamber takes over the register). */
  outdated: boolean;
  outdatedText: string | null;
  /** bejelentés only: the exact activity line is not known yet (steps carry `hold`). */
  activityPending?: boolean;
}
export interface GuideProgressInput {
  doneStepKeys: string[];
}
/** <media>/utmutato/<kind>/kepek.json – generated from utmutato_kepek/<kind>/index.json (SPEC §26.6.4). */
export interface GuideImageManifest {
  kind: GuideKind;
  generatedAt: ISODateTime;
  items: GuideImage[];
  /** Step keys without any picture (the app shows the text only). */
  missing: string[];
}
export interface GuideImage {
  stepKey: string;
  /** Relative to the manifest's folder, e.g. "05_tevekenysegek.png" (1080 px wide). */
  file: string;
  file2x?: string;
  width: number;
  height: number;
  kind: GuideImageKind;
  caption: string;
  alt: string;
  source: { title: string; url: string; date?: string; page?: number } | null;
}
/** Optional <media>/videok.json (SPEC §26.7.2). */
export interface VideoManifest {
  /** hasNarration (integrator 11-18, §24): false while the file is the silent captioned interim; the card then says
   *  "Felirattal." instead of "Felirattal, hanggal.". Missing = narrated (older manifests). */
  items: { name: VideoName; durationSec: number; sizeBytes: number; updatedAt: ISODateTime; hasNarration?: boolean }[];
}

// ---------- §26.2 callbacks (client) ----------
export interface CallbackPromise {
  /** "Kollégánk 24–48 órán belül hív, munkanapokon 9 és 17 óra között. Nem feltétlenül Bence hív elsőként…" */
  text: string;
  /** "Erről a számról hívunk: +36 1 …" – null until [OWNER] sets CALLBACK_CALLER_ID. */
  callerIdText: string | null;
  fraudWarning: string;
  privacyText: string;
  windows: { window: CallbackWindow; label: string }[];
  topics: { topic: CallbackTopic; label: string }[];
}
export interface CallbackView {
  id: string;
  status: CallbackStatus;
  /** Client wording (SPEC §26.2.6), e.g. "Megkaptuk. Kollégánk 24–48 órán belül hív a +36 30 *** **67 számon." */
  statusText: string;
  topic: CallbackTopic;
  topicLabel: string;
  source: CallbackSource;
  window: CallbackWindow;
  phoneMasked: string;
  note: string | null;
  createdAt: ISODateTime;
  dueAt: ISODateTime;
  overdue: boolean;
  /** A staff member pressed "Most hívom" in the last 15 minutes. */
  callingNow: boolean;
  /** First name of the colleague who handles it (never the full name). */
  staffFirstName: string | null;
  lastAttempt: { at: ISODateTime; outcome: CallbackAttemptOutcome } | null;
  failedAttempts: number;
  /** The last attempt said the number is wrong: the app asks for a new one. */
  needsNewPhone: boolean;
  canEdit: boolean;
  canCancel: boolean;
  closedAt: ISODateTime | null;
  /** Summary the colleague chose to share (also posted as a message). */
  summary: string | null;
  /** SPEC §27.3: the assist this callback belongs to ('…_helyettem' topics). */
  assistId?: string | null;
}
/** GET /client/callbacks */
export interface ClientCallbacks {
  open: CallbackView | null;
  recent: CallbackView[]; // closed ones, newest first, max 5
  promise: CallbackPromise;
  /** The profile phone, masked, to prefill the form (the full number is never sent back). */
  phoneOnFileMasked: string | null;
}
export interface CallbackCreateInput {
  /** Full number; omit to use the profile phone. Normalised with normalizeHuPhone. */
  phone?: string;
  topic: CallbackTopic;
  window: CallbackWindow;
  note?: string;
  source: CallbackSource;
  /** Also store this number in the profile (default false). */
  savePhoneToProfile?: boolean;
}
export interface CallbackUpdateInput {
  phone?: string;
  topic?: CallbackTopic;
  window?: CallbackWindow;
  note?: string | null;
}

// ---------- §26.3/§26.4 team (csapat, admin; accountant only for callbacks assigned to him) ----------
export interface TeamSummary {
  callbacks: { open: number; overdue: number; mine: number; unassigned: number };
  registrations: Record<RegistrationStatus, number>;
  unreadThreads: number;
  /** SPEC §27.6: assisted requests; `waitingOnMe` = ball on the caller's role (accountant: his clients only). */
  assists?: { open: number; waitingOnMe: number; approvalOverdue: number; mine: number };
}
export interface TeamClientCard {
  id: string;
  name: string;
  email: string;
  phoneMasked: string | null;
  lifecycle: ClientLifecycle;
  businessStatus: BusinessStatus | null;
  milestone: Milestone | null;
  accountant: { id: string; userId: string; name: string } | null;
  /** `pathChanged`: an 'elallt' registration left by a branch change ("Útvonalat váltott", not "Elállt"). */
  registration: { id: string; status: RegistrationStatus; pathChanged?: boolean } | null;
  /** 11-19 javító kör 2: the client's own journey ("Most ez jön") – the team sees the same next step as the client. */
  journeyNext?: { title: string; actorLabel: string; waiting: string | null } | null;
  openCallbackId: string | null;
  /** Team may message only clients in onboarding. */
  canMessage: boolean;
  /** SPEC §27.2.5: every branch change, newest first (from the audit log). */
  pathHistory?: PathHistoryItem[];
  /** SPEC §27.3: the open assist (or the last closed one). */
  assist?: { id: string; kind: AssistKind; status: AssistStatus } | null;
  registrationMode?: RegistrationMode | null;
}
export interface TeamCallbackRow {
  id: string;
  client: { id: string; name: string; lifecycle: ClientLifecycle };
  status: CallbackStatus;
  topic: CallbackTopic;
  source: CallbackSource;
  window: CallbackWindow;
  phoneMasked: string;
  notePreview: string | null; // ≤ 80 chars
  createdAt: ISODateTime;
  targetAt: ISODateTime; // +24 h
  dueAt: ISODateTime; // +48 h
  overdue: boolean;
  /** Negative when overdue. */
  minutesToDue: number;
  attempts: number;
  failedAttempts: number;
  lastAttemptAt: ISODateTime | null;
  nextAttemptAfter: ISODateTime | null;
  callingNowUntil: ISODateTime | null;
  assignee: StaffRef | null;
}
export interface TeamCallbackDetail extends TeamCallbackRow {
  /** Full E.164 number only when the callback is assigned to the caller (audited 'callback.phone_viewed'); else null. */
  phone: string | null;
  note: string | null;
  internalNote: string | null;
  summaryForClient: string | null;
  closedReason: CallbackCloseReason | null;
  closedAt: ISODateTime | null;
  clientCard: TeamClientCard;
  attemptList: { id: string; at: ISODateTime; by: StaffRef; outcome: CallbackAttemptOutcome; note: string | null }[];
  history: { at: ISODateTime; by: StaffRef | null; action: string; text: string }[];
  /** People this callback may be handed to: team members, admins, and the client's accountant. */
  assignable: StaffRef[];
  legacyAppointment: { startsAt: ISODateTime; channel: AppointmentChannel; status: AppointmentStatus } | null;
}
export interface CallbackAttemptInput {
  outcome: CallbackAttemptOutcome;
  note?: string;
  /** Only with 'beszeltunk': posted to the client as a message (sender 'csapat' or 'konyvelo'). */
  summaryForClient?: string;
  /** Only with 'kesobb_kerte'. */
  nextAttemptAfter?: ISODateTime;
}
export interface CallbackAssignInput {
  userId: string | null;
}
export interface CallbackCloseInput {
  reason: CallbackCloseReason;
  note?: string;
}
export interface CallbackStaffPatch {
  internalNote?: string | null;
  topic?: CallbackTopic;
}
export interface TeamCallbackCreateInput {
  topic: CallbackTopic;
  note?: string;
  /** Omit to use the client's profile phone. */
  phone?: string;
  window?: CallbackWindow;
}
export interface TeamRegistrationRow {
  id: string;
  client: { id: string; name: string; email: string };
  status: RegistrationStatus;
  statusSince: ISODateTime;
  daysInStatus: number;
  mainActivity: string | null;
  startPlan: StartPlan | null;
  startDate: ISODate | null;
  guideOpenedAt: ISODateTime | null;
  guideProgress: { done: number; total: number };
  filedOn: ISODate | null;
  assignee: StaffRef | null;
  openCallbackId: string | null;
  /** An activity still needs its ÖVTJ code from the team (the client's guide waits for it). */
  activityPending?: boolean;
  /** SPEC §27.3: 'segitett' cards carry the assist link and show "Intézzük helyette". */
  mode?: RegistrationMode;
  assistId?: string | null;
  /** SPEC §27.2.5: set when the client left this path (registration 'elallt' with reason 'mar_van_vallalkozasa'). */
  pathChangedAt?: ISODateTime | null;
}
export interface TeamRegistrationDetail extends TeamRegistrationRow {
  answers: BusinessRegistrationAnswers;
  hints: BusinessRegistrationHints;
  clientCard: TeamClientCard;
  filed: { filedOn: ISODate; channel: FilingChannel; documentId: string; fileId: string; mime: string; uploadedAt: ISODateTime } | null;
  checkItems: RegistrationCheckItem[];
  checkedBy: StaffRef | null;
  checkedAt: ISODateTime | null;
  fixNote: string | null;
  adoszam: string | null;
  evNyilvantartasiSzam: string | null;
  registeredOn: ISODate | null;
  staffNote: string | null;
  history: { at: ISODateTime; by: StaffRef | null; action: string; text: string }[];
  /** Read-only, to tick "Név, lakcím rendben" against the PDF (SPEC §26.4: allowed for this check only). */
  clientProfile?: { name: string; address: Address | null };
}
export interface TeamRegistrationPatch {
  answers?: BusinessRegistrationInput;
  /** ÖVTJ codes (and optionally the official line label) chosen by the team, by index of answers.activities. */
  ovtjKodok?: { index: number; ovtjKod: string | null; ovtjNev?: string | null }[];
  staffNote?: string | null;
}
export interface RegistrationCheckInput {
  /** Must contain every REGISTRATION_CHECK_ITEMS value. */
  items: RegistrationCheckItem[];
  note?: string;
}
export interface RegistrationFixInput {
  /** Shown to the client as is (≤ 1000 chars, tegező). */
  note: string;
}
export interface RegistrationAdoszamStaffInput {
  adoszam: string;
  evNyilvantartasiSzam?: string;
  registeredOn: ISODate;
}
export interface TeamThreadRow {
  client: { id: string; name: string };
  lastMessageAt: ISODateTime | null;
  lastMessagePreview: string | null; // ≤ 80 chars
  unread: number;
  milestone: Milestone | null;
  registrationStatus: RegistrationStatus | null;
}
export interface TeamMemberRow {
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  active: boolean;
  totpEnabled: boolean;
  openCallbacks: number;
  callbacksDone30d: number;
  registrationsChecked30d: number;
  lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime;
}
export interface TeamMemberInvite {
  email: string;
  displayName: string;
  firstName: string;
}
export interface TeamMemberPatch {
  displayName?: string;
  firstName?: string;
  active?: boolean;
}
/** Additions to GET /admin/dashboard (SPEC §26.3.4). */
export interface AdminServiceStats {
  callbacks: { open: number; overdue: number; doneThisMonth: number; medianFirstAttemptHours30d: number | null };
  registrations: { inPipeline: number; doneThisMonth: number; withdrawnThisMonth: number };
  /** SPEC §27.6.4 */
  assists?: { open: number; doneThisMonth: number; expiredApprovals30d: number; medianDaysToDone30d: number | null };
}

// =====================================================================================================================
// SPEC §27 – owner orders 11-19 (changeable branch, "Intézzük helyetted", one journey, invoice wording)
// =====================================================================================================================

// ---------- §27.4 journey ("Így halad a bekötésed") ----------
export interface JourneyStepView {
  key: JourneyStepKey;
  /** 1-based number shown on the row (order of JOURNEY_ORDER[variant]). */
  n: number;
  /** JOURNEY_STEP_TEXTS[key].title – one name per thing. */
  title: string;
  /** Who acts on this row now (for 'kesz' rows: who did it last). */
  actor: JourneyActor;
  /** "Te" · "Bence" · "Csapatunk" · "NAV". */
  actorLabel: string;
  state: JourneyRowState;
  /** One plain line, e.g. "Kész, november 18." · "Most te jössz" · "Bence dolgozik rajta". */
  statusText: string;
  /** "kb. 5 perc" · "általában 1 munkanap"; null on 'kesz'/'kihagyva'. */
  timeText: string | null;
  /** A deadline the CLIENT must keep (ONYA approval, chamber); null otherwise. */
  dueOn: ISODate | null;
  /** "november 22-ig (még 3 nap)" / "Ma van az utolsó nap". Built by the server (suffix rule: bekotes.ts header). */
  dueText: string | null;
  /** Why a 'kesobb' row cannot start yet ("Előbb fogadd el a szerződést."). */
  lockedReason: string | null;
  /** Primary action of the row (state 'most' | 'nyitva'); label is first person. */
  action: { label: string; route: string } | null;
  /** "Mi ez?" sheet. */
  explainerKey: string;
  /** Counts toward JourneyView.todoCount (client still has to act on it at some point). */
  clientPart: boolean;
  /** Not needed for activation (kamara). */
  optional: boolean;
  completedAt: ISODateTime | null;
}
/**
 * The waiting card (SPEC §27.4.3): the big top card when nothing is the client's turn (`currentKey` null), else a slim
 * "Közben: {title} · {time}" strip above the "Most ez jön" card.
 */
export interface WaitingCardView {
  /** WAITING_TEXTS key. */
  key: string;
  actor: JourneyActor;
  kicker: string;
  title: string;
  body: string;
  /** "Ha november 21-ig nem történik semmi, kérj visszahívást." */
  escalateText: string | null;
  /** 11-19 javítás: 'uzenet' while a callback is already open ("… írj nekünk az Üzenetekben"), else 'visszahivas'. */
  escalateKind?: 'visszahivas' | 'uzenet';
  /** How long the others usually need ("általában 1 munkanap", "24–48 órán belül") – the "Közben: {title} · {time}" strip. */
  timeText?: string | null;
  /** Something the client may already do meanwhile (first 'nyitva' row). */
  meanwhile: { title: string; label: string; route: string } | null;
}
export interface JourneyView {
  variant: JourneyVariant;
  path: OnboardingPath | null;
  mode: RegistrationMode | null;
  steps: JourneyStepView[];
  /** The one 'most' row; null when others work (then `waiting` is set) or everything is done. */
  currentKey: JourneyStepKey | null;
  waiting: WaitingCardView | null;
  /** = band number = tab badge = locked-sheet "a tiéd": client rows not done + open accountant requests. */
  todoCount: number;
  /** Rows not done (all actors) – locked sheet "Még {remaining} lépés". */
  remaining: number;
  /** Filled JOURNEY_TEXTS band sentence. */
  bandTitle: string;
  /** Filled "Még {remaining} lépés, és minden megnyílik. Ebből {n} a tiéd." */
  lockedSheetText: string;
  /** Greyed preview rows while the branch is unanswered (JOURNEY_PREVIEW titles). */
  preview: string[];
}

// ---------- §27.2 changeable branch ----------
export interface PathChangeInfo {
  current: OnboardingPath | null;
  mode: RegistrationMode | null;
  /** The client may switch to the other path in the app right now. */
  canChange: boolean;
  blocker: PathChangeBlocker | null;
  /** PATH_CHANGE_BLOCKER_TEXT filled; null when canChange. */
  blockerText: string | null;
  /** The confirm-sheet body for the switch that is possible now (PATH_CHANGE_TEXTS.toVan / toInditas [+ toVanAssist]). */
  confirmText: string | null;
  changedAt: ISODateTime | null;
}
/** PUT /client/onboarding/business-status (SPEC §27.2.3). */
export interface BusinessStatusInput {
  businessStatus: BusinessStatus;
  /** 11-19 javítás: only the toast's "Visszavonom" sends this (an undo is not a new change for the staff badge). */
  undo?: true;
  /** Only with 'inditas': the answer to "Hogyan jelentsük be?" when it is 'onallo' (the assisted answer goes through POST /client/assist). */
  mode?: 'onallo';
}
export interface PathHistoryItem {
  at: ISODateTime;
  from: OnboardingPath | null;
  to: OnboardingPath | null;
  by: 'ugyfel' | 'csapat' | 'admin' | 'rendszer';
  /** "Rossz gombot nyomott" / "Visszavonta 5 mp-en belül" / "Bejelentés leállítva: később indítja". */
  note: string | null;
}

// ---------- §27.3 assisted path "Intézzük helyetted" (client) ----------
export interface AssistView {
  id: string;
  kind: AssistKind;
  status: AssistStatus;
  /** ASSIST_STATUS_CLIENT_TEXT filled ({firstName}, {date}, {reasonText}). */
  statusText: string;
  ball: 'csapat' | 'konyvelo' | 'ugyfel' | null;
  callbackId: string | null;
  createdAt: ISODateTime;
  /** The UJEGYKE our accountant filed and its approval window (shown due = filing date + 3 days; NAV deletes after 4). */
  approval: {
    filedAt: ISODateTime;
    dueOn: ISODate;
    /** "november 22-ig" */
    dueText: string;
    daysLeft: number;
    lastDay: boolean;
    /** 11-19 javítás: the day(s) after the shown due day – NAV's real 4 × 24 h are not over yet ("Ma még jóváhagyhatod"). */
    afterDue?: boolean;
    /** How many times NAV deleted an unapproved filing (re-filed since). */
    expiredCount: number;
  } | null;
  clientApprovedAt: ISODateTime | null;
  meghatalmazasLiveAt: ISODateTime | null;
  /** EV only: the client's final OK; `valid` false once the questionnaire changed after it. */
  consent: { at: ISODateTime; valid: boolean } | null;
  /** EV only: the final-review screen can be sent now (questionnaire complete, status allows). */
  canConsent: boolean;
  evFiledAt: ISODateTime | null;
  canCancel: boolean;
  closedReason: AssistCloseReason | null;
  closedAt: ISODateTime | null;
}
/** POST /client/assist – creates (or links) the callback with topic ASSIST_CALLBACK_TOPIC[kind]. */
export interface AssistCreateInput {
  kind: AssistKind;
  source: CallbackSource;
  /** As CallbackCreateInput: omit to use the profile phone. */
  phone?: string;
  window?: CallbackWindow;
  note?: string;
  savePhoneToProfile?: boolean;
}
export interface AssistCreateResult {
  assist: AssistView;
  callback: CallbackView;
}
/** GET /client/assist/:id/consent – the final review (EV only). */
export interface AssistConsentSummary {
  /** jogi `ev_bejelentes_utasitas` version. */
  version: string;
  /** sha256 (hex) of the canonical JSON of `blocks` + version; sent back with the consent. */
  hash: string;
  blocks: { key: string; title: string; lines: string[]; editRoute: string | null }[];
  declarationText: string;
  instructionText: string;
  publicNote: string;
  /** Field ids still missing; when not empty `canConsent` is false and the app links to the questionnaire. */
  missing: string[];
  canConsent: boolean;
}
/** POST /client/assist/:id/consent */
export interface AssistConsentInput {
  hash: string;
  declaration: true;
  instruction: true;
}
/** POST /client/assist/:id/cancel */
export interface AssistCancelInput {
  note?: string;
}
/** POST /client/business-registration/chamber */
export interface ChamberDoneInput {
  done: boolean;
}

// ---------- §27.6 assisted path (panel: csapat, admin, the client's accountant) ----------
export interface TeamAssistRow {
  id: string;
  client: { id: string; name: string; lifecycle: ClientLifecycle };
  kind: AssistKind;
  status: AssistStatus;
  ball: 'csapat' | 'konyvelo' | 'ugyfel' | null;
  statusSince: ISODateTime;
  daysInStatus: number;
  /** The next deadline on this item: callback due, client approval due, our 1-working-day target. */
  nextDue: { at: ISODateTime; what: string; overdue: boolean } | null;
  approvalDueOn: ISODate | null;
  callbackId: string | null;
  registrationId: string | null;
  accountant: { id: string; userId: string; name: string } | null;
  assignee: StaffRef | null;
  createdAt: ISODateTime;
}
export interface TeamAssistChecklistItem {
  item: AssistCheckItem;
  label: string;
  done: boolean;
  doneAt: ISODateTime | null;
  by: StaffRef | null;
}
export interface TeamAssistDetail extends TeamAssistRow {
  clientCard: TeamClientCard;
  /**
   * 11-19 javítás: the UJEGYKE may be filed only when the client accepted the contract and gave his name and adóazonosító
   * jel. While false, 'ujegyke_bekuldve' is not among `allowedActions` and `notReadyReasons` says what the client still owes.
   */
  readyForUjegyke?: boolean;
  notReadyReasons?: string[];
  checklist: { phase: AssistCheckPhase; title: string; items: TeamAssistChecklistItem[] }[];
  /**
   * What our accountant types into UJEGYKE (Képviselt) and checks in the Ügysegéd. `adoazonositoJel` is the full value
   * only for the client's own accountant and admins (audited 'assist.data_viewed'); csapat gets null + masked.
   */
  filingData: {
    name: string;
    adoazonositoJel: string | null;
    adoazonositoJelMasked: string;
    jogcim: AssistJogcim;
    ugycsoportok: string[];
  } | null;
  /** EV only: what the client approved (frozen copy) and whether the questionnaire still matches it. */
  consentSnapshot: { at: ISODateTime; hash: string; version: string; blocks: { title: string; lines: string[] }[] } | null;
  answersMatchConsent: boolean | null;
  timeline: { at: ISODateTime; by: StaffRef | null; action: string; text: string }[];
  /** Actions the CURRENT user may do now (role + status). Disabled buttons explain why in the panel. */
  allowedActions: AssistAction[];
  staffNote: string | null;
}
/** POST /team/assists/:id/agreed – the call happened and the client wants it (all 'hivas' items). */
export interface AssistAgreedInput {
  items: AssistCheckItem[];
  note?: string;
}
/** POST /team/assists/:id/ujegyke-filed (the client's accountant / admin; all 'ujegyke' items). */
export interface AssistUjegykeFiledInput {
  items: AssistCheckItem[];
  jogcim: AssistJogcim;
  /** Default now; may be up to 24 h in the past. */
  filedAt?: ISODateTime;
}
/** POST /team/assists/:id/ev-filed – multipart `file` (the NAV értesítés PDF/image) + these fields (all 'bejelentes' items). */
export interface AssistEvFiledInput {
  items: AssistCheckItem[];
  filedOn: ISODate;
  adoszam?: string;
  evNyilvantartasiSzam?: string;
}
/** POST /team/assists/:id/close */
export interface AssistCloseInput {
  reason: AssistCloseReason;
  note?: string;
}
/** PATCH /team/assists/:id */
export interface AssistStaffPatch {
  staffNote?: string | null;
  /** Tick or untick single items without moving the status (autosave of the check list). */
  check?: { item: AssistCheckItem; done: boolean }[];
}
