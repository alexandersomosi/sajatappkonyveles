// Shared C2 elements for the onboarding video (1080x1920). Design source: dizajn/C2_modern/app_v2/tokens.css (390 px wide
// screens) scaled by ~2.77. Rules kept: Geist only, brand-blue (#1428DB) band with the guilloche rosette, white sheets on the tinted
// ground, realistic 3D icons (never line/vector icons, never a colored circle behind an icon), the drawn avatar only for
// the accountant, capsule = button, 6 pt tag = status, solid number discs, the violet seal = done.
import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, Easing, Img, interpolate, staticFile } from 'remotion';

export const W = 1080;
export const H = 1920;
export const M = 48; // side margin (16 pt)
export const SAV_ALAP = 470; // band height in content scenes

// Palette: brand = vivid blue #1428DB since the owner's 11-18 17:50 decision (dizajn/C3_zold/kek.css, dizajn/PALETTA.md);
// the old ink-blue values are in ../_regi/remotion_src_elotte_kek_1817/elemek.tsx.
export const C = {
  tintakek: '#1428DB',
  tintakekSzoveg: '#1226B8',
  alap: '#E4E8F3',
  lap: '#FFFFFF',
  tinta: '#10152B',
  halvany: '#505873',
  fejlecHalvany: '#C9D2FF',
  hajszal: '#E2E6F1',
  keret: '#C9D0E4',
  nyomott: '#EEF1F6',
  gombMAlap: '#DFE4FD',
  borostyan: '#845300',
  borostyanAlap: '#F7E8C6',
  tollkekSavon: '#C9D2FF',
};

export const BETU = '"Geist", "Segoe UI", Arial, sans-serif';

/** Loads the design's own Geist variable font before the first frame is rendered. */
export const useGeist = () => {
  const [h] = useState(() => delayRender('Geist betöltése'));
  useEffect(() => {
    const f = new FontFace('Geist', `url(${staticFile('fontok/Geist_wght.ttf')}) format("truetype")`, { weight: '100 900' });
    f.load()
      .then((ff) => {
        document.fonts.add(ff);
        continueRender(h);
      })
      .catch(() => continueRender(h));
  }, [h]);
};

const ki = Easing.out(Easing.cubic);
/** 0 → 1 over `hossz` frames from `kezd` (ease-out). */
export const be = (f: number, kezd: number, hossz = 14) =>
  interpolate(f, [kezd, kezd + hossz], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ki });
/** 1 → 0 over `hossz` frames ending at `veg`. */
export const el = (f: number, veg: number, hossz = 10) =>
  interpolate(f, [veg - hossz, veg], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });

/** Appear: fade + rise (px) + tiny scale. */
export const megjelen = (p: number, emel = 40): React.CSSProperties => ({
  opacity: p,
  transform: `translateY(${(1 - p) * emel}px) scale(${0.985 + 0.015 * p})`,
});

/** Pop for 3D objects: p from remotion spring() (may overshoot slightly above 1). */
export const pattan = (p: number): React.CSSProperties => ({
  opacity: Math.min(1, Math.max(0, p * 1.8)),
  transform: `scale(${0.78 + 0.22 * p})`,
});

/** A realistic 3D icon from the approved set (public/ikon/<nev>.png, ~210-260 px source: shown at <= 240 px). */
export const Ikon: React.FC<{ nev: string; meret: number; style?: React.CSSProperties }> = ({ nev, meret, style }) => (
  <Img src={staticFile(`ikon/${nev}.png`)} style={{ width: meret, height: meret, objectFit: 'contain', display: 'block', flex: 'none', ...style }} />
);

