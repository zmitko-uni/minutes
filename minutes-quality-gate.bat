@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [minutes] Node.js neni v PATH.
  pause
  exit /b 1
)

set "NODE_CONFIG_ENV=minutes"

echo [minutes] Quality gate — stejne kontroly jako GitHub CI ^(minutes-ci.yml^)
echo.
echo Kroky: generate -^> check:types
echo Spustte pred pushem, aby release nepadal na TypeScript chyby.
echo.

echo === [1/2] Generate ^(locales, ICU typy, produkcni bundles^) ===
echo.
call pnpm run generate
if errorlevel 1 goto :failed

echo.
echo === [2/2] Kontrola TypeScript typu ^(tsgo --noEmit^) ===
echo.
call pnpm run check:types
if errorlevel 1 goto :failed

echo.
echo [minutes] Quality gate OK — lze pushovat / spustit release.
echo.
pause
exit /b 0

:failed
echo.
echo [minutes] Quality gate SELHAL — opravte chyby vyse pred pushem.
echo.
pause
exit /b 1
