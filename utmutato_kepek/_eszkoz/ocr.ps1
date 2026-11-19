# Szövegfelismerés a Windows beépített OCR-jével (Windows.Media.Ocr, magyar nyelv), hálózat és letöltés nélkül.
# Használat: powershell -NoProfile -ExecutionPolicy Bypass -File ocr.ps1 <kep.png> [nyelv=hu]
# Kimenet (stdout, UTF-8 JSON): {"szel":..,"mag":..,"sorok":[{"szoveg":"..","szavak":[{"t":"..","x":..,"y":..,"w":..,"h":..}]}]}
# A kép legfeljebb OcrEngine.MaxImageDimension (kb. 2600 px) lehet: a hívó (sajat_kepek.py) kicsinyít/darabol.
param([Parameter(Mandatory = $true)][string]$Kep, [string]$Nyelv = 'hu')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGen = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Varj($op, [Type]$tipus) {
    $t = $asTaskGen.MakeGenericMethod($tipus).Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
}
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$teljes = (Resolve-Path -LiteralPath $Kep).Path
$fajl = Varj ([Windows.Storage.StorageFile]::GetFileFromPathAsync($teljes)) ([Windows.Storage.StorageFile])
$folyam = Varj ($fajl.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$dek = Varj ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($folyam)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bm = Varj ($dek.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Nyelv))
if ($null -eq $motor) { throw "nincs OCR-nyelv: $Nyelv" }
$ered = Varj ($motor.RecognizeAsync($bm)) ([Windows.Media.Ocr.OcrResult])
$sorok = @()
foreach ($s in $ered.Lines) {
    $szavak = @()
    foreach ($w in $s.Words) {
        $r = $w.BoundingRect
        $szavak += [ordered]@{ t = $w.Text; x = [math]::Round($r.X, 1); y = [math]::Round($r.Y, 1); w = [math]::Round($r.Width, 1); h = [math]::Round($r.Height, 1) }
    }
    $sorok += [ordered]@{ szoveg = $s.Text; szavak = $szavak }
}
$folyam.Dispose()
[ordered]@{ szel = $bm.PixelWidth; mag = $bm.PixelHeight; max = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension; sorok = $sorok } | ConvertTo-Json -Depth 6 -Compress
