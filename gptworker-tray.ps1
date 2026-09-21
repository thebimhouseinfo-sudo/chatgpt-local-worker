# GPTWorker source tray host for Windows.
# This is the pre-packaging desktop runtime used for final source testing.
param(
    [switch]$InstallStartup,
    [switch]$RemoveStartup,
    [switch]$RestartRuntimeOnStart
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$StartupKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$StartupName = "GPTWorker"
$GuidePath = Join-Path $ScriptDir "docs\setup-guide\index.html"
$LogDir = Join-Path $env:LOCALAPPDATA "GPTWorker\logs"
$TrayLog = Join-Path $LogDir "tray.log"
$TrayErrorLog = Join-Path $LogDir "tray.err.log"
$TrayReadyPath = Join-Path (Split-Path -Parent $LogDir) "tray-ready.json"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-TrayLog([string]$Message) {
    $line = "[$((Get-Date).ToString('s'))] $Message"
    Add-Content -Path $TrayLog -Value $line -Encoding UTF8
}

trap {
    try {
        $detail = ($_ | Out-String).Trim()
        Add-Content -Path $TrayErrorLog -Value "[$((Get-Date).ToString('s'))] $detail" -Encoding UTF8
        Remove-Item $TrayReadyPath -Force -ErrorAction SilentlyContinue
    } catch {}
    exit 1
}

Write-TrayLog "Tray host starting. PID=$PID"
Remove-Item $TrayReadyPath -Force -ErrorAction SilentlyContinue

# Ensure any associated console window is hidden immediately
try {
    $hideConsoleDefinition = @'
    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    public static extern System.IntPtr GetConsoleWindow();
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
'@
    $win32Console = Add-Type -MemberDefinition $hideConsoleDefinition -Name "Win32ConsoleHider" -Namespace "GPTWorker" -PassThru -ErrorAction SilentlyContinue
    if ($win32Console) {
        $hwnd = [GPTWorker.Win32ConsoleHider]::GetConsoleWindow()
        if ($hwnd -ne [System.IntPtr]::Zero) {
            [void][GPTWorker.Win32ConsoleHider]::ShowWindow($hwnd, 0)
        }
    }
} catch {}

function Get-StartupCommand {
    $vbsPath = Join-Path $ScriptDir "gptworker-tray.vbs"
    if (Test-Path $vbsPath) {
        return 'wscript.exe "' + $vbsPath + '"'
    }
    return 'powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
}

function Install-StartupRegistration {
    New-Item -Path $StartupKey -Force | Out-Null
    New-ItemProperty -Path $StartupKey -Name $StartupName -Value (Get-StartupCommand) -PropertyType String -Force | Out-Null
    Write-Host "[OK] GPTWorker will start automatically when this Windows user signs in." -ForegroundColor Green
}

function Remove-StartupRegistration {
    Remove-ItemProperty -Path $StartupKey -Name $StartupName -ErrorAction SilentlyContinue
    Write-Host "[OK] GPTWorker Windows auto-start removed." -ForegroundColor Green
}

if ($InstallStartup) {
    Install-StartupRegistration
    exit 0
}

if ($RemoveStartup) {
    Remove-StartupRegistration
    exit 0
}

if ($env:OS -ne "Windows_NT") {
    throw "GPTWorker tray host is Windows-only."
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, "Local\GPTWorkerTray", [ref]$createdNew)
if (-not $createdNew) {
    Write-TrayLog "Another GPTWorker tray instance already owns the mutex; exiting duplicate."
    exit 0
}
Write-TrayLog "Single-instance mutex acquired."

function Get-DotEnvValue([string]$Name) {
    if (-not (Test-Path ".env")) { return $null }
    $line = Get-Content ".env" | Where-Object {
        $_ -match "^\s*$Name\s*=" -and -not $_.TrimStart().StartsWith("#")
    } | Select-Object -First 1
    if (-not $line) { return $null }
    return (($line -split "=", 2)[1].Trim()).Trim("'").Trim('"')
}

$WorkerPortValue = Get-DotEnvValue "PORT"
$WorkerPort = if ($WorkerPortValue) { [int]$WorkerPortValue } else { 3000 }
$TunnelHealthValue = Get-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT"
$TunnelHealthPort = if ($TunnelHealthValue) { [int]$TunnelHealthValue } else { 8080 }

$script:WorkerLauncher = $null
$script:TunnelLauncher = $null
$script:RuntimeState = "Starting"
$script:Exiting = $false

function Get-PortOwnerPid([int]$TargetPort) {
    try {
        $lines = netstat -ano | Select-String ":$TargetPort\s" | Select-String "LISTENING"
        foreach ($line in $lines) {
            $parts = ($line -replace '\s+', ' ').ToString().Trim().Split(' ')
            $processId = [int]$parts[-1]
            if ($processId -gt 0) { return $processId }
        }
    } catch {}
    return $null
}

function Test-WorkerHealthy {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$WorkerPort/health" -TimeoutSec 2
        return $resp.status -eq "ok" -and $resp.name -eq "chatgpt-local-worker"
    } catch {
        return $false
    }
}

