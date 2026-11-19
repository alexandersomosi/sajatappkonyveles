import { describe, expect, it } from 'vitest';
import {
  adoszamEllenor,
  buborekOldal,
  elteltPerc,
  ovtjHatarido,
  visszahivasLinkId,
  hianyzoEllenorzes,
  hivasFolyik,
  keszFriss,
  kezdolap,
  kiserletSzoveg,
  menuCsoportok,
  pipelineFigyel,
  slaAllapot,
  telLink,
  varakozasPerc,
} from './csapat';
import { REGISTRATION_CHECK_ITEMS } from '../_shared/enums';

const letrejott = '2026-11-17T08:00:00Z';
const sor = (minutesToDue: number, status: 'uj' | 'folyamatban' | 'teljesitve' = 'uj') => ({
  status,
  minutesToDue,
  targetAt: '2026-11-18T08:00:00Z',
  dueAt: '2026-11-19T08:00:00Z',
  createdAt: letrejott,
});

describe('callback SLA (SPEC §26.2.3, §26.3.2)', () => {
  it('neutral in the first 24 hours, amber until 48 hours, red after', () => {
    expect(slaAllapot(sor(45 * 60))).toEqual({ szoveg: 'még 45 óra', szin: 'semleges', perc: 2700 });
    expect(slaAllapot(sor(21 * 60 + 30)).szin).toBe('figyel');
    expect(slaAllapot(sor(21 * 60 + 30)).szoveg).toBe('még 21 óra');
    expect(slaAllapot(sor(24 * 60)).szin).toBe('figyel');
    expect(slaAllapot(sor(24 * 60 + 1)).szin).toBe('semleges');
    expect(slaAllapot(sor(-3 * 60 - 10))).toEqual({ szoveg: 'lejárt 3 órája', szin: 'hiba', perc: -190 });
    expect(slaAllapot(sor(-25)).szoveg).toBe('lejárt 25 perce');
    expect(slaAllapot(sor(-3 * 1440)).szoveg).toBe('lejárt 3 napja');
    expect(slaAllapot(sor(40)).szoveg).toBe('még 40 perc');
  });
  it('ticks with the time passed since the list was fetched', () => {
    expect(slaAllapot(sor(30), 45)).toMatchObject({ szoveg: 'lejárt 15 perce', szin: 'hiba' });
  });
  it('closed callbacks have no timer', () => {
    expect(slaAllapot(sor(-500, 'teljesitve'))).toEqual({ szoveg: 'lezárva', szin: 'lezart', perc: 0 });
  });
  it('attempts, soft block and "Most hívom"', () => {
    expect(kiserletSzoveg(1)).toBe('1/3');
    const most = Date.parse('2026-11-17T12:00:00Z');
    expect(varakozasPerc({ at: '2026-11-17T11:00:00Z', outcome: 'nem_vette_fel' }, most)).toBe(60);
    expect(varakozasPerc({ at: '2026-11-17T09:00:00Z', outcome: 'foglalt' }, most)).toBe(0);
    expect(varakozasPerc({ at: '2026-11-17T11:50:00Z', outcome: 'kesobb_kerte' }, most)).toBe(0);
    expect(varakozasPerc(null, most)).toBe(0);
    expect(hivasFolyik('2026-11-17T12:12:00Z', most)).toBe(12);
    expect(hivasFolyik('2026-11-17T11:59:00Z', most)).toBe(0);
    expect(telLink('+36 30 555 0142')).toBe('tel:+36305550142');
  });
  it('clamps when "most" is a few seconds older than the attempt just saved (review k3c2)', () => {
    const most = Date.parse('2026-11-17T12:00:00Z');
    // the attempt was saved 10 s "in the future" of the 15-second clock
    const v = varakozasPerc({ at: '2026-11-17T12:00:10Z', outcome: 'nem_vette_fel' }, most);
    expect(v).toBe(120);
    expect(elteltPerc(v)).toBe(0);
    expect(elteltPerc(varakozasPerc({ at: '2026-11-17T11:00:00Z', outcome: 'foglalt' }, most))).toBe(60);
    // "Most hívom" just pressed: never more than 15 minutes
    expect(hivasFolyik('2026-11-17T12:15:20Z', most)).toBe(15);
  });
  it('staff e-mail and notification links (?id=) open the drawer like ?nyit= (review k3c2)', () => {
    expect(visszahivasLinkId(new URLSearchParams('id=cdaaa22b'))).toBe('cdaaa22b');
    expect(visszahivasLinkId(new URLSearchParams('nyit=abc&id=old'))).toBe('abc');
    expect(visszahivasLinkId(new URLSearchParams('szuro=lejart'))).toBeNull();
  });
});

