#!/usr/bin/env node
// SPEC §26.7.2: writes kod/media/videok.json (VideoManifest) from the three videos with ffprobe/ffmpeg.
// Run before every `feltolt.sh --media`:   node C:/Users/UpgradePC/konyvelo_app/kod/deploy/videok-json.mjs
// hasNarration (§24 integrator 11-18): false while the file is the silent captioned interim (max volume below -60 dB),
// so the app does not promise sound ("Felirattal." instead of "Felirattal, hanggal."). Re-run after the narrated
// versions replace the files – nothing else changes.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const media = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'media');
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
const items = [];
for (const name of ['bekotes', 'vallalkozas_bejelentes', 'meghatalmazas']) {
  const f = join(media, `${name}.mp4`);
  if (!existsSync(f)) {
    console.log(`nincs: ${name}.mp4`);
    continue;
  }
  const durationSec = Math.round(Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).stdout.trim()) * 10) / 10;
  const vd = run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(vd.stderr ?? '');
  const max = m ? Number(m[1]) : -91;
  const st = statSync(f);
  items.push({ name, durationSec, sizeBytes: st.size, updatedAt: st.mtime.toISOString(), hasNarration: max > -60 });
  console.log(`${name}: ${durationSec} s, ${(st.size / 1048576).toFixed(1)} MB, hang: ${max > -60 ? 'van' : `nincs (max ${max} dB)`}`);
}
writeFileSync(join(media, 'videok.json'), `${JSON.stringify({ items }, null, 2)}\n`);
console.log(`-> ${join(media, 'videok.json')}`);
