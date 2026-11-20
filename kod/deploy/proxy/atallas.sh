#!/usr/bin/env bash
# SPEC §29.3.5 – moving the public proxy from the old shared appok-caddy-1 to the Adózz proxy (kezjegy-proxy) and
# switching on adozz.hu. Step by step, every step printed and logged to /srv/kezjegy/_regi/proxy_atallas_<time>.log,
# stops on the first error, never prints a secret. Run on appok-1 as the deploy user, AFTER feltolt.sh uploaded deploy/:
#   bash /srv/kezjegy/deploy/proxy/atallas.sh elokeszit     # no effect on traffic: files, validation, DNS, copies
#   bash /srv/kezjegy/deploy/proxy/atallas.sh tanusitvany   # the sslip.io certificates copied into the new volume
#   bash /srv/kezjegy/deploy/proxy/atallas.sh atall         # ≈ 10–30 s: old proxy stopped, new one started; auto-rollback
#   bash /srv/kezjegy/deploy/proxy/atallas.sh adozz         # the adozz.hu hosts (certificates, redirects, 404 on api root)
#   bash /srv/kezjegy/deploy/proxy/atallas.sh cimek         # nyilvanos.env (adozz.hu URLs), API + worker recreated
#   bash /srv/kezjegy/deploy/proxy/atallas.sh visszaall     # manual rollback (any time before takarit)
#   bash /srv/kezjegy/deploy/proxy/atallas.sh takarit TAKARIT   # ≥ 1 h after atall: Gardoko leftovers removed (owner-approved)
#   bash /srv/kezjegy/deploy/proxy/atallas.sh frissit       # later deploys: new proxy config validated + swapped + reloaded
#   bash /srv/kezjegy/deploy/proxy/atallas.sh allapot       # what runs, which ports, every host's answer
set -euo pipefail
umask 022
LEPES="${1:-}"
TS=$(date +%Y%m%d_%H%M%S)
K=/srv/kezjegy
SRC=$K/deploy/proxy           # uploaded by feltolt.sh (replaced as a whole on every upload)
P=$K/proxy                    # where the running proxy lives (its config folder is bind-mounted and never replaced)
REGI=$K/_regi
mkdir -p "$REGI"
LOG="$REGI/proxy_atallas_${TS}_${LEPES:-semmi}.log"
exec > >(tee -a "$LOG") 2>&1
IP=45.94.65.74
SSLIP=(app.45-94-65-74.sslip.io konyvelo.45-94-65-74.sslip.io api.45-94-65-74.sslip.io)
ADOZZ=(adozz.hu www.adozz.hu app.adozz.hu konyvelo.adozz.hu api.adozz.hu)
PDC=(docker compose -p kezjegy-proxy -f "$P/docker-compose.yml")
IMG=caddy:2-alpine

lepes() { echo; echo "== $* =="; }
hiba() { echo "HIBA: $*"; exit 1; }
fut() { docker ps --format '{{.Names}}' | grep -qx "$1"; }

# HTTPS answer of one host through the local proxy (SNI = the host, connection to 127.0.0.1): "<code> <location>".
valasz() {
  local host=$1 path=${2:-/}
  curl -sS -o /dev/null --max-time 10 --resolve "$host:443:127.0.0.1" -w '%{http_code} %{redirect_url}' "https://$host$path" 2>/dev/null || echo "000 -"
}

sslip_rendben() {
  local ok=1 a b c
  a=$(valasz api.45-94-65-74.sslip.io /api/v1/health); b=$(valasz app.45-94-65-74.sslip.io /); c=$(valasz konyvelo.45-94-65-74.sslip.io /)
  echo "  api ${a%% *} · app ${b%% *} · konyvelo ${c%% *}"
  [ "${a%% *}" = 200 ] && [ "${b%% *}" = 200 ] && [ "${c%% *}" = 200 ] || ok=0
  [ $ok = 1 ]
}

ervenyes() { # $1 = a config folder (Caddyfile + sites/)
  docker run --rm --network none -v "$1:/etc/caddy:ro" "$IMG" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/kezjegy_proxy_validate.log 2>&1 \
    || { tail -5 /tmp/kezjegy_proxy_validate.log; return 1; }
}

