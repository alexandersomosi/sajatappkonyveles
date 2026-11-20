# Adózz - a Stripe bekapcsolása a szerveren (appok-1, /srv/kezjegy/.env). SPEC §29.11.1.
# A TULAJ futtatja ezen a gépen (UpgradePC), PowerShellben, MIUTÁN az adozz.hu átállás kész (https://api.adozz.hu él):
#   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\stripe_szerverre.ps1           # TESZT mód
#   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\stripe_szerverre.ps1 -Vissza   # vissza DEMO fizetésre
#   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\stripe_szerverre.ps1 -Eles     # ÉLES (csak élesítéskor)
# Mit csinál (TESZT): a gépen elmentett Stripe TESZT-kulcsokat (stripe_teszt_kulcs.ps1) beolvassa, a Stripe-nál
# létrehozza a webhook-végpontot (https://api.adozz.hu/api/v1/webhooks/stripe; a régit ugyanerre a címre törli, mert a
# titkot a Stripe csak létrehozáskor adja ki), és a három értéket + PAYMENT_PROVIDER=stripe a szerver .env-jébe írja
# (a régi .env előbb a /srv/kezjegy/_regi mappába kerül), majd újraindítja az API-t és a workert.
# Semmilyen kulcs, titok vagy azonosító nem jelenik meg a képernyőn: lépésenként csak OK vagy NEM OK.
param([switch]$Vissza, [switch]$Eles)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# A backend rögzített Stripe API-verziója (kod/shared/src/k29.ts STRIPE_API_VERSION = a stripe SDK alapértéke).
# Egy backend-teszt ellenőrzi, hogy a kettő egyezik (test/k29-payments.test.ts).
$StripeApiVersion = '2026-10-28.endive'
$WebhookUrl = 'https://api.adozz.hu/api/v1/webhooks/stripe'
# SPEC §29.1.8 - csak ezekre iratkozunk fel (kod/shared/src/k29.ts STRIPE_WEBHOOK_EVENTS)
$Esemenyek = @(
  'checkout.session.completed',
  'checkout.session.expired',
  'setup_intent.succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'payment_method.automatically_updated'
)

function Lepes([string]$nev, [bool]$ok) {
  if ($ok) { Write-Host "OK: $nev" -ForegroundColor Green } else { Write-Host "NEM OK: $nev" -ForegroundColor Red }
}

function Titkos([string]$kerdes) {
  $s = Read-Host $kerdes -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

# A szerveren: régi .env mentése, a megadott sorok cseréje vagy hozzáadása, API + worker újraindítása.
# Az értékek base64-ben mennek a szkriptbe (sehol nem jelennek meg); a szkript a bemeneten megy a szerverre.
function Szerverre([string[]]$sorok) {
  $tavoli = @'
: 2>/dev/null
set -e
cd /srv/kezjegy
mkdir -p _regi
cp -p .env "_regi/env_elotte_stripe_$(date +%Y%m%d_%H%M%S)"
umask 077
uj=$(mktemp)
echo '__ERTEKEK__' | base64 -d > "$uj"
python3 - "$uj" <<'PY'
import sys
uj = dict(l.split('=', 1) for l in open(sys.argv[1], encoding='utf-8').read().splitlines() if '=' in l)
sorok = open('.env', encoding='utf-8').read().splitlines()
kesz = set()
for i, l in enumerate(sorok):
    k = l.split('=', 1)[0]
    if k in uj:
        sorok[i] = k + '=' + uj[k]
        kesz.add(k)
sorok += [k + '=' + v for k, v in uj.items() if k not in kesz]
open('.env', 'w', encoding='utf-8').write('\n'.join(sorok) + '\n')
PY
rm -f "$uj"
chmod 600 .env
cd /srv/kezjegy/deploy
docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1
for i in $(seq 1 40); do
  st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 3
done
if [ "$st" = healthy ]; then echo 'SZERVER_OK'; else echo 'SZERVER_NEM_OK'; fi
exit 0
'@
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($sorok -join "`n") + "`n"))
  $tavoli = $tavoli.Replace('__ERTEKEK__', $b64) -replace "`r", ''
  $OutputEncoding = [Text.Encoding]::ASCII
  $ki = $tavoli | ssh appok-1 'bash -s'
  return ($ki -match 'SZERVER_OK')
}

function Config-Ellenorzes([string]$varMod) {
  try {
    $c = Invoke-RestMethod -Uri 'https://api.adozz.hu/api/v1/config' -Method Get -TimeoutSec 20
    return ($c.paymentProvider -eq 'stripe' -and $c.paymentMode -eq $varMod)
  } catch { return $false }
}

# ---------- -Vissza: csak PAYMENT_PROVIDER=demo (a kulcsok maradnak) ----------
if ($Vissza) {
  $ok = Szerverre @('PAYMENT_PROVIDER=demo')
  Lepes 'PAYMENT_PROVIDER=demo a szerveren, API + worker újraindítva' $ok
  if ($ok) { Write-Host 'Kész: a szerver ismét DEMO fizetéssel fut.' -ForegroundColor Green }
  exit 0
}

