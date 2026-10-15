# Native Windows regression tests. Only HKCU:\Software\GPTWorker-AutostartTests-* is mutated.
# Scheduled Task cmdlets are mocked: production Task Scheduler is never changed.
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$trayScript = Join-Path $repoRoot "gptworker-tray.ps1"
$vbsScript = Join-Path $repoRoot "gptworker-tray.vbs"
$source = Get-Content -LiteralPath $trayScript -Raw
$vbsSource = Get-Content -LiteralPath $vbsScript -Raw

$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw "Tray script cannot be parsed." }

# Load ONLY the requested functions, never execute the tray script's top-level
# setup, interactive GUI, actual task registration or production Run key code.
$names = @(
    "Get-StartupLauncher", "Get-StartupCommand",
    "Install-StartupRegistration", "Remove-StartupRegistration",
    "Stop-GptWorkerRuntime", "Stop-TrackedLauncher"
)
foreach ($name in $names) {
    $node = $ast.Find({
        param($candidate)
        $candidate -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $candidate.Name -eq $name
    }, $true)
    if (-not $node) { throw "Missing function: $name" }
    Invoke-Expression $node.Extent.Text
}

function Assert-True([bool]$Actual, [string]$Message) {
    if (-not $Actual) { throw "ASSERT FAILED: $Message" }
}
function Write-TrayLog([string]$Message) { $script:LastLog = $Message }

$script:MockTask = $null
$script:MockRegisterFails = $false
$script:MockUnregisterFails = $false
$script:MockStops = @()

function New-ScheduledTaskAction {
    param([string]$Execute, [string]$Argument, [string]$WorkingDirectory)
    return [pscustomobject]@{
        Execute = $Execute
        Arguments = $Argument
        WorkingDirectory = $WorkingDirectory
    }
}
function New-ScheduledTaskTrigger {
    param([switch]$AtLogOn, [string]$User)
    Assert-True $AtLogOn.IsPresent "Task trigger must be AtLogOn"
    return [pscustomobject]@{ User = $User; Delay = $null }
}
function New-ScheduledTaskPrincipal {
    param([string]$UserId, [string]$LogonType, [string]$RunLevel)
    return [pscustomobject]@{ UserId = $UserId; LogonType = $LogonType; RunLevel = $RunLevel }
}
function New-ScheduledTaskSettingsSet {
    param(
        [switch]$AllowStartIfOnBatteries,
        [switch]$DontStopIfGoingOnBatteries,
        [switch]$StartWhenAvailable,
        [string]$MultipleInstances
    )
    return [pscustomobject]@{ MultipleInstances = $MultipleInstances }
}
function Register-ScheduledTask {
    [CmdletBinding()]
    param(
        [string]$TaskName, $Action, $Trigger, $Principal, $Settings, [switch]$Force
    )
    if ($script:MockRegisterFails) { throw "Simulated Task Scheduler failure" }
    $script:MockTask = [pscustomobject]@{
        TaskName = $TaskName
        Actions = @($Action)
        Triggers = @($Trigger)
        Principal = $Principal
        Settings = $Settings
    }
}
function Get-ScheduledTask {
    [CmdletBinding()]
    param([string]$TaskName)
    if ($script:MockTask -and $TaskName -eq $script:MockTask.TaskName) {
        return $script:MockTask
    }
    return $null
}
function Unregister-ScheduledTask {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([string]$TaskName)
    if ($script:MockUnregisterFails) { throw "Simulated cleanup failure" }
    if ($script:MockTask -and $TaskName -eq $script:MockTask.TaskName) {
        $script:MockTask = $null
    }
}

