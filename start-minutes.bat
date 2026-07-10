@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

echo [minutes] Spoustim build + aplikaci...
echo.

call pnpm run start:minutes
set EXIT_CODE=%ERRORLEVEL%

if not %EXIT_CODE%==0 (
  echo.
  echo [minutes] Spusteni skoncilo s chybou (%EXIT_CODE%).
)

pause
exit /b %EXIT_CODE%
