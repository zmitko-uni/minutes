// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

import { drop } from '../../util/drop.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import {
  dismissAppUpdateBanner,
  isAppUpdateBannerDismissed,
  subscribeAppUpdateUi,
  type AppUpdateUiState,
} from '../appUpdateEvents.std.ts';
import { UUMINUTES_GITHUB_RELEASES_URL } from '../appUpdate.std.ts';
import {
  downloadAndInstallAppUpdate,
  installPendingAppUpdate,
  startBackgroundAppUpdateDownload,
} from '../appUpdateService.preload.ts';

function getBannerVersion(state: AppUpdateUiState): string | null {
  if (state.kind === 'available' || state.kind === 'downloading' || state.kind === 'ready') {
    return state.check.latestVersion;
  }
  return null;
}

function AppUpdateBanner({
  state,
  isBusy,
  onDismiss,
  onInstallNow,
  onDownloadNow,
  onOpenRelease,
}: Readonly<{
  state: AppUpdateUiState;
  isBusy: boolean;
  onDismiss: () => void;
  onInstallNow: () => void;
  onDownloadNow: () => void;
  onOpenRelease: () => void;
}>): JSX.Element | null {
  if (state.kind === 'available') {
    const version = state.check.latestVersion;
    if (!version || isAppUpdateBannerDismissed(version)) {
      return null;
    }

    return (
      <div className="UuMinutesAppUpdateBanner UuMinutesAppUpdateBanner--available">
        <span className="UuMinutesAppUpdateBanner__text">
          Je dostupná nová verze Minutes {version}. Stahování proběhne na
          pozadí, nebo aktualizujte hned.
        </span>
        <div className="UuMinutesAppUpdateBanner__actions">
          <button type="button" disabled={isBusy} onClick={onDownloadNow}>
            Aktualizovat
          </button>
          <button type="button" disabled={isBusy} onClick={onOpenRelease}>
            Release notes
          </button>
          <button type="button" disabled={isBusy} onClick={onDismiss}>
            Později
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'downloading') {
    const version = state.check.latestVersion;
    if (!version || isAppUpdateBannerDismissed(version)) {
      return null;
    }

    return (
      <div className="UuMinutesAppUpdateBanner UuMinutesAppUpdateBanner--downloading">
        <span className="UuMinutesAppUpdateBanner__text">
          {state.progress.message}
          {typeof state.progress.percent === 'number'
            ? ` (${state.progress.percent} %)`
            : ''}
        </span>
      </div>
    );
  }

  if (state.kind === 'ready') {
    const version = state.pending.version;
    if (isAppUpdateBannerDismissed(version)) {
      return null;
    }

    return (
      <div className="UuMinutesAppUpdateBanner UuMinutesAppUpdateBanner--ready">
        <span className="UuMinutesAppUpdateBanner__text">
          Minutes {version} je stažen. Restartovat a nainstalovat?
        </span>
        <div className="UuMinutesAppUpdateBanner__actions">
          <button type="button" disabled={isBusy} onClick={onInstallNow}>
            Restartovat a nainstalovat
          </button>
          <button type="button" disabled={isBusy} onClick={onOpenRelease}>
            Release notes
          </button>
          <button type="button" disabled={isBusy} onClick={onDismiss}>
            Později
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function UuMinutesAppUpdateBannerHost(): JSX.Element | null {
  const [state, setState] = useState<AppUpdateUiState>({ kind: 'idle' });
  const [isBusy, setIsBusy] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);

  useEffect(() => subscribeAppUpdateUi(setState), []);

  const version = getBannerVersion(state);

  const handleDismiss = useCallback(() => {
    if (version) {
      dismissAppUpdateBanner(version);
      setDismissTick(value => value + 1);
    }
  }, [version]);

  const handleOpenRelease = useCallback(() => {
    const releaseUrl =
      state.kind === 'available' ||
      state.kind === 'downloading' ||
      state.kind === 'ready'
        ? state.check.releaseUrl
        : UUMINUTES_GITHUB_RELEASES_URL;
    openLinkInWebBrowser(releaseUrl ?? UUMINUTES_GITHUB_RELEASES_URL);
  }, [state]);

  const handleDownloadNow = useCallback(() => {
    if (state.kind !== 'available') {
      return;
    }

    setIsBusy(true);
    drop(
      startBackgroundAppUpdateDownload(state.check).finally(() => {
        setIsBusy(false);
      })
    );
  }, [state]);

  const handleInstallNow = useCallback(() => {
    if (state.kind !== 'ready') {
      return;
    }

    setIsBusy(true);
    drop(
      (async () => {
        try {
          await installPendingAppUpdate({ version: state.pending.version });
        } catch {
          if (
            state.check.downloadUrl &&
            state.check.latestVersion &&
            state.check.releaseUrl
          ) {
            await downloadAndInstallAppUpdate({
              downloadUrl: state.check.downloadUrl,
              latestVersion: state.check.latestVersion,
              releaseUrl: state.check.releaseUrl,
            });
          }
        }
      })().finally(() => {
        setIsBusy(false);
      })
    );
  }, [state]);

  const banner = (
    <AppUpdateBanner
      key={dismissTick}
      state={state}
      isBusy={isBusy}
      onDismiss={handleDismiss}
      onInstallNow={handleInstallNow}
      onDownloadNow={handleDownloadNow}
      onOpenRelease={handleOpenRelease}
    />
  );

  if (!banner) {
    return null;
  }

  return createPortal(banner, document.body);
}
