// npm run ellenoriz – a jogi mappa önellenőrzése (a jogász és a fejlesztők is futtathatják).
// Ellenőrzi: index.json ↔ docType-lista, fájlok megléte, TERVEZET-sor, a szűk Markdown-készlet,
// csak ismert {{helyőrzők}}, az app_szovegek.md frissessége, és hogy a márkanév sehol nincs beégetve.
// SPEC §26 óta a tartalmi szabályok is (src/szabalyok.ts): 13 GYIK, a „tartalom” blokk kulcsai, a vállalkozást csak
// kérésre, meghatalmazottként jelentjük be (§27), nincs időpontfoglalás, nincs lakcímkártya-hátoldal, nincs „AI”, nincs
// „anyád”, a kiállított számlák egy megfogalmazása (§27.5), tegezés, push-szövegben nincs összeg.
// Az önálló sablonok (sablonok/sablonok.json, pl. az „Intézzük helyetted” utasítás) is.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LEGAL_DOC_TYPES } from '../_shared/enums.js';
import { betoltIndex, betoltSablonok, CSOMAG_GYOKER, type AppSzovegek } from '../jogi.js';
import { backendElteresek, sharedElteresek, tartalmiHibak } from '../szabalyok.js';
import { ellenoriz } from '../markdown.js';
import { helyorzokBenne, ismertHelyorzo } from '../helyorzok.js';
import { ALAP_MARKA } from '../sablon.js';
import { appSzovegekMarkdown } from './app_szovegek_md.js';

async function main(): Promise<void> {
  const hibak: string[] = [];
  const index = await betoltIndex();

  const tipusok = new Set(index.map((e) => e.docType));
  for (const t of LEGAL_DOC_TYPES) if (!tipusok.has(t)) hibak.push(`index.json: hiányzik a(z) ${t}`);
  if (tipusok.size !== index.length) hibak.push('index.json: ismétlődő docType');

  const fajlok = new Set<string>();
  for (const e of index) {
    fajlok.add(e.file);
    if (e.pdfTemplate) fajlok.add(e.pdfTemplate);
  }
  for (const f of await readdir(join(CSOMAG_GYOKER, 'sablonok'))) if (f.endsWith('.md')) fajlok.add(`sablonok/${f}`);
  // önálló sablonok: a jegyzékben minden fájl létezzen, és minden sablon/*.md vagy az indexben, vagy a jegyzékben szerepeljen
  const sablonok = await betoltSablonok().catch((e: unknown) => {
    hibak.push(`sablonok/sablonok.json: ${(e as Error).message}`);
    return [];
  });
  const ismert = new Set([...index.map((e) => e.pdfTemplate).filter(Boolean), ...sablonok.map((x) => x.file)]);
  for (const f of fajlok) if (f.startsWith('sablonok/') && !ismert.has(f)) hibak.push(`${f}: sem az index.json pdfTemplate-je, sem a sablonok/sablonok.json eleme`);
  for (const sb of sablonok) if (!fajlok.has(sb.file)) hibak.push(`sablonok/sablonok.json: nincs ilyen fájl: ${sb.file}`);

  for (const f of [...fajlok].sort()) {
    let md: string;
    try {
      md = await readFile(join(CSOMAG_GYOKER, f), 'utf8');
    } catch {
      hibak.push(`${f}: nem található`);
      continue;
    }
    for (const h of ellenoriz(md)) hibak.push(`${f}: ${h}`);
    for (const k of helyorzokBenne(md)) if (!ismertHelyorzo(k)) hibak.push(`${f}: ismeretlen helyőrző {{${k}}}`);
    if (md.includes(ALAP_MARKA.name)) hibak.push(`${f}: a termék neve („${ALAP_MARKA.name}”) be van égetve – használd: {{brand.name}}`);
    if (/\{\{(?![^}]*\}\})/.test(md)) hibak.push(`${f}: lezáratlan {{`);
  }

  const json = await readFile(join(CSOMAG_GYOKER, 'app_szovegek.json'), 'utf8');
  for (const k of helyorzokBenne(json)) if (!ismertHelyorzo(k)) hibak.push(`app_szovegek.json: ismeretlen helyőrző {{${k}}}`);
  if (json.includes(ALAP_MARKA.name)) hibak.push('app_szovegek.json: a termék neve be van égetve');
  const app = JSON.parse(json) as AppSzovegek;

  // SPEC §26: nem mi jelentjük be a vállalkozást, nincs időpontfoglalás, nincs lakcímkártya-hátoldal, nincs „AI”, 12 GYIK, …
  hibak.push(...(await tartalmiHibak()));

  const mdMost = await readFile(join(CSOMAG_GYOKER, 'app_szovegek.md'), 'utf8').catch(() => '');
  if (mdMost !== (await appSzovegekMarkdown())) hibak.push('app_szovegek.md: elavult – futtasd: npm run app-szovegek');

  // Figyelmeztetés (nem hiba): a backend tartalom-alapértékei egyeznek-e a jogász által látott „tartalom” blokkal.
  const tartalomDir = join(CSOMAG_GYOKER, '..', 'backend', 'src', 'content');
  const be = await backendElteresek(app, join(tartalomDir, 'defaults.hu.json'), [join(tartalomDir, 'tulaj1118.ts'), join(tartalomDir, 'tulaj1119.ts')]);
  if (be.elter.length > 0) console.warn(`FIGYELEM – a backend tartalom-alapértéke más szöveget ad ezekre a kulcsokra (a jogi „tartalom” blokk a jogász által látott változat):\n- ${be.elter.join('\n- ')}`);
  if (be.hianyzik.length > 0) console.warn(`Megjegyzés – ezek a kulcsok még nincsenek a backend tartalom-alapértékei között (${be.hianyzik.length} db): ${be.hianyzik.join(', ')}`);
  // Figyelmeztetés: a jogásznak szóló helyettunk.* szövegek egyeznek-e a shared ASSIST_TEXTS-szel (az app azt mutatja).
  const sh = sharedElteresek(app);
  if (sh.length > 0) console.warn(`FIGYELEM – a jogi helyettunk.* szöveg eltér a kod/shared ASSIST_TEXTS-től (az app a sharedet mutatja):\n- ${sh.join('\n- ')}`);

  if (hibak.length > 0) {
    console.error(`HIBA (${hibak.length}):\n- ${hibak.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Rendben: ${index.length} dokumentum, ${sablonok.length} önálló sablon, ${fajlok.size} Markdown-fájl, ${app.gyik.length} GYIK, ${Object.keys(app.tartalom ?? {}).length} tartalomkulcs.`);
  }
}

await main();
