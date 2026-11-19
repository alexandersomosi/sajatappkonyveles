import { describe, expect, it } from 'vitest';
import {
  aktivFazis,
  assistSorrend,
  elalltSzoveg,
  fazisElemek,
  fazisKesz,
  hataridoVisszaszamol,
  hianyzoPipak,
  jovahagyasIdozito,
  kisbetu,
  labdaNalam,
  labdaSzoveg,
  lejartJovahagyas,
  muveletAllapot,
  szuroIlleszkedik,
  utonev,
  utvonalSor,
  type MuveletKornyezet,
} from './helyettunk';
import { ASSIST_CHECK_ITEMS, ASSIST_STATUSES } from '../_shared/enums';
import { setTodayOverride } from './today';

const sor = (status: (typeof ASSIST_STATUSES)[number], ball: 'csapat' | 'konyvelo' | 'ugyfel' | null, approvalDueOn: string | null = null) => ({ status, ball, approvalDueOn });

describe('queue filters (SPEC §27.6.2)', () => {
  it('"Nálam" follows the viewer role', () => {
    expect(labdaNalam(sor('visszahivas_kerve', 'csapat'), 'csapat')).toBe(true);
    expect(labdaNalam(sor('visszahivas_kerve', 'csapat'), 'konyvelo')).toBe(false);
    expect(labdaNalam(sor('egyeztetve', 'konyvelo'), 'konyvelo')).toBe(true);
    expect(labdaNalam(sor('egyeztetve', 'konyvelo'), 'admin')).toBe(false);
    expect(labdaNalam({ ...sor('egyeztetve', 'konyvelo'), accountant: { userId: 'u-admin' } }, 'admin', 'u-admin')).toBe(true);
    expect(labdaNalam(sor('visszahivas_kerve', 'csapat'), 'admin')).toBe(true);
    expect(labdaNalam(sor('meghatalmazas_bekuldve', 'ugyfel'), 'admin')).toBe(false);
    expect(labdaNalam(sor('kesz', null), 'admin')).toBe(false);
  });
  it('expired approval = NAV deleted it, or the shown date passed', () => {
    expect(lejartJovahagyas(sor('meghatalmazas_lejart', 'konyvelo'), '2026-11-17')).toBe(true);
    expect(lejartJovahagyas(sor('meghatalmazas_bekuldve', 'ugyfel', '2026-11-16'), '2026-11-17')).toBe(true);
    expect(lejartJovahagyas(sor('meghatalmazas_bekuldve', 'ugyfel', '2026-11-17'), '2026-11-17')).toBe(false);
  });
  it('every chip', () => {
    const r = sor('meghatalmazas_bekuldve', 'ugyfel', '2026-11-19');
    expect(szuroIlleszkedik(r, 'nyitott', 'csapat', '2026-11-17')).toBe(true);
    expect(szuroIlleszkedik(r, 'ugyfelre_var', 'csapat', '2026-11-17')).toBe(true);
    expect(szuroIlleszkedik(r, 'kesz', 'csapat', '2026-11-17')).toBe(false);
    expect(szuroIlleszkedik(sor('kesz', null), 'kesz', 'csapat', '2026-11-17')).toBe(true);
    expect(szuroIlleszkedik(sor('lezarva', null), 'nyitott', 'csapat', '2026-11-17')).toBe(false);
    expect(szuroIlleszkedik(sor('lezarva', null), 'mind', 'csapat', '2026-11-17')).toBe(true);
  });
  it('overdue first, then the nearest deadline, rows without one last', () => {
    const a = { nextDue: { at: '2026-11-19T10:00:00Z', overdue: false }, createdAt: '2026-11-10T00:00:00Z' };
    const b = { nextDue: { at: '2026-11-15T10:00:00Z', overdue: true }, createdAt: '2026-11-11T00:00:00Z' };
    const c = { nextDue: null, createdAt: '2026-11-01T00:00:00Z' };
    const d = { nextDue: { at: '2026-11-18T10:00:00Z', overdue: false }, createdAt: '2026-11-12T00:00:00Z' };
    expect([a, b, c, d].sort(assistSorrend)).toEqual([b, d, a, c]);
  });
});

