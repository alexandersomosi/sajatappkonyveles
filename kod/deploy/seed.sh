#!/usr/bin/env bash
# Loads the DEMO data (SPEC §19: Kovács Bence, Szabó Kata, Varga Réka, Németh Péter, admin – all fictional).
# Runs once; a second run answers "már be vannak töltve" and changes nothing.
# The random passwords go ONLY to /srv/kezjegy/demo_belepesek.txt (chmod 600); nothing is printed.
# Owner reads them from his PC:  ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'
set -euo pipefail
cd /srv/kezjegy/deploy
DC=(docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml)
umask 077
install -d -m 700 /srv/kezjegy/_seed
# bash seed.sh --uj-jelszavak  → new passwords for the seeded DEMO accounts (all their sessions end)
"${DC[@]}" run --rm --no-deps -T -v /srv/kezjegy/_seed:/run/seed kezjegy-api node dist/seed/index.js "$@"
if [ -s /srv/kezjegy/_seed/demo_belepesek.txt ]; then
  if [ -f /srv/kezjegy/demo_belepesek.txt ]; then
    mkdir -p /srv/kezjegy/_regi
    mv /srv/kezjegy/demo_belepesek.txt "/srv/kezjegy/_regi/demo_belepesek_$(date +%Y%m%d_%H%M%S).txt"
  fi
  mv /srv/kezjegy/_seed/demo_belepesek.txt /srv/kezjegy/demo_belepesek.txt
  chmod 600 /srv/kezjegy/demo_belepesek.txt
  echo "Belépések: /srv/kezjegy/demo_belepesek.txt ($(grep -c ';' /srv/kezjegy/demo_belepesek.txt) sor, chmod 600)"
fi
