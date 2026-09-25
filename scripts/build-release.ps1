param(
    [switch]$SkipTests,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

function Step([string]$Text) {
    Write-Host ""
    Write-Host ("==> " + $Text) -ForegroundColor Cyan
}

function Need([string]$Command, [string]$Message) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw $Message
    }
}

Need "node" "Node.js is required to build a GPTWorker release."
Need "npm" "npm is required to build a GPTWorker release."

$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = [string]$pkg.version
$releaseRoot = Join-Path $RepoRoot "release"
$stage = Join-Path $releaseRoot "staging\GPTWorker"
$outputDir = Join-Path $releaseRoot "out"

Step "Developer build for GPTWorker $version"
& npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

if (-not $SkipTests) {
    & npm run validate:jobs
    if ($LASTEXITCODE -ne 0) { throw "Job validation failed" }
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Test suite failed" }
}

Step "Creating clean installer staging directory"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$rootFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".env.example",
    "LICENSE",
    "README.md",
    "setup.bat",
    "openai-tunnel.ps1",
    "reset-runtime.ps1",
    "start.ps1",
    "start-worker-background.ps1",
    "wait-runtime-ready.ps1",
    "wait-tray-ready.ps1",
    "gptworker-tray.ps1",
    "gptworker-tray.vbs",
    "gptworker icon.png"
)

foreach ($file in $rootFiles) {
    if (-not (Test-Path $file)) { throw "Release file missing: $file" }
    Copy-Item $file (Join-Path $stage $file) -Force
}

# Generate a native Windows .ico from the branded PNG so installer,
# Start Menu and Desktop shortcuts show the GPTWorker icon.
Add-Type -AssemblyName System.Drawing
$pngPath = Join-Path $stage "gptworker icon.png"
$icoPath = Join-Path $stage "gptworker.ico"
$source = [System.Drawing.Image]::FromFile($pngPath)
$bitmap = [System.Drawing.Bitmap]::new(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage($source, 0, 0, 64, 64)
$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Create($icoPath)
try {
    $icon.Save($stream)
} finally {
    $stream.Dispose()
    $icon.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
}
if (-not (Test-Path $icoPath)) { throw "Failed to generate gptworker.ico" }

foreach ($dir in @("src", "jobs", "docs")) {
    if (-not (Test-Path $dir)) { throw "Release directory missing: $dir" }
    Copy-Item $dir (Join-Path $stage $dir) -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $stage "scripts") | Out-Null
foreach ($file in @(
    "scripts\setup-flow.ps1",
    "scripts\setup-agent-browser.mjs",
    "scripts\verify-browser-mcp.mjs"
)) {
    if (-not (Test-Path $file)) { throw "Release script missing: $file" }
    Copy-Item $file (Join-Path $stage $file) -Force
}

$commit = "unknown"
if (Get-Command git -ErrorAction SilentlyContinue) {
    try { $commit = (& git rev-parse --short=12 HEAD).Trim() } catch {}
}

@{
    name = "GPTWorker"
    version = $version
    commit = $commit
    built_at = (Get-Date).ToUniversalTime().ToString("o")
    designer = "Nam Trịnh"
} | ConvertTo-Json | Set-Content (Join-Path $stage "release-manifest.json") -Encoding UTF8

Write-Host "Staging ready: $stage" -ForegroundColor Green

if ($SkipInstaller) {
    Write-Host "Installer build skipped." -ForegroundColor Yellow
    exit 0
}

Step "Ensuring Inno Setup is available"
$isccPath = $null
$isccCommand = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($isccCommand) {
    $isccPath = $isccCommand.Source
}

$programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
$defaultIscc = Join-Path $programFilesX86 "Inno Setup 6\ISCC.exe"
if (-not $isccPath -and (Test-Path $defaultIscc)) {
    $isccPath = $defaultIscc
}

if (-not $isccPath) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        & winget install --id JRSoftware.InnoSetup --exact --silent --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) { throw "Unable to install Inno Setup with winget." }
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        & choco install innosetup -y --no-progress
        if ($LASTEXITCODE -ne 0) { throw "Unable to install Inno Setup with Chocolatey." }
    } else {
        throw "Inno Setup is not installed and neither winget nor Chocolatey is available."
    }

    if (Test-Path $defaultIscc) {
        $isccPath = $defaultIscc
    } else {
        $candidate = Get-ChildItem "C:\Program Files*" -Filter ISCC.exe -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($candidate) { $isccPath = $candidate.FullName }
    }
}

if (-not $isccPath -or -not (Test-Path $isccPath)) {
    throw "Inno Setup compiler ISCC.exe was not found."
}

Step "Compiling GPTWorker installer"
$iss = Join-Path $RepoRoot "installer\GPTWorker.iss"
& $isccPath "/DAppVersion=$version" "/DRepoRoot=$RepoRoot" "/DOutputDir=$outputDir" $iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compiler failed." }

$exe = Get-ChildItem $outputDir -Filter "GPTWorker-Setup-*.exe" |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
if (-not $exe) { throw "Installer EXE was not produced." }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " GPTWorker release ready" -ForegroundColor Green
Write-Host " Version : $version"
Write-Host " EXE     : $($exe.FullName)"
Write-Host "============================================" -ForegroundColor Green
