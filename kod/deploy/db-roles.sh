#!/usr/bin/env bash
# Least-privilege database role for the API and the worker (QA kör 2). Run by up.sh after the migrations,
# before the API starts; safe to run repeatedly. Never prints a password.
#
#   kezjegy      – the bootstrap/owner role (superuser of this private Postgres container): migrations only,
#                  via MIGRATION_DATABASE_URL. Backups (pg_dump inside the container) also use it.
#   kezjegy_app  – LOGIN, no SUPERUSER / CREATEDB / CREATEROLE / BYPASSRLS; SELECT/INSERT/UPDATE/DELETE on the
#                  app tables, but on audit_log only SELECT + INSERT (no UPDATE/DELETE/TRUNCATE); the 5-year audit
#                  purge goes through the SECURITY DEFINER function kezjegy_audit_purge (migration 0006).
#
# QA kör 3: the password is read from /srv/kezjegy/.env.db (gen-env.sh keeps the owner secrets there), and up.sh
# runs this script after the migrations and BEFORE the API starts, so the API never needs the owner URL.
set -euo pipefail
umask 077
ENVDB=/srv/kezjegy/.env.db
cd /srv/kezjegy/deploy

grep -q '^KEZJEGY_APP_DB_PASSWORD=' "$ENVDB" || { echo "KEZJEGY_APP_DB_PASSWORD hiányzik a .env.db-ből (gen-env.sh)"; exit 1; }

python3 - "$ENVDB" <<'PY' | docker exec -i kezjegy-db psql -v ON_ERROR_STOP=1 -q -U kezjegy -d kezjegy >/dev/null
import re, sys
env = dict(l.split("=", 1) for l in open(sys.argv[1]).read().splitlines() if "=" in l and not l.lstrip().startswith("#"))
pw = env["KEZJEGY_APP_DB_PASSWORD"].strip()
if not re.fullmatch(r"[0-9a-f]{32,128}", pw):
    raise SystemExit("KEZJEGY_APP_DB_PASSWORD: hex kell")
print(f"""
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kezjegy_app') THEN
    CREATE ROLE kezjegy_app LOGIN;
  END IF;
END $$;
ALTER ROLE kezjegy_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 40 PASSWORD '{pw}';
GRANT CONNECT ON DATABASE kezjegy TO kezjegy_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO kezjegy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kezjegy_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kezjegy_app;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON audit_log FROM kezjegy_app;
-- SPEC §29.12: money records are never deleted by the app (SELECT/INSERT/UPDATE only)
DO $$ BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    REVOKE DELETE, TRUNCATE ON payments, stripe_events, payment_methods, stripe_customers FROM kezjegy_app;
  END IF;
END $$;
REVOKE ALL ON FUNCTION kezjegy_audit_purge(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kezjegy_audit_purge(timestamptz) TO kezjegy_app;
ALTER DEFAULT PRIVILEGES FOR ROLE kezjegy IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kezjegy_app;
ALTER DEFAULT PRIVILEGES FOR ROLE kezjegy IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kezjegy_app;
-- the worker waits until the API applied every migration: read-only access to the migration journal
GRANT USAGE ON SCHEMA drizzle TO kezjegy_app;
GRANT SELECT ON drizzle.__drizzle_migrations TO kezjegy_app;
""")
PY
echo "db: kezjegy_app jogai beállítva"

# Show what the API really connects as (no secrets).
docker exec kezjegy-db psql -At -U kezjegy -d kezjegy -c "select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname in ('kezjegy','kezjegy_app') order by 1" | sed 's/^/szerep: /'
docker exec kezjegy-db psql -At -U kezjegy -d kezjegy -c "select usename, count(*) from pg_stat_activity where datname='kezjegy' and usename is not null group by 1 order by 1" | sed 's/^/kapcsolat: /'