describe('ÖVTJ deadline of a waiting client (review k3c2)', () => {
  it('1 working day after the guide was requested; weekends skipped; overdue after', () => {
    const fri = { status: 'utmutato' as const, statusSince: '2026-11-20T10:00:00Z', activityPending: true };
    const h = ovtjHatarido(fri, Date.parse('2026-11-21T10:00:00Z'))!;
    expect(h.hatarido.toISOString()).toBe('2026-11-23T10:00:00.000Z');
    expect(h.lejart).toBe(false);
    expect(ovtjHatarido(fri, Date.parse('2026-11-23T11:00:00Z'))!.lejart).toBe(true);
    expect(ovtjHatarido({ ...fri, activityPending: false }, 0)).toBeNull();
    expect(ovtjHatarido({ ...fri, status: 'kesz' }, 0)).toBeNull();
  });
});

describe('new-business pipeline (SPEC §26.3.3)', () => {
  it('markers: > 3 days at the guide, > 1 day waiting for the check', () => {
    expect(pipelineFigyel({ status: 'utmutato', daysInStatus: 4 })).toBe('4 napja az útmutatónál');
    expect(pipelineFigyel({ status: 'utmutato', daysInStatus: 3 })).toBeNull();
    expect(pipelineFigyel({ status: 'beadva', daysInStatus: 2 })).toBe('2 napja vár ránk');
    expect(pipelineFigyel({ status: 'beadva', daysInStatus: 1 })).toBeNull();
  });
  it('Kész shows the last 30 days', () => {
    expect(keszFriss({ status: 'kesz', statusSince: '2026-11-01T10:00:00Z' }, '2026-11-17')).toBe(true);
    expect(keszFriss({ status: 'kesz', statusSince: '2026-10-01T10:00:00Z' }, '2026-11-17')).toBe(false);
    expect(keszFriss({ status: 'beadva', statusSince: '2026-01-01T10:00:00Z' }, '2026-11-17')).toBe(true);
  });
  it('"Rendben, ellenőriztem" needs every check item', () => {
    expect(hianyzoEllenorzes([...REGISTRATION_CHECK_ITEMS])).toEqual([]);
    expect(hianyzoEllenorzes(REGISTRATION_CHECK_ITEMS.slice(1))).toEqual(['szemelyes_adatok']);
  });
  it('adószám: check digit, format, ÁFA-kód 1 warning', () => {
    // 68807893: 9·6+7·8+3·8+0+9·7+7·8+3·9 = 54+56+24+0+63+56+27 = 280 → check 0 ≠ 3 → wrong
    expect(adoszamEllenor('68807893-1-06').hiba).toMatch(/ellenőrző/);
    // 12345676: 9+14+9+4+45+42+21 = 144 → (10−4)%10 = 6 ✓
    expect(adoszamEllenor('12345676-1-13')).toEqual({ ertek: '12345676-1-13', hiba: null, figyelmeztetes: null });
    expect(adoszamEllenor('12345676113').ertek).toBe('12345676-1-13');
    expect(adoszamEllenor('12345676-2-13').figyelmeztetes).toMatch(/nem alanyi ÁFA-mentes/);
    expect(adoszamEllenor('12345676-2-13').ertek).toBe('12345676-2-13');
    expect(adoszamEllenor('1234').hiba).toMatch(/12345678-1-23/);
    expect(adoszamEllenor('12345676-9-13').hiba).toMatch(/ÁFA-kód/);
    expect(adoszamEllenor('')).toEqual({ ertek: null, hiba: null, figyelmeztetes: null });
  });
});

