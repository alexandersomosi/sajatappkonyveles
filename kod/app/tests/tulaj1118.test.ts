// SPEC §26 (tulaj-kérések 11-18) – az app tiszta logikája: tevékenység-kereső, útmutató-építés és -képek, magyarázatok
// (ikon, tárgykép, három blokk), korlátozott mód tartaléka, telefonszám, ÁFA-mentes adószám, normalizált kepek.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tevekenysegKeres, ekezetNelkul, koltseghanyadSzoveg, jarulekSzoveg, MIN_JARULEK_2026 } from '../src/lib/tevekenyseg.ts';
import { kepekLepeshez, utmutatoEpit, kitoltetlen } from '../src/lib/utmutato.ts';
import { hozzaferesBol, zarva } from '../src/lib/hozzaferes.ts';
import { adoszamAfaMentesHiba } from '../src/lib/validators.ts';
import { ONBOARDING_EXPLAINERS, STEP_EXPLAINER, PREPARE_ITEMS, normalizeHuPhone, maskHuPhone } from '../src/_shared/bekotes.ts';
import { GUIDE_STEP_KEYS, CLIENT_FEATURES } from '../src/_shared/enums.ts';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');

const valasz = {
  declarations: { noExclusion: true, singleBusiness: true, acceptedAt: '2026-11-17T10:00:00Z' },
  revenueBand: 'max_12m' as const,
  activities: [
    { key: 'foto', label: 'Fotózás, képszerkesztés', main: true, ovtjKod: null, navKereso: 'fotó' },
    { key: 'video', label: 'Videókészítés, vágás', main: false, ovtjKod: null, navKereso: 'film' },
  ],
  activityFreeText: null,
  seat: { kind: 'lakcim' as const, address: null, right: null, provider: null },
  otherSites: [],
  workKind: 'fofoglalkozas' as const,
  euPartner: 'nem' as const,
  startPlan: 'mielobb' as const,
  startDate: null,
  hasSeparateBusinessAccount: true,
};
const kornyezet = (eu: 'igen' | 'nem' | 'nem_tudom') => ({
  answers: { ...valasz, euPartner: eu },
  nev: 'Tóth Levente',
  lakcim: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' },
  konyvelo: { nev: 'Kovács Bence', firstName: 'Bence', adoazonosito: '8428621233', nyilvantartasiSzam: '123456' },
  ugykorok: ['ADÓÜGYEK', 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)'],
  kesz: ['belepes'],
  ma: '2026-11-18',
});

test('tevékenység-kereső: ékezet nélkül is talál (O1.7: „foto” → Fotózás)', () => {
  assert.equal(tevekenysegKeres('foto')[0]?.key, 'foto');
  assert.equal(tevekenysegKeres('FOTÓ')[0]?.key, 'foto');
  assert.ok(tevekenysegKeres('programozas').some((a) => a.key === 'szoftver'));
  assert.ok(tevekenysegKeres('fodrasz').some((a) => a.key === 'fodraszat'));
  assert.equal(tevekenysegKeres('').length, 0);
  assert.ok(tevekenysegKeres('a').length <= 8);
  assert.equal(ekezetNelkul('Árvíztűrő  Tükörfúrógép'), 'arvizturo tukorfurogep');
});

test('költséghányad és járulék tájékoztató szöveg (SPEC §26.1.3)', () => {
  assert.match(koltseghanyadSzoveg({ key: 'grafika' }, 'Bence') ?? '', /45%.*2027-től az általános költséghányad 50%.*Bence megerősíti/);
  // SPEC §27 (k3_kor2 adó 2): a fényképészet az Szja tv. 53. § (2) i) szerint 80%-os.
  assert.match(koltseghanyadSzoveg({ key: 'foto' }, 'Bence') ?? '', /80%/);
  assert.match(koltseghanyadSzoveg({ key: 'fodraszat' }, 'Bence') ?? '', /80%/);
  assert.equal(koltseghanyadSzoveg({ key: 'masszazs' }, 'Bence'), 'A költséghányadot Bence mondja meg.');
  assert.equal(koltseghanyadSzoveg({ key: null }, 'Bence'), 'A költséghányadot Bence mondja meg.');
  assert.equal(MIN_JARULEK_2026, 101_682);
  assert.match(jarulekSzoveg('fofoglalkozas') ?? '', /101 682 Ft|101 682 Ft/);
  assert.match(jarulekSzoveg('munkaviszony_mellett') ?? '', /nincs legkisebb járulék/);
  // k3_kor2 adó 7: szakképzettséget igénylő munkánál a garantált bérminimum is látszik; „egyben utalod” nincs.
  assert.match(jarulekSzoveg('fofoglalkozas', true) ?? '', /117\s558\sFt/);
  assert.doesNotMatch(jarulekSzoveg('fofoglalkozas') ?? '', /egyben utalod/);
});

