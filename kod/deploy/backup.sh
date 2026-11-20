#!/usr/bin/env bash
# HOURLY backup of the Kézjegy database (SPEC §20.4; owner 11-19: "óránként egy mentés"). Cron of the deploy user:
#   5 * * * * /bin/bash /srv/kezjegy/deploy/backup.sh >> /srv/kezjegy/backups/backup.log 2>&1
# pg_dump (custom format) → gpg AES256 with /srv/kezjegy/.backup_pass → backups/db_<date>.dump.gpg (600).
# Once a day (the 03:xx run) also a tar of data/files (the blobs are already AES-256-GCM encrypted).
# House rule: nothing is deleted. Rotation = MOVE: the newest 48 dumps (2 days) and 7 file snapshots stay in
# backups/, older ones go to backups/regi/. (Ez a HELYI mentés; változatlanul fut.)
# KÜLSŐ MENTÉS 2026-11-21 óta: a szerver MAGA küldi, restic-kel, a Hetzner Storage Boxra (a tulaj döntése 11-20):
#   35 * * * * /bin/bash /srv/kezjegy/deploy/restic-mentes.sh >> /srv/kezjegy/backups/restic.log 2>&1
#   tároló sftp:storagebox:kezjegy/restic, jelszó /srv/kezjegy/.restic_pass (másolat: _privat/restic_jelszo.txt);
#   óránként: db (pg_dump -Fp), files, config (.env, .env.db, .backup_pass, deploy/, proxy/), app (src/, web/).
#   A régi, a tulaj gépén át futó másolás (mentes-kulso.sh, „Adozz mentes kulso” feladat) KIKAPCSOLVA 11-20.
#   Visszaállítás (új szerveren is): README.md, „Külső mentés: restic a Storage Boxon”.
set -euo pipefail
umask 077
B=/srv/kezjegy/backups
TS=$(date +%Y%m%d_%H%M%S)
mkdir -p "$B"
OUT="$B/db_$TS.dump.gpg"
docker exec kezjegy-db pg_dump -U kezjegy -d kezjegy -Fc \
  | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass \
        --symmetric --cipher-algo AES256 -o "$OUT.part"
mv "$OUT.part" "$OUT"
echo "$(date -Is) db backup: $OUT ($(stat -c %s "$OUT") bytes)"
# SPEC §31.1: the statistics database (Umami), once a day at the 03:xx run, encrypted the same way
if { [ "$(date +%H)" = 03 ] || [ "${FILES:-0}" = 1 ]; } && docker ps --format '{{.Names}}' | grep -qx kezjegy-umami-db; then
  UOUT="$B/umami_$TS.dump.gpg"
  docker exec kezjegy-umami-db pg_dump -U umami -d umami -Fc \
    | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass \
          --symmetric --cipher-algo AES256 -o "$UOUT.part"
  mv "$UOUT.part" "$UOUT"
  echo "$(date -Is) umami backup: $UOUT ($(stat -c %s "$UOUT") bytes)"
fi
if [ "$(date +%H)" = 03 ] || [ "${FILES:-0}" = 1 ]; then
  tar -C /srv/kezjegy/data -cf "$B/files_$TS.tar.part" files && mv "$B/files_$TS.tar.part" "$B/files_$TS.tar"
  echo "$(date -Is) files snapshot: $B/files_$TS.tar"
fi
# rotation by moving (never deleting): keep the newest 48 dumps and 7 file snapshots at hand
mkdir -p "$B/regi"
ls -1t "$B"/db_*.dump.gpg 2>/dev/null | tail -n +49 | while read -r f; do mv "$f" "$B/regi/"; done
ls -1t "$B"/files_*.tar 2>/dev/null | tail -n +8 | while read -r f; do mv "$f" "$B/regi/"; done
ls -1t "$B"/umami_*.dump.gpg 2>/dev/null | tail -n +8 | while read -r f; do mv "$f" "$B/regi/"; done
# Disk watch (QA kör 3): backups/regi only grows (nothing is deleted). Above 5 GB, or with less than 15% free
# space on the disk, the admin panel (Rendszer) shows a warning – time to copy them offsite (mentes-kulso.sh).
REGI_KB=$(du -sk "$B/regi" 2>/dev/null | cut -f1); REGI_KB=${REGI_KB:-0}
FREE_PCT=$(df -P "$B" | awk 'NR==2 {gsub("%","",$5); print 100-$5}')
ALERT=false; { [ "$REGI_KB" -gt 5242880 ] || [ "$FREE_PCT" -lt 15 ]; } && ALERT=true
[ "$ALERT" = true ] && echo "$(date -Is) FIGYELEM: backups/regi $((REGI_KB / 1024)) MB, szabad hely ${FREE_PCT}% – másold külső helyre"
docker exec kezjegy-db psql -q -U kezjegy -d kezjegy -c   "insert into system_state(key, value) values ('backup.disk', jsonb_build_object('regiMb', $((REGI_KB / 1024)), 'freePct', $FREE_PCT, 'alert', $ALERT, 'at', now())) on conflict (key) do update set value = excluded.value, updated_at = now()" >/dev/null
# shown in the admin panel (Rendszer → mentés kora; red after 26 hours)
docker exec kezjegy-db psql -q -U kezjegy -d kezjegy -c \
  "insert into system_state(key, value) values ('backup.last', jsonb_build_object('at', now())) on conflict (key) do update set value = excluded.value, updated_at = now()" >/dev/null
