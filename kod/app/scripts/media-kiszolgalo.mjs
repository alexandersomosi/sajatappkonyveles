// /media/ kiszolgálása a helyi próbákhoz (SPEC §26.7.1, mint a Caddy élesben): a kod/media mappa, pontos típusok,
// Range-kérés (206), no-cache, hiányzó fájlra sima 404 (soha nem index.html).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const TIPUS = {
  '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
};

/** true, ha kiszolgálta (vagy 404-et adott) a /media/ alatti kérést. */
export async function mediaKiszolgal(req, res, mediaGyoker) {
  const ut = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!ut.startsWith('/media/')) return false;
  const gyoker = resolve(mediaGyoker);
  const fajl = normalize(join(gyoker, ut.slice('/media/'.length)));
  if (!fajl.startsWith(gyoker) || fajl.includes(`${gyoker}\_regi`) || fajl.includes(`${gyoker}/_regi`)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('nincs ilyen');
    return true;
  }
  let s;
  try {
    s = await stat(fajl);
    if (!s.isFile()) throw new Error('nem fájl');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('nincs ilyen');
    return true;
  }
  const fej = { 'Content-Type': TIPUS[extname(fajl).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
  const tart = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (tart) {
    const eleje = tart[1] ? Number(tart[1]) : Math.max(0, s.size - Number(tart[2]));
    const vege = tart[1] && tart[2] ? Math.min(Number(tart[2]), s.size - 1) : s.size - 1;
    if (eleje > vege || eleje >= s.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${s.size}` }).end();
      return true;
    }
    res.writeHead(206, { ...fej, 'Content-Range': `bytes ${eleje}-${vege}/${s.size}`, 'Content-Length': vege - eleje + 1 });
    if (req.method === 'HEAD') return void res.end(), true;
    createReadStream(fajl, { start: eleje, end: vege }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...fej, 'Content-Length': s.size });
  if (req.method === 'HEAD') return void res.end(), true;
  createReadStream(fajl).pipe(res);
  return true;
}
