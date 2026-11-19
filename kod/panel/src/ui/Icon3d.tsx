// The approved realistic 3D icons (dizajn/C2_modern/assets/ikon3d, copied to public/a/ikon3d).
// No other pictorial icon exists in the panel (owner decision, SPEC §2.6). Arrows, ×, + and chevrons are
// NOT used as icons: they are replaced by words (TERV 0: „Vissza”, „Bezár”, „Megnyitom”). The only glyph left
// is the text tick next to a word (TERV 00: „Sima szöveg pipával”, e.g. „✓ Kimásolva”).
import type { CSSProperties } from 'react';

export type Icon3dName =
  | 'befizetve' | 'dosszie' | 'ertesites' | 'feltoltes' | 'fiok' | 'fooldal' | 'fotozas' | 'hataridok'
  | 'igazolas' | 'irat' | 'kerdezek' | 'masolas' | 'nyugta' | 'szamlaszam' | 'szamolo' | 'uzenetek'
  // spare icons from the same approved sheet, already used by the approved 04 PNG
  | 'szamlak' | 'boritek' | 'bevallas'
  // the small "kész" seal and the shadowless variants (≤ 44 pt)
  | 'befizetve_jel'
  | 'irat_arnyektalan' | 'nyugta_arnyektalan' | 'szamolo_arnyektalan' | 'ertesites_arnyektalan'
  | 'befizetve_arnyektalan' | 'masolas_arnyektalan' | 'szamlaszam_arnyektalan'
  // the approved 3D tear-off calendar from sheet C (design 02), used for appointments
  | 'tepnaptar'
  // SPEC §26 (ICON3D_EXTRA, approved sheet C): the orange clock = callbacks (24–48 h), the blue padlock = locked
  | 'ora'
  | 'lakat';

// Sheet B icons have a floor shadow that reads as a stray grey strip at ≤ 44 px (TERV A4): use the cut-out.
const ARNYEKTALAN = new Set(['irat', 'nyugta', 'szamolo', 'ertesites', 'befizetve', 'masolas', 'szamlaszam']);

const SIZES: Record<string, number[]> = {
  default: [24, 28, 36, 44, 56, 72],
  befizetve_jel: [20, 24, 28, 44, 84],
  arnyektalan: [24, 28, 36, 44],
};

export function iconSource(name: Icon3dName, displayPx: number): number {
  const list = name === 'befizetve_jel' ? SIZES.befizetve_jel! : name.endsWith('_arnyektalan') ? SIZES.arnyektalan! : SIZES.default!;
  // always scale down: the smallest file >= the displayed size, else the largest
  return list.find((s) => s >= displayPx) ?? list[list.length - 1]!;
}

export function iconName(n: Icon3dName, displayPx: number): Icon3dName {
  return displayPx <= 44 && ARNYEKTALAN.has(n) ? (`${n}_arnyektalan` as Icon3dName) : n;
}

export function I3({ n, s = 28, className, style, alt = '' }: { n: Icon3dName; s?: number; className?: string; style?: CSSProperties; alt?: string }) {
  if (n === 'tepnaptar') {
    // 79 × 96 object: fit it into the square box like the other icons.
    return (
      <img
        className={`i3${className ? ` ${className}` : ''}`}
        src="/a/illusztraciok/tepnaptar_3d@2x.png"
        srcSet="/a/illusztraciok/tepnaptar_3d@2x.png 2x, /a/illusztraciok/tepnaptar_3d@3x.png 3x"
        width={s}
        height={s}
        style={{ width: s, height: s, objectFit: 'contain', ...style }}
        alt={alt}
        draggable={false}
        decoding="async"
      />
    );
  }
  const nev = iconName(n, s);
  const src = iconSource(nev, s);
  const base = `/a/ikon3d/${nev}_${src}`;
  return (
    <img
      className={`i3${className ? ` ${className}` : ''}`}
      src={`${base}@2x.png`}
      srcSet={`${base}@2x.png 2x, ${base}@3x.png 3x`}
      width={s}
      height={s}
      style={{ width: s, height: s, ...style }}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}

/** A 3D object with the small violet "kész" seal on its top-right corner (design 04). */
export function IkonJelvennyel({ n, kesz }: { n: Icon3dName; kesz?: boolean }) {
  return (
    <span className="ikonkor">
      <I3 n={n} s={44} />
      {kesz && (
        <span className="jelveny">
          <I3 n="befizetve_jel" s={19} />
        </span>
      )}
    </span>
  );
}
