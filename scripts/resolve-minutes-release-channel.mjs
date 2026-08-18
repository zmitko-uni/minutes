#!/usr/bin/env node
// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { resolveMinutesReleaseChannel } from './utils/minutesReleaseChannel.mjs';

try {
  console.log(resolveMinutesReleaseChannel(process.argv[2] ?? ''));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
