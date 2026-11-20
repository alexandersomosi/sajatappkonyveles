// k6c2 (2026-11-20): typing a date the way the hint says ("2026.12.01.") one character at a time must end as 2026-12-01.
// Before: datumBe("2026.12.0") gave "2026-12-00", the next "1" made "2026-12-001." and the field showed the error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datumBe, datumPontos } from '../src/lib/format.ts';

function gepel(szoveg: string, atalakit: (s: string) => string): string {
  let mezo = '';
  for (const c of szoveg) mezo = atalakit(mezo + c);
  return mezo;
}

test('dátum karakterenként: a mező a beírt szöveget tartja, a küldés ISO-t kap', () => {
  for (const beirt of ['2026.12.01.', '2026. 12. 01.', '2026.12.1.', '20261201', '2026-12-01']) {
    const mezo = gepel(beirt, (s) => s); // the form keeps the raw text (ValtozasUrlap, valtozott)
    assert.equal(datumBe(mezo), '2026-12-01', beirt);
  }
});

test('félig beírt nap nem dátum: a mező nem „ugrik” át ISO-ra', () => {
  assert.equal(datumBe('2026.12.0'), '2026.12.0');
  assert.equal(datumBe('2026.13.01.'), '2026.13.01.');
  assert.equal(datumBe('2026.12.1'), '2026-12-01');
  assert.equal(datumPontos('2026-12-01'), '2026.12.01.');
  assert.equal(datumPontos('2026.12.01.'), '2026.12.01.');
});
