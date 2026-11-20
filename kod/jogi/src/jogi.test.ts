import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { LEGAL_DOC_TYPES } from './_shared/enums.js';
import {
  appSzovegek,
  betoltIndex,
  CSOMAG_GYOKER,
  datumHu,
  datumIg,
  ellenorizMarkdown,
  forint,
  forras,
  HELYORZOK,
  helyorzokBenne,
  HianyzoAdatHiba,
  ismertHelyorzo,
  jogiPdf,
  kitolt,
  kitoltottDokumentum,
  markdownPdf,
  betoltBetuk,
  parse,
  sha256,
  ALAP_MARKA,
  TERVEZET_SOR,
  VERZIO_MINTA,
  UJ_GYIK_KERDESEK,
  VISSZAHIVAS_ADATKEZELES,
  aiEmlites,
  bejelentesAllitas,
  csapatBekuld,
  tiltottKifejezes,
  anyadSzo,
  szamlaTiltott,
  belepesKeres,
  sharedElteresek,
  belsoJegyzetekNelkul,
  betoltSablonok,
  kitoltottSablon,
  sablonPdf,
  EV_BEJELENTES_UTASITAS,
  huNevelo,
  nevelokFeloldasa,
  idopontAjanlat,
  lakcimkartyaHatoldal,
  magazas,
  mondatok,
  pushTiltott,
  tartalmiHibak,
  tartalomKulcsJo,
  type HelyorzoKulcs,
  type KitoltesAdat,
} from './index.js';

const NB = ' ';

function demo(): KitoltesAdat {
  const a: KitoltesAdat = {};
  for (const [k, l] of Object.entries(HELYORZOK) as [HelyorzoKulcs, { demo?: string }][]) if (l.demo !== undefined) a[k] = l.demo;
  return a;
}

async function osszesMarkdown(): Promise<string[]> {
  const index = await betoltIndex();
  const f = new Set<string>();
  for (const e of index) {
    f.add(e.file);
    if (e.pdfTemplate) f.add(e.pdfTemplate);
  }
  for (const s of await readdir(join(CSOMAG_GYOKER, 'sablonok'))) if (s.endsWith('.md')) f.add(`sablonok/${s}`);
  return [...f];
}

describe('formázás', () => {
  it('magyar dátum', () => {
    expect(datumHu('2026-11-18')).toBe('2026. november 18.');
    expect(datumIg('2027-01-08')).toBe('2027. január 8-ig');
    // UTC éjfél előtt 1 órával már másnap van Budapesten (CET)
    expect(datumHu(new Date('2026-12-31T23:30:00Z'))).toBe('2027. január 1.');
  });
  it('forint nem törő szóközzel', () => {
    expect(forint(20000)).toBe(`20${NB}000${NB}Ft`);
    expect(forint(1234567)).toBe(`1${NB}234${NB}567${NB}Ft`);
    expect(forint(0)).toBe(`0${NB}Ft`);
    expect(() => forint(1.5)).toThrow();
  });
});

describe('sablon kitöltése', () => {
  it('a márka és a cég a brand.json-ból jön', () => {
    const r = kitolt('{{brand.name}} – {{ceg.nev}} – {{dij.havi_brutto}}');
    expect(r.szoveg).toBe(`${ALAP_MARKA.name} – ${ALAP_MARKA.provider.legalName} – ${forint(ALAP_MARKA.priceHufMonthlyGross)}`);
    expect(r.hianyzo).toEqual([]);
  });
  it('hiányzó ügyféladat: címke, üres vonal vagy hiba', () => {
    expect(kitolt('Név: {{ugyfel.nev}}').szoveg).toBe('Név: [HIÁNYZÓ: az ügyfél neve]');
    expect(kitolt('Név: {{ugyfel.nev}}', { hiany: 'ures' }).szoveg).toMatch(/^Név: …+$/);
    expect(() => kitolt('Név: {{ugyfel.nev}}', { hiany: 'hiba' })).toThrow(HianyzoAdatHiba);
  });
  it('ismeretlen helyőrző marad, és jelzi', () => {
    const r = kitolt('x {{ismeretlen.kulcs}} y');
    expect(r.szoveg).toBe('x {{ismeretlen.kulcs}} y');
    expect(r.ismeretlen).toEqual(['ismeretlen.kulcs']);
    expect(() => kitolt('{{ismeretlen.kulcs}}', { hiany: 'hiba' })).toThrow(HianyzoAdatHiba);
  });
  it('az ügyfél adata nem változtathatja meg a szerkezetet', () => {
    const r = kitolt('Név: {{ugyfel.nev}}', { adat: { 'ugyfel.nev': '**Kata**\n# Cím {{ugyfel.adoszam}}' } });
    expect(r.szoveg).toBe('Név: Kata # Cím ugyfel.adoszam');
    expect(parse(r.szoveg)).toHaveLength(1);
  });
  it('nincs dupla pont a mondat végén', () => {
    const r = kitolt('Kezdete: {{szerzodes.kezdete}}. Cég: {{ceg.nev}}.', { adat: { 'szerzodes.kezdete': '2026. január 8.' } });
    expect(r.szoveg).toBe(`Kezdete: 2026. január 8. Cég: ${ALAP_MARKA.provider.legalName.replace(/\.$/, '')}.`);
  });
  it('a jelölőnégyzet üres állapota (szóköz) megmarad', () => {
    const r = kitolt('- [{{nyilatkozat.kiemelt}}] szöveg', { adat: { 'nyilatkozat.kiemelt': ' ' }, hiany: 'hiba' });
    expect(r.szoveg).toBe('- [ ] szöveg');
    const b = parse(r.szoveg)[0];
    expect(b).toMatchObject({ tipus: 'li', jel: 'negyzet', bejelolve: false });
  });
  it('konfig-érték tartalékkal', () => {
    expect(kitolt('{{elofizetes.alkalom}}').szoveg).toBe('12');
    expect(kitolt('{{elofizetes.alkalom}}', { adat: { 'elofizetes.alkalom': 24 } }).szoveg).toBe('24');
    expect(kitolt('{{elofizetes.max_osszeg}}').szoveg).toBe(forint(ALAP_MARKA.priceHufMonthlyGross));
  });
});

