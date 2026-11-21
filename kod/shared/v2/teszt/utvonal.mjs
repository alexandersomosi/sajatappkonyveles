// Teszt-segéd: SVG-útvonal (d) szintaktikai ellenőrzése és pontos befoglaló doboza – böngésző nélkül.
// Kezeli: M L H V C S Q T A Z (abszolút és relatív), az ív-jelzőket tömörített alakban is („a1 1 0 011 1”).
// A Bézier-szakaszok szélsőértékét zárt alakban számolja (mint a Chrome getBBox()), az ívet sűrűn mintavételezi.

const ARG = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Tokenekre bontás; hibás karakternél / rossz argumentumszámnál kivételt dob. */
export function elemez(d) {
  const parancsok = [];
  let i = 0;
  const n = d.length;
  const ures = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
  const szam = () => {
    ures();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i));
    if (!m) throw new Error(`Szám kellene a(z) ${i}. karakternél: „${d.slice(i, i + 12)}”`);
    i += m[0].length;
    return Number(m[0]);
  };
  const jelzo = () => {
    ures();
    if (d[i] !== '0' && d[i] !== '1') throw new Error(`Ív-jelző (0/1) kellene a(z) ${i}. karakternél`);
    return Number(d[i++]);
  };
  ures();
  while (i < n) {
    const c = d[i];
    if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(c)) throw new Error(`Ismeretlen parancs: „${c}” (${i}. karakter)`);
    if (parancsok.length === 0 && c !== 'M' && c !== 'm') throw new Error('Az útvonal nem M/m-mel kezdődik');
    i++;
    const k = ARG[c.toUpperCase()];
    if (k === 0) { parancsok.push({ c, a: [] }); ures(); continue; }
    let elso = true;
    for (;;) {
      ures();
      if (i >= n || /[A-Za-z]/.test(d[i])) {
        if (elso) throw new Error(`Hiányzó argumentum: ${c}`);
        break;
      }
      const a = [];
      for (let j = 0; j < k; j++) a.push(c.toUpperCase() === 'A' && (j === 3 || j === 4) ? jelzo() : szam());
      // M után a további párok implicit L-ek
      const cc = !elso && (c === 'M' || c === 'm') ? (c === 'M' ? 'L' : 'l') : c;
      parancsok.push({ c: cc, a });
      elso = false;
    }
  }
  return parancsok;
}

function kobosSzelso(p0, p1, p2, p3) {
  // B'(t) ∝ a t² + b t + c
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
  const t = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) t.push(-c / b); }
  else {
    const D = b * b - 4 * a * c;
    if (D >= 0) { const s = Math.sqrt(D); t.push((-b + s) / (2 * a), (-b - s) / (2 * a)); }
  }
  return t.filter((x) => x > 0 && x < 1);
}
const kobos = (p0, p1, p2, p3, t) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
const negyzetes = (p0, p1, p2, t) => (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2;

/** Ív pontjai (SVG 1.1 F.6.5: végpont → középpont alak), mintavételezve. */
function ivPontok(x1, y1, rx, ry, fi, fa, fs, x2, y2, db = 360) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const f = (fi * Math.PI) / 180, cf = Math.cos(f), sf = Math.sin(f);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cf * dx + sf * dy, y1p = -sf * dx + cf * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sz = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const ne = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let k = Math.sqrt(Math.max(0, sz / ne));
  if (fa === fs) k = -k;
  const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx;
  const cx = cf * cxp - sf * cyp + (x1 + x2) / 2, cy = sf * cxp + cf * cyp + (y1 + y2) / 2;
  const szog = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = szog(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = szog((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const p = [];
  for (let j = 0; j <= db; j++) {
    const t = t1 + (dt * j) / db;
    p.push([cx + rx * Math.cos(t) * cf - ry * Math.sin(t) * sf, cy + rx * Math.cos(t) * sf + ry * Math.sin(t) * cf]);
  }
  return p;
}

/** Az útvonal geometriai befoglaló doboza: [x, y, szélesség, magasság]. */
export function befoglalo(d) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pont = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  let x = 0, y = 0, sx = 0, sy = 0, elozoC = null, elozoQ = null;
  for (const { c, a } of elemez(d)) {
    const rel = c === c.toLowerCase();
    const C = c.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    let ujC = null, ujQ = null;
    if (C === 'M') { x = ox + a[0]; y = oy + a[1]; sx = x; sy = y; pont(x, y); }
    else if (C === 'L') { x = ox + a[0]; y = oy + a[1]; pont(x, y); }
    else if (C === 'H') { x = ox + a[0]; pont(x, y); }
    else if (C === 'V') { y = oy + a[0]; pont(x, y); }
    else if (C === 'Z') { x = sx; y = sy; }
    else if (C === 'C' || C === 'S') {
      let x1, y1, x2, y2, ex, ey;
      if (C === 'C') { [x1, y1, x2, y2, ex, ey] = [ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5]]; }
      else {
        [x1, y1] = elozoC ? [2 * x - elozoC[0], 2 * y - elozoC[1]] : [x, y];
        [x2, y2, ex, ey] = [ox + a[0], oy + a[1], ox + a[2], oy + a[3]];
      }
      pont(ex, ey);
      for (const t of kobosSzelso(x, x1, x2, ex)) pont(kobos(x, x1, x2, ex, t), kobos(y, y1, y2, ey, t));
      for (const t of kobosSzelso(y, y1, y2, ey)) pont(kobos(x, x1, x2, ex, t), kobos(y, y1, y2, ey, t));
      ujC = [x2, y2];
      x = ex; y = ey;
    } else if (C === 'Q' || C === 'T') {
      let x1, y1, ex, ey;
      if (C === 'Q') { [x1, y1, ex, ey] = [ox + a[0], oy + a[1], ox + a[2], oy + a[3]]; }
      else { [x1, y1] = elozoQ ? [2 * x - elozoQ[0], 2 * y - elozoQ[1]] : [x, y]; [ex, ey] = [ox + a[0], oy + a[1]]; }
      pont(ex, ey);
      for (const [p0, p1, p2] of [[x, x1, ex], [y, y1, ey]]) {
        const nev = p0 - 2 * p1 + p2;
        if (Math.abs(nev) > 1e-12) { const t = (p0 - p1) / nev; if (t > 0 && t < 1) pont(negyzetes(x, x1, ex, t), negyzetes(y, y1, ey, t)); }
      }
      ujQ = [x1, y1];
      x = ex; y = ey;
    } else if (C === 'A') {
      const ex = ox + a[5], ey = oy + a[6];
      for (const [px, py] of ivPontok(x, y, a[0], a[1], a[2], a[3], a[4], ex, ey)) pont(px, py);
      x = ex; y = ey;
    }
    elozoC = ujC; elozoQ = ujQ;
  }
  return [minX, minY, maxX - minX, maxY - minY];
}

/** Egy IkonAdat (p/r elemek) befoglaló doboza. */
export function ikonBefoglalo(adat) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of adat.elemek) {
    const [x, y, w, h] = e.t === 'p' ? befoglalo(e.d) : [e.x, e.y, e.w, e.h];
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  }
  return [minX, minY, maxX - minX, maxY - minY];
}

/** A rajz közepének eltérése a viewBox közepétől: { dx, dy }. */
export function kozepElteres(adat) {
  const [x, y, w, h] = ikonBefoglalo(adat);
  const [vx, vy, vw, vh] = adat.vb.split(/[\s,]+/).map(Number);
  return { dx: x + w / 2 - (vx + vw / 2), dy: y + h / 2 - (vy + vh / 2) };
}
