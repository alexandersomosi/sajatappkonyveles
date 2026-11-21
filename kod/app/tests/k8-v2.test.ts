// k8 (FELÜLET-A) – a v2 dizájn, a gépes nézet és a mozgások függőség nélküli részei: a régi ikonnevek megfeleltetése,
// a töréspont és a menü tiszta logikája, a navigáció sorrendje, a mozgás-időtartamok, és forrás-szkennelés (időígéret,
// pasztell doboz, képernyőnként egy sárga főgomb, a 3D PNG-k nem kerülnek a csomagba).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { IKON3D_UJ, TARGYKEP_UJ } from '../src/_shared/v2/ikon/megfeleltetes.ts';
import { EMOJI_NEVEK } from '../src/_shared/v2/ikon/emoji-adat.ts';
import { NAV_IKONOK } from '../src/_shared/v2/ikon/nevek.ts';
import { kontraszt, szin as v2szin } from '../src/_shared/v2/tokenek.ts';
import {
  aktivFulUtbol,
  asztaliE,
  ASZTALI_TORES,
  menuCel,
  menuSzelesseg,
  MENU_UTAK,
  MINTA_NELKULI_MAX,
  oldalCim,
  oldalsavLathatoE,
  szelesAsztaliE,
  tartalomMargo,
  TARTALOM_MAX,
} from '../src/lib/elrendezesLogika.ts';
import { beuszasKesleltetes, BENYOMODAS, MOZGAS_IDO, MOZGAS_KIVETEL, mozgasKiLogika, porgoErtek, type MozgasNev } from '../src/lib/mozgasIdo.ts';

const SRC = join(import.meta.dirname, '../src');
function fajlok(d: string, ki: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    if (n === '_shared' || n === '_jogi' || n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) fajlok(p, ki);
    else if (/\.(ts|tsx)$/.test(n)) ki.push(p);
  }
  return ki;
}
const forras = fajlok(SRC).map((p) => ({ p: relative(SRC, p).replace(/\\/g, '/'), s: readFileSync(p, 'utf8') }));

// ---------- ikonok ----------
test('v2 ikonok: a megfeleltetés minden régi 3D ikon- és tárgykép-nevet lefed (kepjegyzek.ts kulcsai)', () => {
  const kj = readFileSync(join(SRC, 'theme/kepjegyzek.ts'), 'utf8');
  const blokk = (nev: string) => {
    const a = kj.indexOf(`export const ${nev} = {`);
    assert.ok(a >= 0, `${nev} nincs a kepjegyzek.ts-ben`);
    const b = kj.indexOf('\n} as const', a);
    return [...kj.slice(a, b).matchAll(/^ {2}"([a-z0-9_]+)": /gm)].map((m) => m[1]);
  };
  const ikonok = blokk('IKON3D');
  const targyak = blokk('TARGYKEPEK');
  assert.ok(ikonok.length >= 20 && targyak.length >= 10);
  for (const n of ikonok) assert.ok(n in IKON3D_UJ, `nincs megfeleltetve: ${n}`);
  for (const n of targyak) assert.ok(n in TARGYKEP_UJ, `nincs megfeleltetve (tárgykép): ${n}`);
  for (const u of Object.values(IKON3D_UJ)) if (u.fajta === 'emoji') assert.ok((EMOJI_NEVEK as readonly string[]).includes(u.nev), u.nev);
});

test('v2 ikonok: a régi 3D PNG-ket semmi nem hivatkozza futásidőben (a bundler nem viszi), a kepek.tsx csak a típusokat használja', () => {
  const kepek = forras.find((f) => f.p === 'ui/kepek.tsx')!.s;
  assert.match(kepek, /import type \{ Ikon3dNev, TargykepNev \} from '\.\.\/theme\/kepjegyzek'/);
  for (const f of forras) {
    if (f.p === 'theme/kepjegyzek.ts') continue;
    assert.doesNotMatch(f.s, /import \{[^}]*\b(IKON3D|TARGYKEPEK)\b[^}]*\} from '[^']*kepjegyzek'/, `${f.p} a régi PNG-táblát importálja`);
  }
});

// ---------- navigáció ----------
test('navigáció: öt fül a v2 sorrendjében, a „Fotózás” felirat marad; a menü útvonalai', () => {
  assert.deepEqual(NAV_IKONOK.map((n) => n.felirat), ['Főoldal', 'Dosszié', 'Fotózás', 'Üzenetek', 'Fiók']);
  assert.deepEqual(NAV_IKONOK.map((n) => n.kulcs), Object.keys(MENU_UTAK));
  assert.equal(menuCel('fooldal', false), '/');
  // bekötés alatt a Főoldal a bekötési listára visz – ugyanaz, mint az alsó sávban
  assert.equal(menuCel('fooldal', true), '/bekotes');
  assert.equal(menuCel('dosszie', true), '/dosszie');
});