describe('chat bubbles', () => {
  it('our side: me, the team, the accountant; with their names', () => {
    expect(buborekOldal({ sender: 'en' })).toEqual({ sajat: true, nev: null });
    expect(buborekOldal({ sender: 'csapat', senderName: 'Anna · ügyfélszolgálat' })).toEqual({ sajat: true, nev: 'Anna · ügyfélszolgálat' });
    expect(buborekOldal({ sender: 'konyvelo', senderName: 'Kovács Bence' })).toEqual({ sajat: true, nev: 'Kovács Bence' });
    expect(buborekOldal({ sender: 'ugyfel' })).toEqual({ sajat: false, nev: null });
  });
});

describe('left menu per role (SPEC §26.3.1)', () => {
  const kulcsok = (o: Parameters<typeof menuCsoportok>[0]) => menuCsoportok(o).flatMap((g) => g.elemek.map((e) => e.kulcs));
  it('csapat sees only its own pages; Intézzük helyette between Visszahívások and Vállalkozás-indítás (SPEC §27.6.1)', () => {
    expect(kulcsok({ csapat: true, konyvelo: false, admin: false, demo: true, konyvelonekVoltVisszahivasa: false })).toEqual(['visszahivasok', 'helyettunk', 'vallalkozas', 'uzenetek', 'beallitasok']);
  });
  it('accountant: Intézzük helyette only when one of his clients has (had) an assisted request', () => {
    expect(kulcsok({ csapat: false, konyvelo: true, admin: false, demo: false, konyvelonekVoltVisszahivasa: false })).not.toContain('helyettunk');
    const van = kulcsok({ csapat: false, konyvelo: true, admin: false, demo: false, konyvelonekVoltVisszahivasa: true, konyvelonekVoltHelyettunk: true });
    expect(van.indexOf('helyettunk')).toBe(van.indexOf('visszahivasok') + 1);
  });
  it('accountant: never Időpontok; Visszahívások only when he had one', () => {
    const nincs = kulcsok({ csapat: false, konyvelo: true, admin: false, demo: false, konyvelonekVoltVisszahivasa: false });
    expect(nincs).not.toContain('visszahivasok');
    expect(nincs).not.toContain('vallalkozas');
    expect(nincs.some((k) => String(k).includes('idopont'))).toBe(false);
    expect(kulcsok({ csapat: false, konyvelo: true, admin: false, demo: false, konyvelonekVoltVisszahivasa: true })).toContain('visszahivasok');
  });
  it('admin: owner pages + both queues + Csapat, no accountant pages', () => {
    const k = kulcsok({ csapat: false, konyvelo: false, admin: true, demo: false, konyvelonekVoltVisszahivasa: false });
    expect(k).toEqual(expect.arrayContaining(['visszahivasok', 'helyettunk', 'vallalkozas', 'admin_csapat', 'admin']));
    expect(k.slice(0, 3)).toEqual(['visszahivasok', 'helyettunk', 'vallalkozas']);
    expect(k).not.toContain('ugyfelek');
    expect(k).not.toContain('uzenetek');
    expect(k).not.toContain('admin_demo');
  });
  it('landing pages', () => {
    expect(kezdolap('csapat', false)).toBe('/visszahivasok');
    expect(kezdolap('accountant', true)).toBe('/ugyfelek');
    expect(kezdolap('admin', false)).toBe('/admin');
  });
});
