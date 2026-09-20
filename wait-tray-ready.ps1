param(
    [int]$TimeoutSeconds = 10
)

$ErrorActionPreference = "Stop"
$readyPath = Join-Path $env:LOCALAPPDATA "GPTWorker\tray-ready.json"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

do {
    if (Test-Path $readyPath) {
        try {
            $state = Get-Content $readyPath -Raw | ConvertFrom-Json
            if ($state.ready -eq $true -and $state.pid) {
                $process = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "[OK] GPTWorker tray ready. PID $($state.pid)" -ForegroundColor Green
                    exit 0
                }
            }
        } catch {}
    }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)

Write-Host "[ERROR] GPTWorker tray did not become ready within $TimeoutSeconds seconds." -ForegroundColor Red
exit 1
