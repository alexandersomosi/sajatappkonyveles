// Helyi iparűzési adó estimate (SPEC §7.1, corrected in §24): the kisvállalkozó "sávos" (tételes)
// tax base of Htv. 39/A. §. Only the sávos method is modelled; the general method returns null
// amounts and a warning for the accountant.
//
// Htv. 39/A. § (in force 2026):
//  (1) kisvállalkozó: revenue ≤ 25 M Ft (exclusively retail átalányadózó ≤ 120 M Ft); for
//      átalányadózók "revenue" is the SZJA-law revenue (bevétel).
//  (2) base: 2.5 M (revenue ≤ 12 M), 6 M (12 M < revenue ≤ 18 M), 8.5 M (above 18 M); for a tax year
//      shorter than 12 months the revenue is annualised by days.
//  (3) for a shorter tax year the base is prorated by the days of tax liability.
//  (7) the tax is due by the last day of the 5th month of the next year; (9) the advance (= the
//      previous year's tax) by the last day of the 5th month of the tax year. 41. § (4) b): no advance
//      in the first advance period of a business started without a predecessor.

import { hipaDates } from '../calendar.js';
import type { TaxRules } from '../rules/types.js';
import type { EngineWarning, HipaMethod, HipaResult } from '../types.js';
import { formatDecimal, formatHuf, joinHu } from '../util/format.js';
import { roundDiv } from '../util/math.js';

export interface HipaArgs {
  rules: TaxRules;
  year: number;
  method: HipaMethod;
  ratePct: number;
  /** SZJA-law revenue projected to the end of the active period. */
  projectedRevenueHuf: number;
  activeDays: number;
  daysInYear: number;
  retail: boolean;
  /** Last year's tax (sávos: this year's advance equals it). null/undefined = unknown. */
  priorYearHuf?: number | null;
}

const BAND_TEXT: Record<'a' | 'b' | 'c', string> = {
  a: '12 millió Ft-ig terjedő',
  b: '12–18 millió Ft közötti',
  c: '18 millió Ft feletti',
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
  return `${months[Number(m) - 1]} ${Number(d)}.`;
}

export function hipaEstimate(a: HipaArgs): { result: HipaResult; warnings: EngineWarning[] } {
  const { rules, year, method } = a;
  const dates = hipaDates(year, method, rules);
  if (method === 'nincs') {
    return {
      result: { method, baseHuf: null, annualHuf: null, advances: [], note: 'A könyvelőd beállítása szerint iparűzési adóval nem számolunk.', band: null },
      warnings: [],
    };
  }
  if (method === 'altalanos') {
    return {
      result: {
        method,
        baseHuf: null,
        annualHuf: null,
        advances: [],
        note: `Az iparűzési adódat az általános szabály szerint a könyvelőd számolja ki. Előleg általában ${joinHu(dates.advances.map(shortDate))}, az összeget az önkormányzat írja elő.`,
        band: null,
        ...(dates.annual ? { annualDueDate: dates.annual } : {}),
      },
      warnings: [
        {
          code: 'hipa_altalanos_not_modelled',
          audience: 'konyvelo',
          text: 'Általános HIPA-módszer: a motor nem számol iparűzési adót, az összeget kézzel kell megadni.',
        },
      ],
    };
  }

  // sávos
  const partial = a.activeDays < a.daysInYear;
  const annualised = partial ? roundDiv(a.projectedRevenueHuf * a.daysInYear, a.activeDays) : a.projectedRevenueHuf;
  const limit = a.retail ? rules.hipa.smallBusinessLimitRetailHuf : rules.hipa.smallBusinessLimitHuf;
  if (annualised > limit) {
    return {
      result: {
        method,
        baseHuf: null,
        annualHuf: null,
        advances: [],
        note: `A várható idei bevételed (${formatHuf(annualised)}) több, mint a sávos iparűzési adó határa (${formatHuf(limit)}). Idén ezért az általános szabály szerint kell számolni – a könyvelőd kiszámolja.`,
        band: null,
        annualisedRevenueHuf: annualised,
        ...(dates.annual ? { annualDueDate: dates.annual } : {}),
      },
      warnings: [
        {
          code: 'hipa_savos_limit_over',
          audience: 'konyvelo',
          text: `A várható éves bevétel (${formatHuf(annualised)}) meghaladja a Htv. 39/A. § szerinti ${formatHuf(limit)}-os határt: idén és jövőre az általános HIPA-szabály kell.`,
        },
      ],
    };
  }
  const bandDef = rules.hipa.bands.find((b) => b.upToHuf === null || annualised <= b.upToHuf) ?? rules.hipa.bands[rules.hipa.bands.length - 1]!;
  const baseHuf = partial ? roundDiv(bandDef.baseHuf * a.activeDays, a.daysInYear) : bandDef.baseHuf;
  const rateHundredths = Math.round(a.ratePct * 100);
  const annualHuf = roundDiv(baseHuf * rateHundredths, 10_000);
  // Htv. 39/A. § (9): the advance due in May of the tax year equals the PREVIOUS year's tax, not this
  // year's estimate. Unknown previous tax → the amount stays null (the accountant fills it in).
  const prior = typeof a.priorYearHuf === 'number' ? a.priorYearHuf : null;
  const advances = partial ? [] : dates.advances.map((dueDate) => ({ dueDate, amountHuf: prior, label: `Iparűzési adóelőleg (${year})` }));
  const rateText = `${formatDecimal(a.ratePct)}%`;
  const paySentence = partial
    ? 'Mivel idén kezdted, idén nem fizetsz előleget: az adót jövő május végéig fizeted meg.'
    : `Sávos adózásnál évente egyszer, május végéig fizetsz előleget, és ez az előző évi adóddal egyezik meg${prior !== null ? ` (${formatHuf(prior)})` : ''}. Ha idén magasabb sávba kerülsz, a különbözetet jövő május végéig kell befizetni.`;
  return {
    result: {
      method,
      baseHuf,
      annualHuf,
      advances,
      note:
        `Becslés: a várható idei bevételed alapján a ${BAND_TEXT[bandDef.band]} sávba esel. ` +
        `Az adóalap ${formatHuf(baseHuf)}${partial ? ' (az év közbeni kezdés miatt arányosan)' : ''}, ${rateText} adómértékkel ez évi ${formatHuf(annualHuf)}. ` +
        `${paySentence} Ha több településen van telephelyed, mindegyikre külön adó jár. Az összeget a könyvelőd ellenőrzi.`,
      band: bandDef.band,
      annualisedRevenueHuf: annualised,
      ...(dates.annual ? { annualDueDate: dates.annual } : {}),
    },
    warnings: [],
  };
}
