// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

try {
  execSync('electron-builder install-app-deps', { stdio: 'inherit' });
} catch (error) {
  const strict =
    process.env.CI === 'true' ||
    process.env.UUMINUTES_STRICT_NATIVE_BUILD === '1';

  console.warn('');
  console.warn(
    '[uuMinutes] electron:install-app-deps failed — native addons were not rebuilt.'
  );
  console.warn(
    '[uuMinutes] The app can still run on Windows; optional modules (e.g. windows-ucv) are skipped.'
  );
  console.warn(
    '[uuMinutes] For full native support, install Visual Studio 2022 with "Desktop development with C++".'
  );
  console.warn('');

  if (strict) {
    throw error;
  }
}
