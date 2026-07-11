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

rem --- Visual Studio C++ (skip if cl.exe already available) ---
where cl >nul 2>&1
if errorlevel 1 (
  echo [minutes] Nacitam Visual Studio C++ prostredi...
  set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
  set "VSWDIR="

  if exist "!VSWHERE!" (
    for /f "usebackq tokens=*" %%i in (`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do set "VSWDIR=%%i"
  )

  if not defined VSWDIR (
    for %%E in (Community Professional Enterprise BuildTools) do (
      if exist "C:\Program Files\Microsoft Visual Studio\2022\%%E\Common7\Tools\VsDevCmd.bat" (
        set "VSWDIR=C:\Program Files\Microsoft Visual Studio\2022\%%E"
        goto :vs_found
      )
    )
  )

  :vs_found
  if not defined VSWDIR (
    echo.
    echo [minutes] Visual Studio 2022 s C++ workload nenalezeno.
    echo   Nainstalujte: Desktop development with C++
    echo   Nebo spustte z: x64 Native Tools Command Prompt for VS 2022
    echo.
    pause
    exit /b 1
  )

  if exist "!VSWDIR!\Common7\Tools\VsDevCmd.bat" (
    call "!VSWDIR!\Common7\Tools\VsDevCmd.bat" -no_logo -arch=amd64
  ) else if exist "!VSWDIR!\VC\Auxiliary\Build\vcvars64.bat" (
    call "!VSWDIR!\VC\Auxiliary\Build\vcvars64.bat"
  ) else (
    echo [minutes] VsDevCmd/vcvars64 nenalezeno v: !VSWDIR!
    pause
    exit /b 1
  )

  where cl >nul 2>&1
  if errorlevel 1 (
    echo [minutes] C++ compiler stale neni v PATH po nacteni VS.
    pause
    exit /b 1
  )

  echo [minutes] VS C++ prostredi OK.
  echo.
) else (
  echo [minutes] C++ compiler jiz v PATH - preskakuji VS setup.
  echo.
)

echo [minutes] Build instalatoru - muze trvat 15-30 minut...
echo Verze v package.json se pred buildem automaticky zvysi o 1.
echo Pro beta instalator: set MINUTES_RELEASE_CHANNEL=beta pred spustenim.
echo.

call pnpm run build:minutes:installer
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE%==0 (
  for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VERSION=%%v"
  echo [minutes] Hotovo. Instalator: release\minutes\
) else (
  echo [minutes] Build selhal ^(%EXIT_CODE%^).
)

pause
exit /b %EXIT_CODE%
