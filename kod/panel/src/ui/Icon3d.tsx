// k8 (v2, tulaj 11-20): the panel's pictorial icons are the Microsoft Fluent Emoji Flat set (MIT) and the plain
// Material control icons (Apache-2.0) from kod/shared/v2 – the same drawings as the client app. The old realistic 3D
// PNGs (public/a/ikon3d) stay on disk but are no longer referenced (before k8: _regi/elotte_k8_P/src/ui/Icon3d.tsx).
// `I3` keeps its signature, so the ~180 calls switched in one place: an old 3D name goes through the shared table
// (IKON3D_UJ: e.g. hataridok → naptar, masolas → the "masol" control icon); a v2 emoji name (EmojiNev) is drawn as is.
// Without `alt` every icon is decoration (aria-hidden, never focusable); with `alt` it is read as an image.
import type { CSSProperties } from 'react';
import { Ikon, VezerloIkon, IKON3D_UJ, type EmojiNev, type RegiIkonNev, type UjIkon } from '../_shared/v2/web';

/** The old 3D names (kept for the existing calls and the role menu). */
export type Icon3dName =
  | 'befizetve' | 'dosszie' | 'ertesites' | 'feltoltes' | 'fiok' | 'fooldal' | 'fotozas' | 'hataridok'
  | 'igazolas' | 'irat' | 'kerdezek' | 'masolas' | 'nyugta' | 'szamlaszam' | 'szamolo' | 'uzenetek'
  | 'szamlak' | 'boritek' | 'bevallas'
  | 'befizetve_jel'
  | 'irat_arnyektalan' | 'nyugta_arnyektalan' | 'szamolo_arnyektalan' | 'ertesites_arnyektalan'
  | 'befizetve_arnyektalan' | 'masolas_arnyektalan' | 'szamlaszam_arnyektalan'
  | 'tepnaptar'
  | 'ora'
  | 'lakat';

/** Any icon the panel may name: an old 3D name or a v2 content icon. */
export type IkonNev = Icon3dName | EmojiNev;

/** The v2 drawing behind a name (old names through the shared table, v2 names directly). */
export function ujIkon(n: IkonNev): UjIkon {
  const regi = (IKON3D_UJ as Record<string, UjIkon | undefined>)[n as RegiIkonNev];
  return regi ?? { fajta: 'emoji', nev: n as EmojiNev };
}

export function I3({ n, s = 28, className, style, alt = '' }: { n: IkonNev; s?: number; className?: string; style?: CSSProperties; alt?: string }) {
  const uj = ujIkon(n);
  const osztaly = `i3${className ? ` ${className}` : ''}`;
  const st: CSSProperties = { width: s, height: s, ...style };
  return uj.fajta === 'emoji' ? (
    <Ikon nev={uj.nev} pt={s} label={alt || undefined} className={osztaly} style={st} />
  ) : (
    <VezerloIkon nev={uj.nev} pt={s} label={alt || undefined} className={osztaly} style={st} />
  );
}

/** A content icon on the neutral tile with the small green "kész" tick on its top-right corner (Dosszié rows). */
export function IkonJelvennyel({ n, kesz }: { n: IkonNev; kesz?: boolean }) {
  const uj = ujIkon(n);
  return (
    <span className="ikonkor">
      {uj.fajta === 'emoji' ? <Ikon nev={uj.nev} pt={34} /> : <VezerloIkon nev={uj.nev} pt={26} />}
      {kesz && (
        <span className="jelveny">
          <Ikon nev="pipa-kor" pt={18} />
        </span>
      )}
    </span>
  );
}
