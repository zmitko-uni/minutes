// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app } from 'electron';

import './minutes_runtime.main.ts';

import { getMinutesAppUserModelId, getMinutesDisplayName } from '../ts/minutes/releaseChannel.std.ts';
import { packageJson } from '../ts/util/packageJson.main.ts';
import { createLogger } from '../ts/logging/log.std.ts';
import * as GlobalErrors from './global_errors.main.ts';

const log = createLogger('startup_config');

GlobalErrors.addHandler();

// Set umask early on in the process lifecycle to ensure file permissions are
// set such that only we have read access to our files
process.umask(0o077);

export const AUMID =
  process.env.NODE_CONFIG_ENV === 'minutes' ||
  process.env.NODE_CONFIG_ENV === 'minutes-beta'
    ? getMinutesAppUserModelId(packageJson.productName)
    : `org.whispersystems.${packageJson.name}`;

if (
  process.env.NODE_CONFIG_ENV === 'minutes' ||
  process.env.NODE_CONFIG_ENV === 'minutes-beta'
) {
  app.setName(getMinutesDisplayName(packageJson.productName));
}

log.info('Set Windows Application User Model ID (AUMID)', {
  AUMID,
});
app.setAppUserModelId(AUMID);
