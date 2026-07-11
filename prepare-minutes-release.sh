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

VERSION="$(node -p "require('./package.json').version")"

echo "[minutes] Priprava release verze ${VERSION}"
echo
echo "Kroky: install -> ikony -> generate -> kontrola typu"
echo "(Instalator .dmg zatim ne — spustte az po rucnim testu build-minutes-release.sh)"
echo "Pri buildu instalatoru se verze v package.json automaticky zvysi o 1."
echo

echo "=== [1/4] pnpm install ==="
echo
if ! pnpm install; then
  echo
  echo "[minutes] pnpm install selhalo."
  echo "  Pokud jde o native moduly, zkontrolujte Xcode Command Line Tools:"
  echo "  xcode-select -p"
  echo "  Pokud chybi, nainstalujte je: xcode-select --install"
  exit 1
fi

echo
echo "=== [2/4] Ikony minutes ==="
echo
if ! pnpm run build:minutes-icons; then
  echo
  echo "[minutes] Priprava release selhala."
  exit 1
fi

echo
echo "=== [3/4] Generate (locales, emoji, produkcni bundles a styly) ==="
echo
if ! pnpm run generate; then
  echo
  echo "[minutes] Priprava release selhala."
  exit 1
fi

echo
echo "=== [4/4] Kontrola TypeScript typu ==="
echo
if ! pnpm run check:types; then
  echo
  echo "[minutes] Priprava release selhala."
  exit 1
fi

echo
echo "[minutes] Priprava release ${VERSION} dokoncena."
echo
echo "Dalsi kroky:"
echo "  1. Otestujte aplikaci:  ./start-minutes-quick.sh"
echo "  2. Sestavte instalator:  ./build-minutes-release.sh"
echo "     (vystup: release/minutes/Minutes-${VERSION}-mac-arm64.dmg)"
echo