describe('Markdown', () => {
  it('a szűk készlet és a bővítések', () => {
    const b = parse(`${TERVEZET_SOR}\n\n# Cím\n\nElső **félkövér** sor\nfolytatás.\n\n## Al\n\n- pont\n  folytatás\n- [x] kész\n- [ ] nincs\n1. első\n12. tizenkettedik\n\n1.1. Ez bekezdés.`);
    expect(b.map((x) => x.tipus)).toEqual(['tervezet', 'h1', 'p', 'h2', 'li', 'li', 'li', 'li', 'li', 'p']);
    expect(b[2]).toEqual({ tipus: 'p', reszek: [{ text: 'Első ', bold: false }, { text: 'félkövér', bold: true }, { text: ' sor folytatás.', bold: false }] });
    expect(b[4]).toMatchObject({ jel: 'pont', reszek: [{ text: 'pont folytatás' }] });
    expect(b[5]).toMatchObject({ jel: 'negyzet', bejelolve: true });
    expect(b[8]).toMatchObject({ jel: 'szam', szam: 12 });
  });
  it('az ellenőrző megfogja a nem támogatott jelölést', () => {
    const h = ellenorizMarkdown('# A\n\n### B\n\n[link](https://x)\n\n* csillag\n\n**páratlan\n\n# Második');
    expect(h.some((x) => x.includes('TERVEZET'))).toBe(true);
    expect(h.some((x) => x.includes('csak # és ##'))).toBe(true);
    expect(h.some((x) => x.includes('link'))).toBe(true);
    expect(h.some((x) => x.includes('"- "'))).toBe(true);
    expect(h.some((x) => x.includes('páratlan'))).toBe(true);
    expect(h.some((x) => x.includes('pontosan egy #'))).toBe(true);
  });
});

describe('a jogi mappa tartalma', () => {
  it('az index minden SPEC-beli dokumentumtípust tartalmaz, egyszer', async () => {
    const index = await betoltIndex();
    expect(index.map((e) => e.docType).sort()).toEqual([...LEGAL_DOC_TYPES].sort());
    // marketing (11-20): a süti-tájékoztató új docType (kod/shared LEGAL_DOC_TYPES, DB: 0020_marketing_enumok.sql)
    expect(LEGAL_DOC_TYPES).toContain('suti');
  });
  it('minden Markdown-fájl TERVEZET-tel indul, a szűk készletet és csak ismert helyőrzőt használ, a márkanév nincs beégetve', async () => {
    for (const f of await osszesMarkdown()) {
      const md = await readFile(join(CSOMAG_GYOKER, f), 'utf8');
      expect(ellenorizMarkdown(md), f).toEqual([]);
      expect(helyorzokBenne(md).filter((k) => !ismertHelyorzo(k)), f).toEqual([]);
      expect(md.includes(ALAP_MARKA.name), f).toBe(false);
    }
  });
  it('az ügyfélnek szóló szövegek tegezők (nincs magázó „Ön”)', async () => {
    for (const f of await osszesMarkdown()) {
      if (f.startsWith('adatfeldolgozoi')) continue;
      const md = await readFile(join(CSOMAG_GYOKER, f), 'utf8');
      expect(/\bÖn\b|\bÖnnek\b|\bÖnt\b/.test(md), f).toBe(false);
    }
  });
  it('a lakcímkártya személyi azonosítós oldalát sehol nem kérjük', async () => {
    const md = await readFile(join(CSOMAG_GYOKER, 'pmt_nyilatkozatok.md'), 'utf8');
    expect(md).toContain('csak a lakcímes oldala');
    const app = JSON.parse(await readFile(join(CSOMAG_GYOKER, 'app_szovegek.json'), 'utf8')) as { szovegek: Record<string, string> };
    expect(app.szovegek['azonositas.lakcimkartya']).toContain('csak a lakcímes oldalát');
  });
  it('a forrás SHA-256-ja a nyers fájlé', async () => {
    const f = await forras('aszf');
    expect(f.sha256).toBe(sha256(await readFile(join(CSOMAG_GYOKER, 'aszf.md'), 'utf8')));
    // 2026-11-19: nem kérünk újra elfogadást (SPEC §26.12, §27.10; [JOGI] dönt az élesítés előtt)
    expect(f.elem.requiresReconsent).toBe(false);
  });
});

