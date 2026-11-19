// Every API call the panel makes, in one place (SPEC §12). If the backend differs, fix it here.
import { api, upload, downloadVia } from './client';
import type { AuthResult, Me, NotificationItem, PublicConfig, SessionInfo } from '../_shared/api';
import type {
  AccAppointments,
  AccClientDetail,
  AccClientList,
  AccDocumentDetail,
  AccDossierMonths,
  AccDossierView,
  AccNavInvoiceRow,
  AccRequestRow,
  AccRevenue,
  AccSettings,
  AccTaxPeriods,
  AdminAccountantRow,
  AdminClientRow,
  AdminDashboard,
  AdminPaymentRow,
  AdminSubscriptionRow,
  AttributionRow,
  AuditRow,
  ContentText,
  DeadlineBoard,
  DemoMail,
  DocumentUploadMeta,
  FaqItem,
  InternalNote,
  KycView,
  Message,
  MessageTemplate,
  NavInvoiceDetail,
  NavSyncRun,
  Page,
  ReferralCodeRow,
  RequestSummary,
  RevenueItem,
  SystemStatus,
  TaxProfile,
  CallbackAssignInput,
  CallbackAttemptInput,
  CallbackCloseInput,
  CallbackStaffPatch,
  RegistrationAdoszamStaffInput,
  RegistrationCheckInput,
  TeamCallbackCreateInput,
  TeamCallbackDetail,
  TeamCallbackRow,
  TeamClientCard,
  TeamMemberInvite,
  TeamMemberPatch,
  TeamMemberRow,
  TeamRegistrationDetail,
  TeamRegistrationPatch,
  TeamRegistrationRow,
  TeamSummary,
  TeamThreadRow,
  AssistAgreedInput,
  AssistCloseInput,
  AssistEvFiledInput,
  AssistStaffPatch,
  AssistUjegykeFiledInput,
  TeamAssistDetailP,
  TeamAssistRow,
  TeamPathChangeInput,
} from './types';
import type { AssistKind, CallbackTopic, ClientFilter, DocumentStatus, OnboardingStep, PaymentItemKind, RegistrationStatus, RequestStatus } from '../_shared/enums';

const q = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
const e = encodeURIComponent;

// ---------- system / auth ----------
export const getConfig = () => api.get<PublicConfig>('/config', { noRefresh: true });
export const login = (email: string, password: string) =>
  api.post<AuthResult>('/auth/login', { email, password, clientKind: 'panel' }, { noRefresh: true });
export const loginTotp = (mfaToken: string, code: string) => api.post<AuthResult>('/auth/login/totp', { mfaToken, code }, { noRefresh: true });
export const logout = () => api.post<void>('/auth/logout', undefined, { headers: { 'X-Kezjegy': '1' } });
export const forgotPassword = (email: string) => api.post<void>('/auth/password/forgot', { email }, { noRefresh: true });
export const resetPassword = (email: string, code: string, newPassword: string) =>
  api.post<void>('/auth/password/reset', { email, code, newPassword }, { noRefresh: true });
export const changePassword = (currentPassword: string, newPassword: string) => api.post<void>('/auth/password/change', { currentPassword, newPassword });
// Later than 10 minutes after signing in the server asks for the current password too (403 reauth_required).
export const totpSetup = (currentPassword?: string) => api.post<{ secret: string; otpauthUrl: string }>('/auth/totp/setup', currentPassword ? { currentPassword } : undefined);
export const totpEnable = (code: string, currentPassword?: string) => api.post<{ recoveryCodes: string[] }>('/auth/totp/enable', currentPassword ? { code, currentPassword } : { code });
export const totpDisable = (code: string, password?: string) => api.post<void>('/auth/totp/disable', { code, password });
export const getSessions = () => api.get<{ items: SessionInfo[] } | SessionInfo[]>('/auth/sessions');
export const revokeSession = (id: string) => api.del<void>(`/auth/sessions/${e(id)}`);
export const getMe = () => api.get<Me>('/me');
/** Staff in-panel notifications (SPEC §27.8 "in-panel badge" kinds). */
export const meNotifications = (cursor?: string) => api.get<{ items: NotificationItem[]; nextCursor: string | null; hasUnread: boolean }>(`/me/notifications${q({ cursor })}`);
export const meNotificationsRead = (body: { ids?: string[]; all?: boolean }) => api.post<void>('/me/notifications/read', body);

