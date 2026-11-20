# Adózz (munkanév: Kézjegy) - kulcsok és szolgáltatói adatok beállítása a szerveren (appok-1, /srv/kezjegy/.env).
# Futtatás ezen a gépen (UpgradePC), PowerShellben:
#   powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\kezjegy_kulcsok.ps1
# Amit üresen hagysz (csak Enter), az nem változik. A titkos értékek gépelés közben nem látszanak,
# és nem kerülnek se a képernyőre, se naplóba: közvetlenül a szerver védett .env fájljába mennek
# (a régi .env előbb a /srv/kezjegy/_regi/ mappába kerül). A nyilvános címek (8. pont) a /srv/kezjegy/nyilvanos.env-be
# mennek, nem a .env-be (SPEC §29.3.3). A végén az API és a worker újraindul.
# Amíg egy szolgáltatás kulcsa hiányzik, az DEMO módban fut (APP_ENV=demo), élesben (production) pedig ki van kapcsolva.
# SPEC §29.11.2 (k7, 11-20): 1) Stripe (a SimplePay csak az 1b pontban, ha visszaváltanál), 5) saját NAV technikai
# felhasználó az adószám-kereséshez, 6) Számlázz.hu teszt/éles fiók, 8) címek a nyilvanos.env-be.

$ErrorActionPreference = 'Stop'

