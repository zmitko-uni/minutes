@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [uuMinutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [uuMinutes] Node.js neni v PATH.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VERSION=%%v"

echo [uuMinutes] Priprava release verze !VERSION!
echo.
echo Kroky: install -^> ikony -^> generate -^> kontrola typu
echo (Instalator .exe zatim ne — spustte az po rucnim testu build-uuminutes-release.bat)
echo Pri buildu instalatoru se verze v package.json automaticky zvysi o 1.
echo.

echo === [1/4] pnpm install ===
echo.
call pnpm install
if errorlevel 1 (
  echo.
  echo [uuMinutes] pnpm install selhalo.
  echo   Pokud jde o native moduly, zkuste x64 Native Tools Command Prompt for VS 2022
  echo   nebo spustte build-uuminutes-release.bat ^(nacte VS C++ prostredi^).
  pause
  exit /b 1
)

echo.
echo === [2/4] Ikony uuMinutes ===
echo.
call pnpm run build:uuminutes-icons
if errorlevel 1 goto :failed

echo.
echo === [3/4] Generate ^(locales, emoji, produkcni bundles a styly^) ===
echo.
call pnpm run generate
if errorlevel 1 goto :failed

echo.
echo === [4/4] Kontrola TypeScript typu ===
echo.
call pnpm run check:types
if errorlevel 1 goto :failed

echo.
echo [uuMinutes] Priprava release !VERSION! dokoncena.
echo.
echo Dalsi kroky:
echo   1. Otestujte aplikaci:  start-uuminutes-quick.bat
echo   2. Sestavte instalator:  build-uuminutes-release.bat
echo      ^(vystup: release\uuminutes\Minutes-setup-!VERSION!.exe^)
echo.
pause
exit /b 0

:failed
echo.
echo [uuMinutes] Priprava release selhala.
pause
exit /b 1