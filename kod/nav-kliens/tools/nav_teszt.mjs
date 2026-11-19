// Egyszeri NAV-kapcsolatpróba (tulaj kérése 11-19): a technikai felhasználó adatait CSAK a környezeti
// változókból olvassa (a nav_teszt.ps1 tölti be, nem írja lemezre), és soha nem írja ki őket.
// Használat: node tools/nav_teszt.mjs <lekérdezendő adószám (8 jegy vagy teljes)>
import { createNavClientFromEnv } from '../dist/index.js';

const kerdezett = (process.argv[2] || process.env.NAV_TESZT_TAXNUMBER || '').trim();
const creds = {
  login: process.env.NAV_TESZT_LOGIN || '',
  password: process.env.NAV_TESZT_PASSWORD || '',
  signatureKey: process.env.NAV_TESZT_SIGNKEY || '',
  exchangeKey: process.env.NAV_TESZT_EXCHKEY || undefined,
  taxNumber: process.env.NAV_TESZT_TAXNUMBER || '',
};
for (const [k, v] of Object.entries({ login: creds.login, password: creds.password, signatureKey: creds.signatureKey, taxNumber: creds.taxNumber })) {
  if (!v) { console.error(`Hiányzik: ${k}`); process.exit(2); }
}
try {
  const client = createNavClientFromEnv(creds);
  const kapcs = await client.checkConnection();
  console.log(`Kapcsolat: ${kapcs.ok ? 'RENDBEN' : 'HIBA'}${kapcs.ok ? '' : ` (${kapcs.code ?? ''}) ${kapcs.messageHu ?? ''}`}`);
  if (kapcs.ok && kerdezett) {
    const t = await client.queryTaxpayer(kerdezett);
    console.log(JSON.stringify({ ervenyes: t.valid, nev: t.name ?? null, forma: t.incorporation ?? null, afakod: t.vatCode ?? null, cim: t.address ?? null }, null, 2));
  }
} catch (e) {
  console.error(`Hiba: ${e?.code ?? ''} ${e?.navMessage ?? e?.message ?? e}`);
  process.exit(1);
}
