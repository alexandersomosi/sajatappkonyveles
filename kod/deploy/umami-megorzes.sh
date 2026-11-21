#!/usr/bin/env bash
# SPEC §31 / Adatkezelési tájékoztató 2.17. és 8. pont: a weboldal-statisztika (Umami, kezjegy-umami-db) 2 évnél régebbi
# adatainak törlése. Az Umami magától nem töröl. ELŐKÉSZÍTVE, NINCS IDŐZÍTVE: a tulaj házirendje „semmit nem törlünk”, ezért
# a cron-sort csak az ő jóváhagyásával kell felvenni (az első törlendő adat 2028 novemberében keletkezik).
#   bash /srv/kezjegy/deploy/umami-megorzes.sh            → csak megszámolja, mi törlődne (nem változtat semmit)
#   bash /srv/kezjegy/deploy/umami-megorzes.sh --torol    → titkosított mentés után töröl (egy tranzakcióban)
# Cron (deploy felhasználó, havonta egyszer; CSAK a tulaj jóváhagyásával):
#   15 4 1 * * /bin/bash /srv/kezjegy/deploy/umami-megorzes.sh --torol >> /srv/kezjegy/backups/umami-megorzes.log 2>&1
# Személyes adatot nem ír ki: csak táblaneveket és sorszámokat.
set -euo pipefail
NAP=${UMAMI_MEGORZES_NAP:-730}
TOROL=0
[ "${1:-}" = "--torol" ] && TOROL=1
docker ps --format '{{.Names}}' | grep -qx kezjegy-umami-db || { echo "a kezjegy-umami-db nem fut – nincs mit tenni"; exit 0; }
PSQL=(docker exec -i kezjegy-umami-db psql -X -q -v ON_ERROR_STOP=1 -U umami -d umami -At)
# a 3.5.0 táblái, amelyek látogatási adatot tartanak (ha valamelyik nincs meg, kimarad)
for t in event_data session_data revenue website_event session; do
  if [ "$("${PSQL[@]}" -c "select to_regclass('public.$t') is not null")" = t ]; then
    n=$("${PSQL[@]}" -c "select count(*) from \"$t\" where created_at < now() - interval '$NAP days'")
    echo "$(date -Is) $t: $n sor régebbi $NAP napnál"
  fi
done
[ "$TOROL" = 1 ] || { echo "(próbafutás: nem töröltem semmit; törléshez: --torol)"; exit 0; }
[ -s /srv/kezjegy/.backup_pass ] || { echo "HIBA: nincs /srv/kezjegy/.backup_pass – mentés nélkül nem törlök"; exit 1; }
M="/srv/kezjegy/backups/umami_elotte_megorzes_$(date +%Y%m%d_%H%M%S).dump.gpg"
( umask 077
  docker exec kezjegy-umami-db pg_dump -U umami -d umami -Fc \
    | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass --symmetric --cipher-algo AES256 -o "$M.part"
  mv "$M.part" "$M" )
echo "mentés előtte: $M"
"${PSQL[@]}" <<SQL
begin;
delete from event_data where created_at < now() - interval '$NAP days';
delete from session_data where created_at < now() - interval '$NAP days';
do \$\$ begin if to_regclass('public.revenue') is not null then execute 'delete from revenue where created_at < now() - interval ''$NAP days'''; end if; end \$\$;
delete from website_event where created_at < now() - interval '$NAP days';
-- a munkamenet csak akkor megy, ha már egyetlen eseménye sincs
delete from session s where s.created_at < now() - interval '$NAP days' and not exists (select 1 from website_event e where e.session_id = s.session_id);
commit;
SQL
echo "$(date -Is) kész: a $NAP napnál régebbi statisztikai adatok törölve"
