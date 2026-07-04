@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python run_app.py
  exit /b %errorlevel%
)

echo Python not found. Opening offline web package...
start "" "%~dp0web\index.html"
