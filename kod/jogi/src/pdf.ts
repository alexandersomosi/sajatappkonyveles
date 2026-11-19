// Mini Markdown → PDF szedő a jogi szövegekhez (pdf-lib + fontkit, Geist beágyazva → helyes ő/ű).
// Kinézet: Kézjegy C2 – tintakék fejlécsáv a guilloche-textúrával az első oldalon, fehér papír,
// Geist, a TERVEZET-jelzés borostyán címkében, a [CÉGADAT: …]-féle jelölések kiemelve.
// Vonalas ikon nincs; a jelölőnégyzet és a pipa nyomtatvány-elem, nem ikon.

import {
  PDFDocument,
  rgb,
  clip,
  endPath,
  rectangle,
  pushGraphicsState,
  popGraphicsState,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Blokk, Szakasz } from './markdown.js';
import { idopontHu } from './formatum.js';
import { nevelokFeloldasa } from './sablon.js';

// --- tokenek (dizajn/C2_modern/app_v2/tokens.css + a kék paletta: dizajn/C3_zold/kek.css, dizajn/PALETTA.md, 11-18 17:50) ---
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const SZIN = {
  tintakek: hex('#1428DB'),
  tinta: hex('#10152B'),
  halvany: hex('#505873'),
  fejlecHalvany: hex('#C9D2FF'),
  keret: hex('#C9D0E4'),
  hajszal: hex('#E2E6F1'),
  mezoAlap: hex('#F5F7FA'),
  borostyan: hex('#845300'),
  borostyanAlap: hex('#F7E8C6'),
  feher: rgb(1, 1, 1),
};

// --- oldal (A4, pt) ---
const LAP_SZ = 595.28;
const LAP_M = 841.89;
const BAL = 62;
const JOBB = 62;
const SZELES = LAP_SZ - BAL - JOBB;
const FELSO_TOVABBI = 76; // 2. oldaltól a szöveg teteje a lap tetejétől
const ALSO = 66; // a szöveg alja a lap aljától
const LABLEC_Y = 34;

const TORZS = { meret: 10.2, sor: 15.2 };
const H2 = { meret: 12.6, sor: 17, elotte: 13, utana: 3 };
const BEKEZDES_UTAN = 6.5;
const MEZO_UTAN = 1.5;
/** Az ennél alacsonyabb szakasz (címsor + tartalom) nem szakad két lapra. */
const ROVID_SZAKASZ = 190;
/** Egysoros adatmező: rövid címke kettősponttal, pont nélkül (a "1.2. …" pontokat kizárja). */
const MEZO_SOR = /^[^.:]{2,48}: \S/;
const LISTA_UTAN = 3;
const LISTA_BEHUZAS = 17;

export interface Betuk {
  normal: Uint8Array;
  felkover: Uint8Array;
}

export interface Elfogadas {
  /** Aki elfogadta (az ügyfél neve). */
  nev: string;
  /** Az elfogadás ideje (ISO vagy Date). */
  idopont: Date | string;
  /** Hogyan – alapértelmezés: az appban, bejelentkezett fiókból. */
  csatorna?: string;
}

export interface PdfOpciok {
  cim: string;
  marka: string;
  ceg: string;
  verzio: string;
  betuk: Betuk;
  /** A fejlécsáv textúrája (fehér vonalak, átlátszó PNG). Ha nincs, sima tintakék sáv. */
  textura?: Uint8Array;
  /** Az elfogadás záradéka (pl. megbízási szerződés másolata). */
  elfogadas?: Elfogadas;
  /** A kitöltött szöveg SHA-256 ujjlenyomata – az elfogadási záradékba kerül. */
  ujjlenyomat?: string;
  /** A PDF készítési ideje (tesztekhez rögzíthető). */
  most?: Date;
  /** Kiegészítő sor a láblécben (pl. "MINTA – kitalált adatokkal"). */
  lablecMegjegyzes?: string;
}

export interface PdfEredmeny {
  pdf: Uint8Array;
  oldalak: number;
  figyelmeztetesek: string[];
}

// [CÉGADAT: …], [JOGI], [TULAJ/JOGI: …], [HIÁNYZÓ: …] – a jogásznak és a tulajnak szóló jelölések
const JELOLES = /\[(?:[A-ZÁÉÍÓÖŐÚÜŰ]{3,}(?:\/[A-ZÁÉÍÓÖŐÚÜŰ]{3,})*)(?::[^\]]*)?\]/g;

