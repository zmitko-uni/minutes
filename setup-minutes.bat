@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

echo [minutes] Instalace zavislosti (pnpm install)...
echo.

call pnpm install
if errorlevel 1 (
  echo.
  echo [minutes] pnpm install selhalo.
  pause
  exit /b 1
)

echo.
echo [minutes] Generovani assetu (pnpm run generate)...
echo.

call pnpm run generate
set EXIT_CODE=%ERRORLEVEL%

if not %EXIT_CODE%==0 (
  echo.
  echo [minutes] generate skoncilo s chybou (%EXIT_CODE%).
) else (
  echo.
  echo [minutes] Hotovo. Spustte aplikaci: start-minutes.bat
)

pause
exit /b %EXIT_CODE%
