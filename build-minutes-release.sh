#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[minutes] Node.js neni v PATH."
  exit 1
fi

# --- Xcode Command Line Tools (native moduly se buildi pres ne) ---
if ! xcode-select -p >/dev/null 2>&1; then
  echo
  echo "[minutes] Xcode Command Line Tools nenalezeny."
  echo "  Nainstalujte je prikazem: xcode-select --install"
  echo
  exit 1
fi

echo "[minutes] Xcode Command Line Tools OK."
echo

echo "[minutes] Build instalatoru - muze trvat 15-30 minut..."
echo "Verze v package.json se pred buildem automaticky zvysi o 1."
echo

if ! pnpm run build:minutes:installer; then
  echo
  echo "[minutes] Build selhal."
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
echo
echo "[minutes] Hotovo. Instalator: release/minutes/Minutes-${VERSION}-mac-arm64.dmg"
