// Adózz.hu v2 dizájn-alap – tesztek (ALAP-D / D1–D8).
// Futtatás: node --test kod/shared/v2/teszt/      (Node ≥ 22.18 / 23.6: a .ts fájlokat típuseltávolítással olvassa)
// A kod/shared/v2-n kívüli fájlokat (v2.js, epit.cjs, kepjegyzek.ts, Icon3d.tsx, panel node_modules) CSAK OLVASSA;
// ha valamelyik hiányzik, az arra épülő teszt kimarad (skip), nem bukik.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { EMOJI_ADAT, EMOJI_NEVEK, SZURKE_TABLA, VILAGOS_TABLA } from '../ikon/emoji-adat.ts';
import { VEZERLO_ADAT, VEZERLO_NEVEK, VEZERLO_VB, GOOGLE_G } from '../ikon/material.ts';
import { KOZEPRE, KOZEPRE_KUSZOB } from '../ikon/kozepre.ts';
import { IKON3D_UJ, TARGYKEP_UJ, javasoltCsempe } from '../ikon/megfeleltetes.ts';
import { NAV_IKONOK } from '../ikon/nevek.ts';
import { LOGO_KEP, logoMeret } from '../logo/meret.ts';
import * as T from '../tokenek.ts';
import { befoglalo, elemez, ikonBefoglalo, kozepElteres } from './utvonal.mjs';
import { betolt, fordit, kibont, reactDomServer, vanPanelModul, V2 } from './forditas.mjs';

const KOD = resolve(V2, '../..');
const GYOKER = resolve(KOD, '..');
const V2JS = join(GYOKER, 'dizajn/C5_v2/v2.js');
const EPIT = join(GYOKER, 'dizajn/landing_v2_proba4/_eszkoz/epit.cjs');
const KEPJEGYZEK = join(KOD, 'app/src/theme/kepjegyzek.ts');
const ICON3D = join(KOD, 'panel/src/ui/Icon3d.tsx');
const HEX = /^#[0-9A-F]{6}$/;

function viewBox(vb) {
  const r = vb.split(/[\s,]+/).map(Number);
  return r.length === 4 && r.every(Number.isFinite) && r[2] > 0 && r[3] > 0 ? r : null;
}

// ---------------------------------------------------------------- D1: emoji-ikonok

test('D1: 45 tartalmi ikon, egyedi nevekkel, és ugyanazok, mint a v2.js EMOJI térképében', (t) => {
  assert.equal(EMOJI_NEVEK.length, 45);
  assert.equal(new Set(EMOJI_NEVEK).size, 45);
  assert.deepEqual(Object.keys(EMOJI_ADAT), [...EMOJI_NEVEK]);
  if (!existsSync(V2JS)) return t.skip('nincs dizajn/C5_v2/v2.js');
  const s = readFileSync(V2JS, 'utf8');
  const i = s.indexOf('var EMOJI = ') + 12;
  const E = JSON.parse(s.slice(i, s.indexOf('\n', i)).trim().replace(/;$/, ''));
  assert.deepEqual(Object.keys(E), [...EMOJI_NEVEK]);
});

test('D1: minden ikon viewBoxa érvényes (4 véges szám, 32×32), a rajz a mezőn belül van', () => {
  for (const n of EMOJI_NEVEK) {
    const vb = viewBox(EMOJI_ADAT[n].vb);
    assert.ok(vb, `${n}: érvénytelen viewBox ${EMOJI_ADAT[n].vb}`);
    assert.equal(vb[2], 32, n);
    assert.equal(vb[3], 32, n);
    const [x, y, w, h] = ikonBefoglalo(EMOJI_ADAT[n]);
    assert.ok(x >= vb[0] - 0.01 && y >= vb[1] - 0.01 && x + w <= vb[0] + vb[2] + 0.01 && y + h <= vb[1] + vb[3] + 0.01, `${n}: a rajz kilóg a mezőből`);
  }
});

