// k8 ALAP-B – the díjbekérő (proforma) of a bank-transfer month: the Számla Agent XML (xmlszamla with dijbekero=true,
// fizetve=false, fizmod Átutalás, fizetési határidő = kelt + 8 nap, sendEmail=false – our own mail goes out) and the
// DEMO PDF ("DÍJBEKÉRŐ – DEMO", INVOICE_MODE=demo or a DEMO server). The order number is unique per month
// (ADZ-<ügyfélszám>-<ÉÉÉÉ>-<HH>, "Rendelésszám ismétlődés tiltása" is ON at Számlázz.hu) and is both rendelesSzam and
// szamlaKulsoAzon, so a retry always queries first. The agent key never leaves the Számlázz client module.
import brand from '../_shared/brand.json' with { type: 'json' };
import type { Config } from '../config.js';
import type { FeeInvoiceBuyer } from '../db/schema.js';
import { simpleTablePdf } from '../lib/pdf.js';
import { buildInvoiceXml } from './szamlazzhu.js';

export interface ProformaInput {
  orderNo: string;
  kozlemeny: string;
  issueDate: string;
  dueDate: string;
  buyer: FeeInvoiceBuyer;
  line: { megnevezes: string; unit: 'hó' | 'alkalom'; grossHuf: number };
  replyTo: string | null;
}

/** The Számlázz.hu fields of the díjbekérő (exported for the XSD test). */
export function buildProformaXml(agentKey: string, i: ProformaInput): string {
  return buildInvoiceXml(agentKey, {
    key: i.orderNo,
    issueDate: i.issueDate,
    // a díjbekérő has no performance yet: teljesítés = kelt (required element); the final invoice carries the payment day
    paymentDate: i.issueDate,
    dueDate: i.dueDate,
    fizmod: 'Átutalás',
    proforma: true,
    buyer: i.buyer,
    line: i.line,
    replyTo: i.replyTo,
    // the Agent's own e-mail is never sent (sendEmail=false); the fields stay filled for the Számlázz.hu archive
    emailTargy: `${brand.name} – díjbekérő`,
    emailSzoveg: `Közlemény: ${i.kozlemeny}`,
    megjegyzes: `Közlemény: ${i.kozlemeny}. A díjszámlát az utalás beérkezése után állítjuk ki.`,
    sendEmail: false,
  });
}

const huf = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n)} Ft`;

/** The DEMO díjbekérő (never a real document). */
export async function demoProformaPdf(cfg: Pick<Config, 'fontDir'>, i: ProformaInput & { number: string }): Promise<Buffer> {
  return simpleTablePdf(cfg.fontDir, {
    title: 'DÍJBEKÉRŐ – DEMO',
    banner: 'BEMUTATÓ ADAT. Ez nem számla és nem számviteli bizonylat; ne utalj rá valódi pénzt.',
    header: [
      `${brand.name} · ${brand.provider.legalName} · ${brand.provider.seat} · Adószám: ${brand.provider.taxNumber}`,
      `Sorszám: ${i.number} · Kelt: ${i.issueDate} · Fizetési határidő: ${i.dueDate}`,
      `Vevő: ${i.buyer.name}${i.buyer.city ? `, ${i.buyer.zip ?? ''} ${i.buyer.city}, ${i.buyer.address ?? ''}` : ''}`,
    ],
    rows: [
      [i.line.megnevezes, huf(i.line.grossHuf)],
      ['Fizetendő (átutalással)', huf(i.line.grossHuf)],
    ],
    footer: [
      `Kedvezményezett: ${brand.provider.legalName} · Számlaszám: ${brand.provider.bankAccount} · IBAN: ${brand.provider.iban} · SWIFT: ${brand.provider.swift}`,
      `Közlemény: ${i.kozlemeny} · Rendelésszám: ${i.orderNo}`,
      'A díjszámlát az utalás beérkezése után állítjuk ki.',
    ],
  });
}
