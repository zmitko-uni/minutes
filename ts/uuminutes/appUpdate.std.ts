// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const UUMINUTES_GITHUB_REPO = 'zmitko-uni/minutes';

export const UUMINUTES_GITHUB_RELEASES_URL = `https://github.com/${UUMINUTES_GITHUB_REPO}/releases`;

export const UUMINUTES_GITHUB_RELEASES_LATEST_API_URL = `https://api.github.com/repos/${UUMINUTES_GITHUB_REPO}/releases/latest`;

export const UUMINUTES_INSTALLER_ASSET_NAME = 'Minutes-setup-windows-x64.exe';

export const UUMINUTES_INSTALLER_LATEST_DOWNLOAD_URL = `${UUMINUTES_GITHUB_RELEASES_URL}/latest/download/${UUMINUTES_INSTALLER_ASSET_NAME}`;

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
}>;

export type AppUpdateInstallResult = Readonly<{
  installerPath: string;
}>;
