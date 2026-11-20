// SPEC §31.3 – a regisztráció továbbadja a forrást: a landing linkjének utm_*, hivatkozo, erkezes, forras, cel paramétere a
// regisztrációs kérésbe kerül (a Google/Apple-gomb is ugyanezt küldi), a belépés → regisztráció váltás megtartja őket, és
// semmi nem kerül az eszközre (tisztán a címből). A hirdetési rész (hid, kattintás-azonosítók) csak bekapcsolt mérésnél számít.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { forrasAdat, forrasTovabb } from '../src/lib/forras.ts';

const ITT = import.meta.dirname;

test('forrás: utm (term is), hivatkozó, érkezési útvonal, belépő oldal, cél', () => {
  const f = forrasAdat('?utm_source=youtube&utm_medium=video&utm_campaign=atalanyado-2027&utm_content=leiras&utm_term=ev&hivatkozo=youtube.com&erkezes=%2F&forras=kalkulator&cel=visszahivas&ref=KATA1234');
  assert.deepEqual(f, {
    utm: { source: 'youtube', medium: 'video', campaign: 'atalanyado-2027', content: 'leiras', term: 'ev' },
    forras: { hivatkozo: 'youtube.com', erkezes: '/' },
    entry: { forras: 'kalkulator', cel: 'visszahivas' },
  });
});

test('forrás: üres cím → üres (a régi szerver sem kap ismeretlen mezőt), hibás értékek kimaradnak', () => {
  assert.deepEqual(forrasAdat(''), {});
  assert.deepEqual(forrasAdat('?cel=valami&forras=<script>&erkezes=javascript:alert(1)&hivatkozo=a b'), {});
  assert.deepEqual(forrasAdat('?utm_source=' + 'x'.repeat(300)).utm?.source?.length, 100);
});

test('hirdetési rész: a döntés-azonosító és a négy kattintás-azonosító átmegy (a szerver dönti el, használja-e)', () => {
  const f = forrasAdat('?hid=6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11&gclid=Cj0KCQ-abc&fbclid=IwAR-1&msclkid=x&ttclid=y');
  assert.deepEqual(f.hirdetes, { hid: '6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11', gclid: 'Cj0KCQ-abc', fbclid: 'IwAR-1' });
  assert.equal(forrasAdat('?hid=nem-uuid').hirdetes, undefined);
});

test('belépés → regisztráció: a forrás paraméterei megmaradnak, más nem', () => {
  assert.equal(forrasTovabb('?utm_source=tiktok&utm_campaign=v1&hivatkozo=tiktok.com&ref=KATA1234&session=titok'), '?utm_source=tiktok&utm_campaign=v1&hivatkozo=tiktok.com&ref=KATA1234');
  assert.equal(forrasTovabb('?valami=1'), '');
});

test('a képernyők használják: regisztráció, Google/Apple-gomb, belépés, postafiók (cél), visszahívás', () => {
  const be = (f: string) => readFileSync(join(ITT, '..', 'src', f), 'utf8');
  const reg = be('app/(auth)/regisztracio.tsx');
  assert.match(reg, /forrasAdat\(webKereses\(\)\)/);
  assert.match(reg, /\.\.\.forras \}\)/);
  assert.match(reg, /forras=\{forras\}/);
  assert.match(reg, /\/jogi\/suti/);
  const kulso = be('auth/kulso.tsx');
  assert.match(kulso, /'\/auth\/google', \{ idToken, clientKind, referralCode, \.\.\.\(forras \?\? \{\}\) \}/);
  assert.match(kulso, /clientKind, referralCode, \.\.\.\(forras \?\? \{\}\) \}/);
  assert.match(be('app/(auth)/belepes.tsx'), /forrasTovabb\(webKereses\(\)\)/);
  assert.match(be('app/(auth)/postafiok.tsx'), /cel === 'visszahivas' \? '\/visszahivas' : '\/'/);
  assert.match(be('app/visszahivas.tsx'), /marketing/);
  // nincs eszközön tárolás a forráshoz
  assert.doesNotMatch(be('lib/forras.ts'), /localStorage|sessionStorage|SecureStore|AsyncStorage/);
});