// ---------- files ----------
export const fileLink = (fileId: string) => api.post<{ url: string; expiresAt: string }>(`/files/${e(fileId)}/link`);
export const downloadFile = (fileId: string, name: string) => downloadVia(`/files/${e(fileId)}`, name);

// ---------- accountant: clients ----------
export const accClients = (filter: ClientFilter, search: string) => api.get<AccClientList>(`/acc/clients${q({ filter, q: search })}`);
export const accClient = (id: string) => api.get<AccClientDetail>(`/acc/clients/${e(id)}`);
/** "Mutasd": the full adóazonosító jel, audited on the server (client.adoazonosito_viewed). */
export const accRevealTaxId = (id: string) => api.post<{ adoazonositoJel: string }>(`/acc/clients/${e(id)}/adoazonosito/reveal`, {});
export const accPatchTaxProfile = (id: string, body: Partial<TaxProfile> & { year: number; activityCode?: string | null }) =>
  api.patch<unknown>(`/acc/clients/${e(id)}/tax-profile`, body);
export const accOnboardingStep = (id: string, step: OnboardingStep, status: 'kesz' | 'hianyos' | 'kihagyva', note?: string) =>
  api.post<unknown>(`/acc/clients/${e(id)}/onboarding/${e(step)}`, { status, note });
export const accKyc = (id: string) => api.get<KycView>(`/acc/clients/${e(id)}/kyc`);
export const accKycReview = (id: string, status: 'elfogadva' | 'hianyos', note?: string) =>
  api.post<unknown>(`/acc/clients/${e(id)}/kyc/review`, { status, note });
export const accNavSave = (id: string, body: { login: string; password: string; signatureKey: string; exchangeKey?: string; taxNumber: string }) =>
  api.put<{ status: string; loginHint: string; savedAt: string }>(`/acc/clients/${e(id)}/nav-credentials`, body);
export const accNavDelete = (id: string) => api.del<void>(`/acc/clients/${e(id)}/nav-credentials`);
export const accNavTest = (id: string) => api.post<{ ok: boolean; messageHu: string }>(`/acc/clients/${e(id)}/nav-credentials/test`);
export const accNavSync = (id: string) => api.post<{ runId: string }>(`/acc/clients/${e(id)}/nav-sync`);
export const accNavSyncRuns = (id: string) => api.get<{ items: NavSyncRun[] }>(`/acc/clients/${e(id)}/nav-sync-runs`);

// dossier + documents
export const accDossierMonths = (id: string, year: number) => api.get<AccDossierMonths>(`/acc/clients/${e(id)}/dossiers${q({ year })}`);
export const accDossier = (id: string, month: string) => api.get<AccDossierView>(`/acc/clients/${e(id)}/dossiers/${e(month)}`);
export const accDocument = (docId: string) => api.get<AccDocumentDetail>(`/acc/documents/${e(docId)}`);
export const accUploadDocument = (clientId: string, files: File[], meta: DocumentUploadMeta, onProgress?: (f: number) => void) => {
  const form = new FormData();
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (files.length > 1 && images.length === files.length) for (const f of files) form.append('pages[]', f, f.name);
  else form.append('file', files[0]!, files[0]!.name);
  form.append('category', meta.category);
  form.append('dossierMonth', meta.dossierMonth);
  form.append('title', meta.title);
  form.append('visibility', meta.visibility);
  if (meta.status) form.append('status', meta.status);
  return upload<AccDocumentDetail>(`/acc/clients/${e(clientId)}/documents`, form, onProgress);
};
export const accPatchDocument = (
  docId: string,
  body: Partial<{ status: DocumentStatus; statusNote: string; title: string; category: string; dossierMonth: string; amountHuf: number | null; documentDate: string | null; accountantComment: string; visibility: string }>,
) => api.patch<AccDocumentDetail>(`/acc/documents/${e(docId)}`, body);
export const accBulkDocumentStatus = (ids: string[], status: DocumentStatus, note?: string) => api.post<unknown>('/acc/documents/bulk-status', { ids, status, note });
export const accNavInvoicesBulk = (clientId: string, month: string, status: DocumentStatus) =>
  api.post<unknown>(`/acc/clients/${e(clientId)}/nav-invoices/bulk-status`, { month, status });

