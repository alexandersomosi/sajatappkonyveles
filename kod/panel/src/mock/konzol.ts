// k8 (FELÜLET-P) – the panel mock of the owner console's read side (npm run dev:mock / kepek:k8), so the v2 look of
// /admin/konzol, the console client list and the client card can be checked without a server. Mock builds only
// (scripts/check-dist.mjs keeps it out of dist). Every name and number is fictional; the transfer rows of mock/k8.ts
// use the same client ids (cl-tr-1 … cl-tr-3), so the client card shows its own díjbekérők.
import type { ConsoleClientHeader, ConsoleClientRow, ConsoleOverview, ConsolePreview, ConsoleSection, ConsoleSectionView } from '../_shared/k29f';
import { CONSOLE_SECTION_LABELS, CONSOLE_SECTIONS } from '../_shared/k29f';

type H = (r: { q: URLSearchParams; body: Record<string, unknown>; form: FormData | null; p: Record<string, string> }) => unknown;

export interface KonzolCtx {
  on: (m: string, path: string, h: H) => void;
  nowIso: () => string;
  hiba: (status: number, code: string, msg: string, extra?: Record<string, unknown>) => Error;
  requireAdmin: () => void;
}

const honapok = (n: number, utolso = '2026-11'): string[] => {
  const [ev, ho] = utolso.split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ev, ho - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
};

const UGYFELEK: ConsoleClientRow[] = [
  { id: 'cl-tr-1', name: 'Utaló Péter', email: 'peter.utalo@demo.kezjegy.test', regime: 'atalany', accountantName: 'Kovács Bence', lifecycle: 'aktiv', subscriptionStatus: 'active', nextChargeOn: null, unpaidHuf: 0, locked: false, terminated: false, anonymized: false, isTest: true, createdAt: '2026-10-28T09:12:00Z' },
  { id: 'cl-tr-2', name: 'Átutaló Ágnes', email: 'agnes.atutalo@demo.kezjegy.test', regime: 'atalany', accountantName: 'Kovács Bence', lifecycle: 'aktiv', subscriptionStatus: 'active', nextChargeOn: null, unpaidHuf: 19_999, locked: false, terminated: false, anonymized: false, isTest: true, createdAt: '2026-10-05T14:40:00Z' },
  { id: 'cl-tr-3', name: 'Kiss Zoé', email: 'zoe.kiss@demo.kezjegy.test', regime: 'kata', accountantName: 'Kovács Bence', lifecycle: 'bekotes_alatt', subscriptionStatus: null, nextChargeOn: null, unpaidHuf: 0, locked: false, terminated: false, anonymized: false, isTest: true, createdAt: '2026-11-20T10:05:00Z' },
  { id: 'cl-kata', name: 'Szabó Kata', email: 'kata.szabo@demo.kezjegy.test', regime: 'atalany', accountantName: 'Kovács Bence', lifecycle: 'aktiv', subscriptionStatus: 'active', nextChargeOn: '2026-12-08', unpaidHuf: 0, locked: false, terminated: false, anonymized: false, isTest: true, createdAt: '2026-01-08T08:00:00Z' },
  { id: 'cl-reka', name: 'Varga Réka', email: 'reka.varga@demo.kezjegy.test', regime: 'atalany', accountantName: 'Kovács Bence', lifecycle: 'aktiv', subscriptionStatus: 'past_due', nextChargeOn: '2026-11-22', unpaidHuf: 19_999, locked: true, terminated: false, anonymized: false, isTest: true, createdAt: '2026-03-02T08:00:00Z' },
  { id: 'cl-greta', name: 'Lakatos Gréta', email: 'greta.lakatos@demo.kezjegy.test', regime: 'kata', accountantName: 'Kovács Bence', lifecycle: 'aktiv', subscriptionStatus: 'active', nextChargeOn: '2026-12-02', unpaidHuf: 0, locked: false, terminated: false, anonymized: false, isTest: true, createdAt: '2026-02-02T08:00:00Z' },
];

function attekintes(nowIso: string): ConsoleOverview {
  const h12 = honapok(12);
  const h6 = honapok(6);
  return {
    generatedAt: nowIso,
    demo: true,
    clients: {
      active: 4,
      activeAtalany: 3,
      activeKata: 1,
      onboarding: 1,
      suspended: 1,
      terminated: 0,
      perMonth: h12.map((month, i) => ({ month, uj: [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 2, 1][i]!, lemondott: 0 })),
    },
    money: {
      mrrHuf: 4 * 19_999,
      collectedPerMonth: h12.map((month, i) => {
        const db = [0, 0, 1, 2, 2, 2, 2, 2, 2, 3, 4, 4][i]!;
        const egyszeri = i === 10 ? 4_999 : 0;
        return { month, havidijHuf: db * 19_999, egyszeriHuf: egyszeri, visszaHuf: 0, nettoHuf: db * 19_999 + egyszeri };
      }),
      overdue: { count: 2, sumHuf: 2 * 19_999 },
      actionNeeded: 1,
      locked: { count: 1, reasons: { 'sikertelen fizetés': 1 } },
      upcoming7: { count: 1, sumHuf: 19_999 },
      upcoming30: { count: 3, sumHuf: 3 * 19_999 },
      feesByKind: h6.slice(-2).map((month) => ({ kind: 'valtozas', label: 'Változás bejelentése', month, paid: 1, paidHuf: 4_999, open: 0, waived: 0 })),
      demoPayments: 26,
    },
    accountants: [{ id: 'acc-bence', name: 'Kovács Bence', clients: 6, openTasks: 5, oldest: { kind: 'kérés', ageDays: 3 } }],
  };
}

