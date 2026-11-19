import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adoszamHiba, adoszamFormaz, adoazonositoHiba, emailHiba, jelszoHiba, jelszoEro, iranyitoszamHiba, telefonHiba, kodHiba, datumHiba } from '../src/lib/validators.ts';

// A SPEC §19.1 kitalált, formailag helyes azonosítói
test('adószám ellenőrző jegye', () => {
  for (const ok of ['68801234-1-41', '68904564-1-10', '68707893-1-06', '688012341 41'.replace(' ', '')]) assert.equal(adoszamHiba(ok), null, ok);
  assert.match(adoszamHiba('68801235-1-41') ?? '', /nem létezhet/);
  assert.match(adoszamHiba('1234') ?? '', /12345678-1-23/);
  assert.equal(adoszamFormaz('68801234141'), '68801234-1-41');
});

test('adóazonosító jel ellenőrző jegye', () => {
  for (const ok of ['8417104569', '8450772176', '8463473385', '8428621233']) assert.equal(adoazonositoHiba(ok), null, ok);
  assert.match(adoazonositoHiba('8417104568') ?? '', /nem létezhet/);
  assert.match(adoazonositoHiba('7417104569') ?? '', /8-cal/);
  assert.match(adoazonositoHiba('84171') ?? '', /10 számjegy/);
});

test('e-mail, jelszó, kód, egyebek', () => {
  assert.equal(emailHiba('kata.szabo@demo.kezjegy.test'), null);
  assert.ok(emailHiba('kata@'));
  assert.ok(jelszoHiba('rovid'));
  assert.ok(jelszoHiba('kata@pelda.hu', 'kata@pelda.hu'));
  assert.equal(jelszoHiba('hosszu-es-jo-jelszo'), null);
  assert.equal(jelszoEro('rovid').pont, 0);
  assert.equal(jelszoEro('Hosszú-Jelszó-2026!').pont, 3);
  assert.equal(iranyitoszamHiba('1136'), null);
  assert.ok(iranyitoszamHiba('0136'));
  assert.equal(telefonHiba(''), null);
  assert.equal(telefonHiba('+36 20 123 4567'), null);
  assert.ok(telefonHiba('123'));
  assert.equal(kodHiba('123456'), null);
  assert.ok(kodHiba('12345'));
  assert.equal(datumHiba('2019-03-01'), null);
  assert.ok(datumHiba('2019-02-30'));
});