function Assert-Sentinels {
    $values = Get-ItemProperty -Path $StartupKey
    Assert-True ($values.CadGPT -eq 'cad-sentinel') "CadGPT Run value changed"
    Assert-True ($values.RevitGPT -eq 'revit-sentinel') "RevitGPT Run value changed"
    Assert-True ($values.OtherApp -eq 'other-sentinel') "Other app Run value changed"
}
function Assert-NoWorkerRunValue {
    if (-not (Test-Path -LiteralPath $StartupKey)) { return }
    $values = Get-ItemProperty -Path $StartupKey
    Assert-True (-not $values.PSObject.Properties['GPTWorker']) "GPTWorker Run value should be absent"
}
function Assert-TaskUsesVbs {
    Assert-True ([bool]$script:MockTask) "Scheduled task must exist"
    $action = $script:MockTask.Actions[0]
    $expectedLauncher = Get-StartupLauncher
    Assert-True ($action.Execute -eq $expectedLauncher.Execute) "Task action must use absolute wscript.exe"
    Assert-True ($action.Arguments -eq $expectedLauncher.Arguments) "Task must quote VBS absolute path"
    Assert-True ($action.WorkingDirectory -eq $repoRoot) "Task working directory must be repository"
    Assert-True ($script:MockTask.Triggers[0].Delay -eq 'PT10S') "Task logon delay changed"
    Assert-True ($script:MockTask.Principal.LogonType -eq 'Interactive') "Task must use interactive user"
    Assert-True ($script:MockTask.Principal.RunLevel -eq 'Limited') "Task must not require elevation"
    Assert-True ($script:MockTask.Settings.MultipleInstances -eq 'IgnoreNew') "Task duplicates not suppressed"
}

Assert-True ($env:OS -eq 'Windows_NT') "Native autostart regression requires Windows"
Assert-True ($vbsSource -match 'WshShell\.Run\s+cmd,\s*0,\s*False') "VBS must launch with SW_HIDE"
Assert-True ($source -notmatch 'GetConsoleWindow|Win32ConsoleHider|ShowWindow') "Tray must not hide another terminal window"
Assert-True ($source -match 'Local\\GPTWorkerTray') "Named mutex must remain"
Assert-True ($source -match 'if\s*\(-not\s+\$createdNew\)') "Duplicate instances must exit"
Assert-True ($source -notmatch 'New-Item\s+-Path\s+\$StartupKey\s+-Force') "Destructive Registry key creation returned"

$ScriptDir = $repoRoot
$StartupName = "GPTWorker"
$StartupTaskName = "GPTWorker Startup"
$sandboxRoot = "HKCU:\Software\GPTWorker-AutostartTests-$([guid]::NewGuid().ToString('N'))"
$StartupKey = "$sandboxRoot\Run"