interface Futam {
  text: string;
  bold: boolean;
  jeloles: boolean;
}
interface Szo {
  futamok: Futam[];
  szel: number;
}

class Szedo {
  private lap!: PDFPage;
  private y = 0;
  private oldalSzam = 0;
  readonly lapok: PDFPage[] = [];
  readonly figyelmeztetesek = new Set<string>();
  private readonly karakterek: Set<number>;

  constructor(
    private readonly doc: PDFDocument,
    private readonly normal: PDFFont,
    private readonly felkover: PDFFont,
    private readonly opc: PdfOpciok,
    private readonly textura: PDFImage | undefined,
  ) {
    this.karakterek = new Set(normal.getCharacterSet());
  }

  // ---------- karakterek ----------
  private tisztit(s: string): string {
    let ki = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0)!;
      if (this.karakterek.has(cp)) { ki += ch; continue; }
      const csere: Record<string, string> = { ' ': ' ', '−': '-', '✓': '×', '✔': '×', '\t': ' ' };
      if (csere[ch] !== undefined) { ki += csere[ch]; continue; }
      this.figyelmeztetesek.add(`Hiányzó karakter a betűből: U+${cp.toString(16).toUpperCase().padStart(4, '0')} – "?" került a helyére`);
      ki += '?';
    }
    return ki;
  }

  private betu(bold: boolean): PDFFont {
    return bold ? this.felkover : this.normal;
  }

  private szel(text: string, bold: boolean, meret: number): number {
    return this.betu(bold).widthOfTextAtSize(text, meret);
  }

  // ---------- oldalak ----------
  elsoOldal(): void {
    this.ujLap();
    const cimSorok = this.tordel(this.futamok([{ text: this.opc.cim, bold: true }]), 22, SZELES);
    const savMagas = 92 + cimSorok.length * 27;
    const savAlja = LAP_M - savMagas;
    this.lap.drawRectangle({ x: 0, y: savAlja, width: LAP_SZ, height: savMagas, color: SZIN.tintakek });
    if (this.textura) {
      // a sávra vágva csempézzük (a textúra fehér vonal átlátszó alapon)
      this.lap.pushOperators(pushGraphicsState(), rectangle(0, savAlja, LAP_SZ, savMagas), clip(), endPath());
      const csempeSz = this.textura.width * 0.5;
      const csempeM = this.textura.height * 0.5;
      for (let x = 0; x < LAP_SZ; x += csempeSz) {
        for (let y = LAP_M; y > savAlja - csempeM; y -= csempeM) {
          this.lap.drawImage(this.textura, { x, y: y - csempeM, width: csempeSz, height: csempeM, opacity: 0.55 });
        }
      }
      this.lap.pushOperators(popGraphicsState());
    }
    this.lap.drawText(this.tisztit(this.opc.marka), { x: BAL, y: LAP_M - 40, size: 11, font: this.felkover, color: SZIN.feher });
    let y = LAP_M - 40 - 34;
    for (const sor of cimSorok) {
      this.sorRajzol(sor, BAL, y, 22, SZIN.feher);
      y -= 27;
    }
    this.lap.drawText(this.tisztit(`${this.opc.ceg} · verzió: ${this.opc.verzio}`), {
      x: BAL, y: savAlja + 18, size: 9, font: this.normal, color: SZIN.fejlecHalvany,
    });
    this.y = savAlja - 30;
  }

  private ujLap(): void {
    this.lap = this.doc.addPage([LAP_SZ, LAP_M]);
    this.lapok.push(this.lap);
    this.oldalSzam++;
    if (this.oldalSzam > 1) {
      this.lap.drawText(this.tisztit(`${this.opc.marka} · ${this.opc.cim}`), {
        x: BAL, y: LAP_M - 40, size: 8, font: this.normal, color: SZIN.halvany,
      });
      this.lap.drawLine({ start: { x: BAL, y: LAP_M - 48 }, end: { x: LAP_SZ - JOBB, y: LAP_M - 48 }, thickness: 0.6, color: SZIN.hajszal });
      this.y = LAP_M - FELSO_TOVABBI;
    }
  }

  /** Van-e még `magas` pt hely; ha nincs, új lap. */
  private hely(magas: number): void {
    if (this.y - magas < ALSO) this.ujLap();
  }

  // ---------- szöveg ----------
  futamok(reszek: Szakasz[]): Futam[] {
    const ki: Futam[] = [];
    for (const r of reszek) {
      const text = this.tisztit(r.text);
      let utolso = 0;
      for (const m of text.matchAll(JELOLES)) {
        if (m.index! > utolso) ki.push({ text: text.slice(utolso, m.index), bold: r.bold, jeloles: false });
        ki.push({ text: m[0], bold: true, jeloles: true });
        utolso = m.index! + m[0].length;
      }
      if (utolso < text.length) ki.push({ text: text.slice(utolso), bold: r.bold, jeloles: false });
    }
    return ki;
  }

  /** Futamok → szavak (csak a sima szóköznél törünk; a nem törő szóköz a szó része). */
  private szavak(futamok: Futam[], meret: number): Szo[] {
    const szavak: Szo[] = [];
    let aktualis: Futam[] = [];
    const lezar = () => {
      const f = aktualis.filter((x) => x.text.length > 0);
      if (f.length > 0) szavak.push({ futamok: f, szel: f.reduce((a, x) => a + this.szel(x.text, x.bold, meret), 0) });
      aktualis = [];
    };
    for (const f of futamok) {
      const darabok = f.text.split(' ');
      darabok.forEach((d, i) => {
        if (i > 0) lezar();
        if (d.length > 0) aktualis.push({ ...f, text: d });
      });
    }
    lezar();
    return szavak;
  }

  /** Túl hosszú szó (pl. webcím) karakterenkénti tördelése. */
  private szoTor(szo: Szo, meret: number, max: number): Szo[] {
    const ki: Szo[] = [];
    let akt: Futam[] = [];
    let szel = 0;
    for (const f of szo.futamok) {
      for (const ch of f.text) {
        const w = this.szel(ch, f.bold, meret);
        if (szel + w > max && szel > 0) {
          ki.push({ futamok: akt, szel });
          akt = [];
          szel = 0;
        }
        const utolso = akt[akt.length - 1];
        if (utolso && utolso.bold === f.bold && utolso.jeloles === f.jeloles) utolso.text += ch;
        else akt.push({ ...f, text: ch });
        szel += w;
      }
    }
    if (akt.length > 0) ki.push({ futamok: akt, szel });
    return ki;
  }

  tordel(futamok: Futam[], meret: number, max: number): Szo[][] {
    const sorok: Szo[][] = [];
    let sor: Szo[] = [];
    let szel = 0;
    const szokoz = this.szel(' ', false, meret);
    for (const szo0 of this.szavak(futamok, meret)) {
      const darabok = szo0.szel > max ? this.szoTor(szo0, meret, max) : [szo0];
      for (const szo of darabok) {
        if (sor.length === 0) { sor = [szo]; szel = szo.szel; continue; }
        if (szel + szokoz + szo.szel <= max) { sor.push(szo); szel += szokoz + szo.szel; continue; }
        sorok.push(sor);
        sor = [szo];
        szel = szo.szel;
      }
    }
    if (sor.length > 0) sorok.push(sor);
    return sorok;
  }

  private sorRajzol(sor: Szo[], x0: number, y: number, meret: number, alapSzin: RGB): void {
    const szokoz = this.szel(' ', false, meret);
    let x = x0;
    sor.forEach((szo, i) => {
      for (const f of szo.futamok) {
        const w = this.szel(f.text, f.bold, meret);
        if (f.jeloles) {
          this.lap.drawRectangle({ x: x - 1, y: y - meret * 0.28, width: w + 2, height: meret * 1.22, color: SZIN.borostyanAlap });
        }
        this.lap.drawText(f.text, {
          x, y, size: meret, font: this.betu(f.bold), color: f.jeloles ? SZIN.borostyan : alapSzin,
        });
        x += w;
      }
      const kov = sor[i + 1];
      const utolsoF = szo.futamok[szo.futamok.length - 1];
      if (kov && utolsoF?.jeloles && kov.futamok[0]?.jeloles) {
        this.lap.drawRectangle({ x: x + 1, y: y - meret * 0.28, width: szokoz - 2, height: meret * 1.22, color: SZIN.borostyanAlap });
      }
      x += szokoz;
    });
  }

  private szoveg(futamok: Futam[], x: number, max: number, meret: number, sorkoz: number, szin: RGB, elsoSorElott?: (y: number) => void): void {
    const sorok = this.tordel(futamok, meret, max);
    // árva és özvegy sor ellen: legfeljebb 3 soros blokk egyben marad; egyetlen sor nem marad
    // egyedül a lap alján, és nem kerül egyedül a következő lap tetejére
    const n = sorok.length;
    const ferhet = Math.floor((this.y - ALSO) / sorkoz);
    let toresElott = -1;
    if (ferhet < n) {
      if (n <= 3 || ferhet <= 1) this.ujLap();
      else if (n - ferhet === 1) toresElott = ferhet - 1;
    }
    sorok.forEach((sor, i) => {
      if (i === toresElott) this.ujLap();
      this.hely(sorkoz);
      const alap = this.y - meret;
      if (i === 0 && elsoSorElott) elsoSorElott(alap);
      this.sorRajzol(sor, x, alap, meret, szin);
      this.y -= sorkoz;
    });
  }

  // ---------- blokkok ----------
  tervezetCimke(szoveg: string): void {
    const meret = 9.4;
    const t = this.tisztit(szoveg);
    const w = this.szel(t, true, meret) + 16;
    const h = 20;
    this.hely(h + 10);
    this.lekerekitett(BAL, this.y, w, h, 6, SZIN.borostyanAlap);
    this.lap.drawText(t, { x: BAL + 8, y: this.y - 13.6, size: meret, font: this.felkover, color: SZIN.borostyan });
    this.y -= h + 14;
  }

  /** Egy blokk becsült magassága (pt) – a rövid szakaszok egyben tartásához. */
  magassag(b: Blokk): number {
    const sorok = (reszek: Szakasz[], meret: number, max: number) => this.tordel(this.futamok(reszek), meret, max).length;
    switch (b.tipus) {
      case 'tervezet': return 34;
      case 'h1': return H2.elotte + sorok(b.reszek, 16, SZELES) * 21 + H2.utana;
      case 'h2': return H2.elotte + sorok(b.reszek, H2.meret, SZELES) * H2.sor + H2.utana;
      case 'p': return sorok(b.reszek, TORZS.meret, SZELES) * TORZS.sor + BEKEZDES_UTAN;
      case 'li': return sorok(b.reszek, TORZS.meret, SZELES - LISTA_BEHUZAS) * TORZS.sor + LISTA_UTAN;
    }
  }

  /**
   * Címsor. `szakaszMagas`: a címsor és a hozzá tartozó blokkok együttes magassága; ha a szakasz rövid
   * (pl. aláírások, „Elfogadás”), egyben marad a következő lapon, nem szakad szét.
   */
  cimsor(reszek: Szakasz[], nagy: boolean, szakaszMagas?: number): void {
    const meret = nagy ? 16 : H2.meret;
    const sorkoz = nagy ? 21 : H2.sor;
    this.y -= H2.elotte;
    // a címsor ne maradjon egyedül a lap alján; a rövid szakasz egyben marad
    const rovid = szakaszMagas !== undefined && szakaszMagas <= ROVID_SZAKASZ;
    // (a címsor utáni térköz is számít: két sor törzsszöveg + tartalék férjen el alatta, különben egyedül maradna – 11-19)
    this.hely(rovid ? szakaszMagas - H2.elotte : sorkoz + H2.utana + TORZS.sor * 3);
    this.szoveg(this.futamok(reszek.map((r) => ({ ...r, bold: true }))), BAL, SZELES, meret, sorkoz, SZIN.tintakek);
    this.y -= H2.utana;
  }

  /** Kettőspontra végződő bevezető bekezdés („Amit nem teszünk:”) ne maradjon egyedül a lap alján: az első pontjával együtt marad. */
  egyuttMarad(magas: number): void {
    this.hely(magas);
  }

  bekezdes(reszek: Szakasz[]): void {
    const futamok = this.futamok(reszek);
    const sorok = this.tordel(futamok, TORZS.meret, SZELES).length;
    this.szoveg(futamok, BAL, SZELES, TORZS.meret, TORZS.sor, SZIN.tinta);
    // "Név: …", "Kelt: …" – egysoros adatmezők szorosabban (adatlap, okirat)
    const sima = reszek.map((r) => r.text).join('');
    this.y -= sorok === 1 && MEZO_SOR.test(sima) ? MEZO_UTAN : BEKEZDES_UTAN;
  }

  listaelem(b: Extract<Blokk, { tipus: 'li' }>): void {
    const x = BAL + LISTA_BEHUZAS;
    const jel = (alap: number) => {
      if (b.jel === 'pont') {
        this.lap.drawText('•', { x: BAL + 4, y: alap, size: TORZS.meret, font: this.normal, color: SZIN.halvany });
      } else if (b.jel === 'szam') {
        const s = `${b.szam ?? ''}.`;
        const w = this.szel(s, true, TORZS.meret);
        this.lap.drawText(s, { x: BAL + 11 - w, y: alap, size: TORZS.meret, font: this.felkover, color: SZIN.tintakek });
      } else {
        const m = 9;
        const y0 = alap - 1.2;
        this.lap.drawRectangle({ x: BAL + 1.5, y: y0, width: m, height: m, borderColor: SZIN.tintakek, borderWidth: 0.9, color: SZIN.feher });
        if (b.bejelolve) {
          // pipa (nyomtatvány-jel)
          this.lap.drawLine({ start: { x: BAL + 3.4, y: y0 + 4.6 }, end: { x: BAL + 5.5, y: y0 + 2.2 }, thickness: 1.4, color: SZIN.tintakek });
          this.lap.drawLine({ start: { x: BAL + 5.5, y: y0 + 2.2 }, end: { x: BAL + 9.4, y: y0 + 7.6 }, thickness: 1.4, color: SZIN.tintakek });
        }
      }
    };
    this.szoveg(this.futamok(b.reszek), x, SZELES - LISTA_BEHUZAS, TORZS.meret, TORZS.sor, SZIN.tinta, jel);
    this.y -= LISTA_UTAN;
  }

  elfogadasDoboz(e: Elfogadas, ujjlenyomat: string | undefined): void {
    const meret = 9.2;
    const sorkoz = 13.4;
    const sorok: [string, string][] = [
      ['Elfogadta', e.nev],
      ['Időpont', `${idopontHu(e.idopont)} (budapesti idő)`],
      ['Hogyan', e.csatorna ?? nevelokFeloldasa(`a(z) ${this.opc.marka} alkalmazásban, bejelentkezett fiókból, az elfogadó jelölővel`)],
      ['Dokumentum', `${this.opc.cim}, verzió: ${this.opc.verzio}`],
    ];
    if (ujjlenyomat) sorok.push(['Ujjlenyomat (SHA-256)', ujjlenyomat.replace(/(.{8})/g, '$1 ').trim()]);
    const cimkeSzel = 118;
    const ertekSzel = SZELES - 28 - cimkeSzel;
    const tordelt = sorok.map(([c, v]) => [c, this.tordel(this.futamok([{ text: v, bold: false }]), meret, ertekSzel)] as const);
    const magas = 38 + tordelt.reduce((a, [, s]) => a + s.length * sorkoz, 0) + 22;
    this.y -= 8;
    this.hely(magas);
    const teto = this.y;
    this.lap.drawRectangle({ x: BAL, y: teto - magas, width: SZELES, height: magas, color: SZIN.mezoAlap, borderColor: SZIN.keret, borderWidth: 0.8 });
    this.lap.drawText('Elektronikus elfogadás', { x: BAL + 14, y: teto - 22, size: 10.6, font: this.felkover, color: SZIN.tintakek });
    let y = teto - 40;
    for (const [c, s] of tordelt) {
      this.lap.drawText(this.tisztit(c), { x: BAL + 14, y, size: meret, font: this.normal, color: SZIN.halvany });
      for (const sor of s) {
        this.sorRajzol(sor, BAL + 14 + cimkeSzel, y, meret, SZIN.tinta);
        y -= sorkoz;
      }
    }
    this.lap.drawText(this.tisztit(nevelokFeloldasa(`Ez a PDF a(z) ${this.opc.marka} rendszerében készült másolat. Az ujjlenyomat a kitöltött szövegből számolt érték.`)), {
      x: BAL + 14, y: teto - magas + 12, size: 7.6, font: this.normal, color: SZIN.halvany,
    });
    this.y = teto - magas - 10;
  }

  lablecek(tervezet: boolean): void {
    const ossz = this.lapok.length;
    this.lapok.forEach((lap, i) => {
      lap.drawLine({ start: { x: BAL, y: LABLEC_Y + 14 }, end: { x: LAP_SZ - JOBB, y: LABLEC_Y + 14 }, thickness: 0.6, color: SZIN.hajszal });
      let x = BAL;
      if (tervezet) {
        const t = 'TERVEZET · ';
        lap.drawText(t, { x, y: LABLEC_Y, size: 7.8, font: this.felkover, color: SZIN.borostyan });
        x += this.szel(t, true, 7.8);
      }
      const bal = this.tisztit([this.opc.ceg, `${this.opc.cim} – verzió: ${this.opc.verzio}`, this.opc.lablecMegjegyzes].filter(Boolean).join(' · '));
      const jobb = `${i + 1} / ${ossz}`;
      const jobbSzel = this.szel(jobb, false, 7.8);
      const maxBal = SZELES - jobbSzel - 16 - (x - BAL);
      let balT = bal;
      while (this.szel(balT, false, 7.8) > maxBal && balT.length > 4) balT = `${balT.slice(0, -2)}…`;
      lap.drawText(balT, { x, y: LABLEC_Y, size: 7.8, font: this.normal, color: SZIN.halvany });
      lap.drawText(jobb, { x: LAP_SZ - JOBB - jobbSzel, y: LABLEC_Y, size: 7.8, font: this.normal, color: SZIN.halvany });
    });
  }

  private lekerekitett(x: number, yTeto: number, w: number, h: number, r: number, szin: RGB): void {
    // SVG-útvonal: a drawSvgPath origója a bal felső sarok, az y lefelé nő
    const p = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    this.lap.drawSvgPath(p, { x, y: yTeto, color: szin, borderWidth: 0 });
  }
}

