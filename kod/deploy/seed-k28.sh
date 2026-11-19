#!/usr/bin/env bash
# SPEC §28.K.21: the idempotent DEMO addition of the evening orders of 2026-11-19 – NEVER a reseed.
# Adds (once): Lakatos Gréta (KATA), Kiss Norbert (check-in + 7 999 Ft DEMO change fee), Fazekas Ilona (service lock),
# Bárány Tamás (adószám later + EFO), Molnár Csilla (szünetel). Run seed-ot1119.sh first.
# Never changes an existing user or client row (alex@, tulaj@, Kata, Réka, Péter stay as they are). A second run
# prints "már megvan" and changes nothing. Runs after the migrations 0014 + 0015 + 0016 – the script checks it.
# Passwords: the new login lines are APPENDED to /srv/kezjegy/demo_belepesek.txt (chmod 600); nothing is printed.
# The previous list is kept in /srv/kezjegy/_regi/. Before: pg_dump into /srv/kezjegy/_regi/ (house rule).
#   bash /srv/kezjegy/deploy/seed-k28.sh
set -euo pipefail
cd /srv/kezjegy/deploy
DC=(docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml)
umask 077
TS=$(date +%Y%m%d_%H%M%S)
install -d -m 700 /srv/kezjegy/_seed /srv/kezjegy/_regi
# The container appends to a COPY of the current list (same uid as seed.sh); the original is never edited in place.
if [ -f /srv/kezjegy/demo_belepesek.txt ]; then cp -p /srv/kezjegy/demo_belepesek.txt /srv/kezjegy/_seed/demo_belepesek.txt; fi
"${DC[@]}" run --rm --no-deps -T -v /srv/kezjegy/_seed:/run/seed kezjegy-api node dist/seed/k28.js
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
