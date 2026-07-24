@echo off
echo Start AI PlacePro backend (Flask API on port 5000)
cd /d "%~dp0backend"
..\.venv\Scripts\python.exe run.py
pause
