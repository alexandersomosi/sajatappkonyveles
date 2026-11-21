# Hirdetési mérés (Meta Pixel + Conversions API, Google Ads címke + Data Manager API) kulcsainak felvitele a szerverre
# (appok-1, /srv/kezjegy/.env) – SPEC §31.6, kod/MARKETING.md. A tulaj futtatja, amikor a Metánál és a Google-nél már
# létrehozta, ami kell (a lépések a MARKETING.md-ben). Claude NEM futtatja.
#
# Mit csinál:
#  - a titkos kulcsot (Meta Conversions API token) és a Google szolgáltatásfiók JSON-fájlját gépelés / megjelenítés
#    nélkül kéri be; a nyilvános azonosítókat (pixel, AW-címke, ügyfél- és konverzió-azonosító) is csak beolvassa;
#  - a gépen (HKCU, a felhasználói környezeti változók között) megőrizheti őket, hogy újrafuttatáskor ne kelljen újra beírni;
#  - a szerveren előbb lementi a .env-et (_regi/env_<idő>), utána írja át, 600-as jogokkal; a Google-kulcsot a
#    /srv/kezjegy/hirdetes/google.json fájlba teszi (600), és újraindítja az API-t és a workert;
#  - ha az API nem indul el egészségesen, VISSZAÁLLÍTJA a régi .env-et;
#  - a képernyőn soha nem jelenik meg kulcs, csak a beállított kulcsok NEVE.
# A mérést (ADS_TRACKING_ENABLED=true) csak akkor kapcsolja be, ha a végén igennel válaszolsz – ezt csak az ügyvéd
# jóváhagyása és a süti-ablakos nyitóoldal élesítése után tedd (MARKETING.md). Kikapcsolás bármikor: -Kikapcsol.
#
# Futtatás:   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\hirdetes_kulcsok.ps1
# Kikapcsolás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\hirdetes_kulcsok.ps1 -Kikapcsol
param([switch]$Kikapcsol)
$ErrorActionPreference = 'Stop'

