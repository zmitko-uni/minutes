// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * node-config profile used by Minutes at runtime (`config/minutes.json`).
 * It disables the Signal auto-updater and selects the Minutes data directory.
 * Beta and prod share this profile; the data directory differs by channel.
 */
export const MINUTES_CONFIG_ENV = 'minutes';

export function resolveMinutesConfigEnv({
  isPackaged,
  currentValue,
}: Readonly<{
  isPackaged: boolean;
  currentValue: string | undefined;
}>): string {
  // Packaged builds must not honour a user-controlled environment variable.
  if (isPackaged) {
    return MINUTES_CONFIG_ENV;
  }

  const trimmed = currentValue?.trim();
  return trimmed != null && trimmed !== '' ? trimmed : MINUTES_CONFIG_ENV;
}
