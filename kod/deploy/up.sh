#!/usr/bin/env bash
# Builds and (re)starts the Kézjegy stack on appok-1. Safe to run repeatedly. Does not touch Gardoko.
#   bash /srv/kezjegy/deploy/up.sh
# Order (QA kör 3): env files → image → database → migrations as the owner (kezjegy-migrate, one-shot) →
# least-privilege role + grants (db-roles.sh) → API + worker as kezjegy_app (SKIP_MIGRATIONS=1) → web, Caddy.
# SPEC §31.1: the statistics server (kezjegy-umami + its own kezjegy-umami-db) starts with the rest; its database is
# dumped (encrypted) before every deploy too, because Umami migrates its own schema at start. The first set-up of
# Umami (admin password, website, read user) is deploy/umami-beallit.sh – once, by hand.
set -euo pipefail
cd /srv/kezjegy/deploy
DC=(docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml)

bash /srv/kezjegy/deploy/gen-env.sh
mkdir -p /srv/kezjegy/data/files /srv/kezjegy/backups /srv/kezjegy/_regi /srv/kezjegy/web/app /srv/kezjegy/web/panel /srv/kezjegy/web/landing
# SPEC §31 / K8 lesson (11-20): the landing must bring its own script and the e-mail logos (the mails link them)
if [ -s /srv/kezjegy/web/landing/index.html ]; then
  for f in js/meres.js email/logo_feher@2x.png email/logo_alairas@2x.png; do
    [ -s "/srv/kezjegy/web/landing/$f" ] || { echo "HIBA: a /srv/kezjegy/web/landing/$f hiányzik – a landing buildje hiányos (node kod/landing/build.mjs, majd feltolt.sh)"; exit 1; }
  done
fi
chmod 700 /srv/kezjegy/data /srv/kezjegy/data/files /srv/kezjegy/backups
# SPEC §31.6: the folder of the Google ad key (hirdetes_kulcsok.ps1 puts it there; empty while ad measurement is off)
mkdir -p /srv/kezjegy/hirdetes && chmod 700 /srv/kezjegy/hirdetes

# SPEC §29.3.3: /srv/kezjegy/nyilvanos.env holds PUBLIC values only (it is loaded after .env, the later file wins).
# Any other key there is refused (key names are printed, never values).
if [ -f /srv/kezjegy/nyilvanos.env ]; then
  idegen=$(grep -vE '^\s*(#|$)' /srv/kezjegy/nyilvanos.env | cut -d= -f1 | grep -vxE 'APP_PUBLIC_URL|PANEL_PUBLIC_URL|API_PUBLIC_URL|LANDING_PUBLIC_URL|EXTRA_PUBLIC_ORIGINS' || true)
  if [ -n "$idegen" ]; then echo "HIBA: a nyilvanos.env-ben csak nyilvános címek lehetnek. Idegen kulcs: $(echo $idegen | tr '\n' ' ')"; exit 1; fi
fi

# Refuse a broken web.Caddyfile before restarting anything.
docker run --rm -v "$PWD/web.Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
"${DC[@]}" config -q

before=$(docker image inspect -f '{{.Id}}' kezjegy/api:latest 2>/dev/null || echo none)
"${DC[@]}" build kezjegy-api
after=$(docker image inspect -f '{{.Id}}' kezjegy/api:latest 2>/dev/null || echo none)

# Database first, then the migrations with the owner role (the only container that gets .env.db besides the DB).
"${DC[@]}" up -d kezjegy-db
for i in $(seq 1 60); do
  st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-db 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 2
done
[ "$st" = healthy ] || { echo "kezjegy-db: $st"; exit 1; }
# A dump BEFORE the migrations, encrypted exactly like the nightly backup (gpg AES256, .backup_pass) – never a plain
# file (round 1, 2026-11-19: the earlier pre-deploy dumps in _regi were not encrypted). No dump → no migration.
if docker exec kezjegy-db psql -U kezjegy -d kezjegy -Atc "select to_regclass('public.users') is not null" 2>/dev/null | grep -qx t; then
  [ -s /srv/kezjegy/.backup_pass ] || { echo "HIBA: nincs /srv/kezjegy/.backup_pass – a frissítés előtti mentést nem tudom titkosítani"; exit 1; }
  ELOTTE="/srv/kezjegy/_regi/db_elotte_up_$(date +%Y%m%d_%H%M%S).dump.gpg"
  ( umask 077
    docker exec kezjegy-db pg_dump -U kezjegy -d kezjegy -Fc \
      | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass \
            --symmetric --cipher-algo AES256 -o "$ELOTTE.part"
    mv "$ELOTTE.part" "$ELOTTE" )
  [ "$(stat -c %s "$ELOTTE")" -gt 1000 ] || { echo "HIBA: a frissítés előtti mentés üres: $ELOTTE"; exit 1; }
  echo "mentés a frissítés előtt (titkosítva): $ELOTTE ($(stat -c %s "$ELOTTE") bájt)"
