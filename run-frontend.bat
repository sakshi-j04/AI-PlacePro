@echo off
echo Start AI PlacePro frontend (HTTP server on port 5500)
cd /d "%~dp0"
python -m http.server 5500
pause
