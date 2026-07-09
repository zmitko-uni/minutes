@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [uuMinutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

echo [uuMinutes] Spoustim aplikaci (bez rebuildu)...
echo.

call pnpm run start:uuminutes:quick
set EXIT_CODE=%ERRORLEVEL%

if not %EXIT_CODE%==0 (
  echo.
  echo [uuMinutes] Spusteni skoncilo s chybou (%EXIT_CODE%).
)

pause
exit /b %EXIT_CODE%
