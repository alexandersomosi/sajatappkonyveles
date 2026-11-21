// Adózz.hu v2 – „Kártya” webes Reactben: tiszta fehér kártya (r 20, finom árnyék) – a v2.css .v2-kartya osztályaival.
// Nem pasztell doboz: a kiemelést telt színes bal sáv (`jelzo`) vagy színes ikon adja, nem halvány színes alap.
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

export interface KartyaProps extends HTMLAttributes<HTMLElement> {
  /** A HTML elem (alap: div; szakasznál `section`, listában `li`). */
  as?: ElementType;
  /** Gépes nézet: r 22, belső tér 22/24. */
  asztali?: boolean;
  /** Vízszintes elrendezés (csempe + szöveg egy sorban). Alap: függőleges. */
  sor?: boolean;
  /** Listakártya: kisebb függőleges belső tér. */
  tomor?: boolean;
  /** Rácsban (nincs alsó térköz, a rács hézaga adja). */
  racsban?: boolean;
  /** 4 px-es telt színes bal sáv, pl. `var(--v2-narancs)` – a halvány pasztell doboz helyett. */
  jelzo?: string;
  children?: ReactNode;
}

export function kartyaOsztaly({ asztali, sor, tomor, racsban }: Pick<KartyaProps, 'asztali' | 'sor' | 'tomor' | 'racsban'> = {}): string {
  return ['v2-kartya', asztali && 'v2-kartya-asztali', sor && 'v2-kartya-sor', tomor && 'v2-kartya-tomor', racsban && 'v2-kartya-racsban']
    .filter(Boolean)
    .join(' ');
}

export function Kartya({ as: Elem = 'div', asztali, sor, tomor, racsban, jelzo, className, style, children, ...tobbi }: KartyaProps) {
  const st: CSSProperties | undefined = jelzo ? { borderLeft: `4px solid ${jelzo}`, ...style } : style;
  return (
    <Elem className={`${kartyaOsztaly({ asztali, sor, tomor, racsban })}${className ? ` ${className}` : ''}`} style={st} {...tobbi}>
      {children}
    </Elem>
  );
}