function Test-TunnelHealthy {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$TunnelHealthPort/readyz" -UseBasicParsing -TimeoutSec 2
        return $resp.StatusCode -eq 200 -and $resp.Content -match "ready"
    } catch {
        return $false
    }
}

function Wait-ForCondition([scriptblock]$Condition, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (& $Condition) { return $true }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Quote-Argument([string]$Value) {
    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Start-HiddenPowerShell(
    [string]$ScriptPath,
    [string[]]$ExtraArgs,
    [string]$LogPrefix
) {
    $stdout = Join-Path $LogDir "$LogPrefix.out.log"
    $stderr = Join-Path $LogDir "$LogPrefix.err.log"
    $args = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", (Quote-Argument $ScriptPath)
    )
    $args += $ExtraArgs
    $startParams = @{
        FilePath = "powershell.exe"
        ArgumentList = $args
        WindowStyle = "Hidden"
        RedirectStandardOutput = $stdout
        RedirectStandardError = $stderr
        PassThru = $true
    }
    return Start-Process @startParams
}

function Get-DiagnosticWorkState {
    if (-not (Test-Path "worker-state.json")) { return "idle" }
    try {
        $state = Get-Content "worker-state.json" -Raw | ConvertFrom-Json
        if ($state.status) { return [string]$state.status }
    } catch {}
    return "idle"
}

function Get-RuntimeStatus {
    if ($script:RuntimeState -eq "Starting") { return "Starting" }

    $workerOk = Test-WorkerHealthy
    $tunnelOk = Test-TunnelHealthy

    if ($workerOk -and $tunnelOk) {
        $workState = (Get-DiagnosticWorkState).ToLowerInvariant()
        if ($workState -in @("confirmed", "working", "active", "running")) {
            return "Working"
        }
        return "Connected"
    }

    return "Degraded"
}

function Stop-TrackedLauncher($ProcessObject) {
    if (-not $ProcessObject) { return }
    try {
        if (-not $ProcessObject.HasExited) {
            Stop-Process -Id $ProcessObject.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

function Stop-GptWorkerRuntime {
    # Stop only processes that can be positively identified as GPTWorker-owned.
    $tunnelPid = Get-PortOwnerPid -TargetPort $TunnelHealthPort
    if ($tunnelPid) {
        $proc = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "tunnel-client") {
            Stop-Process -Id $tunnelPid -Force -ErrorAction SilentlyContinue
        }
    }

    if (Test-WorkerHealthy) {
        $workerPid = Get-PortOwnerPid -TargetPort $WorkerPort
        if ($workerPid) {
            Stop-Process -Id $workerPid -Force -ErrorAction SilentlyContinue
        }
    }

    Start-Sleep -Milliseconds 400
    Stop-TrackedLauncher $script:TunnelLauncher
    Stop-TrackedLauncher $script:WorkerLauncher
    $script:TunnelLauncher = $null
    $script:WorkerLauncher = $null

    # Give validated GPTWorker processes a moment to release their listening ports
    # before a tray Restart starts fresh instances.
    [void](Wait-ForCondition { -not (Get-PortOwnerPid -TargetPort $TunnelHealthPort) } 5)
    [void](Wait-ForCondition { -not (Get-PortOwnerPid -TargetPort $WorkerPort) } 5)
}

function Start-GptWorkerRuntime {
    $script:RuntimeState = "Starting"
    Update-TrayStatus

    if (-not (Test-Path ".env")) {
        $script:RuntimeState = "Degraded"
        Update-TrayStatus
        return
    }

    if (-not (Test-WorkerHealthy)) {
        $existingPid = Get-PortOwnerPid -TargetPort $WorkerPort
        if ($existingPid) {
            # Never kill an unknown process merely because it owns the configured port.
            $script:RuntimeState = "Degraded"
            Update-TrayStatus
            return
        }

        $script:WorkerLauncher = Start-HiddenPowerShell -ScriptPath (Join-Path $ScriptDir "start.ps1") -ExtraArgs @("-Port", "$WorkerPort", "-Detach") -LogPrefix "worker-launcher"

        if (-not (Wait-ForCondition { Test-WorkerHealthy } 25)) {
            $script:RuntimeState = "Degraded"
            Update-TrayStatus
            return
        }
    }

    if (-not (Test-TunnelHealthy)) {
        $existingPid = Get-PortOwnerPid -TargetPort $TunnelHealthPort
        if ($existingPid) {
            # An occupied health port is not assumed to belong to GPTWorker.
            $script:RuntimeState = "Degraded"
            Update-TrayStatus
            return
        }

        $script:TunnelLauncher = Start-HiddenPowerShell -ScriptPath (Join-Path $ScriptDir "openai-tunnel.ps1") -ExtraArgs @("-Port", "$WorkerPort", "-Detach") -LogPrefix "tunnel-launcher"

        if (-not (Wait-ForCondition { Test-TunnelHealthy } 65)) {
            $script:RuntimeState = "Degraded"
            Update-TrayStatus
            return
        }
    }

    $script:RuntimeState = "Ready"
    Update-TrayStatus
}

function Restart-GptWorkerRuntime {
    $script:RuntimeState = "Starting"
    Update-TrayStatus
    Stop-GptWorkerRuntime
    Start-Sleep -Milliseconds 600
    Start-GptWorkerRuntime
}

function New-TrayIconFromPng([string]$Path) {
    if (-not (Test-Path $Path)) {
        Write-TrayLog "Tray icon asset not found: $Path. Using Windows fallback icon."
        return $null
    }

    try {
        $source = [System.Drawing.Image]::FromFile($Path)
        $bitmap = [System.Drawing.Bitmap]::new(32, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, 32, 32)

        $handle = $bitmap.GetHicon()
        $icon = ([System.Drawing.Icon]::FromHandle($handle)).Clone()

        $graphics.Dispose()
        $bitmap.Dispose()
        $source.Dispose()

        Write-TrayLog "Loaded custom tray icon: $Path"
        return $icon
    } catch {
        Write-TrayLog "Failed to load custom tray icon: $($_.Exception.Message). Using Windows fallback icon."
        return $null
    }
}

$TrayIconPath = Join-Path $ScriptDir "gptworker icon.png"
$script:CustomTrayIcon = New-TrayIconFromPng -Path $TrayIconPath
$brandIcon = if ($script:CustomTrayIcon) {
    $script:CustomTrayIcon
} else {
    [System.Drawing.SystemIcons]::Application
}

$icons = @{
    Starting  = $brandIcon
    Connected = $brandIcon
    Working   = $brandIcon
    Degraded  = $brandIcon
}

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Text = "GPTWorker - Starting"
$notify.Icon = $icons.Starting

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusItem.Enabled = $false
$statusItem.Text = "Status: Starting"
[void]$menu.Items.Add($statusItem)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$guideItem = New-Object System.Windows.Forms.ToolStripMenuItem
$guideItem.Text = "Open setup guide"
[void]$menu.Items.Add($guideItem)

$restartItem = New-Object System.Windows.Forms.ToolStripMenuItem
$restartItem.Text = "Restart GPTWorker"
[void]$menu.Items.Add($restartItem)

[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))

$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "Exit GPTWorker"
[void]$menu.Items.Add($exitItem)

$notify.ContextMenuStrip = $menu
$notify.Visible = $true

@{
    pid = $PID
    ready = $true
    started_at = (Get-Date).ToString("o")
    script = $PSCommandPath
} | ConvertTo-Json | Set-Content -Path $TrayReadyPath -Encoding UTF8
Write-TrayLog "NotifyIcon is visible and tray-ready marker was written."

function Update-TrayStatus {
    if (-not $notify) { return }
    $status = Get-RuntimeStatus
    $statusItem.Text = "Status: $status"
    $notify.Text = "GPTWorker - $status"
    if ($icons.ContainsKey($status)) {
        $notify.Icon = $icons[$status]
    }
}

function Show-Guide {
    if (Test-Path $GuidePath) {
        Start-Process $GuidePath
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            "Setup guide not found: $GuidePath",
            "GPTWorker",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
    }
}

$guideItem.Add_Click({ Show-Guide })
$notify.Add_DoubleClick({ Show-Guide })

$restartItem.Add_Click({
    try {
        Write-TrayLog "Restart requested from tray."
        Restart-GptWorkerRuntime
        Write-TrayLog "Restart completed with status $(Get-RuntimeStatus)."
    } catch {
        Write-TrayLog "Restart failed: $($_.Exception.Message)"
        $script:RuntimeState = "Degraded"
        Update-TrayStatus
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            "GPTWorker restart failed",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
})

$exitItem.Add_Click({
    if ($script:Exiting) { return }
    $script:Exiting = $true
    try { Stop-GptWorkerRuntime } catch {}
    $notify.Visible = $false
    [System.Windows.Forms.Application]::Exit()
})

$menu.Add_Opening({ Update-TrayStatus })

# Low-frequency health refresh only. The tray host does not busy-poll.
$statusTimer = New-Object System.Windows.Forms.Timer
$statusTimer.Interval = 60000
$statusTimer.Add_Tick({ Update-TrayStatus })
$statusTimer.Start()

# Show the tray first, then bootstrap runtime after the Windows message loop begins.
$bootstrapTimer = New-Object System.Windows.Forms.Timer
$bootstrapTimer.Interval = 250
$bootstrapTimer.Add_Tick({
    $bootstrapTimer.Stop()
    try {
        if ($RestartRuntimeOnStart) {
            Write-TrayLog "Fresh source launch requested; restarting GPTWorker runtime before bootstrap."
            Stop-GptWorkerRuntime
        }
        Start-GptWorkerRuntime
        Write-TrayLog "Runtime bootstrap completed with status $(Get-RuntimeStatus)."
    } catch {
        Write-TrayLog "Runtime bootstrap failed: $($_.Exception.Message)"
        $script:RuntimeState = "Degraded"
        Update-TrayStatus
    }
})
$bootstrapTimer.Start()

try {
    [System.Windows.Forms.Application]::Run()
} finally {
    $statusTimer.Stop()
    $bootstrapTimer.Stop()
    Remove-Item $TrayReadyPath -Force -ErrorAction SilentlyContinue
    Write-TrayLog "Tray host exiting."
    $notify.Visible = $false
    $notify.Dispose()
    $menu.Dispose()
    if ($script:CustomTrayIcon) {
        try { $script:CustomTrayIcon.Dispose() } catch {}
    }
    try { $mutex.ReleaseMutex() } catch {}
    $mutex.Dispose()
}
