#!/usr/bin/env bash
# SPEC §31.1 – ONE-TIME set-up of our own statistics server (Umami 3.5.0, container kezjegy-umami), after the first
# up.sh that started it. Run on appok-1:   bash /srv/kezjegy/deploy/umami-beallit.sh
#  1. generates (on the server) a new admin password, and a separate read user for the API ("kezjegy-pult", role user:
#     it sees only its own website) – kept in /srv/kezjegy/.umami_beallitas (chmod 600; for a re-run or the SSH tunnel);
#  2. replaces Umami's factory admin password (admin / umami) at once;
#  3. creates the website "adozz.hu" (owned by the read user) → the public website id;
#  4. writes UMAMI_API_URL / UMAMI_WEBSITE_ID / UMAMI_API_USER / UMAMI_API_PASSWORD into /srv/kezjegy/.env (the old file
#     goes to _regi/env_<time> first), then recreates the API and the worker so they read it.
# Prints NOTHING secret: only the website id (public – it is in the page source anyway) and the next step.
# The HTTP calls run INSIDE the container (node, its internal address); the secrets go on stdin, never as arguments.
# Safe to re-run: an existing set-up is left as it is.
set -euo pipefail
umask 077
cd /srv/kezjegy
ENV=/srv/kezjegy/.env
ALLAPOT=/srv/kezjegy/.umami_beallitas
mkdir -p _regi

st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-umami 2>/dev/null || echo none)
[ "$st" = healthy ] || { echo "HIBA: a kezjegy-umami nem fut vagy nem egészséges ($st). Előbb: bash /srv/kezjegy/deploy/up.sh"; exit 1; }
if grep -q '^UMAMI_WEBSITE_ID=.' "$ENV"; then
  echo "Már be van állítva (a .env-ben van UMAMI_WEBSITE_ID). Nem változtattam semmit."
  echo "website id (nyilvános): $(grep '^UMAMI_WEBSITE_ID=' "$ENV" | tail -1 | cut -d= -f2)"
  exit 0
fi

if [ ! -s "$ALLAPOT" ]; then
  python3 - "$ALLAPOT" <<'PY'
import json, os, secrets, sys, uuid
fd = os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as f:
    json.dump({"admin": secrets.token_hex(24), "apiUser": "kezjegy-pult", "apiUserId": str(uuid.uuid4()), "apiPassword": secrets.token_hex(24)}, f)
PY
fi
chmod 600 "$ALLAPOT"

JS=$(cat <<'NODE'
const s = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const B = 'http://localhost:3000/api';
async function call(path, o = {}) {
  const r = await fetch(B + path, {
    method: o.method || (o.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(o.token ? { authorization: 'Bearer ' + o.token } : {}) },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch {}
  return { status: r.status, j };
}
async function login(u, p) {
  const r = await call('/auth/login', { body: { username: u, password: p } });
  return r.status === 200 && r.j && typeof r.j.token === 'string' ? r.j.token : null;
}
(async () => {
  let admin = await login('admin', s.admin);
  if (!admin) {
    const t = await login('admin', 'umami');
    if (!t) throw new Error('az admin nem lép be (se a generált, se a gyári jelszóval)');
    const ch = await call('/me/password', { token: t, body: { currentPassword: 'umami', newPassword: s.admin } });
    if (ch.status !== 200) throw new Error('a gyári admin jelszó cseréje nem sikerült (' + ch.status + ') – SSH-alagúton a felületen cseréld le');
    admin = (ch.j && typeof ch.j.token === 'string' && ch.j.token) || (await login('admin', s.admin));
    if (!admin) throw new Error('csere után az admin nem lép be');
  }
  let api = await login(s.apiUser, s.apiPassword);
  if (!api) {
    const cu = await call('/users', { token: admin, body: { id: s.apiUserId, username: s.apiUser, password: s.apiPassword, role: 'user' } });
    if (cu.status !== 200) {
      const up = await call('/users/' + s.apiUserId, { token: admin, body: { password: s.apiPassword } });
      if (up.status !== 200) throw new Error('az olvasó felhasználó létrehozása nem sikerült (' + cu.status + '/' + up.status + ')');
    }
    api = await login(s.apiUser, s.apiPassword);
    if (!api) throw new Error('az olvasó felhasználó nem lép be');
  }
  const list = await call('/websites', { token: api });
  const items = Array.isArray(list.j) ? list.j : (list.j && Array.isArray(list.j.data) ? list.j.data : []);
  let w = items.find((x) => x && x.domain === 'adozz.hu');
  if (!w) {
    const cw = await call('/websites', { token: api, body: { name: 'adozz.hu', domain: 'adozz.hu' } });
    if (cw.status !== 200 || !cw.j || !cw.j.id) throw new Error('a weboldal létrehozása nem sikerült (' + cw.status + ')');
    w = cw.j;
  }
  process.stdout.write(JSON.stringify({ websiteId: w.id }));
})().catch((e) => {
  process.stderr.write('HIBA: ' + e.message + '\n');
  process.exit(1);
});
NODE
)
EREDMENY=$(docker exec -i kezjegy-umami node -e "$JS" < "$ALLAPOT")
WID=$(printf '%s' "$EREDMENY" | python3 -c 'import json,re,sys; w=json.load(sys.stdin)["websiteId"]; assert re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", w); print(w)')

TS=$(date +%Y%m%d_%H%M%S)
cp -p "$ENV" "_regi/env_$TS"
python3 - "$ENV" "$ALLAPOT" "$WID" <<'PY'
import json, sys
env, allapot, wid = sys.argv[1], sys.argv[2], sys.argv[3]
a = json.load(open(allapot))
uj = {"UMAMI_API_URL": "http://kezjegy-umami:3000", "UMAMI_WEBSITE_ID": wid, "UMAMI_API_USER": a["apiUser"], "UMAMI_API_PASSWORD": a["apiPassword"]}
sorok = open(env, encoding="utf-8").read().splitlines()
kesz = set()
for i, l in enumerate(sorok):
    k = l.split("=", 1)[0]
    if k in uj:
        sorok[i] = k + "=" + uj[k]
        kesz.add(k)
sorok += ["# SPEC §31.1 – the statistics server (umami-beallit.sh)"] + [k + "=" + v for k, v in uj.items() if k not in kesz]
open(env, "w", encoding="utf-8").write("\n".join(sorok) + "\n")
print("a .env-be írva: " + ", ".join(sorted(uj)))
PY
chmod 600 "$ENV"

cd /srv/kezjegy/deploy
docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1
for i in $(seq 1 40); do st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none); [ "$st" = healthy ] && break; sleep 3; done
if [ "$st" = healthy ]; then echo "API újraindítva: OK"; else echo "FIGYELEM: az API nem egészséges ($st) – a régi .env: /srv/kezjegy/_regi/env_$TS"; exit 1; fi
echo ""
echo "website id (nyilvános): $WID"
echo "Következő lépés (a gépen): írd be a kod/landing/meres.json umamiWebsiteId mezőjébe, node kod/landing/build.mjs,"
echo "majd feltolt.sh + up.sh (kod/MARKETING.md, „A statisztika bekapcsolása”)."