test('D1: csak útvonal és téglalap, csak telt #RRGGBB szín, minden útvonal szintaktikailag érvényes', () => {
  let elemek = 0;
  for (const n of EMOJI_NEVEK) {
    assert.ok(EMOJI_ADAT[n].elemek.length > 0, n);
    for (const e of EMOJI_ADAT[n].elemek) {
      elemek++;
      assert.ok(e.t === 'p' || e.t === 'r', n);
      assert.match(e.f, HEX, `${n}: ${e.f}`);
      if (e.t === 'p') assert.doesNotThrow(() => elemez(e.d), `${n}: hibás útvonal`);
      else assert.ok([e.x, e.y, e.w, e.h, e.rx].every(Number.isFinite) && e.w > 0 && e.h > 0, n);
    }
  }
  // egy rajzelem sem veszett el: annyi, ahány <path>/<rect> a v2.js EMOJI térképében van (11-21: 201 + 3)
  const forras = existsSync(V2JS) ? readFileSync(V2JS, 'utf8') : null;
  const vart = forras ? (() => {
    const i = forras.indexOf('var EMOJI = ') + 12;
    return (forras.slice(i, forras.indexOf('\n', i)).match(/<(path|rect)\b/g) ?? []).length;
  })() : 204;
  assert.equal(elemek, vart);
});

test('D1: KOZEPRE – a táblázat alkalmazva, és minden ikon közepe < 1 egységre van a mező közepétől', () => {
  for (const n of EMOJI_NEVEK) assert.equal(EMOJI_ADAT[n].vb, KOZEPRE[n] ?? '0 0 32 32', n);
  for (const n of Object.keys(KOZEPRE)) assert.ok(EMOJI_NEVEK.includes(n), `KOZEPRE: nincs ilyen ikon: ${n}`);
  for (const n of EMOJI_NEVEK) {
    const { dx, dy } = kozepElteres(EMOJI_ADAT[n]);
    const elter = Math.max(Math.abs(dx), Math.abs(dy));
    assert.ok(elter < 1, `${n}: a javított eltérés ${elter.toFixed(3)} ≥ 1`);
    if (KOZEPRE[n]) assert.ok(elter < 0.05, `${n}: a KOZEPRE-ikon javított eltérése ${elter.toFixed(3)} ≥ 0,05`);
    // ami a javítás nélkül a küszöb fölött lenne, annak a táblázatban a helye
    const eredeti = kozepElteres({ vb: '0 0 32 32', elemek: EMOJI_ADAT[n].elemek });
    if (Math.max(Math.abs(eredeti.dx), Math.abs(eredeti.dy)) >= KOZEPRE_KUSZOB) assert.ok(KOZEPRE[n], `${n}: hiányzik a KOZEPRE-ből`);
  }
});

test('D1: a saját befoglaló-számítás egyezik a Chrome getBBox()-mérésével (ikon/kozep-meres.json)', () => {
  const m = JSON.parse(readFileSync(join(V2, 'ikon/kozep-meres.json'), 'utf8'));
  assert.equal(Object.keys(m.meres).length, 45);
  for (const n of EMOJI_NEVEK) {
    const sajat = ikonBefoglalo({ vb: '0 0 32 32', elemek: EMOJI_ADAT[n].elemek });
    sajat.forEach((v, i) => assert.ok(Math.abs(v - m.meres[n].bb[i]) < 0.01, `${n}: bb[${i}] ${v} ≠ ${m.meres[n].bb[i]}`));
    assert.equal(m.meres[n].javitott.vb, EMOJI_ADAT[n].vb, `${n}: a mérés régebbi, mint az adat – futtasd: node scripts/meres-kozep.mjs`);
    assert.ok(Math.abs(m.meres[n].javitott.dx) < 1 && Math.abs(m.meres[n].javitott.dy) < 1, `${n}: Chrome szerint is < 1`);
  }
});

test('D1: a landing (epit.cjs) KOZEPRE-sorai változatlanul benne vannak a közös táblázatban', (t) => {
  if (!existsSync(EPIT)) return t.skip('nincs epit.cjs');
  const m = /const KOZEPRE = (\{[^}]*\})/.exec(readFileSync(EPIT, 'utf8'));
  assert.ok(m, 'az epit.cjs-ben nincs KOZEPRE');
  const landing = Function(`return (${m[1]});`)();
  for (const [n, vb] of Object.entries(landing)) assert.equal(KOZEPRE[n], vb, n);
});

