#!/usr/bin/env bash
# Run on the owner's PC (Git Bash). Packs what the server needs and unpacks it under /srv/kezjegy on appok-1.
#   bash C:/Users/UpgradePC/konyvelo_app/kod/deploy/feltolt.sh [--web-only | --no-web | --media]
# --no-web: only the API build context, deploy/ and caddy/ (the web builds on the server stay as they are).
# Before: kod/app `npm run export:web` (→ app/dist) and kod/panel `npm run build` (→ panel/dist).
# Sends: src/ (build context for the API image: shared, ado-motor, nav-kliens, backend, jogi – without
# node_modules/dist), deploy/ (+ deploy/proxy/), caddy/kezjegy.caddy, web/app, web/panel, web/landing. No secrets are in any of these.
# On the server every replaced folder is first moved to /srv/kezjegy/_regi/<name>_<time> (nothing is deleted).
# Then run on the server: bash /srv/kezjegy/deploy/up.sh   (see README.md for the first deploy).
set -euo pipefail
KOD=/c/Users/UpgradePC/konyvelo_app/kod

# --media (SPEC §26.7.1): copies kod/media/ (videos, posters, captions, utmutato/<kind>/ images + kepek.json) to
# /srv/kezjegy/web/media/. Rsync-like: only new or changed files are written; a replaced file first goes to
# /srv/kezjegy/_regi/media_<time>/; files that exist only on the server stay. The web container sees it at once.
if [ "${1:-}" = "--media" ]; then
  [ -d "$KOD/media" ] || { echo "kod/media missing"; exit 1; }
  MSTAGE=$(mktemp -d)
  tar -C "$KOD" -czf "$MSTAGE/media.tar.gz" --exclude='_regi' --exclude='*.log' media
  echo "media package: $(du -h "$MSTAGE/media.tar.gz" | cut -f1)"
  scp -q "$MSTAGE/media.tar.gz" appok-1:/tmp/kezjegy_media.tar.gz
  ssh appok-1 'bash -s' <<'REMOTE_MEDIA'
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
cd /srv/kezjegy
mkdir -p _regi web/media
U=$(mktemp -d /srv/kezjegy/.media_XXXX)
tar -C "$U" -xzf /tmp/kezjegy_media.tar.gz
mv /tmp/kezjegy_media.tar.gz "_regi/media_feltoltes_$TS.tar.gz"
uj=0; csere=0
while IFS= read -r -d '' f; do
  rel=${f#"$U/media/"}
  dst="web/media/$rel"
  if [ -f "$dst" ]; then
    cmp -s "$f" "$dst" && continue
    mkdir -p "_regi/media_$TS/$(dirname "$rel")"
    mv "$dst" "_regi/media_$TS/$rel"
    csere=$((csere + 1))
  else
    uj=$((uj + 1))
  fi
  mkdir -p "$(dirname "$dst")"
  cp -p "$f" "$dst"
  chmod 644 "$dst"
done < <(find "$U/media" -type f -print0)
find web/media -type d -exec chmod 755 {} +
mkdir -p "_regi/media_feltoltes_$TS.kicsomagolva" && mv "$U" "_regi/media_feltoltes_$TS.kicsomagolva/"
echo "media: $uj új, $csere cserélt fájl (a régiek: /srv/kezjegy/_regi/media_$TS/)"
REMOTE_MEDIA
  exit 0
fi

WEB_ONLY=0; [ "${1:-}" = "--web-only" ] && WEB_ONLY=1
NO_WEB=0; [ "${1:-}" = "--no-web" ] && NO_WEB=1
if [ "$NO_WEB" = 0 ]; then
  [ -s "$KOD/app/dist/index.html" ] || { echo "app/dist missing: cd kod/app && npm run export:web"; exit 1; }
  [ -s "$KOD/panel/dist/index.html" ] || { echo "panel/dist missing: cd kod/panel && npm run build"; exit 1; }
  # never ship the MINTA (mock) builds
  if grep -rqs "MINTA_SZERVER\|mock_role" "$KOD/app/dist" "$KOD/panel/dist"; then echo "mock code found in dist - stopping"; exit 1; fi
  # SPEC §31 / K8 lesson 11-20: the landing folder is replaced as a whole – it must bring its script and the e-mail logos
  if [ -s "$KOD/landing/dist/index.html" ]; then
    for f in js/meres.js email/logo_feher@2x.png email/logo_alairas@2x.png; do
      [ -s "$KOD/landing/dist/$f" ] || { echo "landing/dist/$f missing: node kod/landing/build.mjs"; exit 1; }
    done
  fi
fi

STAGE=$(mktemp -d)
mkdir -p "$STAGE/kezjegy/web"
if [ "$WEB_ONLY" = 0 ]; then
  # src/ and caddy/ only in a full upload: an empty src/ would replace the server's build context (kör 2 fix)
  # k7c: no caddy/ any more – since 11-20 the public proxy is kezjegy-proxy (/srv/kezjegy/proxy, deploy/proxy/); the old
  # shared Caddy and its import folder /srv/kezjegy/caddy were cleaned up (takarit), a full upload must not bring it back
  mkdir -p "$STAGE/kezjegy/src"
  tar -C "$KOD" -cf - \
    --exclude='node_modules' --exclude='dist' --exclude='_regi' --exclude='_kepek' --exclude='pdf_minta' \
    --exclude='.test-*' --exclude='*.log' \
    shared ado-motor nav-kliens backend jogi | tar -C "$STAGE/kezjegy/src" -xf -
  mkdir -p "$STAGE/kezjegy/deploy"
  cp "$KOD"/deploy/*.sh "$KOD"/deploy/*.yml "$KOD"/deploy/web.Caddyfile "$KOD"/deploy/env.example "$KOD"/deploy/README.md "$STAGE/kezjegy/deploy/"
  # SPEC §29.3: the Adózz proxy (atallas.sh copies it to /srv/kezjegy/proxy) and the public-URL example
  cp "$KOD"/deploy/nyilvanos.env.example "$STAGE/kezjegy/deploy/"
  tar -C "$KOD/deploy" -cf - --exclude='_regi' proxy | tar -C "$STAGE/kezjegy/deploy" -xf -
fi
if [ "$NO_WEB" = 0 ]; then
  cp -r "$KOD/app/dist" "$STAGE/kezjegy/web/app"
  cp -r "$KOD/panel/dist" "$STAGE/kezjegy/web/panel"
  # SPEC §29.3.6: the adozz.hu landing page (kod/landing/dist when built, else the folder's own index.html)
  if [ -s "$KOD/landing/dist/index.html" ]; then cp -r "$KOD/landing/dist" "$STAGE/kezjegy/web/landing"; fi
  # Each build lists its own hashed files: the next deploy keeps exactly these for one more release, so a tab
  # opened before the deploy can still load its lazy chunks (QA kör 3; web.Caddyfile answers 404, not index.html).
  for w in app panel; do
    (cd "$STAGE/kezjegy/web/$w" && find . -type f \( -path './_expo/static/*' -o -path './assets/*' \) | sed 's#^\./##' > .sajat_fajlok.txt)
  done
fi
# Unix line endings for everything the server executes
find "$STAGE/kezjegy" -maxdepth 5 \( -name '*.sh' -o -name '*.yml' -o -name '*.caddy' -o -name '*Caddyfile' \) -exec sed -i 's/\r$//' {} +

PKG="$STAGE/kezjegy.tar.gz"
tar -C "$STAGE" -czf "$PKG" kezjegy
echo "package: $(du -h "$PKG" | cut -f1)"
scp -q "$PKG" appok-1:/tmp/kezjegy_feltolt.tar.gz
ssh appok-1 'bash -s' <<'REMOTE'
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
if [ ! -d /srv/kezjegy ]; then sudo -n install -d -o deploy -g deploy -m 755 /srv/kezjegy; fi
cd /srv/kezjegy
mkdir -p _regi web web/media
U=$(mktemp -d /srv/kezjegy/.feltolt_XXXX)
tar -C "$U" -xzf /tmp/kezjegy_feltolt.tar.gz
mv /tmp/kezjegy_feltolt.tar.gz "_regi/feltoltes_$TS.tar.gz"
for d in src deploy web/app web/panel web/landing; do
  [ -e "$U/kezjegy/$d" ] || continue
  # never swap in an empty folder
  [ -n "$(ls -A "$U/kezjegy/$d" 2>/dev/null)" ] || continue
  # web: carry the previous release's OWN hashed files over (only those, so nothing piles up release by release)
  if [ "${d#web/}" != "$d" ] && [ -d "$d" ]; then
    n=0
    if [ -s "$d/.sajat_fajlok.txt" ]; then lista=$(cat "$d/.sajat_fajlok.txt"); else lista=$(cd "$d" && find . -type f \( -path './_expo/static/*' -o -path './assets/*' \) | sed 's#^\./##'); fi
    while IFS= read -r f; do
      [ -n "$f" ] && [ -f "$d/$f" ] && [ ! -e "$U/kezjegy/$d/$f" ] || continue
      mkdir -p "$U/kezjegy/$d/$(dirname "$f")"
      cp -p "$d/$f" "$U/kezjegy/$d/$f"
      n=$((n + 1))
    done <<< "$lista"
    echo "$d: az előző kiadásból megtartva $n régi fájl (egy kiadásig)"
  fi
  if [ -e "$d" ]; then mv "$d" "_regi/$(echo "$d" | tr / _)_$TS"; fi
  mv "$U/kezjegy/$d" "$d"
done
# caddy/ is bind-mounted as a DIRECTORY into the shared Caddy: keep the directory, swap only the file.
if [ -s "$U/kezjegy/caddy/kezjegy.caddy" ]; then
  mkdir -p caddy
  if [ -e caddy/kezjegy.caddy ]; then mv caddy/kezjegy.caddy "_regi/kezjegy.caddy_$TS"; fi
  mv "$U/kezjegy/caddy/kezjegy.caddy" caddy/kezjegy.caddy
  # The SHARED Caddy (Gardoko too) imports this file: a file it cannot parse must never stay in place – a later
  # restart of that container would take Gardoko down with it. Validate now, with the running container's own
  # config; on failure the previous file comes back and the upload stops (round 1, 2026-11-19).
  if docker ps --format '{{.Names}}' | grep -qx appok-caddy-1 && grep -q '^import /etc/caddy/kezjegy/' /srv/appok/deploy/Caddyfile 2>/dev/null; then
    if ! docker exec appok-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/kezjegy_caddy_validate.log 2>&1; then
      mv caddy/kezjegy.caddy "_regi/kezjegy.caddy_HIBAS_$TS"
      if [ -e "_regi/kezjegy.caddy_$TS" ]; then cp -p "_regi/kezjegy.caddy_$TS" caddy/kezjegy.caddy; fi
      echo "HIBA: az új kezjegy.caddy nem érvényes, a régi maradt érvényben. Részletek:"; tail -5 /tmp/kezjegy_caddy_validate.log
      exit 1
    fi
    echo "kezjegy.caddy: érvényes (a közös Caddy ellenőrizte)"
  fi
fi
rmdir "$U/kezjegy/caddy" "$U/kezjegy/web" "$U/kezjegy" "$U" 2>/dev/null || true
chmod +x deploy/*.sh 2>/dev/null || true
echo "unpacked on appok-1 at $TS"
REMOTE
echo "FELTÖLTVE, DE MÉG NEM ÉL: a web/app, web/panel, web/landing mappa csere csak az up.sh után látszik (a kezjegy-web a régi"
echo "mappát tartja csatolva, és az API/worker is a régi kódot futtatja). Élesítés (előtte pg_dump, Gardoko health):"
echo "  ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'"
