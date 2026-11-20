# Stripe ÉLES, CSAK OLVASÓ (restricted, rk_live_...) kulcs elmentése ezen a gépen (HKCU), hogy Claude belépés nélkül
# ellenőrizhesse az éles fiók állapotát (aktiválás, hiányzó adatok, arculat, fizetési módok, webhookok). 11-20.
# A kulcs csak OLVASNI tud (a Stripe-ban "Restricted key", minden jog "Read"), pénzt mozgatni vagy beállítást módosítani nem.
# Gépelés közben nem látszik, nem kerül chatbe, fájlba vagy naplóba. Bármikor visszavonható a Stripe-ban.
# Futtatás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\stripe_eles_olvaso_kulcs.ps1
$ErrorActionPreference = 'Stop'
$s = Read-Host 'Stripe éles, csak olvasó kulcs (rk_live_..., nem látszik)' -AsSecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
try { $k = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
if ($k -like 'sk_live_*') { Write-Host 'Ez a TELJES jogú titkos kulcs (sk_live_). Ide csak a csak olvasó (rk_live_) kulcs jöhet. Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
if ($k -notlike 'rk_live_*') { Write-Host 'A kulcs rk_live_ kezdetű legyen (Restricted key, éles mód). Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
try {
  $fej = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($k + ':')) }
  $null = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/balance' -Headers $fej -Method Get
} catch { Write-Host 'A Stripe nem fogadta el a kulcsot (elírás, vagy nincs "Balance: Read" joga). Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
[Environment]::SetEnvironmentVariable('STRIPE_LIVE_READONLY_KEY', $k, 'User')
$k = $null
Write-Host 'Kész: a csak olvasó kulcs elmentve ezen a gépen. Szólj Claude-nak, és átnézi az éles fiókot.' -ForegroundColor Green