describe('PDF', () => {
  it('a kitöltött megbízási szerződés PDF-je: érvényes, beágyazott Geist, minden karakter megvan', async () => {
    const r = await jogiPdf('megbizasi_szerzodes', { adat: demo(), hiany: 'hiba', ma: '2026-11-18', most: new Date('2026-11-18T08:00:00Z') });
    expect(Buffer.from(r.pdf.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(r.figyelmeztetesek).toEqual([]);
    expect(r.hianyzo).toEqual([]);
    expect(r.fajlnev).toBe(`Megbizasi_szerzodes_${(await betoltIndex()).find((e) => e.docType === 'megbizasi_szerzodes')!.version}.pdf`);
    expect(r.fajlnev).toMatch(/^Megbizasi_szerzodes_2026-11-20(\.\d)?\.pdf$/);
    const doc = await PDFDocument.load(r.pdf);
    expect(doc.getPageCount()).toBe(r.oldalak);
    expect(r.oldalak).toBeGreaterThanOrEqual(3);
    expect(doc.getTitle()).toContain('Megbízási szerződés');
    // beágyazott TrueType betű (FontFile2) – az objektumfolyamok miatt a pdf-lib-bel keressük
    const beagyazott = doc.context
      .enumerateIndirectObjects()
      .filter(([, o]) => o instanceof PDFDict && o.has(PDFName.of('FontFile2'))).length;
    expect(beagyazott).toBe(2);
  });
  it('hiányzó ügyféladattal éles módban nem készül PDF', async () => {
    await expect(jogiPdf('megbizasi_szerzodes', { hiany: 'hiba' })).rejects.toBeInstanceOf(HianyzoAdatHiba);
  });
  it('a meghatalmazás PDF-je az okirat-sablonból készül', async () => {
    const r = await jogiPdf('nav_meghatalmazas', { adat: demo(), hiany: 'hiba', textura: false });
    expect(r.cim).toBe('Állandó meghatalmazás');
    const d = await kitoltottDokumentum('nav_meghatalmazas', { adat: demo(), pdfSablon: true });
    expect(d.markdown).toContain('Kovács Bence');
    expect(d.markdown).toContain('9 – könyvelő');
  });
  it('az elfogadási záradék ujjlenyomata a kitöltött szövegé', async () => {
    const adat = demo();
    const r = await jogiPdf('megbizasi_szerzodes', { adat, hiany: 'hiba', ma: '2026-01-08', elfogadas: { nev: 'Szabó Kata', idopont: '2026-01-08T09:12:31Z' } });
    const d = await kitoltottDokumentum('megbizasi_szerzodes', { adat, hiany: 'hiba', ma: '2026-01-08', pdfSablon: true });
    expect(r.sha256).toBe(d.sha256);
    expect(r.sha256).toBe(sha256(d.markdown));
  });
  it('a betűből hiányzó karakter helyett "?" kerül, és figyelmeztet', async () => {
    const r = await markdownPdf(parse('# Cím\n\nJelölő: ☐'), { cim: 'Próba', marka: 'M', ceg: 'C', verzio: 'v', betuk: await betoltBetuk() });
    expect(r.figyelmeztetesek.some((f) => f.includes('U+2610'))).toBe(true);
  });
  it('nagyon hosszú szó (webcím) is tördelődik', async () => {
    const hosszu = `https://${'nagyonhosszu'.repeat(40)}.example`;
    const r = await markdownPdf(parse(`# Cím\n\n${hosszu}`), { cim: 'Próba', marka: 'M', ceg: 'C', verzio: 'v', betuk: await betoltBetuk() });
    expect(r.oldalak).toBe(1);
  });
});

describe('appszövegek', () => {
  it('a márka és a díj kitöltve, a futásidejű adat helyőrző marad; 13 GYIK', async () => {
    const a = await appSzovegek();
    expect(a.szovegek['ar.rovid']).toContain(forint(ALAP_MARKA.priceHufMonthlyGross));
    expect(a.szovegek['fizetes.siker']).toContain('{{simplepay.tranzakcio}}');
    expect(a.gyik).toHaveLength(13);
    const b = await appSzovegek({ adat: { 'konyvelo.keresztnev': 'Bence' } });
    expect(b.szovegek['azonositas.titkositas']).toBe('Titkosítva tároljuk, csak Bence látja.');
  });
  it('a „tartalom” blokk (SPEC §26 tartalomkulcsok) változatlanul jön vissza, {egy} kapcsos helyőrzővel', async () => {
    const a = await appSzovegek({ adat: { 'konyvelo.keresztnev': 'Bence' } });
    expect(a.tartalom?.['visszahivas.adatkezeles']).toBe(VISSZAHIVAS_ADATKEZELES);
    expect(a.tartalom?.['visszahivas.igeret']).toContain('{firstName}');
    expect(a.tartalom?.['notif.callback_received.body']).toContain('{phoneMasked}');
    for (const k of Object.keys(a.tartalom ?? {})) expect(tartalomKulcsJo(k), k).toBe(true);
  });
  it('a meglévő 8 GYIK-kérdés szövege nem változott (az élő adatbázis kérdés szerint keres), az 5 kötelező a végén van', async () => {
    const regi = [
      'Mennyibe kerül, és mit kapok érte?',
      'Az app adja be helyettem a bevallást?',
      'Ki fizeti be az adót?',
      'Mi az a meghatalmazás, és visszavonhatom?',
      'Mi történik, ha a könyvelő hibázik?',
      'Hogyan mondhatom le?',
      'Miért kell a személyim és a lakcímkártyám fotója?',
      'Biztonságban vannak az adataim?',
    ];
    const a = await appSzovegek();
    expect(a.gyik.map((g) => g.kerdes)).toEqual([...regi, ...UJ_GYIK_KERDESEK]);
    const valasz = (k: string) => a.gyik.find((g) => g.kerdes === k)!.valasz;
    expect(valasz('Hogyan kérhetek visszahívást?')).toMatch(/24–48 órán belül/);
    expect(valasz('Hogyan kérhetek visszahívást?')).toMatch(/soha nem kérjük a jelszavadat/);
    expect(valasz('Hogyan kérhetek visszahívást?')).toMatch(/nem lépünk be helyetted/);
    expect(valasz('Még nincs vállalkozásom. Mit tegyek?')).toMatch(/te küldöd be/);
    expect(valasz('Még nincs vállalkozásom. Mit tegyek?')).toMatch(/intézzük helyetted/);
    expect(valasz('Bejelentitek helyettem a vállalkozásomat?')).toMatch(/meghatalmazottként, a saját belépésével/);
    expect(valasz('Bejelentitek helyettem a vállalkozásomat?')).toMatch(/soha nem kérjük el/);
    expect(valasz('Bejelentitek helyettem a vállalkozásomat?')).toMatch(/10–15 perc/);
    // SPEC §29.4.2 (tulaj 11-20): nincs díjmentes időszak
    expect(valasz('Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?')).toMatch(/a szerződés és a kártya megadása napjától fizeted/);
    expect(valasz('Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?')).not.toMatch(/ingyenes|nem fizetsz semmit/);
    expect(valasz('Mit jelent, hogy jóvá kell hagynom a meghatalmazást?')).toMatch(/4 naptári napon belül/);
    expect(valasz('Mennyibe kerül, és mit kapok érte?')).toMatch(/A kiállított számláidat a NAV rendszeréből mi töltjük le\./);
  });
  it('a 11-19-én változott GYIK-elemeknél az elozo_* a régi szöveg szó szerint (SPEC §27.7.3 adatlépés)', async () => {
    const most = JSON.parse(await readFile(join(CSOMAG_GYOKER, 'app_szovegek.json'), 'utf8')) as { gyik: { kerdes: string; valasz: string; elozo_kerdes?: string; elozo_valasz?: string }[] };
    const regi = JSON.parse(await readFile(join(CSOMAG_GYOKER, '_regi', 'par27_elott_20261119', 'app_szovegek.json'), 'utf8')) as { gyik: { kerdes: string; valasz: string }[] };
    // SPEC §29.4.2 (11-20): a havidíj kezdetéről szóló válasz újra változott – az előzménye a 11-20 előtti (az élő sorban az áll)
    const regi1120 = JSON.parse(await readFile(join(CSOMAG_GYOKER, '_regi', 'k29_elott_20261120', 'app_szovegek.json'), 'utf8')) as { gyik: { kerdes: string; valasz: string }[] };
    const HAVIDIJ = 'Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?';
    const valtozott = most.gyik.filter((g) => g.elozo_valasz !== undefined);
    expect(valtozott.map((g) => g.kerdes)).toEqual([
      'Mennyibe kerül, és mit kapok érte?',
      'Mi az a meghatalmazás, és visszavonhatom?',
      'Biztonságban vannak az adataim?',
      'Hogyan kérhetek visszahívást?',
      'Még nincs vállalkozásom. Mit tegyek?',
      'Bejelentitek helyettem a vállalkozásomat?',
      'Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?',
    ]);
    for (const g of valtozott) {
      const r = (g.kerdes === HAVIDIJ ? regi1120 : regi).gyik.find((x) => x.kerdes === (g.elozo_kerdes ?? g.kerdes));
      expect(r, g.kerdes).toBeDefined();
      expect(g.elozo_valasz, g.kerdes).toBe(r!.valasz);
      expect(g.valasz, g.kerdes).not.toBe(r!.valasz);
    }
    expect(most.gyik.find((g) => g.kerdes === 'Bejelentitek helyettem a vállalkozásomat?')!.elozo_kerdes).toBe('Miért nem ti jelentitek be a vállalkozásomat?');
    // az új kérdésnek nincs előzménye: a backend felveszi, ha még nincs
    expect(most.gyik.find((g) => g.kerdes === 'Mit jelent, hogy jóvá kell hagynom a meghatalmazást?')!.elozo_valasz).toBeUndefined();
    // az appSzovegek() az elozo_* mezőt is kitölti (a backend fillLegal-lal ugyanígy hasonlít)
    const a = await appSzovegek();
    expect(a.gyik[0]!.elozo_valasz).toContain(forint(ALAP_MARKA.priceHufMonthlyGross));
  });
  it('a §27.8 ügyfél-értesítések a „tartalom” blokkban (a push-szabályt is betartják)', async () => {
    const a = await appSzovegek();
    const t = a.tartalom ?? {};
    for (const fajta of ['assist_started', 'assist_mh_filed', 'assist_mh_reminder', 'assist_mh_expired', 'assist_consent_needed', 'assist_ev_filed', 'kamara_reminder']) {
      expect(t[`notif.${fajta}.title`], fajta).toBeTruthy();
      expect(t[`notif.${fajta}.body`], fajta).toBeTruthy();
      expect(pushTiltott(`${t[`notif.${fajta}.title`]} ${t[`notif.${fajta}.body`]}`), fajta).toBe(false);
    }
    expect(t['notif.assist_mh_reminder.utolso_nap.title']).toBe('Ma van az utolsó nap');
    expect(t['notif.assist_consent_needed.ujra.body']).toBe('Módosult a kérdőív, ezért nézd át újra.');
    expect(t['notif.assist_mh_filed.title']).toBe('Hagyd jóvá a meghatalmazást {hatarido}');
    expect(t['visszahivas.csalas']).toMatch(/nem lépünk be helyetted/);
    expect(t['notif.callback_received.body']).toMatch(/kártyaadataidat, és nem lépünk be helyetted\.$/);
    // egy újrapróbálási mondat: a backend 1, 3 és 7 nap múlva próbálja újra (services/subscription.ts RETRY_DAYS), ÁSZF 6.5
    expect(t['notif.subscription_payment_failed.body']).toMatch(/1, 3 és 7 nap múlva/);
    expect(a.szovegek['fizetes.levonas_sikertelen']).toMatch(/1, 3 és 7 nap múlva/);
  });
  it('a helyettunk.* szövegek a shared ASSIST_TEXTS jogásznak szóló másolatai (az app ezt mutatja)', async () => {
    const a = JSON.parse(await readFile(join(CSOMAG_GYOKER, 'app_szovegek.json'), 'utf8')) as { szovegek: Record<string, string> };
    expect(sharedElteresek(a)).toEqual([]);
    expect(a.szovegek['uj_vallalkozas.nem_taroljuk']).toContain('anyukád nevét');
  });
});

describe('belső jegyzetek és névelő (k3 kör 2: tulaj 12 és 6)', () => {
  it('az ügyfélnek szóló dokumentumból kikerülnek a [JOGI…]/[TULAJ…]/[KÖNYVELŐ…]/[ELLENŐRIZNI…] jegyzetek, a [CÉGADAT…] marad', async () => {
    const index = await betoltIndex();
    for (const e of index.filter((x) => x.audience === 'ugyfel' && !x.data)) {
      for (const pdfSablon of [false, true]) {
        const d = await kitoltottDokumentum(e.docType, { adat: demo(), pdfSablon });
        expect(d.markdown, e.docType).not.toMatch(/\[(JOGI|TULAJ|KÖNYVELŐ|ELLENŐRIZNI)/);
        expect(d.markdown, e.docType).not.toMatch(/a\(z\)/i);
        expect(d.markdown, e.docType).not.toMatch(/ [.,;:]/); // nem marad szóköz a jegyzet helyén
        expect(ellenorizMarkdown(d.markdown), e.docType).toEqual([]);
      }
    }
    const aszf = await kitoltottDokumentum('aszf');
    expect(aszf.markdown).toContain('[CÉGADAT: cégbíróság]');
    // a belső (Kft. ↔ könyvelő) szerződésben maradnak, és kérésre az ügyfél-dokumentumban is
    expect((await kitoltottDokumentum('adatfeldolgozoi')).markdown).toContain('[JOGI:');
    expect((await kitoltottDokumentum('aszf', { belsoJegyzetek: true })).markdown).toContain('[JOGI:');
  });
  it('a jegyzet törlése nem rontja a sort, a listát és a jelölőnégyzetet', () => {
    const md = 'Elő [KÖNYVELŐ: határidő];\n\n[JOGI: egész sor]\n\n- pont **[JOGI]**\n- [x] **ADÓÜGYEK** [JOGI/TULAJ: x]\n- [TULAJ: csak jegyzet]\n\nCím: [CÉGADAT: cégbíróság]. Kész [ELLENŐRIZNI].';
    expect(belsoJegyzetekNelkul(md)).toBe('Elő;\n\n- pont\n- [x] **ADÓÜGYEK**\n\nCím: [CÉGADAT: cégbíróság]. Kész.');
  });
  it('„a(z)” a kitöltött érték szerint', () => {
    expect(kitolt('a(z) {{brand.name}}').szoveg).toBe(`${huNevelo(ALAP_MARKA.name)} ${ALAP_MARKA.name}`);
    // k7c2: the support e-mail is set in brand.json now ("ugyfelszolgalat@…" → "az")
    expect(kitolt('A(z) {{ceg.nev}} és a(z) {{ceg.email}}').szoveg).toBe(`A ${ALAP_MARKA.provider.legalName} és ${huNevelo(ALAP_MARKA.provider.supportEmail)} ${ALAP_MARKA.provider.supportEmail}`);
    expect(nevelokFeloldasa('a(z) I. negyedév, a(z) II. negyedév, a(z) 5. pont, a(z) 1956-os, a(z) 2026. év, a(z) ügyfél')).toBe(
      'az I. negyedév, a II. negyedév, az 5. pont, az 1956-os, a 2026. év, az ügyfél',
    );
    expect(kitolt('a(z) {{ugyfel.email}}', { hiany: 'cimke' }).szoveg).toBe('a [HIÁNYZÓ: az ügyfél e-mail-címe]');
  });
});

describe('„Intézzük helyetted” – az ügyfél utasítása (sablonok/ev_bejelentes_utasitas.md, SPEC §27.3.3)', () => {
  it('a jegyzékben van, a verzió a sablonok.json-ból jön, és minden adattal kitöltve PDF lesz', async () => {
    const s = (await betoltSablonok()).find((x) => x.nev === EV_BEJELENTES_UTASITAS)!;
    expect(s.file).toBe('sablonok/ev_bejelentes_utasitas.md');
    expect(VERZIO_MINTA.test(s.version)).toBe(true);
    const d = await kitoltottSablon(EV_BEJELENTES_UTASITAS, { adat: demo() });
    expect(d.hianyzo).toEqual([]);
    expect(d.markdown).toContain(`Verzió: ${s.version}.`);
    expect(d.markdown).toContain('•••••••569');
    expect(d.markdown).toContain('Kovács Bence');
    expect(d.markdown).toContain('meghatalmazottként küldje be a vállalkozásom bejelentését');
    expect(d.markdown).not.toMatch(/\[JOGI/);
    expect(d.sha256).toBe(sha256(d.markdown));
    const b = parse(d.markdown);
    expect(b.filter((x) => x.tipus === 'li' && x.jel === 'negyzet' && x.bejelolve)).toHaveLength(2);
    const r = await sablonPdf(EV_BEJELENTES_UTASITAS, { adat: demo(), textura: false });
    expect(Buffer.from(r.pdf.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(r.figyelmeztetesek).toEqual([]);
    expect(r.fajlnev).toBe(`Utasitas_a_vallalkozasom_bejelentesere_${s.version}.pdf`);
  });
  it('hiányzó adattal nem készül (éles irat)', async () => {
    await expect(sablonPdf(EV_BEJELENTES_UTASITAS, { adat: { 'ugyfel.nev': 'Szabó Kata' } })).rejects.toBeInstanceOf(HianyzoAdatHiba);
  });
  it('a beillesztett adat (pl. a tevékenység saját szavakkal) nem törheti meg a szerkezetet', async () => {
    const d = await kitoltottSablon(EV_BEJELENTES_UTASITAS, { adat: { ...demo(), 'utasitas.tevekenysegek': 'fő: **kód**\n## Cím' } });
    expect(d.markdown).toContain('- **Tevékenységek:** fő: kód ## Cím');
  });
});

describe('SPEC §26 – tartalmi szabályok', () => {
  it('a teljes jogi mappa megfelel (nincs „mi jelentjük be”, nincs időpontfoglalás, nincs hátoldal, nincs „AI”, 12 GYIK, …)', async () => {
    expect(await tartalmiHibak()).toEqual([]);
  });
  it('a mondatbontó nem vág ketté magyar dátumot', () => {
    expect(mondatok('Időpontot 2026. november 18-a óta nem lehet foglalni. Új mondat.')).toEqual([
      'Időpontot 2026. november 18-a óta nem lehet foglalni.',
      'Új mondat.',
    ]);
  });
  it('felismeri, ha feltétel nélkül azt állítanánk, hogy mi jelentjük be a vállalkozást (SPEC §27: csak kérésre, meghatalmazottként)', () => {
    expect(bejelentesAllitas('Bejelentjük helyetted a vállalkozásodat.')).toBe(true);
    expect(bejelentesAllitas('A bejelentésedet mi küldjük be a NAV-nak.')).toBe(true);
    expect(bejelentesAllitas('A bejelentést mi intézzük.')).toBe(true);
    expect(bejelentesAllitas('Intézzük helyetted a bejelentést.')).toBe(true);
    expect(bejelentesAllitas('A bejelentést nem küldjük be helyetted.')).toBe(false);
    expect(bejelentesAllitas('Ha kéred, a meghatalmazásod alapján bejelentjük a későbbi változásokat.')).toBe(false);
    expect(bejelentesAllitas('A vállalkozásod könyvelését és adóügyeit intézzük.')).toBe(false);
    // §27: kérésre, a könyvelő mint meghatalmazott, az utasítás szerint – megengedett
    expect(bejelentesAllitas('Ha kéred, intézzük helyetted a bejelentést: a könyvelőd meghatalmazottként küldi be.')).toBe(false);
    expect(bejelentesAllitas('Az utasításod szerint a meghatalmazottad beküldjük a vállalkozásod bejelentését.')).toBe(false);
    expect(bejelentesAllitas('Kérd az „Intézzük helyetted” lehetőséget a bejelentéshez.')).toBe(false);
  });
  it('a csapat nem küld be semmit; tiltott kifejezések; „anyád”; számla-megfogalmazás; belépés kérése', () => {
    expect(csapatBekuld('A csapatunk beküldi a bejelentésedet.')).toBe(true);
    expect(csapatBekuld('A csapatunk felhív és szervez, de a NAV-nál nem jár el, és semmit nem küld be.')).toBe(false);
    expect(tiltottKifejezes('Bejegyeztetjük a vállalkozásodat.')).toBe('bejegyeztet…');
    expect(tiltottKifejezes('Az ügyintézési díj 5 000 Ft.')).toBe('ügyintézési díj');
    expect(tiltottKifejezes('Jogi képviseletet is vállalunk.')).toBe('jogi képviselet');
    expect(tiltottKifejezes('Ez nem jogi képviselet.')).toBeNull();
    expect(anyadSzo('Írd be anyád nevét.')).toBe(true);
    expect(anyadSzo('Édesanyád neve')).toBe(true);
    expect(anyadSzo('Anyukád születési neve')).toBe(false);
    expect(anyadSzo('anyja születési neve')).toBe(false);
    expect(szamlaTiltott('A számláid maguktól megjönnek a NAV-tól.')).not.toBeNull();
    expect(szamlaTiltott('A NAV-tól jött számlák')).not.toBeNull();
    expect(szamlaTiltott('A kiállított számláid maguktól megjelennek itt – nem kell feltöltened őket.')).toBeNull();
    expect(szamlaTiltott('Levél a NAV-tól; igazolást kérünk a NAV-tól.')).toBeNull();
    expect(belepesKeres('Add meg az Ügyfélkapu+ jelszavadat, és beküldjük.')).toBe(true);
    expect(belepesKeres('Az Ügyfélkapu+ vagy DÁP belépésedet senkinek ne add meg, nekünk sem.')).toBe(false);
  });
  it('a jogi mappa minden szövegében (a README-t és a jogász-kérdéseket is beleértve) nincs tiltott számla-megfogalmazás és „anyád” (SPEC §27.5.4, K4.4)', async () => {
    const fajlok = (await readdir(CSOMAG_GYOKER)).filter((f) => (f.endsWith('.md') || f.endsWith('.json')) && !f.startsWith('package'));
    for (const f of [...fajlok, ...(await readdir(join(CSOMAG_GYOKER, 'sablonok'))).map((x) => `sablonok/${x}`)]) {
      let sz = await readFile(join(CSOMAG_GYOKER, f), 'utf8');
      // az elozo_kerdes / elozo_valasz szándékosan a régi szöveg szó szerint (SPEC §27.7.3 adatlépés) – a JSON „// szándékos” jelölése
      if (f === 'app_szovegek.json') {
        const j = JSON.parse(sz) as { gyik: Record<string, string>[] };
        for (const g of j.gyik) {
          delete g.elozo_kerdes;
          delete g.elozo_valasz;
        }
        sz = JSON.stringify(j);
      }
      expect(szamlaTiltott(sz), f).toBeNull();
      expect(anyadSzo(sz), f).toBe(false);
    }
  });
  it('felismeri az időpontfoglalást, de a megszűnéséről szóló mondatot nem', () => {
    expect(idopontAjanlat('Foglalj időpontot a könyvelőddel.')).toBe(true);
    expect(idopontAjanlat('Időpontot foglalhatsz az appban.')).toBe(true);
    expect(idopontAjanlat('Időpontot foglalni már nem lehet.')).toBe(false);
    expect(idopontAjanlat('A korábban foglalt időpontokat 1 évig őrizzük.')).toBe(false);
  });
  it('felismeri, ha a lakcímkártya hátoldalát kérnénk', () => {
    expect(lakcimkartyaHatoldal('Fotózd le a lakcímkártyád mindkét oldalát.')).toBe(true);
    expect(lakcimkartyaHatoldal('A lakcímkártyádnak csak a lakcímes oldalát fotózd le, a másik oldalát nem kérjük.')).toBe(false);
  });
  it('„AI”, magázás, push-tiltás, tartalomkulcs', () => {
    expect(aiEmlites('Az AI kiszámolja.')).toBe(true);
    expect(aiEmlites('A mesterséges intelligencia segít.')).toBe(true);
    expect(aiEmlites('Az adataidat titkosítjuk.')).toBe(false);
    expect(magazas('Kérjük, Ön töltse ki.')).toBe(true);
    expect(magazas('Önkormányzati adó.')).toBe(false);
    expect(pushTiltott('Fizess 101 682 Ft-ot.')).toBe(true);
    expect(pushTiltott('Hívunk a {phoneMasked} számon.')).toBe(true);
    expect(pushTiltott('{when} hívtunk. Újra próbáljuk.')).toBe(false);
    expect(tartalomKulcsJo('notif.callback_received.regi_idopont.body')).toBe(true);
    expect(tartalomKulcsJo('email.registration_needs_fix.body')).toBe(true);
    expect(tartalomKulcsJo('notif.nincs_ilyen.title')).toBe(false);
    expect(tartalomKulcsJo('notif.callback_done.subject')).toBe(false);
  });
  it('a változott dokumentumok új verziót kaptak, és senkitől nem kérünk újra elfogadást (a tulaj élő fiókjai, SPEC §26.12, §27.10)', async () => {
    const index = await betoltIndex();
    for (const t of ['nav_meghatalmazas', 'adatfeldolgozoi', 'pmt_nyilatkozatok']) {
      const e = index.find((x) => x.docType === t)!;
      expect(e.version, t).toBe('2026-11-19');
      expect(e.effectiveFrom, t).toBe('2026-11-19');
    }
    // SPEC §29.16 (k7, 11-20): Stripe, Számlázz.hu e-számla, nincs díjmentes időszak, kártyás engedély
    for (const t of ['aszf', 'megbizasi_szerzodes', 'kartyas_fizetes']) {
      const e = index.find((x) => x.docType === t)!;
      expect(e.version, t).toBe('2026-11-20');
      expect(e.effectiveFrom, t).toBe('2026-11-20');
    }
    // marketing (11-21): weboldal-statisztika, forrásadat, hirdetési mérés (kikapcsolva), új süti-tájékoztató
    for (const t of ['adatkezeles', 'app_szovegek', 'suti']) {
      const e = index.find((x) => x.docType === t)!;
      expect(e.version, t).toBe('2026-11-21');
      expect(e.effectiveFrom, t).toBe('2026-11-21');
    }
    expect((await readFile(join(CSOMAG_GYOKER, '_regi', 'marketing_elott_20261120', 'adatkezeles.md'), 'utf8')).length).toBeGreaterThan(1000);
    expect((await readFile(join(CSOMAG_GYOKER, '_regi', 'k29_elott_20261120', 'aszf.md'), 'utf8')).length).toBeGreaterThan(1000);
    // a SimplePay-nyilatkozatok nem változtak
    for (const t of ['simplepay_adattovabbitas', 'simplepay_ismetlodo']) expect(index.find((x) => x.docType === t)!.version, t).toBe('2026-11-18');
    // a 11-18-i változat a _regi-ben megvan (a bekötés alatti fiókok azt fogadhatták el)
    expect((await readFile(join(CSOMAG_GYOKER, '_regi', 'par27_elott_20261119', 'aszf.md'), 'utf8')).length).toBeGreaterThan(1000);
    for (const e of index) {
      expect(VERZIO_MINTA.test(e.version), e.docType).toBe(true);
      // [JOGI] dönt az élesítés előtt; addig false, hogy a bekötés alatti fiókok ne akadjanak el
      expect(e.requiresReconsent, e.docType).toBe(false);
    }
    expect(VERZIO_MINTA.test('2026-11-18.1')).toBe(false);
    expect(VERZIO_MINTA.test('2026-11-18x')).toBe(false);
    // szövegként rendezve az új verzió a nagyobb (a backend így választ, ha egy típus kétszer szerepel)
    expect('2026-11-18' < '2026-11-18.2').toBe(true);
  });
  it('az ÁSZF, az adatkezelési tájékoztató, a szerződés és a meghatalmazás tartalmazza az új részeket', async () => {
    const olvas = (f: string) => readFile(join(CSOMAG_GYOKER, f), 'utf8');
    const aszf = await olvas('aszf.md');
    expect(aszf).toContain('## 4/A. Segítség új egyéni vállalkozás indításához');
    expect(aszf).toContain('## 4/B. Visszahívás');
    expect(aszf).toContain('a bejelentést nem küldjük be helyetted');
    expect(aszf).toContain('A hívást nem rögzítjük.');
    expect(aszf).toContain('6. § (4) bekezdés');
    const adat = await olvas('adatkezeles.md');
    expect(adat).toContain('## 2.8. Üzenetek, kérések, visszahívás');
    expect(adat).toContain('## 2.15. Új vállalkozás indítása');
    expect(adat).toContain('## 3.4. Kik látják nálunk az adataidat');
    expect(adat).toMatch(/a TAJ-számodat, az „anyja születési neve” adatot, a születési helyedet és idődet/);
    expect(adat).toContain('a kérés lezárása után 1 évig');
    const megb = await olvas('megbizasi_szerzodes.md');
    expect(megb).toContain('ez nem képviselet és nem jogi tanácsadás');
    expect(megb).toContain('ügyfélszolgálatunk munkatársai is');
    expect(megb).toContain('köztartozásmentességi igazolás');
    const megh = await olvas('nav_meghatalmazas.md');
    expect(megh).toContain('## A vállalkozás bejelentése és a meghatalmazás');
    expect(megh).toContain('Kb. 20 perc múlva él a meghatalmazás.');
    expect(await olvas('pmt_nyilatkozatok.md')).toContain('anyja születési neve');
  });
  it('SPEC §27.10 – „Intézzük helyetted” a jogi szövegekben', async () => {
    const olvas = (f: string) => readFile(join(CSOMAG_GYOKER, f), 'utf8');
    const aszf = await olvas('aszf.md');
    expect(aszf).toContain('## 4/C. Intézzük helyetted (segített ügyintézés)');
    expect(aszf).toContain('**4 naptári napon belül**');
    expect(aszf).toContain('4/C.4. **Beküldés után nem vonható vissza.**');
    expect(aszf).toContain('4/C.5. **A belépésed a tiéd.** Soha nem kérjük el az Ügyfélkapu+- vagy DÁP-belépésedet');
    expect(aszf).toMatch(/A csapatunk \(ügyfélszolgálat\) felhív és szervez, de a NAV-nál nem jár el/);
    expect(aszf).toContain('[JOGI: az egyéni vállalkozói nyilvántartási ügy');
    const adat = await olvas('adatkezeles.md');
    expect(adat).toContain('## 2.16. Intézzük helyetted (segített ügyintézés)');
    expect(adat).toMatch(/az IP-címedből képzett, vissza nem fejthető kód/);
    expect(adat).toMatch(/Amit soha nem kérünk el és nem tárolunk/);
    const megb = await olvas('megbizasi_szerzodes.md');
    expect(megb).toContain('külön írásos utasításod alapján');
    expect(megb).toContain('4.6. A belépési adataidat soha nem kérjük el.');
    const megh = await olvas('nav_meghatalmazas.md');
    expect(megh).toContain('## 2. út: {{konyvelo.nev}} küldi be, te jóváhagyod');
    expect(megh).toContain('„J08 – A meghatalmazó jóváhagyása szükséges”');
    expect(megh).toContain('„VÉGLEGESÍTVE / Jóváhagyásra vár”');
    const feldolg = await olvas('adatfeldolgozoi.md');
    expect(feldolg).toContain('7.2/B. **Intézzük helyetted.**');
  });
  it('marketing (11-20) – statisztika, forrásadat, hirdetési mérés kikapcsolva, süti-tájékoztató', async () => {
    const adat = (await kitoltottDokumentum('adatkezeles')).markdown;
    expect(adat).toContain('## 2.17. Weboldalunk látogatottsága (statisztika)');
    expect(adat).toContain('## 2.18. Hirdetéseink mérése (Meta és Google) – most nincs bekapcsolva');
    expect(adat).toContain('**Most nincs bekapcsolva.**');
    expect(adat).toContain('Az IP-címedet nem tároljuk.');
    expect(adat).toContain('**A tiltakozás jogodra külön is felhívjuk a figyelmedet.**');
    // a régi, valótlanná váló állítások nincsenek benne; „anonim” helyett „álnevesített”
    expect(adat).not.toContain('nincs követő süti');
    expect(adat).not.toMatch(/(?<!nem )\banonim\b/);
    expect(adat).not.toMatch(/névtelen/);
    expect(adat).toContain('nem anonim, hanem álnevesített');
    const suti = (await kitoltottDokumentum('suti')).markdown;
    expect(suti).toContain('# Süti-tájékoztató');
    for (const k of ['__Host-kj_rt', 'kj_rt', 'kj_bio', 'kj_elokeszit_', 'kj_video_', 'kj_aktiv_kartya_', 'kj_reg_varakozo', 'umami.disabled', 'kj_hozzajarulas', '_fbp', '_fbc', '_gcl_au', '_gcl_aw']) {
      expect(suti, k).toContain(k);
    }
    expect(suti).toContain('**Ez a rész most nem érvényes.**');
    expect(suti).toContain('„Elfogadom” és „Elutasítom”');
    // az ügyfél nem látja a belső jegyzeteket; a forrásban megmaradnak
    expect(suti).not.toMatch(/\[(JOGI|TULAJ|ELLENŐRIZNI)/);
    expect(await readFile(join(CSOMAG_GYOKER, 'suti.md'), 'utf8')).toContain('[JOGI: M1');
    // a süti-ablak szövegei: két egyenrangú gomb, a hirdetési hozzájárulás négyzete alapból üres (az app nem pipálja be)
    const a = await appSzovegek();
    expect(a.szovegek['suti_ablak.elfogadom']).toBe('Elfogadom');
    expect(a.szovegek['suti_ablak.elutasitom']).toBe('Elutasítom');
    expect(a.szovegek['suti_ablak.beallitasok']).toBe('Beállítások');
    expect(a.szovegek['regisztracio.hirdetes_hozzajarulas']).toMatch(/^Hozzájárulok/);
    expect(a.szovegek['meres.lablec']).toMatch(/nem használ sütit/);
    expect(a.szovegek['meres.lablec']).not.toMatch(/nem követ/);
  });
});
