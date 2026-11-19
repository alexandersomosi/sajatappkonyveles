// "Hogyan jött ki?" (design 07, SPEC §7.3). The Kata Q3 explanation is written out in full and was
// checked by hand line by line; other cases check the sentences that differ.

import { describe, expect, it } from 'vitest';
import { calculateYear, type Explanation } from '../src/index.js';
import { demoInput, monthly } from './helpers.js';

const N = ' ';
const huf = (s: string) => `${s.replace(/ /g, N)}${N}Ft`;

describe('Kata Q3 2026 – full explanation (510 471 Ft)', () => {
  const q3 = calculateYear(demoInput('kata')).quarters[2]!;

  it('matches the hand-checked text exactly', () => {
    const expected: Explanation = {
      intro:
        'A bevételed 45%-át költségnek veszi a NAV, a többi a jövedelmed. A TB-járulékot, a szochót és az SZJA-előleget negyedévente fizeted, a negyedév utáni hónap 12-éig.',
      lines: [
        { kind: 'cim', label: 'Jövedelmed', side: 'július–szeptember' },
        { kind: 'sor', label: 'Július–szeptemberi bevételed', amountHuf: 2_490_000 },
        { kind: 'sor', op: '−', label: 'Költséghányad, 45%', amountHuf: 1_120_500 }, // 2 490 000 × 45 %
        { kind: 'sor', op: '=', label: 'Jövedelmed a negyedévben', amountHuf: 1_369_500 },
        { kind: 'cim', label: 'TB-járulék és szocho', side: '3 hónap' },
        {
          kind: 'sor',
          label: 'Járulékalap, 3 hónap',
          amountHuf: 968_400, // 3 × 322 800
          note: `Havonta legalább a minimálbér (${huf('322 800')}) után fizetsz. A járulék alapja nem a negyedéves jövedelmed, hanem az adómentes rész feletti, év eleje óta összegyűlt jövedelem. Az adóköteles jövedelmed év eleje óta ${huf('1 880 200')}. Az előző negyedévekben a minimum miatt már ${huf('1 936 800')} után fizettél járulékot, ez több ennél, így erre a negyedévre nem jut belőle. Ezért most is a minimum után számolunk: 3 × ${huf('322 800')}.`,
        },
        { kind: 'ado', label: 'TB-járulék: ennek 18,5%-a', amountHuf: 179_154 }, // 968 400 × 18.5 %
        { kind: 'ado', label: 'Szocho: ennek 13%-a', amountHuf: 125_892, note: 'Szocho = szociális hozzájárulási adó.' }, // × 13 %
        { kind: 'cim', label: 'SZJA-előleg', side: 'január–szeptember' },
        { kind: 'sor', label: 'Idei jövedelmed eddig', amountHuf: 3_817_000 },
        { kind: 'sor', op: '−', label: 'Adómentes rész', amountHuf: 1_936_800, note: 'Júniusban érted el.' },
        { kind: 'sor', op: '=', label: 'Adóköteles rész', amountHuf: 1_880_200 },
        { kind: 'sor', label: 'Ennek 15%-a', amountHuf: 282_030 },
        { kind: 'sor', op: '−', label: 'Az előző negyedévek előlege', amountHuf: 76_605 },
        { kind: 'ado', op: '=', label: 'SZJA-előleg most', amountHuf: 205_425 },
      ],
      result: `Összesen: ${huf('510 471')}`,
    };
    expect(q3.explanation).toEqual(expected);
  });

  it('is arithmetically consistent: each "=" row follows from the rows above it', () => {
    const l = q3.explanation.lines;
    const amt = (label: string) => l.find((x) => x.label === label)!.amountHuf!;
    expect(amt('Július–szeptemberi bevételed') - amt('Költséghányad, 45%')).toBe(amt('Jövedelmed a negyedévben'));
    expect(amt('Idei jövedelmed eddig') - amt('Adómentes rész')).toBe(amt('Adóköteles rész'));
    expect(amt('Ennek 15%-a') - amt('Az előző negyedévek előlege')).toBe(amt('SZJA-előleg most'));
    const adoSum = l.filter((x) => x.kind === 'ado').reduce((s, x) => s + (x.amountHuf ?? 0), 0);
    expect(adoSum).toBe(q3.totalHuf);
  });

  it('uses the 2026 law, not the outdated design copy', () => {
    const all = JSON.stringify(q3.explanation);
    expect(all).not.toContain('40%');
    expect(all).not.toContain('havonta, az SZJA');
  });
});

