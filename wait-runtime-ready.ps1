param(
    [int]$WorkerPort = 3000,
    [int]$TunnelHealthPort = 8080,
    [int]$TimeoutSeconds = 75
)

$ErrorActionPreference = "SilentlyContinue"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

do {
    $workerOk = $false
    $tunnelOk = $false

    try {
        $worker = Invoke-RestMethod "http://127.0.0.1:$WorkerPort/health" -TimeoutSec 2
        $workerOk = $worker.name -eq "chatgpt-local-worker" -and $worker.status -eq "ok"
    } catch {}

    try {
        $tunnel = Invoke-WebRequest "http://127.0.0.1:$TunnelHealthPort/readyz" -UseBasicParsing -TimeoutSec 2
        $tunnelOk = $tunnel.StatusCode -eq 200 -and $tunnel.Content -match "ready"
    } catch {}

    if ($workerOk -and $tunnelOk) {
        Write-Host "[OK] GPTWorker Worker + Secure MCP Tunnel are ready." -ForegroundColor Green
        exit 0
    }

    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

Write-Host "[ERROR] GPTWorker runtime did not become ready within $TimeoutSeconds seconds." -ForegroundColor Red
Write-Host "Worker: http://127.0.0.1:$WorkerPort/health"
Write-Host "Tunnel: http://127.0.0.1:$TunnelHealthPort/readyz"
Write-Host ""

$logDir = Join-Path $env:LOCALAPPDATA "GPTWorker\logs"

try {
    $worker = Invoke-RestMethod "http://127.0.0.1:$WorkerPort/health" -TimeoutSec 2
    $workerOk = $worker.name -eq "chatgpt-local-worker" -and $worker.status -eq "ok"
} catch {
    $workerOk = $false
}

try {
    $tunnel = Invoke-WebRequest "http://127.0.0.1:$TunnelHealthPort/readyz" -UseBasicParsing -TimeoutSec 2
    $tunnelOk = $tunnel.StatusCode -eq 200 -and $tunnel.Content -match "ready"
} catch {
    $tunnelOk = $false
}

if (-not $workerOk) {
    Write-Host "[FAIL] Worker is not healthy." -ForegroundColor Red
    foreach ($name in @("worker-launcher.err.log", "worker.err.log", "worker-launcher.out.log", "worker.out.log")) {
        $file = Join-Path $logDir $name
        if (Test-Path $file) {
            Write-Host "--- $name ---" -ForegroundColor Yellow
            Get-Content $file -Tail 40
        }
    }
} elseif (-not $tunnelOk) {
    Write-Host "[OK] Worker is healthy." -ForegroundColor Green
    Write-Host "[FAIL] Secure MCP Tunnel is not healthy." -ForegroundColor Red
    foreach ($name in @("tunnel-launcher.err.log", "tunnel.err.log", "tunnel-launcher.out.log", "tunnel.out.log")) {
        $file = Join-Path $logDir $name
        if (Test-Path $file) {
            Write-Host "--- $name ---" -ForegroundColor Yellow
            Get-Content $file -Tail 40
        }
    }
}

exit 1
