// The public copies of stilus.css and mozgas.js carry no comments (2026-11-21, before going live: the design's comments
// held working notes – dates, quotes of the owner's feedback, internal paths – and they are served at https://adozz.hu/).
// Only comments go: strings, url(...) and regex literals are kept byte for byte. A comment glued to code on BOTH sides
// (e.g. `a/**/b`) is refused instead of guessed (removing it could join two tokens). Whitespace-only lines are dropped.
// meres.test.mjs checks with acorn (kod/app) that the JS token stream is unchanged.

function sorokTisztan(s) {
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .filter((l) => l.trim() !== '')
    .join('\n') + '\n';
}

function ragadtE(ki, src, j) {
  const elotte = ki.length ? ki[ki.length - 1] : '\n';
  const utana = j < src.length ? src[j] : '\n';
  return !/\s/.test(elotte) && !/\s/.test(utana);
}

/** CSS: removes every comment outside strings. */
export function cssMegjegyzesNelkul(src) {
  src = src.split('\r\n').join('\n');
  let ki = '';
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        if (src[j] === '\n') throw new Error(`stilus.css: lezáratlan szöveg (${i}. karakter)`);
        j++;
      }
      ki += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && src[i + 1] === '*') {
      const v = src.indexOf('*/', i + 2);
      if (v < 0) throw new Error('stilus.css: lezáratlan megjegyzés');
      if (ragadtE(ki, src, v + 2)) throw new Error(`stilus.css: kódhoz tapadó megjegyzés (${i}. karakter) – tegyél köré szóközt`);
      i = v + 2;
    } else {
      ki += c;
      i++;
    }
  }
  return sorokTisztan(ki);
}

const REGEX_ELOTT = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_SZO_ELOTT = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);

/** JavaScript (ES5-style source, no template literals): removes // and block comments outside strings and regex literals. */
export function jsMegjegyzesNelkul(src) {
  src = src.split('\r\n').join('\n');
  let ki = '';
  const elozo = () => {
    const m = ki.match(/(\S)\s*$/);
    if (!m) return '';
    if (/[A-Za-z0-9_$]/.test(m[1])) {
      const w = ki.match(/([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
      return w && REGEX_SZO_ELOTT.has(w[1]) ? '' : 'szo';
    }
    return m[1];
  };
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    if (c === '`') throw new Error('mozgas.js: sablon-szöveget (`) ez a megjegyzés-szűrő nem kezel');
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        if (src[j] === '\n') throw new Error(`mozgas.js: lezáratlan szöveg (${i}. karakter)`);
        j++;
      }
      ki += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && src[i + 1] === '*') {
      const v = src.indexOf('*/', i + 2);
      if (v < 0) throw new Error('mozgas.js: lezáratlan megjegyzés');
      const tobbsoros = src.slice(i, v).includes('\n');
      if (!tobbsoros && ragadtE(ki, src, v + 2)) throw new Error(`mozgas.js: kódhoz tapadó megjegyzés (${i}. karakter)`);
      ki += tobbsoros ? '\n' : '';
      i = v + 2;
    } else if (c === '/' && src[i + 1] === '/') {
      const v = src.indexOf('\n', i);
      i = v < 0 ? src.length : v;
    } else if (c === '/' && REGEX_ELOTT.has(elozo())) {
      // regex literal: up to the closing / outside a [...] class, then the flags
      let j = i + 1, osztaly = false;
      while (j < src.length && (osztaly || src[j] !== '/')) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') osztaly = true;
        else if (src[j] === ']') osztaly = false;
        if (src[j] === '\n') throw new Error(`mozgas.js: lezáratlan regex (${i}. karakter)`);
        j++;
      }
      j++;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      ki += src.slice(i, j);
      i = j;
    } else {
      ki += c;
      i++;
    }
  }
  return sorokTisztan(ki);
}
