// Shared visual pieces of the C2 language at desktop scale.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import brand from '../_shared/brand.json';
import { I3, type IkonNev } from './Icon3d';
import { Csempe, Logo as V2Logo, TARGYKEP_UJ, VezerloIkon, type EmojiNev } from '../_shared/v2/web';
import { ft, szam } from '../lib/format';
import type { Meter } from '../_shared/api';
import { ApiError } from '../api/client';

/** k8 (v2): the word mark "Adózz.hu" (Poppins 800, yellow "zz", swoosh) from kod/shared/v2 – an image, read as "Adózz.hu".
 *  `feher`: white letters for the blue band. Before k8: a blue square with the initial (_regi/elotte_k8_P/src/ui/kozos.tsx). */
export function Logo({ meret = 26, feher = false, alt }: { meret?: number; feher?: boolean; alt?: string }) {
  return <V2Logo meret={meret} feher={feher} alt={alt ?? brand.webName} />;
}

export function Avatar({ avatarKey = 'karakter_1_lapos', size = 'normal', alt = '' }: { avatarKey?: string; size?: 'kicsi' | 'normal' | 'nagy'; alt?: string }) {
  // Only the approved drawn character exists; unknown keys fall back to it (never a generated photo).
  const key = avatarKey === 'karakter_1_lapos' ? avatarKey : 'karakter_1_lapos';
  return (
    <img
      className={`arckep${size !== 'normal' ? ` ${size}` : ''}`}
      src={`/a/avatar/${key}@2x.png`}
      srcSet={`/a/avatar/${key}@2x.png 2x, /a/avatar/${key}@3x.png 3x`}
      alt={alt}
    />
  );
}

// k8 (v2): the empty-state objects are the big neutral tile with a Fluent icon (64 / 50), not the 3D PNGs.
// The names stay (every page uses them); the drawings come from the shared table TARGYKEP_UJ.
export type IllustrationName = 'ures_mappa' | 'hatarido_naptar' | 'level_boritek' | 'meghatalmazas_alairva' | 'tepnaptar_3d' | 'befizetve_jel';
const TARGY: Record<IllustrationName, EmojiNev> = {
  ures_mappa: TARGYKEP_UJ.ures_mappa,
  hatarido_naptar: TARGYKEP_UJ.hatarido_naptar,
  level_boritek: TARGYKEP_UJ.level_boritek,
  meghatalmazas_alairva: TARGYKEP_UJ.meghatalmazas_alairva,
  tepnaptar_3d: TARGYKEP_UJ.tepnaptar_3d,
  befizetve_jel: 'pipa-kor',
};
export function Targy({ n }: { n: IllustrationName }) {
  return (
    <div className="targy">
      <Csempe nev={TARGY[n]} meret="nagy" />
    </div>
  );
}

export function Ures({ n, cim, children, gombok }: { n: IllustrationName; cim: string; children?: ReactNode; gombok?: ReactNode }) {
  return (
    <div className="ures">
      <Targy n={n} />
      <h3>{cim}</h3>
      {children && <p>{children}</p>}
      {gombok && <div className="gombsor">{gombok}</div>}
    </div>
  );
}

/** k8 (v2): the blue hero card on top of the page (gradient, r 24, soft circles) – title, optional big number and tabs.
 *  `rozR` is kept for the old calls (it moved the retired guilloche rosette); it has no effect now. */
export function Fejlec({
  felcim,
  cim,
  mellek,
  nagyszam,
  jobb,
  fulek,
  rozR,
}: {
  felcim?: ReactNode;
  cim: ReactNode;
  mellek?: ReactNode;
  nagyszam?: ReactNode;
  jobb?: ReactNode;
  fulek?: ReactNode;
  rozR?: number;
}) {
  return (
    <header className="fejlec" style={rozR !== undefined ? ({ ['--roz-r' as string]: `${rozR}px` } as React.CSSProperties) : undefined}>
      <div className="belso">
        <div className="bal">
          {felcim && <div className="felcim">{felcim}</div>}
          <h1>{cim}</h1>
          {nagyszam && <div className="nagyszam" style={{ marginTop: 10 }}>{nagyszam}</div>}
          {mellek && <div className="mellek">{mellek}</div>}
        </div>
        {jobb && <div className="jobb">{jobb}</div>}
      </div>
      {fulek && <nav className="fulek">{fulek}</nav>}
    </header>
  );
}

