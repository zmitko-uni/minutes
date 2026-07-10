// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer, type IpcRendererEvent } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { drop } from '../util/drop.std.ts';
import {
  appUpdateUi,
  getAppUpdateUiState,
  subscribeAppUpdateUi,
} from './appUpdateEvents.std.ts';
import type {
  AppUpdateCheckResult,
  AppUpdateProgress,
  PendingAppUpdate,
} from './appUpdate.std.ts';

const log = createLogger('minutes/appUpdateService');

const STARTUP_CHECK_DELAY_MS = 8_000;

let startupFlowStarted = false;
let backgroundDownloadPromise: Promise<void> | null = null;

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  return ipcRenderer.invoke('minutes:check-for-app-update');
}

export async function getStartupAppUpdateState(): Promise<{
  check: AppUpdateCheckResult;
  pending: PendingAppUpdate | null;
}> {
  return ipcRenderer.invoke('minutes:get-startup-app-update-state');
}

export async function getPendingAppUpdate(): Promise<PendingAppUpdate | null> {
  return ipcRenderer.invoke('minutes:get-pending-app-update');
}

export async function downloadAppUpdate(options: {
  downloadUrl: string;
  latestVersion: string;
  releaseUrl: string;
  userInitiated?: boolean;
}): Promise<PendingAppUpdate> {
  return ipcRenderer.invoke('minutes:download-app-update', options);
}

export async function installPendingAppUpdate(options: {
  version?: string;
} = {}): Promise<{ installerPath: string }> {
  return ipcRenderer.invoke('minutes:install-pending-app-update', options);
}

export async function downloadAndInstallAppUpdate(options: {
  downloadUrl: string;
  latestVersion: string;
  releaseUrl: string;
}): Promise<{ installerPath: string }> {
  return ipcRenderer.invoke('minutes:download-and-install-app-update', options);
}

export function subscribeAppUpdateProgress(
  listener: (progress: AppUpdateProgress) => void
): () => void {
  const handler = (
    _event: IpcRendererEvent,
    progress: AppUpdateProgress
  ): void => {
    listener(progress);
  };
  ipcRenderer.on('minutes:app-update-progress', handler);
  return () => {
    ipcRenderer.removeListener('minutes:app-update-progress', handler);
  };
}

export { subscribeAppUpdateUi, getAppUpdateUiState, appUpdateUi };

async function runBackgroundDownload(check: AppUpdateCheckResult): Promise<void> {
  if (
    !check.updateAvailable ||
    !check.latestVersion ||
    !check.downloadUrl ||
    !check.releaseUrl
  ) {
    return;
  }

  appUpdateUi.setDownloading(check, {
    phase: 'downloading',
    message: `Stahuji Minutes ${check.latestVersion}…`,
    percent: 0,
  });

  try {
    const pending = await downloadAppUpdate({
      downloadUrl: check.downloadUrl,
      latestVersion: check.latestVersion,
      releaseUrl: check.releaseUrl,
      userInitiated: true,
    });
    appUpdateUi.setReady(check, pending);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Stažení aktualizace selhalo.';
    log.warn('background app update download failed', message);
    appUpdateUi.setAvailable(check);
  }
}

export function startBackgroundAppUpdateDownload(
  check: AppUpdateCheckResult
): Promise<void> {
  if (backgroundDownloadPromise) {
    return backgroundDownloadPromise;
  }

  backgroundDownloadPromise = runBackgroundDownload(check).finally(() => {
    backgroundDownloadPromise = null;
  });
  return backgroundDownloadPromise;
}

async function runStartupAppUpdateFlow(): Promise<void> {
  appUpdateUi.setChecking();

  try {
    const { check, pending } = await getStartupAppUpdateState();

    if (check.checkSkipped) {
      appUpdateUi.setCurrent(check);
      return;
    }

    if (check.errorMessage && !check.updateAvailable) {
      appUpdateUi.setError(check.errorMessage, check);
      return;
    }

    if (
      pending?.userInitiated &&
      check.latestVersion &&
      pending.version === check.latestVersion
    ) {
      appUpdateUi.setReady(check, pending);
      return;
    }

    if (!check.updateAvailable || !check.latestVersion) {
      appUpdateUi.setCurrent(check);
      return;
    }

    appUpdateUi.setAvailable(check);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Kontrola aktualizace selhala.';
    log.warn('startup app update flow failed', message);
    appUpdateUi.setError(message, null);
  }
}

export function initializeAppUpdate(): void {
  if (startupFlowStarted) {
    return;
  }
  startupFlowStarted = true;

  subscribeAppUpdateProgress(progress => {
    const current = getAppUpdateUiState();
    if (current.kind !== 'downloading') {
      return;
    }
    appUpdateUi.setDownloading(current.check, progress);
  });

  setTimeout(() => {
    drop(runStartupAppUpdateFlow());
  }, STARTUP_CHECK_DELAY_MS);
}
