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
    Write-Banner "GPTWorker · SETUP TEST" "Mô phỏng bản cài đặt ship — không cần Tunnel/API thật"
    Write-Host "  Chế độ này dùng đúng runtime đã build trong dist/." -ForegroundColor White
    Write-Host "  Tunnel ID và API key có thể nhập BẤT KỲ chữ nào." -ForegroundColor Yellow
    Write-Host "  Hai giá trị thử chỉ tồn tại trong thư mục TEMP và không ghi vào .env thật." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Phần Tunnel được mô phỏng local để toàn bộ health-check vẫn chạy như installer thật." -ForegroundColor Gray
    Write-Host ""
    Read-Host "  Nhấn Enter để bắt đầu"

    Write-Step 1 8 "Kiểm tra máy tính"
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

    Write-Step 2 8 "Kiểm tra gói runtime đã ship"
    if (-not (Test-Path "dist\index.js")) {
        Fail "Không tìm thấy dist\index.js. Đây là setup dành cho gói đã build sẵn."
    }
    if (-not (Test-Path "package.json")) { Fail "Thiếu package.json." }
    if (-not (Test-Path "jobs")) { Fail "Thiếu thư mục jobs." }
    Write-Ok "dist\index.js có sẵn — KHÔNG build lại"
    Write-Info "Không chạy npm test / validate:jobs trong installer"

    Write-Step 3 8 "Tạo sandbox cài đặt và cài runtime dependencies"
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

    Write-Step 4 8 "Tùy chọn browser cho Dev Coding"
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

    Write-Step 5 8 "Khởi động Worker từ dist đã ship"
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

    Write-Step 6 8 "Nhập Tunnel ID và API key thử"
    if (-not $NoBrowserOpen) {
        Start-Process "https://platform.openai.com/settings/organization/tunnels"
    }
    do { $TunnelId = Read-Host "  Tunnel ID thử (gõ gì cũng được)" } while ([string]::IsNullOrWhiteSpace($TunnelId))
    if (-not $NoBrowserOpen) {
        Start-Process "https://platform.openai.com/settings/organization/api-keys"
    }
    do { $ApiKey = Read-Host "  API key thử (gõ gì cũng được)" } while ([string]::IsNullOrWhiteSpace($ApiKey))
    @(
        "OPENAI_TUNNEL_ID=$TunnelId",
        "OPENAI_TUNNEL_API_KEY=$ApiKey"
    ) | Set-Content (Join-Path $TempRoot "fake-credentials.env") -Encoding UTF8
    Write-Ok "Đã nhận 2 giá trị thử — chỉ lưu trong TEMP"

    Write-Step 7 8 "Khởi động Tunnel mô phỏng và kiểm tra health"
    $mockScript = Join-Path $ScriptDir "scripts\setup-test-mock-tunnel.mjs"
    $tunnelOut = Join-Path $TempRoot "tunnel.out.log"
    $tunnelErr = Join-Path $TempRoot "tunnel.err.log"
    $TunnelProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @($mockScript, "--port", "$TunnelPort", "--worker-port", "$WorkerPort") -WorkingDirectory $ScriptDir -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru
    if (-not (Wait-Http "http://127.0.0.1:$TunnelPort/readyz" 15 "ready")) {
        if (Test-Path $tunnelErr) { Get-Content $tunnelErr -Tail 30 }
        Fail "Tunnel mô phỏng không ready."
    }
    Write-Ok "Tunnel /readyz = ready"
    if (-not (Wait-Http "http://127.0.0.1:$TunnelPort/healthz" 5)) { Fail "Tunnel /healthz không phản hồi." }
    Write-Ok "Tunnel /healthz = OK"

    Write-Step 8 8 "Kiểm tra autostart và bảo toàn cấu hình thật"
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