test('navigáció: az aktív fül/menüpont az útvonalból', () => {
  assert.equal(aktivFulUtbol('/'), 'fooldal');
  assert.equal(aktivFulUtbol('/bekotes/adatok'), 'fooldal');
  assert.equal(aktivFulUtbol('/dosszie'), 'dosszie');
  assert.equal(aktivFulUtbol('/szamla/x'), 'dosszie');
  assert.equal(aktivFulUtbol('/tetel/x'), 'dosszie');
  assert.equal(aktivFulUtbol('/fotozas'), 'fotozas');
  assert.equal(aktivFulUtbol('/uzenetek'), 'uzenetek');
  assert.equal(aktivFulUtbol('/fiok/elofizetes'), 'fiok');
  assert.equal(aktivFulUtbol('/gyik'), 'fiok');
});

test('navigáció: az alsó sáv aktív füle kék csíkkal és kék felirattal, az inaktív felirat AA-kontrasztú (#5B6478)', () => {
  const k = forras.find((f) => f.p === 'ui/keret.tsx')!.s;
  assert.match(k, /aria-selected=\{foto \? undefined : on\}/);
  assert.match(k, /height: 3, borderBottomLeftRadius: 3/); // a 3 pt-os felső csík
  assert.match(k, /c=\{on \? szin\.tintakek : szin\.halvany\}/);
  assert.ok(kontraszt('#5B6478', '#FFFFFF') >= 4.5);
  const o = forras.find((f) => f.p === 'ui/asztali/Oldalsav.tsx')!.s;
  assert.match(o, /aria-current=\{on \? 'page' : undefined\}/);
  assert.match(o, /aria-label="Fő menü"/);
});

// ---------- gépes nézet: töréspont ----------
test('gépes nézet: 1024 pt-tól, csak weben, és a ?szelesseg=390 képernyőkép mindig telefonos', () => {
  assert.equal(ASZTALI_TORES, 1024);
  assert.equal(asztaliE({ web: true, szelesseg: 1023, keretSzelesseg: null }), false);
  assert.equal(asztaliE({ web: true, szelesseg: 1024, keretSzelesseg: null }), true);
  assert.equal(asztaliE({ web: true, szelesseg: 1440, keretSzelesseg: 390 }), false);
  assert.equal(asztaliE({ web: false, szelesseg: 1366, keretSzelesseg: null }), false); // tablet natívan
  assert.equal(szelesAsztaliE({ web: true, szelesseg: 1359, keretSzelesseg: null }), false);
  assert.equal(szelesAsztaliE({ web: true, szelesseg: 1360, keretSzelesseg: null }), true);
});

test('gépes nézet: menüszélesség, margók és tartalomszélesség (v2_asztali.css)', () => {
  assert.equal(menuSzelesseg(1280), 232);
  assert.equal(menuSzelesseg(1440), 248);
  assert.deepEqual(tartalomMargo(1440), { fent: 28, oldal: 36, lent: 48 });
  assert.deepEqual(tartalomMargo(1280), { fent: 24, oldal: 28, lent: 40 });
  assert.equal(TARTALOM_MAX, 1120);
  assert.equal(MINTA_NELKULI_MAX, 760);
});

test('gépes nézet: a bal menü csak bent, és nem a teljes képernyős utakon (belépés, bevezető, jogi, vezetett lépés)', () => {
  const l = (elsoSzegmens: string | undefined, o: Partial<{ asztali: boolean; bent: boolean; vezetett: boolean }> = {}) =>
    oldalsavLathatoE({ asztali: true, bent: true, vezetett: false, elsoSzegmens, ...o });
  assert.equal(l(undefined), true); // főoldal
  assert.equal(l('dosszie'), true);
  assert.equal(l('fiok'), true);
  for (const s of ['(auth)', 'bevezeto', 'jogi', 'email-megerosites', '+not-found']) assert.equal(l(s), false, s);
  assert.equal(l('bekotes', { vezetett: true }), false);
  assert.equal(l('dosszie', { bent: false }), false);
  assert.equal(l('dosszie', { asztali: false }), false);
});

test('gépes nézet: a gyökér-elrendezés fája mindig ugyanaz (a menü feltételes testvér), az átméretezés nem mountolja újra a Stack-et', () => {
  const g = forras.find((f) => f.p === 'app/_layout.tsx')!.s;
  assert.match(g, /\{lathato \? <Oldalsav \/> : null\}/);
  assert.match(g, /<View ref=\{tartalom as never\} role="main"[^>]*>\s*<Kapu \/>/);
  assert.match(g, /Ugrás a tartalomra/);
});

