// Teszt-segéd: a v2 komponensek (rn/*.tsx, web/*.tsx) lefordítása és betöltése Node-ban, hogy a teszt kirajzolhassa őket.
// TypeScript: a kod/panel/node_modules/typescript (csak olvasva). React: a kod/panel/node_modules/react (csak olvasva).
// A react-native és a react-native-svg helyén egyszerű csonk áll (a komponensek elemfáját nézzük, nem a natív képet).
// A lefordított fájlok egy ideiglenes mappába kerülnek: V2_TESZT_TMP (ha meg van adva), különben az os.tmpdir().
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PANEL = resolve(V2, '../../panel');
const req = createRequire(join(PANEL, 'package.json'));

export function vanPanelModul() {
  return existsSync(join(PANEL, 'node_modules/typescript')) && existsSync(join(PANEL, 'node_modules/react')) && existsSync(join(PANEL, 'node_modules/react-dom'));
}

const csonk = (forras) => `data:text/javascript,${encodeURIComponent(forras).replace(/'/g, '%27')}`;
const CSONK = {
  'react-native': csonk("export const View = 'View'; export const Image = 'Image';"),
  'react-native-svg': csonk("export default 'Svg'; export const Path = 'Path'; export const Rect = 'Rect';"),
};

/** A megadott forrásfájlokat (V2-höz képest) lefordítja, és visszaadja a kimeneti mappát. */
export function fordit(fajlok) {
  const ts = req('typescript');
  const alap = process.env.V2_TESZT_TMP ? resolve(process.env.V2_TESZT_TMP) : tmpdir();
  mkdirSync(alap, { recursive: true });
  const ki = mkdtempSync(join(alap, 'v2-forditas-'));
  const reactUrl = (s) => pathToFileURL(req.resolve(s)).href;
  for (const rel of fajlok) {
    const forras = join(V2, rel);
    const kod = ts.transpileModule(readFileSync(forras, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true },
      fileName: rel,
    }).outputText;
    const atirt = kod.replace(/(\bfrom\s+|\bimport\s+)(['"])([^'"]+)\2/g, (m, elo, q, spec) => {
      let uj;
      if (spec.startsWith('.')) {
        if (spec.endsWith('.png')) uj = csonk(`export default ${JSON.stringify(spec)};`);
        else {
          const abs = resolve(dirname(forras), spec);
          const talalt = ['.ts', '.tsx', '/index.ts'].map((k) => abs + k).find((f) => existsSync(f));
          if (!talalt) throw new Error(`Nem oldható fel: ${spec} (${rel})`);
          const r = relative(dirname(forras), talalt).replace(/\\/g, '/').replace(/\.tsx?$/, '.js');
          uj = r.startsWith('..') ? r : `./${r}`;
        }
      } else if (CSONK[spec]) uj = CSONK[spec];
      else if (spec === 'react' || spec.startsWith('react/')) uj = reactUrl(spec);
      else throw new Error(`Váratlan import: ${spec} (${rel})`);
      return `${elo}${q}${uj}${q}`;
    });
    const cel = join(ki, rel.replace(/\.tsx?$/, '.js'));
    mkdirSync(dirname(cel), { recursive: true });
    writeFileSync(cel, atirt);
  }
  return ki;
}

/** Betölt egy lefordított modult. */
export async function betolt(ki, rel) {
  return import(pathToFileURL(join(ki, rel.replace(/\.tsx?$/, '.js'))).href);
}

export function reactDomServer() {
  return req('react-dom/server');
}

/** RN-elemfa „kibontása” natív renderer nélkül: a függvény- és memo-komponenseket meghívja (a v2 komponensek
 *  nem használnak hookot), a csonk-elemeket (View, Svg, Path, Rect) megtartja. Kimenet: { tipus, props, gyerekek }. */
export function kibont(elem) {
  if (elem == null || typeof elem === 'boolean') return null;
  if (Array.isArray(elem)) return elem.map(kibont).filter(Boolean);
  if (typeof elem !== 'object') return elem;
  let { type, props } = elem;
  if (type && typeof type === 'object' && type.$$typeof && type.type) type = type.type; // memo
  if (typeof type === 'function') return kibont(type(props));
  const { children, ...tobbi } = props ?? {};
  const gy = children === undefined ? [] : [].concat(kibont(children) ?? []).flat();
  return { tipus: type, props: tobbi, gyerekek: gy };
}
