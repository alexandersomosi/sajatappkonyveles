#!/usr/bin/env bash
# SPEC §27.7.4: the idempotent DEMO addition of the owner orders of 2026-11-19 – NEVER a reseed.
# Adds (once): Kiss Marika (assisted new business, UJEGYKE waits for her approval), Molnár Dávid (meghatalmazás
# request agreed) and Balogh Ilona (no login, waits for our call). Needs seed-tulaj1118.sh to have run before.
# Never changes an existing user or client row (alex@, tulaj@, Kata, Réka, Péter stay as they are). A second run
# prints "már megvan" and changes nothing. Runs after the migrations 0011 + 0012 – the script checks it.
# Passwords: two new lines (Marika, Dávid) are APPENDED to /srv/kezjegy/demo_belepesek.txt (chmod 600); nothing is printed.
# The previous list is kept in /srv/kezjegy/_regi/. Before: pg_dump into /srv/kezjegy/_regi/ (house rule).
#   bash /srv/kezjegy/deploy/seed-tulaj1119.sh
set -euo pipefail
cd /srv/kezjegy/deploy
DC=(docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml)
umask 077
TS=$(date +%Y%m%d_%H%M%S)
install -d -m 700 /srv/kezjegy/_seed /srv/kezjegy/_regi
# The container appends to a COPY of the current list (same uid as seed.sh); the original is never edited in place.
if [ -f /srv/kezjegy/demo_belepesek.txt ]; then cp -p /srv/kezjegy/demo_belepesek.txt /srv/kezjegy/_seed/demo_belepesek.txt; fi
"${DC[@]}" run --rm --no-deps -T -v /srv/kezjegy/_seed:/run/seed kezjegy-api node dist/seed/tulaj1119.js
if [ -s /srv/kezjegy/_seed/demo_belepesek.txt ]; then
  if [ -f /srv/kezjegy/demo_belepesek.txt ] && cmp -s /srv/kezjegy/_seed/demo_belepesek.txt /srv/kezjegy/demo_belepesek.txt; then
    mv /srv/kezjegy/_seed/demo_belepesek.txt "/srv/kezjegy/_regi/demo_belepesek_masolat_$TS.txt"
    echo "A belépések listája nem változott."
  else
    [ -f /srv/kezjegy/demo_belepesek.txt ] && mv /srv/kezjegy/demo_belepesek.txt "/srv/kezjegy/_regi/demo_belepesek_$TS.txt"
    mv /srv/kezjegy/_seed/demo_belepesek.txt /srv/kezjegy/demo_belepesek.txt
    chmod 600 /srv/kezjegy/demo_belepesek.txt
    echo "Belépések: /srv/kezjegy/demo_belepesek.txt ($(grep -c ';' /srv/kezjegy/demo_belepesek.txt) sor, chmod 600)"
  fi
fi