// NAV invoices + revenue
export const accNavInvoices = (id: string, year: number) => api.get<{ items: AccNavInvoiceRow[] }>(`/acc/clients/${e(id)}/nav-invoices${q({ year })}`);
export const accNavInvoice = (invId: string) => api.get<NavInvoiceDetail>(`/acc/nav-invoices/${e(invId)}`);
export const accRevenue = (id: string, year: number) => api.get<AccRevenue>(`/acc/clients/${e(id)}/revenue${q({ year })}`);
export const accAddRevenue = (
  id: string,
  body: { receivedOn: string; deliveryDate: string; amountHuf: number; description: string; documentId?: string; countsForAtalany?: boolean; countsForAfaLimit?: boolean },
) => api.post<RevenueItem>(`/acc/clients/${e(id)}/revenue-items`, body);
export const accPatchRevenue = (
  itemId: string,
  body: Partial<{ receivedOn: string; deliveryDate: string; amountHuf: number; description: string; countsForAtalany: boolean; countsForAfaLimit: boolean; excludedReason: string | null; receivedOnEstimated: boolean }>,
) => api.patch<RevenueItem>(`/acc/revenue-items/${e(itemId)}`, body);
export const accDeleteRevenue = (itemId: string) => api.del<void>(`/acc/revenue-items/${e(itemId)}`);

// tax
export const accTaxPeriods = (id: string, year: number) => api.get<AccTaxPeriods>(`/acc/clients/${e(id)}/tax-periods${q({ year })}`);
export const accCalculate = (id: string, periodKey: string, asOf?: string) =>
  api.post<unknown>(`/acc/clients/${e(id)}/tax-periods/${e(periodKey)}/calculate`, asOf ? { asOf } : {});
export const accApprove = (calcId: string, body: { letterText: string; overrides?: { tbHuf?: number; szochoHuf?: number; szjaAdvanceHuf?: number; reason: string } }) =>
  api.post<unknown>(`/acc/tax-calculations/${e(calcId)}/approve`, body);
export const accReopen = (periodId: string, reason: string) => api.post<unknown>(`/acc/tax-periods/${e(periodId)}/reopen`, { reason });
/** Fix the letter of an approved quarter; amounts stay, the client gets a neutral notice. */
export const accUpdateLetter = (periodId: string, letterText: string) => api.post<unknown>(`/acc/tax-periods/${e(periodId)}/letter`, { letterText });
export const accVerifyPayment = (periodId: string, items: { kind: PaymentItemKind; verification: 'rendben' | 'elteres'; note?: string }[]) =>
  api.post<unknown>(`/acc/tax-periods/${e(periodId)}/verify-payment`, { items });
/** `form`: the quarterly return of the period's year ("2658" for 2026, "2758" for 2027 – round-2 tax finding 8). */
export const accMarkFiled = (
  periodId: string,
  body: { filedOn: string; form: string; returnDocumentId: string; receiptDocumentId: string; returnFileId?: string; receiptFileId?: string },
) => api.post<unknown>(`/acc/tax-periods/${e(periodId)}/filed`, body);

// requests, messages, notes
export const accRequests = (o: { status?: RequestStatus | 'nyitott_mind'; clientId?: string; type?: string }) => api.get<{ items: AccRequestRow[] }>(`/acc/requests${q(o)}`);
export const accCreateRequest = (id: string, body: { type: 'dokumentum' | 'adat' | 'egyeb'; title: string; body: string; dueDate?: string; dossierMonth?: string }) =>
  api.post<RequestSummary>(`/acc/clients/${e(id)}/requests`, body);
export const accPatchRequest = (reqId: string, body: { status: RequestStatus; statusNote?: string; resultDocumentId?: string; submittedToNavAt?: string }) =>
  api.patch<RequestSummary>(`/acc/requests/${e(reqId)}`, body);
