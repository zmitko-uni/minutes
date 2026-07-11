#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm"
  exit 1
fi

echo "[minutes] Instalace zavislosti (pnpm install)..."
echo

if ! pnpm install; then
  echo
  echo "[minutes] pnpm install selhalo."
  exit 1
fi

echo
echo "[minutes] Generovani assetu (pnpm run generate)..."
echo

if ! pnpm run generate; then
  echo
  echo "[minutes] generate skoncilo s chybou."
  exit 1
fi

echo
echo "[minutes] Hotovo. Spustte aplikaci: ./start-minutes.sh"
