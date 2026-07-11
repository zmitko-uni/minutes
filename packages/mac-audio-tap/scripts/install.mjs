// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'node:child_process';

if (process.platform === 'darwin') {
  execSync('node-gyp rebuild', { stdio: 'inherit' });
}
