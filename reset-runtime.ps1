param(
    [int]$WorkerPort = 3000,
    [int]$TunnelHealthPort = 8080
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Get-PortOwnerPid([int]$TargetPort) {
    $line = netstat -ano |
        Select-String ":$TargetPort\s" |
        Select-String "LISTENING" |
        Select-Object -First 1

    if (-not $line) { return $null }

    $parts = ($line -replace '\s+', ' ').ToString().Trim().Split(' ')
    $ownerPid = [int]$parts[-1]
    return $(if ($ownerPid -gt 0) { $ownerPid } else { $null })
}

function Wait-PortFree([int]$TargetPort, [int]$TimeoutSeconds = 5) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (-not (Get-PortOwnerPid $TargetPort)) { return }
        Start-Sleep -Milliseconds 200
    } while ((Get-Date) -lt $deadline)

    throw "Port $TargetPort was not released within $TimeoutSeconds seconds."
}

function Stop-TrayHost {
    $trayPath = [IO.Path]::GetFullPath((Join-Path $ScriptDir "gptworker-tray.ps1"))
    $trayProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ProcessId -ne $PID -and
            ($_.Name -ieq "powershell.exe" -or $_.Name -ieq "pwsh.exe") -and
            $_.CommandLine -and
            $_.CommandLine.IndexOf($trayPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
        }

    foreach ($proc in $trayProcesses) {
        Write-Host "Stopping old GPTWorker tray host PID $($proc.ProcessId)..." -ForegroundColor Yellow
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }

    $readyPath = Join-Path $env:LOCALAPPDATA "GPTWorker\tray-ready.json"
    Remove-Item $readyPath -Force -ErrorAction SilentlyContinue
}

function Stop-OldTunnel {
    $ownerPid = Get-PortOwnerPid $TunnelHealthPort
    if (-not $ownerPid) { return }

    $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { "unknown" }

    if (-not $proc -or $proc.ProcessName -ne "tunnel-client") {
        throw "Port $TunnelHealthPort is occupied by PID $ownerPid ($name), not GPTWorker tunnel-client. Refusing to kill it."
    }

    Write-Host "Stopping old tunnel-client PID $ownerPid..." -ForegroundColor Yellow
    Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
    Wait-PortFree $TunnelHealthPort
}

function Stop-OldWorker {
    $ownerPid = Get-PortOwnerPid $WorkerPort
    if (-not $ownerPid) { return }

    $isGptWorker = $false
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$WorkerPort/health" -TimeoutSec 2
        $isGptWorker = $health.name -eq "chatgpt-local-worker"
    } catch {}

    $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { "unknown" }

    if (-not $isGptWorker) {
        throw "Port $WorkerPort is occupied by PID $ownerPid ($name), but /health does not identify it as GPTWorker. Refusing to kill it."
    }

    Write-Host "Stopping old GPTWorker PID $ownerPid..." -ForegroundColor Yellow
    Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
    Wait-PortFree $WorkerPort
}

Stop-TrayHost
Stop-OldTunnel
Stop-OldWorker

Write-Host "[OK] Previous GPTWorker runtime has been cleared safely." -ForegroundColor Green
