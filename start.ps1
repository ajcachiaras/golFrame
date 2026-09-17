# Double-click start.bat (which calls this) to launch GolFrame locally and
# open it in your browser. Safe to run when it's already up -- it just opens
# the browser instead of starting a second server.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
# 127.0.0.1, not localhost -- the server binds to the IPv4 address specifically,
# and "localhost" resolving to ::1 first on some machines adds enough delay to
# spuriously fail a short-timeout health check.
$healthUrl = "http://127.0.0.1:$port/api/health"
$url = "http://localhost:$port"

function Test-ServerUp {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 3 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (Test-ServerUp) {
    Write-Host "GolFrame is already running -- opening browser."
    Start-Process $url
    exit
}

$distPath = Join-Path $root "frontend\dist"
if (-not (Test-Path $distPath)) {
    Write-Host "First run: building the frontend (this only happens once)..."
    Push-Location (Join-Path $root "frontend")
    npm ci
    npm run build
    Pop-Location
}

Write-Host "Starting GolFrame server..."
$backendDir = Join-Path $root "backend"
Start-Process -FilePath "python" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$port" `
    -WorkingDirectory $backendDir

Write-Host "Waiting for it to come up..."
$maxWaitSeconds = 30
$waited = 0
while (-not (Test-ServerUp) -and $waited -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 1
    $waited++
}

if (Test-ServerUp) {
    Start-Process $url
} else {
    Write-Host "Server didn't come up within $maxWaitSeconds seconds -- check the server window it opened for errors."
}
