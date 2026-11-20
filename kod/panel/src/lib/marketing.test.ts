// SPEC §31.4: the Marketing tab – only the admin's menu has it; the link builder; the range query; the channel labels.
import { describe, expect, it } from 'vitest';
import { menuCsoportok, type MenuKulcs } from './csapat';
import { arany, kampanyLink, marketingQuery } from './marketing';
import { MARKETING_CHANNEL_LABELS, MARKETING_CHANNELS, campaignSlug, channelOf } from '../_shared/marketing';

const kulcsok = (o: Parameters<typeof menuCsoportok>[0]): MenuKulcs[] => menuCsoportok(o).flatMap((c) => c.elemek.map((e) => e.kulcs));

describe('Marketing menu (admin only)', () => {
  it('the admin has it, before Honnan jöttek', () => {
    const k = kulcsok({ csapat: false, konyvelo: false, admin: true, demo: false, konyvelonekVoltVisszahivasa: false });
    expect(k).toContain('admin_marketing');
    expect(k.indexOf('admin_marketing')).toBe(k.indexOf('admin_forrasok') - 1);
    const el = menuCsoportok({ csapat: false, konyvelo: false, admin: true, demo: false, konyvelonekVoltVisszahivasa: false })
      .flatMap((c) => c.elemek)
      .find((e) => e.kulcs === 'admin_marketing');
    expect(el).toMatchObject({ to: '/admin/marketing', felirat: 'Marketing' });
  });
  it('an admin who is also an accountant has it too', () => {
    expect(kulcsok({ csapat: false, konyvelo: true, admin: true, demo: true, konyvelonekVoltVisszahivasa: true })).toContain('admin_marketing');
  });
  it('accountant and team member: never', () => {
    expect(kulcsok({ csapat: false, konyvelo: true, admin: false, demo: false, konyvelonekVoltVisszahivasa: true, konyvelonekVoltHelyettunk: true })).not.toContain('admin_marketing');
    expect(kulcsok({ csapat: true, konyvelo: false, admin: false, demo: true, konyvelonekVoltVisszahivasa: false })).not.toContain('admin_marketing');
  });
});

describe('campaign link builder', () => {
  it('a YouTube video link: slugged campaign, the suggested medium, the landing address from the server', () => {
    expect(kampanyLink('https://adozz.hu', { forras: 'youtube', kampany: 'Átalányadó 2027 – röviden', tartalom: '', medium: '' })).toBe(
      'https://adozz.hu/?utm_source=youtube&utm_medium=video&utm_campaign=atalanyado-2027-roviden',
    );
  });
  it('own medium and content; no campaign → no link yet', () => {
    expect(kampanyLink('https://adozz.hu/', { forras: 'facebook', kampany: 'Őszi poszt', tartalom: 'Kép 2', medium: 'Fizetett' })).toBe(
      'https://adozz.hu/?utm_source=facebook&utm_medium=fizetett&utm_campaign=oszi-poszt&utm_content=kep-2',
    );
    expect(kampanyLink('https://adozz.hu', { forras: 'youtube', kampany: '   ', tartalom: '', medium: '' })).toBeNull();
    expect(kampanyLink('', { forras: 'youtube', kampany: 'x', tartalom: '', medium: '' })).toBeNull();
  });
  it('the slug groups the same name the same way (the backend and Umami see the same value)', () => {
    expect(campaignSlug('KATA vagy átalányadó?')).toBe(campaignSlug('kata-vagy-atalanyado'));
  });
});

describe('range query and ratios', () => {
  it('presets and the custom range (only with both days)', () => {
    expect(marketingQuery('7', '', '')).toEqual({ nap: '7' });
    expect(marketingQuery('egyeni', '2026-11-01', '')).toEqual({ nap: '30' });
    expect(marketingQuery('egyeni', '2026-11-01', '2026-11-20')).toEqual({ tol: '2026-11-01', ig: '2026-11-20' });
  });
  it('ratio: no division by zero or by an unknown number', () => {
    expect(arany(3, 12)).toBe('25%');
    expect(arany(1, 0)).toBe('–');
    expect(arany(1, null)).toBe('–');
  });
});

describe('channel labels', () => {
  it('every channel has a Hungarian label; the rule is the shared one', () => {
    for (const c of MARKETING_CHANNELS) expect(MARKETING_CHANNEL_LABELS[c]).toBeTruthy();
    expect(MARKETING_CHANNEL_LABELS.kozvetlen).toBe('Közvetlen');
    expect(channelOf({ referrerDomain: 'm.youtube.com' })).toBe('youtube');
  });
});