function Read-Secret([string]$prompt) {
    $s = Read-Host -Prompt $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Write-Host ''
Write-Host 'Adózz beállítás - üres Enter = nem változtat' -ForegroundColor Green
Write-Host ''

$ertekek = [ordered]@{}
$nyilvanos = [ordered]@{}

Write-Host '1) Kártyás fizetés: Stripe (Stripe Dashboard > Developers > API keys)'
Write-Host '   A webhook titkot a stripe_szerverre.ps1 hozza létre (tesztmód); éleshez: stripe_szerverre.ps1 -Eles' -ForegroundColor Yellow
$ertekek['PAYMENT_PROVIDER'] = Read-Host '   Szolgáltató: stripe, demo (próba, nincs pénzmozgás) vagy simplepay'
$ertekek['STRIPE_SECRET_KEY'] = Read-Secret '   Stripe titkos kulcs (sk_test_... / élesítéskor sk_live_...; nem látszik)'
$ertekek['STRIPE_PUBLISHABLE_KEY'] = Read-Host '   Stripe közzétehető kulcs (pk_test_... / pk_live_...)'
$ertekek['STRIPE_WEBHOOK_SECRET'] = Read-Secret '   Stripe webhook titok (whsec_...; inkább a stripe_szerverre.ps1-gyel)'

$sp = Read-Host '1b) SimplePay kulcsok is? (csak ha SimplePay-re váltanál vissza) igen/nem'
if ($sp.Trim().ToLower() -eq 'igen') {
    $ertekek['SIMPLEPAY_MODE'] = Read-Host '   Mód: sandbox (teszt) vagy live (éles); a demo a kulcsok nélküli próba'
    $ertekek['SIMPLEPAY_MERCHANT_HUF'] = Read-Host '   Kereskedő azonosító (MERCHANT, HUF)'
    $ertekek['SIMPLEPAY_SECRET_HUF'] = Read-Secret '   Titkos kulcs (SECRET KEY, HUF)'
}

Write-Host '2) E-mail (Zoho ZeptoMail SMTP: smtp.zeptomail.eu, 587, felhasználó: emailapikey, jelszó: a Send Mail Token)'
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
Write-Host '5b) Saját NAV technikai felhasználó az adószám-kereséshez (a Somosi Kft. nevén; mind az öt, vagy egyik sem)'
# 11-20: a nav_kulcs_mentes.ps1 ezen a gépen (HKCU) már elmentette és kipróbálta őket – "gep" = onnan veszi, nem kell újra beírni.
$navGep = [Environment]::GetEnvironmentVariable('NAV_LOOKUP_LOGIN', 'User')
$m = Read-Host ('   Mód: test vagy prod' + $(if ($navGep) { '; "gep" = a gépen tárolt, kipróbált éles adatok' } else { '' }))
if ($navGep -and $m.Trim().ToLower() -eq 'gep') {
    foreach ($n in 'NAV_LOOKUP_MODE','NAV_LOOKUP_TAX_NUMBER','NAV_LOOKUP_LOGIN','NAV_LOOKUP_PASSWORD','NAV_LOOKUP_SIGN_KEY','NAV_LOOKUP_EXCHANGE_KEY') {
        $ertekek[$n] = [Environment]::GetEnvironmentVariable($n, 'User')
    }
    Write-Host '   A gépen tárolt NAV-adatokat használom (az értékek nem látszanak).' -ForegroundColor Green
} else {
    $ertekek['NAV_LOOKUP_MODE'] = $m
    $ertekek['NAV_LOOKUP_TAX_NUMBER'] = Read-Host '   A Somosi Kft. törzsszáma (8 számjegy)'
    $ertekek['NAV_LOOKUP_LOGIN'] = Read-Host '   Technikai felhasználó neve'
    $ertekek['NAV_LOOKUP_PASSWORD'] = Read-Secret '   Technikai felhasználó jelszava (nem látszik)'
    $ertekek['NAV_LOOKUP_SIGN_KEY'] = Read-Secret '   XML aláírókulcs (nem látszik)'
    $ertekek['NAV_LOOKUP_EXCHANGE_KEY'] = Read-Secret '   XML cserekulcs (nem látszik)'
}

Write-Host '6) Díjszámla: Számlázz.hu Számla Agent (amíg nincs: DEMO díjbekérő, nem számla)'
Write-Host '   FIGYELEM: az ÉLES Számla Agent kulcs első számlája elindítja a fizetős csomagot – csak élesítéskor (APP_ENV=production).' -ForegroundColor Yellow
$ertekek['INVOICE_MODE'] = Read-Host '   Mód: szamlazzhu vagy demo'
$ertekek['SZAMLAZZHU_ACCOUNT'] = Read-Host '   Fiók: teszt (Tesztüzem) vagy eles (Somosi Kft.)'
# k7c2: a kulcs a FIÓKHOZ tartozik. A teszt fiók kulcsa külön változóba megy (SZAMLAZZHU_TEST_AGENT_KEY), így a szerveren
# lévő éles kulcs soha nem futhat "teszt" címkével. Fiók megadásakor a kulcsot is ugyanebben a futásban kérjük.
$fiok = if ($ertekek['SZAMLAZZHU_ACCOUNT']) { $ertekek['SZAMLAZZHU_ACCOUNT'].Trim().ToLower() } else { '' }
$ertekek['SZAMLAZZHU_ACCOUNT'] = $fiok
if ($fiok -eq 'teszt') {
    $tk = Read-Secret '   A TESZT fiók Számla Agent kulcsa (nem látszik; Enter = a gépen tárolt teszt kulcs)'
    if ($null -eq $tk -or $tk.Trim() -eq '') { $tk = [Environment]::GetEnvironmentVariable('SZAMLAZZHU_TEST_AGENT_KEY', 'User') }
    $ertekek['SZAMLAZZHU_TEST_AGENT_KEY'] = $tk
    $tk = $null
} elseif ($fiok -eq 'eles') {
    $ertekek['SZAMLAZZHU_AGENT_KEY'] = Read-Secret '   Az ÉLES (Somosi Kft.) Számla Agent kulcsa (nem látszik)'
}

Write-Host '7) Push értesítés (Expo; kell hozzá EAS projekt + FCM/APNs)'
$ertekek['PUSH_MODE'] = Read-Host '   Mód: expo (valódi küldés) vagy demo'
$ertekek['EXPO_ACCESS_TOKEN'] = Read-Secret '   Expo access token (nem kötelező)'

Write-Host '8) Termék neve és nyilvános címek (a címek a /srv/kezjegy/nyilvanos.env-be mennek; az adozz.hu átállás után)'
$ujNev = Read-Host '   Az app végleges neve (egyetlen helyen van: kod\shared\brand.json; üres = marad)'
$nyilvanos['APP_PUBLIC_URL'] = Read-Host '   Ügyfél webapp címe (pl. https://app.adozz.hu)'
$nyilvanos['PANEL_PUBLIC_URL'] = Read-Host '   Könyvelői panel címe (pl. https://konyvelo.adozz.hu)'
$nyilvanos['API_PUBLIC_URL'] = Read-Host '   API címe (pl. https://api.adozz.hu)'
$nyilvanos['LANDING_PUBLIC_URL'] = Read-Host '   Bemutató oldal (pl. https://adozz.hu)'
$nyilvanos['EXTRA_PUBLIC_ORIGINS'] = Read-Host '   További címek vesszővel (a megtartott sslip.io címek)'

Write-Host '9) Éles mód és könyvelői 2FA (csak ha a fentiek már be vannak állítva)'
$ertekek['STAFF_TOTP_REQUIRED'] = Read-Host '   Könyvelő/admin kötelező kétlépcsős belépés: true vagy false (éles módban mindig true)'
$ertekek['APP_ENV'] = Read-Host '   APP_ENV: production (éles: kulcs nélküli szolgáltatás KIKAPCSOL) vagy demo'

function V([string]$k) { if ($null -ne $ertekek[$k]) { return $ertekek[$k].Trim() } else { return '' } }
$hibak = @()
if ((V 'PAYMENT_PROVIDER') -and ((V 'PAYMENT_PROVIDER') -notin @('stripe', 'demo', 'simplepay'))) { $hibak += 'PAYMENT_PROVIDER: stripe, demo vagy simplepay' }
if ((V 'STRIPE_SECRET_KEY') -and ((V 'STRIPE_SECRET_KEY') -notmatch '^(sk|rk)_(test|live)_[A-Za-z0-9]+$')) { $hibak += 'STRIPE_SECRET_KEY: sk_test_... vagy sk_live_...' }
if ((V 'STRIPE_PUBLISHABLE_KEY') -and ((V 'STRIPE_PUBLISHABLE_KEY') -notmatch '^pk_(test|live)_[A-Za-z0-9]+$')) { $hibak += 'STRIPE_PUBLISHABLE_KEY: pk_test_... vagy pk_live_...' }
if ((V 'STRIPE_WEBHOOK_SECRET') -and ((V 'STRIPE_WEBHOOK_SECRET') -notlike 'whsec_*')) { $hibak += 'STRIPE_WEBHOOK_SECRET: whsec_...' }
if ((V 'STRIPE_SECRET_KEY') -like '*_live_*' -and (V 'APP_ENV') -ne 'production') { $hibak += 'Éles Stripe-kulcs csak APP_ENV=production mellett (és inkább a stripe_szerverre.ps1 -Eles-sel)' }
if ((V 'SIMPLEPAY_MODE') -and ((V 'SIMPLEPAY_MODE') -notin @('demo', 'sandbox', 'live'))) { $hibak += 'SIMPLEPAY_MODE: demo, sandbox vagy live' }
if ((V 'NAV_MODE') -and ((V 'NAV_MODE') -notin @('demo', 'test', 'prod'))) { $hibak += 'NAV_MODE: demo, test vagy prod' }
if ((V 'NAV_SOFTWARE_ID') -and ((V 'NAV_SOFTWARE_ID') -cnotmatch '^[0-9A-Z-]{18}$')) { $hibak += 'NAV_SOFTWARE_ID: pontosan 18 karakter (0-9, A-Z, -)' }
if ((V 'NAV_LOOKUP_MODE') -and ((V 'NAV_LOOKUP_MODE') -notin @('test', 'prod'))) { $hibak += 'NAV_LOOKUP_MODE: test vagy prod' }
$lookup = @('NAV_LOOKUP_TAX_NUMBER', 'NAV_LOOKUP_LOGIN', 'NAV_LOOKUP_PASSWORD', 'NAV_LOOKUP_SIGN_KEY', 'NAV_LOOKUP_EXCHANGE_KEY') | Where-Object { V $_ }
if ($lookup.Count -gt 0 -and $lookup.Count -lt 5) { $hibak += 'NAV_LOOKUP_*: mind az öt adat kell (törzsszám, felhasználó, jelszó, aláírókulcs, cserekulcs), vagy egyik sem' }
if ((V 'NAV_LOOKUP_TAX_NUMBER') -and ((V 'NAV_LOOKUP_TAX_NUMBER') -notmatch '^\d{8}$')) { $hibak += 'NAV_LOOKUP_TAX_NUMBER: 8 számjegy' }
if ((V 'INVOICE_MODE') -and ((V 'INVOICE_MODE') -notin @('demo', 'szamlazzhu'))) { $hibak += 'INVOICE_MODE: szamlazzhu vagy demo' }
if ((V 'SZAMLAZZHU_ACCOUNT') -and ((V 'SZAMLAZZHU_ACCOUNT') -notin @('teszt', 'eles'))) { $hibak += 'SZAMLAZZHU_ACCOUNT: teszt vagy eles' }
if ((V 'INVOICE_MODE') -eq 'szamlazzhu' -and -not (V 'SZAMLAZZHU_ACCOUNT')) { $hibak += 'INVOICE_MODE=szamlazzhu mellé a SZAMLAZZHU_ACCOUNT (teszt vagy eles) is kell' }
if ((V 'SZAMLAZZHU_ACCOUNT') -eq 'teszt' -and -not (V 'SZAMLAZZHU_TEST_AGENT_KEY')) { $hibak += 'A teszt fiókhoz a TESZT Számla Agent kulcs kell (nem adtad meg, és a gépen sincs SZAMLAZZHU_TEST_AGENT_KEY)' }
if ((V 'SZAMLAZZHU_ACCOUNT') -eq 'eles' -and -not (V 'SZAMLAZZHU_AGENT_KEY')) { $hibak += 'Az éles fiókhoz ugyanebben a futásban add meg az éles Számla Agent kulcsot' }
if ((V 'INVOICE_MODE') -eq 'szamlazzhu' -and (V 'APP_ENV') -ne 'production' -and (V 'SZAMLAZZHU_ACCOUNT') -ne 'teszt') { $hibak += 'DEMO szerveren a Számlázz.hu csak a teszt fiókkal (Fiók: teszt) kapcsolható be' }
if ((V 'PUSH_MODE') -and ((V 'PUSH_MODE') -notin @('demo', 'expo'))) { $hibak += 'PUSH_MODE: demo vagy expo' }
if ((V 'APP_ENV') -and ((V 'APP_ENV') -notin @('demo', 'production'))) { $hibak += 'APP_ENV: demo vagy production' }
if ((V 'STAFF_TOTP_REQUIRED') -and ((V 'STAFF_TOTP_REQUIRED') -notin @('true', 'false'))) { $hibak += 'STAFF_TOTP_REQUIRED: true vagy false' }
# Éles módban a könyvelői 2FA kötelező (a szerver különben el sem indul): ezt magunk állítjuk be.
if ((V 'APP_ENV') -eq 'production') {
    if ((V 'STAFF_TOTP_REQUIRED') -eq 'false') { Write-Host 'Figyelem: éles módban a könyvelői kétlépcsős belépés kötelező, ezért true lesz.' -ForegroundColor Yellow }
    $ertekek['STAFF_TOTP_REQUIRED'] = 'true'
}
foreach ($k in @('APP_PUBLIC_URL', 'PANEL_PUBLIC_URL', 'API_PUBLIC_URL', 'LANDING_PUBLIC_URL')) {
    if ($nyilvanos[$k] -and ($nyilvanos[$k].Trim() -notmatch '^https://[^\s/]+$')) { $hibak += "${k}: https://... cím kell, perjel nélkül a végén" }
}
if ($nyilvanos['EXTRA_PUBLIC_ORIGINS'] -and ($nyilvanos['EXTRA_PUBLIC_ORIGINS'].Trim() -notmatch '^https://[^\s/,]+(,https://[^\s/,]+)*$')) { $hibak += 'EXTRA_PUBLIC_ORIGINS: https://... címek vesszővel, szóköz nélkül' }
if ($hibak.Count -gt 0) { Write-Host ''; $hibak | ForEach-Object { Write-Host "Hiba: $_" -ForegroundColor Red }; Write-Host 'Nem változott semmi. Futtasd újra.'; exit 1 }

# A termék neve NEM a szerver .env-jében él, hanem egyetlen helyen: kod\shared\brand.json ("name").
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

function Sorok($tabla) {
    $out = @()
    foreach ($k in $tabla.Keys) {
        $v = $tabla[$k]
        if ($null -ne $v -and $v.Trim() -ne '') {
            if ($v -match "[\r\n]") { throw "A(z) $k értékében sortörés van." }
            $out += "$k=$($v.Trim())"
        }
    }
    return , $out
}
$sorok = Sorok $ertekek
$nyilvanosSorok = Sorok $nyilvanos
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
if ($sorok.Count -eq 0 -and $nyilvanosSorok.Count -eq 0) { & $nevTeendo; if (-not $brandValtozott) { Write-Host 'Nem adtál meg semmit, nincs változás.' }; exit 0 }

# A szerveren: régi .env (és nyilvanos.env) mentése a _regi mappába, a megadott kulcsok cseréje vagy hozzáadása,
# az API és a worker újraindítása. Az értékeket a szerver soha nem írja ki.
$tavoli = @'
: 2>/dev/null
set -e
cd /srv/kezjegy
mkdir -p _regi
umask 077
uj=$(mktemp); nyuj=$(mktemp)
echo '__ERTEKEK__' | base64 -d > "$uj"
echo '__NYILVANOS__' | base64 -d > "$nyuj"
eles_a_szerveren=0; grep -qx 'APP_ENV=production' .env && eles_a_szerveren=1
eles_most=0; grep -qx 'APP_ENV=production' "$uj" && eles_most=1
# Az ELES Szamlazz.hu fiok (elso szamlaja elinditja a fizetos csomagot) es az ELES Stripe-kulcs csak eles szerverre.
if grep -qx 'SZAMLAZZHU_ACCOUNT=eles' "$uj" && [ $eles_a_szerveren = 0 ] && [ $eles_most = 0 ]; then
  echo "MEGALLTAM, nem valtoztattam semmit: az eles Szamlazz.hu fiok csak APP_ENV=production mellett allithato be."
  rm -f "$uj" "$nyuj"; exit 0
fi
# k7c2: DEMO szerveren a Szamlazz.hu csak a TESZT fiok kulcsaval (SZAMLAZZHU_TEST_AGENT_KEY, ugyanebben a futasban)
if grep -qx 'INVOICE_MODE=szamlazzhu' "$uj" && [ $eles_a_szerveren = 0 ] && [ $eles_most = 0 ] && ! grep -q '^SZAMLAZZHU_TEST_AGENT_KEY=.' "$uj"; then
  echo "MEGALLTAM, nem valtoztattam semmit: DEMO szerveren a Szamlazz.hu csak a TESZT fiok kulcsaval kapcsolhato be (Fiok: teszt)."
  rm -f "$uj" "$nyuj"; exit 0
fi
if grep -qE '^STRIPE_SECRET_KEY=(sk|rk)_live_' "$uj" && [ $eles_a_szerveren = 0 ] && [ $eles_most = 0 ]; then
  echo "MEGALLTAM, nem valtoztattam semmit: eles Stripe-kulcs csak APP_ENV=production mellett."
  rm -f "$uj" "$nyuj"; exit 0
fi
# Eles modba (APP_ENV=production) csak ures adatbazissal: a DEMO fiokok, DEMO elofizetesek, DEMO fizetesek es
# tesztugyfelek nem maradhatnak benne.
if [ $eles_most = 1 ]; then
  n=$(docker exec kezjegy-db psql -At -U kezjegy -d kezjegy -c "select (select count(*) from users where email like '%@demo.kezjegy.test') + (select count(*) from subscriptions where mode = 'demo' or provider = 'demo') + (select count(*) from clients where is_test) + (select count(*) from payments where provider = 'demo')" 2>/dev/null || echo ismeretlen)
  if [ "$n" != "0" ]; then
    echo "MEGALLTAM, nem valtoztattam semmit: az adatbazisban DEMO adat van ($n sor)."
    echo "Eles modhoz uj, ures adatbazis kell - lasd kod/deploy/README.md, Elesites."
    rm -f "$uj" "$nyuj"; exit 0
  fi
fi
osszefuz() { # $1 = the file to update, $2 = the new key=value lines
python3 - "$1" "$2" <<'PY'
import os, sys
uj = dict(l.split('=', 1) for l in open(sys.argv[2], encoding='utf-8').read().splitlines() if '=' in l)
sorok = open(sys.argv[1], encoding='utf-8').read().splitlines() if os.path.exists(sys.argv[1]) else []
kesz = set()
for i, l in enumerate(sorok):
    k = l.split('=', 1)[0]
    if k in uj:
        sorok[i] = k + '=' + uj[k]
        kesz.add(k)
sorok += [k + '=' + v for k, v in uj.items() if k not in kesz]
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(sorok) + '\n')
print('Set:', ', '.join(sorted(uj)))
PY
}
TS=$(date +%Y%m%d_%H%M%S)
if [ -s "$uj" ]; then
  cp -p .env "_regi/env_$TS"
  osszefuz .env "$uj"
  chmod 600 .env
