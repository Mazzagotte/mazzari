param(
    [switch]$Kiosk,
    [switch]$NoBrowser,
    # Kiosk only: hour (0-23) to restart Chrome each night so a long-running browser can't leak memory. -1 disables.
    [int]$RestartHour = 4
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$url = "http://localhost:1000"
$serverEntry = Join-Path $PSScriptRoot ".next-production\standalone\server.js"

function Test-Display {
    try {
        $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 3
        return $health.app -eq "splitflap-smart"
    } catch {
        return $false
    }
}

# True when the standalone build is missing or any source file is newer than it.
function Test-BuildStale {
    if (-not (Test-Path -LiteralPath $serverEntry)) { return $true }
    $built = (Get-Item -LiteralPath $serverEntry).LastWriteTime
    $inputs = @("app", "components", "hooks", "lib", "public") | Where-Object { Test-Path -LiteralPath $_ }
    $newest = Get-ChildItem -LiteralPath $inputs -Recurse -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newest -and $newest.LastWriteTime -gt $built) { return $true }
    foreach ($file in "package.json", "package-lock.json", "next.config.ts", "tsconfig.json") {
        if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).LastWriteTime -gt $built) { return $true }
    }
    return $false
}

try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Install Node.js 20.9 or later, then run the launcher again."
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm was not found. Reinstall Node.js with npm included."
    }
    & node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)"
    if ($LASTEXITCODE -ne 0) { throw "Node.js 20.9 or later is required." }

    $chrome = $null
    if ($Kiosk -and -not $NoBrowser) {
        $candidates = @(
            "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
        $chrome = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $chrome) { throw "Google Chrome was not found. Install Chrome or use the normal launcher." }
    }

    if (-not (Test-Display)) {
        $listener = Get-NetTCPConnection -LocalPort 1000 -State Listen -ErrorAction SilentlyContinue
        if ($listener) { throw "Port 1000 is already in use by another service, or FLAP is not ready. Close that server and try again." }

        if (-not (Test-Path -LiteralPath "node_modules\next\dist\bin\next")) {
            Write-Host "Installing dependencies..."
            if (Test-Path -LiteralPath "package-lock.json") { & npm.cmd ci } else { & npm.cmd install }
            if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
        }

        if (Test-BuildStale) {
            Write-Host "Building the production display..."
            $env:MAZZARI_STANDALONE = "1"
            & npm.cmd run build
            $buildExit = $LASTEXITCODE
            Remove-Item Env:\MAZZARI_STANDALONE
            if ($buildExit -ne 0) { throw "Production build failed. The server was not started." }
            # The standalone server does not include static assets or public files.
            $standalone = Join-Path $PSScriptRoot ".next-production\standalone"
            Copy-Item -LiteralPath ".next-production\static" -Destination "$standalone\.next-production\static" -Recurse -Force
            if (Test-Path -LiteralPath "public") { Copy-Item -LiteralPath "public" -Destination "$standalone\public" -Recurse -Force }
        } else {
            Write-Host "Build is up to date; skipping rebuild."
        }

        $server = Start-Process -FilePath $env:ComSpec -WorkingDirectory $PSScriptRoot `
            -ArgumentList '/k "set PORT=1000&& set HOSTNAME=0.0.0.0&& node .next-production\standalone\server.js"' -PassThru
        $deadline = (Get-Date).AddSeconds(90)
        $ready = $false
        do {
            $ready = Test-Display
            if ($ready) { break }
            if ($server.HasExited) { throw "The server window closed before FLAP became ready." }
            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $deadline)
        if (-not $ready) { throw "FLAP did not become ready. Check the server window for errors." }
    }

    Write-Host "FLAP is ready at $url. Close the server window to stop it."
    if (-not $NoBrowser) {
        if ($Kiosk) {
            # A separate profile prevents an existing Chrome session from ignoring kiosk flags.
            $chromeProfile = Join-Path $env:LOCALAPPDATA "FLAP\Chrome"
            $chromeArgs = "--user-data-dir=`"$chromeProfile`" --kiosk --no-first-run $url"
            $browser = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru
            Write-Host "Chrome kiosk opened. Press Alt+F4 to exit. Its settings are separate from your normal browser."
            if ($RestartHour -ge 0 -and $RestartHour -le 23) {
                Write-Host "Chrome restarts nightly at $($RestartHour):00 to keep memory low. Keep this window open (-RestartHour -1 disables)."
                $lastRestart = (Get-Date).Date
                while ($true) {
                    Start-Sleep -Seconds 30
                    if ($browser.HasExited) { break }
                    $time = Get-Date
                    if ($time.Hour -eq $RestartHour -and $time.Date -ne $lastRestart) {
                        $lastRestart = $time.Date
                        Stop-Process -Id $browser.Id -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Seconds 3
                        $browser = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru
                    }
                }
            }
        } else {
            Start-Process $url
        }
    }
} catch {
    Write-Host "FLAP startup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
