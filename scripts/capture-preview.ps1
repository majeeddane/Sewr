# Screenshot capture for the client preview deck.
#
# Output goes to an ASCII path on purpose: headless Chrome silently fails to
# write a screenshot when its working directory contains Arabic characters,
# which this repository's path does.
#
# Usage:  powershell -File scripts/capture-preview.ps1
param(
  [string]$Base = "https://sewr.vercel.app",
  [string]$OutDir = "$env:TEMP\sewr-preview"
)

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }
if (-not (Test-Path $chrome)) { Write-Error "no chrome"; exit 1 }

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# name | path | window height
$pages = @(
  @("01-home",      "/",       1000),
  @("02-about",     "/about",  1000),
  @("03-services",  "/services", 1000),
  @("04-programs",  "/programs", 1000),
  @("05-protocols", "/protocols", 1000),
  @("06-blog",      "/blog",   1000),
  @("07-contact",   "/contact", 1000),
  @("08-book",      "/book",   1000)
)

# Deeper pages get a taller frame so more of the design is visible at once.
$pages += @(
  @("09-service-detail", "/services/al-iqtiyani-w-al-alami", 1500),
  @("10-program-detail", "/programs/daz-altahassus", 1500),
  @("11-article",        "/blog/al-nawm-w-al-daghatt-al-nafsi-w-dabt-al-infeel", 1500),
  @("12-privacy",        "/privacy", 1200)
)

$ok = 0; $fail = 0
foreach ($p in $pages) {
  $name = $p[0]; $path = $p[1]; $height = $p[2]
  $file = Join-Path $OutDir "$name.png"

  $proc = Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--virtual-time-budget=10000",
    "--window-size=1440,$height",
    "--screenshot=$file",
    "$Base$path"
  ) -WindowStyle Hidden -PassThru
  $null = $proc.WaitForExit(60000)

  if (Test-Path $file) {
    $kb = [math]::Round((Get-Item $file).Length / 1kb)
    Write-Output ("  OK   {0,-20} {1,5} KB" -f $name, $kb)
    $ok++
  } else {
    Write-Output ("  FAIL {0,-20} {1}" -f $name, $path)
    $fail++
  }
}

Write-Output ""
Write-Output "  OK: $ok   FAIL: $fail"
Write-Output "  Folder: $OutDir"