export const accMessages = (id: string, cursor?: string) => api.get<Page<Message>>(`/acc/clients/${e(id)}/messages${q({ cursor, limit: 50 })}`);
export const accSendMessage = (id: string, body: { body: string; fileIds?: string[]; documentId?: string }) => api.post<Message>(`/acc/clients/${e(id)}/messages`, body);
export const accAttachment = (file: File) => {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<{ fileId: string }>('/acc/attachments', form);
};
export const accTemplates = () => api.get<{ items: MessageTemplate[] }>('/acc/message-templates');
export const accCreateTemplate = (body: { title: string; body: string }) => api.post<MessageTemplate>('/acc/message-templates', body);
export const accPatchTemplate = (id: string, body: { title: string; body: string }) => api.patch<MessageTemplate>(`/acc/message-templates/${e(id)}`, body);
export const accDeleteTemplate = (id: string) => api.del<void>(`/acc/message-templates/${e(id)}`);
export const accNotes = (id: string) => api.get<{ items: InternalNote[] }>(`/acc/clients/${e(id)}/notes`);
export const accAddNote = (id: string, body: { body: string; pinned?: boolean }) => api.post<InternalNote>(`/acc/clients/${e(id)}/notes`, body);
export const accPatchNote = (noteId: string, body: { body?: string; pinned?: boolean }) => api.patch<InternalNote>(`/acc/notes/${e(noteId)}`, body);
export const accDeleteNote = (noteId: string) => api.del<void>(`/acc/notes/${e(noteId)}`);

// board, settings, export, audit
export const accBoard = (week?: string) => api.get<DeadlineBoard>(`/acc/deadline-board${q({ week })}`);
/** Read-only since SPEC §26.2.9 (booking retired): old rows stay readable. The write endpoints answer 410. */
export const accAppointments = () => api.get<AccAppointments>('/acc/appointments');
export const accSettings = () => api.get<AccSettings>('/acc/settings');
export const accPatchSettings = (body: Partial<Pick<AccSettings, 'responseTimeText' | 'monthlyStatementRequest'>>) =>
  api.patch<AccSettings>('/acc/settings', body);
export const accExportCsv = (year: number, clientIds: string[]) =>
  downloadVia(`/acc/export/revenue.csv${q({ year, clientIds: clientIds.length ? clientIds.join(',') : undefined })}`, `bevetelek_${year}.csv`);
export const accAudit = (o: { clientId?: string; cursor?: string }) => api.get<Page<AuditRow>>(`/acc/audit${q(o)}`);

// ---------- admin ----------
export const adminDashboard = () => api.get<AdminDashboard>('/admin/dashboard');
export const adminClients = (o: { status?: string; q?: string; cursor?: string }) => api.get<Page<AdminClientRow>>(`/admin/clients${q(o)}`);
export const adminPatchClient = (id: string, body: { accountantId?: string; lifecycle?: string }) => api.patch<unknown>(`/admin/clients/${e(id)}`, body);
/** SPEC §27.9.1 (round-2 security finding 9): block / unblock a client's login; reason required, audited, sessions revoked. */
export const adminDisableClient = (id: string, reason: string) => api.post<void>(`/admin/clients/${e(id)}/disable`, { reason });
export const adminEnableClient = (id: string, reason: string) => api.post<void>(`/admin/clients/${e(id)}/enable`, { reason });
export const adminSubscriptions = (status?: string) => api.get<{ items: AdminSubscriptionRow[] }>(`/admin/subscriptions${q({ status })}`);
export const adminRetrySubscription = (id: string) => api.post<unknown>(`/admin/subscriptions/${e(id)}/retry`);
export const adminCancelSubscription = (id: string) => api.post<unknown>(`/admin/subscriptions/${e(id)}/cancel`);
export const adminPayments = (o: { status?: string; from?: string; to?: string }) => api.get<{ items: AdminPaymentRow[] }>(`/admin/payments${q(o)}`);
export const adminAccountants = () => api.get<{ items: AdminAccountantRow[] }>('/admin/accountants');
export const adminInviteAccountant = (body: {
  email: string;
  displayName: string;
  firstName: string;
  title: string;
  registrationNumber: string;
  nameForms: { with: string; from: string; onto: string; acc: string };
}) => api.post<unknown>('/admin/accountants', body);
export const adminPatchAccountant = (id: string, body: Partial<{ active: boolean; capacity: number; title: string; registrationNumber: string }>) =>
  api.patch<unknown>(`/admin/accountants/${e(id)}`, body);
