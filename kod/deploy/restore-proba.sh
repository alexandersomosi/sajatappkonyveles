#!/usr/bin/env bash
# Restore drill (SPEC §20.4/§22): decrypts the newest backup, restores it into a THROWAWAY Postgres container
# (no network, removed at the end) and compares row counts with the live database. Live data is not touched.
#   bash /srv/kezjegy/deploy/restore-proba.sh [backups/db_....dump.gpg]
# Real restore (only after a disaster, with the stack stopped) is described in README.md.
set -euo pipefail
umask 077
F=${1:-$(ls -1t /srv/kezjegy/backups/db_*.dump.gpg | head -1)}
N=kezjegy-restore-proba-$$
# the decrypted dump never touches the disk: gpg → pipe → pg_restore inside the throwaway container
cleanup() { docker stop "$N" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --rm --name "$N" --network none -e POSTGRES_PASSWORD=proba -e POSTGRES_USER=kezjegy -e POSTGRES_DB=kezjegy postgres:17-alpine >/dev/null
for i in $(seq 1 30); do docker exec "$N" pg_isready -U kezjegy -d kezjegy >/dev/null 2>&1 && break; sleep 1; done
sleep 2
gpg --batch --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass -d "$F"   | docker exec -i "$N" pg_restore -U kezjegy -d kezjegy --no-owner
Q="select 'users', count(*) from users union all select 'clients', count(*) from clients union all select 'documents', count(*) from documents union all select 'nav_invoices', count(*) from nav_invoices union all select 'audit_log', count(*) from audit_log order by 1"
echo "backup: $F"
echo "--- restored copy"; docker exec "$N" psql -At -U kezjegy -d kezjegy -c "$Q"
echo "--- live (may be ahead by rows written since the backup)"; docker exec kezjegy-db psql -At -U kezjegy -d kezjegy -c "$Q"
