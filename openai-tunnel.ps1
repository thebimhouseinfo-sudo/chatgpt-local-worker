# OpenAI Secure MCP Tunnel for ChatGPT Local Worker - stable URL/tunnel identity
param(
    [int]$Port = 0,
    [int]$HealthPort = 0,
    [switch]$Install,
    [switch]$Doctor,
    [switch]$Init,
    [switch]$Force,
    [switch]$WizardPreview,
    [string]$TunnelId = "",
    [string]$ApiKey = "",
    [switch]$NoBrowser,
    [switch]$Detach
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$TUNNEL_VERSION = "v0.0.14"
$BinDir = Join-Path $ScriptDir "bin"
$TunnelExe = Join-Path $BinDir "tunnel-client.exe"
# Keep profile filename for compatibility with existing local installs.
$ProfileName = "codex-local"
$ProfileDir = Join-Path $ScriptDir "profiles"
$ProfileFile = Join-Path $ProfileDir "$ProfileName.yaml"
$ZipName = "tunnel-client-$TUNNEL_VERSION-windows-amd64.zip"
$DownloadUrl = "https://github.com/openai/tunnel-client/releases/download/$TUNNEL_VERSION/$ZipName"
$TunnelsUrl = "https://platform.openai.com/settings/organization/tunnels"
$ApiKeysUrl = "https://platform.openai.com/settings/organization/api-keys"
$ChatGPTUrl = "https://chatgpt.com/"

function Get-DotEnvValue([string]$Name) {
    if (-not (Test-Path ".env")) { return $null }
    $line = Get-Content ".env" | Where-Object {
        $_ -match "^\s*$Name\s*=" -and -not $_.TrimStart().StartsWith("#")
    } | Select-Object -First 1
    if (-not $line) { return $null }
    return (($line -split "=", 2)[1].Trim()).Trim("'").Trim('"')
}

function Get-McpPath {
    $mcpToken = Get-DotEnvValue "MCP_TOKEN"
    if ($mcpToken) { return "/mcp/$mcpToken" }
    return "/mcp"
}

function Set-DotEnvValue([string]$Name, [string]$Value) {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
    }
    $lines = Get-Content ".env"
    $found = $false
    $out = foreach ($line in $lines) {
        if ($line -match "^\s*$Name\s*=" -and -not $line.TrimStart().StartsWith("#")) {
            $found = $true
            "$Name=$Value"
        } else {
            $line
        }
    }
    if (-not $found) {
        $out += "$Name=$Value"
    }
    Set-Content ".env" -Value $out -Encoding UTF8
}

function Get-TunnelClientPath {
    if (Test-Path $TunnelExe) { return $TunnelExe }
    $cmd = Get-Command tunnel-client -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Get-TunnelClientVersion([string]$Path) {
    if (-not $Path -or -not (Test-Path $Path)) { return $null }
    try {
        $line = (& $Path --version 2>$null | Select-Object -First 1)
        if ($line -and $line.ToString() -match '(\d+\.\d+\.\d+)') {
            return $Matches[1]
        }
    } catch {}
    return $null
}

function Install-TunnelClient {
    $targetVersion = $TUNNEL_VERSION.TrimStart('v')

    if (Test-Path $TunnelExe) {
        $installedVersion = Get-TunnelClientVersion $TunnelExe
        if ($installedVersion -eq $targetVersion) {
            Write-Host "tunnel-client $installedVersion da co: $TunnelExe" -ForegroundColor Green
            return $TunnelExe
        }

        $displayVersion = if ($installedVersion) { $installedVersion } else { "unknown" }
        Write-Host "Nang cap tunnel-client $displayVersion -> $targetVersion ..." -ForegroundColor Yellow
        Remove-Item $TunnelExe -Force
    }

    Write-Host "Dang tai tunnel-client $TUNNEL_VERSION ..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    $zipPath = Join-Path $env:TEMP $ZipName

    Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $BinDir -Force

    $candidates = Get-ChildItem -Path $BinDir -Recurse -Filter "tunnel-client.exe" -ErrorAction SilentlyContinue
    if ($candidates.Count -eq 0) {
        throw "Khong tim thay tunnel-client.exe trong $ZipName"
    }

    $extracted = $candidates[0].FullName
    if ($extracted -ne $TunnelExe) {
        Move-Item -Path $extracted -Destination $TunnelExe -Force
        Get-ChildItem $BinDir -Directory | Where-Object { $_.Name -ne "." } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }

    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    Write-Host "Da cai: $TunnelExe" -ForegroundColor Green
    return $TunnelExe
}

function Get-PortOwnerPid([int]$TargetPort) {
    $lines = netstat -ano | Select-String ":$TargetPort\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').ToString().Trim().Split(' ')
        $processId = [int]$parts[-1]
        if ($processId -gt 0) { return $processId }
    }
    return $null
}

