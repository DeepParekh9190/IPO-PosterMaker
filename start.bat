@echo off
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js / npm not found. Install it from https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installing dependencies for the first run...
  call npm install
  if errorlevel 1 (echo Install failed. & pause & exit /b 1)
)
set PORT=3000
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'"
call npm run dev
pause
