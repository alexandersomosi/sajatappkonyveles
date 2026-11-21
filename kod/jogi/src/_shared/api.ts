// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
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
  TaxPeriodKind,
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
  // SPEC §28
  AllowanceGate,
  AllowanceKind,
  AllowanceRejectReason,
  AllowanceStatus,
  AnyakJogcim,
  ChangeActivityMode,
  ChangeKind,
  ChangeTaxItem,
  EarningsBasis,
  ReserveEstimateReason,
  ReserveZone,
  // SPEC §28.K
  AnnualCheckItem,
  AnnualHipaPlace,
  AnnualStatus,
  BusinessIdentitySource,
  CalculatorSide,
  CheckinHow,
  CheckinItem,
  CheckinItemStatus,
  CheckinStatus,
  CheckinWeeklyHours,
  DocumentStatusTab,
  EmployerAnswer,
  EmployerDecision,
  EmployerSource,
  FeeChargeStatus,
  FeeKind,
  FeeUnit,
  MailboxRejectReason,
  MailboxStatus,
  OtherIncomeKind,
  PauseSource,
  PayerKind,
  PlanCode,
  ServiceLockReason,
  TaxRegime,
  TaxRegimeAnswer,
  TaxpayerLookupStatus,
  YesNoDontKnow,
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
  /** SPEC §29.14: the provider of NEW card flows and its mode ('test' | 'live' | 'demo' | 'sandbox' | null). */
  paymentProvider?: 'stripe' | 'simplepay' | 'demo' | 'disabled';
  paymentMode?: 'test' | 'live' | 'demo' | 'sandbox' | null;
  simplepayEnabled?: boolean;
  /** k8: a NEW client may choose the bank transfer (switch kapcsolok.fizetes.atutalas; DEMO ON, production OFF until the ÁSZF). */
  fizetes?: { atutalas: boolean };
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
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string };
  platform: 'web' | 'android' | 'ios';
  /** SPEC §28.K.8: where the visitor came from (`?forras=kalkulator`) and whether he asked for a callback (`?cel=visszahivas`). */
  entry?: { forras?: string; cel?: 'visszahivas' };
  /** SPEC §31.3: the referring domain and the landing path the landing passed on (`?hivatkozo=…&erkezes=…`). */
  forras?: { hivatkozo?: string; erkezes?: string };
  /** SPEC §31.6: the landing's ad-consent decision id + click ids – the server uses them ONLY with ad measurement on. */
  hirdetes?: { hid?: string; gclid?: string; gbraid?: string; wbraid?: string; fbclid?: string };
}
/**
 * k7b (SPEC §27.11 S16): POST /auth/register answers 202 with this – the same for a new and an existing address, and
 * without a session. The 6-digit code from the mail opens the session: POST /auth/register/verify (RegisterVerifyInput)
 * → AuthResult; a new code: POST /auth/register/resend { email } → 202 RegisterPending.
 */
export interface RegisterPending {
  status: 'check_email';
  email: string;
}
export interface RegisterVerifyInput {
  email: string;
  code: string;
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
  /** SPEC §28.K.11 (default 'atalany'). */
  taxRegime?: TaxRegime;
  /** SPEC §28.K.5: set while the accounting service is locked for an unpaid fee. */
  serviceLock?: ServiceLockView | null;
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
  /** SPEC §28.2.3: per-user quiet hours + amounts in push (defaults QUIET_HOURS_DEFAULT, true). */
  notificationSettings?: NotificationSettings;
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
  /** SPEC §28.K.7: the employees / EFO answer and the accountant's decision. */
  employer?: EmployerStatusView | null;
  /** SPEC §28.K.9: how the business data came in; adoszamPending = "Most nem tudom" (the accountant fills it later). */
  businessIdentity?: { source: BusinessIdentitySource; adoszamPending: boolean } | null;
  /** SPEC §28.K.11: "Hogyan adózol most?" */
  taxRegimeAnswer?: TaxRegimeAnswer | null;
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
  /** SPEC §28.K.9: true = "Most nem tudom" – `adoszam` may be '' and the accountant fills it from ONYA later. */
  adoszamPending?: boolean;
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
  /** SPEC §28.K.11 */
  taxRegime?: TaxRegime;
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
  /** k6c2: an estimate of the RUNNING quarter that already holds the fixed járulék of these future months (e.g. [12]). */
  futureFixedMonths?: number[];
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
  /** SPEC §32: + 'kata' (one KATA month). */
  kind: TaxPeriodKind;
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
  /** SPEC §32 (+): the payment sheet /fizetes/[id] – a free KATA month carries its reason ("táppénz"). */
  exemptReasonLabel?: string | null;
  /** SPEC §32 (+): "Kata – november" style title of the sheet (server-built). */
  sheetTitle?: string;
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
  /** SPEC §28.K.12: the collapsed group row ("2026. 4. negyedév", KATA: the month; annual items: their own key). */
  group?: { key: string; label: string };
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
  /** SPEC §28.1.4 (null-free: absent while restricted or without profile). */
  reserve?: InvoiceReserveView;
  /** SPEC §28.K.11: from NAV customerVatStatus; KATA clients get the business-customer warning. */
  payerKind?: PayerKind | null;
  kataWarning?: string | null;
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
    /** afterText (k6c): the line under "Az adómentes részt … elérted." when an approved allowance changes it (null = the default). */
    adomentes: { reached: boolean; reachedMonth: number | null; limitHuf: number; sentence: string; afterText?: string | null };
    /** k6c: a KATA client – the átalány lines (adómentes rész, átalány határ) are not shown. */
    kata?: boolean;
  };
  revenueByMonth: { month: number; amountHuf: number }[];
  currentDossier: { month: MonthKey; label: string; items: DocumentListItem[]; totalCount: number };
  nextDeadline: Deadline | null;
  /** Shown as a home banner when the service is ending or ended (cancelled subscription, cancelled deletion). */
  serviceNotice?: { kind: 'megszunik' | 'megszunt' | 'felmondva'; endsOn: ISODate | null; canResume: boolean; letterDocumentId?: string | null };
  // SPEC §28 (null while restricted or without profile)
  reserve?: ReserveCard | null;
  earnings?: EarningsCard | null;
  allowancesHint?: { show: boolean } | null;
  // SPEC §28.K (all optional; §28.K.12)
  twoNumbers?: TwoNumbersView | null;
  paymentCard?: PaymentCardView | null;
  checkin?: CheckinView | null;
  annual?: AnnualView | null;
  /** Javító kör 11-21: an önellenőrzés waiting for the client's approval (the Főoldal card; any time of the year). */
  openCorrection?: { id: string; title: string; statusText: string } | null;
  lock?: ServiceLockView | null;
  pause?: PauseView | null;
  kata?: KataHomeView | null;
  /** k7c2 (SPEC §28.K.11): a KATA client's invoices to a business customer – the KATA may end (newest first, max 3). */
  kataRisk?: KataRiskItem[];
}

