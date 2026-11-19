// Fájlok: képek előkészítése (JPEG, legfeljebb 2400 px a hosszabb oldalon; az újrakódolás az EXIF-et – a helyadatot is –
// eldobja, SPEC §10.3, §12.7), feltöltés folyamatjelzéssel, letöltés/megnyitás aláírt, 5 perces linkkel (SPEC §12.4).
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { abszolutUrl, feltolt, hozzaferesFejlec, nyers, post } from '../api/http';
import { API_URL, MINTA_MOD } from '../config';

export interface HelyiFajl {
  uri: string;
  nev: string;
  mime: string;
  meret?: number | null;
  webFajl?: Blob; // weben a választott fájl maga
}

export const MAX_MERET = 25 * 1024 * 1024;
export const ENGEDETT = /^(image\/(jpeg|png|heic|heif)|application\/pdf)$/i;

/** Kép → JPEG (≤ 2400 px, 85%), EXIF nélkül. PDF változatlan. */
export async function elokeszit(f: HelyiFajl): Promise<HelyiFajl> {
  if (!f.mime.startsWith('image/')) return f;
  // Weben vásznon (canvas) kódoljuk újra, és a Blobot közvetlenül adjuk tovább: a blob: címet a CSP
  // (connect-src) miatt nem kérhetjük le fetch-csel, és nem is kell.
  if (Platform.OS === 'web') return webKep(f);
  try {
    const ctx = ImageManipulator.ImageManipulator.manipulate(f.uri);
    const kep0 = await ctx.renderAsync();
    const hosszabb = Math.max(kep0.width, kep0.height);
    let kep = kep0;
    if (hosszabb > 2400) {
      const ctx2 = ImageManipulator.ImageManipulator.manipulate(f.uri);
      ctx2.resize(kep0.width >= kep0.height ? { width: 2400 } : { height: 2400 });
      kep = await ctx2.renderAsync();
    }
    const r = await kep.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 });
    return { uri: r.uri, nev: jpgNev(f.nev), mime: 'image/jpeg' };
  } catch {
    if (/heic|heif/i.test(f.mime)) throw new Error(HEIC_HIBA);
    return f;
  }
}

const HEIC_HIBA = 'Ezt a képformátumot (HEIC) nem tudtuk átalakítani. Fotózd le újra, vagy küldd JPEG-ként.';
const jpgNev = (nev: string) => nev.replace(/\.(png|heic|heif|jpe?g|webp)$/i, '') + '.jpg';

/** Weben: kép betöltése (a választott Blobból, vagy <img>-gel a blob:/data: címről – ezt az img-src engedi). */
async function webForras(f: HelyiFajl): Promise<{ kep: CanvasImageSource; w: number; h: number; lezar?: () => void }> {
  if (f.webFajl && typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(f.webFajl, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { kep: b, w: b.width, h: b.height, lezar: () => b.close() };
    } catch {
      /* pl. régi böngésző – jön az <img> */
    }
  }
  const forrasUrl = f.webFajl ? URL.createObjectURL(f.webFajl) : f.uri;
  try {
    const img = await new Promise<HTMLImageElement>((ok, hiba) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => hiba(new Error('kep'));
      i.src = forrasUrl;
    });
    return { kep: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    if (f.webFajl) setTimeout(() => URL.revokeObjectURL(forrasUrl), 0);
  }
}

async function webKep(f: HelyiFajl): Promise<HelyiFajl> {
  let forras: Awaited<ReturnType<typeof webForras>>;
  try {
    forras = await webForras(f);
  } catch {
    if (/heic|heif/i.test(f.mime)) throw new Error(HEIC_HIBA);
    // Nem tudtuk megnyitni: ha megvan a fájl maga, változatlanul küldjük (a szerver ellenőrzi).
    if (f.webFajl) return f;
    throw new Error('Ezt a képet nem tudtuk megnyitni. Válaszd ki újra, vagy küldd PDF-ként.');
  }
  try {
    const arany = Math.min(1, 2400 / Math.max(forras.w, forras.h, 1));
    const w = Math.max(1, Math.round(forras.w * arany));
    const h = Math.max(1, Math.round(forras.h * arany));
    const vaszon = document.createElement('canvas');
    vaszon.width = w;
    vaszon.height = h;
    const c = vaszon.getContext('2d');
    if (!c) throw new Error('canvas');
    c.fillStyle = '#ffffff'; // átlátszó PNG → fehér háttér a JPEG-ben
    c.fillRect(0, 0, w, h);
    c.drawImage(forras.kep, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => vaszon.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) throw new Error('toBlob');
    return { uri: f.uri, nev: jpgNev(f.nev), mime: 'image/jpeg', meret: blob.size, webFajl: blob };
  } catch {
    if (f.webFajl) return f;
    throw new Error('Ezt a képet nem tudtuk előkészíteni. Válaszd ki újra, vagy küldd PDF-ként.');
  } finally {
    forras.lezar?.();
  }
}