test('gépes nézet: a böngészőlap címe képernyőnként (document.title)', () => {
  assert.equal(oldalCim('/'), 'Főoldal – Adózz.hu');
  assert.equal(oldalCim('/dosszie'), 'Dosszié – Adózz.hu');
  assert.equal(oldalCim('/fiok/elofizetes'), 'Előfizetés – Adózz.hu');
  assert.equal(oldalCim('/fiok'), 'Fiók – Adózz.hu');
  assert.equal(oldalCim('/ismeretlen'), 'Adózz.hu');
});

// ---------- mozgás ----------
test('mozgás: 0,2–0,4 s, a kivételek indokoltak (lenyomás 100 ms, konfetti ≤ 1,2 s), a benyomódás 0,97', () => {
  for (const [k, v] of Object.entries(MOZGAS_IDO) as [MozgasNev, number][]) {
    if (MOZGAS_KIVETEL.includes(k)) continue;
    assert.ok(v >= 200 && v <= 400, `${k}: ${v} ms`);
  }
  assert.equal(MOZGAS_IDO.lenyomas, 100);
  assert.ok(MOZGAS_IDO.konfetti <= 1200);
  assert.equal(BENYOMODAS, 0.97);
  assert.equal(beuszasKesleltetes(0), 0);
  assert.equal(beuszasKesleltetes(2), 100);
  assert.equal(beuszasKesleltetes(40), (MOZGAS_IDO.beuszasMax - 1) * MOZGAS_IDO.beuszasKesleltetes);
});

test('mozgás: képernyőképnél és csökkentett mozgásnál semmi nem mozog; a felpörgő összeg a végértéken áll meg', () => {
  assert.equal(mozgasKiLogika({ kepernyokep: true, rendszerCsokkentett: false }), true);
  assert.equal(mozgasKiLogika({ kepernyokep: false, rendszerCsokkentett: true }), true);
  assert.equal(mozgasKiLogika({ kepernyokep: false, rendszerCsokkentett: null }), false);
  assert.equal(porgoErtek(250000, 0), 0);
  assert.equal(porgoErtek(250000, 1), 250000);
  assert.equal(porgoErtek(250000, 2), 250000);
  assert.ok(porgoErtek(250000, 0.5) > 125000); // out-cubic: eleje gyors
});