export const adminReferralCodes = () => api.get<{ items: ReferralCodeRow[] }>('/admin/referral-codes');
export const adminCreateReferralCode = (body: { code: string; campaign?: string; note?: string }) => api.post<ReferralCodeRow>('/admin/referral-codes', body);
export const adminPatchReferralCode = (id: string, body: Partial<{ active: boolean; campaign: string; note: string }>) =>
  api.patch<ReferralCodeRow>(`/admin/referral-codes/${e(id)}`, body);
export const adminAttribution = (o: { from?: string; to?: string }) => api.get<{ rows: AttributionRow[] }>(`/admin/attribution${q(o)}`);
export const adminContentTexts = () => api.get<{ items: ContentText[] }>('/admin/content-texts');
export const adminPutContentText = (key: string, body: string) => api.put<ContentText>(`/admin/content-texts/${e(key)}`, { body });
export const adminFaq = () => api.get<{ items: FaqItem[] }>('/admin/faq');
export const adminCreateFaq = (body: Omit<FaqItem, 'id'>) => api.post<FaqItem>('/admin/faq', body);
export const adminPatchFaq = (id: string, body: Partial<Omit<FaqItem, 'id'>>) => api.patch<FaqItem>(`/admin/faq/${e(id)}`, body);
export const adminDeleteFaq = (id: string) => api.del<void>(`/admin/faq/${e(id)}`);
export const adminAudit = (o: { actor?: string; action?: string; clientId?: string; from?: string; to?: string; cursor?: string }) =>
  api.get<Page<AuditRow>>(`/admin/audit${q(o)}`);
export const adminDemoOutbox = () => api.get<{ items: DemoMail[] }>('/admin/demo-outbox');
export const adminSystem = () => api.get<SystemStatus>('/admin/system');

// ---------- SPEC §26: team (csapat, admin; the accountant only for callbacks assigned to him) ----------
export type CallbackFilter = 'nyitott' | 'lejart' | 'enyem' | 'gazdatlan' | 'lezart' | 'mind';
export const teamSummary = () => api.get<TeamSummary>('/team/summary');
export const teamCallbacks = (o: { filter: CallbackFilter; topic?: CallbackTopic | ''; q?: string; cursor?: string }) =>
  api.get<Page<TeamCallbackRow>>(`/team/callbacks${q(o)}`);
/** Detail; the full phone number comes only when the callback is assigned to the caller (audited on the server). */
export const teamCallback = (id: string) => api.get<TeamCallbackDetail>(`/team/callbacks/${e(id)}`);
export const teamClaim = (id: string, force?: boolean) => api.post<TeamCallbackDetail>(`/team/callbacks/${e(id)}/claim`, force ? { force: true } : {});
/** An accountant handing it back gets `{ ok, id }` (he no longer sees the callback); everyone else the detail. */
export const teamAssign = (id: string, body: CallbackAssignInput) => api.post<TeamCallbackDetail | { ok: true; id: string }>(`/team/callbacks/${e(id)}/assign`, body);
export const teamCalling = (id: string) => api.post<TeamCallbackDetail>(`/team/callbacks/${e(id)}/calling`, {});
export const teamAttempt = (id: string, body: CallbackAttemptInput) => api.post<TeamCallbackDetail>(`/team/callbacks/${e(id)}/attempts`, body);
export const teamClose = (id: string, body: CallbackCloseInput) => api.post<TeamCallbackDetail>(`/team/callbacks/${e(id)}/close`, body);
export const teamPatchCallback = (id: string, body: CallbackStaffPatch) => api.patch<TeamCallbackDetail>(`/team/callbacks/${e(id)}`, body);
export const teamClient = (clientId: string) => api.get<TeamClientCard>(`/team/clients/${e(clientId)}`);
export const teamCreateCallback = (clientId: string, body: TeamCallbackCreateInput) => api.post<TeamCallbackDetail>(`/team/clients/${e(clientId)}/callbacks`, body);