test('útmutató: minden helyőrző kitöltve, közösségi adószám a válasz szerint (O1.3)', () => {
  for (const eu of ['igen', 'nem', 'nem_tudom'] as const) {
    const g = utmutatoEpit('vallalkozas_bejelentes', kornyezet(eu));
    assert.equal(g.steps.length, 14);
    assert.deepEqual(g.steps.map((s) => s.key), [...GUIDE_STEP_KEYS.vallalkozas_bejelentes]);
    assert.deepEqual(kitoltetlen(g), [], `kitöltetlen: ${eu}`);
    const afa = g.steps.find((s) => s.key === 'adozas_afa');
    const kozossegi = afa?.fields.filter((f) => /Közösségi adószám/.test(f.label)) ?? [];
    assert.equal(kozossegi.length, 1);
    assert.equal(kozossegi[0].action, eu === 'igen' ? 'jelold' : 'ne_jelold');
    assert.ok(afa?.fields.some((f) => /alanyi adómentesség/.test(f.label) && f.action === 'jelold'));
    const munka = g.steps.find((s) => s.key === 'adozas_munkavegzes');
    assert.match(munka?.fields[0].value ?? '', /főfoglalkozású/);
    assert.equal(g.steps[0].done, true);
    assert.equal(g.prepare.length, PREPARE_ITEMS.length);
    assert.equal(g.outdated, false);
  }
  const m = utmutatoEpit('meghatalmazas', kornyezet('nem'));
  assert.equal(m.steps.length, 8);
  assert.deepEqual(kitoltetlen(m), []);
  assert.equal(m.prepare.length, 0);
  const adatok = m.steps.find((s) => s.key === 'onya_meghatalmazott');
  assert.ok(adatok?.fields.some((f) => f.copyValue === '8428621233'));
  assert.ok(utmutatoEpit('meghatalmazas', { ...kornyezet('nem'), ma: '2027-01-02' }).outdated);
});

test('soha nem kérünk TAJ-t vagy anyja nevét – csak a NAV-os űrlapba írja (order 8)', () => {
  for (const p of PREPARE_ITEMS.filter((x) => /TAJ|Anyukád/.test(x.label))) assert.equal(p.storedByUs, false);
  // SPEC §27.0.2/5: az ügyfélnek szóló szövegben „anyukád”, soha „anyád” / „édesanyád”.
  for (const p of PREPARE_ITEMS) assert.doesNotMatch(`${p.label} ${p.note} ${p.privacyNote ?? ''}`, /anyád|édesanyád/i);
});

test('kepek.json: a normalizáló kimenete teljes, a változatok helyesen választódnak (O9.1)', () => {
  for (const kind of ['vallalkozas_bejelentes', 'meghatalmazas'] as const) {
    const f = join(app, '../media/utmutato', kind, 'kepek.json');
    if (!existsSync(f)) return; // a normalizáló még nem futott (node scripts/utmutato-kepek.mjs)
    const m = JSON.parse(readFileSync(f, 'utf8'));
    assert.equal(m.kind, kind);
    for (const k of m.items) {
      assert.ok((GUIDE_STEP_KEYS[kind] as readonly string[]).includes(k.stepKey), k.stepKey);
      assert.ok(existsSync(join(dirname(f), k.file)), k.file);
      if (k.file2x) assert.ok(existsSync(join(dirname(f), k.file2x)), k.file2x);
      assert.ok(['kepernyokep', 'illusztracio'].includes(k.kind));
      if (k.kind === 'kepernyokep') assert.ok(k.source?.url, `forrás nélkül: ${k.file}`);
    }
    const kepes = new Set(m.items.map((k: { stepKey: string }) => k.stepKey));
    assert.deepEqual(m.missing, GUIDE_STEP_KEYS[kind].filter((s) => !kepes.has(s)));
    if (kind === 'vallalkozas_bejelentes') {
      assert.equal(kepekLepeshez(m, 'adozas_munkavegzes', { workKind: 'nyugdij_mellett' })[0]?.file, '07_adozas_munkavegzes_nyugdij_mellett.png');
      assert.equal(kepekLepeshez(m, 'adozas_munkavegzes', {}).length, 1);
      const afa = kepekLepeshez(m, 'adozas_afa', { euPartner: 'nem_tudom' });
      assert.deepEqual(afa.map((k) => k.file), ['09_adozas_afa_mentesseg.png', '10_adozas_afa_tobbi_eu_nem.png']);
      assert.equal(kepekLepeshez(m, 'feltoltes_appban', {}).length, 0);
    } else {
      assert.equal(kepekLepeshez(m, 'onya_meghatalmazott', {}).length, 3);
    }
  }
});

