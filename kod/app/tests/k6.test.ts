// SPEC §28 + §28.K (k6) – a függőség nélküli részek: a változás-útmutató felépítése, a MINTA félreteendő-szabálya,
// a díjak és a 19 999 Ft, a válaszidő-ígéret tilalma az app forrásában.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { kitoltetlen, valtozasFajta, valtozasUtmutatoEpit } from '../src/lib/utmutato.ts';
import { k28Home, k28Kezdo, k28SzamlaTartalek } from '../src/api/minta/k28.ts';
import { CHANGE_KINDS, changeFeeKind, FEE_DEFAULTS, RESPONSE_TIME_FORBIDDEN_PATTERNS } from '../src/_shared/enums.ts';
import brand from '../src/_shared/brand.json' with { type: 'json' };

test('változás-útmutató: mind a 6 fajta felépül, nincs kitöltetlen helyőrző, a lépések számozottak (§28.5.3)', () => {
  for (const k of CHANGE_KINDS) {
    assert.ok(valtozasFajta(k));
    const g = valtozasUtmutatoEpit(k, { change: null, firstName: 'Bence', kesz: [], ma: '2026-11-19' });
    assert.ok(g.steps.length >= 5, `${k}: kevés lépés`);
    assert.deepEqual(kitoltetlen(g), [], `${k}: kitöltetlen helyőrző`);
    assert.equal(g.video, null);
    assert.deepEqual(g.steps.map((s) => s.n), g.steps.map((_, i) => i + 1));
  }
  assert.equal(valtozasFajta('vallalkozas_bejelentes'), false);
});

test('változás-útmutató: a megadott cím mezőnként, másolható értékekkel (§28.5.3)', () => {
  const g = valtozasUtmutatoEpit('valtozas_szekhely', {
    change: { kind: 'valtozas_szekhely', address: { zip: '1117', city: 'Budapest', streetName: 'Próba', streetType: 'utca', houseNumber: '3' }, effectiveOn: '2026-12-01' },
    firstName: 'Bence', kesz: [], ma: '2026-11-19',
  });
  const mezok = g.steps.find((s) => s.key === 'valtozas_uj_szekhely')?.fields ?? [];
  assert.ok(mezok.some((f) => f.value === '1117' && f.copyValue === '1117'));
  assert.ok(mezok.some((f) => /2026\. december 1\./.test(f.value ?? '')));
  // 2027-től a kamara vezeti a nyilvántartást: az Ügysegéd-útmutató elavult, az adóadat (ONYA) nem
  assert.equal(valtozasUtmutatoEpit('valtozas_szekhely', { change: null, firstName: 'B', kesz: [], ma: '2027-01-02' }).outdated, true);
  assert.equal(valtozasUtmutatoEpit('valtozas_adoadat', { change: null, firstName: 'B', kesz: [], ma: '2027-01-02' }).outdated, false);
});

test('MINTA félretenni: 240 000 Ft-os számla az adómentes rész után → kb. 20 000 Ft, csak SZJA, felfelé kerekítve (§28.1.2)', () => {
  const st = k28Kezdo('kata', '2026-11-17');
  const r = k28SzamlaTartalek(st, 'nav-KSZ-2026-033', '2026-11-17', true)!;
  assert.equal(r.rawHuf, 19_800); // 240 000 × 55% × 15%
  assert.equal(r.reserveHuf, 20_000);
  assert.equal(r.zone, 'csak_szja');
  assert.match(r.line, /240 000 Ft-os számla – ebből kb\. 20 000 Ft-ot tegyél félre\./);
  // az év elején még az adómentes részben jár
  const jan = k28SzamlaTartalek(st, 'nav-KSZ-2026-001', '2026-11-17', true)!;
  assert.equal(jan.reserveHuf, 0);
  assert.equal(jan.zone, 'adomentes');
  // bekötés alatt nincs (adóadat)
  assert.equal(k28SzamlaTartalek(st, 'nav-KSZ-2026-033', '2026-11-17', false), undefined);
});

test('MINTA főoldal: félretenni = A − B felfelé ezresre, két nagy szám, kedvezmény-tipp csak válasz nélkül (§28.1.6, §28.K.12)', () => {
  const h = k28Home(k28Kezdo('kata', '2026-11-17'), '2026-11-17', true);
  const c = h.reserve!;
  assert.equal(c.keepNowHuf % 1000, 0);
  assert.ok(c.keepNowHuf >= c.accruedHuf - c.dueOrPaidHuf);
  assert.ok(c.keepNowHuf - (c.accruedHuf - c.dueOrPaidHuf) < 1000);
  assert.equal(h.twoNumbers?.revenueHuf, h.earnings?.ytdRevenueHuf);
  assert.equal(h.allowancesHint?.show, true);
  assert.equal(k28Home(k28Kezdo('eszter', '2026-11-17'), '2026-11-17', true).allowancesHint?.show, false);
  assert.equal(k28Home(k28Kezdo('kata', '2026-11-17'), '2026-11-17', false).reserve, null);
});

test('díjak: 19 999 Ft havidíj, előre fizetett változás-díjak, a saját bejelentés ingyenes (§28.K.1)', () => {
  assert.equal(brand.priceHufMonthlyGross, 19_999);
  assert.equal(FEE_DEFAULTS.havidij.amountHuf, 19_999);
  assert.equal(changeFeeKind('valtozas_szekhely'), 'valtozas_egyszeru');
  assert.equal(changeFeeKind('valtozas_adoadat', ['munkavegzes']), 'valtozas_jogallas');
  assert.equal(changeFeeKind('valtozas_adoadat', ['atalany_kilepes']), null);
  assert.equal(FEE_DEFAULTS.valtozas_egyszeru.amountHuf, 4_999);
  assert.equal(FEE_DEFAULTS.valtozas_jogallas.amountHuf, 7_999);
});

function fajlok(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === '_shared' || f === '_jogi') return [];
    return statSync(p).isDirectory() ? fajlok(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

test('nincs válaszidő-ígéret és „20 000 Ft” ár az app forrásában (§28.K.15, §28.K.1)', () => {
  const hibak: string[] = [];
  for (const p of fajlok(join(import.meta.dirname, '..', 'src'))) {
    const s = readFileSync(p, 'utf8');
    for (const re of RESPONSE_TIME_FORBIDDEN_PATTERNS) if (new RegExp(re, 'i').test(s)) hibak.push(`${p}: ${re}`);
    // árként: „havi 20 000”, „20 000 Ft/hó”, „20 000 Ft-ért”, priceHuf/maxAmount 20000 (a „kb. 20 000 Ft-ot tegyél félre” nem ár)
    if (/havi\s+20[  .]?000|20[  .]?000\s*Ft\s*\/\s*hó|20[  .]?000 Ft-ért|(price|Price|maxAmount)\w*:\s*20_?000\b/.test(s)) hibak.push(`${p}: 20 000 Ft ár`);
  }
  assert.deepEqual(hibak, []);
});
