// Small domain renderers: flags, statuses, deadlines. Status = text (+ the violet seal for "kész"), never a pill button.
import type { ClientFlag, DocumentStatus, SubscriptionStatus } from '../_shared/enums';
import { FLAG_LABEL, SUB_LABEL, docStatusLabel } from '../lib/labels';
import { datum, hatridoSzoveg, napKulonbseg } from '../lib/format';
import { I3 } from './Icon3d';

export function Jelzok({ flags }: { flags: ClientFlag[] }) {
  if (!flags.length) return <span className="halvany">–</span>;
  return (
    <span className="cimkek">
      {flags.map((f) =>
        f === 'rendben' ? (
          <span key={f} className="allapot">
            <I3 n="befizetve_jel" s={18} />
            <span className="szo">Rendben</span>
          </span>
        ) : (
          <span key={f} className={`cimke ${f === 'dij_elmaradt' ? 'hiba' : f === 'bekotes_alatt' ? 'info' : 'figyel'}`}>
            {FLAG_LABEL[f]}
          </span>
        ),
      )}
    </span>
  );
}

export function DokAllapot({ s, firstName, nav, mikor }: { s: DocumentStatus; firstName: string; nav?: boolean; mikor?: string }) {
  const kesz = s === 'feldolgozva' || s === 'beadva';
  return (
    <span className="allapot">
      {kesz && <I3 n="befizetve_jel" s={18} />}
      <span>
        <span className="szo">{docStatusLabel(s, firstName, nav)}</span>
        {mikor && `, ${mikor}`}
      </span>
    </span>
  );
}

/** "október 12." + amber "még 3 nap" label when close, red when overdue. */
export function Hatarido({ due, today, cim }: { due: string; today: string; cim?: string }) {
  const d = napKulonbseg(due, today);
  return (
    <span className="hatarido">
      {cim && <span style={{ display: 'block', fontWeight: 550, whiteSpace: 'normal' }}>{cim}</span>}
      <span className="szam">{datum(due)}</span>{' '}
      {d < 0 ? <span className="cimke hiba">{hatridoSzoveg(due, today)}</span> : d <= 7 ? <span className="cimke ido">{hatridoSzoveg(due, today)}</span> : <span className="halvany kicsi">{hatridoSzoveg(due, today)}</span>}
    </span>
  );
}

export function ElofizetesAllapot({ s }: { s: SubscriptionStatus | null }) {
  if (!s) return <span className="halvany">–</span>;
  if (s === 'active')
    return (
      <span className="allapot">
        <span className="szo">Aktív</span>
      </span>
    );
  return <span className={`cimke ${s === 'past_due' || s === 'suspended' ? 'hiba' : s === 'incomplete' ? 'info' : ''}`}>{SUB_LABEL[s]}</span>;
}