export type RegistrationFilter = RegistrationStatus | 'nyitott' | 'mind';
export const teamRegistrations = (o: { status: RegistrationFilter; q?: string; cursor?: string }) =>
  api.get<Page<TeamRegistrationRow>>(`/team/registrations${q(o)}`);
/** Every page of a registration list (the pipeline board shows all cards at once). */
export async function teamRegistrationsAll(o: { status: RegistrationFilter; q?: string }): Promise<TeamRegistrationRow[]> {
  const out: TeamRegistrationRow[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const p = await teamRegistrations({ ...o, cursor });
    out.push(...p.items);
    if (!p.nextCursor) break;
    cursor = p.nextCursor;
  }
  return out;
}
export const teamRegistration = (id: string) => api.get<TeamRegistrationDetail>(`/team/registrations/${e(id)}`);
export const teamPatchRegistration = (id: string, body: TeamRegistrationPatch) => api.patch<TeamRegistrationDetail>(`/team/registrations/${e(id)}`, body);
export const teamAssignRegistration = (id: string, body: CallbackAssignInput) => api.post<TeamRegistrationDetail>(`/team/registrations/${e(id)}/assign`, body);
export const teamCheckRegistration = (id: string, body: RegistrationCheckInput) => api.post<TeamRegistrationDetail>(`/team/registrations/${e(id)}/check`, body);
export const teamRequestFix = (id: string, note: string) => api.post<TeamRegistrationDetail>(`/team/registrations/${e(id)}/request-fix`, { note });
export const teamSetAdoszam = (id: string, body: RegistrationAdoszamStaffInput) => api.post<TeamRegistrationDetail>(`/team/registrations/${e(id)}/adoszam`, body);

// team messages: only clients in onboarding (lifecycle bekotes_alatt), role csapat
export const teamThreads = (cursor?: string) => api.get<Page<TeamThreadRow>>(`/team/threads${q({ cursor })}`);
export const teamMessages = (clientId: string, cursor?: string) => api.get<Page<Message>>(`/team/clients/${e(clientId)}/messages${q({ cursor, limit: 50 })}`);
export const teamSendMessage = (clientId: string, body: { body: string; fileIds?: string[] }) => api.post<Message>(`/team/clients/${e(clientId)}/messages`, body);
export const teamReadMessages = (clientId: string, upToId: string) => api.post<void>(`/team/clients/${e(clientId)}/messages/read`, { upToId });
export const teamAttachment = (file: File, clientId?: string) => {
  const form = new FormData();
  form.append('file', file, file.name);
  if (clientId) form.append('clientId', clientId);
  return upload<{ fileId: string }>('/team/attachments', form);
};

// accountant views of the same data (read-only, own clients)
export const accClientCallbacks = (clientId: string) => api.get<{ items: TeamCallbackRow[] }>(`/acc/clients/${e(clientId)}/callbacks`);
export const accClientRegistration = (clientId: string) => api.get<{ registration: TeamRegistrationDetail | null }>(`/acc/clients/${e(clientId)}/business-registration`);

// admin: service team members (role csapat)
export const adminTeam = () => api.get<{ items: TeamMemberRow[] }>('/admin/team');
export const adminInviteTeamMember = (body: TeamMemberInvite) => api.post<TeamMemberRow>('/admin/team', body);
export const adminPatchTeamMember = (userId: string, body: TeamMemberPatch) => api.patch<TeamMemberRow>(`/admin/team/${e(userId)}`, body);

// ---------- SPEC §27: "Intézzük helyette" (assisted path) + the changeable branch ----------
export type AssistFilter = 'nyitott' | 'nalam' | 'ugyfelre_var' | 'lejart' | 'kesz' | 'mind';
export const teamAssists = (o: { filter: AssistFilter; kind?: AssistKind | ''; q?: string; cursor?: string }) => api.get<Page<TeamAssistRow>>(`/team/assists${q(o)}`);
/** Every page (the queue is small; the panel filters and counts the chips locally, SPEC §27.6.2). */
export async function teamAssistsAll(o: { filter: AssistFilter; kind?: AssistKind | ''; q?: string } = { filter: 'mind' }): Promise<TeamAssistRow[]> {
  const out: TeamAssistRow[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const p = await teamAssists({ ...o, cursor });
    out.push(...p.items);
    if (!p.nextCursor) break;
    cursor = p.nextCursor;
  }
  return out;
}
/** Detail. `filingData.adoazonositoJel` is the full value only for the client's own accountant and admins (audited). */
export const teamAssist = (id: string) => api.get<TeamAssistDetailP>(`/team/assists/${e(id)}`);
export const teamCreateAssist = (clientId: string, body: { kind: AssistKind; note?: string; agreed?: AssistAgreedInput }) =>
  api.post<TeamAssistDetailP>(`/team/clients/${e(clientId)}/assists`, body);