describe('other explanations', () => {
  it('Kata Q4 (running quarter) warns that the amount may still grow', () => {
    const q4 = calculateYear(demoInput('kata')).quarters[3]!;
    expect(q4.explanation.lines.at(-1)).toEqual({ kind: 'megjegyzes', label: 'A negyedév még tart: ha lesz még bevételed, az összeg nőhet.' });
    expect(q4.explanation.result).toBe(`Eddig összesen: ${huf('392 661')}`);
  });

  it('Péter Q1 (mellékállás, under the tax-free part): no minimum, nothing to pay', () => {
    const q1 = calculateYear(demoInput('peter')).quarters[0]!;
    const base = q1.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!;
    expect(base.note).toBe(
      `Mellékállásban nincs kötelező minimum, csak a jövedelmed után fizetsz. Az idei jövedelmed még belefér az adómentes részbe (${huf('1 936 800')}). Ezért most nem fizetsz járulékot.`,
    );
    const szja = q1.explanation.lines.find((l) => l.label === 'SZJA-előleg' && l.kind === 'ado')!;
    expect(szja.amountHuf).toBe(0);
    expect(szja.note).toContain('Ezt még nem érted el');
  });

  it('Péter Q4: cumulative base 500 500 / 3 = 166 833 per month, "havonta kerekítve" where the sum differs', () => {
    const q4 = calculateYear(demoInput('peter')).quarters[3]!;
    const base = q4.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!;
    expect(base.amountHuf).toBe(500_499); // 3 × 166 833
    expect(base.note).toContain(`Ebből ${huf('653 700')} után már az előző negyedévekben fizettél járulékot, a maradék ${huf('500 500')} jut erre a negyedévre.`);
    expect(base.note).toContain(`3 hónapra elosztva havonta ${huf('166 833')} (forintra kerekítve, így 3 hónapra ${huf('500 499')}).`);
    // 500 499 × 13 % = 65 064.87 → 65 065, but monthly rounding gives 3 × 21 688 = 65 064
    expect(q4.explanation.lines.find((l) => l.label.startsWith('Szocho'))!.note).toBe('Szocho = szociális hozzájárulási adó. Havonta kerekítve.');
  });

  it('Kata Q4: the minimum bases already paid exceed the taxable income – no "ebből" with a larger part', () => {
    const q4 = calculateYear(demoInput('kata')).quarters[3]!;
    const note = q4.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!.note!;
    expect(q4.taxableYtdHuf).toBe(2_464_300);
    expect(q4.priorActualBaseSumHuf).toBe(2_905_200);
    expect(note).toBe(
      `Havonta legalább a minimálbér (${huf('322 800')}) után fizetsz. A járulék alapja nem a negyedéves jövedelmed, hanem az adómentes rész feletti, év eleje óta összegyűlt jövedelem. ` +
        `Az adóköteles jövedelmed év eleje óta ${huf('2 464 300')}. Az előző negyedévekben a minimum miatt már ${huf('2 905 200')} után fizettél járulékot, ez több ennél, így erre a negyedévre nem jut belőle. ` +
        `Ezért most is a minimum után számolunk: 3 × ${huf('322 800')}.`,
    );
  });

  it('no "Ebből X" with X ≥ the whole and no dangling "ez, vagy" in the demo explanations', () => {
    for (const who of ['kata', 'reka', 'peter'] as const) {
      for (const q of calculateYear(demoInput(who)).quarters) {
        const note = q.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))?.note ?? '';
        if (note.includes('Ebből')) expect(q.priorActualBaseSumHuf).toBeLessThan(q.taxableYtdHuf);
        expect(note).not.toContain('ez, vagy');
      }
    }
  });

  it('mixed case with nothing left (one kieső month, taxable 0): no dangling "ez"', () => {
    const r = calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false, insuranceBreaks: [{ from: '2026-03-01', to: '2026-03-31', kind: 'kieso' }] },
      revenue: monthly({ 1: 100_000 }),
      asOf: '2026-04-01',
    });
    const note = r.quarters[0]!.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!.note!;
    expect(note).toBe(
      `Az idei jövedelmed még belefér az adómentes részbe (${huf('1 936 800')}). Ezért ott, ahol jár minimum, a minimálbér (${huf('322 800')}) után számolunk. Március egésze kieső idő volt (például táppénz), ezért arra a hónapra nincs minimum.`,
    );
  });

  it('a partly suspended month is explained: full minimum, no proration since 2024', () => {
    const r = calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false, insuranceBreaks: [{ from: '2026-07-20', to: '2026-09-20', kind: 'szunetel' }] },
      revenue: [],
      asOf: '2026-10-01',
    });
    const note = r.quarters[2]!.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!.note!;
    expect(note).toContain('Júliusban és szeptemberben csak a hónap egy részében szünetelt a vállalkozásod. 2024 óta ilyenkor nincs arányosítás: arra a hónapra a teljes minimum jár.');
    expect(note).toContain('Augusztusban szünetelt a vállalkozásod, arra nem fizetsz járulékot.');
  });

  it('nyugdíjas: only SZJA-előleg, TB and szocho explained as not payable', () => {
    const r = calculateYear({ ...demoInput('kata'), profile: { ...demoInput('kata').profile, status: 'nyugdijas' } });
    const q3 = r.quarters[2]!;
    expect(q3.explanation.intro).toContain('Nyugdíjasként csak SZJA-előleget fizetsz');
    expect(q3.explanation.lines).toContainEqual({
      kind: 'ado',
      label: 'Nem kell fizetned',
      amountHuf: 0,
      note: 'Nyugdíjas egyéni vállalkozóként (kiegészítő tevékenység) TB-járulékot és szochót nem fizetsz.',
    });
    expect(q3.explanation.result).toBe(`Összesen: ${huf('205 425')}`);
  });

  it('mid-year start: months before the start and the prorated first month are explained', () => {
    const r = calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false, atalanyFrom: '2026-03-16' },
      revenue: monthly({ 3: 500_000 }, 2026, 20),
      asOf: '2026-04-30',
    });
    const q1 = r.quarters[0]!;
    const cim = q1.explanation.lines[0]!;
    expect(cim).toEqual({ kind: 'cim', label: 'Jövedelmed', side: 'március' });
    expect(q1.explanation.lines[1]!.label).toBe('Márciusi bevételed');
    const note = q1.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!.note!;
    expect(note).toContain(`Márciusban csak 16 napra jár minimum, ezért ott a minimum ${huf('172 160')}.`);
    expect(note).toContain('Januárban és februárban még nem működött a vállalkozásod.');
    expect(q1.explanation.lines.find((l) => l.kind === 'cim' && l.label === 'SZJA-előleg')!.side).toBe('március');
  });

  it('a fully suspended quarter: no járulék, the months are named', () => {
    const r = calculateYear({
      profile: {
        year: 2026,
        costRatio: 45,
        status: 'fofoglalkozasu',
        guaranteedMinimum: false,
        insuranceBreaks: [{ from: '2026-04-01', to: '2026-06-30', kind: 'szunetel' }],
      },
      revenue: monthly({ 1: 300_000 }),
      asOf: '2026-07-20',
    });
    const q2 = r.quarters[1]!;
    expect([q2.insuredMonths, q2.tbHuf, q2.szochoHuf]).toEqual([0, 0, 0]);
    const base = q2.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!;
    expect(base.note).toBe('Áprilisban, májusban és júniusban szünetelt a vállalkozásod, arra nem fizetsz járulékot. Ezért most nem fizetsz járulékot.');
  });
});
