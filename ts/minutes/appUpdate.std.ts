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

const MINUTES_INSTALLER_ASSET_NAME_MACOS = 'Minutes-mac-arm64.dmg';

/**
 * GitHub release asset name for the given platform + release channel. macOS
 * ships a single arm64 dmg (no per-channel variant), so on 'darwin' the channel
 * is ignored; every other platform uses the channel-specific Windows installer
 * name from releaseChannel.std. `platform` mirrors the values of
 * `process.platform` ('darwin', 'win32', …); pass `window.platform` from
 * renderer/DOM contexts.
 */
export function getMinutesInstallerAssetNameForPlatform(
  platform: string,
  channel: MinutesReleaseChannel = getMinutesReleaseChannel()
): string {
  return platform === 'darwin'
    ? MINUTES_INSTALLER_ASSET_NAME_MACOS
    : getMinutesInstallerAssetName(channel);
}

/** Builds the "latest release" download URL for the given platform's asset. */
export function getMinutesInstallerLatestDownloadUrl(platform: string): string {
  return `${MINUTES_GITHUB_RELEASES_URL}/latest/download/${getMinutesInstallerAssetNameForPlatform(platform)}`;
}

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
