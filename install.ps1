# Installs the qrcode-hassle-free bundle into the dsh web profile and
# registers it in the profile bundle list. Idempotent.
# Run: powershell -ExecutionPolicy Bypass -File <this file>

$ErrorActionPreference = 'Stop'

$src = $PSScriptRoot
$profileDir = Join-Path $env:USERPROFILE '.dsh\profiles\web'
$dst = Join-Path $profileDir 'node_modules\qrcode-hassle-free'
$pkgJsonPath = Join-Path $profileDir 'package.json'

if (-not (Test-Path $profileDir)) {
  throw "web profile not found at $profileDir - run 'dsh web' once first"
}

# 1. Copy the bundle in.
New-Item -ItemType Directory -Path (Join-Path $dst 'lib') -Force | Out-Null
Copy-Item (Join-Path $src 'lib\index.js') (Join-Path $dst 'lib\index.js') -Force
Copy-Item (Join-Path $src 'package.json') (Join-Path $dst 'package.json') -Force
Copy-Item (Join-Path $src 'cordis.patch.yml') (Join-Path $dst 'cordis.patch.yml') -Force
Copy-Item (Join-Path $src 'README.md') (Join-Path $dst 'README.md') -Force

# 2. Vendor the single dependency (no npm install inside the profile).
$depName = 'qrcode-terminal'
$depDst = Join-Path $profileDir "node_modules\$depName"
if (-not (Test-Path (Join-Path $depDst 'package.json'))) {
  $tmp = Join-Path $env:TEMP "dsh-qr-dep-$(Get-Random)"
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  Push-Location $tmp
  try {
    # npm pack writes notices to stderr, which $ErrorActionPreference=Stop
    # would treat as fatal inside a script; route the stream away.
    cmd /c "npm pack $depName@0.12.0 2>nul" | Out-Null
    $tgz = Get-ChildItem *.tgz | Select-Object -First 1
    if ($tgz) {
      tar -xzf $tgz.Name
      New-Item -ItemType Directory -Path $depDst -Force | Out-Null
      Copy-Item (Join-Path $tmp 'package\*') $depDst -Recurse -Force
    }
  } finally {
    Pop-Location
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# 3. Register in the profile package.json (dependencies + bundles list).
$pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
if (-not ($pkg.dependencies.PSObject.Properties.Name -contains 'qrcode-hassle-free')) {
  $pkg.dependencies | Add-Member -NotePropertyName 'qrcode-hassle-free' -NotePropertyValue '1.0.0'
}
if ($pkg.dsh.profile.bundles -notcontains 'qrcode-hassle-free') {
  $pkg.dsh.profile.bundles += 'qrcode-hassle-free'
}
$pkg | ConvertTo-Json -Depth 8 | Set-Content $pkgJsonPath -Encoding UTF8

Write-Host "qrcode-hassle-free installed into $profileDir - restart dsh web to apply."