function Test-TunnelHealthy([int]$TargetHealthPort) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$TargetHealthPort/readyz" -UseBasicParsing -TimeoutSec 2
        return $resp.Content -match "ready"
    } catch {
        return $false
    }
}

function Stop-ExistingTunnel([int]$TargetHealthPort) {
    $ownerPid = Get-PortOwnerPid -TargetPort $TargetHealthPort
    if (-not $ownerPid) { return }

    $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { "unknown" }
    if (-not $proc -or $proc.ProcessName -ne "tunnel-client") {
        throw "Port $TargetHealthPort dang bi PID $ownerPid ($name) chiem. GPTWorker se khong tu tat process khong xac dinh."
    }

    Write-Host "Dang tat tunnel cu (PID $ownerPid - $name)..." -ForegroundColor Yellow
    Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue

    $deadline = (Get-Date).AddSeconds(5)
    do {
        Start-Sleep -Milliseconds 200
        $stillOwned = Get-PortOwnerPid -TargetPort $TargetHealthPort
        if (-not $stillOwned) { return }
    } while ((Get-Date) -lt $deadline)

    throw "Tunnel cu da duoc yeu cau dung nhung port $TargetHealthPort van chua duoc giai phong."
}

function Ensure-Profile([string]$McpUrl, [string]$TunnelId, [int]$TargetHealthPort) {
    New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
    $yaml = @"
config_version: 1
control_plane:
  tunnel_id: $TunnelId
  api_key: env:CONTROL_PLANE_API_KEY
log:
  level: info
  format: struct-text
health:
  listen_addr: 127.0.0.1:$TargetHealthPort
mcp:
  server_urls:
    - channel: main
      url: $McpUrl
"@
    Set-Content -Path $ProfileFile -Value $yaml -Encoding UTF8
}

function Quote-ProcessArgument([string]$Value) {
    if ($null -eq $Value) { return '""' }
    return '"' + ($Value -replace '"', '\"') + '"'
}

function Test-McpServer([int]$TargetPort) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$TargetPort/health" -UseBasicParsing -TimeoutSec 3
        return $resp.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Show-ConnectorGuide([string]$TunnelId, [int]$UiPort = 8080) {
    Write-Host ""
    Write-Host "=== ChatGPT Plugin (chi lam 1 lan) ===" -ForegroundColor Cyan
    Write-Host "1. Mo ChatGPT Settings -> Plugins va bat Developer mode."
    Write-Host "2. Mo Plugins, nhan + de tao plugin moi."
    Write-Host "3. Name: gptworker."
    Write-Host "4. Connection: Tunnel (KHONG chon Server URL)."
    Write-Host "5. Available tunnels: CHON tunnel cua GPTWorker TRONG DANH SACH."
    Write-Host "6. Authentication: No Auth."
    Write-Host "7. KHONG dung 'Use tunnel ID instead'."
    Write-Host "8. Tick xac nhan, sau do Connect/Create."
    Write-Host "9. Sau khi tao plugin xong, RESTART WINDOWS de kiem tra GPTWorker auto-start."
    Write-Host "10. Windows len lai -> mo ChatGPT -> go @gptworker."
    Write-Host "11. Go gptworker/help va doc huong dan truoc Job dau tien."
    Write-Host ""
    Write-Host "KHONG nhap http://127.0.0.1:3000/mcp vao ChatGPT." -ForegroundColor Yellow
    Write-Host "Tunnel ID chi dung noi bo de GPTWorker khoi dong Secure MCP Tunnel; UI ChatGPT chon tunnel tu list." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Tunnel UI: http://127.0.0.1:$UiPort/ui" -ForegroundColor Green
    Write-Host "Ready:     http://127.0.0.1:$UiPort/readyz" -ForegroundColor Green
}