function Titkos($kerdes) {
  $s = Read-Host $kerdes -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
function Gepen($nev) { return [Environment]::GetEnvironmentVariable($nev, 'User') }
function Kerdez($nev, $kerdes, $minta, $hiba) {
  $v = Gepen $nev
  if ($v) { Write-Host "  $kerdes – a gépről (HKCU)." -ForegroundColor DarkGray; return $v }
  $v = (Read-Host $kerdes).Trim()
  if ($v -and $minta -and ($v -notmatch $minta)) { Write-Host $hiba -ForegroundColor Red; exit 1 }
  return $v
}
function Igen($kerdes) { return ((Read-Host "$kerdes (i/n)").Trim().ToLower() -eq 'i') }

$e = [ordered]@{}
$googleJson = $null

if ($Kikapcsol) {
  $e['ADS_TRACKING_ENABLED'] = 'false'
} else {
  Write-Host ''
  Write-Host 'Hirdetési mérés kulcsai – amit nem használsz, arra csak nyomj Entert.' -ForegroundColor Cyan
  Write-Host 'META (Events Manager > adatkészlet/pixel > Beállítások):' -ForegroundColor Cyan
  $pixel = Kerdez 'ADOZZ_META_PIXEL_ID' 'Meta pixel (adatkészlet) azonosító – csak számjegyek' '^\d{6,20}$' 'A pixel azonosítója csak számjegyekből áll. Nem változtattam semmit.'
  $capi = $null
  if ($pixel) {
    $capi = Gepen 'ADOZZ_META_CAPI_TOKEN'
    if ($capi) { Write-Host '  Conversions API token – a gépről (HKCU).' -ForegroundColor DarkGray }
    else { $capi = Titkos 'Conversions API hozzáférési token (nem látszik; jobb klikk + Enter)' }
    if ($capi -and ($capi -notmatch '^[A-Za-z0-9_-]{20,512}$')) { Write-Host 'A token formátuma nem jó (szóköz vagy hiányos másolás?). Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
    $teszt = (Read-Host 'Test Events kód (csak a próbához; élesben üresen hagyd)').Trim()
    if ($teszt -and ($teszt -notmatch '^[A-Za-z0-9]{3,40}$')) { Write-Host 'A tesztkód csak betű és szám lehet. Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
    $e['META_PIXEL_ID'] = $pixel
    $e['META_CAPI_TOKEN'] = $capi
    $e['META_TEST_EVENT_CODE'] = $teszt
  }

  Write-Host ''
  Write-Host 'GOOGLE ADS (Eszközök > Konverziók; Beállítás > Hozzáférés és biztonság):' -ForegroundColor Cyan
  $tag = Kerdez 'ADOZZ_GOOGLE_TAG_ID' 'Google Ads címke (AW-123456789)' '^AW-\d{6,15}$' 'A címke AW- kezdetű. Nem változtattam semmit.'
  if ($tag) {
    $ugyfel = Kerdez 'ADOZZ_GOOGLE_ADS_CUSTOMER_ID' 'Google Ads ügyfél-azonosító (123-456-7890)' '^\d{3}-?\d{3}-?\d{4}$' 'Az ügyfél-azonosító 10 számjegy. Nem változtattam semmit.'
    $kezelo = Kerdez 'ADOZZ_GOOGLE_ADS_LOGIN_CUSTOMER_ID' 'Kezelői (MCC) fiók azonosítója, ha azon keresztül kezeled (különben Enter)' '^\d{3}-?\d{3}-?\d{4}$' 'Az azonosító 10 számjegy. Nem változtattam semmit.'
    $kreg = Kerdez 'ADOZZ_GOOGLE_CONVERSION_REGISTRATION' 'A „Regisztráció” konverziós művelet azonosítója (szám)' '^\d{1,20}$' 'A konverzió azonosítója csak számjegy. Nem változtattam semmit.'
    $kfiz = Kerdez 'ADOZZ_GOOGLE_CONVERSION_PAYMENT' 'Az „Első fizetés” konverziós művelet azonosítója (szám)' '^\d{1,20}$' 'A konverzió azonosítója csak számjegy. Nem változtattam semmit.'
    $ut = (Read-Host 'A letöltött szolgáltatásfiók-kulcs (JSON) helye a gépen (Enter = most nem)').Trim().Trim('"')
    if ($ut) {
      if (-not (Test-Path -LiteralPath $ut)) { Write-Host 'Nem találom ezt a fájlt. Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
      $googleJson = [IO.File]::ReadAllText($ut, [Text.Encoding]::UTF8)
      try { $j = $googleJson | ConvertFrom-Json } catch { Write-Host 'Ez nem JSON-fájl. Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
      if (-not $j.client_email -or -not $j.private_key) { Write-Host 'Ebben a fájlban nincs szolgáltatásfiók-kulcs (client_email, private_key). Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
      $j = $null
      $e['GOOGLE_SERVICE_ACCOUNT_FILE'] = '/run/hirdetes/google.json'
    }
    $e['GOOGLE_TAG_ID'] = $tag
    $e['GOOGLE_ADS_CUSTOMER_ID'] = ($ugyfel -replace '-', '')
    $e['GOOGLE_ADS_LOGIN_CUSTOMER_ID'] = ($kezelo -replace '-', '')
    $e['GOOGLE_CONVERSION_REGISTRATION'] = $kreg
    $e['GOOGLE_CONVERSION_PAYMENT'] = $kfiz
  }

  if (-not $e.Count) { Write-Host 'Nem adtál meg semmit. Nem változtattam semmit.' -ForegroundColor Yellow; exit 0 }

  if (Igen 'Elmentsem a gépre is (HKCU), hogy legközelebb ne kelljen beírni?') {
    $mentes = @{ 'ADOZZ_META_PIXEL_ID' = $pixel; 'ADOZZ_META_CAPI_TOKEN' = $capi; 'ADOZZ_GOOGLE_TAG_ID' = $tag; 'ADOZZ_GOOGLE_ADS_CUSTOMER_ID' = $e['GOOGLE_ADS_CUSTOMER_ID']; 'ADOZZ_GOOGLE_ADS_LOGIN_CUSTOMER_ID' = $e['GOOGLE_ADS_LOGIN_CUSTOMER_ID']; 'ADOZZ_GOOGLE_CONVERSION_REGISTRATION' = $e['GOOGLE_CONVERSION_REGISTRATION']; 'ADOZZ_GOOGLE_CONVERSION_PAYMENT' = $e['GOOGLE_CONVERSION_PAYMENT'] }
    foreach ($k in $mentes.Keys) { if ($mentes[$k]) { [Environment]::SetEnvironmentVariable($k, $mentes[$k], 'User') } }
    Write-Host '  Elmentve a gépre (a Google JSON-fájlt nem: az a saját helyén marad).' -ForegroundColor DarkGray
  }
  $capi = $null

  Write-Host ''
  Write-Host 'A mérés BEKAPCSOLÁSA csak az ügyvéd jóváhagyása és a süti-ablakos nyitóoldal élesítése után (MARKETING.md)!' -ForegroundColor Yellow
  if (Igen 'Bekapcsoljam most a hirdetési mérést (ADS_TRACKING_ENABLED=true)?') { $e['ADS_TRACKING_ENABLED'] = 'true' }
  else {
    # a "nem" mindig kikapcsolt állapotot ír (akkor is, ha korábban be volt kapcsolva)
    $e['ADS_TRACKING_ENABLED'] = 'false'
    Write-Host '  A kulcsok felkerülnek, a mérés KIKAPCSOLVA marad.' -ForegroundColor DarkGray
  }
}

$sorok = ($e.Keys | ForEach-Object { "$_=$($e[$_])" }) -join "`n"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sorok + "`n")); $e = $null; $sorok = $null
$g64 = if ($googleJson) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($googleJson)) } else { '' }
$googleJson = $null

$tavoli = @'
set -e
cd /srv/kezjegy
mkdir -p _regi hirdetes
chmod 700 hirdetes
umask 077
uj=$(mktemp)
echo '__ERTEKEK__' | base64 -d > "$uj"
TS=$(date +%Y%m%d_%H%M%S)
cp -p .env "_regi/env_$TS"
if [ -n '__GOOGLE__' ]; then
  if [ -f hirdetes/google.json ]; then mv hirdetes/google.json "_regi/google_json_$TS"; fi
  echo '__GOOGLE__' | base64 -d > hirdetes/google.json
  chmod 600 hirdetes/google.json
fi
python3 - .env "$uj" <<'PY'
import sys
uj = dict(l.split('=', 1) for l in open(sys.argv[2], encoding='utf-8').read().splitlines() if '=' in l)
sorok = open(sys.argv[1], encoding='utf-8').read().splitlines()
kesz = set()
for i, l in enumerate(sorok):
    k = l.split('=', 1)[0]
    if k in uj:
        sorok[i] = k + '=' + uj[k]; kesz.add(k)
sorok += [k + '=' + v for k, v in uj.items() if k not in kesz]
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(sorok) + '\n')
print('Set:', ', '.join(sorted(uj)))
PY
chmod 600 .env
rm -f "$uj"
cd /srv/kezjegy/deploy
DC="docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml"
# a hibás indulás se hagyja ki a visszaállítást (set -e mellett is)
$DC up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1 || true
st=none
for i in $(seq 1 40); do st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none); [ "$st" = healthy ] && break; sleep 3; done
if [ "$st" = healthy ]; then
  echo 'API restarted: OK'
  docker exec kezjegy-api node -e "fetch('http://localhost:8080/api/v1/public/marketing-config').then(r=>r.json()).then(j=>console.log('ad measurement: ' + (j.ads ? 'ON' : 'off')))" 2>/dev/null || true
else
  echo "API NOT healthy ($st) - restoring the previous .env"
  cp -p "/srv/kezjegy/_regi/env_$TS" /srv/kezjegy/.env
  chmod 600 /srv/kezjegy/.env
  $DC up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1 || true
  echo "Restored from /srv/kezjegy/_regi/env_$TS (nothing else changed)"
fi
'@
$tavoli = $tavoli.Replace('__ERTEKEK__', $b64).Replace('__GOOGLE__', $g64) -replace "`r", ''
$b64 = $null; $g64 = $null
$OutputEncoding = [Text.Encoding]::ASCII
$tavoli | ssh appok-1 'bash -s'
$tavoli = $null
Write-Host ''
Write-Host 'Kész. Ezt az ablakot bezárhatod – Claude ellenőrzi a többit.' -ForegroundColor Green
