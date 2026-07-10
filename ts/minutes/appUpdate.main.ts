// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { join } from 'node:path';

import { app, BrowserWindow, type WebContents } from 'electron';
import semver from 'semver';

import { createLogger } from '../logging/log.std.ts';
import { AI_SETTINGS_DIR_NAME } from './constants.std.ts';
import {
  MINUTES_GITHUB_RELEASES_LATEST_API_URL,
  MINUTES_GITHUB_RELEASES_URL,
  MINUTES_INSTALLER_ASSET_NAME,
  MINUTES_INSTALLER_LATEST_DOWNLOAD_URL,
  type AppUpdateCheckResult,
  type AppUpdateProgress,
  type PendingAppUpdate,
} from './appUpdate.std.ts';
import { downloadHttpsFile } from './httpsDownload.main.ts';

const log = createLogger('minutes/appUpdate');

const GITHUB_USER_AGENT = 'minutes-Desktop';
const PENDING_UPDATE_FILE_NAME = 'pending-app-update.json';

let activeDownloadVersion: string | null = null;

type GitHubReleaseAsset = Readonly<{
  name?: string;
  browser_download_url?: string;
}>;

type GitHubLatestRelease = Readonly<{
  tag_name?: string;
  html_url?: string;
  assets?: ReadonlyArray<GitHubReleaseAsset>;
}>;

function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

function parseSemverVersion(version: string): semver.SemVer | null {
  const normalized = normalizeVersionTag(version);
  return semver.parse(normalized) ?? semver.parse(normalized, { loose: true });
}

function isRemoteVersionNewer(
  latestVersion: string,
  currentVersion: string
): boolean {
  const latest = parseSemverVersion(latestVersion);
  const current = parseSemverVersion(currentVersion);
  if (!latest || !current) {
    return false;
  }
  return semver.gt(latest, current);
}

function getUpdatesDir(): string {
  return join(app.getPath('userData'), AI_SETTINGS_DIR_NAME, 'updates');
}

function getPendingUpdateFilePath(): string {
  return join(getUpdatesDir(), PENDING_UPDATE_FILE_NAME);
}

async function getInstallerDestination(version: string): Promise<string> {
  await mkdir(getUpdatesDir(), { recursive: true });
  return join(getUpdatesDir(), `Minutes-setup-${version}.exe`);
}

function fetchHttpsJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(
      url,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': GITHUB_USER_AGENT,
        },
      },
      response => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          fetchHttpsJson<T>(response.headers.location).then(resolve).catch(reject);
          response.resume();
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(
              `GitHub API vrátilo HTTP ${response.statusCode ?? 'unknown'}`
            )
          );
          response.resume();
          return;
        }

        const chunks: Array<Buffer> = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
        response.on('error', reject);
      }
    );

    request.on('error', reject);
  });
}

function resolveInstallerDownloadUrl(release: GitHubLatestRelease): string {
  const asset = release.assets?.find(
    item => item.name === MINUTES_INSTALLER_ASSET_NAME
  );
  return (
    asset?.browser_download_url ?? MINUTES_INSTALLER_LATEST_DOWNLOAD_URL
  );
}

export function broadcastAppUpdateProgress(
  progress: AppUpdateProgress
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('minutes:app-update-progress', progress);
    }
  }
}

export function createAppUpdateProgressSender(
  webContents: WebContents | null | undefined
): (progress: AppUpdateProgress) => void {
  return progress => {
    broadcastAppUpdateProgress(progress);
    if (!webContents || webContents.isDestroyed()) {
      return;
    }
    webContents.send('minutes:app-update-progress', progress);
  };
}

export async function checkForAppUpdate(
  currentVersion: string = app.getVersion()
): Promise<AppUpdateCheckResult> {
  if (!app.isPackaged) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseUrl: MINUTES_GITHUB_RELEASES_URL,
      downloadUrl: MINUTES_INSTALLER_LATEST_DOWNLOAD_URL,
      checkSkipped: true,
      errorMessage: null,
    };
  }

  try {
    const release = await fetchHttpsJson<GitHubLatestRelease>(
      MINUTES_GITHUB_RELEASES_LATEST_API_URL
    );
    const latestVersion = release.tag_name
      ? normalizeVersionTag(release.tag_name)
      : null;

    if (!latestVersion) {
      throw new Error('Release na GitHubu nemá platný tag verze.');
    }

    const updateAvailable = isRemoteVersionNewer(
      latestVersion,
      currentVersion
    );

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl: release.html_url ?? MINUTES_GITHUB_RELEASES_URL,
      downloadUrl: resolveInstallerDownloadUrl(release),
      checkSkipped: false,
      errorMessage: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Kontrola aktualizace selhala.';
    log.warn('checkForAppUpdate failed', message);
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: MINUTES_GITHUB_RELEASES_URL,
      downloadUrl: MINUTES_INSTALLER_LATEST_DOWNLOAD_URL,
      checkSkipped: false,
      errorMessage: message,
    };
  }
}

async function writePendingAppUpdate(
  pending: PendingAppUpdate
): Promise<void> {
  await mkdir(getUpdatesDir(), { recursive: true });
  await writeFile(getPendingUpdateFilePath(), JSON.stringify(pending, null, 2), 'utf8');
}

