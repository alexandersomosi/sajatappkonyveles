# Stripe TESZT-kulcsok elmentése ezen a gépen (UpgradePC), hogy Claude tesztmódban be tudja kötni és ki tudja próbálni
# a Stripe-ot. A tulaj futtatja, a kulcs gépelés közben nem látszik, nem kerül chatbe, fájlba vagy naplóba:
# csak a Windows felhasználói környezeti változói közé (HKCU\Environment), ahonnan a többi API-kulcs is jön.
# ÉLES kulcsot (sk_live_...) NEM fogad el: az élesek később a kezjegy_kulcsok.ps1-gyel mennek a szerverre.
# Futtatás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\stripe_teszt_kulcs.ps1
$ErrorActionPreference = 'Stop'
function Titkos($kerdes) {
  $s = Read-Host $kerdes -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
Write-Host 'Stripe TESZT-kulcsok (Stripe Dashboard > Fejlesztők / Developers > API-kulcsok, a "Teszt mód" / sandbox legyen bekapcsolva)' -ForegroundColor Cyan
$pk = (Read-Host 'Közzétehető kulcs (pk_test_...)').Trim()
$sk = Titkos 'Titkos kulcs (sk_test_..., nem látszik)'
if ($sk -like 'sk_live_*' -or $sk -like 'rk_live_*' -or $pk -like 'pk_live_*') { Write-Host 'Ez ÉLES kulcs - ide csak teszt-kulcs jöhet. Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
if ($pk -notlike 'pk_test_*') { Write-Host 'A közzétehető kulcs pk_test_ kezdetű legyen. Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
if ($sk -notlike 'sk_test_*' -and $sk -notlike 'rk_test_*') { Write-Host 'A titkos kulcs sk_test_ kezdetű legyen. Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
# Próba: a Stripe egyenleg lekérdezése a kulccsal (csak azt írjuk ki, hogy működik-e).
try {
  $fej = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($sk + ':')) }
  $null = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/balance' -Headers $fej -Method Get
} catch { Write-Host 'A Stripe nem fogadta el a kulcsot (elírás?). Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
[Environment]::SetEnvironmentVariable('STRIPE_TEST_PUBLISHABLE_KEY', $pk, 'User')
[Environment]::SetEnvironmentVariable('STRIPE_TEST_SECRET_KEY', $sk, 'User')
$sk = $null
Write-Host 'Kész: a teszt-kulcsok működnek és el vannak mentve ezen a gépen. Szólj Claude-nak, hogy mehet.' -ForegroundColor Green
