// npm run app-szovegek – az app_szovegek.json-ból elkészíti a jogásznak olvasható app_szovegek.md-t.
// A JSON a forrás (ezt olvassa a backend/app); az .md-t kézzel ne szerkeszd.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CSOMAG_GYOKER, type AppSzovegek } from '../jogi.js';
import { TERVEZET_SOR } from '../markdown.js';

const CSOPORTOK: Record<string, string> = {
  ar: 'Ár',
  megujulas: 'Automatikus megújulás',
  fizetes: 'Fizetés (SimplePay)',
  arvaltozas: 'Árváltozás',
  lemondas: 'Lemondás',
  kartya_torles: 'Kártya törlése',
  szerzodes: 'A szerződés elfogadása',
  meghatalmazas: 'NAV-meghatalmazás',
  azonositas: 'Azonosítás (Pmt.)',
  uj_vallalkozas: 'Új vállalkozás indítása',
  helyettunk: 'Intézzük helyetted (segített ügyintézés)',
  becsles: 'Becslés',
  adatok_letoltese: 'Adataim letöltése',
  fiok_torles: 'Fiók törlése',
  regisztracio: 'Regisztráció',
  fiok: 'Fiók – hirdetési hozzájárulás (csak bekapcsolt hirdetési mérésnél)',
  suti_ablak: 'Süti-ablak (csak bekapcsolt hirdetési mérésnél)',
  meres: 'A weboldal látogatottságának mérése (lábléc)',
  lablec: 'Lábléc és linkek',
};

export async function appSzovegekMarkdown(dir: string = CSOMAG_GYOKER): Promise<string> {
  const j = JSON.parse(await readFile(join(dir, 'app_szovegek.json'), 'utf8')) as AppSzovegek;
  const ki: string[] = [
    TERVEZET_SOR,
    '',
    '# Rövid jogi szövegek az appban',
    '',
    `Verzió: ${j._meta.verzio ?? '{{dok.verzio}}'}. Ez a fájl az app_szovegek.json-ból készül (npm run app-szovegek). Ne szerkeszd kézzel: a JSON-t írd át, és futtasd újra. A félkövér rész a szöveg kulcsa, az app ezzel hivatkozik rá.`,
    '',
  ];
  const csoportok = new Map<string, [string, string | string[]][]>();
  for (const [kulcs, v] of Object.entries(j.szovegek)) {
    const cs = kulcs.split('.')[0]!;
    if (!csoportok.has(cs)) csoportok.set(cs, []);
    csoportok.get(cs)!.push([kulcs, v]);
  }
  for (const [cs, elemek] of csoportok) {
    ki.push(`## ${CSOPORTOK[cs] ?? cs}`, '');
    for (const [kulcs, v] of elemek) {
      if (Array.isArray(v)) {
        ki.push(`**${kulcs}**`, '');
        for (const s of v) ki.push(`- ${s}`);
        ki.push('');
      } else {
        ki.push(`**${kulcs}** – ${v}`, '');
      }
    }
  }
  ki.push('## Gyakori kérdések (GYIK)', '');
  j.gyik.forEach((g, i) => {
    ki.push(`**${i + 1}. ${g.kerdes}**`, '', g.valasz, '');
    if (g.elozo_kerdes) ki.push(`Korábbi kérdés (2026-11-19-ig): „${g.elozo_kerdes}”`, '');
    else if (g.elozo_valasz) ki.push('(A válasz 2026-11-19-én változott.)', '');
  });
  const tartalom = Object.entries(j.tartalom ?? {});
  if (tartalom.length > 0) {
    ki.push(
      '## Visszahívás és értesítések (a szerver tartalomszövegei)',
      '',
      'Ezeket a szerver küldi (értesítés az appban, push, e-mail), a kulcs a SPEC §26–§27 tartalomkulcsa. A {kapcsos zárójeles} rész futás közben töltődik ki: {firstName} = a könyvelő keresztneve, {phoneMasked} = a telefonszám takarva (csak az utolsó két számjegy látszik), {when} = időpont (például „ma 14:20”), {staffFirstName} = a hívó munkatárs keresztneve, {callerId} = a szám, amelyről hívunk, {reasonText} = a lezárás oka, {hatarido} = a határidő „-ig” raggal (például „november 22-ig”). Az e-mail tárgya a cím, a szövege a szöveg és egy „Megnyitom” link. A pontozott kulcsvég (például .elso, .utolso_nap, .ujra) ugyanannak az értesítésnek egy változata.',
      '',
    );
    for (const [kulcs, v] of tartalom) ki.push(`**${kulcs}** – ${v}`, '');
    if (j._meta.tartalom_elteresek) ki.push(`Eltérés a SPEC szövegétől: ${j._meta.tartalom_elteresek}`, '');
  }
  return ki.join('\n');
}

async function main(): Promise<void> {
  const md = await appSzovegekMarkdown();
  await writeFile(join(CSOMAG_GYOKER, 'app_szovegek.md'), md, 'utf8');
  console.log('app_szovegek.md elkészült.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