describe('ball, names, countdowns', () => {
  it('lower-cases a label inside a sentence, but not an abbreviation', () => {
    expect(kisbetu('Vállalkozás bejelentése')).toBe('vállalkozás bejelentése');
    expect(kisbetu('NAV-meghatalmazás')).toBe('NAV-meghatalmazás');
  });
  it('first name and ball column', () => {
    expect(utonev('Kovács Bence')).toBe('Bence');
    expect(labdaSzoveg('konyvelo', 'Kovács Bence')).toBe('Bence');
    expect(labdaSzoveg('csapat', 'Kovács Bence')).toBe('Csapat');
    expect(labdaSzoveg('ugyfel', null)).toBe('Ügyfél');
    expect(labdaSzoveg(null, null)).toBe('–');
  });
  it('countdown: days, the due day, overdue in red', () => {
    const most = Date.parse('2026-11-17T09:00:00Z'); // 10:00 Budapest
    expect(hataridoVisszaszamol('2026-11-19T23:00:00Z', most)).toEqual({ szoveg: 'még 3 nap', szin: 'semleges' });
    expect(hataridoVisszaszamol('2026-11-18T10:00:00Z', most).szoveg).toBe('holnap');
    expect(hataridoVisszaszamol('2026-11-17T14:00:00Z', most)).toEqual({ szoveg: 'ma, még 5 óra', szin: 'figyel' });
    expect(hataridoVisszaszamol('2026-11-17T06:00:00Z', most)).toEqual({ szoveg: 'lejárt 3 órája', szin: 'hiba' });
    expect(hataridoVisszaszamol('2026-11-14T09:00:00Z', most).szoveg).toBe('lejárt 3 napja');
  });
  it('the 4-day approval window (NAV deletes after 4 × 24 h)', () => {
    const t = jovahagyasIdozito('2026-11-16T13:00:00Z', Date.parse('2026-11-17T13:00:00Z'));
    expect(t.navTorli).toBe('2026-11-20T13:00:00.000Z');
    expect(t.arany).toBeCloseTo(0.25);
    expect(t.szoveg).toBe('Még 3 nap 0 óra, utána a NAV törli.');
    expect(jovahagyasIdozito('2026-11-16T13:00:00Z', Date.parse('2026-11-20T03:00:00Z')).szoveg).toBe('Még 10 óra, utána a NAV törli.');
    expect(jovahagyasIdozito('2026-11-10T13:00:00Z', Date.parse('2026-11-17T13:00:00Z')).szoveg).toContain('újra be kell küldeni');
  });
});

