@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [uuMinutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

echo [uuMinutes] Instalace zavislosti (pnpm install)...
echo.

call pnpm install
if errorlevel 1 (
  echo.
  echo [uuMinutes] pnpm install selhalo.
  pause
  exit /b 1
)

echo.
echo [uuMinutes] Generovani assetu (pnpm run generate)...
echo.

call pnpm run generate
set EXIT_CODE=%ERRORLEVEL%

if not %EXIT_CODE%==0 (
  echo.
  echo [uuMinutes] generate skoncilo s chybou (%EXIT_CODE%).
) else (
  echo.
  echo [uuMinutes] Hotovo. Spustte aplikaci: start-uuminutes.bat
)

pause
exit /b %EXIT_CODE%
