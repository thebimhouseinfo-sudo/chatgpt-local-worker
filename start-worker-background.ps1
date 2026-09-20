param(
    [int]$Port = 3000,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $env:LOCALAPPDATA "GPTWorker\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$startScript = Join-Path $ScriptDir "start.ps1"
$forceArg = if ($Force) { " -Force" } else { "" }
$argumentString = '-NoProfile -ExecutionPolicy Bypass -File "' + $startScript + '" -Port ' + $Port + $forceArg

$process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $argumentString `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir "worker.out.log") `
    -RedirectStandardError (Join-Path $LogDir "worker.err.log") `
    -PassThru

Write-Host "Worker launcher PID: $($process.Id)"
