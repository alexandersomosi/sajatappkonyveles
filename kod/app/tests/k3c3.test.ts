// Review k3c2 fixes (app side): video length label, free text next to a list activity in the guide, the hold banner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoHossz } from '../src/lib/format.ts';
import { ACTIVITY_PENDING_BANNER, activityPending, personaliseGuide } from '../src/_shared/bekotes.ts';

test('videó hossza: lefelé kerekít, mint a lejátszó, és soha nem ír 1:60-at', () => {
  assert.equal(videoHossz(107.9), '1:47');
  assert.equal(videoHossz(148.6), '2:28');
  assert.equal(videoHossz(119.6), '1:59');
  assert.equal(videoHossz(0), null);
});

test('a saját szavaival írt tevékenység a listás mellett sem vész el', () => {
  const answers = {
    activities: [{ key: 'masszazs', label: 'Masszázs', main: true, ovtjKod: '960401', navKereso: 'fizikai közérzet' }],
    activityFreeText: 'Babaúszás-oktatás uszodában',
    seat: { kind: 'lakcim' as const, address: null, provider: null },
    otherSites: [],
    workKind: 'fofoglalkozas' as const,
    euPartner: 'nem' as const,
    startPlan: 'mielobb' as const,
  };
  assert.equal(activityPending(answers), true);
  const g = personaliseGuide('vallalkozas_bejelentes', {
    answers,
    nev: 'Minta Anna',
    lakcim: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
    konyvelo: { firstName: 'Bence', nev: 'Kovács Bence', adoazonosito: null, nyilvantartasiSzam: null },
    ugykorok: [],
    progress: [],
  });
  const tev = g.steps.find((s) => s.key === 'tevekenysegek')!;
  assert.ok(tev.fields.some((f) => f.label.includes('Babaúszás-oktatás uszodában')));
  assert.ok(tev.hold);
  const ell = g.steps.find((s) => s.key === 'ellenorzes')!;
  assert.ok(ell.fields.some((f) => (f.value ?? '').includes('960401')));
  assert.ok(ell.fields.some((f) => (f.value ?? '').includes('Babaúszás')));
  assert.ok(ell.fields.every((f) => !/^írd a keresőbe/.test(f.value ?? '')));
  const cim = g.steps.find((s) => s.key === 'cimadatok')!;
  assert.ok(cim.fields.some((f) => f.label === 'Levelezési cím'));
  assert.ok(cim.fields.some((f) => f.label === 'Az iratok őrzésének helye'));
  // k8 (k7b remnant, tulaj 11-20): no time promise – the banner says what we do, not how long it takes
  assert.match(ACTIVITY_PENDING_BANNER, /még megírjuk/);
  assert.doesNotMatch(ACTIVITY_PENDING_BANNER, /munkanap/);
});