describe('check lists and phases (SPEC §27.3.4, §27.6.3)', () => {
  it('kind meghatalmazas hides the EV-only items and has no bejelentes phase items shown', () => {
    expect(fazisElemek('vallalkozas_bejelentes', 'hivas')).toEqual([...ASSIST_CHECK_ITEMS.hivas]);
    expect(fazisElemek('meghatalmazas', 'hivas')).not.toContain('nincs_elo_ev');
    expect(fazisElemek('meghatalmazas', 'hivas')).not.toContain('afa_mentes_kor');
    expect(fazisElemek('meghatalmazas', 'ujegyke')).not.toContain('ugycsoport_ev');
    expect(hianyzoPipak('meghatalmazas', 'hivas', ['belepes_van', 'telefon_jo'])).toEqual(['lepesek_elmondva', 'jelszo_figyelmeztetes']);
  });
  it('active phase and done phases follow the status', () => {
    expect(aktivFazis('visszahivas_kerve')).toBe('hivas');
    expect(aktivFazis('meghatalmazas_lejart')).toBe('ujegyke');
    expect(aktivFazis('ugyfel_engedelyezte')).toBe('bejelentes');
    expect(aktivFazis('meghatalmazas_bekuldve')).toBeNull();
    expect(fazisKesz('hivas', 'egyeztetve')).toBe(true);
    expect(fazisKesz('ujegyke', 'meghatalmazas_lejart')).toBe(false);
    expect(fazisKesz('ujegyke', 'meghatalmazas_bekuldve')).toBe(true);
    expect(fazisKesz('bejelentes', 'bejelentes_bekuldve')).toBe(true);
    expect(fazisKesz('hivas', 'lezarva')).toBe(false);
  });
  it('disabled buttons say why', () => {
    const k: MuveletKornyezet = {
      status: 'egyeztetve',
      kind: 'vallalkozas_bejelentes',
      szerep: 'csapat',
      sajatKonyvelo: false,
      allowed: [],
      hianyzo: 0,
      konyveloUtonev: 'Bence',
      answersMatchConsent: null,
    };
    expect(muveletAllapot('ujegyke_bekuldve', k)).toEqual({ mehet: false, miert: 'Ezt csak Bence küldheti be, a saját belépésével.' });
    expect(muveletAllapot('ujegyke_bekuldve', { ...k, szerep: 'konyvelo', sajatKonyvelo: true })).toEqual({ mehet: false, miert: 'Előbb az ügyfélnek el kell fogadnia a szerződést.' });
    expect(muveletAllapot('ujegyke_bekuldve', { ...k, szerep: 'konyvelo', sajatKonyvelo: true, hianyzo: 2 })?.miert).toBe('Még 2 pont van hátra a listából.');
    expect(muveletAllapot('ujegyke_bekuldve', { ...k, szerep: 'konyvelo', sajatKonyvelo: true, allowed: ['ujegyke_bekuldve'] })).toEqual({ mehet: true, miert: null });
    expect(muveletAllapot('egyeztetve', k)).toBeNull();
    // 11-19 javítás: the client owes the contract / tax id – said BEFORE the checklist count, the button stays off
    expect(muveletAllapot('ujegyke_bekuldve', { ...k, szerep: 'konyvelo', sajatKonyvelo: true, hianyzo: 0, notReady: ['szerződés elfogadása', 'adóazonosító jel'] })).toEqual({
      mehet: false,
      miert: 'Előbb az ügyfélnek: szerződés elfogadása, adóazonosító jel. Addig ne küldd be.',
    });
    expect(muveletAllapot('lejart', { ...k, status: 'meghatalmazas_jovahagyva', szerep: 'konyvelo', sajatKonyvelo: true, hianyzo: 0, allowed: ['meghatalmazas_el', 'lejart', 'lezaras'] })).toEqual({ mehet: true, miert: null });
    expect(muveletAllapot('bejelentes_bekuldve', { ...k, status: 'meghatalmazas_el', szerep: 'konyvelo', sajatKonyvelo: true })?.miert).toBe('Az ügyfél még nem engedélyezte a bejelentést.');
    expect(muveletAllapot('bejelentes_bekuldve', { ...k, status: 'ugyfel_engedelyezte', szerep: 'admin', answersMatchConsent: false })?.miert).toBe('A kérdőív változott az engedély óta.');
    expect(muveletAllapot('bejelentes_bekuldve', { ...k, kind: 'meghatalmazas', status: 'ugyfel_engedelyezte' })).toBeNull();
    // the team never sees "Él a meghatalmazás" while the client still has to approve
    expect(muveletAllapot('meghatalmazas_el', { ...k, status: 'meghatalmazas_bekuldve' })).toBeNull();
    expect(muveletAllapot('lejart', { ...k, status: 'meghatalmazas_bekuldve', allowed: ['lejart'] })).toEqual({ mehet: true, miert: null });
  });
});

describe('branch history (SPEC §27.2.5)', () => {
  it('one plain line per change', () => {
    setTodayOverride('2026-11-17');
    expect(utvonalSor({ at: '2026-11-17T09:20:00Z', from: 'inditas', to: 'van', by: 'ugyfel', note: null }, '2026-11-17')).toBe('Most indítja → Már van vállalkozása · ma 10:20 · az ügyfél váltott');
    expect(utvonalSor({ at: '2026-11-16T09:20:00Z', from: null, to: 'inditas', by: 'csapat', note: 'x' }, '2026-11-17')).toBe('Nem válaszolt → Most indítja · tegnap 10:20 · a csapat módosította');
    setTodayOverride(null);
  });
  it('pipeline card text of a registration left by a branch change', () => {
    expect(elalltSzoveg({ status: 'elallt', pathChangedAt: '2026-11-17T09:20:00Z' })).toBe('Útvonalat váltott – már van vállalkozása');
    expect(elalltSzoveg({ status: 'elallt', pathChangedAt: null })).toBeNull();
  });
});