export function NagyFt({ n }: { n: number }) {
  return (
    <>
      {szam(n)}
      <span className="ft">Ft</span>
    </>
  );
}
export function Ft({ n }: { n: number | null | undefined }) {
  if (n === null || n === undefined) return <span className="szam">–</span>;
  return (
    <span className="szam">
      {szam(n)}
      <span className="ft">Ft</span>
    </span>
  );
}

/** Desktop "sheet": a floating drawer from the right, text "Bezár" button (no × icon), Esc closes. */
export function Fiok({
  nyitva,
  bezar,
  cim,
  bev,
  ikon,
  szeles,
  keskeny,
  lab,
  children,
}: {
  nyitva: boolean;
  bezar: () => void;
  cim: ReactNode;
  bev?: ReactNode;
  ikon?: IkonNev;
  szeles?: boolean;
  /** 480 px (the callback detail, SPEC §26.3.2). */
  keskeny?: boolean;
  lab?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // The callers usually pass an inline bezar={() => ...}; keep the latest one in a ref so a parent re-render
  // (every keystroke in a drawer form, a react-query refetch) never re-runs the open/close effect below.
  const bezarRef = useRef(bezar);
  bezarRef.current = bezar;
  // Unsaved typing: a click outside, Escape or "Bezár" first asks ("Elveted, amit beírtál?") instead of silently
  // dropping the text. A successful save closes the drawer from the caller (nyitva=false), which never asks.
  const piszkos = useRef(false);
  const [kerdez, setKerdez] = useState(false);
  const kerdezRef = useRef(false);
  kerdezRef.current = kerdez;
  const probalBezar = () => {
    if (piszkos.current && !kerdezRef.current) setKerdez(true);
    else bezarRef.current();
  };
  const probalRef = useRef(probalBezar);
  probalRef.current = probalBezar;
  useEffect(() => {
    if (nyitva) {
      piszkos.current = false;
      setKerdez(false);
    }
  }, [nyitva]);
  useEffect(() => {
    if (!nyitva) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') probalRef.current();
    };
    document.addEventListener('keydown', onKey);
    // Focus the drawer only when it opens (not when something inside already has focus).
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore the opener only when the drawer really closes.
      if (prev && document.contains(prev)) prev.focus?.();
    };
  }, [nyitva]);
  if (!nyitva) return null;
  return (
    <>
      <div className="fuggony" onClick={probalBezar} />
      <div className={`fiok-lap${szeles ? ' szeles' : keskeny ? ' keskeny' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <div className="fej">
          {ikon && <I3 n={ikon} s={34} className="csempe-ikon" />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={id}>{cim}</h2>
            {bev && <div className="bev">{bev}</div>}
          </div>
          <button className="bezar" onClick={probalBezar} type="button">
            Bezár
          </button>
        </div>
        {kerdez && (
          <div className="uzenet-sav figyel fiok-kerdes" role="alert">
            <div style={{ flex: 1 }}>
              <b>Bezárod?</b> Amit beírtál, még nincs elmentve, és elveszik.
            </div>
            <button type="button" className="gomb-v" onClick={() => bezarRef.current()}>
              Elvetem
            </button>
            <button type="button" className="gomb-m kicsi csak-szoveg" onClick={() => setKerdez(false)}>
              Folytatom
            </button>
          </div>
        )}
        <div
          className="test"
          // typing, ticking or choosing anything marks the drawer as edited
          onInput={() => {
            piszkos.current = true;
          }}
          onChange={() => {
            piszkos.current = true;
          }}
        >
          {children}
        </div>
        {lab && <div className="lab">{lab}</div>}
      </div>
    </>
  );
}

/** Meter: the sentence is the title; solid = so far, striped = projected (design 03). */
export function Mero({ m, cim, mellek }: { m: Meter; cim?: string; mellek?: string }) {
  const used = Math.min(1, m.usedHuf / Math.max(1, m.limitHuf));
  const proj = Math.min(1, Math.max(used, m.projectedHuf / Math.max(1, m.limitHuf)));
  return (
    <div className="mero">
      <div className="mondat">{cim ?? m.sentence}</div>
      {mellek && <div className="mellek">{mellek}</div>}
      <div className="sav" role="img" aria-label={`Eddig ${ft(m.usedHuf)}, keret ${ft(m.limitHuf)}, várhatóan ${ft(m.projectedHuf)}`}>
        {proj > used && <i className="varhato" style={{ left: `${used * 100}%`, width: `${(proj - used) * 100}%` }} />}
        <i className={m.warning ? 'figyel' : ''} style={{ width: `${used * 100}%` }} />
        <span className="jel80" style={{ left: '80%' }} />
      </div>
      <div className="vegek">
        <span>
          eddig {ft(m.usedHuf)} ({Math.round(m.ratio * 100)}%)
        </span>
        <span>a keret {ft(m.limitHuf)}</span>
      </div>
    </div>
  );
}

/** Single-series monthly bars, one hue, labelled values, hover tip (dataviz rules). */
export function Oszlopok({
  adatok,
  cimke,
}: {
  adatok: { kulcs: string; felirat: string; ertek: number; becsult?: boolean; tipp?: string }[];
  cimke?: (n: number) => string;
}) {
  const max = Math.max(1, ...adatok.map((a) => a.ertek));
  const fmt = cimke ?? ((n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} M` : n >= 1000 ? `${Math.round(n / 1000)} e` : szam(n)));
  return (
    <figure>
      <div className="oszlopok" role="img" aria-label={adatok.map((a) => `${a.felirat}: ${ft(a.ertek)}`).join(', ')}>
        {adatok.map((a) => (
          <div className="o" key={a.kulcs}>
            {a.ertek > 0 && <span className="ertek">{fmt(a.ertek)}</span>}
            <span className={`v${a.ertek === 0 ? ' ures' : ''}${a.becsult ? ' becsult' : ''}`} style={{ height: `${a.ertek > 0 ? Math.max(2, (a.ertek / max) * 132) : 2}px` }} />
            <span className="tipp">{a.tipp ?? `${a.felirat}: ${ft(a.ertek)}`}</span>
          </div>
        ))}
      </div>
      <div className="oszlopok-alj" aria-hidden="true">
        {adatok.map((a) => (
          <span key={a.kulcs}>{a.felirat}</span>
        ))}
      </div>
    </figure>
  );
}

