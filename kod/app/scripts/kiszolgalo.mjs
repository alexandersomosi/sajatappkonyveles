#!/usr/bin/env node
// Kis statikus kiszolgáló a webes exporthoz (SPA: ismeretlen útvonal → index.html). Csak helyi próbához.
// node scripts/kiszolgalo.mjs <mappa> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { mediaKiszolgal } from './media-kiszolgalo.mjs';

const gyoker = resolve(process.argv[2] || 'dist-minta');
const port = Number(process.argv[3] || 8790);
const tipus = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

createServer(async (req, res) => {
  // SPEC §26.7.1: /media/ a kod/media mappából (videók, útmutató-képek).
  if (await mediaKiszolgal(req, res, process.env.MEDIA_DIR || resolve(gyoker, '../../media'))) return;
  const ut = decodeURIComponent((req.url || '/').split('?')[0]);
  let fajl = normalize(join(gyoker, ut));
  if (!fajl.startsWith(gyoker)) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(fajl);
    if (s.isDirectory()) fajl = join(fajl, 'index.html');
  } catch {
    fajl = extname(ut) ? fajl : join(gyoker, 'index.html');
  }
  try {
    const adat = await readFile(fajl);
    res.writeHead(200, { 'Content-Type': tipus[extname(fajl)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(adat);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('nincs ilyen');
  }
}).listen(port, '127.0.0.1', () => console.log(`kiszolgáló: http://127.0.0.1:${port} (${gyoker})`));