/** FormData-mező egy fájlból (natívan {uri,name,type}, weben Blob). */
export async function hozzaad(form: FormData, mezo: string, f: HelyiFajl) {
  const nev = f.nev.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
  if (Platform.OS === 'web') {
    let blob = f.webFajl;
    if (!blob) {
      // Csak data: címet olvasunk be (CSP: connect-src nem engedi a blob:-ot, és nem is kell).
      const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(f.uri);
      if (!m) throw new Error('Ezt a fájlt nem tudtuk beolvasni. Válaszd ki újra.');
      const adat = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
      const tomb = new Uint8Array(adat.length);
      for (let i = 0; i < adat.length; i++) tomb[i] = adat.charCodeAt(i);
      blob = new Blob([tomb], { type: m[1] || f.mime });
    }
    form.append(mezo, blob, nev);
  } else {
    form.append(mezo, { uri: f.uri, name: nev, type: f.mime } as unknown as Blob);
  }
}

export async function iratFeltolt(p: {
  lapok?: HelyiFajl[];
  fajl?: HelyiFajl;
  kategoria: string;
  honap: string;
  cim?: string;
  megjegyzes?: string;
  keresId?: string;
  ujVerzioId?: string;
  folyamat?: (a: number) => void;
}) {
  const form = new FormData();
  if (p.lapok?.length) {
    for (const l of p.lapok) await hozzaad(form, 'pages[]', await elokeszit(l));
  } else if (p.fajl) {
    await hozzaad(form, 'file', await elokeszit(p.fajl));
  }
  form.append('category', p.kategoria);
  form.append('dossierMonth', p.honap);
  if (p.cim) form.append('title', p.cim.slice(0, 120));
  if (p.megjegyzes) form.append('note', p.megjegyzes.slice(0, 1000));
  if (p.keresId) form.append('requestId', p.keresId);
  const ut = p.ujVerzioId ? `/client/documents/${p.ujVerzioId}/versions` : '/client/documents';
  return feltolt<{ id: string }>(ut, form, p.folyamat);
}

export async function csatolmanyFeltolt(f: HelyiFajl, folyamat?: (a: number) => void) {
  const form = new FormData();
  await hozzaad(form, 'file', await elokeszit(f));
  return feltolt<{ fileId: string }>('/client/attachments', form, folyamat);
}

/** Aláírt, rövid életű link egy fájlhoz (képekhez, letöltéshez). MINTA módban „minta:<id>”. */
export async function fajlLink(fileId: string): Promise<string> {
  const r = await post<{ url: string; expiresAt: string }>(`/files/${encodeURIComponent(fileId)}/link`, {});
  return abszolutUrl(r.url);
}

/** Megnyitás/megosztás: weben új lapon, natívan letöltés a gyorsítótárba és a rendszer megosztó lapja. */
export async function fajlMegnyit(fileId: string, nev = 'irat.pdf'): Promise<void> {
  if (MINTA_MOD) throw new Error('Minta módban nincs valódi fájl. Az éles appban itt nyílik meg az irat.');
  const url = await fajlLink(fileId);
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const mappa = new Directory(Paths.cache, 'iratok');
  if (!mappa.exists) mappa.create({ intermediates: true });
  const cel = new File(mappa, nev.replace(/[\\/:*?"<>|]/g, '_'));
  if (cel.exists) cel.delete();
  const f = await File.downloadFileAsync(url, cel);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { dialogTitle: nev });
}

/** Hitelesített GET-tel érkező fájl (pl. előre kitöltött szerződés PDF, .ics) megnyitása. */
export async function letoltMegnyit(ut: string, nev: string, mime: string): Promise<void> {
  if (MINTA_MOD) throw new Error('Minta módban nincs valódi fájl. Az éles appban itt töltődik le.');
  if (Platform.OS === 'web') {
    const v = await nyers('GET', ut);
    const blob = await v.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = nev;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
    return;
  }
  const mappa = new Directory(Paths.cache, 'iratok');
  if (!mappa.exists) mappa.create({ intermediates: true });
  const cel = new File(mappa, nev);
  if (cel.exists) cel.delete();
  const f = await File.downloadFileAsync(API_URL + ut, cel, { headers: await hozzaferesFejlec() });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: nev });
}
