# Start AI PlacePro backend (Flask API on port 5000)
$ProjectRoot = $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$BackendDir = Join-Path $ProjectRoot "backend"

Set-Location $BackendDir
& $VenvPython run.py
