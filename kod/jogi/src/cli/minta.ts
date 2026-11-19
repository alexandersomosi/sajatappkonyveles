// npm run minta – mintapéldányok a jogásznak és a tulajnak (pdf_minta/*.pdf).
// KIZÁRÓLAG kitalált demóadatokkal (SPEC §19: Szabó Kata, Kovács Bence – nem valódi személyek).
// Az ügyfélnek szóló minták úgy készülnek, ahogy az ügyfél megkapja: a belső [JOGI…]/[TULAJ…]/[KÖNYVELŐ…] jegyzetek
// nélkül (SPEC §27.10); a jegyzetek a .md forrásokban és az UGYVED_KERDESEK_k5.md-ben vannak. A belső
// adatfeldolgozói szerződés jegyzetekkel készül.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HELYORZOK, type HelyorzoKulcs } from '../helyorzok.js';
import { betoltIndex, CSOMAG_GYOKER, EV_BEJELENTES_UTASITAS, jogiPdf, sablonPdf } from '../jogi.js';
import type { KitoltesAdat } from '../sablon.js';

export function demoAdat(): KitoltesAdat {
  const adat: KitoltesAdat = {};
  for (const [kulcs, l] of Object.entries(HELYORZOK) as [HelyorzoKulcs, { demo?: string }][]) {
    if (l.demo !== undefined) adat[kulcs] = l.demo;
  }
  return adat;
}

const MINTA = 'MINTA – kitalált adatokkal';
const MOST = new Date('2026-11-19T13:05:00Z');

async function main(): Promise<void> {
  const ki = join(CSOMAG_GYOKER, 'pdf_minta');
  await mkdir(ki, { recursive: true });
  const adat = demoAdat();
  const index = await betoltIndex();
  const kesz: string[] = [];

  for (const e of index.filter((x) => x.pdf)) {
    const r = await jogiPdf(e.docType, {
      adat,
      hiany: e.pdfPrefilled ? 'hiba' : 'cimke',
      ma: '2026-11-19',
      most: MOST,
      lablecMegjegyzes: MINTA,
    });
    const nev = `${e.docType}.pdf`;
    await writeFile(join(ki, nev), r.pdf);
    kesz.push(`${nev} (${r.oldalak} oldal${r.figyelmeztetesek.length ? `; ${r.figyelmeztetesek.join('; ')}` : ''})`);
  }

  // a megbízási szerződés elfogadás utáni másolata (SPEC §10.2 4.)
  const elf = await jogiPdf('megbizasi_szerzodes', {
    adat,
    hiany: 'hiba',
    ma: '2026-01-08',
    most: MOST,
    lablecMegjegyzes: MINTA,
    elfogadas: { nev: 'Szabó Kata', idopont: '2026-01-08T09:12:31Z' },
  });
  await writeFile(join(ki, 'megbizasi_szerzodes_elfogadva.pdf'), elf.pdf);
  kesz.push(`megbizasi_szerzodes_elfogadva.pdf (${elf.oldalak} oldal, SHA-256 ${elf.sha256.slice(0, 12)}…)`);

  // az appban olvasható változatok (a jogásznak, áttekintéshez)
  for (const t of ['nav_meghatalmazas', 'pmt_nyilatkozatok'] as const) {
    const r = await jogiPdf(t, { adat, pdfSablon: false, ma: '2026-11-19', most: MOST, lablecMegjegyzes: MINTA });
    await writeFile(join(ki, `${t}_szoveg.pdf`), r.pdf);
    kesz.push(`${t}_szoveg.pdf (${r.oldalak} oldal)`);
  }

  // „Intézzük helyetted”: az ügyfél utasítása a vállalkozása bejelentésére (SPEC §27.3.3) – kitalált adatokkal
  const ut = await sablonPdf(EV_BEJELENTES_UTASITAS, { adat, hiany: 'hiba', ma: '2026-11-19', most: MOST, lablecMegjegyzes: MINTA });
  await writeFile(join(ki, `${EV_BEJELENTES_UTASITAS}.pdf`), ut.pdf);
  kesz.push(`${EV_BEJELENTES_UTASITAS}.pdf (${ut.oldalak} oldal${ut.figyelmeztetesek.length ? `; ${ut.figyelmeztetesek.join('; ')}` : ''})`);

  // kézzel kitölthető meghatalmazás (üres vonalakkal)
  const ures = await jogiPdf('nav_meghatalmazas', { hiany: 'ures', ma: '2026-11-19', most: MOST });
  await writeFile(join(ki, 'nav_meghatalmazas_ures.pdf'), ures.pdf);
  kesz.push(`nav_meghatalmazas_ures.pdf (${ures.oldalak} oldal)`);

  console.log(`pdf_minta/:\n- ${kesz.join('\n- ')}`);
}

await main();