function Test-TunnelIdValue([string]$Value) {
    return [bool]($Value -and $Value -match '^tunnel_[0-9a-f]{32}$')
}

function Test-ApiKeyValue([string]$Value) {
    return [bool]($Value -and $Value -match '^sk-')
}

function Show-SetupWizardStep(
    [string]$Step,
    [string]$Title,
    [string]$Subtitle = ""
) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkCyan
    Write-Host ("  STEP {0}  {1}" -f $Step, $Title) -ForegroundColor Cyan
    if ($Subtitle) {
        Write-Host ("  {0}" -f $Subtitle) -ForegroundColor DarkGray
    }
    Write-Host "================================================================" -ForegroundColor DarkCyan
    Write-Host ""
}

function Show-PreviewHint([string]$Label) {
    Write-Host "  PREVIEW MODE" -ForegroundColor Magenta
    Write-Host "  This field is UX-only in setup-test.bat." -ForegroundColor DarkGray
    Write-Host "  Enter ANY text to continue; it will not be validated or saved." -ForegroundColor DarkGray
    Write-Host ("  Example: {0}" -f $Label) -ForegroundColor DarkGray
    Write-Host ""
}

function Save-TunnelCredentials([string]$ResolvedTunnelId, [string]$ResolvedApiKey) {
    if (-not (Test-TunnelIdValue $ResolvedTunnelId)) {
        throw "OPENAI_TUNNEL_ID khong hop le. Dang tunnel_ + 32 ky tu hex."
    }
    if (-not (Test-ApiKeyValue $ResolvedApiKey)) {
        throw "OPENAI_TUNNEL_API_KEY khong hop le. API key phai bat dau bang sk-."
    }

    Set-DotEnvValue "OPENAI_TUNNEL_ID" $ResolvedTunnelId
    Set-DotEnvValue "OPENAI_TUNNEL_API_KEY" $ResolvedApiKey
}

