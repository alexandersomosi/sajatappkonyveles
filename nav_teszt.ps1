# NAV-kapcsolatpróba (teszt) – a tulaj futtatja a saját gépén. Az adatokat itt kéri be, csak ennek a
# folyamatnak a memóriájában tartja, nem írja lemezre és nem küldi sehova, csak a NAV tesztrendszerének.
# Futtatás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\nav_teszt.ps1
$ErrorActionPreference = 'Stop'
function Titkos($kerdes) {
  $s = Read-Host $kerdes -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}
Write-Host 'NAV Online Számla – TESZT kapcsolatpróba' -ForegroundColor Cyan
$env:NAV_MODE = 'test'
$env:NAV_TESZT_TAXNUMBER = Read-Host 'A cég adószáma (8 számjegy, pl. 32769678)'
$env:NAV_TESZT_LOGIN = Read-Host 'Technikai felhasználó neve'
$env:NAV_TESZT_PASSWORD = Titkos 'Technikai felhasználó jelszava (nem látszik)'
$env:NAV_TESZT_SIGNKEY = Titkos 'XML aláírókulcs (nem látszik)'
$env:NAV_TESZT_EXCHKEY = Titkos 'XML cserekulcs (nem látszik)'
$keres = Read-Host 'Melyik adószámot kérdezzük le? (Enter = a cégé)'
if (-not $keres) { $keres = $env:NAV_TESZT_TAXNUMBER }
$env:NAV_SOFTWARE_ID = ('HU' + $env:NAV_TESZT_TAXNUMBER.Trim() + 'ADOZZ001')
$env:NAV_SOFTWARE_VERSION = '1.0.0'
$env:NAV_DEV_NAME = 'Adózz (teszt)'
$env:NAV_DEV_CONTACT = 'teszt@example.com'
$env:NAV_DEV_TAX_NUMBER = $env:NAV_TESZT_TAXNUMBER.Trim()
Push-Location 'C:\Users\UpgradePC\konyvelo_app\kod\nav-kliens'
try { node tools/nav_teszt.mjs $keres } finally {
  Pop-Location
  foreach ($n in 'NAV_TESZT_PASSWORD','NAV_TESZT_SIGNKEY','NAV_TESZT_EXCHKEY','NAV_TESZT_LOGIN') { Remove-Item "Env:$n" -ErrorAction SilentlyContinue }
}
Write-Host 'Kész. Az eredményt (a kulcsok nélkül) bemásolhatod a chatbe.' -ForegroundColor Cyan
