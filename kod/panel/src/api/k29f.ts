// SPEC §29 F1, F2, F9 (B2) – panel endpoints of the certificate queue, the income statement check and the owner console.
import { api, upload } from './client';
import type {
  AccCertificateDetail,
  AccCertificateRow,
  AccIncomeStatementView,
  ConsoleActionResult,
  ConsoleAnnouncementInput,
  ConsoleClientHeader,
  ConsoleClientRow,
  ConsoleOverview,
  ConsolePreview,
  ConsoleSection,
  ConsoleSectionView,
} from '../_shared/k29f';

const e = encodeURIComponent;
const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false);
  return p.length ? `?${p.map(([k, v]) => `${k}=${e(String(v))}`).join('&')}` : '';
};

// ---- F1 certificates ----
export const accCertificates = (status = 'open') => api.get<{ items: AccCertificateRow[] }>(`/acc/certificates${qs({ status })}`);
export const accCertificate = (id: string) => api.get<AccCertificateDetail>(`/acc/certificates/${e(id)}`);
export const accCertificateReveal = (id: string) => api.post<{ adoazonositoJel: string }>(`/acc/certificates/${e(id)}/reveal`, {});
export const accCertificateSubmitted = (id: string, b: { date: string; iktatoszam?: string }) => api.post<AccCertificateDetail>(`/acc/certificates/${e(id)}/submitted`, b);
export const accCertificateResult = (id: string, b: { documentId?: string | null; komaOutcome?: string; komaDate?: string; komaMonth?: string }) => api.post<AccCertificateDetail>(`/acc/certificates/${e(id)}/result`, b);
export const accCertificateReject = (id: string, reason: string) => api.post<AccCertificateDetail>(`/acc/certificates/${e(id)}/reject`, { reason });
/** The certificate PDF goes up unchanged as a client document (category igazolas, shared), then it is bound. */
export const accUploadCertificatePdf = (clientId: string, file: File, title: string, month: string) => {
  const f = new FormData();
  f.append('category', 'igazolas');
  f.append('dossierMonth', month);
  f.append('title', title.slice(0, 120));
  f.append('visibility', 'kozos');
  f.append('status', 'feldolgozva');
  f.append('file', file, file.name);
  return upload<{ id: string }>(`/acc/clients/${e(clientId)}/documents`, f);
};

// ---- F2 income statement ----
export const accIncomeStatement = (clientId: string, from?: string, to?: string) => api.get<AccIncomeStatementView>(`/acc/clients/${e(clientId)}/income-statement${qs({ from, to })}`);
export const accIncomeStatementApprove = (clientId: string, b: { from: string; to: string; dataSha256: string }) => api.post<AccIncomeStatementView>(`/acc/clients/${e(clientId)}/income-statement/approve`, b);

// ---- F9 console ----
export const consoleStepUpState = () => api.get<{ valid: boolean; validUntil: string | null }>('/admin/console/step-up');
export const consoleStepUp = (code: string) => api.post<{ verifiedAt: string; validUntil: string }>('/admin/console/step-up', { code });
export const consoleOverview = () => api.get<ConsoleOverview>('/admin/console/overview');
export const consoleClients = (o: { q?: string; status?: string; regime?: string; accountant?: string; unpaid?: boolean; locked?: boolean; cancelled?: boolean; terminated?: boolean; cursor?: string }) =>
  api.get<{ items: ConsoleClientRow[]; nextCursor: string | null; total: number }>(`/admin/console/clients${qs({ ...o, unpaid: o.unpaid ? 1 : undefined, locked: o.locked ? 1 : undefined, cancelled: o.cancelled ? 1 : undefined, terminated: o.terminated ? 1 : undefined })}`);
export const consoleClient = (id: string) => api.get<ConsoleClientHeader>(`/admin/console/clients/${e(id)}`);
export const consoleSection = (id: string, s: ConsoleSection) => api.get<ConsoleSectionView>(`/admin/console/clients/${e(id)}/${s}`);
export const consolePreview = (id: string) => api.get<ConsolePreview>(`/admin/console/clients/${e(id)}/preview`);
export const consoleReveal = (id: string, field: string) => api.get<{ field: string; value: string | null }>(`/admin/console/clients/${e(id)}/reveal${qs({ field })}`);
export const consoleDocument = (id: string, docId: string) => api.get<{ fileId: string | null; title: string }>(`/admin/console/clients/${e(id)}/documents/${e(docId)}`);
export const consoleAnnounce = (b: ConsoleAnnouncementInput) => api.post<{ count: number; sent: boolean; id?: string }>('/admin/console/announcements', b);
export const consoleExportState = (exportId: string) => api.get<{ id: string; status: string; expiresAt: string | null }>(`/admin/console/exports/${e(exportId)}`);

/** Every console write: the dialog calls this with the method, the path below /admin/console and the body. */
export function consoleWrite<T = ConsoleActionResult>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown): Promise<T> {
  const p = `/admin/console${path}`;
  if (method === 'PATCH') return api.patch<T>(p, body);
  if (method === 'DELETE') return api.del<T>(p, { body } as never);
  return api.post<T>(p, body);
}
