param(
    [switch]$NoBrowserOpen
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ScriptDir

function Write-Banner([string]$Title, [string]$Subtitle = "") {
    Clear-Host
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host ("║  " + $Title.PadRight(68) + "║") -ForegroundColor Cyan
    if ($Subtitle) {
        Write-Host ("║  " + $Subtitle.PadRight(68) + "║") -ForegroundColor DarkCyan
    }
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

function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    return $port
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
        Start-Sleep -Milliseconds 400
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Get-FileHashSafe([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    return (Get-FileHash -Algorithm SHA256 $Path).Hash
}

$TempRoot = Join-Path $env:TEMP ("GPTWorker-Setup-Test-" + [guid]::NewGuid().ToString("N"))
$WorkerPort = Get-FreePort
$TunnelPort = Get-FreePort
$WorkerProcess = $null
$TunnelProcess = $null
$OriginalEnvHash = Get-FileHashSafe (Join-Path $ScriptDir ".env")
$StartupKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$StartupName = "GPTWorker"
$HadStartupValue = $false
$OldStartupValue = $null

try {
    Write-Banner "GPTWorker · SETUP TEST" "Kiểm tra toàn bộ trải nghiệm cài đặt trước khi thay setup thật"
    Write-Host "  Luồng này chạy như bản cài đặt thật và dùng runtime đã build trong dist/." -ForegroundColor White
    Write-Host "  Thông tin Tunnel/API trong lần chạy này chỉ dùng cho môi trường test." -ForegroundColor Gray
    Write-Host "  Cấu hình GPTWorker thật trên máy sẽ không bị thay đổi." -ForegroundColor Gray
    Write-Host ""
    Read-Host "  Nhấn Enter để bắt đầu"

    Write-Step 1 9 "Kiểm tra máy tính"
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Không tìm thấy Node.js trong PATH." }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail "Không tìm thấy npm trong PATH." }
    $nodeVersion = (& node --version).Trim()
    $npmVersion = (& npm --version).Trim()
    Write-Ok "Node.js $nodeVersion"
    Write-Ok "npm $npmVersion"
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Ok ((& git --version).Trim())
    } else {
        Write-Warn "Git chưa có. GPTWorker vẫn chạy; các thao tác Git sẽ không dùng được."
    }

    Write-Step 2 9 "Kiểm tra gói runtime đã ship"
    if (-not (Test-Path "dist\index.js")) {
        Fail "Không tìm thấy dist\index.js. Đây là setup dành cho gói đã build sẵn."
    }
    if (-not (Test-Path "package.json")) { Fail "Thiếu package.json." }
    if (-not (Test-Path "jobs")) { Fail "Thiếu thư mục jobs." }
    Write-Ok "dist\index.js có sẵn — KHÔNG build lại"
    Write-Info "Không chạy npm test / validate:jobs trong installer"

    Write-Step 3 9 "Tạo sandbox cài đặt và cài runtime dependencies"
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    Copy-Item "dist" (Join-Path $TempRoot "dist") -Recurse -Force
    Copy-Item "jobs" (Join-Path $TempRoot "jobs") -Recurse -Force
    Copy-Item "package.json" $TempRoot -Force
    if (Test-Path "package-lock.json") { Copy-Item "package-lock.json" $TempRoot -Force }
    if (Test-Path ".env.example") { Copy-Item ".env.example" $TempRoot -Force }

    Write-Info "Cài production dependencies vào sandbox..."
    & npm --prefix $TempRoot install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "npm install --omit=dev thất bại." }
    Write-Ok "Runtime dependencies đã sẵn sàng trong sandbox"

    Write-Step 4 9 "Tùy chọn browser cho Dev Coding"
    Write-Host "  Vercel agent-browser là tùy chọn." -ForegroundColor Gray
    $choice = Read-Host "  Cài/kiểm tra browser giống setup thật? [y/N]"
    if ($choice -match '^(y|yes)$') {
        $oldDataRoot = $env:GPTWORKER_DATA_ROOT
        try {
            $env:GPTWORKER_DATA_ROOT = Join-Path $TempRoot "data"
            & node (Join-Path $ScriptDir "scripts\setup-agent-browser.mjs") Y
            if ($LASTEXITCODE -ne 0) { Write-Warn "Browser optional không hoàn tất; setup test vẫn tiếp tục." }
            else { Write-Ok "Browser setup đã chạy bằng config sandbox" }
        } finally {
            $env:GPTWORKER_DATA_ROOT = $oldDataRoot
        }
    } else {
        Write-Info "Bỏ qua browser optional"
    }

    Write-Step 5 9 "Khởi động Worker từ dist đã ship"
    $envFile = Join-Path $TempRoot ".env"
    @(
        "PORT=$WorkerPort",
        "HOST=127.0.0.1",
        "MCP_TOKEN=",
        "CHATGPT_AUTO_APPROVE=true",
        "SHELL_TIMEOUT=120",
        "MCP_SESSION_RECOVERY=true",
        "MCP_SESSION_DELETE_GRACE_MS=45000",
        "OPENAI_TUNNEL_HEALTH_PORT=$TunnelPort",
        "OPENAI_TUNNEL_ID=",
        "OPENAI_TUNNEL_API_KEY="
    ) | Set-Content $envFile -Encoding UTF8

    $workerOut = Join-Path $TempRoot "worker.out.log"
    $workerErr = Join-Path $TempRoot "worker.err.log"
    $oldPort = $env:PORT; $oldHost = $env:HOST; $oldHome = $env:LOCAL_WORKER_HOME; $oldData = $env:GPTWORKER_DATA_ROOT
    try {
        $env:PORT = "$WorkerPort"
        $env:HOST = "127.0.0.1"
        $env:LOCAL_WORKER_HOME = $TempRoot
        $env:GPTWORKER_DATA_ROOT = Join-Path $TempRoot "data"
        $WorkerProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @("dist/index.js") -WorkingDirectory $TempRoot -WindowStyle Hidden -RedirectStandardOutput $workerOut -RedirectStandardError $workerErr -PassThru
    } finally {
        $env:PORT = $oldPort; $env:HOST = $oldHost; $env:LOCAL_WORKER_HOME = $oldHome; $env:GPTWORKER_DATA_ROOT = $oldData
    }
    if (-not (Wait-Http "http://127.0.0.1:$WorkerPort/health" 20)) {
        if (Test-Path $workerErr) { Get-Content $workerErr -Tail 30 }
        Fail "Worker không healthy trên port test $WorkerPort."
    }
    Write-Ok "Worker healthy trên port test $WorkerPort"

    Write-Step 6 9 "Tạo Secure MCP Tunnel và API key"

    Write-Host "  PHẦN A · TẠO TUNNEL" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Trình duyệt sẽ mở trang OpenAI Platform · Tunnels." -ForegroundColor White
    Write-Host ""
    Write-Host "  Làm lần lượt:" -ForegroundColor White
    Write-Host "    1. Nếu đang ở trang Settings, nhìn menu bên trái và mở mục Tunnels." -ForegroundColor White
    Write-Host "    2. Bấm nút tạo Tunnel mới (Create / New tunnel)." -ForegroundColor White
    Write-Host "    3. Ở ô tên, nhập: gptworker" -ForegroundColor White
    Write-Host "    4. Nếu có mục chọn ChatGPT workspace, chọn đúng workspace anh/chị sẽ dùng GPTWorker." -ForegroundColor White
    Write-Host "    5. Nếu trang hỏi quyền hoặc access cho Tunnel:" -ForegroundColor White
    Write-Host "         • bật Read" -ForegroundColor Green
    Write-Host "         • bật Use" -ForegroundColor Green
    Write-Host "       Nếu tài khoản này trực tiếp tạo/chỉnh Tunnel và UI có Manage thì bật thêm Manage." -ForegroundColor DarkGray
    Write-Host "    6. Bấm Create hoặc Save." -ForegroundColor White
    Write-Host "    7. Khi Tunnel đã tạo xong, mở chi tiết Tunnel nếu cần." -ForegroundColor White
    Write-Host "    8. Tìm dòng Tunnel ID rồi bấm Copy, hoặc bôi đen và copy giá trị." -ForegroundColor White
    Write-Host "       Tunnel ID thật thường bắt đầu bằng: tunnel_..." -ForegroundColor DarkGray
    Write-Host ""
    if (-not $NoBrowserOpen) {
        Start-Process "https://platform.openai.com/settings/organization/tunnels"
    }
    do { $TunnelId = Read-Host "  Dán Tunnel ID vào đây" } while ([string]::IsNullOrWhiteSpace($TunnelId))

    Write-Host ""
    Write-Host "  PHẦN B · TẠO API KEY CHO GPTWORKER" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Trình duyệt sẽ mở trang OpenAI Platform · API Keys." -ForegroundColor White
    Write-Host ""
    Write-Host "  Làm lần lượt:" -ForegroundColor White
    Write-Host "    1. Bấm nút + Create new secret key." -ForegroundColor White
    Write-Host "    2. Ở ô Name, nhập: gptworker-runtime" -ForegroundColor White
    Write-Host "    3. Ở phần Permissions, chọn Restricted." -ForegroundColor White
    Write-Host "    4. Kéo xuống danh sách quyền bên dưới." -ForegroundColor White
    Write-Host "    5. Tìm dòng hoặc nhóm có tên Tunnels." -ForegroundColor White
    Write-Host "       Nếu danh sách dài, cứ cuộn xuống cho đến khi thấy Tunnels." -ForegroundColor DarkGray
    Write-Host "    6. Ở Tunnels, bật đủ:" -ForegroundColor White
    Write-Host "         • Read" -ForegroundColor Green
    Write-Host "         • Use" -ForegroundColor Green
    Write-Host "       Không chọn Read Only vì GPTWorker cần cả quyền Use." -ForegroundColor Yellow
    Write-Host "       Không cần chọn All cho toàn bộ API key." -ForegroundColor DarkGray
    Write-Host "    7. Kiểm tra lại đúng 2 quyền Tunnels: Read + Use." -ForegroundColor White
    Write-Host "    8. Bấm Create secret key / Create key." -ForegroundColor White
    Write-Host "    9. OpenAI sẽ chỉ hiện secret đầy đủ lúc vừa tạo." -ForegroundColor White
    Write-Host "       Bấm Copy ngay và giữ cửa sổ đó mở cho đến khi đã dán key vào GPTWorker." -ForegroundColor Yellow
    Write-Host "       API key thật thường bắt đầu bằng: sk-..." -ForegroundColor DarkGray
    Write-Host ""
    if (-not $NoBrowserOpen) {
        Start-Process "https://platform.openai.com/settings/organization/api-keys"
    }
    do { $ApiKey = Read-Host "  Dán API key vào đây" } while ([string]::IsNullOrWhiteSpace($ApiKey))

    @(
        "OPENAI_TUNNEL_ID=$TunnelId",
        "OPENAI_TUNNEL_API_KEY=$ApiKey"
    ) | Set-Content (Join-Path $TempRoot "fake-credentials.env") -Encoding UTF8
    Write-Ok "Đã nhận thông tin Tunnel và API key cho phiên setup test"

    Write-Step 7 9 "Khởi động Tunnel mô phỏng và kiểm tra health"
    $mockScript = Join-Path $ScriptDir "scripts\setup-test-mock-tunnel.mjs"
    $tunnelOut = Join-Path $TempRoot "tunnel.out.log"
    $tunnelErr = Join-Path $TempRoot "tunnel.err.log"
    $mockArgs = '"{0}" --port {1} --worker-port {2}' -f $mockScript, $TunnelPort, $WorkerPort
    $TunnelProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList $mockArgs -WorkingDirectory $ScriptDir -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru
    if (-not (Wait-Http "http://127.0.0.1:$TunnelPort/readyz" 15 "ready")) {
        if (Test-Path $tunnelErr) { Get-Content $tunnelErr -Tail 30 }
        Fail "Tunnel mô phỏng không ready."
    }
    Write-Ok "Tunnel /readyz = ready"
    if (-not (Wait-Http "http://127.0.0.1:$TunnelPort/healthz" 5)) { Fail "Tunnel /healthz không phản hồi." }
    Write-Ok "Tunnel /healthz = OK"

    Write-Step 8 9 "Kiểm tra autostart và bảo toàn cấu hình thật"
    try {
        $OldStartupValue = (Get-ItemProperty -Path $StartupKey -Name $StartupName -ErrorAction Stop).$StartupName
        $HadStartupValue = $true
    } catch {}
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "gptworker-tray.ps1") -InstallStartup
    if ($LASTEXITCODE -ne 0) { Fail "Không đăng ký được Windows startup." }
    Write-Ok "Windows startup registration hoạt động"

    $currentHash = Get-FileHashSafe (Join-Path $ScriptDir ".env")
    if ($OriginalEnvHash -ne $currentHash) {
        Fail ".env thật đã bị thay đổi trong setup test."
    }
    Write-Ok ".env thật không thay đổi"

    Write-Step 9 9 "Kết nối GPTWorker với ChatGPT"

    $guidePath = Join-Path $ScriptDir "docs\setup-guide\index.html"

    Write-Host "  Trình duyệt sẽ mở ChatGPT Settings và trang hướng dẫn bằng hình." -ForegroundColor White
    Write-Host ""
    Write-Host "  Làm lần lượt:" -ForegroundColor White
    Write-Host "    1. Trong ChatGPT Settings, mở Plugins." -ForegroundColor White
    Write-Host "    2. Bật Developer mode nếu chưa bật." -ForegroundColor White
    Write-Host "    3. Mở trang Plugins và bấm nút + để tạo plugin mới." -ForegroundColor White
    Write-Host "    4. Name: gptworker" -ForegroundColor White
    Write-Host "    5. Connection: chọn Tunnel." -ForegroundColor White
    Write-Host "       Không chọn Server URL." -ForegroundColor Yellow
    Write-Host "    6. Ở Available tunnels, chọn đúng Tunnel của GPTWorker." -ForegroundColor White
    Write-Host "    7. Authentication: chọn No Auth." -ForegroundColor White
    Write-Host "    8. Không dùng Use tunnel ID instead." -ForegroundColor Yellow
    Write-Host "    9. Tick ô xác nhận ở cuối rồi bấm Connect / Create." -ForegroundColor White
    Write-Host "   10. Sau khi tạo xong, mở chat mới và gọi @gptworker." -ForegroundColor White
    Write-Host ""
    Write-Info "Trang hướng dẫn bằng hình sẽ mở để đối chiếu từng bước."

    if (-not $NoBrowserOpen) {
        Start-Process "https://chatgpt.com/#settings/Plugins"
        if (Test-Path $guidePath) {
            Start-Process $guidePath
        } else {
            Write-Warn "Không tìm thấy docs\setup-guide\index.html."
        }
    }

    Write-Host ""
    Read-Host "  Khi đã xem xong phần kết nối ChatGPT, nhấn Enter để hoàn tất test"

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    ✔  SETUP TEST PASSED                            ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║  ✔ Node/npm/Git                                                    ║" -ForegroundColor Green
    Write-Host "║  ✔ dist ship sẵn — không build, không npm test                     ║" -ForegroundColor Green
    Write-Host "║  ✔ production dependencies                                         ║" -ForegroundColor Green
    Write-Host "║  ✔ Worker từ dist                                                  ║" -ForegroundColor Green
    Write-Host "║  ✔ Tunnel mock + health contract                                   ║" -ForegroundColor Green
    Write-Host "║  ✔ Windows startup registration                                    ║" -ForegroundColor Green
    Write-Host "║  ✔ .env thật không bị thay đổi                                     ║" -ForegroundColor Green
    Write-Host "║  ✔ mở ChatGPT Settings + hướng dẫn tạo plugin                      ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Khi luồng này được chốt, setup.bat thật sẽ dùng cùng thứ tự bước," -ForegroundColor White
    Write-Host "  chỉ thay Tunnel/API mock bằng OpenAI Secure MCP Tunnel thật." -ForegroundColor White
    Write-Host ""
    Read-Host "  Nhấn Enter để đóng"
}
catch {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                    ✘  SETUP TEST FAILED                            ║" -ForegroundColor Red
    Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ("  " + $_.Exception.Message) -ForegroundColor Red
    Write-Host ""
    if (Test-Path $TempRoot) { Write-Host ("  Log tạm: " + $TempRoot) -ForegroundColor Yellow }
    Write-Host ""
    Read-Host "  Nhấn Enter để đóng"
    exit 1
}
finally {
    if ($TunnelProcess) {
        try { if (-not $TunnelProcess.HasExited) { Stop-Process -Id $TunnelProcess.Id -Force -ErrorAction SilentlyContinue } } catch {}
    }
    if ($WorkerProcess) {
        try { if (-not $WorkerProcess.HasExited) { Stop-Process -Id $WorkerProcess.Id -Force -ErrorAction SilentlyContinue } } catch {}
    }

    # Restore the previous startup registry value so setup-test is reversible.
    try {
        if ($HadStartupValue) {
            New-Item -Path $StartupKey -Force | Out-Null
            New-ItemProperty -Path $StartupKey -Name $StartupName -Value $OldStartupValue -PropertyType String -Force | Out-Null
        } else {
            Remove-ItemProperty -Path $StartupKey -Name $StartupName -ErrorAction SilentlyContinue
        }
    } catch {}

    try { if (Test-Path $TempRoot) { Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue } } catch {}
}

exit 0
