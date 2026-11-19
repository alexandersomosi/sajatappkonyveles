#!/usr/bin/env bash
# ONE-TIME change of the shared Gardoko files (SPEC §20.3) so the shared Caddy (appok-caddy-1) also serves
# the three Kézjegy hosts. Idempotent: running it again changes nothing. Gardoko must keep working:
#   1. Gardoko health must be OK before anything is touched.
#   2. docker-compose.yml and Caddyfile of /srv/appok/deploy are copied to /srv/appok/_regi/<name>_<time>.
#   3. compose (service caddy): + network kezjegy_edge, + read-only mount /srv/kezjegy/caddy → /etc/caddy/kezjegy
#      (a DIRECTORY mount, so a new kezjegy.caddy is visible without recreating the container);
#      top-level networks: kezjegy_edge external. Caddyfile: + one top-level line "import /etc/caddy/kezjegy/*.caddy".
#   4. both validated (compose config, caddy validate in a throwaway container), then only caddy is recreated
#      (--no-deps: api and db of Gardoko are not touched).
#   5. Gardoko health again; on failure the saved files are restored and caddy recreated at once.
set -euo pipefail
G=/srv/appok/deploy
GH=https://45-94-65-74.sslip.io/api/v1/health
DCG=(docker compose --env-file /srv/appok/.env -f "$G/docker-compose.yml")

health() { curl -fsS -m 15 "$GH" >/dev/null; }
health || { echo "Gardoko health NOT OK before the change - stopping, nothing touched."; exit 1; }
echo "Gardoko health before: OK"
docker network inspect kezjegy_edge >/dev/null 2>&1 || { echo "kezjegy_edge network missing: run up.sh first."; exit 1; }
[ -s /srv/kezjegy/caddy/kezjegy.caddy ] || { echo "/srv/kezjegy/caddy/kezjegy.caddy missing."; exit 1; }

if grep -q 'kezjegy_edge' "$G/docker-compose.yml" && grep -q '^import /etc/caddy/kezjegy/\*\.caddy' "$G/Caddyfile"; then
  echo "Already attached (compose + Caddyfile). Reloading Caddy config only."
else
  TS=$(date +%Y%m%d_%H%M%S)
  mkdir -p /srv/appok/_regi
  cp -p "$G/docker-compose.yml" "/srv/appok/_regi/docker-compose_$TS.yml"
  cp -p "$G/Caddyfile" "/srv/appok/_regi/Caddyfile_$TS"
  echo "saved: /srv/appok/_regi/docker-compose_$TS.yml, /srv/appok/_regi/Caddyfile_$TS"
  restore() {
    echo "RESTORING the saved Gardoko files"
    cp -p "/srv/appok/_regi/docker-compose_$TS.yml" "$G/docker-compose.yml"
    cp -p "/srv/appok/_regi/Caddyfile_$TS" "$G/Caddyfile"
    "${DCG[@]}" up -d --no-deps --force-recreate caddy
  }

  python3 - "$G/docker-compose.yml" "$G/Caddyfile" <<'PY'
import sys
comp, cf = sys.argv[1], sys.argv[2]
s = open(comp).read()
def once(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit(f"compose: expected exactly one {old!r}, found {s.count(old)} - nothing changed")
    s = s.replace(old, new)
if 'kezjegy_edge' not in s:
    once("      - ./Caddyfile:/etc/caddy/Caddyfile:ro\n",
         "      - ./Caddyfile:/etc/caddy/Caddyfile:ro\n"
         "      # Kézjegy site blocks (imported by the Caddyfile); directory mount, see /srv/kezjegy/deploy/README.md\n"
         "      - /srv/kezjegy/caddy:/etc/caddy/kezjegy:ro\n")
    once("    networks: [edge]\n", "    networks: [edge, kezjegy_edge]\n")
    once("  internal:\n    internal: true\n",
         "  internal:\n    internal: true\n"
         "  # Kézjegy stack network (compose project kezjegy, /srv/kezjegy): Caddy reaches kezjegy-api / kezjegy-web here.\n"
         "  kezjegy_edge:\n    external: true\n    name: kezjegy_edge\n")
c = open(cf).read()
if '/etc/caddy/kezjegy/' not in c:
    c = c.rstrip("\n") + "\n\n# Kézjegy (app., konyvelo., api. subdomains) - /srv/kezjegy/caddy/kezjegy.caddy\nimport /etc/caddy/kezjegy/*.caddy\n"
tmpc, tmpf = comp + ".uj", cf + ".uj"
open(tmpc, "w").write(s)
open(tmpf, "w").write(c)
PY
  # validate the NEW files before they replace the old ones
  docker compose --env-file /srv/appok/.env -f "$G/docker-compose.yml.uj" config -q
  docker run --rm -v "$G/Caddyfile.uj:/etc/caddy/Caddyfile:ro" -v /srv/kezjegy/caddy:/etc/caddy/kezjegy:ro caddy:2-alpine \
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
  echo "new compose + Caddyfile: valid"
  # keep inode-independent copies; the old ones are already in _regi
  cat "$G/docker-compose.yml.uj" > "$G/docker-compose.yml"
  cat "$G/Caddyfile.uj" > "$G/Caddyfile"
  mv "$G/docker-compose.yml.uj" "/srv/appok/_regi/docker-compose_${TS}_uj.yml"
  mv "$G/Caddyfile.uj" "/srv/appok/_regi/Caddyfile_${TS}_uj"
  if ! "${DCG[@]}" up -d --no-deps --force-recreate caddy; then restore; exit 1; fi
fi

docker exec appok-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
ok=0
for i in $(seq 1 20); do health && { ok=1; break; }; sleep 3; done
if [ "$ok" != 1 ]; then
  echo "Gardoko health FAILED after the change"
  if declare -f restore >/dev/null; then restore; fi
  exit 1
fi
echo "Gardoko health after: OK"
