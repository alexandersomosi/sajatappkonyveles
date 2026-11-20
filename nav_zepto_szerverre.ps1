# NAV adószám-kereső technikai felhasználó + ZeptoMail SMTP feltöltése a szerverre (appok-1, /srv/kezjegy/.env) – 11-20.
# A tulaj kérte ("tedd fel nekem"). A NAV-adatokat a gépről veszi (HKCU, a nav_kulcs_mentes.ps1 mentette, kipróbálva);
# a ZeptoMail jelszót ("Kennwort 1" a Zohóban) egyszer kéri, gépelés közben nem látszik. Semmi nem jelenik meg a képernyőn.
# FONTOS: a szerveren most DEMO adatok vannak (nem létező @demo.kezjegy.test címek) -> MAIL_MODE=demo marad: a beállítás
# fent van, de levél csak élesítéskor (APP_ENV=production) megy ki – így a ZeptoMail-fiók nem kap visszapattanó leveleket.
# A NAV_MODE-ot (az ügyfelek számláinak lekérése) NEM állítja: az élesítéskor vált prodra.
# Futtatás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\nav_zepto_szerverre.ps1
$ErrorActionPreference = 'Stop'
function Titkos($kerdes) {
  $s = Read-Host $kerdes -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
$e = [ordered]@{}
foreach ($n in 'NAV_LOOKUP_MODE','NAV_LOOKUP_TAX_NUMBER','NAV_LOOKUP_LOGIN','NAV_LOOKUP_PASSWORD','NAV_LOOKUP_SIGN_KEY','NAV_LOOKUP_EXCHANGE_KEY') {
  $v = [Environment]::GetEnvironmentVariable($n, 'User'); if (-not $v) { Write-Host "Hiányzik a gépről: $n (futtasd a nav_kulcs_mentes.ps1-et). Nem változtattam semmit." -ForegroundColor Red; exit 1 }; $e[$n] = $v
}
$e['NAV_SOFTWARE_ID'] = 'HU32769678ADOZZ001'; $e['NAV_SOFTWARE_VERSION'] = '1.0.0'; $e['NAV_DEV_NAME'] = 'Somosi Kft.'
$e['NAV_DEV_CONTACT'] = 'ugyfelszolgalat@adozz.hu'; $e['NAV_DEV_TAX_NUMBER'] = '32769678'
Write-Host ''
Write-Host 'ZeptoMail: Zoho > agent_1 > SMTP/API > "Kennwort 1" melletti másolás gomb, majd ide jobb klikk + Enter.' -ForegroundColor Cyan
$tok = Titkos 'ZeptoMail jelszó (nem látszik; üres Enter = most csak a NAV megy fel)'
if ($tok) {
  if ($tok -match '\s') { Write-Host 'A jelszóban szóköz van (rossz másolás?). Nem változtattam semmit.' -ForegroundColor Red; exit 1 }
  $e['SMTP_HOST'] = 'smtp.zeptomail.eu'; $e['SMTP_PORT'] = '587'; $e['SMTP_USER'] = 'emailapikey'; $e['SMTP_PASS'] = $tok
  $e['MAIL_FROM'] = 'Adózz <ertesites@adozz.hu>'; $e['MAIL_REPLY_TO'] = 'ugyfelszolgalat@adozz.hu'; $e['MAIL_MODE'] = 'demo'
}
$tok = $null
$sorok = ($e.Keys | ForEach-Object { "$_=$($e[$_])" }) -join "`n"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sorok + "`n")); $e = $null; $sorok = $null
$tavoli = @'
set -e
cd /srv/kezjegy
mkdir -p _regi
umask 077
uj=$(mktemp)
echo '__ERTEKEK__' | base64 -d > "$uj"
TS=$(date +%Y%m%d_%H%M%S)
cp -p .env "_regi/env_$TS"
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
docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1
for i in $(seq 1 40); do st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none); [ "$st" = healthy ] && break; sleep 3; done
if [ "$st" = healthy ]; then echo 'API restarted: OK'; else echo "API NOT healthy: $st"; fi
'@
$tavoli = $tavoli.Replace('__ERTEKEK__', $b64) -replace "`r", ''
$OutputEncoding = [Text.Encoding]::ASCII
$tavoli | ssh appok-1 'bash -s'
Write-Host ''
Write-Host 'Kész. Ezt az ablakot bezárhatod – Claude ellenőrzi a többit.' -ForegroundColor Green
