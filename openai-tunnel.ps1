# OpenAI Secure MCP Tunnel for ChatGPT Local Worker - stable URL/tunnel identity
param(
    [int]$Port = 0,
    [int]$HealthPort = 0,
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
# GPTWorker-owned tunnel profile.
$ProfileName = "gptworker"
$ProfileDir = Join-Path $ScriptDir "profiles"
$ProfileFile = Join-Path $ProfileDir "$ProfileName.yaml"
$ZipName = "tunnel-client-$TUNNEL_VERSION-windows-amd64.zip"
$DownloadUrl = "https://github.com/openai/tunnel-client/releases/download/$TUNNEL_VERSION/$ZipName"
$TunnelZipSha256 = "784ab8da7b5a88f0109f1fd8aaf0a1c86067430b896dddf307ef7e3cc49fa1a5"
$TunnelsUrl = "https://platform.openai.com/settings/organization/tunnels"
$ApiKeysUrl = "https://platform.openai.com/settings/organization/api-keys"

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

    # Use a unique temp file for every attempt so a truncated/stale ZIP from a
    # previous failed setup can never be reused.
    $zipPath = Join-Path $env:TEMP ("gptworker-" + [guid]::NewGuid().ToString("N") + "-" + $ZipName)
    $downloadOk = $false

    try {
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            Write-Host ("Tai tunnel-client (lan {0}/3)..." -f $attempt) -ForegroundColor DarkGray

            try {
                # curl.exe follows GitHub release redirects reliably on Windows
                # and fails on HTTP errors. Fall back to Invoke-WebRequest when
                # curl is unavailable.
                $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
                if ($curl) {
                    & $curl.Source -fL --retry 2 --retry-delay 2 --connect-timeout 20 -o $zipPath $DownloadUrl
                    if ($LASTEXITCODE -ne 0) {
                        throw "curl.exe download failed with exit code $LASTEXITCODE"
                    }
                } else {
                    Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath -UseBasicParsing
                }

                if (-not (Test-Path $zipPath)) {
                    throw "File ZIP khong duoc tao."
                }

                $fileInfo = Get-Item $zipPath
                if ($fileInfo.Length -lt 1000000) {
                    throw "File tai ve qua nho ($($fileInfo.Length) bytes), co the la trang loi thay vi ZIP."
                }

                # ZIP files begin with PK. This catches HTML/error payloads early.
                $stream = [System.IO.File]::OpenRead($zipPath)
                try {
                    $b1 = $stream.ReadByte()
                    $b2 = $stream.ReadByte()
                } finally {
                    $stream.Dispose()
                }
                if ($b1 -ne 0x50 -or $b2 -ne 0x4B) {
                    throw "File tai ve khong co ZIP signature PK."
                }

                $actualHash = (Get-FileHash -Algorithm SHA256 $zipPath).Hash.ToLowerInvariant()
                if ($actualHash -ne $TunnelZipSha256) {
                    throw "SHA256 khong khop. Expected $TunnelZipSha256, got $actualHash"
                }

                $downloadOk = $true
                break
            } catch {
                Write-Host ("Tai tunnel-client that bai: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
                if ($attempt -lt 3) {
                    Start-Sleep -Seconds 2
                }
            }
        }

        if (-not $downloadOk) {
            throw "Khong tai duoc tunnel-client hop le sau 3 lan thu."
        }

        Write-Host "ZIP da xac minh SHA256." -ForegroundColor Green
        Expand-Archive -Path $zipPath -DestinationPath $BinDir -Force
    } finally {
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    }

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

function Show-ConnectorGuide([int]$UiPort = 43121) {
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
    Write-Host "KHONG nhap http://127.0.0.1:43120/mcp vao ChatGPT." -ForegroundColor Yellow
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
    Write-Host ("  BUOC {0}  {1}" -f $Step, $Title) -ForegroundColor Cyan
    if ($Subtitle) {
        Write-Host ("  {0}" -f $Subtitle) -ForegroundColor DarkGray
    }
    Write-Host "================================================================" -ForegroundColor DarkCyan
    Write-Host ""
}

function Show-PreviewHint([string]$Label) {
    Write-Host "  CHE DO XEM THU" -ForegroundColor Magenta
    Write-Host "  O nay chi dung de kiem tra giao dien setup-test.bat." -ForegroundColor DarkGray
    Write-Host "  Go bat ky chu nao de di tiep; du lieu se khong duoc kiem tra hoac luu." -ForegroundColor DarkGray
    Write-Host ("  Vi du: {0}" -f $Label) -ForegroundColor DarkGray
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
        Show-SetupWizardStep -Step "1/2" -Title "Tunnel an toan cho GPTWorker" -Subtitle "Day la du lieu thu tu setup-test."
        Show-PreviewHint -Label "demo"
        Write-Host "[OK] Da nhan du lieu Tunnel thu." -ForegroundColor Green
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

    Show-SetupWizardStep -Step "1/2" -Title "Tao Tunnel cho GPTWorker" -Subtitle "Trang OpenAI Tunnels se tu mo tren trinh duyet."
    Write-Host "Lam lan luot nhu sau:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. Tren trang OpenAI, vao Organization -> Tunnels." -ForegroundColor White
    Write-Host "  2. O phan quyen Tunnels, can co:" -ForegroundColor White
    Write-Host "       [x] Read   - cho phep GPTWorker nhin thay Tunnel" -ForegroundColor Green
    Write-Host "       [x] Use    - cho phep GPTWorker su dung Tunnel" -ForegroundColor Green
    Write-Host "     Neu ban la nguoi truc tiep tao hoac sua Tunnel, can them Manage." -ForegroundColor DarkGray
    Write-Host "  3. Bam tao Tunnel moi." -ForegroundColor White
    Write-Host "  4. Dat ten de nhan ra, vi du: gptworker." -ForegroundColor White
    Write-Host "  5. Neu co muc chon ChatGPT workspace, chon dung workspace" -ForegroundColor White
    Write-Host "     ma ban se dung GPTWorker." -ForegroundColor White
    Write-Host "  6. Bam Create hoac Save." -ForegroundColor White
    Write-Host "  7. Sau khi tao xong, copy Tunnel ID." -ForegroundColor White
    Write-Host "     Tunnel ID that thuong bat dau bang: tunnel_..." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Hieu don gian:" -ForegroundColor Cyan
    Write-Host "  Tunnel la duong noi an toan giua ChatGPT va GPTWorker tren may ban." -ForegroundColor DarkGray
    Write-Host "  Quyen Use la quyen cho phep GPTWorker thuc su dung duong noi nay." -ForegroundColor DarkGray
    Write-Host ""
    if ($WizardPreview) {
        Show-PreviewHint -Label "demo"
    }

    Start-Process $TunnelsUrl

    while ($true) {
        $prompt = if ($WizardPreview) { "Nhap Tunnel ID thu - go gi cung duoc" } else { "Dan Tunnel ID that vao day (tunnel_...)" }
        $value = Read-Host $prompt

        if ($WizardPreview) {
            if ([string]::IsNullOrWhiteSpace($value)) {
                Write-Host "Hay go it nhat mot ky tu de tiep tuc xem thu." -ForegroundColor Yellow
                continue
            }
            Write-Host "[OK] Da nhan du lieu thu. Khong kiem tra va khong luu." -ForegroundColor Green
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
        Show-SetupWizardStep -Step "2/2" -Title "API key cho GPTWorker" -Subtitle "Day la du lieu thu tu setup-test."
        Show-PreviewHint -Label "demo"
        Write-Host "[OK] Da nhan API key thu." -ForegroundColor Green
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

    Show-SetupWizardStep -Step "2/2" -Title "Tao API key cho GPTWorker" -Subtitle "Trang OpenAI API Keys se tu mo tren trinh duyet."
    Write-Host "Lam lan luot nhu sau:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. Bam Create new secret key." -ForegroundColor White
    Write-Host "  2. Dat ten de nhan ra, vi du: gptworker-runtime." -ForegroundColor White
    Write-Host "  3. O Permissions, chon Restricted." -ForegroundColor Yellow
    Write-Host "     Restricted nghia la chi cap dung nhung quyen GPTWorker can." -ForegroundColor DarkGray
    Write-Host "  4. Tim dong Tunnels, roi bat CA HAI quyen:" -ForegroundColor Yellow
    Write-Host "       [x] Read   - cho phep doc thong tin Tunnel" -ForegroundColor Green
    Write-Host "       [x] Use    - cho phep su dung Tunnel" -ForegroundColor Green
    Write-Host "  5. KHONG chon Read Only, vi Read Only thieu quyen Use." -ForegroundColor White
    Write-Host "  6. KHONG can bat All cho toan bo API key." -ForegroundColor DarkGray
    Write-Host "     Chi can muc Tunnels co Read + Use." -ForegroundColor DarkGray
    Write-Host "  7. Bam Create secret key." -ForegroundColor White
    Write-Host "  8. Copy key ngay khi OpenAI hien ra; key that thuong bat dau bang sk-." -ForegroundColor White
    Write-Host ""
    Write-Host "Hieu don gian:" -ForegroundColor Cyan
    Write-Host "  API key giong nhu chia khoa cho phep GPTWorker su dung Tunnel." -ForegroundColor DarkGray
    Write-Host "  Co Read ma khong co Use thi GPTWorker van khong ket noi duoc." -ForegroundColor DarkGray
    Write-Host ""
    if ($WizardPreview) {
        Show-PreviewHint -Label "demo"
    }

    Start-Process $ApiKeysUrl

    while ($true) {
        $prompt = if ($WizardPreview) { "Nhap API key thu - go gi cung duoc" } else { "Dan API key that vao day (sk-...)" }
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
        Write-Host "  GPTWorker - XEM THU PHAN KET NOI" -ForegroundColor Cyan
        Write-Host "  Co the nhap du lieu gia; khong co gi duoc luu." -ForegroundColor Magenta
    } else {
        Write-Host "  GPTWorker - KET NOI OPENAI SECURE MCP TUNNEL" -ForegroundColor Cyan
        Write-Host "  Cai dat that: Tunnel ID va API key se duoc kiem tra truoc khi luu." -ForegroundColor DarkGray
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
        Write-Host "  DA XEM THU XONG" -ForegroundColor Green
        Write-Host "================================================================" -ForegroundColor DarkCyan
        Write-Host "  [OK] Da xem man hinh nhap Tunnel ID" -ForegroundColor Green
        Write-Host "  [OK] Da xem man hinh nhap API key" -ForegroundColor Green
        Write-Host "  [BO QUA] Kiem tra dinh dang du lieu that" -ForegroundColor Yellow
        Write-Host "  [BO QUA] Luu vao .env" -ForegroundColor Yellow
        Write-Host "  [BO QUA] Ket noi Tunnel that" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Khong co du lieu thu nao duoc luu." -ForegroundColor DarkGray
        return
    }

    Save-TunnelCredentials -ResolvedTunnelId $resolvedTunnelId -ResolvedApiKey $resolvedApiKey

    Write-Host ""
    Write-Host "Dang kiem tra Tunnel + API key..." -ForegroundColor Cyan

    $envPort = Get-DotEnvValue "PORT"
    $resolvedPort = if ($Port -gt 0) { $Port } elseif ($envPort) { [int]$envPort } else { 43120 }
    $envHealth = Get-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT"
    $resolvedHealth = if ($HealthPort -gt 0) { $HealthPort } elseif ($envHealth) { [int]$envHealth } else { 43121 }
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
        Write-Host "  - Runtime API key: Restricted -> Tunnels Read + Use."
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
    Show-ConnectorGuide
}

# --- Main ---

if ($Init) {
    Invoke-TunnelInit
    exit 0
}

$envPort = Get-DotEnvValue "PORT"
$resolvedPort = if ($Port -gt 0) { $Port } elseif ($envPort) { [int]$envPort } else { 43120 }
$envHealth = Get-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT"
$resolvedHealth = if ($HealthPort -gt 0) { $HealthPort } elseif ($envHealth) { [int]$envHealth } else { 43121 }
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
        Show-ConnectorGuide -UiPort $resolvedHealth
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
        Write-Host "  OPENAI_TUNNEL_HEALTH_PORT=43121" -ForegroundColor Cyan
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

Show-ConnectorGuide -UiPort $resolvedHealth

& $bin run --profile-file $ProfileFile
exit $LASTEXITCODE
