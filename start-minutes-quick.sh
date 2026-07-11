#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[minutes] pnpm neni v PATH. Nainstalujte: npm install -g pnpm"
  exit 1
fi

echo "[minutes] Spoustim aplikaci (bez rebuildu)..."
echo

if ! pnpm run start:minutes:quick; then
  echo
  echo "[minutes] Spusteni skoncilo s chybou."
  exit 1
fi
