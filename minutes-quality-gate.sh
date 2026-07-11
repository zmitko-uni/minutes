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

export NODE_CONFIG_ENV=minutes

echo "[minutes] Quality gate — stejne kontroly jako GitHub CI (minutes-ci.yml)"
echo
echo "Kroky: generate -> check:types"
echo "Spustte pred pushem, aby release nepadal na TypeScript chyby."
echo

echo "=== [1/2] Generate (locales, ICU typy, produkcni bundles) ==="
echo
if ! pnpm run generate; then
  echo
  echo "[minutes] Quality gate SELHAL — opravte chyby vyse pred pushem."
  echo
  exit 1
fi

echo
echo "=== [2/2] Kontrola TypeScript typu (tsgo --noEmit) ==="
echo
if ! pnpm run check:types; then
  echo
  echo "[minutes] Quality gate SELHAL — opravte chyby vyse pred pushem."
  echo
  exit 1
fi

echo
echo "[minutes] Quality gate OK — lze pushovat / spustit release."
echo
