// Éles NAV kapcsolatpróba (tulaj 11-20): a Somosi Kft. technikai felhasználójával a saját adószámot kérdezi le (queryTaxpayer).
// Az adatokat CSAK a környezeti változókból olvassa (NAV_LOOKUP_*, a nav_kulcs_mentes.ps1 mentette HKCU-ba), soha nem írja ki őket.
// Csak olvas. Kimenet: RENDBEN/HIBA + a NAV-nál nyilvántartott cégnév.
import { createNavClient } from '../dist/index.js';

const creds = {
  login: process.env.NAV_LOOKUP_LOGIN || '',
  password: process.env.NAV_LOOKUP_PASSWORD || '',
  signatureKey: process.env.NAV_LOOKUP_SIGN_KEY || '',
  exchangeKey: process.env.NAV_LOOKUP_EXCHANGE_KEY || undefined,
  taxNumber: process.env.NAV_LOOKUP_TAX_NUMBER || '',
};
for (const k of ['login', 'password', 'signatureKey', 'taxNumber']) if (!creds[k]) { console.error('Hiányzik: ' + k); process.exit(2); }
const software = {
  softwareId: 'HU32769678ADOZZ001', softwareName: 'Adozz', softwareMainVersion: '1.0.0',
  softwareDevName: 'Somosi Kft.', softwareDevContact: 'ugyfelszolgalat@adozz.hu', softwareDevCountryCode: 'HU', softwareDevTaxNumber: '32769678',
};
try {
  const client = createNavClient({ environment: 'prod', credentials: creds, software, maxRetries: 1 });
  const k = await client.checkConnection();
  console.log(k.ok ? `Kapcsolat: RENDBEN – a NAV szerint: ${k.taxpayerName ?? '(név nélkül)'}` : `Kapcsolat: HIBA (${k.code ?? ''}) ${k.messageHu ?? ''}`);
  process.exit(k.ok ? 0 : 1);
} catch (e) {
  console.error(`Hiba: ${e?.code ?? ''} ${e?.navMessage ?? e?.message ?? e}`);
  process.exit(1);
}
