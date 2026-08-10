// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

try {
  execSync('electron-builder install-app-deps', { stdio: 'inherit' });
} catch (error) {
  const strict =
    process.env.CI === 'true' ||
    process.env.MINUTES_STRICT_NATIVE_BUILD === '1';

  console.warn('');
  console.warn(
    '[minutes] electron:install-app-deps failed — native addons were not rebuilt.'
  );
  if (process.platform === 'win32') {
    console.warn(
      '[minutes] The app can still run on Windows; optional modules (e.g. windows-ucv) are skipped.'
    );
    console.warn(
      '[minutes] For full native support, install Visual Studio 2022 with "Desktop development with C++".'
    );
  } else if (process.platform === 'darwin') {
    console.warn(
      '[minutes] On macOS, node-gyp needs a supported Python (3.12 recommended).'
    );
    console.warn(
      '[minutes] Avoid Homebrew python@3.14 — it can break gyp Makefiles ("missing separator").'
    );
    console.warn(
      '[minutes] Tip: export PYTHON=$(which python3.12) before pnpm install.'
    );
  } else {
    console.warn(
      '[minutes] Install build tools for native addons (python3, make, g++), then retry.'
    );
  }
  console.warn('');

  if (strict) {
    throw error;
  }
}
