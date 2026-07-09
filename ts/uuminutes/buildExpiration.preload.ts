// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { DAY } from '../util/durations/index.std.ts';
import { createLogger } from '../logging/log.std.ts';
import type { StorageInterface } from '../types/Storage.d.ts';

const log = createLogger('uuminutes/buildExpiration');

// Within Signal's allowed window (≤ 91 days) so sanity checks pass.
const ROLLING_BUILD_EXPIRATION = 30 * DAY;

export function isUuMinutesBuildExpirationDisabled(): boolean {
  return true;
}

export function getUuMinutesConnectHasBuildExpired(): boolean {
  return false;
}

export async function prepareUuMinutesBuildExpiration(
  storage: StorageInterface
): Promise<void> {
  log.info('disabling Signal build expiration for uuMinutes fork builds');

  window.getBuildExpiration = () => Date.now() + ROLLING_BUILD_EXPIRATION;

  const remoteBuildExpiration = storage.get('remoteBuildExpiration');
  if (remoteBuildExpiration != null) {
    log.warn(
      `clearing stored remoteBuildExpiration (${String(remoteBuildExpiration)})`
    );
    await storage.remove('remoteBuildExpiration');
  }
}

/** @deprecated use prepareUuMinutesBuildExpiration */
export function initializeUuMinutesBuildExpiration(): void {
  window.getBuildExpiration = () => Date.now() + ROLLING_BUILD_EXPIRATION;
}
