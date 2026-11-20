#!/usr/bin/env bash
# SPEC §29.17: the idempotent DEMO addition of k7 (seed:k29 = B1 payments + B2 new features) – NEVER a reseed.
# Adds (once): Halmi Zsófia (DEMO card, a refunded month → DEMO storno), Kerekes Anna (auth+…: the bank asks for a
# confirmation → Fizesd ki), and the B2 part (certificates, income statement approval, calendar feed, Németh Péter's free
# month, Fodor Márk terminated). Never changes alex@, tulaj@, bence.kovacs@, david@. A second run changes nothing.
# Runs after the migrations 0017 + 0018. Passwords are APPENDED to /srv/kezjegy/demo_belepesek.txt (600); nothing printed.
#   bash /srv/kezjegy/deploy/seed-k29.sh
set -euo pipefail
cd /srv/kezjegy/deploy
DC=(docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml)
umask 077
TS=$(date +%Y%m%d_%H%M%S)
install -d -m 700 /srv/kezjegy/_seed /srv/kezjegy/_regi
# The container appends to a COPY of the current list (same uid as seed.sh); the original is never edited in place.
if [ -f /srv/kezjegy/demo_belepesek.txt ]; then cp -p /srv/kezjegy/demo_belepesek.txt /srv/kezjegy/_seed/demo_belepesek.txt; fi
"${DC[@]}" run --rm --no-deps -T -v /srv/kezjegy/_seed:/run/seed kezjegy-api node dist/seed/k29.js
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
