# Számlázz.hu TESZT-fiók Számla Agent kulcsának elmentése ezen a gépen (UpgradePC), hogy Claude ingyen, tesztüzemben
# kipróbálhassa a díjszámlázást. A tulaj futtatja; a kulcs gépelés közben nem látszik, nem kerül chatbe, fájlba vagy
# naplóba: csak a Windows felhasználói környezeti változói közé (HKCU\Environment), mint a többi kulcs.
# CSAK a külön, TESZTÜZEMBEN lévő fiók kulcsa jöhet ide - a Somosi Kft. éles fiókjáé NEM (az már egy dokumentumtól díjköteles).
# Futtatás: powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\szamlazz_teszt_kulcs.ps1
$ErrorActionPreference = 'Stop'
Write-Host 'Számlázz.hu TESZT-fiók: Vezérlőpult (bal felső számla ikon) > lap alja > Fiók hozzáférések > Számla Agent kulcsok' -ForegroundColor Cyan
$v = Read-Host 'Ez a TESZTÜZEMBEN lévő, külön fiók kulcsa (nem a Somosi Kft. éles fiókjáé)? igen/nem'
if ($v.Trim().ToLower() -ne 'igen') { Write-Host 'Rendben, nem mentettem semmit.' -ForegroundColor Yellow; exit 0 }
$s = Read-Host 'Számla Agent kulcs (nem látszik)' -AsSecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
try { $k = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
if ($k.Length -lt 30 -or $k -match '\s') { Write-Host 'Ez nem tűnik Számla Agent kulcsnak (túl rövid vagy szóköz van benne). Nem mentettem semmit.' -ForegroundColor Red; exit 1 }
[Environment]::SetEnvironmentVariable('SZAMLAZZHU_TEST_AGENT_KEY', $k, 'User')
$k = $null
Write-Host 'Kész: a teszt-kulcs el van mentve ezen a gépen. Szólj Claude-nak.' -ForegroundColor Green