function Resolve-TunnelIdForSetup {
    if ($WizardPreview -and $TunnelId) {
        Show-SetupWizardStep -Step "1/2" -Title "Secure MCP Tunnel" -Subtitle "Preview input supplied by setup-test."
        Show-PreviewHint -Label "anything"
        Write-Host "[PREVIEW] Tunnel input accepted." -ForegroundColor Green
        return $TunnelId
    }

    if (Test-TunnelIdValue $TunnelId) {
        Write-Host "[1/2] Secure MCP Tunnel: nhan tu setup UI" -ForegroundColor Green
        return $TunnelId
    }

    if (-not $WizardPreview) {
        $existingId = Get-DotEnvValue "OPENAI_TUNNEL_ID"
        if (Test-TunnelIdValue $existingId) {
            Write-Host "[1/2] Secure MCP Tunnel: da cau hinh" -ForegroundColor Green
            Write-Host "Tunnel ID: $existingId" -ForegroundColor DarkGray
            return $existingId
        }
    }

    if ($NoBrowser) {
        throw "Chua co Tunnel ID. Setup UI phai cung cap -TunnelId."
    }

    Show-SetupWizardStep -Step "1/2" -Title "Create Secure MCP Tunnel" -Subtitle "OpenAI Tunnels will open in your browser."
    Write-Host "Create a tunnel for GPTWorker, then copy its Tunnel ID." -ForegroundColor White
    if ($WizardPreview) {
        Show-PreviewHint -Label "demo-tunnel"
    } else {
        Write-Host "Expected format: tunnel_ + 32 hex characters." -ForegroundColor DarkGray
        Write-Host ""
    }

    Start-Process $TunnelsUrl

    while ($true) {
        $prompt = if ($WizardPreview) { "Preview Tunnel ID (any text)" } else { "Paste Tunnel ID (tunnel_...)" }
        $value = Read-Host $prompt

        if ($WizardPreview) {
            if ([string]::IsNullOrWhiteSpace($value)) {
                Write-Host "Please type something so the input step can be previewed." -ForegroundColor Yellow
                continue
            }
            Write-Host "[PREVIEW] Accepted. No validation and no save will occur." -ForegroundColor Green
            return $value
        }

        if (Test-TunnelIdValue $value) {
            Write-Host "[OK] Tunnel ID hop le." -ForegroundColor Green
            return $value
        }
        Write-Host "Tunnel ID khong hop le. Hay copy dung gia tri tunnel_... tu trang OpenAI Tunnels." -ForegroundColor Red
    }
}

function Resolve-ApiKeyForSetup {
    if ($WizardPreview -and $ApiKey) {
        Show-SetupWizardStep -Step "2/2" -Title "Runtime API Key" -Subtitle "Preview input supplied by setup-test."
        Show-PreviewHint -Label "anything"
        Write-Host "[PREVIEW] API key input accepted." -ForegroundColor Green
        return $ApiKey
    }

    if (Test-ApiKeyValue $ApiKey) {
        Write-Host "[2/2] Runtime API key: nhan tu setup UI" -ForegroundColor Green
        return $ApiKey
    }

    if (-not $WizardPreview) {
        $existingKey = Get-DotEnvValue "OPENAI_TUNNEL_API_KEY"
        if (Test-ApiKeyValue $existingKey) {
            Write-Host "[2/2] Runtime API key: da cau hinh" -ForegroundColor Green
            return $existingKey
        }
    }

    if ($NoBrowser) {
        throw "Chua co Runtime API key. Setup UI phai cung cap -ApiKey."
    }

    Show-SetupWizardStep -Step "2/2" -Title "Create Runtime API Key" -Subtitle "OpenAI API Keys will open in your browser."
    Write-Host "Create a Runtime API key for GPTWorker." -ForegroundColor White
    Write-Host "Required permission in real setup: Tunnels Read + Use." -ForegroundColor DarkGray
    if ($WizardPreview) {
        Show-PreviewHint -Label "demo-api-key"
    } else {
        Write-Host "Expected format: key begins with sk-." -ForegroundColor DarkGray
        Write-Host ""
    }

    Start-Process $ApiKeysUrl

    while ($true) {
        $prompt = if ($WizardPreview) { "Preview API key (any text)" } else { "Paste Runtime API key (sk-...)" }
        $value = Read-Host $prompt

        if ($WizardPreview) {
            if ([string]::IsNullOrWhiteSpace($value)) {
                Write-Host "Please type something so the input step can be previewed." -ForegroundColor Yellow
                continue
            }
            Write-Host "[PREVIEW] Accepted. No validation and no save will occur." -ForegroundColor Green
            return $value
        }

        if (Test-ApiKeyValue $value) {
            Write-Host "[OK] Runtime API key hop le." -ForegroundColor Green
            return $value
        }
        Write-Host "API key khong hop le. Hay copy dung Runtime API key bat dau bang sk-." -ForegroundColor Red
    }
}

