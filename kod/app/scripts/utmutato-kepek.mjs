#!/usr/bin/env node
// Útmutató-képek normalizálója (SPEC §26.6.4). A „NAV-képek” munka kimenetéből (utmutato_kepek/<útmutató>/index.json +
// NN_slug.png / @2x) elkészíti az app által olvasott jegyzéket: kod/media/utmutato/<útmutató>/kepek.json
// (GuideImageManifest, + `part`, `variant`, `markers`, `sourceShort` – SPEC §24 11-18 app), és odamásolja a képeket.
//
//   node scripts/utmutato-kepek.mjs            # minden útmutató (GUIDE_STEP_KEYS a kod/shared-ből: bejelentés, meghatalmazás, jóváhagyás)
//   node scripts/utmutato-kepek.mjs --forras <mappa>   # más forrásmappa (alap: ../../utmutato_kepek)
//
// Újrajelölés után: node scripts/utmutato-kepek.mjs && bash ../deploy/feltolt.sh --media
// Nem töröl semmit: a felülírt (megváltozott) képek és jegyzékek a kod/media/utmutato/_regi/<időbélyeg>/ mappába kerülnek.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kod = resolve(app, '..');
const argForras = process.argv.indexOf('--forras');
const forras = resolve(argForras > 0 ? process.argv[argForras + 1] : join(kod, '..', 'utmutato_kepek'));
const cel = join(kod, 'media', 'utmutato');
const regi = join(cel, '_regi', new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '_'));
const terkep = JSON.parse(readFileSync(join(app, 'scripts', 'utmutato-kepek.map.json'), 'utf8'));

/** GUIDE_STEP_KEYS a közös szerződésből (kod/shared/src/enums.ts) – egy helyen él, itt csak kiolvassuk. */
function lepesKulcsok() {
  const src = readFileSync(join(kod, 'shared', 'src', 'enums.ts'), 'utf8');
  const blokk = /export const GUIDE_STEP_KEYS = \{([\s\S]*?)\n\} as const/.exec(src)?.[1];
  if (!blokk) throw new Error('GUIDE_STEP_KEYS nem található a kod/shared/src/enums.ts-ben');
  const ki = {};
  for (const m of blokk.matchAll(/(\w+): \[([\s\S]*?)\]/g)) ki[m[1]] = [...m[2].matchAll(/'([a-z_0-9]+)'/g)].map((x) => x[1]);
  return ki;
}
const KULCSOK = lepesKulcsok();

const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
let felulirt = 0;
/** Másolás; ha a cél létezik és más a tartalma, a régit a _regi/-be teszi. */
function masol(honnan, hova) {
  if (existsSync(hova)) {
    if (hash(honnan) === hash(hova)) return false;
    mkdirSync(join(regi, dirname(hova).slice(cel.length)), { recursive: true });
    renameSync(hova, join(regi, hova.slice(cel.length)));
    felulirt++;
  }
  copyFileSync(honnan, hova);
  return true;
}
function irJson(hova, adat) {
  const uj = JSON.stringify(adat, null, 1) + '\n';
  if (existsSync(hova)) {
    const regiAdat = JSON.parse(readFileSync(hova, 'utf8'));
    // A generatedAt mindig más: csak a tartalom számít.
    if (JSON.stringify({ ...regiAdat, generatedAt: '' }) === JSON.stringify({ ...adat, generatedAt: '' })) return false;
    mkdirSync(join(regi, dirname(hova).slice(cel.length)), { recursive: true });
    renameSync(hova, join(regi, hova.slice(cel.length)));
  }
  writeFileSync(hova, uj);
  return true;
}