# ---------- 1. kulcsok ----------
if ($Eles) {
  Write-Host 'ÉLES Stripe-kulcsok (Stripe Dashboard > Developers > API keys, ÉLES mód). Nem látszanak, nem mentjük a gépen.' -ForegroundColor Yellow
  $sk = Titkos 'Titkos kulcs (sk_live_...)'
  $pk = (Read-Host 'Közzétehető kulcs (pk_live_...)').Trim()
  if ($sk -notlike 'sk_live_*' -and $sk -notlike 'rk_live_*') { Write-Host 'Ez nem éles titkos kulcs. Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
  if ($pk -notlike 'pk_live_*') { Write-Host 'Ez nem éles közzétehető kulcs. Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
  $mod = 'live'
  $leiras = 'Adózz API (éles)'
} else {
  $sk = [Environment]::GetEnvironmentVariable('STRIPE_TEST_SECRET_KEY', 'User')
  $pk = [Environment]::GetEnvironmentVariable('STRIPE_TEST_PUBLISHABLE_KEY', 'User')
  if (-not $sk -or -not $pk -or ($sk -notlike 'sk_test_*' -and $sk -notlike 'rk_test_*') -or $pk -notlike 'pk_test_*') {
    Write-Host 'Ez nem teszt-kulcs (vagy nincs elmentve: stripe_teszt_kulcs.ps1). Nem változtattam semmit.' -ForegroundColor Red; exit 1
  }
  $mod = 'test'
  $leiras = 'Adózz API (teszt)'
}
Lepes 'kulcsok beolvasva' $true

# ---------- 2. az api.adozz.hu él? ----------
try { $h = Invoke-WebRequest -Uri 'https://api.adozz.hu/api/v1/health' -UseBasicParsing -TimeoutSec 20; $elo = ($h.StatusCode -eq 200) } catch { $elo = $false }
Lepes 'https://api.adozz.hu él' $elo
if (-not $elo) { Write-Host 'Az api.adozz.hu még nem él – előbb a domain-átállás kell (kod/deploy/proxy/atallas.sh).' -ForegroundColor Red; exit 1 }

# Élesben csak APP_ENV=production szerverre (az értéket nem írjuk ki, csak igen/nem).
if ($Eles) {
  $env_ok = ("grep -qx 'APP_ENV=production' /srv/kezjegy/.env && echo IGEN || echo NEM" | ssh appok-1 'bash -s') -match 'IGEN'
  Lepes 'a szerver éles módban fut (APP_ENV=production)' $env_ok
  if (-not $env_ok) { Write-Host 'Előbb: új, üres adatbázis + kezjegy_kulcsok.ps1 APP_ENV=production (kod/deploy/README.md Élesítés).' -ForegroundColor Red; exit 1 }
}

# ---------- 3. webhook-végpont a Stripe-nál ----------
$fej = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($sk + ':')); 'Stripe-Version' = $StripeApiVersion }
try {
  $lista = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/webhook_endpoints?limit=100' -Headers $fej -Method Get -TimeoutSec 30
  foreach ($w in $lista.data) {
    if ($w.url -eq $WebhookUrl) { $null = Invoke-RestMethod -Uri ('https://api.stripe.com/v1/webhook_endpoints/' + $w.id) -Headers $fej -Method Delete -TimeoutSec 30 }
  }
  $test = 'url=' + [uri]::EscapeDataString($WebhookUrl)
  foreach ($e in $Esemenyek) { $test += '&enabled_events[]=' + [uri]::EscapeDataString($e) }
  $test += '&api_version=' + [uri]::EscapeDataString($StripeApiVersion) + '&description=' + [uri]::EscapeDataString($leiras)
  $uj = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/webhook_endpoints' -Headers $fej -Method Post -Body $test -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 30
  $whsec = $uj.secret
  $whOk = ($whsec -like 'whsec_*')
} catch { $whOk = $false }
Lepes 'webhook-végpont létrehozva a Stripe-nál' $whOk
if (-not $whOk) { Write-Host 'A Stripe nem hozta létre a webhookot. Nem változtattam semmit a szerveren.' -ForegroundColor Red; exit 1 }

# ---------- 4. a szerver .env-je ----------
$ok = Szerverre @("STRIPE_SECRET_KEY=$sk", "STRIPE_PUBLISHABLE_KEY=$pk", "STRIPE_WEBHOOK_SECRET=$whsec", 'PAYMENT_PROVIDER=stripe')
$sk = $null; $whsec = $null
Lepes 'kulcsok a szerver .env-jében, API + worker újraindítva' $ok
if (-not $ok) { Write-Host 'Az API nem lett egészséges. Visszaállítás: stripe_szerverre.ps1 -Vissza, majd ssh appok-1 "docker logs kezjegy-api --tail 30".' -ForegroundColor Red; exit 1 }

# ---------- 5. ellenőrzés ----------
$cfgOk = Config-Ellenorzes $mod
Lepes "a szerver Stripe $(if ($Eles) { 'ÉLES' } else { 'TESZT' }) módban válaszol (/api/v1/config)" $cfgOk
if ($cfgOk) {
  if ($Eles) { Write-Host 'Kész: a szerver Stripe ÉLES módban fizet.' -ForegroundColor Green } else { Write-Host 'Kész: a szerver Stripe TESZT módban fizet.' -ForegroundColor Green }
}
