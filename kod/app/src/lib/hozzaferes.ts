// Korlátozott mód a bekötés alatt (SPEC §26.5.2). A szerver dönt (Me.access + 403 'locked_until_active'); az app csak
// megmutatja. Ha egy régebbi szerver még nem küld `access`-t, a közös szabálylistából (CLIENT_FEATURE_RULES) számol a
// lifecycle alapján – így sosem nyit meg többet, mint amit a szerver enged, és sosem zár le csendben.
import type { ClientAccess, ClientAccessFeature, Me } from '../_shared/api';
import { CLIENT_FEATURE_RULES, CLIENT_FEATURES, type ClientFeature } from '../_shared/enums';
import { fillPlaceholders } from '../_shared/bekotes';

export function hozzaferesBol(me: Me | undefined | null): ClientAccess {
  if (me?.access) return me.access;
  const korlatozott = me?.client?.lifecycle === 'bekotes_alatt';
  const fn = me?.accountant?.firstName ?? 'a könyvelőd';
  return {
    mode: korlatozott ? 'korlatozott' : 'teljes',
    features: CLIENT_FEATURES.map((f) => {
      const r = CLIENT_FEATURE_RULES[f];
      const state = korlatozott ? r.beforeActivation : 'nyitva';
      return { feature: f, state, label: r.label, reason: state === 'nyitva' || !r.reason ? null : fillPlaceholders(r.reason, { firstName: fn }) };
    }),
    activationHint: null,
  };
}

export function funkcio(a: ClientAccess, f: ClientFeature): ClientAccessFeature {
  return a.features.find((x) => x.feature === f) ?? { feature: f, state: 'nyitva', label: CLIENT_FEATURE_RULES[f].label, reason: null };
}

/** Zárva van-e (a 'keresre' is zárva, ha nincs nyitott kérés, amihez tartozna). */
export function zarva(a: ClientAccess, f: ClientFeature, vanNyitottKeres = false): boolean {
  const x = funkcio(a, f);
  if (x.state === 'zarva') return true;
  if (x.state === 'keresre') return !vanNyitottKeres;
  return false;
}