frissit() { # validate the uploaded config, then swap FILES (never the mounted folder); old files → _regi
  [ -s "$SRC/caddy/Caddyfile" ] || hiba "nincs $SRC/caddy/Caddyfile (előbb feltolt.sh)"
  ervenyes "$SRC/caddy" || hiba "a feltöltött proxy-konfiguráció érvénytelen – semmi nem változott"
  mkdir -p "$P/caddy/sites"
  local n=0 rel
  while IFS= read -r -d '' f; do
    rel=${f#"$SRC/"}
    if [ -f "$P/$rel" ] && cmp -s "$f" "$P/$rel"; then continue; fi
    if [ -f "$P/$rel" ]; then mkdir -p "$REGI/proxy_$TS/$(dirname "$rel")"; cp -p "$P/$rel" "$REGI/proxy_$TS/$rel"; fi
    mkdir -p "$P/$(dirname "$rel")"
    cat "$f" > "$P/$rel.uj" && mv "$P/$rel.uj" "$P/$rel"
    n=$((n + 1))
  done < <(find "$SRC" -type f \( -name '*.caddy' -o -name 'Caddyfile' -o -name 'docker-compose.yml' \) -print0)
  # a site file that is no longer uploaded leaves the active folder (kept in _regi)
  for f in "$P"/caddy/sites/*.caddy; do
    [ -e "$f" ] || continue
    [ -e "$SRC/caddy/sites/$(basename "$f")" ] && continue
    mkdir -p "$REGI/proxy_$TS/caddy/sites"; mv "$f" "$REGI/proxy_$TS/caddy/sites/"; n=$((n + 1))
  done
  echo "proxy-konfiguráció: $n fájl frissítve ($P)"
  ervenyes "$P/caddy" || hiba "az aktív proxy-mappa érvénytelen lett – a régi fájlok: $REGI/proxy_$TS/"
}

case "$LEPES" in
  elokeszit)
    lepes "1. Előkészítés (a forgalomra nincs hatása)"
    frissit
    "${PDC[@]}" config -q && echo "compose: rendben"
    docker network inspect kezjegy_edge >/dev/null 2>&1 || hiba "nincs kezjegy_edge háló (a fő compose hozza létre: up.sh)"
    echo "kezjegy_edge: megvan"
    for h in "${ADOZZ[@]}"; do
      got=$(getent ahostsv4 "$h" | awk '{print $1}' | sort -u | tr '\n' ' ')
      echo "  DNS $h → $got"
      [ "$(echo "$got" | xargs)" = "$IP" ] || hiba "A DNS még nem ide mutat: $h"
    done
    if [ -d /srv/appok/deploy ]; then
      mkdir -p "$REGI/appok_elotte_$TS"
      cp -p /srv/appok/deploy/Caddyfile /srv/appok/deploy/docker-compose.yml "$REGI/appok_elotte_$TS/" 2>/dev/null || true
      echo "a régi proxy két fájlja elmentve: $REGI/appok_elotte_$TS/ (a .env-hez nem nyúltunk)"
    fi
    echo "KÉSZ: elokeszit"
    ;;

  tanusitvany)
    lepes "2. Tanúsítványok átmásolása (appok_caddy_data → kezjegy_caddy_data)"
    docker volume inspect kezjegy_caddy_data >/dev/null 2>&1 || docker volume create kezjegy_caddy_data >/dev/null
    docker volume inspect kezjegy_caddy_config >/dev/null 2>&1 || docker volume create kezjegy_caddy_config >/dev/null
    docker volume inspect appok_caddy_data >/dev/null 2>&1 || hiba "nincs appok_caddy_data kötet"
    van=$(docker run --rm -v kezjegy_caddy_data:/to:ro "$IMG" sh -c 'ls -A /to | wc -l')
    if [ "$van" != 0 ] && [ "${2:-}" != "--ujra" ]; then echo "kezjegy_caddy_data már nem üres – kihagyom (újra: tanusitvany --ujra)"; exit 0; fi
    docker run --rm -v appok_caddy_data:/from:ro -v kezjegy_caddy_data:/to "$IMG" sh -c 'cp -a /from/. /to/ && find /to -name "*.crt" | wc -l' | sed 's/^/tanúsítványfájlok: /'
    echo "KÉSZ: tanusitvany"
    ;;

  atall)
    lepes "3. Átállás (≈ 10–30 s kiesés) – hiba esetén automatikus visszaállítás"
    [ -s "$P/docker-compose.yml" ] || hiba "előbb: atallas.sh elokeszit"
    docker volume inspect kezjegy_caddy_data >/dev/null 2>&1 || hiba "előbb: atallas.sh tanusitvany"
    echo "előtte:"; sslip_rendben || echo "  (figyelem: már előtte sem volt minden 200)"
    visszaall() {
      echo "VISSZAÁLLÍTÁS…"
      "${PDC[@]}" stop >/dev/null 2>&1 || true
      "${PDC[@]}" rm -f >/dev/null 2>&1 || true
      docker start appok-caddy-1 >/dev/null
      sleep 5
      sslip_rendben || true
      echo "VISSZAÁLLÍTVA"
    }
    if fut appok-caddy-1; then docker stop appok-caddy-1 >/dev/null; echo "appok-caddy-1: leállítva (nem törölve)"; fi
    if ! "${PDC[@]}" up -d; then visszaall; hiba "a kezjegy-proxy nem indult"; fi
    ok=0
    for i in $(seq 1 30); do
      sleep 3
      if sslip_rendben; then ok=1; break; fi
    done
    if [ $ok != 1 ]; then docker logs kezjegy-proxy --tail 30 || true; visszaall; hiba "90 mp alatt nem lett minden cím 200"; fi
    echo "KÉSZ: atall – a kezjegy-proxy szolgál ki (80/443). Utána: atallas.sh adozz"
    ;;

  adozz)
    lepes "4. adozz.hu címek (tanúsítvány ≤ 3 perc)"
    fut kezjegy-proxy || hiba "a kezjegy-proxy nem fut (előbb: atall)"
    for i in $(seq 1 36); do
      a=$(valasz adozz.hu /)
      [ "${a%% *}" = 200 ] && break
      sleep 5
    done
    rossz=0
    ell() { # host path expected-code [expected-location]
      local r; r=$(valasz "$1" "$2"); echo "  https://$1$2 → $r"
      [ "${r%% *}" = "$3" ] || rossz=1
      if [ -n "${4:-}" ] && [ "${r#* }" != "$4" ]; then rossz=1; fi
    }
    ell adozz.hu / 200
    ell www.adozz.hu / 301 https://adozz.hu/
    ell app.adozz.hu / 200
    ell konyvelo.adozz.hu / 200
    ell api.adozz.hu /api/v1/health 200
    ell api.adozz.hu / 404
    for h in "${ADOZZ[@]}"; do
      iss=$(echo | timeout 10 openssl s_client -connect 127.0.0.1:443 -servername "$h" 2>/dev/null | openssl x509 -noout -issuer -enddate 2>/dev/null | tr '\n' ' ')
      echo "  tanúsítvány $h: $iss"
      echo "$iss" | grep -qi "Let's Encrypt" || rossz=1
    done
    if [ $rossz = 1 ]; then
      echo "FIGYELEM: egy adozz.hu cím még nem jó (a sslip-címek viszik a szolgáltatást, nincs visszaállítás). Proxy-napló:"
      docker logs kezjegy-proxy --tail 50 2>&1 | grep -v '"level":"info"' | tail -20 || true
      exit 1
    fi
    echo "KÉSZ: adozz – mind az öt név él. Utána: atallas.sh cimek"
    ;;

  visszaall)
    lepes "Kézi visszaállítás a régi proxyra"
    [ -n "$(docker ps -a --format '{{.Names}}' | grep -x appok-caddy-1)" ] || hiba "nincs appok-caddy-1 (a takarit után már nem lehet visszaállni)"
    "${PDC[@]}" stop >/dev/null 2>&1 || true
    "${PDC[@]}" rm -f >/dev/null 2>&1 || true
    docker start appok-caddy-1 >/dev/null
    sleep 5
    sslip_rendben || true
    echo "VISSZAÁLLÍTVA"
    ;;

  cimek)
    lepes "6. Nyilvános címek: /srv/kezjegy/nyilvanos.env (adozz.hu), API + worker újraindítva"
    for h in app.adozz.hu konyvelo.adozz.hu; do r=$(valasz "$h" /); [ "${r%% *}" = 200 ] || hiba "$h még nem 200 (előbb: adozz)"; done
    r=$(valasz api.adozz.hu /api/v1/health); [ "${r%% *}" = 200 ] || hiba "api.adozz.hu még nem 200"
    if [ -f $K/nyilvanos.env ]; then cp -p $K/nyilvanos.env "$REGI/nyilvanos.env_$TS"; fi
    cat > $K/nyilvanos.env.uj <<'EOF'
# SPEC §29.3.3 – PUBLIC values only (loaded after .env, the later file wins). Written by atallas.sh cimek.
APP_PUBLIC_URL=https://app.adozz.hu
PANEL_PUBLIC_URL=https://konyvelo.adozz.hu
API_PUBLIC_URL=https://api.adozz.hu
LANDING_PUBLIC_URL=https://adozz.hu
EXTRA_PUBLIC_ORIGINS=https://app.45-94-65-74.sslip.io,https://konyvelo.45-94-65-74.sslip.io,https://api.45-94-65-74.sslip.io
EOF
    chmod 644 $K/nyilvanos.env.uj && mv $K/nyilvanos.env.uj $K/nyilvanos.env
    docker compose --env-file $K/.env -f $K/deploy/docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker
    for i in $(seq 1 40); do st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none); [ "$st" = healthy ] && break; sleep 3; done
    echo "kezjegy-api: $st"
    [ "$st" = healthy ] || hiba "az API nem lett egészséges – a régi nyilvanos.env: $REGI/nyilvanos.env_$TS (vagy töröld a mostanit és indítsd újra)"
    for h in api.adozz.hu api.45-94-65-74.sslip.io app.adozz.hu app.45-94-65-74.sslip.io; do echo "  https://$h/api/v1/health → $(valasz $h /api/v1/health)"; done
    cfgok=$(curl -sS --max-time 10 --resolve app.adozz.hu:443:127.0.0.1 https://app.adozz.hu/api/v1/config | grep -c '"paymentProvider"' || true)
    echo "  app.adozz.hu /api/v1/config: $([ "$cfgok" = 1 ] && echo rendben || echo HIBA)"
    echo "KÉSZ: cimek. Az e-mailek és a push-linkek mostantól adozz.hu-ra mutatnak (DEMO postafiókban ellenőrizhető)."
    ;;

  takarit)
    lepes "7. Takarítás (a tulaj jóváhagyta 11-20): a Gardoko maradékai"
    fut kezjegy-proxy || hiba "a kezjegy-proxy nem fut"
    indult=$(docker inspect -f '{{.State.StartedAt}}' kezjegy-proxy)
    kor=$(( $(date +%s) - $(date -d "$indult" +%s) ))
    [ $kor -ge 3600 ] || hiba "a kezjegy-proxy még csak $((kor / 60)) perce fut – legalább 60 perc tiszta napló kell"
    hibak=$(docker logs --since 1h kezjegy-proxy 2>&1 | grep -c '"level":"error"' || true)
    echo "proxy-napló, utolsó óra: $hibak hibasor"
    docker logs --since 1h kezjegy-proxy 2>&1 | grep '"level":"error"' | tail -5 || true
    sslip_rendben || hiba "nem minden sslip-cím 200 – nem takarítok"
    [ "${2:-}" = TAKARIT ] || hiba "megerősítés kell: atallas.sh takarit TAKARIT"
    # k7 integrator: the least destructive form – the stopped container and the two networks hold no data and go;
    # /srv/appok (old Caddyfile, compose, Gardoko .env) is MOVED into _regi (house rule: nothing is deleted); the two
    # appok_caddy_* volumes and the old Gardoko image stay and are listed – the owner removes them himself if he wants
    # (docker volume rm appok_caddy_data appok_caddy_config; docker image rm appok/garden-api:latest).
    if [ -n "$(docker ps -a --format '{{.Names}}' | grep -x appok-caddy-1)" ]; then docker rm appok-caddy-1 >/dev/null && echo "appok-caddy-1: eltávolítva (leállított konténer, adat nem volt benne)"; fi
    for n in appok_edge appok_internal; do if docker network inspect "$n" >/dev/null 2>&1; then docker network rm "$n" >/dev/null && echo "háló eltávolítva: $n"; fi; done
    if [ -d /srv/appok ]; then
      mv /srv/appok "$REGI/appok_gardoko_$TS" && chmod 700 "$REGI/appok_gardoko_$TS" && echo "/srv/appok → $REGI/appok_gardoko_$TS (áthelyezve, 700)"
    fi
    echo "Megmaradt (a tulaj törölheti): kötetek $(docker volume ls --format '{{.Name}}' | grep -E '^appok_' | tr '\n' ' ')· kép $(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^appok/' | tr '\n' ' ')"
    if [ -d $K/caddy ]; then mv $K/caddy "$REGI/caddy_elotte_k7_$TS"; echo "$K/caddy → $REGI/caddy_elotte_k7_$TS (a miénk: áthelyezve, nem törölve)"; fi
    if grep -q '/srv/appok' $K/deploy/up.sh; then echo "FIGYELEM: az up.sh még hivatkozik a /srv/appok-ra"; else echo "up.sh: nincs /srv/appok hivatkozás"; fi
    echo "Nem nyúltam: pgtest_net, pgtest_nm hálók és a névtelen kötet (nem része a jóváhagyásnak) – a tulajnak listázva:"
    docker network ls --format '{{.Name}}' | grep -E '^pgtest' || true
    sslip_rendben || hiba "takarítás után nem minden cím 200!"
    echo "KÉSZ: takarit"
    ;;

  frissit)
    lepes "Proxy-konfiguráció frissítése (validálás → fájlcsere → reload)"
    frissit
    if fut kezjegy-proxy; then docker exec kezjegy-proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile && echo "kezjegy-proxy: újratöltve"; else echo "a kezjegy-proxy nem fut (még nincs átállás) – csak a fájlok frissültek"; fi
    ;;

  allapot)
    lepes "Állapot"
    docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E 'caddy|proxy|kezjegy' || true
    for h in "${SSLIP[@]}" "${ADOZZ[@]}"; do p=/; [ "${h#api.}" != "$h" ] && p=/api/v1/health; echo "  https://$h$p → $(valasz "$h" "$p")"; done
    ;;

  *)
    sed -n '2,15p' "$0"
    exit 2
    ;;
esac
