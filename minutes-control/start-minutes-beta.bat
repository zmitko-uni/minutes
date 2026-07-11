@echo off
setlocal

call "%~dp0_repo-root.bat"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

echo [minutes] Spoustim Minutes Beta (lokalni dev, data v %%APPDATA%%\Minutes-Beta)...
echo.

call pnpm run start:minutes:beta
set EXIT_CODE=%ERRORLEVEL%

if not %EXIT_CODE%==0 (
  echo.
  echo [minutes] Spusteni skoncilo s chybou (%EXIT_CODE%).
)

pause
exit /b %EXIT_CODE%
