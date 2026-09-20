# Start GPTWorker MCP server. Project/workspace is selected later from ChatGPT.
param(
    [int]$Port = 3000,
    [switch]$Force,
    [switch]$Detach
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Get-PortOwnerPid([int]$TargetPort) {
    $lines = netstat -ano | Select-String ":$TargetPort\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').ToString().Trim().Split(' ')
        $processId = [int]$parts[-1]
        if ($processId -gt 0) { return $processId }
    }
    return $null
}

function Get-DotEnvValue([string]$Name) {
    if (-not (Test-Path ".env")) { return $null }
    $line = Get-Content ".env" | Where-Object {
        $_ -match "^\s*$Name\s*=" -and -not $_.TrimStart().StartsWith("#")
    } | Select-Object -First 1
    if (-not $line) { return $null }
    $value = ($line -split "=", 2)[1].Trim()
    return $value.Trim("'").Trim('"')
}

function Test-WorkerBuildStale {
    if (-not (Test-Path "dist/index.js")) { return $true }

    $distTime = (Get-Item "dist/index.js").LastWriteTimeUtc
    $inputs = @("src", "package.json", "package-lock.json", "tsconfig.json")

    foreach ($inputPath in $inputs) {
        if (-not (Test-Path $inputPath)) { continue }

        $item = Get-Item $inputPath
        if ($item.PSIsContainer) {
            $newer = Get-ChildItem $inputPath -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTimeUtc -gt $distTime } |
                Select-Object -First 1
            if ($newer) { return $true }
            continue
        }

        if ($item.LastWriteTimeUtc -gt $distTime) { return $true }
    }

    return $false
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

if (-not (Test-Path "worker-state.json")) {
    @{
        current_job = $null
        active_workspace = $null
        status = "idle"
        updated_at = $null
    } | ConvertTo-Json | Set-Content "worker-state.json" -Encoding UTF8
}

$envPort = Get-DotEnvValue "PORT"
if ($envPort -and $Port -eq 3000) { $Port = [int]$envPort }
$env:PORT = $Port

$ChatGptAutoApprove = Get-DotEnvValue "CHATGPT_AUTO_APPROVE"
if ($ChatGptAutoApprove) {
    $env:CHATGPT_AUTO_APPROVE = $ChatGptAutoApprove
}

Write-Host ""
Write-Host "=== GPTWorker ===" -ForegroundColor Cyan
Write-Host "Port: $Port"
Write-Host "Full machine access: ON"
Write-Host "Project workspace: selected from ChatGPT after JOB + FOLDER confirmation"
Write-Host "State: $ScriptDir\worker-state.json"
Write-Host ""

$existingPid = Get-PortOwnerPid -TargetPort $Port
if ($existingPid) {
    $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    $procName = if ($proc) { $proc.ProcessName } else { "unknown" }

    if ($Force) {
        Write-Host "Stopping existing process on port $Port (PID $existingPid - $procName)..." -ForegroundColor Yellow
        Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    } else {
        Write-Host "GPTWorker already appears to be running on port $Port (PID $existingPid)." -ForegroundColor Green
        exit 0
    }
}

if (Test-WorkerBuildStale) {
    Write-Host "Source changed or dist is missing. Building current GPTWorker..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting local Worker..." -ForegroundColor Green
Write-Host "Use @gptworker in ChatGPT after run.bat starts the tunnel." -ForegroundColor DarkGray
Write-Host ""

if ($Detach) {
    $logDir = Join-Path $env:LOCALAPPDATA "GPTWorker\logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $process = Start-Process -FilePath "node.exe" -ArgumentList @("dist/index.js") -WorkingDirectory $ScriptDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "worker.out.log") -RedirectStandardError (Join-Path $logDir "worker.err.log") -PassThru
    Write-Host "Worker PID: $($process.Id)"
    exit 0
}

& node dist/index.js
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "Worker stopped with exit code $exitCode" -ForegroundColor Red
}
exit $exitCode
