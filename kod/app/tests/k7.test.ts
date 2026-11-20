// SPEC §29 (k7, B3) – a vezetett első indulás útválasztása (lib/bevezeto.ts), a kártyás engedély megjelenítése, és a
// szöveg-szabályok: nincs díjmentes időszak, nincs DEMO jel a valódi árak mellett.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bevezetoCel, lepesCel, vezetettHref } from '../src/lib/bevezeto.ts';
import type { GuidedStepView, GuidedView } from '../src/_shared/k29g.ts';
import { GUIDED_ORDER } from '../src/_shared/k29g.ts';
import { CARD_CONSENT_TEXT } from '../src/_shared/k29.ts';

const lepes = (key: string, state: GuidedStepView['state'], route: string | null = `/bekotes/${key}`): GuidedStepView => ({ key: key as never, title: key, state, route, timeText: null, actorLabel: 'Te', doneForClient: state === 'kesz' || state === 'var' });
const nezet = (o: Partial<GuidedView>): GuidedView => ({
  show: true, paused: false, inOnboarding: true, firstName: 'Péter', variant: 'van', welcome: { seen: true, accountant: null, priceHuf: 19999, rows: [] },
  steps: [lepes('ut', 'kesz', '/bevezeto/ut'), lepes('adoszam', 'kesz', '/bevezeto/adoszam'), lepes('adatok', 'kesz'), lepes('szerzodes', 'most'), lepes('meghatalmazas', 'kesobb'), lepes('elofizetes', 'kesobb')],
  currentKey: 'szerzodes', progress: { done: 3, total: 6 }, finished: false, pending: [], waiting: null, lastKey: null, doneSeen: false, ...o,
});

test('vezetett: a jelenlegi lépés a meglévő képernyő ?vezetett=<lépés> paraméterrel; a saját képernyők változatlanok', () => {
  assert.equal(bevezetoCel(nezet({}), {}), '/bekotes/szerzodes?vezetett=szerzodes');
  assert.equal(lepesCel({ key: 'adoszam', route: '/bevezeto/adoszam' }), '/bevezeto/adoszam');
  assert.equal(vezetettHref('/bekotes/adatok?utana=x', 'adatok'), '/bekotes/adatok?utana=x&vezetett=adatok');
});

test('vezetett: üdvözlő képernyők előbb; kész → a kész-képernyő; aktív ügyfél → Főoldal', () => {
  assert.equal(bevezetoCel(nezet({ welcome: { seen: false, accountant: null, priceHuf: 19999, rows: [] } }), {}), '/bevezeto/udv');
  assert.equal(bevezetoCel(nezet({ currentKey: null, finished: true }), {}), '/bevezeto/kesz');
  assert.equal(bevezetoCel(nezet({ inOnboarding: false }), {}), '/');
});

test('vezetett: „Vissza” az előző (nem zárt) lépésre, az elsőn a 3. üdvözlő lapra', () => {
  assert.equal(bevezetoCel(nezet({}), { vissza: 'szerzodes' }), '/bekotes/adatok?vezetett=adatok');
  assert.equal(bevezetoCel(nezet({}), { vissza: 'adoszam' }), '/bevezeto/ut');
  assert.equal(bevezetoCel(nezet({}), { vissza: 'ut' }), '/bevezeto/udv?lap=3');
});

test('vezetett: átadás után (a lépés „var”) egyszer a várakozó képernyő, a többi lépés nem akad el', () => {
  const v = nezet({ steps: [lepes('ut', 'kesz'), lepes('meghatalmazas', 'var'), lepes('azonositas', 'most')], currentKey: 'azonositas' });
  assert.equal(bevezetoCel(v, { utan: 'meghatalmazas' }), '/bevezeto/var?lepes=meghatalmazas');
  assert.equal(bevezetoCel(v, { utan: 'azonositas' }), '/bekotes/azonositas?vezetett=azonositas');
});

test('vezetett sorrend: a szerződés a NAV-meghatalmazás előtt, az azonosítás a kártya előtt (SPEC §29.10.2)', () => {
  for (const v of ['van', 'inditas_segitett'] as const) {
    const o = GUIDED_ORDER[v];
    assert.ok(o.indexOf('szerzodes') < o.indexOf('meghatalmazas'), v);
    assert.ok(o.indexOf('azonositas') < o.indexOf('elofizetes'), v);
  }
  assert.deepEqual(GUIDED_ORDER.van.slice(0, 3), ['ut', 'adoszam', 'adatok']);
});

test('kártyás engedély: lemondás, 3 napos értesítés, Stripe, csak jóváhagyott külön díj (SPEC §29.1.3)', () => {
  assert.match(CARD_CONSENT_TEXT, /3 nappal/);
  assert.match(CARD_CONSENT_TEXT, /Lemondom/);
  assert.match(CARD_CONSENT_TEXT, /Stripe/);
  assert.match(CARD_CONSENT_TEXT, /ha az appban jóváhagyom/);
});

function fajlok(dir: string, ki: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === '_shared' || n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fajlok(p, ki);
    else if (/\.(tsx?|json)$/.test(n)) ki.push(p);
  }
  return ki;
}

test('nincs díjmentes időszak az appban (SPEC §29.4.2 grep)', () => {
  const tilos = /ingyenes(en)? (próba|hónap)|próbaid|addig minden ingyenes|amíg nincs adószámod, nem fizetsz/i;
  const hibak = fajlok('src')
    .filter((p) => !p.includes('simplepay') || true)
    .flatMap((p) => readFileSync(p, 'utf8').split('\n').map((s, i) => [p, i + 1, s] as const))
    // a jogi szöveg előzménye (elozo_valasz) szándékosan a régi mondat – a backend csak e szerint írja át az élő sort
    .filter(([p, , s]) => tilos.test(s) && !/elozo_valasz/.test(s) && !(p.endsWith('app_szovegek.json') && /elozo/.test(s)));
  assert.deepEqual(hibak.map(([p, i]) => `${p}:${i}`), []);
});

test('nincs DEMO jel a díjak mellett (Díjak és számlák, SPEC §29.4.1)', () => {
  const dijak = readFileSync('src/app/fiok/dijak.tsx', 'utf8');
  assert.doesNotMatch(dijak, /DemoDij/);
});
