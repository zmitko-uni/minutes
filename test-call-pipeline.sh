#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm"
  exit 1
fi

echo "[minutes] Test pipeline: Whisper preps -> AI korekce -> sumarizace"
echo
echo "Vychozi nahravka: 2026-07-09T18-48-59-973Z_Stand_Up_Zmítkovi_a0817902"
echo "Umisteni: ~/Library/Application Support/Minutes/minutes/recordings/"
echo
echo "Volitelne: set MINUTES_TEST_RECORDING=base_name_bez_pripony"
echo "Pro AI kroky: API klic z Nastaveni AI (stejny proces jako aplikace)."
echo "Fallback: export MINUTES_AI_API_KEY=sk-..."
echo "  nebo soubor ~/Library/Application Support/Minutes/minutes/pipeline-api-key.txt"
echo

if ! pnpm run test:call-pipeline; then
  echo
  echo "[minutes] Test skoncil s chybou."
  exit 1
fi

echo
echo "[minutes] Test dokoncen."
echo "  .transcript.whisper.md  - raw Whisper"
echo "  .transcript.corrected.md - po AI korekci"
echo "  .transcript.md         - finalni (stejny jako corrected)"
echo "  .summary.md            - AI sumarizace"