const LIFECYCLE: Record<string, string> = { aktiv: 'Aktív', bekotes_alatt: 'Bekötés alatt' };

function fejlec(c: ConsoleClientRow): ConsoleClientHeader {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    lifecycle: c.lifecycle,
    lifecycleLabel: LIFECYCLE[c.lifecycle] ?? c.lifecycle,
    regime: c.regime,
    accountant: { id: 'acc-bence', name: c.accountantName ?? 'Kovács Bence' },
    subscriptionStatus: c.subscriptionStatus,
    locked: c.locked ? ['sikertelen fizetés'] : [],
    manualLock: null,
    terminated: null,
    anonymizedAt: null,
    userStatus: 'aktiv',
    sections: CONSOLE_SECTIONS.map((key) => ({ key, label: CONSOLE_SECTION_LABELS[key] })),
    canReactivate: false,
    canAnonymize: { ok: false, blockers: ['Él az előfizetése.'] },
  };
}

function szakasz(c: ConsoleClientRow, key: ConsoleSection): ConsoleSectionView {
  const title = CONSOLE_SECTION_LABELS[key];
  if (key === 'profil')
    return {
      key,
      title,
      fields: [
        { key: 'lastName', label: 'Vezetéknév', value: c.name.split(' ')[0] ?? '', editable: true },
        { key: 'firstName', label: 'Keresztnév', value: c.name.split(' ').slice(1).join(' '), editable: true },
        { key: 'email', label: 'E-mail-cím', value: c.email, editable: true },
        { key: 'phone', label: 'Telefonszám', value: '+36 30 ••• ••01', masked: true, editable: true },
        { key: 'adoszam', label: 'Adószám', value: '68801234-1-41', nav: true, editable: true },
        { key: 'hqMunicipality', label: 'Székhely települése', value: 'Budapest XIII. kerület', nav: true, editable: true },
        { key: 'activityText', label: 'Tevékenység', value: 'Grafikai tervezés', editable: true },
      ],
    };
  if (key === 'elofizetes')
    return {
      key,
      title,
      fields: [
        { key: 'status', label: 'Állapot', value: c.subscriptionStatus ?? 'nincs még' },
        { key: 'method', label: 'Fizetési mód', value: c.id.startsWith('cl-tr') ? 'átutalás (díjbekérő, 8 nap)' : 'kártya' },
        { key: 'price', label: 'Havidíj', value: '19 999 Ft' },
      ],
      note: c.id.startsWith('cl-tr') ? 'Átutalással fizet: a díjbekérőket lent, az Átutalás részben látod.' : null,
    };
  if (key === 'fizetesek')
    return {
      key,
      title,
      tables: [
        {
          title: 'Fizetések',
          columns: ['Mikor', 'Mi', 'Összeg', 'Eredmény'],
          rows: [
            { id: 'p-1', cells: ['2026. 11. 08.', 'Havidíj', '19 999 Ft', 'Sikeres'], chip: 'DEMO' },
            { id: 'p-2', cells: ['2026. 10. 08.', 'Havidíj', '19 999 Ft', 'Sikeres'], chip: 'DEMO' },
          ],
        },
      ],
    };
  return { key, title, note: 'Ebben a mintában ehhez a részhez nincs adat.' };
}

export function installKonzol(x: KonzolCtx): void {
  const { on } = x;
  on('GET', '/admin/console/step-up', () => {
    x.requireAdmin();
    return { valid: false, validUntil: null };
  });
  on('GET', '/admin/console/overview', () => {
    x.requireAdmin();
    return attekintes(x.nowIso());
  });
  on('GET', '/admin/console/clients', ({ q }) => {
    x.requireAdmin();
    const kereso = (q.get('q') ?? '').toLowerCase();
    let items = UGYFELEK.filter((c) => !kereso || c.name.toLowerCase().includes(kereso) || c.email.includes(kereso));
    if (q.get('status')) items = items.filter((c) => c.lifecycle === q.get('status'));
    if (q.get('unpaid')) items = items.filter((c) => c.unpaidHuf > 0);
    if (q.get('locked')) items = items.filter((c) => c.locked);
    if (q.get('regime')) items = items.filter((c) => c.regime === q.get('regime'));
    return { items, nextCursor: null, total: items.length };
  });
  on('GET', '/admin/console/clients/:id', ({ p }) => {
    x.requireAdmin();
    const c = UGYFELEK.find((u) => u.id === p.id);
    if (!c) throw x.hiba(404, 'not_found', 'Nincs ilyen ügyfél.');
    return fejlec(c);
  });
  on('GET', '/admin/console/clients/:id/preview', ({ p }) => {
    x.requireAdmin();
    const c = UGYFELEK.find((u) => u.id === p.id);
    if (!c) throw x.hiba(404, 'not_found', 'Nincs ilyen ügyfél.');
    const v: ConsolePreview = { clientName: c.name, screens: [{ key: 'fooldal', title: 'Főoldal', lines: [{ label: 'Félretenni most', value: 'kb. 96 000 Ft' }] }] };
    return v;
  });
  on('GET', '/admin/console/clients/:id/:section', ({ p }) => {
    x.requireAdmin();
    const c = UGYFELEK.find((u) => u.id === p.id);
    if (!c) throw x.hiba(404, 'not_found', 'Nincs ilyen ügyfél.');
    if (!(CONSOLE_SECTIONS as readonly string[]).includes(p.section!)) throw x.hiba(404, 'not_found', 'Nincs ilyen rész.');
    return szakasz(c, p.section as ConsoleSection);
  });
}
