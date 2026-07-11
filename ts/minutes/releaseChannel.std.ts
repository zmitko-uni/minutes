// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import packageJson from '../../package.json' with { type: 'json' };

import {
  compareMinutesVersions,
  isMinutesBetaVersion,
} from './version.std.ts';

export type MinutesReleaseChannel = 'prod' | 'beta';

export const MINUTES_PROD_DISPLAY_NAME = 'Minutes';
export const MINUTES_BETA_DISPLAY_NAME = 'Minutes Beta';

export const MINUTES_PROD_STORAGE_FOLDER = 'Minutes';
export const MINUTES_BETA_STORAGE_FOLDER = 'Minutes-Beta';

export const MINUTES_PROD_APP_ID = 'org.minutes.desktop';
export const MINUTES_BETA_APP_ID = 'org.minutes.desktop.beta';

export const MINUTES_PROD_INSTALLER_ASSET = 'Minutes-setup-windows-x64.exe';
export const MINUTES_BETA_INSTALLER_ASSET = 'Minutes-Beta-setup-windows-x64.exe';

export function isMinutesBetaProductName(
  productName: string | undefined
): boolean {
  return productName?.trim() === MINUTES_BETA_DISPLAY_NAME;
}

export function getMinutesReleaseChannel(
  productName: string | undefined = packageJson.productName
): MinutesReleaseChannel {
  if (
    typeof process !== 'undefined' &&
    process.env?.MINUTES_DEV_CHANNEL === 'beta'
  ) {
    return 'beta';
  }

  return isMinutesBetaProductName(productName) ? 'beta' : 'prod';
}

export function getMinutesDisplayName(
  productName: string | undefined = packageJson.productName
): string {
  return getMinutesReleaseChannel(productName) === 'beta'
    ? MINUTES_BETA_DISPLAY_NAME
    : MINUTES_PROD_DISPLAY_NAME;
}

export function getMinutesStorageFolderName(
  productName: string | undefined = packageJson.productName
): string {
  return getMinutesReleaseChannel(productName) === 'beta'
    ? MINUTES_BETA_STORAGE_FOLDER
    : MINUTES_PROD_STORAGE_FOLDER;
}

export function getMinutesAppUserModelId(
  productName: string | undefined = packageJson.productName
): string {
  return getMinutesReleaseChannel(productName) === 'beta'
    ? MINUTES_BETA_APP_ID
    : MINUTES_PROD_APP_ID;
}

export function getMinutesInstallerAssetName(
  channel: MinutesReleaseChannel = getMinutesReleaseChannel()
): string {
  return channel === 'beta'
    ? MINUTES_BETA_INSTALLER_ASSET
    : MINUTES_PROD_INSTALLER_ASSET;
}

/** Porovná jen verze ve stejném kanálu (prod↔prod, beta↔beta). */
export function isMinutesVersionNewerInChannel(
  latest: string,
  current: string
): boolean {
  const latestIsBeta = isMinutesBetaVersion(latest);
  const currentIsBeta = isMinutesBetaVersion(current);

  if (latestIsBeta !== currentIsBeta) {
    return false;
  }

  return compareMinutesVersions(latest, current) === 1;
}

export function getMinutesInstallerFilePrefix(
  channel: MinutesReleaseChannel = getMinutesReleaseChannel()
): string {
  return channel === 'beta' ? 'Minutes-Beta-setup' : 'Minutes-setup';
}