/** k7c2 (SPEC §28.K.11): the business-customer warning of one invoice of a KATA client (texts filled by the server). */
export interface KataRiskItem {
  navInvoiceId: string;
  invoiceNumber: string;
  vevo: string;
  amountHuf: number;
  payerKind: 'kifizeto' | 'kulfoldi_kifizeto' | 'ismeretlen';
  /** The money arrived (received_on ≤ today, not estimated): the KATA ends the day before. */
  receivedOn: ISODate | null;
  endsOn: ISODate | null;
  reportBy: ISODate | null;
  title: string;
  text: string;
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
  /** SPEC §28.K: plan, the amount of the next charge (availability fee while paused), DEMO price mark. */
  planCode?: PlanCode;
  nextChargeAmountHuf?: number;
  pause?: PauseView | null;
  priceDemo?: boolean;
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
  /** SPEC §28.K.1: what it was for (absent = the monthly fee). */
  feeKind?: FeeKind;
  label?: string;
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
  /** SPEC §28.3.6 / §28.K: badges and chips of the client list. */
  allowancesPending?: number;
  taxRegime?: TaxRegime;
  serviceLocked?: boolean;
  annualWaiting?: boolean;
  checkinOpenItems?: number;
  adoszamPending?: boolean;
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
  /** SPEC §28.K.11: "Hogyan szeretnél adózni?" (drives the KATA variant of the guide, §28.K.13). */
  taxRegime?: TaxRegimeAnswer;
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
  /** SPEC §28.K.11 (optional for rows saved before §28.K; null = not answered → the átalány variant of the guide). */
  taxRegime?: TaxRegimeAnswer | null;
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
  /** SPEC §31.3: where this request came from (a campaign link on the web); omitted = the registration's source. */
  marketing?: { utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }; hivatkozo?: string; erkezes?: string };
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
  /** SPEC §28.5.5: change kinds only – the data to file. */
  change?: ChangeData | null;
  /** SPEC §28.5.6: a free-text activity still waits for its ÖVTJ line. */
  activityPending?: boolean;
  /** SPEC §28.K.1: the prepaid fee of an assisted change (status 'dijra_var' until paid). */
  feeCharge?: FeeChargeView | null;
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
  /** SPEC §28.5.5: change kinds – the change data; `callback` true = "Hívjatok fel előtte" (forced for CHANGE_TAX_ITEMS_CALL_FIRST). */
  change?: ChangeData;
  callback?: boolean;
}
export interface AssistCreateResult {
  assist: AssistView;
  /** SPEC §28.5.5: null for a change request without a callback. */
  callback: CallbackView | null;
  /** SPEC §28.K.1: the fee to pay before the team acts (null = no fee). */
  feeCharge?: FeeChargeView | null;
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
  /** SPEC §28.5.5: change kinds. */
  change?: ChangeData | null;
  followups?: ChangeFollowupView[];
  feeCharge?: FeeChargeView | null;
  /** SPEC §28.K.5: the client's service is locked – filing actions are disabled. */
  serviceLocked?: boolean;
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

// =====================================================================================================================
// SPEC §28 – "Öt új funkció" 11-19 (félretenni, new-invoice notification, allowances, "Mennyit kerestem?", change guides)
// =====================================================================================================================

// ---------- §28.1 "Ennyit tegyél félre" ----------
export interface InvoiceReserveView {
  year: number;
  reserveHuf: number;
  rawHuf: number;
  parts: { szjaHuf: number; tbHuf: number; szochoHuf: number };
  zone: ReserveZone;
  crossesTaxFree: boolean;
  estimated: boolean;
  nextYear: boolean;
  /** "120 000 Ft-os számla – ebből kb. 31 000 Ft-ot tegyél félre." */
  line: string;
  /** The invoice list sub-line (RESERVE_TEXTS.lista); null for nincs_adat. */
  listLine: string | null;
  /** "SZJA, TB-járulék, szocho" */
  partsText: string | null;
  /** The crossesTaxFree sentence. */
  thresholdText: string | null;
  /** k6c2: the "Miért ennyi?" sheet, built for this client's status and zone (rows without zero parts, signed total, bullets). */
  miert?: { rows: string[]; total: string; bullets: string[] } | null;
}
export interface ReserveCard {
  year: number;
  /** max(0, A − B), rounded up to 1 000. */
  keepNowHuf: number;
  /** A */
  accruedHuf: number;
  /** Σ reserveHuf of the items received ≤ today. */
  invoicesHuf: number;
  /** Σ fixedByMonth of the months ≤ the current month. */
  fixedHuf: number;
  /** The current month's fixed amount (0 = the row is not shown). */
  fixedMonthlyHuf: number;
  /** HIPA elapsed share. */
  hipaHuf: number;
  hipaAnnualHuf: number | null;
  /** B */
  dueOrPaidHuf: number;
  nextDue: { dueDate: ISODate; label: string } | null;
  estimateReasons: { code: ReserveEstimateReason; text: string }[];
  sentence: string;
  detail: string;
  footnote: string;
  /** SPEC §28.K.12 item 3: what the client says he already put aside (self-reported) and the ring. */
  markedHuf?: number | null;
  ring?: { ratio: number; remainingHuf: number; line: string } | null;
  /** Round 2 of 11-19: what comes back in the annual return (overpaid SZJA advances, year-end csjk); 0 = none. */
  refundHuf?: number;
  refundText?: string | null;
  /** k6c: Főoldal only – how the card relates to the blue band's quarter amount (null = nothing to say). */
  heroNote?: string | null;
  /** k6c2: the sub-line of the "Az idei számláid után" row (e.g. rounding up per invoice). */
  invoicesSub?: string | null;
  /** k6c2: when the approved quarters differ from today's calculation (e.g. an allowance approved later), the part of A
   *  the per-invoice list cannot show – so the rows add up to the "eddig" amount. */
  extraRow?: { label: string; sub: string; huf: number } | null;
}
export interface ReserveListItem {
  revenueItemId: string;
  navInvoiceId: string | null;
  title: string;
  sub: string;
  receivedOn: ISODate;
  amountHuf: number;
  reserve: InvoiceReserveView;
  /** Round 2 of 11-19: the money is expected later (receivedOn after today) – not yet in the card's or the month's sum. */
  upcoming?: boolean;
  upcomingText?: string | null;
}
export interface ReserveView {
  card: ReserveCard;
  /** reserveHuf: Σ positive reserves of the items received so far (the upcoming ones are left out); upcomingCount: those left out. */
  months: { month: number; label: string; items: ReserveListItem[]; reserveHuf?: number; upcomingCount?: number; sub?: string }[];
  /** k6c2: "Az idei számláid után összesen kb. X Ft" – the same number as the Főoldal row. */
  totalText?: string;
}

// ---------- §28.2 notification settings ----------
export interface NotificationSettings {
  quietEnabled: boolean;
  /** 0–23, Budapest time; [from, to) wraps midnight when from > to. */
  quietFrom: number;
  quietTo: number;
  pushShowAmounts: boolean;
}
/** PATCH /me { notificationSettings } */
export type NotificationSettingsPatch = Partial<NotificationSettings>;

// ---------- §28.3 allowances ----------
export interface AllowanceChildAnswer {
  /** családi pótlék now / ≥ 12 years in the past / ended by the child's death / no */
  potlek: 'most' | 'tizenket_ev' | 'elhunyt' | 'nem';
  /** own or adopted (mothers' allowances) */
  sajat: boolean;
  /** health flag (needs healthConsent) */
  tartosBeteg: boolean;
  /** alternating care (50 %) */
  felvaltva: boolean;
  /** 'YYYY-MM' if it started this year (birth, adoption) */
  potlekKezdeteHo: MonthKey | null;
  /** 'YYYY-MM' if it ends this year (school finished) */
  potlekVegeHo: MonthKey | null;
}
export interface AllowanceAnswers {
  /** 'YYYY-MM' */
  birthMonth: MonthKey | null;
  /** 0..12 */
  children: AllowanceChildAnswer[];
  /** eltartott but not kedvezményezett, 0..9 */
  otherDependants: number;
  /** expected birth 'YYYY-MM' */
  pregnancy: { dueMonth: MonthKey } | null;
  mother: boolean | null;
  csaladiWho: 'en' | 'par' | 'kozosen' | null;
  /** 10..90 when 'kozosen' */
  csaladiSharePct: number | null;
  csjkWish: 'igen' | 'konyvelo_donti' | null;
  marriage: { month: MonthKey; first: boolean; who: 'en' | 'par' | 'kozosen' } | null;
  disability: { fromMonth: MonthKey | null; basis: 'orvosi_igazolas' | 'rokkantsagi_jaradek' | 'fogyatekossagi_tamogatas' } | null;
  /** táppénz / CSED / GYED */
  benefit: { fromMonth: MonthKey; toMonth: MonthKey | null } | null;
  healthConsent: boolean;
  /** ≤ 500, for the accountant */
  note: string | null;
}
export interface CsaladiMonthParam {
  month: number;
  eltartott: number;
  children: { felvaltva: boolean; tartosBeteg: boolean }[];
  sharePct: number;
}
export interface AllowanceParams {
  anyakJogcim?: AnyakJogcim;
  elsoHazasokMonthlyHuf?: number;
  csaladi?: CsaladiMonthParam[];
  csjkInYear?: boolean;
}
export interface AllowanceItemView {
  kind: AllowanceKind;
  label: string;
  line: string;
  status: AllowanceStatus;
  statusText: string;
  months: number[];
  /** "január–december", "július–december" */
  monthsText: string;
  inYear: boolean;
  /** Approved only: SZJA + csjk saved this year (estimate). */
  effectYearHuf: number | null;
  question: string | null;
  rejectText: string | null;
}
export interface AllowanceState {
  year: number;
  gate: AllowanceGate | null;
  answers: AllowanceAnswers | null;
  version: number;
  submittedAt: ISODateTime | null;
  items: AllowanceItemView[];
  pendingCount: number;
  savedYtdHuf: number | null;
  savedYearHuf: number | null;
  documentsToKeep: string[];
  canEdit: boolean;
  /** SPEC §28.K.11: KATA clients get no questionnaire (the gate sheet says why). */
  notForRegime?: boolean;
}
/** PUT /client/allowances/answers (`submit: false` = draft, `true` = submit + proposal + notify). */
export interface AllowanceAnswersInput {
  year: number;
  answers: AllowanceAnswers;
  submit: boolean;
}
export interface AllowanceGateInput {
  year: number;
  gate: AllowanceGate;
}
/** POST /client/allowances/preview (K12 estimate; never stored). */
export interface AllowanceClientPreviewInput {
  year: number;
  answers: AllowanceAnswers;
}
export interface AllowanceClientPreview {
  /** k6c2: effectYearHuf is the kind's MARGINAL share (29/H order); covered = another allowance already uses its base; line = its one-line meaning. */
  items: { kind: AllowanceKind; label: string; effectYearHuf: number | null; onlyAnnual: boolean; line?: string; covered?: boolean }[];
}
// staff
export interface AccAllowanceItem extends AllowanceItemView {
  params: AllowanceParams;
  paramsPrev: AllowanceParams | null;
  proposal: { months: number[]; params: AllowanceParams; reasons: string[] };
  decidedBy: string | null;
  decidedAt: ISODateTime | null;
  staffNote: string | null;
  warnings: string[];
  documents: { label: string; keep: boolean }[];
}
export interface AccAllowanceView {
  year: number;
  answers: AllowanceAnswers | null;
  version: number;
  submittedAt: ISODateTime | null;
  healthConsentAt: ISODateTime | null;
  legacy: { kind: string; note?: string }[];
  items: AccAllowanceItem[];
}
export interface AllowanceDecisionInput {
  status: 'jovahagyva' | 'kerdes' | 'elutasitva';
  months?: number[];
  params?: AllowanceParams;
  inYear?: boolean;
  reason?: AllowanceRejectReason;
  clientText?: string;
  staffNote?: string;
}
export interface AllowancePreviewInput {
  year: number;
  decisions: { kind: AllowanceKind; months: number[]; params?: AllowanceParams; inYear: boolean }[];
}
export interface AllowancePreview {
  without: { szjaHuf: number; tbHuf: number; szochoHuf: number };
  with: { szjaHuf: number; tbHuf: number; szochoHuf: number };
  savedHuf: number;
  byKind: { kind: AllowanceKind; szjaSavedHuf: number; csjkHuf: number }[];
  csaladiUnusedHuf: number;
  annualCsjkPotentialHuf: number;
  warnings: string[];
}

// ---------- §28.4 "Mennyit kerestem?" ----------
export interface EarningsMonthView {
  month: number;
  label: string;
  revenueHuf: number;
  taxesHuf: number;
  parts: { szjaHuf: number; tbHuf: number; szochoHuf: number; hipaHuf: number };
  netHuf: number;
  basis: EarningsBasis;
  note: string | null;
}
export interface EarningsView {
  year: number;
  /** 1..current month */
  months: EarningsMonthView[];
  ytd: { revenueHuf: number; taxesHuf: number; netHuf: number };
  projection: { reliable: boolean; revenueHuf: number | null; taxesHuf: number | null; netHuf: number | null; text: string };
  line: string;
  disclaimer: string;
  /** Round 2 of 11-19: comes back in the annual return (already counted in ytd: taxes lower, net higher than the month rows). */
  refund?: { huf: number; text: string } | null;
}
export interface EarningsCard {
  ytdNetHuf: number;
  ytdRevenueHuf: number;
  ytdTaxesHuf: number;
  sentence: string;
  sub: string;
  projectionText: string | null;
  refundText?: string | null;
}

// ---------- §28.5 changes ----------
export interface NavAddress {
  zip: string;
  city: string;
  district?: string | null;
  streetName: string;
  streetType: string;
  houseNumber: string;
  building?: string | null;
  staircase?: string | null;
  floor?: string | null;
  door?: string | null;
}
export type ChangeData =
  | { kind: 'valtozas_szekhely'; address: NavAddress; effectiveOn: ISODate; right: SeatRight; provider?: { name: string; adoszam: string } | null; alsoHomeAddress: boolean }
  | { kind: 'valtozas_telephely'; address: NavAddress; effectiveOn: ISODate; right: SeatRight; label?: string | null }
  | { kind: 'valtozas_tevekenyseg'; mode: ChangeActivityMode; activities: BusinessActivityChoice[]; ownWords?: string | null; keepOldMain: boolean; effectiveOn: ISODate }
  | { kind: 'valtozas_szuneteltetes'; from: ISODate; to: ISODate | null }
  | { kind: 'valtozas_adoadat'; items: ChangeTaxItem[]; workKind?: WorkKind | null; effectiveOn: ISODate; note?: string | null }
  /** SPEC §28.K.6: resumption after szüneteltetés (≥ today, ≤ today + 60 days). */
  | { kind: 'valtozas_folytatas'; from: ISODate };
/** GET /client/change-guides */
export interface ChangeGuidesView {
  items: { kind: ChangeKind; title: string; line: string; icon: Icon3dAny; outdated: boolean; openAssist: AssistView | null }[];
}
/** PUT /client/assist/:id/change (allowed until 'bejelentes_bekuldve'; invalidates the consent). */
export interface AssistChangeUpdateInput {
  change: ChangeData;
}
/** POST /team/assists/:id/change-done */
export interface ChangeDoneInput {
  followups?: string[];
}
/** PATCH /team/assists/:id/followups */
export interface ChangeFollowupPatch {
  key: string;
  done: boolean;
}
export interface ChangeFollowupView {
  key: string;
  label: string;
  done: boolean;
  doneAt: ISODateTime | null;
  by: StaffRef | null;
}
/**
 * Extra fields of the panel's AccClientDetail (`GET /acc/clients/:id`; the base type lives in kod/panel/src/api/types.ts):
 * SPEC §28.1.9, §28.3.6, §28.4.4 and §28.K.
 */
export interface AccClientDetailK28 {
  allowancesPending?: number;
  reserve?: ReserveCard | null;
  earnings?: EarningsCard | null;
  taxRegime?: TaxRegime;
  kata?: KataHomeView | null;
  serviceLock?: ServiceLockView | null;
  pause?: PauseView | null;
  employer?: EmployerStatusView | null;
  annual?: AnnualView | null;
  adoszamPending?: boolean;
  checkinOpenItems?: number;
  mailboxAddress?: string | null;
  /** Javító kör 11-21 (kritika 2.1): this year's KATA variant / főfoglalkozás and the next year's mode (the December card). */
  kataVariant?: 'regi' | 'uj' | null;
  kataFofoglalkozasu?: boolean | null;
  nextYearRegime?: NextYearRegimeView | null;
}
/** The next year's mode as the accountant recorded it in December (null fields: not decided yet). */
export interface NextYearRegimeView {
  year: number;
  /** The card shows from this day (MM-DD of the current year). */
  showFrom: ISODate;
  /** The profile of the next year exists (recorded in advance, or made on 1 January). */
  recorded: boolean;
  regime: TaxRegime | null;
  kataVariant: 'regi' | 'uj' | null;
  kataFofoglalkozasu: boolean | null;
  decidedAt: ISODateTime | null;
  filedOn: ISODate | null;
  filedBy: 'konyvelo' | 'ugyfel' | 'nem_kell' | null;
  note: string | null;
  /** The new KATA (T/928) is not law yet: the switch kata2027 is off. */
  newKataDraft: boolean;
}
/** POST /acc/clients/:id/next-year-regime */
export interface NextYearRegimeInput {
  year: number;
  regime: TaxRegime;
  kataVariant?: 'regi' | 'uj';
  kataFofoglalkozasu?: boolean | null;
  filedOn?: ISODate | null;
  filedBy?: 'konyvelo' | 'ugyfel' | 'nem_kell' | null;
  note?: string | null;
}

// =====================================================================================================================
// SPEC §28.K – owner orders 11-19 afternoon–evening (fees, check-in, annual closing, lock, pause, EFO, calculator,
// adószám lookup, KATA, Accountable patterns, mailbox)
// =====================================================================================================================

// ---------- §28.K.1 fees ----------
export interface FeeChargeView {
  id: string;
  kind: FeeKind;
  label: string;
  amountHuf: number;
  /** true while the fee setting is unconfirmed (amber DEMO chip). */
  demo: boolean;
  status: FeeChargeStatus;
  statusText: string;
  /** SPEC §29.1.2: widened (FeePurposeK29 in k29.ts). */
  purpose:
    | { type: 'valtozas'; assistId: string }
    | { type: 'eves_zaras'; annualId: string }
    | { type: 'igazolas'; requestId: string }
    | { type: 'megszuntetes'; assistId: string }
    | { type: 'admin'; note: string };
  dueOn: ISODate | null;
  createdAt: ISODateTime;
  paidAt: ISODateTime | null;
  feeInvoice: FeeInvoiceItem | null;
  canPay: boolean;
}
/** GET /client/fees */
export interface FeesView {
  table: { kind: FeeKind; label: string; amountHuf: number; unit: FeeUnit; demo: boolean; line: string }[];
  inPlan: string;
  open: FeeChargeView[];
  paid: FeeChargeView[];
  invoices: FeeInvoiceItem[];
}
/** POST /client/fees/:id/pay */
export interface FeePayInput {
  platform: 'web' | 'android' | 'ios';
}
export interface FeePayStart {
  paymentUrl: string;
  orderRef: string;
  chargeId: string;
  amountHuf: number;
  demo: boolean;
}
/** GET/PUT /admin/fees (AD) */
export interface FeeSettingView {
  kind: FeeKind;
  label: string;
  amountHuf: number;
  unit: FeeUnit;
  confirmed: boolean;
  confirmedAt: ISODateTime | null;
  confirmedBy: StaffRef | null;
  effectiveFrom: ISODate | null;
  /** Running subscriptions whose card registration (maxAmount) would not cover a raised amount. */
  cardLimitAffected?: number;
  history: { amountHuf: number; confirmed: boolean; changedBy: StaffRef | null; changedAt: ISODateTime; note: string | null }[];
}
export interface FeeSettingUpdateInput {
  kind: FeeKind;
  amountHuf: number;
  /** Required for a rise of havidij / havidij_kata (≥ today + FEE_RULES.priceRiseNoticeDays). */
  effectiveFrom?: ISODate;
  note?: string;
}
/** POST /admin/fee-charges/:id/waive */
export interface FeeWaiveInput {
  reason: string;
}

// ---------- §28.K.2 A – monthly check-in ----------
export interface CheckinItemView {
  item: CheckinItem;
  question: string;
  /** After the answer: */
  status?: CheckinItemStatus;
  statusText?: string;
  assistId?: string | null;
  feeCharge?: FeeChargeView | null;
  /** The accountant's one-line reason when 'nem_kell'. */
  clientText?: string | null;
}
export interface CheckinView {
  id: string;
  /** 'YYYY-MM' = the month asked about ("október óta"). */
  period: MonthKey;
  periodLabel: string;
  status: CheckinStatus;
  dueOn: ISODate;
  items: CheckinItemView[];
  answeredAt: ISODateTime | null;
}
export interface CheckinItemAnswer {
  item: CheckinItem;
  /** munkaviszony / nyugdij: from when. */
  since?: ISODate;
  weeklyHours?: CheckinWeeklyHours;
  /** koltozes: which change form. */
  choice?: 'szekhely' | 'telephely';
  /** Chosen on the "Hogyan intézzük?" screen (absent = only a question). */
  how?: CheckinHow;
  employer?: EmployerAnswer;
  /** The change form data when the item leads to a change (§28.5.6). */
  change?: ChangeData;
  /** egyeb: ≤ 500 */
  text?: string;
}
/** POST /client/checkins/:id */
export type CheckinAnswerInput = { result: 'nem_valtozott' } | { result: 'valtozott'; answers: CheckinItemAnswer[] };
/** POST /acc/checkin-items/:id */
export interface CheckinItemDecisionInput {
  status: 'nem_kell' | 'kesz' | 'csapatnal';
  /** Required for 'nem_kell' (shown to the client, ≤ 300). */
  clientText?: string;
  staffNote?: string;
  /** One-click effects the accountant applies (never automatic). */
  apply?: ('adoprofil_statusz' | 'szunetel' | 'kedvezmeny_ujranezes' | 'alkalmazott_dontes')[];
}
/** GET /acc/checkin-items?status= (panel queue "Havi változások"). */
export interface TeamCheckinItem {
  id: string;
  checkinId: string;
  client: { id: string; name: string; lifecycle: ClientLifecycle };
  period: MonthKey;
  item: CheckinItem;
  itemLabel: string;
  how: CheckinHow | null;
  status: CheckinItemStatus;
  fee: { kind: FeeKind; amountHuf: number; status: FeeChargeStatus } | null;
  ball: 'csapat' | 'konyvelo' | 'ugyfel' | null;
  since: ISODateTime;
  details: CheckinItemAnswer;
  assistId: string | null;
  staffNote: string | null;
}

// ---------- §28.K.3 B – annual closing ----------
export interface AnnualAnswers {
  otherIncomes: OtherIncomeKind[];
  otherIncomeNote: string | null;
  /** átalány: the approved allowances confirmed (false = "Valami változott"). */
  allowancesOk: boolean | null;
  hipaPlace: AnnualHipaPlace | null;
  hipaOtherTowns: { town: string; days: number }[];
  municipalityLetter: boolean | null;
  onePercent: { civilAdoszam: string | null; egyhazTechnikaiSzam: string | null } | null;
  /** Write-only (stored encrypted); views return refundAccountMasked. */
  refundAccount?: string | null;
  refundAccountMasked?: string | null;
  missingDocuments: boolean | null;
  /** ≤ 1000 */
  message: string | null;
}
export interface AnnualView {
  id: string;
  year: number;
  regime: TaxRegime;
  status: AnnualStatus;
  statusText: string;
  questionnaireDue: ISODate;
  legalDue: { szja: ISODate | null; kata: ISODate | null; hipa: ISODate };
  answers: AnnualAnswers | null;
  feeCharge: FeeChargeView | null;
  /** The draft return (category 'bevallas', visibility 'kozos') while 'jovahagyasra_var'. */
  draft: DocumentListItem | null;
  approval: { at: ISODateTime; hash: string } | null;
  nextAction: 'kitoltes' | 'fizetes' | 'jovahagyas' | null;
  canEdit: boolean;
  /**
   * SPEC §32 (+): the annual-closing fee charged at submit; null = no fee (the switch evesZarasDij is off until the ÁSZF
   * is fixed [T1, JOGI]). Absent (older servers / the app's sample data) = the fee of FEE_DEFAULTS.
   */
  feeHuf?: number | null;
  // ---- SPEC §32.B (éves ciklus F2/F3; all optional, filled by servers from 2026-11-21) ----
  /** The numbers the accountant entered, as the client approves them (null until the accountant saved them). */
  summary?: import('./eves').AnnualSummary | null;
  /** The hash the client sends with "Jóváhagyom" (covers the draft document AND the numbers). */
  approvalHash?: string | null;
  /** After the filing: the difference, its payment period or the refund card. */
  settlement?: import('./eves').AnnualSettlementView | null;
  /** "Mikor mi jön" – the year's to-dos. */
  timeline?: import('./eves').AnnualTimelineItem[];
  /** "Következő: {datum} – {mi}" for the Főoldal card (null when everything is done). */
  timelineNext?: string | null;
  hipa?: import('./eves').AnnualHipaView | null;
  /** Önellenőrzések of the client that are open (approve, pay). */
  corrections?: import('./eves').CorrectionListItem[];
}
/** PUT /client/annual/:id/answers (draft save; every field optional). */
export interface AnnualAnswersInput {
  answers: Partial<AnnualAnswers>;
}
/** POST /client/annual/:id/approve */
export interface AnnualApproveInput {
  hash: string;
}
export interface AccAnnualView extends AnnualView {
  checklist: { item: AnnualCheckItem; label: string; done: boolean; doneAt: ISODateTime | null; by: StaffRef | null }[];
  documents: DocumentListItem[];
  /** The full refund account – the client's accountant and admins only (audited). */
  refundAccount: string | null;
  // ---- SPEC §32.B (staff; optional) ----
  /** The saved amounts (null = not entered yet). */
  amounts?: import('./eves').AnnualAmounts | null;
  /** The app's estimate at the time (the "Motor-összevetés" line). */
  engineEstimate?: { diffHuf: number; szjaHuf: number; advancesHuf: number; byQuarter: { key: string; amountHuf: number; state: 'ellenorizve' | 'jelolve' | 'nincs' }[]; kulonadoHuf?: number; revenueHuf?: number; liableMonths?: number; limitHuf?: number } | null;
  /** The prefill of the amounts form (from the engine and the approved quarters). */
  prefill?: Partial<import('./eves').AnnualAmountsInput> | null;
  /** The panel's warnings ("Előbb egyeztesd a folyószámlát…", "Vegyes év…"). */
  warnings?: string[];
  /** The client's service ended / is suspended: whether the accountant may open the closing by hand (switch lemondottEvesZaras). */
  manualOpen?: { allowed: boolean; reason: string } | null;
  closedManuallyReason?: string | null;
  approvedSummary?: import('./eves').AnnualSummary | null;
}
/** POST /acc/clients/:id/annual/:aid/check */
export interface AnnualCheckInput {
  item: AnnualCheckItem;
  done: boolean;
}

// ---------- §28.K.5 / §28.K.6 lock and pause ----------
export interface ServiceLockView {
  reasons: ServiceLockReason[];
  since: ISODate;
  amountHuf: number;
  /** LOCK_TEXTS.banner filled. */
  text: string;
  /** In-app route of the payment ("/fiok/dijak" or "/fiok/elofizetes"). */
  payRoute: string;
}
export interface PauseView {
  from: ISODate;
  to: ISODate | null;
  source: PauseSource;
  amountHuf: number;
  demo: boolean;
  text: string;
}

// ---------- §28.K.7 F – employees / EFO ----------
export interface EmployerStatusView {
  answer: EmployerAnswer;
  answeredAt: ISODateTime;
  source: EmployerSource;
  decision: EmployerDecision | null;
  clientText: string | null;
  decidedAt: ISODateTime | null;
  /** true while the answer is not 'nincs' and no activation-allowing decision exists (Előfizetés stays locked). */
  blocksActivation: boolean;
}
/** PUT /client/onboarding/employer */
export interface EmployerAnswerInput {
  answer: EmployerAnswer;
}
/** POST /acc/clients/:id/employer */
export interface EmployerDecisionInput {
  decision: EmployerDecision;
  /** Required except 'nincs_teendo' (≤ 500). */
  clientText?: string;
  staffNote?: string;
  /** egyedi_ajanlat: the amount as text (not charged in the app this round). */
  offerAmountText?: string;
}

// ---------- §28.K.8 G – public tax calculator ----------
export interface CalculatorInput {
  year: number;
  revenueHuf: number;
  /** BUSINESS_ACTIVITIES key; null = "Nem találom" (CALCULATOR_RULES.fallbackCostRatio). */
  activityKey: string | null;
  costRatio: CostRatio;
  side: CalculatorSide;
  start: { kind: 'mar_mukodom' } | { kind: 'iden'; month: number };
  allowances?: { under25: boolean; motherOfTwoPlus: boolean; motherUnder30: boolean; children: number };
  kata?: boolean;
}
export interface CalculatorTaxes {
  szjaHuf: number;
  tbHuf: number;
  szochoHuf: number;
  hipaHuf: number;
  totalHuf: number;
}
export interface CalculatorResult {
  year: number;
  activeMonths: number;
  perYear: CalculatorTaxes;
  perQuarter: (CalculatorTaxes & { quarter: 1 | 2 | 3 | 4 })[];
  /** Revenue − taxes (before the real costs). */
  netHuf: number;
  /** ⌈yearly taxes ÷ active months⌉ rounded up to 1 000. */
  monthlyReserveHuf: number;
  afaNote: string;
  starterNote: string | null;
  kata: { monthlyHuf: number; yearHuf: number; limitHuf: number; overLimitHuf: number; kulonadoHuf: number; netHuf: number; monthlyReserveHuf: number } | null;
  warnings: string[];
  rulesVersion: string;
  engineVersion: string;
}

// ---------- §28.K.9 H – auto-fill by adószám ----------
/** POST /client/onboarding/taxpayer-lookup */
export interface TaxpayerLookupInput {
  /** The first 8 digits of the adószám. */
  torzsszam: string;
}
export interface TaxpayerLookupResult {
  status: TaxpayerLookupStatus;
  /** DEMO mock (fictional taxpayers) – the card shows "DEMO – kitalált adatok". */
  demo: boolean;
  name: string | null;
  seat: NavAddress | null;
  selfEmployed: boolean | null;
  /** 9th digit (ÁFA code) and the county code → the full adószám. */
  vatCode: string | null;
  countyCode: string | null;
  adoszam: string | null;
  alanyiMentes: boolean | null;
  /** ÁFA code ≠ ALANYI_MENTES_VAT_CODE: the amber line; the client may continue, the accountant gets a flag. */
  afaWarning: boolean;
  message: string | null;
}
/** POST /client/onboarding/business-identity */
export interface BusinessIdentityInput {
  source: BusinessIdentitySource;
  /** null with source 'kezi' ("Most nem tudom") → ClientProfile.adoszamPending. */
  adoszam: string | null;
  name: string;
  seat: NavAddress;
  alanyiMentes: YesNoDontKnow;
  evSinceMonth?: MonthKey | null;
  activityText?: string;
  activityAnswer?: ActivityAnswer;
  taxRegimeAnswer?: TaxRegimeAnswer;
  taxStatus?: TaxStatus;
}
/** POST /acc/clients/:id/adoszam */
export interface AdoszamStaffInput {
  adoszam: string;
}
/** POST /acc/clients/:id/tax-regime */
export interface TaxRegimeInput {
  regime: TaxRegime;
  kataFrom?: ISODate | null;
  kataTo?: ISODate | null;
  /** SPEC §32 (javító kör 11-21: the panel sends them too). */
  year?: number;
  kataVariant?: 'regi' | 'uj';
  kataFofoglalkozasu?: boolean | null;
}

// ---------- §28.K.11 J – KATA ----------
export interface KataHomeView {
  revenueHuf: number;
  /** The prorated keret (liable months × 1 500 000). */
  limitHuf: number;
  usedPct: number;
  level: 'rendben' | 'figyelem' | 'tullepve';
  liableMonths: number[];
  kulonadoEstimateHuf: number;
  nextPayment: { amountHuf: number; dueDate: ISODate; accountName: string; accountNumber: string; iban: string; reference: string } | null;
  businessInvoices: { navInvoiceId: string; customerName: string | null; amountHuf: number; payerKind: PayerKind; endsOn: ISODate | null; reportBy: ISODate | null }[];
  infoCardSeen: boolean;
  /** SPEC §32 (+): the keret bar with its lines (KATA_F1_TEXTS), filled by the server. */
  meter?: import('./kata').KataMeterView;
  /** SPEC §32 (+): the earliest open KATA month to pay (→ /fizetes/{periodId}), or null. */
  nextPayable?: import('./kata').KataYearView['nextPayable'];
  /** SPEC §32 (+): "Most nincs mit fizetned. A következő kata: …" when nothing is open. */
  nothingToPayLine?: string | null;
  /** SPEC §32 (+): the year's rules are a draft (T/928): the amount is not confirmed. */
  draftNote?: string | null;
}

// ---------- §28.K.12 K – Accountable patterns ----------
export interface TwoNumbersView {
  revenueHuf: number;
  revenueSub: string;
  /** = EarningsCard.ytdTaxesHuf (átalány); KATA: the meter instead. */
  taxesHuf: number | null;
  taxesSub: string | null;
  kata?: { limitHuf: number; usedPct: number; level: 'rendben' | 'figyelem' | 'tullepve' } | null;
}
export interface PaymentCardView {
  /** "Utalj 234 000 Ft-ot november 12-ig" */
  title: string;
  amountHuf: number;
  dueDate: ISODate;
  rows: { paymentItemId: string; label: string; accountName: string; accountNumber: string; iban: string; reference: string; amountHuf: number }[];
  /** "Elutaltam" already tapped. */
  markedPaid: boolean;
}
/** GET/PUT /client/reserve/mark (self-reported, never a bank link) → ReserveCard */
export interface ReserveMarkInput {
  year: number;
  markedHuf: number;
}
export interface DocumentStatusTabCount {
  tab: DocumentStatusTab;
  label: string;
  count: number;
}
/** GET /client/mailbox · POST /client/mailbox/rotate · PUT /client/mailbox/senders */
export interface MailboxView {
  /** null before activation. */
  address: string | null;
  demo: boolean;
  senders: { email: string; primary: boolean }[];
  maxExtraSenders: number;
  limitsText: string;
  log: MailboxLogRow[];
}
export interface MailboxSendersInput {
  /** Extra senders (≤ MAILBOX_RULES.maxExtraSenders); the login e-mail is always accepted. */
  senders: string[];
}
export interface MailboxLogRow {
  id: string;
  receivedAt: ISODateTime;
  /** e.g. "k***@gmail.com" – never the full address. */
  senderMasked: string;
  status: MailboxStatus;
  reason: MailboxRejectReason | null;
  attachments: number;
  documentIds: string[];
}