export async function getPendingAppUpdate(): Promise<PendingAppUpdate | null> {
  try {
    const raw = await readFile(getPendingUpdateFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PendingAppUpdate>;
    if (
      typeof parsed.version !== 'string' ||
      typeof parsed.installerPath !== 'string' ||
      typeof parsed.downloadUrl !== 'string' ||
      typeof parsed.releaseUrl !== 'string' ||
      typeof parsed.downloadedAt !== 'number'
    ) {
      return null;
    }

    const fileInfo = await stat(parsed.installerPath);
    if (fileInfo.size <= 0) {
      return null;
    }

    return {
      version: parsed.version,
      installerPath: parsed.installerPath,
      downloadUrl: parsed.downloadUrl,
      releaseUrl: parsed.releaseUrl,
      downloadedAt: parsed.downloadedAt,
      fileSizeBytes: fileInfo.size,
    };
  } catch {
    return null;
  }
}

async function clearPendingAppUpdate(): Promise<void> {
  try {
    await unlink(getPendingUpdateFilePath());
  } catch {
    // ignore missing metadata
  }
}

export async function downloadAppUpdate(options: {
  downloadUrl: string;
  latestVersion: string;
  releaseUrl: string;
  sendProgress?: (progress: AppUpdateProgress) => void;
}): Promise<PendingAppUpdate> {
  if (activeDownloadVersion === options.latestVersion) {
    const existing = await getPendingAppUpdate();
    if (existing?.version === options.latestVersion) {
      return existing;
    }
  }

  activeDownloadVersion = options.latestVersion;
  const destination = await getInstallerDestination(options.latestVersion);
  const sendProgress = options.sendProgress ?? broadcastAppUpdateProgress;

  try {
    try {
      await unlink(destination);
    } catch {
      // ignore missing partial file
    }

    sendProgress({
      phase: 'downloading',
      message: `Stahuji Minutes ${options.latestVersion}…`,
      percent: 0,
    });

    await downloadHttpsFile(
      options.downloadUrl,
      destination,
      (loaded, total) => {
        const percent =
          total && total > 0
            ? Math.min(99, Math.round((loaded / total) * 100))
            : undefined;
        sendProgress({
          phase: 'downloading',
          message: `Stahuji Minutes ${options.latestVersion}…`,
          percent,
        });
      }
    );

    const fileInfo = await stat(destination);
    if (fileInfo.size <= 0) {
      throw new Error('Stažený instalátor je prázdný.');
    }

    const pending: PendingAppUpdate = {
      version: options.latestVersion,
      installerPath: destination,
      downloadUrl: options.downloadUrl,
      releaseUrl: options.releaseUrl,
      downloadedAt: Date.now(),
      fileSizeBytes: fileInfo.size,
    };

    await writePendingAppUpdate(pending);

    sendProgress({
      phase: 'ready',
      message: `Minutes ${options.latestVersion} je připraven k instalaci.`,
      percent: 100,
    });

    return pending;
  } finally {
    if (activeDownloadVersion === options.latestVersion) {
      activeDownloadVersion = null;
    }
  }
}

export async function installPendingAppUpdate(options: {
  version?: string;
  sendProgress?: (progress: AppUpdateProgress) => void;
}): Promise<{ installerPath: string }> {
  const pending = await getPendingAppUpdate();
  if (!pending) {
    throw new Error('Stažený instalátor nebyl nalezen.');
  }
  if (options.version && pending.version !== options.version) {
    throw new Error(
      `Stažená verze (${pending.version}) neodpovídá požadované (${options.version}).`
    );
  }

  const sendProgress = options.sendProgress ?? broadcastAppUpdateProgress;

  sendProgress({
    phase: 'launching',
    message: 'Spouštím instalátor…',
    percent: 100,
  });

  spawn(pending.installerPath, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  }).unref();

  sendProgress({
    phase: 'complete',
    message: 'Instalátor spuštěn. Minutes se zavře.',
    percent: 100,
  });

  setTimeout(() => {
    app.quit();
  }, 750);

  return { installerPath: pending.installerPath };
}

export async function downloadAndInstallAppUpdate(options: {
  downloadUrl: string;
  latestVersion: string;
  releaseUrl: string;
  sendProgress?: (progress: AppUpdateProgress) => void;
}): Promise<{ installerPath: string }> {
  await downloadAppUpdate(options);
  return installPendingAppUpdate({
    version: options.latestVersion,
    sendProgress: options.sendProgress,
  });
}

export async function resolveStartupAppUpdateState(
  currentVersion: string = app.getVersion()
): Promise<{
  check: AppUpdateCheckResult;
  pending: PendingAppUpdate | null;
}> {
  const check = await checkForAppUpdate(currentVersion);
  const pending = await getPendingAppUpdate();

  if (
    pending &&
    check.latestVersion &&
    !isRemoteVersionNewer(check.latestVersion, pending.version) &&
    isRemoteVersionNewer(pending.version, currentVersion)
  ) {
    return { check, pending };
  }

  if (
    pending &&
    check.latestVersion &&
    isRemoteVersionNewer(check.latestVersion, pending.version)
  ) {
    try {
      await unlink(pending.installerPath);
    } catch {
      // ignore
    }
    await clearPendingAppUpdate();
    return { check, pending: null };
  }

  if (
    pending &&
    (!check.latestVersion || !isRemoteVersionNewer(pending.version, currentVersion))
  ) {
    try {
      await unlink(pending.installerPath);
    } catch {
      // ignore
    }
    await clearPendingAppUpdate();
    return { check, pending: null };
  }

  return { check, pending };
}