/** A blokkokból PDF. Az első `#` címsor a fejlécsávba kerül (ha nincs, `opc.cim`). */
export async function markdownPdf(blokkok: Blokk[], opc: PdfOpciok): Promise<PdfEredmeny> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const normal = await doc.embedFont(opc.betuk.normal, { subset: true });
  const felkover = await doc.embedFont(opc.betuk.felkover, { subset: true });
  const textura = opc.textura ? await doc.embedPng(opc.textura) : undefined;

  const most = opc.most ?? new Date();
  doc.setTitle(`${opc.cim} – ${opc.marka}`, { showInWindowTitleBar: true });
  doc.setAuthor(opc.ceg);
  doc.setSubject(`${opc.cim}, verzió: ${opc.verzio}`);
  doc.setCreator(opc.marka);
  doc.setProducer(opc.marka);
  doc.setLanguage('hu-HU');
  doc.setCreationDate(most);
  doc.setModificationDate(most);

  const s = new Szedo(doc, normal, felkover, opc, textura);
  s.elsoOldal();

  let tervezet = false;
  let h1Volt = false;
  const szakaszMagas = (i: number): number => {
    let m = s.magassag(blokkok[i]!);
    for (let j = i + 1; j < blokkok.length; j++) {
      const b = blokkok[j]!;
      if (b.tipus === 'h1' || b.tipus === 'h2') break;
      m += s.magassag(b);
      if (m > ROVID_SZAKASZ) break;
    }
    return m;
  };
  for (const [i, b] of blokkok.entries()) {
    switch (b.tipus) {
      case 'tervezet':
        tervezet = true;
        s.tervezetCimke(b.szoveg);
        break;
      case 'h1':
        if (!h1Volt) { h1Volt = true; break; } // a sávban már szerepel
        s.cimsor(b.reszek, true, szakaszMagas(i));
        break;
      case 'h2': {
        // két egymást követő címsor („3. …” után „3.1. …”) ne szakadjon el: a második és az első két sora is férjen el
        const kov = blokkok[i + 1];
        if (kov?.tipus === 'h2') s.egyuttMarad(s.magassag(b) + s.magassag(kov) + TORZS.sor * 2);
        s.cimsor(b.reszek, false, szakaszMagas(i));
        break;
      }
      case 'p': {
        const kov = blokkok[i + 1];
        const sima = b.reszek.map((r) => r.text).join('').trimEnd();
        if (kov?.tipus === 'li' && sima.endsWith(':')) s.egyuttMarad(s.magassag(b) + s.magassag(kov));
        s.bekezdes(b.reszek);
        break;
      }
      case 'li':
        s.listaelem(b);
        break;
    }
  }
  if (opc.elfogadas) s.elfogadasDoboz(opc.elfogadas, opc.ujjlenyomat);
  s.lablecek(tervezet);

  const pdf = await doc.save({ useObjectStreams: true });
  return { pdf, oldalak: s.lapok.length, figyelmeztetesek: [...s.figyelmeztetesek] };
}
