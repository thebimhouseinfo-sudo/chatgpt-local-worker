param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ScriptDir

function Write-Banner([string]$Title, [string]$Subtitle = "") {
    Clear-Host
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host ("║  " + $Title.PadRight(68) + "║") -ForegroundColor Cyan
    if ($Subtitle) { Write-Host ("║  " + $Subtitle.PadRight(68) + "║") -ForegroundColor DarkCyan }
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step([int]$Current, [int]$Total, [string]$Text) {
    Write-Host ""
    Write-Host ("┌─ BƯỚC {0}/{1} ───────────────────────────────────────────────────────" -f $Current, $Total) -ForegroundColor Cyan
    Write-Host ("│ " + $Text) -ForegroundColor White
    Write-Host "└──────────────────────────────────────────────────────────────────────" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) { Write-Host ("  ✔ " + $Text) -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host ("  • " + $Text) -ForegroundColor Gray }
function Write-Warn([string]$Text) { Write-Host ("  ! " + $Text) -ForegroundColor Yellow }
function Fail([string]$Text) {
    Write-Host ""
    Write-Host ("  ✘ " + $Text) -ForegroundColor Red
    throw $Text
}

function Get-DotEnvValue([string]$Name) {
    if (-not (Test-Path ".env")) { return $null }
    $line = Get-Content ".env" | Where-Object {
        $_ -match "^\s*$Name\s*=" -and -not $_.TrimStart().StartsWith("#")
    } | Select-Object -First 1
    if (-not $line) { return $null }
    return (($line -split "=", 2)[1].Trim()).Trim("'").Trim('"')
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
    if (-not $found) { $out += "$Name=$Value" }
    Set-Content ".env" -Value $out -Encoding UTF8
}

function Wait-Http([string]$Url, [int]$Seconds = 20, [string]$Contains = "") {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try {
            $r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200 -and ((-not $Contains) -or $r.Content -match [regex]::Escape($Contains))) {
                return $true
            }
        } catch {}
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Read-TunnelId {
    while ($true) {
        $value = Read-Host "  Dán Tunnel ID vào đây"
        if ($value -match '^tunnel_[A-Za-z0-9_-]+$') { return $value.Trim() }
        Write-Warn "Tunnel ID chưa đúng. Hãy copy giá trị bắt đầu bằng tunnel_ từ trang OpenAI Tunnels."
    }
}

function Read-ApiKey {
    while ($true) {
        $value = Read-Host "  Dán API key vào đây"
        if ($value -match '^sk-[^\s]+$') { return $value.Trim() }
        Write-Warn "API key chưa đúng. Hãy copy secret key bắt đầu bằng sk-."
    }
}

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = @($machine, $user) -join ";"
}

function Install-WithWinget([string]$Id, [string]$DisplayName) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Fail "Máy chưa có $DisplayName và cũng không có winget để cài tự động."
    }

    Write-Info "Đang cài $DisplayName bằng winget..."
    & winget install --id $Id --exact --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Fail "Không cài được $DisplayName bằng winget."
    }

    Refresh-ProcessPath
    Write-Ok "$DisplayName đã được cài"
}

