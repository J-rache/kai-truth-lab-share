$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$port = if ($env:TRUTH_LAB_PORT) { $env:TRUTH_LAB_PORT } else { "8799" }

Push-Location $root
try {
  $existing = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  if (-not $existing) {
    Start-Process -FilePath "node" -ArgumentList "src/server.mjs" -WorkingDirectory $root -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 2
  }
  Start-Process "http://127.0.0.1:$port"
  Write-Host "Codex Truth Lab: http://127.0.0.1:$port"
} finally {
  Pop-Location
}