export function Toltes({ szoveg = 'Töltöm…' }: { szoveg?: string }) {
  return <div className="betoltes">{szoveg}</div>;
}
export function HibaSav({ hiba, ujra }: { hiba: unknown; ujra?: () => void }) {
  const msg = hiba instanceof ApiError ? hiba.message : 'Valami nem sikerült. Próbáld újra.';
  return (
    <div className="uzenet-sav hiba">
      <div style={{ flex: 1 }}>{msg}</div>
      {ujra && (
        <button className="gomb-sz" onClick={ujra} type="button">
          Újra
        </button>
      )}
    </div>
  );
}

/** Copy-to-clipboard button with the approved masolas icon. */
export function Masol({ ertek, felirat = 'Másolás' }: { ertek: string; felirat?: string }) {
  const [kesz, setKesz] = useState(false);
  return (
    <button
      type="button"
      className="gomb-m kicsi"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(ertek);
          setKesz(true);
          setTimeout(() => setKesz(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      <I3 n="masolas_arnyektalan" s={20} />
      {kesz ? 'Kimásolva' : felirat}
    </button>
  );
}

export function DemoCimke({ children = 'DEMO' }: { children?: ReactNode }) {
  return <span className="cimke demo">{children}</span>;
}

/** Select with the v2 chevron (Material-style control icon, k8) instead of the browser's arrow. Width/height styles go on the wrapper.
 *  Before k8 a text hint "Válassz" stood there (the old "no line icons" rule; v2 allows the control icons). */
export function Lenyilo({ style, className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { width, ...selectStyle } = style ?? {};
  return (
    <span className="lenyilo" style={width !== undefined ? { width } : undefined}>
      <select {...rest} className={className ?? 'doboz'} style={selectStyle}>
        {children}
      </select>
      <span className="jel" aria-hidden="true">
        <VezerloIkon nev="chev-le" pt={18} />
      </span>
    </span>
  );
}

/** Year switch as a segmented control (only two years are offered, so no dropdown is needed). */
export function EvValaszto({ ev, evek, valt }: { ev: number; evek: number[]; valt: (y: number) => void }) {
  return (
    <div className="szegmens" role="group" aria-label="Év">
      {evek.map((y) => (
        <button key={y} type="button" className={y === ev ? 'on' : ''} aria-pressed={y === ev} onClick={() => valt(y)}>
          {y}
        </button>
      ))}
    </div>
  );
}
