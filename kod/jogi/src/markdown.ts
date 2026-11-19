// A jogi szövegek szűk Markdown-készlete (SPEC §21): `#`, `##`, bekezdés, `-` lista, `**félkövér**`.
// Bővítések (visszafelé kompatibilisek – egy egyszerűbb szedő sima szövegként mutatja őket):
//  - `1. ` kezdetű sor: számozott listaelem;
//  - `- [ ] ` / `- [x] ` listaelem: jelölőnégyzet;
//  - a fájl első sora a TERVEZET-jelzés, ezt a szedő címkeként emeli ki.

export const TERVEZET_SOR = 'TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács.';

export interface Szakasz {
  text: string;
  bold: boolean;
}

export type Blokk =
  | { tipus: 'tervezet'; szoveg: string }
  | { tipus: 'h1'; reszek: Szakasz[] }
  | { tipus: 'h2'; reszek: Szakasz[] }
  | { tipus: 'p'; reszek: Szakasz[] }
  | { tipus: 'li'; jel: 'pont' | 'szam' | 'negyzet'; szam?: number; bejelolve?: boolean; reszek: Szakasz[] };

const H1 = /^# (.+)$/;
const H2 = /^## (.+)$/;
const LISTA = /^- (.*)$/;
const SZAMOZOTT = /^(\d{1,3})\. (.*)$/;
const NEGYZET = /^\[( |x|X)\] (.*)$/;

/** `**…**` szerinti felbontás. Páratlan számú `**` esetén a maradék szó szerint marad. */
export function inline(szoveg: string): Szakasz[] {
  const darabok = szoveg.split('**');
  if (darabok.length % 2 === 0) {
    // páratlan számú jelölő: az utolsó nyitót szövegként kezeljük
    const utolso = darabok.pop() ?? '';
    darabok[darabok.length - 1] = `${darabok[darabok.length - 1] ?? ''}**${utolso}`;
  }
  const ki: Szakasz[] = [];
  darabok.forEach((d, i) => {
    if (d.length > 0) ki.push({ text: d, bold: i % 2 === 1 });
  });
  return ki;
}

export function parse(md: string): Blokk[] {
  const sorok = md.replace(/\r\n?/g, '\n').split('\n');
  const blokkok: Blokk[] = [];
  let bekezdes: string[] = [];
  let utolsoLi: Extract<Blokk, { tipus: 'li' }> | null = null;
  let elsoTartalom = true;

  const lezar = () => {
    if (bekezdes.length > 0) {
      blokkok.push({ tipus: 'p', reszek: inline(bekezdes.join(' ')) });
      bekezdes = [];
    }
  };

  for (const nyersSor of sorok) {
    const sor = nyersSor.replace(/\s+$/, '');
    if (sor.trim() === '') {
      lezar();
      utolsoLi = null;
      continue;
    }
    if (elsoTartalom) {
      elsoTartalom = false;
      if (sor.trim() === TERVEZET_SOR) {
        blokkok.push({ tipus: 'tervezet', szoveg: TERVEZET_SOR });
        continue;
      }
    }
    // listaelem folytatósora (legalább két szóköz behúzás)
    if (utolsoLi && /^ {2,}\S/.test(sor)) {
      utolsoLi.reszek = inline(`${szovegE(utolsoLi.reszek)} ${sor.trim()}`);
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = H2.exec(sor))) {
      lezar(); utolsoLi = null;
      blokkok.push({ tipus: 'h2', reszek: inline(m[1]!.trim()) });
    } else if ((m = H1.exec(sor))) {
      lezar(); utolsoLi = null;
      blokkok.push({ tipus: 'h1', reszek: inline(m[1]!.trim()) });
    } else if ((m = LISTA.exec(sor))) {
      lezar();
      const torzs = m[1]!;
      const n = NEGYZET.exec(torzs);
      utolsoLi = n
        ? { tipus: 'li', jel: 'negyzet', bejelolve: n[1] !== ' ', reszek: inline(n[2]!) }
        : { tipus: 'li', jel: 'pont', reszek: inline(torzs) };
      blokkok.push(utolsoLi);
    } else if ((m = SZAMOZOTT.exec(sor))) {
      lezar();
      utolsoLi = { tipus: 'li', jel: 'szam', szam: Number(m[1]), reszek: inline(m[2]!) };
      blokkok.push(utolsoLi);
    } else {
      utolsoLi = null;
      bekezdes.push(sor.trim());
    }
  }
  lezar();
  return blokkok;
}

function szovegE(reszek: Szakasz[]): string {
  return reszek.map((r) => (r.bold ? `**${r.text}**` : r.text)).join('');
}

/** A blokkok sima szövege (kereséshez, tesztekhez). */
export function simaSzoveg(blokkok: Blokk[]): string {
  return blokkok
    .map((b) => (b.tipus === 'tervezet' ? b.szoveg : b.reszek.map((r) => r.text).join('')))
    .join('\n');
}

/**
 * A szűk Markdown-készlet ellenőrzése. Üres tömb = rendben.
 * A hibaüzenet tartalmazza a sor számát.
 */
export function ellenoriz(md: string, opc: { tervezetKell?: boolean } = {}): string[] {
  const hibak: string[] = [];
  const sorok = md.replace(/\r\n?/g, '\n').split('\n');
  const elso = sorok.findIndex((s) => s.trim() !== '');
  if ((opc.tervezetKell ?? true) && (elso < 0 || sorok[elso]!.trim() !== TERVEZET_SOR)) {
    hibak.push(`1. sor: az első sornak ez kell legyen: "${TERVEZET_SOR}"`);
  }
  let h1 = 0;
  sorok.forEach((s, i) => {
    const n = i + 1;
    if (/^#{3,}\s/.test(s)) hibak.push(`${n}. sor: csak # és ## címsor használható`);
    if (/^# /.test(s)) h1++;
    if (/^\s*[*+] /.test(s)) hibak.push(`${n}. sor: lista csak "- " jellel kezdődhet`);
    if (/^\s*>/.test(s)) hibak.push(`${n}. sor: idézet (>) nem használható`);
    if (/^\s*\|/.test(s)) hibak.push(`${n}. sor: táblázat nem használható`);
    if (/^\s*```/.test(s)) hibak.push(`${n}. sor: kódblokk nem használható`);
    if (/\[[^\]]+\]\([^)]+\)/.test(s)) hibak.push(`${n}. sor: Markdown-link nem használható – írd ki a címet szövegként`);
    if (/(^|[^*])\*[^*\s][^*]*\*(?!\*)/.test(s)) hibak.push(`${n}. sor: dőlt betű (*…*) nem használható`);
    if (/`/.test(s)) hibak.push(`${n}. sor: kód-jelölés (\`) nem használható`);
    if (/<[a-zA-Z/][^>]*>/.test(s)) hibak.push(`${n}. sor: HTML nem használható`);
    if ((s.match(/\*\*/g) ?? []).length % 2 === 1) hibak.push(`${n}. sor: páratlan számú ** jelölő`);
    if (/^ {1}\S/.test(s)) hibak.push(`${n}. sor: egy szóközös behúzás – a folytatósor legalább 2 szóközzel kezdődjön`);
  });
  if (h1 !== 1) hibak.push(`pontosan egy # címsor kell (most: ${h1})`);
  return hibak;
}