function Invoke-TunnelInit {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkCyan
    if ($WizardPreview) {
        Write-Host "  GPTWorker Connection Wizard - UX Preview" -ForegroundColor Cyan
        Write-Host "  Safe dry-run: arbitrary input accepted, nothing saved." -ForegroundColor Magenta
    } else {
        Write-Host "  GPTWorker - Connect OpenAI Secure MCP Tunnel" -ForegroundColor Cyan
        Write-Host "  Real setup: credentials are validated before saving." -ForegroundColor DarkGray
    }
    Write-Host "================================================================" -ForegroundColor DarkCyan
    Write-Host ""

    # These resolver functions are the setup core. setup.bat uses the interactive
    # path today; a future GUI wizard can pass -TunnelId/-ApiKey -NoBrowser and
    # reuse the same validation, persistence, doctor, and tunnel configuration.
    $resolvedTunnelId = Resolve-TunnelIdForSetup
    $resolvedApiKey = Resolve-ApiKeyForSetup

    if ($WizardPreview) {
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor DarkCyan
        Write-Host "  PREVIEW COMPLETE" -ForegroundColor Green
        Write-Host "================================================================" -ForegroundColor DarkCyan
        Write-Host "  [OK] Tunnel input screen" -ForegroundColor Green
        Write-Host "  [OK] API key input screen" -ForegroundColor Green
        Write-Host "  [SKIP] Credential format validation" -ForegroundColor Yellow
        Write-Host "  [SKIP] Saving .env" -ForegroundColor Yellow
        Write-Host "  [SKIP] Tunnel doctor / connection changes" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Nothing from this preview was saved." -ForegroundColor DarkGray
        return
    }

    Save-TunnelCredentials -ResolvedTunnelId $resolvedTunnelId -ResolvedApiKey $resolvedApiKey

    Write-Host ""
    Write-Host "Dang kiem tra Tunnel + API key..." -ForegroundColor Cyan

    $envPort = Get-DotEnvValue "PORT"
    $resolvedPort = if ($Port -gt 0) { $Port } elseif ($envPort) { [int]$envPort } else { 3000 }
    $envHealth = Get-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT"
    $resolvedHealth = if ($HealthPort -gt 0) { $HealthPort } elseif ($envHealth) { [int]$envHealth } else { 8080 }
    $mcpPath = Get-McpPath
    $mcpUrl = "http://127.0.0.1:$resolvedPort$mcpPath"
    Ensure-Profile -McpUrl $mcpUrl -TunnelId $resolvedTunnelId -TargetHealthPort $resolvedHealth

    $bin = Install-TunnelClient
    $env:OPENAI_TUNNEL_API_KEY = $resolvedApiKey
    $env:CONTROL_PLANE_API_KEY = $resolvedApiKey
    $env:CONTROL_PLANE_TUNNEL_ID = $resolvedTunnelId

    # setup/doctor needs the health listener free. A previous tunnel instance
    # from run.bat/tray must be stopped before doctor can bind this port.
    $healthOwner = Get-PortOwnerPid -TargetPort $resolvedHealth
    if ($healthOwner) {
        if ($Force) {
            Stop-ExistingTunnel -TargetHealthPort $resolvedHealth
        } else {
            $proc = Get-Process -Id $healthOwner -ErrorAction SilentlyContinue
            $name = if ($proc) { $proc.ProcessName } else { "unknown" }
            throw "Port $resolvedHealth dang bi PID $healthOwner ($name) chiem. Chay Init voi -Force hoac tat tunnel cu truoc."
        }
    }

    # Re-check immediately before doctor. It is not enough that setup saw the
    # Worker healthy a few seconds earlier.
    if (-not (Test-McpServer $resolvedPort)) {
        throw "Local GPTWorker khong con reachable tai http://127.0.0.1:$resolvedPort/health ngay truoc tunnel doctor."
    }

    Write-Host ""
    Write-Host "tunnel-client version: $(& $bin --version)" -ForegroundColor DarkGray
    Write-Host "Chay doctor..." -ForegroundColor Yellow
    & $bin doctor --profile-file $ProfileFile --explain
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Doctor that bai. Xem FAILED_CHECKS phia tren." -ForegroundColor Red
        Write-Host "Neu fail mcp_server_reachable/oauth_metadata:" -ForegroundColor Yellow
        Write-Host "  - local GPTWorker phai dang chay tren port MCP truoc khi doctor."
        Write-Host "  - kiem tra http://127.0.0.1:$resolvedPort/health."
        Write-Host "Neu fail tunnel_id/control_plane_api_key:" -ForegroundColor Yellow
        Write-Host "  - Tunnel ID va runtime key phai cung organization/workspace."
        Write-Host "  - Runtime API key can Tunnels Read + Use."
        Write-Host "  - Neu vua tao tunnel/doi role, cho propagation roi thu lai."
        Write-Host ""
        Write-Host "Dang thu doc metadata tunnel bang CHINH runtime key de tach loi auth khoi loi local..." -ForegroundColor Yellow

        $savedAdminKey = $env:OPENAI_ADMIN_KEY
        try {
            Remove-Item Env:OPENAI_ADMIN_KEY -ErrorAction SilentlyContinue
            & $bin admin tunnels get $resolvedTunnelId --json
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Runtime key khong doc duoc tunnel. Kiem tra organization/workspace va RBAC Read+Use." -ForegroundColor Red
            } else {
                Write-Host "Runtime key doc duoc tunnel metadata; xem CHECK fail phia tren de sua local/profile." -ForegroundColor Green
            }
        } finally {
            if ($savedAdminKey) { $env:OPENAI_ADMIN_KEY = $savedAdminKey }
        }
        exit 1
    }

    Write-Host ""
    Write-Host "[OK] Tunnel va API key da duoc cau hinh." -ForegroundColor Green
    Write-Host "Tunnel/API setup da hop le." -ForegroundColor Green
    Show-ConnectorGuide -TunnelId $resolvedTunnelId
}