test('mozgás: csak transform és opacity animálódik, a natív szálon (useNativeDriver), csökkentett mozgást figyelve', () => {
  const m = forras.find((f) => f.p === 'ui/mozgas/index.tsx')!.s + forras.find((f) => f.p === 'ui/mozgas/Benyomodo.tsx')!.s;
  assert.doesNotMatch(m, /useNativeDriver: false/);
  assert.match(m, /useMozgasKi\(\)/);
  const web = forras.find((f) => f.p === 'lib/webStilus.ts')!.s;
  assert.match(web, /prefers-reduced-motion: reduce/);
  assert.match(web, /:focus-visible \{ outline: \$\{fokusz\.vastagsag\}px solid \$\{fokusz\.szin\}/);
});

// ---------- szövegek ----------
const ENGEDETT = 'A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.';
test('szövegek: nincs időígéret az app forrásában („kb. N perc”, „Pár perc”, „Kollégánk 24–48”); a 24–48 csak szó szerint', () => {
  for (const f of forras) {
    // a megjegyzésekben (//) idézett régi szöveg nem jelenik meg
    const kod = f.s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(kod, /kb\. \d+ perc/, f.p);
    assert.doesNotMatch(kod, /Pár perc/, f.p);
    assert.doesNotMatch(kod, /Kollégánk 24–48/, f.p);
    // a jogszabályi határidő („5 munkanapon belül szólok” – az ügyfél nyilatkozata) marad, a mi ígéretünk nem
    assert.doesNotMatch(kod, /általában \d+ munkanapon belül/i, f.p);
    for (const m of kod.matchAll(/24–48/g)) {
      const kornyezet = kod.slice(Math.max(0, m.index - 12), m.index + 70);
      assert.ok(kornyezet.includes(ENGEDETT), `${f.p}: a 24–48 nem az engedett mondatban: …${kornyezet}…`);
    }
  }
});

test('szövegek: nincs „a(z)” és nincs AI-említés az app forrásában', () => {
  for (const f of forras) {
    const kod = f.s.replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(kod, /\ba\(z\)/i, f.p);
    assert.doesNotMatch(kod, /'[^'\n]*\b(mesterséges intelligencia|AI-)[^'\n]*'/i, f.p);
  }
});

// ---------- pasztell-szabály ----------
test('pasztell-szabály: nagy, halvány borostyán/piros doboz helyett fehér alap + telt bal sáv (jelzoDoboz)', () => {
  for (const f of forras) {
    if (f.p === 'ui/alap.tsx') continue;
    for (const m of f.s.matchAll(/\{[^{}]*backgroundColor: szin\.(borostyanAlap|veszelyAlap)[^{}]*\}/g)) {
      const lit = m[0];
      // kis állapotcímke (pirula) maradhat
      assert.ok(!/padding: 1[2-9]|padding: \d\d|paddingVertical: 1\d/.test(lit) || /forma\.cimke/.test(lit), `${f.p}: nagy pasztell doboz: ${lit.slice(0, 120)}`);
    }
  }
  const a = forras.find((f) => f.p === 'ui/alap.tsx')!.s;
  assert.match(a, /borderLeftWidth: 4, borderLeftColor: c/);
});

// ---------- képernyőnként egy sárga főgomb ----------
/** Fájlok, ahol a <GombE> több ágban (külön return / feltételes dokk / alsó lap) szerepel – egyszerre legfeljebb egy
 *  látszik. Ha egy szám nő, nézd meg, hogy tényleg más ágban van-e, és írd át itt (indokkal). */
const TOBB_AG: Record<string, number> = {
  'ui/Ut.tsx': 5, // a „Most ez jön” kártya lépésenként más gombja (egy kártya, egy gomb)
  'app/eves-zaras/index.tsx': 5, // éves zárás állapotonként
  'app/bekotes/vallalkozas/index.tsx': 5, // a bejelentés állapotai
  'app/helyettunk.tsx': 4, // kérés / visszaigazolás / jóváhagyás ágai
  'app/fiok/elofizetes.tsx': 4, // előfizetés-állapotok + alsó lapok
  'app/bevezeto/adoszam.tsx': 5, // keresés / találat / kézi megadás ágai
  'kepernyok/simplepay/Kezeles.tsx': 3,
  'kepernyok/fizetes.tsx': 3, // három külön alsó lap
  'app/onellenorzes/[id].tsx': 3,
  'app/fotozas.tsx': 3, // gépen „Fájl kiválasztása”; telefonon kamera-engedély VAGY „Kész, feltöltöm”
  'app/fizetes/[id].tsx': 3,
  'app/fizesd-ki.tsx': 3,
  'app/fiok/ketlepcsos.tsx': 3,
  'app/bevezeto/udv.tsx': 3, // a három üdvözlő lap
  'app/bekotes/vallalkozas/adatlap.tsx': 3,
  'kepernyok/simplepay/Eredmeny.tsx': 2,
  'kepernyok/Utmutato.tsx': 2,
  'kepernyok/Megszuntetes.tsx': 2,
  'app/visszahivas.tsx': 2,
  'app/kedvezmenyek/kerdoiv.tsx': 2,
  'app/kedvezmenyek/index.tsx': 2,
  'app/index.tsx': 3, // a dokk feltételes ágai (katás / negyedéves befizetés / havidíj) – egyszerre egy
  'app/igazolas/[id].tsx': 2,
  'app/fiok/dijak.tsx': 2,
  'app/eves-zaras/jovahagyas.tsx': 2,
  'app/bekotes/vallalkozas/utmutato.tsx': 2,
  'app/bekotes/meghatalmazas/index.tsx': 2,
  'app/bekotes/elofizetes.tsx': 2,
  'app/bekotes/alkalmazottak.tsx': 2,
  'app/bekotes/adatok.tsx': 2,
  'app/elofizetes/eredmeny.tsx': 3, // a dokk: siker / újra / „Rendben” – állapotonként egy
};
test('képernyőnként legfeljebb egy sárga főgomb (statikus számlálás, indokolt kivételekkel a feltételes ágakra)', () => {
  for (const f of forras) {
    if (!f.p.endsWith('.tsx') || f.p === 'ui/alap.tsx') continue;
    const n = (f.s.match(/<GombE\b/g) ?? []).length;
    const max = TOBB_AG[f.p] ?? 1;
    assert.ok(n <= max, `${f.p}: ${n} <GombE> (legfeljebb ${max})`);
  }
});

// ---------- színek ----------
test('v2 színek: a mező kerete (#8A93A8) és a kapcsoló a WCAG 1.4.11 szerint ≥ 3:1 fehéren; a szövegszínek ≥ 4,5:1', () => {
  const tok = forras.find((f) => f.p === 'theme/tokens.ts')!.s;
  assert.match(tok, /mezoKeret: v2szin\.dekorHalvany/);
  assert.ok(kontraszt(v2szin.dekorHalvany, '#FFFFFF') >= 3);
  for (const [elo, hat] of [[v2szin.sotet, v2szin.sarga], [v2szin.szurke, v2szin.hatter], [v2szin.kek, v2szin.kekVil], [v2szin.narancs, '#FFFFFF'], [v2szin.piros, '#FFFFFF']]) {
    assert.ok(kontraszt(elo, hat) >= 4.5, `${elo} / ${hat}`);
  }
});
