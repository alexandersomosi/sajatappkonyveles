// k8 ALAP-B – panel endpoints of the bank transfer (owner console, TOTP; writes need the step-up – run them through
// useLepcsos()) and the DEMO outbox's HTML image (signed 5-minute link, opened in a new tab).
import { api } from './client';
import type { AdminTransferRow, AdminTransferSummary, FizetesKapcsolok, TransferMarkPaidInput, TransferRequestView } from '../_shared/k8';

const e = encodeURIComponent;

export type TransferSzuro = 'fizetett' | 'var' | 'kesik' | 'hiba';

export const consoleTransfers = (o: { status?: TransferSzuro; clientId?: string } = {}) => {
  const q = Object.entries(o).filter(([, v]) => v);
  return api.get<{ items: AdminTransferRow[] }>(`/admin/console/transfers${q.length ? `?${q.map(([k, v]) => `${k}=${e(String(v))}`).join('&')}` : ''}`);
};
export const consoleTransferSummary = () => api.get<AdminTransferSummary>('/admin/console/transfers/summary');
export const consoleTransferPaid = (id: string, b: TransferMarkPaidInput) => api.post<TransferRequestView>(`/admin/console/transfers/${e(id)}/paid`, b);
export const consoleTransferResend = (id: string) => api.post<{ ok: true }>(`/admin/console/transfers/${e(id)}/resend`, {});
export const consoleFizetesKapcsolok = () => api.get<FizetesKapcsolok>('/admin/console/switches/fizetes');
export const consoleFizetesKapcsolokMent = (b: Partial<FizetesKapcsolok> & { reason: string }) => api.put<FizetesKapcsolok>('/admin/console/switches/fizetes', b);
/** "Felfüggesztem": the existing manual lock with the reason filled in. */
export const consoleLock = (clientId: string, reason: string) => api.post<unknown>(`/admin/console/clients/${e(clientId)}/lock`, { mode: 'zarolva', until: null, reason });
/** DEMO outbox: the signed link of one mail's HTML image. */
export const adminDemoMailHtml = (id: string) => api.get<{ url: string }>(`/admin/demo-outbox/${e(id)}/html`);
