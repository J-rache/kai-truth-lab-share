$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node src/cli.mjs autonomy run --json
} finally {
  Pop-Location
}

