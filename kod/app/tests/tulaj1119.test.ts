// SPEC §27 (tulaj-kérések 11-19) – az EGY lista (journey) tartaléka, a módosítható elágazás, a határidő-szöveg, a kép
// alatti őszinte sor, és a kiállított számlák egységes szóhasználata az app forrásában.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssistView, OnboardingState } from '../src/_shared/api.ts';
import { hataridoIg, munkanapotHozzaad, utEpit, utvaltasInfo } from '../src/lib/ut.ts';
import { kepCimke, vanRajzolt } from '../src/lib/utmutato.ts';
import { INVOICE_WORDING_FORBIDDEN_PATTERNS, JOURNEY_TEXTS } from '../src/_shared/bekotes.ts';
import { GUIDE_IMAGE_LABELS, JOURNEY_ORDER } from '../src/_shared/enums.ts';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const BENCE = {
  id: 'b', displayName: 'Kovács Bence', firstName: 'Bence', nameForms: { with: 'Bencével', from: 'Bencétől', onto: 'Bencére', acc: 'Bencét' },
  title: 'Mérlegképes könyvelő', registrationNumber: '123456', avatarKey: 'karakter_1_lapos', signatureSvgPath: '', responseTimeText: '',
};
function allapot(path: OnboardingState['path'], lepesek: Record<string, string> = {}, extra: Partial<OnboardingState> = {}): OnboardingState {
  const sor = ['fiok', 'adatok', ...(path === 'inditas' ? ['vallalkozas_inditas'] : []), 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'];
  return {
    steps: sor.map((step) => ({ step: step as never, status: (lepesek[step] ?? (step === 'fiok' ? 'kesz' : step === 'nav_bekotes' ? 'nincs_kezdve' : 'ugyfelre_var')) as never })),
    milestones: [], todoCount: 0, accountant: BENCE as never, path, registration: null, callback: null, appointmentsEnabled: false, meghatalmazasMethods: ['onya_ugyfel', 'onya_konyvelo'],
    ...extra,
  };
}
const assist = (x: Partial<AssistView>): AssistView => ({
  id: 'a1', kind: 'vallalkozas_bejelentes', status: 'visszahivas_kerve', statusText: '', ball: 'csapat', callbackId: null, createdAt: '2026-11-17T09:00:00Z', approval: null,
  clientApprovedAt: null, meghatalmazasLiveAt: null, consent: null, canConsent: false, evFiledAt: null, canCancel: true, closedReason: null, closedAt: null, ...x,
});

test('nincs válasz: 1 teendő, csak a kérdés, szürke előnézet (S2, K4.1)', () => {
  const j = utEpit({ o: allapot(null), ma: '2026-11-19' });
  assert.equal(j.variant, 'nincs');
  assert.equal(j.todoCount, 1);
  assert.equal(j.bandTitle, JOURNEY_TEXTS.bandStart);
  assert.equal(j.currentKey, 'ut');
  assert.equal(j.preview.length, 6);
  assert.deepEqual(j.steps.map((s) => s.key), ['ut']);
});

test('meglévő vállalkozás: egy „Most ez jön”, az előfizetés a szerződésig zárva, egy szám (K4.1, K4.3)', () => {
  const j = utEpit({ o: allapot('van'), ma: '2026-11-19', keresekDb: 1 });
  assert.deepEqual(j.steps.map((s) => s.key), [...JOURNEY_ORDER.van]);
  assert.equal(j.steps.filter((s) => s.state === 'most').length, 1);
  assert.equal(j.currentKey, 'adatok');
  const elo = j.steps.find((s) => s.key === 'elofizetes')!;
  assert.equal(elo.state, 'kesobb');
  assert.match(elo.lockedReason ?? '', /szerződést/);
  // adatok, szerződés, meghatalmazás, igazolványok, előfizetés + 1 nyitott könyvelői kérés
  assert.equal(j.todoCount, 6);
  assert.match(j.bandTitle, /Még 6 dolog kell tőled/);
  assert.match(j.lockedSheetText, /Ebből 6 a tiéd/);
});

test('minden lépés kész a kliens részéről: a sáv azt mondja, ki dolgozik (bandNone + várakozó kártya)', () => {
  const j = utEpit({ o: allapot('van', { adatok: 'kesz', szerzodes: 'kesz', meghatalmazas: 'kesz', azonositas: 'kesz', elofizetes: 'kesz' }), ma: '2026-11-19' });
  assert.equal(j.todoCount, 0);
  assert.equal(j.currentKey, null);
  assert.equal(j.waiting?.key, 'nav_bekotes');
  assert.match(j.bandTitle, /Most nincs teendőd\. Bence dolgozik rajta\./);
});

test('Intézzük helyetted: a jóváhagyás határidővel a „Most ez jön” (S16)', () => {
  const o = allapot('inditas', { adatok: 'kesz', szerzodes: 'kesz' }, {
    registrationMode: 'segitett',
    registration: { id: 'r', status: 'utmutato', statusText: '' },
    assists: [assist({ status: 'meghatalmazas_bekuldve', approval: { filedAt: '2026-11-18T09:00:00Z', dueOn: '2026-11-21', dueText: 'november 21-ig', daysLeft: 2, lastDay: false, expiredCount: 0 } })],
  });
  const j = utEpit({ o, ma: '2026-11-19' });
  assert.equal(j.variant, 'inditas_segitett');
  assert.equal(j.currentKey, 'meghatalmazas');
  const s = j.steps.find((x) => x.key === 'meghatalmazas')!;
  assert.equal(s.dueText, 'november 21-ig (még 2 nap)');
  assert.equal(s.action?.route, '/bekotes/meghatalmazas/jovahagyas');
  assert.equal(j.steps.find((x) => x.key === 'bejelentes')?.clientPart, false);
});

test('módosítható elágazás: beküldés után csak visszahívással (§27.2.1)', () => {
  const nyitott = utvaltasInfo(allapot('inditas', {}, { registration: { id: 'r', status: 'utmutato', statusText: '' } }));
  assert.equal(nyitott.canChange, true);
  assert.match(nyitott.confirmText ?? '', /most indítod/);
  const zart = utvaltasInfo(allapot('inditas', {}, { registration: { id: 'r', status: 'beadva', statusText: '' } }));
  assert.equal(zart.canChange, false);
  assert.equal(zart.blocker, 'bejelentes_bekuldve');
  const van = utvaltasInfo(allapot('van'));
  assert.equal(van.canChange, true);
  assert.match(van.confirmText ?? '', /már van vállalkozásod/);
});

test('határidő „-ig” alakban, munkanapok hétvége nélkül', () => {
  assert.equal(hataridoIg('2026-11-22'), 'november 22-ig');
  assert.equal(hataridoIg('2026-12-01'), 'december 1-ig');
  assert.equal(munkanapotHozzaad('2026-11-20', 1), '2026-11-23'); // péntek + 1 munkanap = hétfő
});

test('a kép alatti őszinte sor (§27.1.2, K1.2)', () => {
  assert.equal(kepCimke({ kind: 'illusztracio', source: null }), GUIDE_IMAGE_LABELS.illusztracio);
  assert.equal(kepCimke({ kind: 'kepernyokep', source: { title: 'NAV: „Megújul az Ügysegéd” – kisfilm', url: 'x', date: '2026-02-19' } }), 'NAV-képernyő · Forrás: NAV, „Megújul az Ügysegéd” – kisfilm, 2026.02.19.');
  assert.equal(kepCimke({ kind: 'kepernyokep', source: { title: 'Saját képernyőkép a NAV Vállalkozói Ügysegédről', url: '', date: '2026-11-20' } }), 'NAV-képernyő · Forrás: saját képernyőkép, 2026.11.20.');
  const m = JSON.parse(readFileSync(join(app, '../media/utmutato/meghatalmazas/kepek.json'), 'utf8'));
  assert.equal(vanRajzolt(m), m.items.some((i: { kind: string }) => i.kind === 'illusztracio'));
  assert.equal(vanRajzolt({ ...m, items: m.items.map((i: object) => ({ ...i, kind: 'kepernyokep' })) }), false);
});

test('kiállított számlák: egyik tiltott fordulat sincs az app forrásában (§27.5.4, K5.1)', () => {
  const minták = INVOICE_WORDING_FORBIDDEN_PATTERNS.map((p) => new RegExp(p, 'iu'));
  const talalat: string[] = [];
  const bejar = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== '_shared' && f !== '_jogi') bejar(p);
      } else if (/\.(tsx?|json)$/.test(f)) {
        readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
          if (!/szándékos/.test(l) && minták.some((r) => r.test(l))) talalat.push(`${p}:${i + 1}`);
        });
      }
    }
  };
  bejar(join(app, 'src'));
  assert.deepEqual(talalat, []);
});

test('„anyukád”: az app forrásában nincs „anyád” / „édesanyád” (§27.0.2/5, K4.4)', () => {
  const talalat: string[] = [];
  const bejar = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== '_shared' && f !== '_jogi') bejar(p);
      } else if (/\.tsx?$/.test(f)) {
        readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
          if (/(^|[^\p{L}])(anyád|édesanyád)/iu.test(l) && !/szándékos/.test(l)) talalat.push(`${p}:${i + 1}`);
        });
      }
    }
  };
  bejar(join(app, 'src'));
  assert.deepEqual(talalat, []);
});