let hibas = 0;
for (const kind of Object.keys(KULCSOK)) {
  const idx = join(forras, kind, 'index.json');
  if (!existsSync(idx)) {
    // SPEC §27.1.3: új útmutató (pl. meghatalmazas_jovahagyas) képei később jönnek – addig az app kép nélkül mutatja.
    console.log(`MÉG NINCS KÉP: ${idx} (az app a lépések szövegét kép nélkül mutatja)`);
    continue;
  }
  const index = JSON.parse(readFileSync(idx, 'utf8'));
  const kulcsok = KULCSOK[kind];
  const kiMappa = join(cel, kind);
  mkdirSync(kiMappa, { recursive: true });
  const items = [];
  const nemIllik = [];
  let masolt = 0;
  for (const l of index.lepesek ?? []) {
    // 1) pontos kulcs, 2) a slug maga is kulcs, 3) a kézzel írt térkép (cím alapján, utmutato-kepek.map.json)
    const stepKey = kulcsok.includes(l.lepes_kulcs) ? l.lepes_kulcs : kulcsok.includes(l.slug) ? l.slug : terkep[kind]?.[l.slug] ?? null;
    if (!stepKey || !kulcsok.includes(stepKey)) {
      nemIllik.push(`${l.sorszam} ${l.slug} (${l.lepes_kulcs ?? '–'})`);
      continue;
    }
    const k = l.kimenet ?? {};
    const fajl = k.fajl;
    if (!fajl || !existsSync(join(forras, kind, fajl))) {
      nemIllik.push(`${l.sorszam} ${l.slug}: a kép nincs meg (${fajl ?? '–'})`);
      continue;
    }
    if (masol(join(forras, kind, fajl), join(kiMappa, fajl))) masolt++;
    let file2x;
    if (k.fajl_2x && existsSync(join(forras, kind, k.fajl_2x))) {
      if (masol(join(forras, kind, k.fajl_2x), join(kiMappa, k.fajl_2x))) masolt++;
      file2x = k.fajl_2x;
    }
    const tipus = (k.tipus ?? l.tipus) === 'valodi' ? 'kepernyokep' : 'illusztracio';
    const f = l.forras ?? null;
    items.push({
      stepKey,
      file: fajl,
      ...(file2x ? { file2x } : {}),
      width: k.szel ?? 1080,
      height: k.mag ?? 1080,
      kind: tipus,
      caption: l.felirat ?? '',
      alt: l.alt ?? l.felirat ?? '',
      source: f ? { title: f.cim, url: f.url, ...(f.datum ? { date: f.datum } : {}), ...(f.oldal != null ? { page: f.oldal } : {}) } : null,
      // Kiegészítések (SPEC §24 11-18 app): sorrend egy kulcson belül, válaszfüggő változat, jelölések felolvasáshoz.
      part: l.resz ?? 1,
      ...(l.valtozat?.mezo ? { variant: { field: l.valtozat.mezo, value: l.valtozat.ertek } } : {}),
      sourceShort: l.forras_rovid ?? null,
      markers: (k.jelolesek_kimeneten ?? []).map((j) => ({ n: j.n, style: j.stilus, label: j.cimke, box: j.doboz })),
    });
  }
  items.sort((a, b) => kulcsok.indexOf(a.stepKey) - kulcsok.indexOf(b.stepKey) || a.part - b.part);
  const vanKep = new Set(items.map((i) => i.stepKey));
  const missing = kulcsok.filter((s) => !vanKep.has(s));
  const manifest = { kind, generatedAt: new Date().toISOString(), sourceVersion: index.verzio ?? null, items, missing };
  const irt = irJson(join(kiMappa, 'kepek.json'), manifest);
  const valodi = items.filter((i) => i.kind === 'kepernyokep').length;
  console.log(`${kind}: ${items.length} kép (${valodi} valódi képernyőkép, ${items.length - valodi} illusztráció), ${masolt} fájl másolva, kepek.json ${irt ? 'frissítve' : 'változatlan'}`);
  if (missing.length) console.log(`  kép nélküli lépések: ${missing.join(', ')}`);
  if (nemIllik.length) {
    console.log(`  NEM ILLESZTHETŐ bejegyzések (írd be az utmutato-kepek.map.json-ba): ${nemIllik.join('; ')}`);
    hibas++;
  }
}
// SPEC §28.5 (integrátor k6, 11-19): a változás-útmutatók képei. A forrás EGY mappa (utmutato_kepek/valtozas/index.json),
// benne a `fajtak` térkép: változásfajtánként a lépéskulcs → kép (a `masolatok` a más útmutatókból átvett, már elmosott
// képek). Az app fajtánként olvas: kod/media/utmutato/<valtozas_fajta>/kepek.json – ugyanabban az alakban, mint fent.
const pngMeret = (p) => {
  const b = readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const vIdx = join(forras, 'valtozas', 'index.json');
if (existsSync(vIdx)) {
  const index = JSON.parse(readFileSync(vIdx, 'utf8'));
  // a lépések metaadatai a kimeneti fájlnév szerint (a saját képek), a másolatoké a forrás-útmutató indexéből
  const meta = new Map();
  for (const l of index.lepesek ?? []) if (l.kimenet?.fajl) meta.set(l.kimenet.fajl, l);
  const forrasMeta = (utvonal) => {
    const [g, fajl] = String(utvonal).split('/');
    const p = join(forras, g, 'index.json');
    if (!existsSync(p)) return null;
    return (JSON.parse(readFileSync(p, 'utf8')).lepesek ?? []).find((l) => l.kimenet?.fajl === fajl) ?? null;
  };
  for (const [kind, lepesek] of Object.entries(index.fajtak ?? {})) {
    const kiMappa = join(cel, kind);
    mkdirSync(kiMappa, { recursive: true });
    const items = [];
    const missing = [];
    let masolt = 0;
    for (const x of lepesek) {
      if (!x.kep || !existsSync(join(forras, 'valtozas', x.kep))) {
        missing.push(x.lepes_kulcs);
        continue;
      }
      if (masol(join(forras, 'valtozas', x.kep), join(kiMappa, x.kep))) masolt++;
      let file2x;
      if (x.kep_2x && existsSync(join(forras, 'valtozas', x.kep_2x))) {
        if (masol(join(forras, 'valtozas', x.kep_2x), join(kiMappa, x.kep_2x))) masolt++;
        file2x = x.kep_2x;
      }
      const l = meta.get(x.kep) ?? (x.masolat_innen ? forrasMeta(x.masolat_innen) : null) ?? {};
      const k = meta.has(x.kep) ? (l.kimenet ?? {}) : {};
      const m = pngMeret(join(forras, 'valtozas', x.kep));
      const f = l.forras ?? null;
      items.push({
        stepKey: x.lepes_kulcs,
        file: x.kep,
        ...(file2x ? { file2x } : {}),
        width: m.w,
        height: m.h,
        kind: (x.tipus ?? l.tipus) === 'valodi' ? 'kepernyokep' : 'illusztracio',
        caption: x.felirat ?? l.felirat ?? '',
        alt: x.alt ?? l.alt ?? l.felirat ?? '',
        source: f ? { title: f.cim, url: f.url, ...(f.datum ? { date: f.datum } : {}), ...(f.oldal != null ? { page: f.oldal } : {}) } : null,
        part: 1,
        sourceShort: l.forras_rovid ?? null,
        // a másolt képek jelölései a forrás-útmutató méretére szólnak – ott nem adjuk tovább (a kép maga jelölt)
        markers: (k.jelolesek_kimeneten ?? []).map((j) => ({ n: j.n, style: j.stilus, label: j.cimke, box: j.doboz })),
      });
    }
    const manifest = { kind, generatedAt: new Date().toISOString(), sourceVersion: index.verzio ?? null, items, missing };
    const irt = irJson(join(kiMappa, 'kepek.json'), manifest);
    console.log(`${kind}: ${items.length} kép, ${masolt} fájl másolva, kepek.json ${irt ? 'frissítve' : 'változatlan'}${missing.length ? `; kép nélkül: ${missing.join(', ')}` : ''}`);
  }
} else console.log(`MÉG NINCS KÉP: ${vIdx} (a változás-útmutatók kép nélkül)`);

if (felulirt) console.log(`${felulirt} régi kép a ${regi} mappába került.`);
process.exit(hibas ? 1 : 0);
