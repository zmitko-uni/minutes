// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  getMinutesInstallerAssetName,
  getMinutesReleaseChannel,
  type MinutesReleaseChannel,
} from './releaseChannel.std.ts';

export const MINUTES_GITHUB_REPO = 'zmitko-uni/minutes';

export const MINUTES_GITHUB_RELEASES_URL = `https://github.com/${MINUTES_GITHUB_REPO}/releases`;

export const MINUTES_GITHUB_RELEASES_LATEST_API_URL = `https://api.github.com/repos/${MINUTES_GITHUB_REPO}/releases/latest`;

export const MINUTES_GITHUB_RELEASES_LIST_API_URL = `https://api.github.com/repos/${MINUTES_GITHUB_REPO}/releases?per_page=30`;

export function getMinutesInstallerAssetNameForChannel(
  channel: MinutesReleaseChannel = getMinutesReleaseChannel()
): string {
  return getMinutesInstallerAssetName(channel);
}

export const MINUTES_INSTALLER_ASSET_NAME = getMinutesInstallerAssetName('prod');

export const MINUTES_INSTALLER_LATEST_DOWNLOAD_URL = `${MINUTES_GITHUB_RELEASES_URL}/latest/download/${MINUTES_INSTALLER_ASSET_NAME}`;

export type AppUpdateCheckResult = Readonly<{
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  downloadUrl: string | null;
  checkSkipped: boolean;
  errorMessage: string | null;
}>;

export type AppUpdateProgress = Readonly<{
  phase: 'downloading' | 'launching' | 'complete' | 'error' | 'ready';
  message: string;
  percent?: number;
}>;

export type PendingAppUpdate = Readonly<{
  version: string;
  installerPath: string;
  downloadUrl: string;
  releaseUrl: string;
  downloadedAt: number;
  fileSizeBytes: number;
  /** False for installers left by legacy auto-download on check. */
  userInitiated?: boolean;
}>;

export type AppUpdateInstallResult = Readonly<{
  installerPath: string;
}>;