test('D1/D3: a szürke és a világos tábla minden használt színt lefed, és valóban szürke', () => {
  for (const n of EMOJI_NEVEK) for (const e of EMOJI_ADAT[n].elemek) {
    assert.ok(SZURKE_TABLA[e.f], `szürke: ${e.f}`);
    assert.ok(VILAGOS_TABLA[e.f], `világos: ${e.f}`);
  }
  for (const tabla of [SZURKE_TABLA, VILAGOS_TABLA]) for (const g of Object.values(tabla)) {
    assert.match(g, HEX);
    assert.ok(g.slice(1, 3) === g.slice(3, 5) && g.slice(3, 5) === g.slice(5, 7), g);
  }
  // CSS grayscale(1): a fehér fehér marad, a Fluent kék (#00A6ED) középszürke
  assert.equal(SZURKE_TABLA['#FFFFFF'], '#FFFFFF');
  assert.equal(SZURKE_TABLA['#00A6ED'], '#888888');
});

test('D1/D7: a generált fájlok naprakészek (újrafuttatva bájtra azonos kimenet)', () => {
  for (const s of ['scripts/gen-ikonok.mjs', 'scripts/gen-css.mjs']) {
    const r = spawnSync(process.execPath, [join(V2, s), '--ellenoriz'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${s} --ellenoriz: ${r.stderr}`);
  }
});

// ---------------------------------------------------------------- D4: vezérlő-ikonok

test('D4: 20 vezérlő-ikon (a v2.js 11 kezelőeleme + 4 chev + 5 új), érvényes 24×24-es útvonalak', () => {
  assert.equal(VEZERLO_NEVEK.length, 20);
  for (const n of ['vissza', 'bezar', 'plusz', 'kuld', 'letolt', 'szem', 'pipa', 'kereses', 'gemkapocs', 'csillag', 'zaszlo',
    'chev', 'chev-le', 'chev-fel', 'chev-bal', 'masol', 'kulso', 'frissit', 'szuro', 'tobb']) assert.ok(VEZERLO_NEVEK.includes(n), n);
  for (const n of VEZERLO_NEVEK) assert.ok(!EMOJI_NEVEK.includes(n), `${n} egyszerre emoji és vezérlő`);
  assert.deepEqual(viewBox(VEZERLO_VB), [0, 0, 24, 24]);
  for (const n of VEZERLO_NEVEK) {
    const a = VEZERLO_ADAT[n];
    assert.doesNotThrow(() => elemez(a.d), n);
    const [x, y, w, h] = befoglalo(a.d);
    assert.ok(x >= -0.01 && y >= -0.01 && x + w <= 24.01 && y + h <= 24.01 && w > 0 && h > 0, `${n}: kilóg a 24×24-es mezőből`);
    if (a.vonal !== undefined) assert.ok(a.vonal > 0 && a.vonal < 4, n);
  }
  // a Google „G”: 4 színes útvonal a márka színeivel
  assert.deepEqual(viewBox(GOOGLE_G.vb), [0, 0, 24, 24]);
  assert.deepEqual(GOOGLE_G.elemek.map((e) => e.f).sort(), ['#34A853', '#4285F4', '#EA4335', '#FBBC05']);
  for (const e of GOOGLE_G.elemek) assert.doesNotThrow(() => elemez(e.d));
});

test('segéd: az útvonal-elemző a hibás útvonalat elutasítja, a tömörített ív-jelzőt elfogadja', () => {
  assert.throws(() => elemez('L1 1'));
  assert.throws(() => elemez('M1 1 X2 2'));
  assert.throws(() => elemez('M1 1 C1 2 3'));
  assert.equal(elemez('M1 1a1 1 0 011 1z').length, 3);
  assert.deepEqual(befoglalo('M0 0L10 0L10 5Z'), [0, 0, 10, 5]);
});

// ---------------------------------------------------------------- D2: tokenek

test('D2: minden tervezett szöveg–háttér pár eléri a WCAG AA-t (szöveg 4,5:1, nagy szöveg és nem-szöveg 3:1)', () => {
  for (const p of T.KONTRASZT_PAROK) {
    const k = T.kontraszt(p.elo, p.hat);
    assert.ok(k >= (p.nagy || p.nemSzoveg ? 3 : 4.5), `${p.mi}: ${p.elo} / ${p.hat} = ${k.toFixed(2)}`);
  }
  const kerek = (a, b) => Math.round(T.kontraszt(a, b) * 100) / 100;
  assert.equal(kerek(T.szin.szurke, T.szin.hatter), 5.44);
  assert.equal(kerek(T.szin.feher, T.szin.kek), 8.91);
  assert.equal(kerek(T.szin.sotet, T.szin.sarga), 11.74);
  assert.equal(kerek(T.szin.zold, T.szin.zoldVil), 4.73);
  assert.equal(kerek('#8A93A8', '#FFFFFF'), 3.08);
});

test('D2: a #8A93A8 csak „dekor” néven érhető el, szövegre nem; az inaktív fül-felirat #5B6478', () => {
  const nevek = Object.entries(T.szin).filter(([, v]) => v === '#8A93A8').map(([k]) => k);
  assert.deepEqual(nevek, ['dekorHalvany']);
  assert.ok(!('halvany' in T.szin));
  assert.equal(T.nav.inaktivFelirat, '#5B6478');
  for (const p of T.KONTRASZT_PAROK) if (!p.nemSzoveg) assert.notEqual(p.elo, '#8A93A8', p.mi);
  for (const v of Object.values(T.szin)) assert.match(v, HEX);
});

test('D2: a jóváhagyott v2 alapértékek', () => {
  assert.equal(T.szin.kek, '#1428DB');
  assert.equal(T.szin.sarga, '#FFC93C');
  assert.equal(T.szin.sotet, '#10152B');
  assert.equal(T.szin.hatter, '#F3F5FB');
  assert.equal(T.szin.csempe, '#F1F3F9');
  assert.equal(T.csempe.hatter, T.szin.csempe);
  assert.deepEqual([T.csempe.kicsi.meret, T.csempe.kicsi.ikon, T.csempe.kicsi.sugar], [36, 29, 11]);
  assert.deepEqual([T.csempe.alap.meret, T.csempe.alap.ikon, T.csempe.alap.sugar], [42, 34, 13]);
  assert.deepEqual([T.csempe.nagy.meret, T.csempe.nagy.ikon, T.csempe.nagy.sugar], [64, 50, 20]);
  assert.equal(T.sugar.kartya, 20);
  assert.equal(T.sugar.kartyaAsztali, 22);
  assert.equal(T.arnyek.kartya.css, '0 1px 2px rgba(16,21,43,.04), 0 6px 20px rgba(16,21,43,.06)');
  assert.deepEqual(T.fejGradiens.szinek, ['#1D35EC', '#1428DB', '#0F20BE']);
  assert.equal(T.torespont.asztali, 1024);
  assert.equal(T.torespont.szelesAsztali, 1360);
  assert.equal(T.nav.ikon, 28);
  assert.equal(T.nav.csik, 3);
  assert.equal(T.betu.rn(750), 'Geist-W750');
  assert.ok(T.betu.web.startsWith('"Geist Variable"'));
  for (const s of Object.values(T.tipo)) assert.ok(T.betu.sulyok.includes(s.suly), `nincs ilyen Geist-súly az appban: ${s.suly}`);
  assert.equal(T.sorMagassag(T.tipo.szoveg), 22);
  assert.equal(T.betukozPt(T.tipo.szakaszCim), 0.56);
  assert.ok(T.elrendezes.erintesiCel >= 44);
  assert.ok(T.elrendezes.gombMagas >= 44 && T.elrendezes.gombMagasKis >= 42);
});

test('D7: a web/v2.css változói egyeznek a tokenek.ts értékeivel; globális reset nincs', () => {
  const css = readFileSync(join(V2, 'web/v2.css'), 'utf8');
  const valt = Object.fromEntries([...css.matchAll(/^\s*(--v2-[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
  const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  for (const [k, v] of Object.entries(T.szin)) assert.equal(valt[`--v2-${kebab(k)}`], v, k);
  for (const [k, v] of Object.entries(T.sugar)) assert.equal(valt[`--v2-r-${kebab(k)}`], `${v}px`, k);
  for (const [k, v] of Object.entries(T.ter)) assert.equal(valt[`--v2-${k}`], `${v}px`, k);
  for (const [k, v] of Object.entries(T.arnyek)) assert.equal(valt[`--v2-arnyek-${kebab(k)}`], v.css, k);
  assert.equal(valt['--v2-betu'], T.betu.web);
  assert.equal(valt['--v2-fej-gradiens'], T.fejGradiens.css);
  // csak :root és v2- előtagú osztályok; html/body/*/elem-szelektor nincs
  const szelektorok = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})\s*([^{}]+)\{/g)].map((m) => m[2].trim());
  for (const s of szelektorok) for (const egy of s.split(',').map((x) => x.trim())) {
    assert.ok(egy === ':root' || /^\.v2-/.test(egy), `nem v2- szelektor: ${egy}`);
  }
  assert.match(css, /:focus-visible[^{]*\{[^}]*outline: 2px solid #1428DB; outline-offset: 2px;/);
});

// ---------------------------------------------------------------- D5: megfeleltetés

function kulcsok(fajl, re) {
  return [...readFileSync(fajl, 'utf8').matchAll(re)].map((m) => m[1]);
}

test('D5: minden régi app-ikon (Ikon3dNev) és tárgykép (TargykepNev) le van fedve', (t) => {
  if (!existsSync(KEPJEGYZEK)) return t.skip('nincs kod/app/src/theme/kepjegyzek.ts');
  const s = readFileSync(KEPJEGYZEK, 'utf8');
  const ikon = s.slice(s.indexOf('export const IKON3D'), s.indexOf('export type Ikon3dNev'));
  const targy = s.slice(s.indexOf('export const TARGYKEPEK'), s.indexOf('export type TargykepNev'));
  const ikonNevek = [...ikon.matchAll(/^ {2}"([a-z0-9_]+)": \{/gm)].map((m) => m[1]);
  const targyNevek = [...targy.matchAll(/^ {2}"([a-z0-9_]+)": require/gm)].map((m) => m[1]);
  assert.ok(ikonNevek.length >= 30, `kevés app-ikonnév: ${ikonNevek.length}`);
  assert.ok(targyNevek.length >= 10, `kevés tárgykép: ${targyNevek.length}`);
  for (const n of ikonNevek) assert.ok(n in IKON3D_UJ, `app Ikon3dNev nincs megfeleltetve: ${n}`);
  for (const n of targyNevek) assert.ok(n in TARGYKEP_UJ, `app TargykepNev nincs megfeleltetve: ${n}`);
});

test('D5: minden régi panel-ikon (Icon3dName) le van fedve', (t) => {
  if (!existsSync(ICON3D)) return t.skip('nincs kod/panel/src/ui/Icon3d.tsx');
  const s = readFileSync(ICON3D, 'utf8');
  const tipus = s.slice(s.indexOf('export type Icon3dName'), s.indexOf(';', s.indexOf('export type Icon3dName')));
  const nevek = [...tipus.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(nevek.length >= 20, `kevés panel-ikonnév: ${nevek.length}`);
  for (const n of nevek) assert.ok(n in IKON3D_UJ, `panel Icon3dName nincs megfeleltetve: ${n}`);
});

test('D5: a megfeleltetés célpontjai létező ikonok; a csempeméret-javaslat', () => {
  for (const [regi, uj] of Object.entries(IKON3D_UJ)) {
    if (uj.fajta === 'emoji') assert.ok(EMOJI_NEVEK.includes(uj.nev), `${regi} → ${uj.nev}`);
    else assert.ok(VEZERLO_NEVEK.includes(uj.nev), `${regi} → ${uj.nev}`);
  }
  for (const [regi, uj] of Object.entries(TARGYKEP_UJ)) assert.ok(EMOJI_NEVEK.includes(uj), `${regi} → ${uj}`);
  assert.equal(IKON3D_UJ.fotozas.nev, 'kamera');
  assert.equal(IKON3D_UJ.masolas.fajta, 'vezerlo');
  assert.deepEqual([javasoltCsempe(28), javasoltCsempe(44), javasoltCsempe(72)], ['kicsi', 'alap', 'nagy']);
});

test('nevek: az ügyfél-app öt füle a v2 sorrendjében, a „Fotózás” marad', () => {
  assert.deepEqual(NAV_IKONOK.map((f) => f.felirat), ['Főoldal', 'Dosszié', 'Fotózás', 'Üzenetek', 'Fiók']);
  for (const f of NAV_IKONOK) assert.ok(EMOJI_NEVEK.includes(f.ikon), f.ikon);
});

// ---------------------------------------------------------------- D6: logó

function pngMeret(fajl) {
  const b = readFileSync(fajl);
  assert.equal(b.toString('latin1', 1, 4), 'PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('D6: a két logókép PNG, mérete egyezik a meret.ts-szel, és 38 px-es betűig 3×-os kijelzőn is éles', () => {
  assert.deepEqual(pngMeret(join(V2, 'logo/logo.png')), [...LOGO_KEP.kek]);
  assert.deepEqual(pngMeret(join(V2, 'logo/logo_feher.png')), [...LOGO_KEP.feher]);
  // 38 px-es betűnél a kép px / megjelenített px ≥ 3
  const m = logoMeret(38);
  assert.ok(LOGO_KEP.kek[0] / m.width >= 3, `nem elég éles: ${LOGO_KEP.kek[0] / m.width}`);
  assert.deepEqual(logoMeret(30), { width: 138, height: 37.8 });
});

// ---------------------------------------------------------------- D3: komponensek (RN és web) – ugyanaz a rajz

const KOMPONENSEK = ['index.ts', 'tokenek.ts', 'ikon/tipusok.ts', 'ikon/emoji-adat.ts', 'ikon/material.ts', 'ikon/nevek.ts', 'ikon/kozepre.ts',
  'ikon/megfeleltetes.ts', 'logo/meret.ts', 'rn/a11y.ts', 'rn/Ikon.tsx', 'rn/VezerloIkon.tsx', 'rn/Csempe.tsx', 'rn/Kartya.tsx', 'rn/GoogleG.tsx',
  'web/Ikon.tsx', 'web/VezerloIkon.tsx', 'web/Csempe.tsx', 'web/Kartya.tsx', 'web/Logo.tsx', 'web/GoogleG.tsx'];

// a teszt a saját ideiglenes mappáit a végén eltakarítja (V2_TESZT_TMP vagy os.tmpdir() alatt)
const ideiglenes = [];
after(() => { for (const d of ideiglenes) rmSync(d, { recursive: true, force: true }); });

let forditott;
async function komp() {
  if (!forditott) { forditott = fordit(KOMPONENSEK); ideiglenes.push(forditott); }
  return {
    rn: {
      ...(await betolt(forditott, 'rn/Ikon.tsx')), ...(await betolt(forditott, 'rn/Csempe.tsx')), ...(await betolt(forditott, 'rn/Kartya.tsx')),
      ...(await betolt(forditott, 'rn/VezerloIkon.tsx')), ...(await betolt(forditott, 'rn/GoogleG.tsx')),
    },
    web: {
      ...(await betolt(forditott, 'web/Ikon.tsx')), ...(await betolt(forditott, 'web/Csempe.tsx')), ...(await betolt(forditott, 'web/Kartya.tsx')),
      ...(await betolt(forditott, 'web/VezerloIkon.tsx')), ...(await betolt(forditott, 'web/Logo.tsx')), ...(await betolt(forditott, 'web/GoogleG.tsx')),
    },
  };
}
// a React a panelből (csak olvasva) – ugyanaz a példány, amit a lefordított komponensek importálnak
let h = null;
try { h = createRequire(join(V2, '../../panel/package.json'))('react').createElement; } catch { /* nincs panel node_modules: a D3-tesztek kimaradnak */ }

function rnRajz(fa) {
  // View > Svg > Path/Rect – a Svg-t megkeresi, és visszaadja a viewBoxot és az elemeket
  const svg = fa.tipus === 'Svg' ? fa : fa.gyerekek.find((g) => g && g.tipus === 'Svg');
  return { vb: svg.props.viewBox, elemek: svg.gyerekek.map((g) => ({ tipus: g.tipus, d: g.props.d, fill: g.props.fill, fillRule: g.props.fillRule })) };
}
function webRajz(html) {
  const vb = /viewBox="([^"]+)"/.exec(html)[1];
  const elemek = [...html.matchAll(/<(path|rect)\b([^>]*)\/?>/g)].map((m) => ({
    tipus: m[1] === 'path' ? 'Path' : 'Rect', d: /\sd="([^"]+)"/.exec(m[2])?.[1], fill: /\sfill="([^"]+)"/.exec(m[2])?.[1],
  }));
  return { vb, elemek };
}

test('D3: az RN és a webes Ikon ugyanazt rajzolja (viewBox, elemek, színek) mind a 45 ikonra', { skip: !vanPanelModul() && 'nincs kod/panel/node_modules' }, async () => {
  const { rn, web } = await komp();
  const { renderToStaticMarkup } = reactDomServer();
  for (const nev of EMOJI_NEVEK) {
    for (const valtozat of ['szines', 'szurke']) {
      const r = rnRajz(kibont(h(rn.Ikon, { nev, pt: 34, valtozat })));
      const w = webRajz(renderToStaticMarkup(h(web.Ikon, { nev, pt: 34, valtozat })));
      assert.equal(r.vb, EMOJI_ADAT[nev].vb, nev);
      assert.equal(w.vb, EMOJI_ADAT[nev].vb, nev);
      assert.equal(r.elemek.length, EMOJI_ADAT[nev].elemek.length, nev);
      assert.deepEqual(r.elemek.map((e) => [e.tipus, e.d, e.fill]), w.elemek.map((e) => [e.tipus, e.d, e.fill]), `${nev} (${valtozat})`);
      const tabla = valtozat === 'szurke' ? SZURKE_TABLA : null;
      EMOJI_ADAT[nev].elemek.forEach((e, i) => assert.equal(r.elemek[i].fill, tabla ? tabla[e.f] : e.f, nev));
    }
  }
});

test('D3: akadálymentesség – címke nélkül rejtett díszítés, címkével „kép” felirattal (RN és web)', { skip: !vanPanelModul() && 'nincs kod/panel/node_modules' }, async () => {
  const { rn, web } = await komp();
  const { renderToStaticMarkup } = reactDomServer();
  const rejtett = kibont(h(rn.Ikon, { nev: 'irat' }));
  assert.equal(rejtett.tipus, 'View');
  assert.equal(rejtett.props['aria-hidden'], true);
  assert.equal(rejtett.props.accessible, false);
  const cimkes = kibont(h(rn.Ikon, { nev: 'irat', label: 'Irat' }));
  assert.equal(cimkes.props.role, 'img');
  assert.equal(cimkes.props['aria-label'], 'Irat');
  assert.equal(cimkes.props.accessible, true);
  const w1 = renderToStaticMarkup(h(web.Ikon, { nev: 'irat' }));
  assert.match(w1, /aria-hidden="true"/);
  assert.match(w1, /focusable="false"/);
  assert.doesNotMatch(w1, /role="img"/);
  const w2 = renderToStaticMarkup(h(web.Ikon, { nev: 'irat', label: 'Irat' }));
  assert.match(w2, /role="img"/);
  assert.match(w2, /aria-label="Irat"/);
  const v = renderToStaticMarkup(h(web.VezerloIkon, { nev: 'masol' }));
  assert.match(v, /fill="currentColor"/);
  assert.match(v, /aria-hidden="true"/);
  const logo = renderToStaticMarkup(h(web.Logo, { meret: 30 }));
  assert.match(logo, /alt="Adózz.hu"/);
  assert.match(logo, /width="138"/);
});

test('D3: Csempe – semleges #F1F3F9 csempe, a méretnek megfelelő ikonnal (RN és web)', { skip: !vanPanelModul() && 'nincs kod/panel/node_modules' }, async () => {
  const { rn, web } = await komp();
  const { renderToStaticMarkup } = reactDomServer();
  for (const meret of ['kicsi', 'alap', 'nagy']) {
    const m = T.csempe[meret];
    const fa = kibont(h(rn.Csempe, { nev: 'igazolvany', meret }));
    const st = Object.assign({}, ...[fa.props.style].flat(Infinity).filter(Boolean));
    assert.deepEqual([st.width, st.height, st.borderRadius, st.backgroundColor], [m.meret, m.meret, m.sugar, '#F1F3F9'], meret);
    assert.equal(fa.props['aria-hidden'], true);
    const ikon = fa.gyerekek[0];
    assert.equal(rnRajz(ikon).vb, '0 5 32 32'); // KOZEPRE
    const svg = ikon.gyerekek[0];
    assert.equal(svg.props.width, m.ikon);
    const html = renderToStaticMarkup(h(web.Csempe, { nev: 'igazolvany', meret }));
    assert.match(html, meret === 'alap' ? /class="v2-csempe"/ : new RegExp(`class="v2-csempe v2-csempe-${meret}"`));
    assert.match(html, new RegExp(`width="${m.ikon}"`));
  }
});

test('D3: Kártya – fehér, r 20 (gépen 22), kártyaárnyék; a jelzősáv telt szín, nem pasztell alap (RN és web)', { skip: !vanPanelModul() && 'nincs kod/panel/node_modules' }, async () => {
  const { rn, web } = await komp();
  const { renderToStaticMarkup } = reactDomServer();
  const st = rn.kartyaStilus();
  assert.deepEqual([st.backgroundColor, st.borderRadius, st.paddingVertical, st.paddingHorizontal, st.marginBottom, st.boxShadow],
    ['#FFFFFF', 20, 16, 14, 12, T.arnyek.kartya.css]);
  const gep = rn.kartyaStilus({ asztali: true, sor: true, margo: false });
  assert.deepEqual([gep.borderRadius, gep.paddingVertical, gep.paddingHorizontal, gep.marginBottom, gep.flexDirection, gep.gap], [22, 22, 24, 0, 'row', 16]);
  const jelzo = rn.kartyaStilus({ jelzo: T.szin.narancs });
  assert.equal(jelzo.backgroundColor, '#FFFFFF');
  assert.deepEqual([jelzo.borderLeftWidth, jelzo.borderLeftColor], [4, T.szin.narancs]);
  const fa = kibont(h(rn.Kartya, { sor: true }, 'tartalom'));
  assert.equal(fa.tipus, 'View');
  assert.deepEqual(fa.gyerekek, ['tartalom']);
  const html = renderToStaticMarkup(h(web.Kartya, { as: 'section', asztali: true, sor: true, 'aria-label': 'Teendők' }, 'x'));
  assert.match(html, /^<section class="v2-kartya v2-kartya-asztali v2-kartya-sor" aria-label="Teendők">x<\/section>$/);
  const html2 = renderToStaticMarkup(h(web.Kartya, { jelzo: '#9A5B00' }, 'x'));
  assert.match(html2, /style="border-left:4px solid #9A5B00"/);
});

test('D3: vezérlő-ikon és Google „G” – RN és web ugyanaz', { skip: !vanPanelModul() && 'nincs kod/panel/node_modules' }, async () => {
  const { rn, web } = await komp();
  const { renderToStaticMarkup } = reactDomServer();
  for (const nev of VEZERLO_NEVEK) {
    const r = rnRajz(kibont(h(rn.VezerloIkon, { nev, szin: '#10152B' })));
    const html = renderToStaticMarkup(h(web.VezerloIkon, { nev, szin: '#10152B' }));
    assert.equal(r.vb, VEZERLO_VB);
    assert.equal(r.elemek[0].d, VEZERLO_ADAT[nev].d);
    assert.ok(html.includes(`d="${VEZERLO_ADAT[nev].d}"`), nev);
    if (VEZERLO_ADAT[nev].vonal) assert.match(html, /stroke="#10152B"/);
  }
  const g = rnRajz(kibont(h(rn.GoogleG, {})));
  assert.equal(g.elemek.length, 4);
  assert.equal(webRajz(renderToStaticMarkup(h(web.GoogleG, {}))).elemek.length, 4);
});

// ---------------------------------------------------------------- D8: sync

test('D8: a sync-v2 a közös részt + a cél platform mappáját másolja, GENERATED fejléccel', () => {
  const alap = process.env.V2_TESZT_TMP ? resolve(process.env.V2_TESZT_TMP) : tmpdir();
  mkdirSync(alap, { recursive: true });
  const cel = mkdtempSync(join(alap, 'v2-sync-'));
  ideiglenes.push(cel);
  for (const p of ['rn', 'web']) {
    const ide = join(cel, p);
    const r = spawnSync(process.execPath, [join(V2, 'scripts/sync-v2.mjs'), ide, `--${p}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const f of ['index.ts', 'tokenek.ts', 'ikon/emoji-adat.ts', 'ikon/material.ts', 'logo/logo.png', 'logo/meret.ts', 'LICENCEK.md', 'licencek/LICENSE_fluentui-emoji_MIT.txt', `${p}/index.ts`, `${p}/Ikon.tsx`, `${p}/Csempe.tsx`, `${p}/Kartya.tsx`]) {
      assert.ok(existsSync(join(ide, f)), `${p}: hiányzik ${f}`);
    }
    assert.ok(!existsSync(join(ide, p === 'rn' ? 'web' : 'rn')), `${p}: a másik platform is átment`);
    assert.ok(!existsSync(join(ide, 'teszt')) && !existsSync(join(ide, 'scripts')));
    assert.ok(readFileSync(join(ide, `${p}/Ikon.tsx`), 'utf8').startsWith('// GENERATED from kod/shared/v2'));
    assert.deepEqual(readFileSync(join(ide, 'logo/logo.png')), readFileSync(join(V2, 'logo/logo.png')));
  }
  assert.ok(readFileSync(join(cel, 'web/web/v2.css'), 'utf8').startsWith('/* GENERATED from kod/shared/v2'));
  const rossz = spawnSync(process.execPath, [join(V2, 'scripts/sync-v2.mjs'), join(cel, 'x')], { encoding: 'utf8' });
  assert.equal(rossz.status, 2);
});