# --- Main ---

if ($Init) {
    Invoke-TunnelInit
    exit 0
}

if ($Install) {
    Install-TunnelClient | Out-Null
    exit 0
}

$envPort = Get-DotEnvValue "PORT"
$resolvedPort = if ($Port -gt 0) { $Port } elseif ($envPort) { [int]$envPort } else { 3000 }
$envHealth = Get-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT"
$resolvedHealth = if ($HealthPort -gt 0) { $HealthPort } elseif ($envHealth) { [int]$envHealth } else { 8080 }
$tunnelId = Get-DotEnvValue "OPENAI_TUNNEL_ID"
$apiKey = Get-DotEnvValue "OPENAI_TUNNEL_API_KEY"

if (-not $tunnelId -or -not $apiKey) {
    Write-Host ""
    Write-Host "[CHUA CAU HINH] Chay setup lan dau:" -ForegroundColor Yellow
    Write-Host "  .\openai-tunnel.ps1 -Init" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Hoac them vao .env:" -ForegroundColor DarkGray
    Write-Host "  OPENAI_TUNNEL_ID=tunnel_..."
    Write-Host "  OPENAI_TUNNEL_API_KEY=sk-..."
    exit 1
}

$bin = Get-TunnelClientPath
if (-not $bin) {
    $bin = Install-TunnelClient
}

$mcpPath = Get-McpPath
$mcpUrl = "http://127.0.0.1:$resolvedPort$mcpPath"
Ensure-Profile -McpUrl $mcpUrl -TunnelId $tunnelId -TargetHealthPort $resolvedHealth

$env:OPENAI_TUNNEL_API_KEY = $apiKey
$env:CONTROL_PLANE_API_KEY = $apiKey
$env:CONTROL_PLANE_TUNNEL_ID = $tunnelId