fi
if [ -s "$nyuj" ]; then
  [ -f nyilvanos.env ] && cp -p nyilvanos.env "_regi/nyilvanos.env_$TS"
  osszefuz nyilvanos.env "$nyuj"
  chmod 644 nyilvanos.env
fi
rm -f "$uj" "$nyuj"
cd /srv/kezjegy/deploy
docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker >/dev/null 2>&1
for i in $(seq 1 40); do
  st=$(docker inspect -f '{{.State.Health.Status}}' kezjegy-api 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 3
done
if [ "$st" = healthy ]; then echo 'API restarted: OK.'; else echo "API is NOT healthy ($st). Check: ssh appok-1 'docker logs kezjegy-api --tail 30' (the message names the bad value)."; fi
exit 0
'@

# Az értékek base64-ben mennek a szkriptbe (nem jelennek meg sehol), a szkript pedig a bemeneten megy a szerverre,
# így a PowerShell nem rontja el az idézőjeleket. Csak ASCII marad benne, és a sorvégek Unix-sorvégek.
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($sorok -join "`n") + $(if ($sorok.Count) { "`n" } else { '' })))
$b64n = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($nyilvanosSorok -join "`n") + $(if ($nyilvanosSorok.Count) { "`n" } else { '' })))
$tavoli = $tavoli.Replace('__ERTEKEK__', $b64).Replace('__NYILVANOS__', $b64n) -replace "`r", ''
$OutputEncoding = [Text.Encoding]::ASCII
$tavoli | ssh appok-1 'bash -s'
$ertekek = $null
& $nevTeendo
Write-Host ''
Write-Host 'Kész. Ellenőrzés: https://api.45-94-65-74.sslip.io/api/v1/health és /api/v1/config (paymentProvider, paymentMode)' -ForegroundColor Green