/** An object visual (public/targy/<nev>.png) with the C2 soft floor shadow. */
export const Targy: React.FC<{ nev: string; szel: number; mag: number; arnyek?: number; style?: React.CSSProperties }> = ({
  nev,
  szel,
  mag,
  arnyek,
  style,
}) => (
  <div style={{ position: 'relative', width: szel, height: mag, flex: 'none', ...style }}>
    {arnyek ? (
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -6,
          width: arnyek,
          height: 22,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(closest-side, rgba(16,21,60,.28), rgba(16,21,60,0))',
        }}
      />
    ) : null}
    <Img src={staticFile(`targy/${nev}.png`)} style={{ position: 'absolute', inset: 0, width: szel, height: mag, objectFit: 'contain' }} />
  </div>
);

/** The drawn accountant avatar, round, with the 1 pt hairline ring on white (design A9). */
export const Avatar: React.FC<{ meret: number; feheren?: boolean }> = ({ meret, feheren = true }) => (
  <Img
    src={staticFile('targy/avatar.png')}
    style={{
      width: meret,
      height: meret,
      borderRadius: '50%',
      flex: 'none',
      boxShadow: feheren ? `0 0 0 3px ${C.hajszal}` : 'none',
    }}
  />
);

/** White sheet (18 pt radius). */
export const Lap: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.lap, borderRadius: 50, position: 'absolute', left: M, right: M, overflow: 'hidden', ...style }}>{children}</div>
);

/** Solid number disc: current = ink disc + white number; remaining = ground disc + ink number. */
export const Korong: React.FC<{ n: number | string; allapot: 'most' | 'hatra' | 'savon_most' | 'savon_hatra'; meret?: number }> = ({
  n,
  allapot,
  meret = 64,
}) => {
  const bg = { most: C.tintakek, hatra: C.alap, savon_most: '#FFFFFF', savon_hatra: 'rgba(255,255,255,.16)' }[allapot];
  const fg = { most: '#FFFFFF', hatra: C.tinta, savon_most: C.tintakek, savon_hatra: 'rgba(255,255,255,.78)' }[allapot];
  return (
    <div
      style={{
        width: meret,
        height: meret,
        borderRadius: '50%',
        background: bg,
        color: fg,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: meret * 0.5,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {n}
    </div>
  );
};

/** Status tag (6 pt radius = status, never a button). */
export const Cimke: React.FC<{ szoveg: string; tipus?: 'borostyan' | 'tinta' | 'semleges'; meret?: number; style?: React.CSSProperties }> = ({
  szoveg,
  tipus = 'borostyan',
  meret = 36,
  style,
}) => {
  const s = {
    borostyan: { background: C.borostyanAlap, color: C.borostyan },
    tinta: { background: C.tintakek, color: '#FFFFFF' },
    semleges: { background: C.nyomott, color: C.tinta },
  }[tipus];
  return (
    <span
      style={{
        display: 'inline-block',
        borderRadius: 16,
        padding: `${meret * 0.22}px ${meret * 0.5}px`,
        fontSize: meret,
        fontWeight: 650,
        lineHeight: 1.15,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        ...s,
        ...style,
      }}
    >
      {szoveg}
    </span>
  );
};

/** Capsule button (visual only). */
export const Kapszula: React.FC<{ szoveg: string; tipus?: 'elso' | 'savon'; style?: React.CSSProperties }> = ({ szoveg, tipus = 'elso', style }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: tipus === 'elso' ? 150 : 104,
      padding: tipus === 'elso' ? '0 64px' : '0 40px',
      borderRadius: 999,
      background: tipus === 'elso' ? C.tintakek : 'transparent',
      boxShadow: tipus === 'savon' ? 'inset 0 0 0 4px rgba(255,255,255,.78)' : 'none',
      color: '#FFFFFF',
      fontSize: tipus === 'elso' ? 50 : 42,
      fontWeight: 650,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {szoveg}
  </div>
);

/** Small-caps section heading inside a sheet ("MIÉRT KELL?"). */
export const Fejcim: React.FC<{ szoveg: string; style?: React.CSSProperties }> = ({ szoveg, style }) => (
  <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '0.08em', color: C.halvany, textTransform: 'uppercase', ...style }}>{szoveg}</div>
);

