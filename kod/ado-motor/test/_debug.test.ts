import { it } from 'vitest';
import { calculateYear } from '../src/index.js';
import { demoInput } from './helpers.js';

it.skipIf(!process.env['ADO_DEBUG'])('debug dump', () => {
  for (const who of ['kata', 'reka', 'peter'] as const) {
    const r = calculateYear(demoInput(who));
    console.log(who, JSON.stringify({ meters: r.meters, hipa: r.hipa, warnings: r.warnings, rev: r.revenueByMonth.map((x) => x.amountHuf) }, null, 1));
    for (const q of r.quarters) {
      console.log(who, q.periodKey, q.revenueHuf, q.incomeHuf, q.taxableYtdHuf, q.months.map((m) => m.baseHuf), q.tbHuf, q.szochoHuf, q.szjaAdvanceHuf, q.totalHuf, q.dueDate);
      if (who === 'kata' && q.quarter === 3) console.log(JSON.stringify(q.explanation, null, 1));
      if (who === 'peter') console.log(JSON.stringify(q.explanation, null, 1));
    }
  }
});