$existingPid = Get-PortOwnerPid -TargetPort $resolvedHealth
if ($existingPid -and (Test-TunnelHealthy $resolvedHealth)) {
    if (-not $Force) {
        Write-Host ""
        Write-Host "[OK] Tunnel DA CHAY san (PID $existingPid, port $resolvedHealth)" -ForegroundColor Green
        Write-Host "Khong can mo lai - chi chay 1 instance tunnel-client." -ForegroundColor Yellow
        Write-Host "Muon restart: .\openai-tunnel.ps1 -Force" -ForegroundColor DarkGray
        Write-Host "Hoac tat: Stop-Process -Id $existingPid -Force" -ForegroundColor DarkGray
        Show-ConnectorGuide -TunnelId $tunnelId -UiPort $resolvedHealth
        exit 0
    }
    Stop-ExistingTunnel -TargetHealthPort $resolvedHealth
} elseif ($existingPid) {
    if ($Force) {
        Stop-ExistingTunnel -TargetHealthPort $resolvedHealth
    } else {
        Write-Host ""
        Write-Host "[LOI] Port $resolvedHealth dang bi PID $existingPid chiem (khong phai tunnel healthy)" -ForegroundColor Red
        Write-Host "Chay lai voi -Force de tat process cu, hoac doi port trong .env:" -ForegroundColor Yellow
        Write-Host "  OPENAI_TUNNEL_HEALTH_PORT=8081" -ForegroundColor Cyan
        exit 1
    }
}

if ($Doctor) {
    & $bin doctor --profile-file $ProfileFile --explain
    exit $LASTEXITCODE
}

if (-not (Test-McpServer $resolvedPort)) {
    Write-Host ""
    Write-Host "[CANH BAO] MCP server chua chay tai http://127.0.0.1:$resolvedPort" -ForegroundColor Yellow
    Write-Host "Mo terminal khac va chay: .\start.ps1 -Force" -ForegroundColor Cyan
    Write-Host ""
    $answer = Read-Host "Van chay tunnel? (y/n)"
    if ($answer -notmatch '^[yY]') { exit 1 }
}

Write-Host ""
Write-Host "=== OpenAI Secure MCP Tunnel ===" -ForegroundColor Cyan
Write-Host "Tunnel ID:  $tunnelId"
Write-Host "MCP local:  $mcpUrl"
Write-Host "Health UI:  http://127.0.0.1:$resolvedHealth/ui"
Write-Host ""
Write-Host "URL on dinh - khong doi moi lan chay (khac cloudflared)" -ForegroundColor Green
Write-Host "Nhan Ctrl+C de dung tunnel" -ForegroundColor DarkGray
Write-Host ""

if ($Detach) {
    $logDir = Join-Path $env:LOCALAPPDATA "GPTWorker\logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $stdoutLog = Join-Path $logDir "tunnel.out.log"
    $stderrLog = Join-Path $logDir "tunnel.err.log"
    $quotedProfile = Quote-ProcessArgument $ProfileFile
    $argumentLine = "run --profile-file $quotedProfile"

    try {
        $process = Start-Process -FilePath $bin -ArgumentList $argumentLine -WorkingDirectory $ScriptDir -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
    } catch {
        Write-Error "Failed to start Secure MCP Tunnel: $($_.Exception.Message)"
        exit 1
    }

    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) {
        Write-Error "Secure MCP Tunnel exited immediately with code $($process.ExitCode)."
        if (Test-Path $stderrLog) {
            Write-Host "--- tunnel.err.log ---"
            Get-Content $stderrLog -Tail 40
        }
        exit 1
    }

    Write-Host "Tunnel PID: $($process.Id)"
    exit 0
}

Show-ConnectorGuide -TunnelId $tunnelId -UiPort $resolvedHealth

& $bin run --profile-file $ProfileFile
exit $LASTEXITCODE