export const teamAssistAgreed = (id: string, body: AssistAgreedInput) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/agreed`, body);
export const teamAssistUjegyke = (id: string, body: AssistUjegykeFiledInput) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/ujegyke-filed`, body);
export const teamAssistExpired = (id: string) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/expired`, {});
export const teamAssistMhLive = (id: string) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/mh-live`, {});
/** Multipart: `file` (the NAV értesítés PDF/image) + the fields of AssistEvFiledInput; `items` as one JSON array string. */
export const teamAssistEvFiled = (id: string, file: File, body: AssistEvFiledInput, onProgress?: (f: number) => void) => {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('items', JSON.stringify(body.items));
  form.append('filedOn', body.filedOn);
  if (body.adoszam) form.append('adoszam', body.adoszam);
  if (body.evNyilvantartasiSzam) form.append('evNyilvantartasiSzam', body.evNyilvantartasiSzam);
  return upload<TeamAssistDetailP>(`/team/assists/${e(id)}/ev-filed`, form, onProgress);
};
export const teamAssistClose = (id: string, body: AssistCloseInput) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/close`, body);
export const teamAssistAssign = (id: string, body: CallbackAssignInput) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/assign`, body);
export const teamPatchAssist = (id: string, body: AssistStaffPatch) => api.patch<TeamAssistDetailP>(`/team/assists/${e(id)}`, body);
/** The team changes the client's branch after a callback (SPEC §27.2.3; csapat, admin). */
export const teamPathChange = (clientId: string, body: TeamPathChangeInput) => api.post<TeamClientCard>(`/team/clients/${e(clientId)}/path`, body);

// ---------- SPEC §28 / §28.K (reserve, earnings, allowances, changes, check-in, annual closing, lock, EFO, fees) ----------
import type {
  AccAllowanceView,
  AccAnnualView,
  AccNotificationLog,
  AdminFeeChargeRow,
  AllowanceDecisionInput,
  AllowancePreview,
  AllowancePreviewInput,
  AnnualCheckInput,
  ChangeDoneInput,
  ChangeFollowupPatch,
  CheckinItemDecisionInput,
  EarningsView,
  EmployerDecisionInput,
  FeeSettingUpdateInput,
  FeeSettingView,
  ReserveView,
  TaxRegimeInput,
  TeamCheckinItem,
} from './types';
import type { AllowanceKind, CheckinItemStatus } from '../_shared/enums';

/** §28.1.9 / §28.4.4: the client's view, read-only (incl. manual items). */
export const accReserve = (id: string, year: number) => api.get<ReserveView>(`/acc/clients/${e(id)}/reserve${q({ year })}`);
export const accEarnings = (id: string, year: number) => api.get<EarningsView>(`/acc/clients/${e(id)}/earnings${q({ year })}`);
/** §28.3.6 allowances (csapat: 404). */
export const accAllowances = (id: string, year: number) => api.get<AccAllowanceView>(`/acc/clients/${e(id)}/allowances${q({ year })}`);
export const accAllowanceDecision = (id: string, kind: AllowanceKind, body: AllowanceDecisionInput) =>
  api.post<AccAllowanceView>(`/acc/clients/${e(id)}/allowances/${e(kind)}/decision`, body);
