// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

// Signal's package.json sets build.nativeRebuilder=parallel. On macOS + pnpm,
// mute-state-change and mac-audio-tap both depend on the same node-addon-api
// path (…/node-addon-api@8.5.0/…) and parallel electron-rebuild races on
// shared .target.mk files → make "missing separator". Force sequential.
const installArgs = [
  'electron-builder',
  'install-app-deps',
  '-c.nativeRebuilder=sequential',
];

try {
  execSync(installArgs.join(' '), { stdio: 'inherit' });
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
      '[minutes] On macOS, rebuild uses sequential mode to avoid node-addon-api makefile races.'
    );
    console.warn(
      '[minutes] Also use Python 3.12 (not Homebrew python@3.14) — see minutes-release.yml.'
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