/** The guilloche rosette of the band (0.5 px, 7 %), centred at (x, y), slowly turning. */
export const Rozetta: React.FC<{ x: number; y: number; meret?: number; forgas?: number }> = ({ x, y, meret = 1220, forgas = 0 }) => (
  <Img
    src={staticFile('rozetta.svg')}
    style={{
      position: 'absolute',
      left: x - meret / 2,
      top: y - meret / 2,
      width: meret,
      height: meret,
      transform: `rotate(${forgas}deg)`,
      pointerEvents: 'none',
    }}
  />
);

/** The floating tab bar of the app (§26.5.1: also during onboarding), scaled; `zarolt` puts a small lock on Dosszié. */
export const Fulsor: React.FC<{ zarolt?: number; aktiv?: string; style?: React.CSSProperties }> = ({ zarolt = 0, aktiv = 'fooldal', style }) => {
  const fulek: [string, string, number][] = [
    ['fooldal', 'Főoldal', 1],
    ['dosszie', 'Dosszié', 0.965],
    ['uzenetek', 'Üzenetek', 1.11],
    ['fiok', 'Fiók', 0.93],
  ];
  return (
    <div style={{ display: 'flex', gap: 26, alignItems: 'center', ...style }}>
      <div
        style={{
          flex: 1,
          height: 176,
          borderRadius: 999,
          background: 'rgba(255,255,255,.96)',
          boxShadow: '0 0 0 3px rgba(16,21,60,.08), 0 22px 60px -16px rgba(16,21,60,.32)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          padding: 14,
        }}
      >
        {fulek.map(([nev, felirat, sk]) => (
          <div key={nev} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <div style={{ position: 'relative' }}>
              <Ikon nev={nev} meret={78} style={{ transform: `scale(${sk})` }} />
              {nev === 'dosszie' && zarolt > 0.01 ? (
                <Ikon
                  nev="lakat"
                  meret={50}
                  style={{ position: 'absolute', right: -22, top: -12, opacity: zarolt, transform: `scale(${0.6 + 0.4 * zarolt})` }}
                />
              ) : null}
            </div>
            <div style={{ fontSize: 31, fontWeight: aktiv === nev ? 750 : 550, color: aktiv === nev ? C.tintakek : C.halvany }}>{felirat}</div>
            {aktiv === nev ? (
              <div style={{ position: 'absolute', bottom: 2, width: 56, height: 8, borderRadius: 6, background: C.tintakek }} />
            ) : null}
          </div>
        ))}
      </div>
      <div
        style={{
          width: 176,
          height: 176,
          borderRadius: '50%',
          background: '#FFFFFF',
          flex: 'none',
          boxShadow: `inset 0 0 0 6px ${C.tintakek}, 0 26px 60px -22px rgba(16,21,60,.55)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.tinta,
          fontSize: 29,
          fontWeight: 700,
        }}
      >
        <Ikon nev="fotozas" meret={92} style={{ marginTop: -6, marginBottom: -4 }} />
        Fotózás
      </div>
    </div>
  );
};

/** Product word mark from brand.json (no logo file: the name in Geist + the pen stroke under it, like the login band). */
export const Szovedjegy: React.FC<{ nev: string; meret: number; szin?: string; style?: React.CSSProperties }> = ({
  nev,
  meret,
  szin = '#FFFFFF',
  style,
}) => (
  <div style={{ position: 'relative', display: 'inline-block', ...style }}>
    <div style={{ fontSize: meret, fontWeight: 800, letterSpacing: '-0.035em', color: szin, lineHeight: 1 }}>{nev}</div>
    <svg width="100%" height={meret * 0.32} viewBox="0 0 100 10" preserveAspectRatio="none" style={{ display: 'block', marginTop: meret * 0.04 }}>
      <path d="M2 7.5 C 30 3.2, 62 2.6, 98 2.2" stroke={C.tollkekSavon} strokeWidth={1.3} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: meret * 0.06 }} />
    </svg>
  </div>
);