try {
    New-Item -Path $sandboxRoot -ErrorAction Stop | Out-Null

    # New user: when the Run key does not exist, Task Scheduler owns startup
    # and the installer must NOT create a Registry Run key.
    Install-StartupRegistration
    Assert-TaskUsesVbs
    Assert-True (-not (Test-Path -LiteralPath $StartupKey)) "Task success created a Run key"

    # Existing user values survive the migration from a legacy GPTWorker Run value.
    New-Item -Path $StartupKey -ErrorAction Stop | Out-Null
    foreach ($item in @(
        @("CadGPT", "cad-sentinel"),
        @("RevitGPT", "revit-sentinel"),
        @("OtherApp", "other-sentinel"),
        @("GPTWorker", "powershell.exe -File legacy-tray.ps1")
    )) {
        New-ItemProperty -Path $StartupKey -Name $item[0] -Value $item[1] -PropertyType String -ErrorAction Stop | Out-Null
    }

    1..3 | ForEach-Object {
        Install-StartupRegistration
        Assert-TaskUsesVbs
        Assert-NoWorkerRunValue
        Assert-Sentinels
    }

    Remove-StartupRegistration
    Assert-True (-not $script:MockTask) "Uninstall left GPTWorker task"
    Assert-NoWorkerRunValue
    Assert-Sentinels

    # Uninstall must report a failed task removal, not falsely claim success.
    Install-StartupRegistration
    $script:MockUnregisterFails = $true
    $removeRefused = $false
    try { Remove-StartupRegistration } catch { $removeRefused = $true }
    Assert-True $removeRefused "Uninstall must report Task Scheduler removal errors"
    Assert-True ([bool]$script:MockTask) "Uninstall failure unexpectedly removed mock task"
    $script:MockUnregisterFails = $false
    Remove-StartupRegistration
    Assert-NoWorkerRunValue
    Assert-Sentinels

    # Scheduler failure: fallback uses only GPTWorker Run, without deleting sentinels.
    $script:MockRegisterFails = $true
    1..2 | ForEach-Object {
        Install-StartupRegistration
        Assert-True (-not $script:MockTask) "Fallback left a scheduled task"
        Assert-Sentinels
        $runCommand = (Get-ItemProperty -Path $StartupKey).GPTWorker
        Assert-True ($runCommand -eq (Get-StartupCommand)) "Fallback must call VBS through wscript"
        Assert-True ($runCommand -notmatch 'powershell\.exe') "Fallback must not launch PowerShell directly"
    }

    # A stale task must be removed before activating the Run fallback.
    $script:MockRegisterFails = $false
    Install-StartupRegistration
    Assert-TaskUsesVbs
    $script:MockRegisterFails = $true
    Install-StartupRegistration
    Assert-True (-not $script:MockTask) "Stale scheduled task was not cleaned up"
    Assert-True ([bool](Get-ItemProperty -Path $StartupKey).GPTWorker) "Fallback missing after task cleanup"
    Assert-Sentinels

    # If cleanup fails, fail closed rather than introducing two startup owners.
    $script:MockRegisterFails = $false
    Install-StartupRegistration
    $script:MockRegisterFails = $true
    $script:MockUnregisterFails = $true
    $refused = $false
    try { Install-StartupRegistration } catch { $refused = $true }
    Assert-True $refused "Dual-authority situation should fail closed"
    Assert-NoWorkerRunValue
    Assert-Sentinels
    $script:MockUnregisterFails = $false
    Remove-StartupRegistration

    # Key absent + Scheduler failure: create only our own sandbox key/value.
    Remove-Item -LiteralPath $StartupKey -Recurse -Force
    Assert-True (-not (Test-Path -LiteralPath $StartupKey)) "Sandbox key removal failed"
    Install-StartupRegistration
    Assert-True (Test-Path -LiteralPath $StartupKey) "Fallback did not create missing Run key"
    Assert-True ([bool](Get-ItemProperty -Path $StartupKey).GPTWorker) "Fallback Run value missing"
    Remove-StartupRegistration

    # Ownership regression: unrelated process on tunnel health port is not killed.
    function Get-PortOwnerPid { param([int]$TargetPort) return 900001 }
    function Get-Process { param([int]$Id, $ErrorAction) return [pscustomobject]@{ ProcessName = 'CadGPT' } }
    function Test-WorkerHealthy { return $false }
    function Stop-Process { param([int]$Id, [switch]$Force, $ErrorAction) $script:MockStops += $Id }
    function Stop-TrackedLauncher { param($ProcessObject) }
    function Wait-ForCondition { param([scriptblock]$Condition, [int]$TimeoutSeconds) return $true }
    $TunnelHealthPort = 43121
    $WorkerPort = 43120
    $script:TunnelLauncher = $null
    $script:WorkerLauncher = $null
    Stop-GptWorkerRuntime
    Assert-True ($script:MockStops.Count -eq 0) "Stopping GPTWorker touched an unrelated application"

    Write-Host "Windows GPTWorker autostart regression: PASS" -ForegroundColor Green
} finally {
    # Cleanup is restricted to the unique test subtree; never touch production Run.
    Remove-Item -LiteralPath $sandboxRoot -Recurse -Force -ErrorAction SilentlyContinue
}
