#!/usr/bin/env bash
# CSAK A LANDING (adozz.hu) cseréje – az app, a panel, az API, a worker, az adatbázisok, az Umami és a proxy érintetlen.
# Első használat: 2026-11-21 10:48 (az új értékesítő oldal élesítése). A gépen (Git Bash), a kod mappából:
#   node landing/build.mjs && node --test landing/meres.test.mjs
#   (cd landing/dist && find . -type f | sort | sed "s#^\./##" | xargs -d "\n" sha256sum) > /tmp/kj_landing_manifest.sha256
#   tar --force-local -C landing/dist -czf /tmp/kj_landing.tar.gz .
#   scp -q /tmp/kj_landing.tar.gz /tmp/kj_landing_manifest.sha256 appok-1:/tmp/
#   ssh appok-1 "bash -s" < deploy/landing-csere.sh
# A szerveren: az élő mappa MÁSOLATA _regi/landing_elotte_<idő>, az új mappa a régi mellé, hash- és e-mail-logó-ellenőrzés,
# csere (a régi mappa _regi/web_landing_<idő>), majd CSAK a kezjegy-web újralétrehozása (bind mount; ~1 mp kiesés az app/panel
# statikus fájljainál is). Semmit nem töröl.
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
cd /srv/kezjegy
mkdir -p _regi
[ -s /tmp/kj_landing.tar.gz ] && [ -s /tmp/kj_landing_manifest.sha256 ] || { echo "HIBA: hiányzik a feltöltött csomag"; exit 1; }

# 1. copy of the live landing (as it is now)
cp -a web/landing "_regi/landing_elotte_$TS"
diff -r web/landing "_regi/landing_elotte_$TS" >/dev/null || { echo "HIBA: a mentés eltér"; exit 1; }
echo "MENTÉS: _regi/landing_elotte_$TS ($(du -sh "_regi/landing_elotte_$TS" | cut -f1), azonos az élővel)"

# 2. the new folder beside the live one, checked
UJ="web/.landing_uj_$TS"
mkdir "$UJ"
tar -C "$UJ" -xzf /tmp/kj_landing.tar.gz
find "$UJ" -type d -exec chmod 755 {} +
find "$UJ" -type f -exec chmod 644 {} +
(cd "$UJ" && sha256sum -c --quiet /tmp/kj_landing_manifest.sha256) || { echo "HIBA: hash-eltérés"; exit 1; }
echo "ELLENŐRZÉS: mind a $(wc -l < /tmp/kj_landing_manifest.sha256) fájl hash-e egyezik"
n=$(find "$UJ" -type f | wc -l); [ "$n" = "$(wc -l < /tmp/kj_landing_manifest.sha256)" ] || { echo "HIBA: fájlszám $n"; exit 1; }
for f in index.html stilus.css js/meres.js js/mozgas.js email/logo_feher@2x.png email/logo_alairas@2x.png favicon.png; do
  test -s "$UJ/$f" || { echo "HIBA: hiányzik $f"; exit 1; }
done
# the e-mail logos the sent mails and the owner's signature point to: byte for byte the live ones
for f in logo_feher@2x.png logo_alairas@2x.png; do cmp -s "$UJ/email/$f" "web/landing/email/$f" || { echo "HIBA: az email/$f eltér az élőtől"; exit 1; }; done
echo "E-MAIL-LOGÓK: bájtra azonosak az élővel"

# 3. swap (the old folder is moved, nothing deleted) and recreate only kezjegy-web
mv web/landing "_regi/web_landing_$TS"
mv "$UJ" web/landing
mv /tmp/kj_landing.tar.gz "_regi/landing_feltoltes_$TS.tar.gz"
mv /tmp/kj_landing_manifest.sha256 "_regi/landing_feltoltes_$TS.sha256"
cd deploy
docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --no-deps --force-recreate kezjegy-web
sleep 2
lk=$(sha256sum /srv/kezjegy/web/landing/index.html | cut -d' ' -f1)
lb=$(docker exec kezjegy-web sha256sum /srv/landing/index.html | cut -d' ' -f1)
[ "$lk" = "$lb" ] && echo "KEZJEGY-WEB: az új landing él ($lb)" || echo "FIGYELEM: a konténer nem az új index.html-t látja"
docker exec kezjegy-web test -s /srv/landing/email/logo_feher@2x.png && docker exec kezjegy-web test -s /srv/landing/email/logo_alairas@2x.png && echo "KEZJEGY-WEB: e-mail-logók megvannak"
ak=$(sha256sum /srv/kezjegy/web/app/index.html | cut -d' ' -f1); ab=$(docker exec kezjegy-web sha256sum /srv/app/index.html | cut -d' ' -f1)
[ "$ak" = "$ab" ] && echo "KEZJEGY-WEB: az app ugyanazt a mappát szolgálja (változatlan)"
docker ps --filter name=kezjegy-web --format '{{.Names}} {{.Status}}'
echo "TS=$TS"
