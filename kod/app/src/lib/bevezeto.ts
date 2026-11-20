// SPEC §29.10 – where /bevezeto goes. One pure function (tested in tests/bevezeto.test.ts): the server's GuidedView +
// the reason we arrived (utan = a step was just saved, vissza = "Vissza" on a step, lepes = open this step).
import type { GuidedStepView, GuidedView } from '../_shared/k29g';

export type BevezetoCel = string;

/** `/bekotes/adatok` → `/bekotes/adatok?vezetett=adatok` (keeps an existing query). */
export function vezetettHref(route: string, kulcs: string): string {
  return `${route}${route.includes('?') ? '&' : '?'}vezetett=${encodeURIComponent(kulcs)}`;
}

/** The screen of a guided step: own guided screens as they are, the existing step screens with `?vezetett=<key>`. */
export function lepesCel(s: Pick<GuidedStepView, 'key' | 'route'>): BevezetoCel | null {
  if (!s.route) return null;
  if (s.route.startsWith('/bevezeto')) return s.route;
  return vezetettHref(s.route, s.key);
}

export function bevezetoCel(v: GuidedView, p: { utan?: string | null; vissza?: string | null; lepes?: string | null }): BevezetoCel {
  if (!v.inOnboarding) return '/';
  if (p.vissza) {
    const i = v.steps.findIndex((s) => s.key === p.vissza);
    // the previous step the client can open again (a done one is opened for editing; locked ones are skipped – a 'kesobb'
    // step the client answered for now, e.g. the allowance gate's "Később", opens again)
    const elozo = (i < 0 ? [] : v.steps.slice(0, i)).reverse().find((s) => s.route && s.state !== 'kihagyva' && (s.state !== 'kesobb' || s.doneForClient));
    const cel = elozo ? lepesCel(elozo) : null;
    return cel ?? '/bevezeto/udv?lap=3';
  }
  if (p.lepes) {
    const s = v.steps.find((x) => x.key === p.lepes);
    const cel = s ? lepesCel(s) : null;
    if (cel) return cel;
  }
  if (p.utan) {
    const s = v.steps.find((x) => x.key === p.utan);
    // a step that hands over to someone else (NAV, the accountant, our team) shows once what happens next
    if (s && s.state === 'var') return `/bevezeto/var?lepes=${encodeURIComponent(s.key)}`;
  }
  if (!v.welcome.seen) return '/bevezeto/udv';
  const most = v.currentKey ? v.steps.find((s) => s.key === v.currentKey) : null;
  const cel = most ? lepesCel(most) : null;
  return cel ?? '/bevezeto/kesz';
}

/** The next actionable step after `kulcs` (the waiting screen's "Tovább: {lépés}"). */
export function kovetkezoLepes(v: GuidedView): GuidedStepView | null {
  return v.currentKey ? (v.steps.find((s) => s.key === v.currentKey) ?? null) : null;
}