export const accAllowancePreview = (id: string, body: AllowancePreviewInput) => api.post<AllowancePreview>(`/acc/clients/${e(id)}/allowances/preview`, body);
/** §28.K.2 queue "Havi változások" (the API may answer with a bare array or { items }). */
export const accCheckinItems = async (status?: CheckinItemStatus | 'nyitott' | 'mind'): Promise<TeamCheckinItem[]> => {
  const r = await api.get<TeamCheckinItem[] | { items: TeamCheckinItem[] }>(`/acc/checkin-items${q({ status })}`);
  return Array.isArray(r) ? r : r.items;
};
export const accCheckinDecision = (itemId: string, body: CheckinItemDecisionInput) => api.post<TeamCheckinItem>(`/acc/checkin-items/${e(itemId)}`, body);
/** §28.K.3 annual closing (null = no closing row for that year yet). */
export const accAnnual = (id: string, year: number) => api.get<AccAnnualView | null>(`/acc/clients/${e(id)}/annual${q({ year })}`);
const annualUpload = (id: string, aid: string, what: 'draft' | 'filed-szja' | 'filed-hipa', file: File | null, fields: Record<string, string> = {}) => {
  const form = new FormData();
  if (file) form.append('file', file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return upload<AccAnnualView>(`/acc/clients/${e(id)}/annual/${e(aid)}/${what}`, form);
};
export const accAnnualDraft = (id: string, aid: string, file: File) => annualUpload(id, aid, 'draft', file);
export const accAnnualFiledSzja = (id: string, aid: string, file: File, filedOn: string) => annualUpload(id, aid, 'filed-szja', file, { filedOn });
export const accAnnualFiledHipa = (id: string, aid: string, file: File | null, filedOn: string) => annualUpload(id, aid, 'filed-hipa', file, { filedOn });
export const accAnnualCheck = (id: string, aid: string, body: AnnualCheckInput) => api.post<AccAnnualView>(`/acc/clients/${e(id)}/annual/${e(aid)}/check`, body);
/** §28.K.7 / §28.K.9 / §28.K.11 */
export const accEmployerDecision = (id: string, body: EmployerDecisionInput) => api.post<unknown>(`/acc/clients/${e(id)}/employer`, body);
export const accSetAdoszam = (id: string, adoszam: string) => api.post<unknown>(`/acc/clients/${e(id)}/adoszam`, { adoszam });
export const accSetTaxRegime = (id: string, body: TaxRegimeInput) => api.post<unknown>(`/acc/clients/${e(id)}/tax-regime`, body);
/** PANEL CONTRACT ADDITION (README §28 builder notes): the client's notification log. */
export const accNotifications = (id: string, cursor?: string) => api.get<AccNotificationLog>(`/acc/clients/${e(id)}/notifications${q({ cursor })}`);
/** §28.5.5 change kinds */
export const teamAssistChangeReady = (id: string) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/change-ready`, {});
export const teamAssistChangeDone = (id: string, body: ChangeDoneInput) => api.post<TeamAssistDetailP>(`/team/assists/${e(id)}/change-done`, body);
export const teamAssistFollowup = (id: string, body: ChangeFollowupPatch) => api.patch<TeamAssistDetailP>(`/team/assists/${e(id)}/followups`, body);
/** §28.K.1 fee settings (AD). GET may answer with a bare array or { items }. */
export const adminFees = async (): Promise<FeeSettingView[]> => {
  const r = await api.get<FeeSettingView[] | { items: FeeSettingView[] }>('/admin/fees');
  return Array.isArray(r) ? r : r.items;
};
export const adminPutFee = (body: FeeSettingUpdateInput) => api.put<FeeSettingView[] | { items: FeeSettingView[] }>('/admin/fees', body);
export const adminConfirmFee = (kind: string) => api.post<FeeSettingView[] | { items: FeeSettingView[] }>(`/admin/fees/${e(kind)}/confirm`, {});
/** PANEL CONTRACT ADDITION: the one-off charges the admin may waive / mark refunded. */
export const adminFeeCharges = (status?: string) => api.get<{ items: AdminFeeChargeRow[] }>(`/admin/fee-charges${q({ status })}`);
export const adminWaiveCharge = (id: string, reason: string) => api.post<unknown>(`/admin/fee-charges/${e(id)}/waive`, { reason });
export const adminChargeRefunded = (id: string, note?: string) => api.post<unknown>(`/admin/fee-charges/${e(id)}/refunded`, note ? { note } : {});
