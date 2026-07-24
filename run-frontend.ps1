# Start AI PlacePro frontend (HTTP server on port 5500)
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot
python -m http.server 5500