fi
# SPEC §31.1: the statistics database too, before Umami's own migrations (only when it already runs; same encryption)
if docker ps --format '{{.Names}}' | grep -qx kezjegy-umami-db; then
  UELOTTE="/srv/kezjegy/_regi/umami_elotte_up_$(date +%Y%m%d_%H%M%S).dump.gpg"
  ( umask 077
    docker exec kezjegy-umami-db pg_dump -U umami -d umami -Fc \
      | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass \
            --symmetric --cipher-algo AES256 -o "$UELOTTE.part"
    mv "$UELOTTE.part" "$UELOTTE" )
  echo "statisztika-mentés a frissítés előtt (titkosítva): $UELOTTE ($(stat -c %s "$UELOTTE") bájt)"
fi
"${DC[@]}" --profile migrate run --rm -T kezjegy-migrate
# Least-privilege role and grants (needs the migrated schema; the API connects with this role).
bash /srv/kezjegy/deploy/db-roles.sh

"${DC[@]}" up -d
# A rebuilt image must replace the running API and worker even when the compose file did not change.
if [ "$before" != "$after" ]; then "${DC[@]}" up -d --force-recreate kezjegy-api kezjegy-worker; fi
# feltolt.sh swaps web/app, web/panel and web.Caddyfile for new folders/files; bind mounts follow the old
# inodes, so the static server is always RE-CREATED (k3c2 review: a plain restart was not proven to re-bind; a
# re-created container mounts the current folders by path). A second, no downtime worth mentioning.
"${DC[@]}" up -d --no-deps --force-recreate kezjegy-web
# proof: the served app index must be the one on disk (the bind mount follows the new folder)
kint=$(sha256sum /srv/kezjegy/web/app/index.html | cut -d' ' -f1)
bent=$(docker exec kezjegy-web sha256sum /srv/app/index.html 2>/dev/null | cut -d' ' -f1 || true)
if [ "$kint" = "$bent" ]; then echo "kezjegy-web: az új app-build él"; else echo "FIGYELEM: a kezjegy-web nem a /srv/kezjegy/web/app mappát szolgálja ki"; fi
# the same proof for the landing (K8 lesson 11-20: a swapped landing folder stayed unseen) and its e-mail logo
if [ -s /srv/kezjegy/web/landing/index.html ]; then
  lk=$(sha256sum /srv/kezjegy/web/landing/index.html | cut -d' ' -f1)
  lb=$(docker exec kezjegy-web sha256sum /srv/landing/index.html 2>/dev/null | cut -d' ' -f1 || true)
  if [ "$lk" = "$lb" ] && docker exec kezjegy-web test -s /srv/landing/email/logo_feher@2x.png; then echo "kezjegy-web: az új landing él (e-mail-logóval)"; else echo "FIGYELEM: a kezjegy-web nem az új landingot szolgálja ki, vagy hiányzik az e-mail-logó"; fi
fi
# SPEC §29.3.2: the Adózz proxy (own compose project kezjegy-proxy in /srv/kezjegy/proxy, never recreated here). After the
# switch every deploy validates the uploaded proxy config, swaps its files and reloads it (atallas.sh frissit). Before the
# switch the old shared Caddy container is reloaded instead (by container name; no path into the old project).
if [ -d /srv/kezjegy/proxy/caddy ]; then
  bash /srv/kezjegy/deploy/proxy/atallas.sh frissit
fi
if ! docker ps --format '{{.Names}}' | grep -qx kezjegy-proxy && docker ps --format '{{.Names}}' | grep -qx appok-caddy-1 && docker exec appok-caddy-1 grep -q '^import /etc/caddy/kezjegy/' /etc/caddy/Caddyfile 2>/dev/null; then
  docker exec appok-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi

for i in $(seq 1 60); do
  st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 3
done
echo "kezjegy-api: $st"
"${DC[@]}" ps
[ "$st" = healthy ]

# The API and the worker must not hold any database owner secret (names only, never values).
for c in kezjegy-api kezjegy-worker; do
  leak=$(docker exec "$c" printenv 2>/dev/null | cut -d= -f1 | grep -E '^(POSTGRES_PASSWORD|MIGRATION_DATABASE_URL|KEZJEGY_APP_DB_PASSWORD)$' || true)
  if [ -n "$leak" ]; then echo "HIBA: $c környezetében tulajdonosi titok: $leak"; exit 1; fi
  echo "$c: nincs tulajdonosi titok a környezetben"
done
