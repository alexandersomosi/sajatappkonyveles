# Kézjegy - kulcsok és szolgáltatói adatok beállítása a szerveren (appok-1, /srv/kezjegy/.env).
# Futtatás ezen a gépen (UpgradePC), PowerShellben:
#   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\kezjegy_kulcsok.ps1
# Amit üresen hagysz (csak Enter), az nem változik. A titkos értékek gépelés közben nem látszanak,
# és nem kerülnek se a képernyőre, se naplóba: közvetlenül a szerver védett .env fájljába mennek
# (a régi .env előbb a /srv/kezjegy/_regi/ mappába kerül). A végén az API és a worker újraindul.
# Amíg egy szolgáltatás kulcsa hiányzik, az DEMO módban fut (APP_ENV=demo), élesben (production) pedig ki van kapcsolva.

$ErrorActionPreference = 'Stop'

function Read-Secret([string]$prompt) {
    $s = Read-Host -Prompt $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Write-Host ''
Write-Host 'Kézjegy beállítás - üres Enter = nem változtat' -ForegroundColor Green
Write-Host ''

$ertekek = [ordered]@{}

Write-Host '1) SimplePay ismétlődő kártyás fizetés (SimplePay kereskedői admin > Fiókbeállítások; HUF fiók)'
$ertekek['SIMPLEPAY_MODE'] = Read-Host '   Mód: sandbox (teszt) vagy live (éles); a demo a kulcsok nélküli próba'
$ertekek['SIMPLEPAY_MERCHANT_HUF'] = Read-Host '   Kereskedő azonosító (MERCHANT, HUF)'
$ertekek['SIMPLEPAY_SECRET_HUF'] = Read-Secret '   Titkos kulcs (SECRET KEY, HUF)'
Write-Host '   (A SimplePay adminban az IPN cím: https://api.45-94-65-74.sslip.io/api/v1/webhooks/simplepay/ipn - saját domainnél azzal)'

Write-Host '2) E-mail (Zoho CPaaS / ZeptoMail SMTP: E-Mail > Agents > agent_1 > SMTP; 11-19 óta ez a választott)'
$ertekek['SMTP_HOST'] = Read-Host '   SMTP szerver (ZeptoMail EU: smtp.zeptomail.eu)'
$ertekek['SMTP_PORT'] = Read-Host '   SMTP port (ZeptoMail: 587)'
$ertekek['SMTP_USER'] = Read-Host '   SMTP felhasználó (ZeptoMail: emailapikey)'
$ertekek['SMTP_PASS'] = Read-Secret '   SMTP jelszó = a ZeptoMail "Send Mail Token" (nem látszik)'
$ertekek['MAIL_FROM'] = Read-Host '   Feladó (pl. Adózz <ertesites@adozz.hu>; az adozz.hu legyen hitelesítve a Zohóban)'
$ertekek['MAIL_REPLY_TO'] = Read-Host '   Válaszcím (üres = a feladó)'

Write-Host '3) Google-belépés (Google Cloud > APIs & Services > Credentials > OAuth client ID)'
$ertekek['GOOGLE_CLIENT_IDS'] = Read-Host '   Client ID-k vesszővel, ebben a sorrendben: web, android, ios'

Write-Host '4) Apple-belépés (csak iOS; csak ha már van Apple fejlesztői fiók)'
$ertekek['APPLE_BUNDLE_ID'] = Read-Host '   Bundle ID (com.somosi.kezjegy)'

Write-Host '5) NAV Online Számla (csak OLVAS; a szoftver adatai a NAV-os regisztrációból)'
$ertekek['NAV_MODE'] = Read-Host '   Mód: test (NAV tesztkörnyezet) vagy prod (éles); demo = kitalált számlák'
$ertekek['NAV_SOFTWARE_ID'] = Read-Host '   Szoftverazonosító (18 karakter, pl. HU12345678KEZJEGY1)'
$ertekek['NAV_SOFTWARE_VERSION'] = Read-Host '   Szoftver verzió (pl. 1.0.0)'
$ertekek['NAV_DEV_NAME'] = Read-Host '   Fejlesztő neve (pl. Somosi Kft.)'
$ertekek['NAV_DEV_CONTACT'] = Read-Host '   Fejlesztő e-mail címe'
$ertekek['NAV_DEV_TAX_NUMBER'] = Read-Host '   Fejlesztő adószáma (8 számjegy, törzsszám)'

Write-Host '6) Díjszámla a havidíjról (Számlázz.hu vagy Billingo; amíg nincs: DEMO díjbekérő, nem számla)'
$ertekek['INVOICE_MODE'] = Read-Host '   Szolgáltató: szamlazzhu vagy billingo'
$ertekek['SZAMLAZZHU_AGENT_KEY'] = Read-Secret '   Számlázz.hu Számla Agent kulcs (ha azt választottad)'
$ertekek['BILLINGO_API_KEY'] = Read-Secret '   Billingo API kulcs (ha azt választottad)'

Write-Host '7) Push értesítés (Expo; kell hozzá EAS projekt + FCM/APNs)'
$ertekek['PUSH_MODE'] = Read-Host '   Mód: expo (valódi küldés) vagy demo'
$ertekek['EXPO_ACCESS_TOKEN'] = Read-Secret '   Expo access token (nem kötelező)'

Write-Host '8) Termék neve és címek (a címeket saját domain után)'
$ujNev = Read-Host '   Az app végleges neve (egyetlen helyen van: kod\shared\brand.json; üres = marad)'
$ertekek['APP_PUBLIC_URL'] = Read-Host '   Ügyfél webapp címe (pl. https://app.sajatdomain.hu)'
$ertekek['PANEL_PUBLIC_URL'] = Read-Host '   Könyvelői panel címe (pl. https://konyvelo.sajatdomain.hu)'
$ertekek['API_PUBLIC_URL'] = Read-Host '   API címe (pl. https://api.sajatdomain.hu)'

Write-Host '9) Éles mód és könyvelői 2FA (csak ha a fentiek már be vannak állítva)'
$ertekek['STAFF_TOTP_REQUIRED'] = Read-Host '   Könyvelő/admin kötelező kétlépcsős belépés: true vagy false (éles módban mindig true)'
$ertekek['APP_ENV'] = Read-Host '   APP_ENV: production (éles: kulcs nélküli szolgáltatás KIKAPCSOL) vagy demo'

$hibak = @()
if ($ertekek['SIMPLEPAY_MODE'] -and ($ertekek['SIMPLEPAY_MODE'].Trim() -notin @('demo', 'sandbox', 'live'))) { $hibak += 'SIMPLEPAY_MODE: demo, sandbox vagy live' }
if ($ertekek['NAV_MODE'] -and ($ertekek['NAV_MODE'].Trim() -notin @('demo', 'test', 'prod'))) { $hibak += 'NAV_MODE: demo, test vagy prod' }
if ($ertekek['NAV_SOFTWARE_ID'] -and ($ertekek['NAV_SOFTWARE_ID'].Trim() -cnotmatch '^[0-9A-Z-]{18}$')) { $hibak += 'NAV_SOFTWARE_ID: pontosan 18 karakter (0-9, A-Z, -)' }
if ($ertekek['INVOICE_MODE'] -and ($ertekek['INVOICE_MODE'].Trim() -notin @('demo', 'szamlazzhu', 'billingo'))) { $hibak += 'INVOICE_MODE: demo, szamlazzhu vagy billingo' }
if ($ertekek['PUSH_MODE'] -and ($ertekek['PUSH_MODE'].Trim() -notin @('demo', 'expo'))) { $hibak += 'PUSH_MODE: demo vagy expo' }
if ($ertekek['APP_ENV'] -and ($ertekek['APP_ENV'].Trim() -notin @('demo', 'production'))) { $hibak += 'APP_ENV: demo vagy production' }
if ($ertekek['STAFF_TOTP_REQUIRED'] -and ($ertekek['STAFF_TOTP_REQUIRED'].Trim() -notin @('true', 'false'))) { $hibak += 'STAFF_TOTP_REQUIRED: true vagy false' }
# Éles módban a könyvelői 2FA kötelező (a szerver különben el sem indul): ezt magunk állítjuk be.
if ($ertekek['APP_ENV'] -and $ertekek['APP_ENV'].Trim() -eq 'production') {
    if ($ertekek['STAFF_TOTP_REQUIRED'] -and $ertekek['STAFF_TOTP_REQUIRED'].Trim() -eq 'false') { Write-Host 'Figyelem: éles módban a könyvelői kétlépcsős belépés kötelező, ezért true lesz.' -ForegroundColor Yellow }
    $ertekek['STAFF_TOTP_REQUIRED'] = 'true'
}
foreach ($k in @('APP_PUBLIC_URL', 'PANEL_PUBLIC_URL', 'API_PUBLIC_URL')) {
    if ($ertekek[$k] -and ($ertekek[$k].Trim() -notmatch '^https://[^\s/]+$')) { $hibak += "${k}: https://... cím kell, perjel nélkül a végén" }
}
if ($hibak.Count -gt 0) { Write-Host ''; $hibak | ForEach-Object { Write-Host "Hiba: $_" -ForegroundColor Red }; Write-Host 'Nem változott semmi. Futtasd újra.'; exit 1 }

# A termék neve NEM a szerver .env-jében él, hanem egyetlen helyen: kod\shared\brand.json ("name").
# Innen kerül az appba, a panelbe, az e-mailekbe, a PDF-ekbe és a jogi szövegekbe (újraépítéskor).
$brandValtozott = $false
if ($null -ne $ujNev -and $ujNev.Trim() -ne '') {
    $ujNev = $ujNev.Trim()
    if ($ujNev -match '["\]' -or $ujNev.Length -gt 40) { Write-Host 'Hiba: a név legfeljebb 40 karakter, idézőjel és \ nélkül.' -ForegroundColor Red; exit 1 }
    $bp = 'C:\Users\UpgradePC\konyvelo_app\kod\shared\brand.json'
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $json = [IO.File]::ReadAllText($bp, $utf8)
    $re = [regex]'("name"\s*:\s*")[^"]*(")'
    if (-not $re.IsMatch($json)) { throw 'A brand.json-ban nincs "name" mező.' }
    $regi = 'C:\Users\UpgradePC\konyvelo_app\kod\shared\_regi'
    New-Item -ItemType Directory -Force $regi | Out-Null
    Copy-Item $bp (Join-Path $regi ('brand_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.json'))
    $json = $re.Replace($json, { param($m) $m.Groups[1].Value + $ujNev + $m.Groups[2].Value }, 1)
    [IO.File]::WriteAllText($bp, $json, $utf8)
    $brandValtozott = $true
    Write-Host "   A név átírva a brand.json-ban: $ujNev (a régi a kod\shared\_regi mappában)."
}

$sorok = @()
foreach ($k in $ertekek.Keys) {
    $v = $ertekek[$k]
    if ($null -ne $v -and $v.Trim() -ne '') {
        if ($v -match "[\r\n]") { throw "A(z) $k értékében sortörés van." }
        $sorok += "$k=$($v.Trim())"
    }
}
$nevTeendo = {
    if ($brandValtozott) {
        Write-Host ''
        Write-Host 'Az új név az újraépítés után látszik mindenhol (Git Bash):' -ForegroundColor Yellow
        Write-Host '   cd C:/Users/UpgradePC/konyvelo_app/kod/app && npm run export:web'
        Write-Host '   cd C:/Users/UpgradePC/konyvelo_app/kod/panel && npm run build'
        Write-Host '   bash C:/Users/UpgradePC/konyvelo_app/kod/deploy/feltolt.sh && ssh appok-1 "bash /srv/kezjegy/deploy/up.sh"'
        Write-Host '   PREBUILD=1 bash C:/Users/UpgradePC/konyvelo_app/apk/build-apk.sh   (új teszt-APK)'
    }
}
if ($sorok.Count -eq 0) { & $nevTeendo; if (-not $brandValtozott) { Write-Host 'Nem adtál meg semmit, nincs változás.' }; exit 0 }

# A szerveren: régi .env mentése a _regi mappába, a megadott kulcsok cseréje vagy hozzáadása, az API és a worker újraindítása.
$tavoli = @'
: 2>/dev/null
set -e
cd /srv/kezjegy
mkdir -p _regi
cp -p .env "_regi/env_$(date +%Y%m%d_%H%M%S)"
umask 077
uj=$(mktemp)
echo '__ERTEKEK__' | base64 -d > "$uj"
# Eles modba (APP_ENV=production) csak ures adatbazissal: a DEMO fiokok, DEMO elofizetesek es tesztugyfelek
# nem maradhatnak benne (a DEMO kartyat eles modban nem terheljuk, de az adatok akkor is kitaltak).
if grep -q '^APP_ENV=production' "$uj"; then
  n=$(docker exec kezjegy-db psql -At -U kezjegy -d kezjegy -c "select (select count(*) from users where email like '%@demo.kezjegy.test') + (select count(*) from subscriptions where mode = 'demo') + (select count(*) from clients where is_test)" 2>/dev/null || echo ismeretlen)
  if [ "$n" != "0" ]; then
    echo "MEGALLTAM, nem valtoztattam semmit: az adatbazisban DEMO adat van ($n sor)."
    echo "Eles modhoz uj, ures adatbazis kell - lasd kod/deploy/README.md, Elesites."
    rm -f "$uj"
    exit 0
  fi
fi
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
print('Set:', ', '.join(sorted(uj)))
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
if [ "$st" = healthy ]; then echo 'API restarted: OK.'; else echo "API is NOT healthy ($st). Check: ssh appok-1 'docker logs kezjegy-api --tail 30' (the message names the bad value)."; fi
# (A Gardoko 2026-11-20-án törölve; az ő ellenőrzése megszűnt.)
exit 0
'@

# Az értékek base64-ben mennek a szkriptbe (nem jelennek meg sehol), a szkript pedig a bemeneten megy a szerverre,
# így a PowerShell nem rontja el az idézőjeleket. Csak ASCII marad benne, és a sorvégek Unix-sorvégek.
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($sorok -join "`n") + "`n"))
$tavoli = $tavoli.Replace('__ERTEKEK__', $b64) -replace "`r", ''
$OutputEncoding = [Text.Encoding]::ASCII
$tavoli | ssh appok-1 'bash -s'
& $nevTeendo
Write-Host ''
Write-Host 'Kész. Ellenőrzés: https://api.45-94-65-74.sslip.io/api/v1/health  (modes: demo = még nincs kulcs)' -ForegroundColor Green