test('magyarazatok: minden tételnek három nem üres blokkja és jóváhagyott 3D ikonja van (O5.1)', () => {
  const jegyzek = readFileSync(join(app, 'src/theme/kepjegyzek.ts'), 'utf8');
  const kulcsok = new Set([...jegyzek.matchAll(/^ {2}"([a-z_0-9]+)":/gm)].map((m) => m[1]));
  for (const e of ONBOARDING_EXPLAINERS) {
    assert.ok(e.title.trim() && e.what.trim() && e.why.trim() && e.where.trim(), e.key);
    assert.ok(kulcsok.has(e.icon), `nincs ilyen 3D ikon: ${e.icon} (${e.key})`);
    if (e.illustration) assert.ok(kulcsok.has(e.illustration), `nincs ilyen tárgykép: ${e.illustration}`);
    assert.doesNotMatch(`${e.what} ${e.why} ${e.where}`, /\bAI\b|mesterséges intelligencia/i);
  }
  for (const k of Object.values(STEP_EXPLAINER)) assert.ok(ONBOARDING_EXPLAINERS.some((e) => e.key === k), k);
  // a lakcímkártya hátoldalát soha nem kérjük (Pmt. 7. § (8) a), O7.4)
  const lakcim = ONBOARDING_EXPLAINERS.find((e) => e.key === 'lakcimkartya_foto');
  assert.match(lakcim?.why ?? '', /hátoldalát ne fotózd le/);
});

test('korlátozott mód tartaléka a lifecycle-ból (régebbi szerver)', () => {
  const me = { client: { lifecycle: 'bekotes_alatt' }, accountant: { firstName: 'Bence' } } as never;
  const a = hozzaferesBol(me);
  assert.equal(a.mode, 'korlatozott');
  assert.equal(a.features.length, CLIENT_FEATURES.length);
  assert.ok(zarva(a, 'dosszie'));
  assert.ok(zarva(a, 'hataridok'));
  assert.ok(zarva(a, 'feltoltes'));
  assert.ok(!zarva(a, 'feltoltes', true));
  assert.ok(!zarva(a, 'uzenetek'));
  assert.ok(!zarva(a, 'visszahivas'));
  assert.ok(!zarva(a, 'fiok'));
  assert.match(a.features.find((f) => f.feature === 'dosszie')?.reason ?? '', /^A bekötés után nyílik meg\./);
  assert.match(a.features.find((f) => f.feature === 'igazolas_keres')?.reason ?? '', /Bence/);
  const aktiv = hozzaferesBol({ client: { lifecycle: 'aktiv' } } as never);
  assert.equal(aktiv.mode, 'teljes');
  assert.ok(!zarva(aktiv, 'dosszie'));
});

test('telefonszám és ÁFA-mentes adószám', () => {
  assert.equal(normalizeHuPhone('06 30 123 4567'), '+36301234567');
  assert.equal(normalizeHuPhone('+36 1 234 5678'), '+3612345678');
  assert.equal(normalizeHuPhone('123'), null);
  assert.equal(maskHuPhone('+36301234567'), '+36 30 *** **67');
  assert.equal(adoszamAfaMentesHiba('68801234-1-41'), null);
  assert.match(adoszamAfaMentesHiba('68801234-2-41') ?? '', /nem ÁFA-mentes/);
  assert.match(adoszamAfaMentesHiba('68801235-1-41') ?? '', /nem létezhet/);
});
