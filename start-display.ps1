param(
    [switch]$Kiosk,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$url = "http://localhost:1000"

function Test-Display {
    try {
        $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 3
        return $health.app -eq "splitflap-smart"
    } catch [System.Net.WebException] {
        return $false
    }
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

        Write-Host "Building the production display..."
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "Production build failed. The server was not started." }

        $server = Start-Process -FilePath $env:ComSpec -WorkingDirectory $PSScriptRoot `
            -ArgumentList '/k "npm.cmd start"' -PassThru
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
            $profile = Join-Path $env:LOCALAPPDATA "FLAP\Chrome"
            Start-Process -FilePath $chrome -ArgumentList "--user-data-dir=`"$profile`" --kiosk --no-first-run $url"
            Write-Host "Chrome kiosk opened. Press Alt+F4 to exit. Its settings are separate from your normal browser."
        } else {
            Start-Process $url
        }
    }
} catch {
    Write-Host "FLAP startup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
