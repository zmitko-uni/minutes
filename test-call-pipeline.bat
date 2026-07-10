@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm
  pause
  exit /b 1
)

echo [minutes] Test pipeline: Whisper preps ^-^> AI korekce ^-^> sumarizace
echo.
echo Vychozi nahravka: 2026-07-09T18-48-59-973Z_Stand_Up_Zmítkovi_a0817902
echo Umisteni: %%APPDATA%%\Minutes\minutes\recordings\
echo.
echo Volitelne: set MINUTES_TEST_RECORDING=base_name_bez_pripony
echo Pro AI kroky: API klic z Nastaveni AI (stejny proces jako aplikace).
echo Fallback: set MINUTES_AI_API_KEY=sk-...
echo   nebo soubor %%APPDATA%%\Minutes\minutes\pipeline-api-key.txt
echo.

call pnpm run test:call-pipeline
set EXIT_CODE=%ERRORLEVEL%

if not %EXIT_CODE%==0 (
  echo.
  echo [minutes] Test skoncil s chybou (%EXIT_CODE%).
) else (
  echo.
  echo [minutes] Test dokoncen.
  echo   .transcript.whisper.md  - raw Whisper
  echo   .transcript.corrected.md - po AI korekci
  echo   .transcript.md         - finalni (stejny jako corrected)
  echo   .summary.md            - AI sumarizace
)

pause
exit /b %EXIT_CODE%
