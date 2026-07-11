@echo off
setlocal EnableDelayedExpansion

call "%~dp0_repo-root.bat"

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

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VERSION=%%v"

echo [minutes] Priprava release verze !VERSION!
echo.
echo Kroky: install -^> ikony -^> generate -^> kontrola typu
echo (Instalator .exe zatim ne — spustte az po rucnim testu build-minutes-release.bat)
echo Pri buildu instalatoru se verze v package.json automaticky zvysi o 1.
echo.

echo === [1/4] pnpm install ===
echo.
call pnpm install
if errorlevel 1 (
  echo.
  echo [minutes] pnpm install selhalo.
  echo   Pokud jde o native moduly, zkuste x64 Native Tools Command Prompt for VS 2022
  echo   nebo spustte minutes-control\build-minutes-release.bat ^(nacte VS C++ prostredi^).
  pause
  exit /b 1
)

echo.
echo === [2/4] Ikony minutes ===
echo.
call pnpm run build:minutes-icons
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
echo [minutes] Priprava release !VERSION! dokoncena.
echo.
echo Dalsi kroky:
echo   1. Otestujte aplikaci:  minutes-control\start-minutes-quick.bat
echo   2. Sestavte instalator:  minutes-control\build-minutes-release.bat
echo      ^(vystup: release\minutes\^)
echo.
pause
exit /b 0

:failed
echo.
echo [minutes] Priprava release selhala.
pause
exit /b 1
