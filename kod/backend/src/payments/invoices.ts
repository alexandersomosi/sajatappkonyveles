// Fee invoices of the subscription (SPEC §11.5). Tonight only the DEMO provider exists: a PDF
// "DEMO DÍJBEKÉRŐ – NEM SZÁMLA". Számlázz.hu / Billingo are [OWNER] – until one is chosen the
// payment is still recorded, the fee invoice row gets status 'hiba' and the admin sees it.
import brand from '../_shared/brand.json' with { type: 'json' };
import type { Config } from '../config.js';
import { simpleTablePdf } from '../lib/pdf.js';

export interface FeeInvoiceInput {
  seq: number;
  issuedOn: string;
  amountHuf: number;
  periodStart: string | null;
  periodEnd: string | null;
  orderRef: string;
  simplepayTransactionId: number | null;
  client: { name: string; zip?: string | null; city?: string | null; address?: string | null; adoszam?: string | null };
}

export interface FeeInvoiceProvider {
  readonly provider: 'demo' | 'szamlazzhu' | 'billingo' | 'none';
  issue(i: FeeInvoiceInput): Promise<{ number: string; pdf: Buffer; externalId: string | null; demo: boolean }>;
}

export class InvoiceNotConfigured extends Error {}

const huf = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n)} Ft`;

export function createFeeInvoiceProvider(cfg: Config): FeeInvoiceProvider {
  if (cfg.invoice.mode === 'demo') return demoFeeInvoiceProvider(cfg);
  return {
    provider: cfg.invoice.mode === 'disabled' ? 'none' : cfg.invoice.mode,
    async issue() {
      throw new InvoiceNotConfigured('A számlázó rendszer még nincs bekötve.');
    },
  };
}

/** The DEMO díjbekérő (never a real invoice). Also used for a DEMO payment whatever INVOICE_MODE is set to. */
export function demoFeeInvoiceProvider(cfg: Pick<Config, 'fontDir'>): FeeInvoiceProvider {
  {
    return {
      provider: 'demo',
      async issue(i) {
        const number = `DEMO-${i.issuedOn.slice(0, 4)}-${String(i.seq).padStart(6, '0')}`;
        const pdf = await simpleTablePdf(cfg.fontDir, {
          title: 'DEMO DÍJBEKÉRŐ – NEM SZÁMLA',
          banner: 'BEMUTATÓ ADAT. Ez nem számla és nem számviteli bizonylat; valódi pénzmozgás nem történt.',
          header: [
            `${brand.name} · ${brand.provider.legalName}`,
            `Sorszám: ${number} · Kelt: ${i.issuedOn}`,
            `Ügyfél: ${i.client.name}${i.client.city ? `, ${i.client.zip ?? ''} ${i.client.city}, ${i.client.address ?? ''}` : ''}`,
          ],
          rows: [
            [`Könyvelési szolgáltatás, havidíj${i.periodStart ? ` (${i.periodStart} – ${i.periodEnd ?? ''})` : ''}`, huf(i.amountHuf)],
            ['Fizetve bankkártyával (SimplePay, DEMO)', huf(i.amountHuf)],
          ],
          footer: [
            `Rendelésazonosító: ${i.orderRef}${i.simplepayTransactionId ? ` · SimplePay tranzakció: ${i.simplepayTransactionId}` : ''}`,
            'A valódi számlát a számlázó rendszer bekötése után állítjuk ki (Számlázz.hu vagy Billingo).',
          ],
        });
        return { number, pdf, externalId: null, demo: true };
      },
    };
  }
}
