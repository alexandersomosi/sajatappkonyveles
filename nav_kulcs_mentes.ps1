# NAV éles technikai felhasználó (Somosi Kft., adószám-kereséshez) adatainak elmentése EZEN a gépen (UpgradePC).
# A tulaj futtatja (11-20). A titkos értékek gépelés közben nem látszanak, nem kerülnek chatbe, fájlba vagy naplóba:
# csak a Windows felhasználói környezeti változói közé (HKCU\Environment), ahonnan a többi kulcs is jön.
# A szerverre később a nav_szerverre.ps1 viszi fel (a k7 után), szintén a tulaj futtatja.
# Futtatás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\nav_kulcs_mentes.ps1
$ErrorActionPreference = 'Stop'
function Titkos($kerdes) {
  $s = Read-Host $kerdes -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
Write-Host ''
Write-Host 'NAV ÉLES technikai felhasználó – Somosi Kft. (törzsszám: 32769678)' -ForegroundColor Cyan
Write-Host 'Másold be egyenként a NAV Felhasználókezelőből (jobb klikk = beillesztés). A titkos mezők nem látszanak.' -ForegroundColor Gray
Write-Host ''
$login = (Read-Host '1) Technikai felhasználónév').Trim()
$jelszo = Titkos '2) Jelszó (nem látszik)'
$alairo = Titkos '3) XML aláírókulcs (nem látszik)'
$csere = Titkos '4) XML cserekulcs (nem látszik)'

$hiba = @()
if (-not $login) { $hiba += 'a felhasználónév üres' }
if (-not $jelszo) { $hiba += 'a jelszó üres' }
if (-not $alairo) { $hiba += 'az aláírókulcs üres' }
if (-not $csere) { $hiba += 'a cserekulcs üres' }
if ($hiba.Count) { Write-Host ('Nem mentettem semmit: ' + ($hiba -join ', ') + '.') -ForegroundColor Red; exit 1 }
if ($login -match '\s' -or $alairo -match '\s' -or $csere -match '\s') { Write-Host 'Valamelyikben szóköz van (rossz másolás?). Nem mentettem semmit.' -ForegroundColor Red; exit 1 }

# Csak figyelmeztetés: a NAV-os kulcsok szokásos hossza (aláírókulcs 32, cserekulcs 16 karakter). Az értékeket nem írjuk ki.
if ($alairo.Length -ne 32) { Write-Host "Figyelem: az aláírókulcs általában 32 karakter, ez $($alairo.Length). Ha biztos vagy benne, rendben." -ForegroundColor Yellow }
if ($csere.Length -ne 16) { Write-Host "Figyelem: a cserekulcs általában 16 karakter, ez $($csere.Length). Ha biztos vagy benne, rendben." -ForegroundColor Yellow }

[Environment]::SetEnvironmentVariable('NAV_LOOKUP_MODE', 'prod', 'User')
[Environment]::SetEnvironmentVariable('NAV_LOOKUP_TAX_NUMBER', '32769678', 'User')
[Environment]::SetEnvironmentVariable('NAV_LOOKUP_LOGIN', $login, 'User')
[Environment]::SetEnvironmentVariable('NAV_LOOKUP_PASSWORD', $jelszo, 'User')
[Environment]::SetEnvironmentVariable('NAV_LOOKUP_SIGN_KEY', $alairo, 'User')
[Environment]::SetEnvironmentVariable('NAV_LOOKUP_EXCHANGE_KEY', $csere, 'User')
$jelszo = $null; $alairo = $null; $csere = $null
Write-Host ''
Write-Host 'Kész: mind a négy adat elmentve ezen a gépen. A szerverre a k7 után kerül fel.' -ForegroundColor Green
Write-Host 'Ezt az ablakot bezárhatod.' -ForegroundColor Gray
