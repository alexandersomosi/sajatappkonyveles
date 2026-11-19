#!/usr/bin/env bash
# Nightly backup of the Kézjegy database (SPEC §20.4). Cron of the deploy user, 03:00:
#   0 3 * * * /bin/bash /srv/kezjegy/deploy/backup.sh >> /srv/kezjegy/backups/backup.log 2>&1
# pg_dump (custom format) → gpg AES256 with /srv/kezjegy/.backup_pass → backups/db_<date>.dump.gpg (600).
# On Sundays also a tar of data/files (the blobs are already AES-256-GCM encrypted).
# House rule: nothing is deleted. Rotation = MOVE: the newest 14 dumps and 4 file snapshots stay in backups/,
# older ones go to backups/regi/ (from there the owner copies them offsite, e.g. Hetzner Storage Box) [OWNER].
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
if [ "$(date +%u)" = 7 ] || [ "${FILES:-0}" = 1 ]; then
  tar -C /srv/kezjegy/data -cf "$B/files_$TS.tar.part" files && mv "$B/files_$TS.tar.part" "$B/files_$TS.tar"
  echo "$(date -Is) files snapshot: $B/files_$TS.tar"
fi
# rotation by moving (never deleting): keep the newest 14 dumps and 4 file snapshots at hand
mkdir -p "$B/regi"
ls -1t "$B"/db_*.dump.gpg 2>/dev/null | tail -n +15 | while read -r f; do mv "$f" "$B/regi/"; done
ls -1t "$B"/files_*.tar 2>/dev/null | tail -n +5 | while read -r f; do mv "$f" "$B/regi/"; done
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