try {
    Write-Banner "GPTWorker · CÀI ĐẶT" "ChatGPT làm việc trực tiếp với project và file trên máy Windows"

    Write-Host "  GPTWorker là cầu nối an toàn giữa ChatGPT và máy tính của bạn." -ForegroundColor White
    Write-Host "  Nó cho phép ChatGPT làm việc với code, project, file và các Job đã được cấp quyền," -ForegroundColor White
    Write-Host "  nhưng chỉ bắt đầu thao tác sau khi bạn chọn thư mục làm việc và xác nhận." -ForegroundColor White
    Write-Host ""
    Write-Host "  • Dev Coding  — sửa code, debug, refactor, build/test project." -ForegroundColor Gray
    Write-Host "  • Dev Planing — đọc repo, review kiến trúc, lập plan / TODO / task list." -ForegroundColor Gray
    Write-Host "  • Layla       — công việc tổng quát với file và tài liệu." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Thiết kế bởi Nam Trịnh" -ForegroundColor DarkCyan
    Write-Host ""
    Read-Host "  Nhấn Enter để bắt đầu cài đặt"

    Write-Step 1 9 "Kiểm tra và cài thành phần cần thiết"

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Warn "Chưa có Node.js. GPTWorker sẽ cài Node.js LTS bằng Windows Package Manager."
        Install-WithWinget -Id "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Refresh-ProcessPath
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Fail "Node.js/npm đã cài nhưng terminal hiện tại chưa nhận PATH. Hãy đóng setup và chạy lại một lần."
    }

    $nodeVersion = (& node --version).Trim()
    $npmVersion = (& npm --version).Trim()
    Write-Ok "Node.js $nodeVersion"
    Write-Ok "npm $npmVersion"

    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Ok ((& git --version).Trim())
    } else {
        Write-Warn "Git chưa có. Git chỉ cần cho các Job có thao tác repository."
        $gitChoice = Read-Host "  Cài Git bằng winget? [y/N]"
        if ($gitChoice -match '^(y|yes)$') {
            Install-WithWinget -Id "Git.Git" -DisplayName "Git"
            if (Get-Command git -ErrorAction SilentlyContinue) {
                Write-Ok ((& git --version).Trim())
            }
        } else {
            Write-Info "Bỏ qua Git; GPTWorker vẫn cài đặt bình thường."
        }
    }

    Write-Step 2 9 "Kiểm tra gói GPTWorker đã ship"
    if (-not (Test-Path "dist\index.js")) { Fail "Thiếu dist\index.js. Gói cài đặt này chưa có runtime đã build." }
    if (-not (Test-Path "package.json")) { Fail "Thiếu package.json." }
    if (-not (Test-Path "jobs")) { Fail "Thiếu thư mục jobs." }
    Write-Ok "Runtime dist có sẵn — không build lại"
    Write-Info "Installer không chạy npm test / validate:jobs"

    Write-Step 3 9 "Cài runtime dependencies"
    Write-Info "Đang cài các package cần để GPTWorker chạy..."
    & npm install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "Không cài được runtime dependencies." }
    Write-Ok "Runtime dependencies đã sẵn sàng"

    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Ok "Đã tạo .env"
    }
    if (-not (Test-Path "worker-state.json")) {
        @{
            current_job = $null
            active_workspace = $null
            status = "idle"
            updated_at = $null
        } | ConvertTo-Json | Set-Content "worker-state.json" -Encoding UTF8
        Write-Ok "Đã tạo worker-state.json"
    }

    # GPTWorker owns a dedicated low-collision port pair. Existing installs
    # using the old generic defaults are migrated automatically.
    $envPort = Get-DotEnvValue "PORT"
    if (-not $envPort -or [int]$envPort -eq 3000) {
        $WorkerPort = 43120
        Set-DotEnvValue "PORT" "$WorkerPort"
    } else {
        $WorkerPort = [int]$envPort
    }

    $envTunnelPort = Get-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT"
    if (-not $envTunnelPort -or [int]$envTunnelPort -eq 8080) {
        $TunnelPort = 43121
        Set-DotEnvValue "OPENAI_TUNNEL_HEALTH_PORT" "$TunnelPort"
    } else {
        $TunnelPort = [int]$envTunnelPort
    }
    Write-Info "GPTWorker ports: MCP $WorkerPort · Tunnel health $TunnelPort"

    Write-Step 4 9 "Tùy chọn browser cho Dev Coding"
    Write-Host "  Vercel agent-browser giúp Dev Coding thao tác trên trình duyệt khi cần." -ForegroundColor Gray
    $choice = Read-Host "  Cài/kiểm tra browser? [y/N]"
    if ($choice -match '^(y|yes)$') {
        & node (Join-Path $ScriptDir "scripts\setup-agent-browser.mjs") Y
        if ($LASTEXITCODE -ne 0) { Write-Warn "Browser optional không hoàn tất; GPTWorker vẫn tiếp tục cài đặt." }
        else { Write-Ok "Browser setup hoàn tất" }
    } else {
        & node (Join-Path $ScriptDir "scripts\setup-agent-browser.mjs") N
        Write-Info "Bỏ qua browser optional"
    }

    Write-Step 5 9 "Khởi động GPTWorker local"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "reset-runtime.ps1") -WorkerPort $WorkerPort -TunnelHealthPort $TunnelPort
    if ($LASTEXITCODE -ne 0) { Fail "Không reset được runtime cũ." }

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start-worker-background.ps1") -Port $WorkerPort -Force
    if ($LASTEXITCODE -ne 0) { Fail "Không khởi động được Worker." }

    if (-not (Wait-Http "http://127.0.0.1:$WorkerPort/health" 20)) {
        $workerErr = Join-Path $env:LOCALAPPDATA "GPTWorker\logs\worker.err.log"
        if (Test-Path $workerErr) {
            Write-Host ""
            Write-Host "  --- worker.err.log ---" -ForegroundColor Yellow
            Get-Content $workerErr -Tail 30 | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor DarkYellow }
            Write-Host "  ----------------------" -ForegroundColor Yellow
        }
        Fail "Worker không healthy trên port $WorkerPort."
    }
    Write-Ok "Worker đã sẵn sàng"

    Write-Step 6 9 "Tạo Secure MCP Tunnel và API key"
    Write-Host "  PHẦN A · TẠO TUNNEL" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    1. Trình duyệt sẽ mở trang OpenAI Platform · Tunnels." -ForegroundColor White
    Write-Host "    2. Nếu đang ở Settings, nhìn menu bên trái và mở Tunnels." -ForegroundColor White
    Write-Host "    3. Bấm Create / New tunnel." -ForegroundColor White
    Write-Host "    4. Ở ô tên, nhập: gptworker" -ForegroundColor White
    Write-Host "    5. Nếu có ChatGPT workspace, chọn workspace sẽ dùng GPTWorker." -ForegroundColor White
    Write-Host "    6. Nếu UI hỏi quyền/access, bật Read + Use." -ForegroundColor White
    Write-Host "       Nếu tài khoản trực tiếp tạo/chỉnh Tunnel và có Manage thì bật thêm Manage." -ForegroundColor DarkGray
    Write-Host "    7. Bấm Create / Save." -ForegroundColor White
    Write-Host "    8. Mở chi tiết Tunnel, tìm Tunnel ID rồi bấm Copy." -ForegroundColor White
    Write-Host "       Tunnel ID thường bắt đầu bằng: tunnel_..." -ForegroundColor DarkGray
    Write-Host ""
    Start-Process "https://platform.openai.com/settings/organization/tunnels"
    $TunnelId = Read-TunnelId

    Write-Host ""
    Write-Host "  PHẦN B · TẠO API KEY CHO GPTWORKER" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    1. Trình duyệt sẽ mở OpenAI Platform · API Keys." -ForegroundColor White
    Write-Host "    2. Bấm + Create new secret key." -ForegroundColor White
    Write-Host "    3. Name: gptworker-runtime" -ForegroundColor White
    Write-Host "    4. Permissions: chọn Restricted." -ForegroundColor White
    Write-Host "    5. Kéo xuống danh sách quyền." -ForegroundColor White
    Write-Host "    6. Tìm nhóm Tunnels." -ForegroundColor White
    Write-Host "    7. Ở Tunnels, bật đủ Read + Use." -ForegroundColor White
    Write-Host "       Không chọn Read Only; không cần bật All cho toàn bộ key." -ForegroundColor Yellow
    Write-Host "    8. Bấm Create secret key / Create key." -ForegroundColor White
    Write-Host "    9. Bấm Copy ngay khi key xuất hiện; secret đầy đủ chỉ hiện lúc vừa tạo." -ForegroundColor Yellow
    Write-Host "       API key thường bắt đầu bằng: sk-..." -ForegroundColor DarkGray
    Write-Host ""
    Start-Process "https://platform.openai.com/settings/organization/api-keys"
    $ApiKey = Read-ApiKey

    Write-Step 7 9 "Kiểm tra và khởi động Secure MCP Tunnel"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "openai-tunnel.ps1") -Init -Force -Port $WorkerPort -HealthPort $TunnelPort -TunnelId $TunnelId -ApiKey $ApiKey -NoBrowser
    if ($LASTEXITCODE -ne 0) { Fail "Tunnel/API chưa vượt qua kiểm tra. Xem thông báo phía trên rồi chạy setup lại." }
    Write-Ok "Tunnel ID và API key hợp lệ"

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
        "-File", ('"{0}"' -f (Join-Path $ScriptDir "openai-tunnel.ps1")),
        "-Port", "$WorkerPort", "-HealthPort", "$TunnelPort", "-Force"
    ) | Out-Null

    if (-not (Wait-Http "http://127.0.0.1:$TunnelPort/readyz" 60 "ready")) {
        Fail "Secure MCP Tunnel chưa ready sau 60 giây."
    }
    Write-Ok "Secure MCP Tunnel đã ready"

    Write-Step 8 9 "Cài GPTWorker chạy cùng Windows"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "gptworker-tray.ps1") -InstallStartup
    if ($LASTEXITCODE -ne 0) { Fail "Không đăng ký được GPTWorker tự chạy cùng Windows." }

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "reset-runtime.ps1") -WorkerPort $WorkerPort -TunnelHealthPort $TunnelPort
    if ($LASTEXITCODE -ne 0) { Fail "Không chuyển được runtime sang tray." }

    $trayReady = Join-Path $env:LOCALAPPDATA "GPTWorker\tray-ready.json"
    Remove-Item $trayReady -Force -ErrorAction SilentlyContinue
    & wscript.exe (Join-Path $ScriptDir "gptworker-tray.vbs")

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "wait-tray-ready.ps1") -TimeoutSeconds 12
    if ($LASTEXITCODE -ne 0) { Fail "Tray GPTWorker không khởi động." }

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "wait-runtime-ready.ps1") -WorkerPort $WorkerPort -TunnelHealthPort $TunnelPort -TimeoutSeconds 75
    if ($LASTEXITCODE -ne 0) { Fail "Tray đã mở nhưng Worker/Tunnel chưa ready." }
    Write-Ok "GPTWorker tray + Worker + Tunnel đang hoạt động"

    Write-Step 9 9 "Kết nối GPTWorker với ChatGPT"
    $guidePath = Join-Path $ScriptDir "docs\setup-guide\index.html"

    Write-Host "  Trình duyệt sẽ mở ChatGPT Settings và trang hướng dẫn bằng hình." -ForegroundColor White
    Write-Host ""
    Write-Host "    1. Vào Settings → Plugins và bật Developer mode." -ForegroundColor White
    Write-Host "    2. Mở Plugins, bấm nút + để tạo plugin mới." -ForegroundColor White
    Write-Host "    3. Name: gptworker" -ForegroundColor White
    Write-Host "    4. Connection: Tunnel — không chọn Server URL." -ForegroundColor White
    Write-Host "    5. Available tunnels: chọn Tunnel của GPTWorker." -ForegroundColor White
    Write-Host "    6. Authentication: No Auth." -ForegroundColor White
    Write-Host "    7. Không dùng Use tunnel ID instead." -ForegroundColor Yellow
    Write-Host "    8. Tick ô xác nhận rồi bấm Connect / Create." -ForegroundColor White
    Write-Host "    9. Sau khi kết nối xong, mở chat mới và gọi @gptworker." -ForegroundColor White
    Write-Host ""

    Start-Process "https://chatgpt.com/#settings/Plugins"
    if (Test-Path $guidePath) { Start-Process $guidePath }

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                       ✔  CÀI ĐẶT HOÀN TẤT                          ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║  GPTWorker đã được cài để tự chạy cùng Windows.                    ║" -ForegroundColor Green
    Write-Host "║  Hoàn tất phần kết nối Plugin trong trình duyệt rồi gọi @gptworker.║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  GPTWorker · Thiết kế bởi Nam Trịnh" -ForegroundColor DarkCyan
    Write-Host ""
    Read-Host "  Nhấn Enter để đóng"
}
catch {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                         ✘  CÀI ĐẶT THẤT BẠI                        ║" -ForegroundColor Red
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ("  " + $_.Exception.Message) -ForegroundColor Red
    Write-Host ""
    Write-Host "  Worker log: %LOCALAPPDATA%\GPTWorker\logs\worker.err.log" -ForegroundColor Yellow
    Write-Host "  Tunnel log: %LOCALAPPDATA%\GPTWorker\logs\tunnel.err.log" -ForegroundColor Yellow
    Write-Host "  Tray log:   %LOCALAPPDATA%\GPTWorker\logs\tray.err.log" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Nhấn Enter để đóng"
    exit 1
}

exit 0
