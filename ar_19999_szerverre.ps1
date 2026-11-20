# Adózz - a szerver .env-jében a tartalék havidíj (PLAN_PRICE_HUF) 20000 -> 19999 (k7c2, 2026-11-20).
# A TULAJ futtatja ezen a gépen (UpgradePC), PowerShellben:
#   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\ar_19999_szerverre.ps1
# Mit csinál: a szerveren a régi .env a /srv/kezjegy/_regi/ mappába kerül, utána CSAK a PLAN_PRICE_HUF sor változik
# (más sort nem olvas és nem ír ki), az API és a worker újraindul, végül a /config és az ÁSZF árát nézi meg.
# Az app, az ÁSZF és a szerződés a k7c2 óta már a Díjak beállításból (19 999 Ft) veszi az árat; ez a sor csak tartalék
# (például egy későbbi áremelés 30 napos várakozási ideje alatt ezt az összeget vonjuk le).
$ErrorActionPreference = 'Stop'

$tavoli = @'
set -e
cd /srv/kezjegy
mkdir -p _regi
umask 077
TS=$(date +%Y%m%d_%H%M%S)
cp -p .env "_regi/env_elotte_ar19999_$TS"
if grep -q '^PLAN_PRICE_HUF=' .env; then
  sed -i 's/^PLAN_PRICE_HUF=.*/PLAN_PRICE_HUF=19999/' .env
else
  echo 'PLAN_PRICE_HUF=19999' >> .env
fi
chmod 600 .env
cd /srv/kezjegy/deploy
docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1
for i in $(seq 1 40); do
  st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 3
done
echo "API: $st"
'@
$tavoli = $tavoli -replace "`r", ''
$OutputEncoding = [Text.Encoding]::ASCII
$tavoli | ssh appok-1 'bash -s'

$cfg = Invoke-RestMethod -Uri 'https://api.adozz.hu/api/v1/config' -UseBasicParsing
$aszf = Invoke-RestMethod -Uri 'https://api.adozz.hu/api/v1/legal/aszf' -UseBasicParsing
$ok1 = $cfg.brand.priceHufMonthlyGross -eq 19999
$ok2 = ($aszf.markdown -match '19 999') -and -not ($aszf.markdown -match '20 000 Ft')
if ($ok1) { Write-Host 'OK: /config 19 999 Ft' -ForegroundColor Green } else { Write-Host "NEM OK: /config $($cfg.brand.priceHufMonthlyGross)" -ForegroundColor Red }
if ($ok2) { Write-Host 'OK: ÁSZF 19 999 Ft' -ForegroundColor Green } else { Write-Host 'NEM OK: az ÁSZF-ben nem 19 999 Ft áll' -ForegroundColor Red }
