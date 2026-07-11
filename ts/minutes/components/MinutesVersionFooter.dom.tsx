// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';

import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import {
  getAppUpdateUiState,
  subscribeAppUpdateUi,
  type AppUpdateUiState,
} from '../appUpdateEvents.std.ts';
import { MINUTES_GITHUB_RELEASES_URL } from '../appUpdate.std.ts';
import {
  installPendingAppUpdate,
  startBackgroundAppUpdateDownload,
} from '../appUpdateService.preload.ts';
import { formatMinutesVersionLabel } from '../version.std.ts';

type Props = Readonly<{
  appVersion: string;
}>;

function getStatusText(state: AppUpdateUiState): string {
  switch (state.kind) {
    case 'checking':
      return 'Kontroluji aktualizace…';
    case 'current':
      return state.check.checkSkipped
        ? 'Vývojová verze — kontrola aktualizací je vypnutá.'
        : 'Vaše verze je aktuální.';
    case 'available':
      return `Je dostupná nová verze ${state.check.latestVersion ?? ''}.`.trim();
    case 'downloading':
      return state.progress.message;
    case 'ready':
      return `Verze ${state.pending.version} je stažena a připravena k instalaci.`;
    case 'error':
      return state.check?.errorMessage
        ? 'Nepodařilo se ověřit aktualizace online.'
        : state.message;
    default:
      return 'Kontroluji aktualizace…';
  }
}

export function MinutesVersionFooter({ appVersion }: Props): JSX.Element {
  const [state, setState] = useState<AppUpdateUiState>(getAppUpdateUiState());
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const versionLabel = formatMinutesVersionLabel(appVersion);

  useEffect(() => subscribeAppUpdateUi(setState), []);

  const handleDownload = useCallback(() => {
    if (state.kind !== 'available') {
      if (!(state.kind === 'error' && state.check?.updateAvailable)) {
        return;
      }
    }

    const check = state.kind === 'available' || state.kind === 'error' ? state.check : null;

    if (
      !check?.updateAvailable ||
      !check.downloadUrl ||
      !check.latestVersion ||
      !check.releaseUrl
    ) {
      return;
    }

    setIsBusy(true);
    setActionError(null);
    drop(
      startBackgroundAppUpdateDownload(check)
        .catch(error => {
          setActionError(
            error instanceof Error ? error.message : 'Stažení selhalo.'
          );
        })
        .finally(() => {
          setIsBusy(false);
        })
    );
  }, [state]);

  const handleInstall = useCallback(() => {
    if (state.kind !== 'ready') {
      return;
    }

    setIsBusy(true);
    setActionError(null);
    drop(
      installPendingAppUpdate({ version: state.pending.version })
        .catch(error => {
          setActionError(
            error instanceof Error ? error.message : 'Instalace selhala.'
          );
        })
        .finally(() => setIsBusy(false))
    );
  }, [state]);

  const handlePrimaryAction = useCallback(() => {
    if (state.kind === 'ready') {
      handleInstall();
      return;
    }
    if (
      state.kind === 'available' ||
      (state.kind === 'error' && state.check?.updateAvailable)
    ) {
      handleDownload();
    }
  }, [state, handleDownload, handleInstall]);

  const handleOpenRelease = useCallback(() => {
    const releaseUrl =
      state.kind === 'current' ||
      state.kind === 'available' ||
      state.kind === 'downloading' ||
      state.kind === 'ready' ||
      state.kind === 'error'
        ? state.check?.releaseUrl
        : MINUTES_GITHUB_RELEASES_URL;
    openLinkInWebBrowser(releaseUrl ?? MINUTES_GITHUB_RELEASES_URL);
  }, [state]);

  const showUpdateActions =
    state.kind === 'available' ||
    state.kind === 'ready' ||
    state.kind === 'downloading' ||
    (state.kind === 'error' && state.check?.updateAvailable);

  const primaryLabel =
    state.kind === 'ready'
      ? 'Restartovat a nainstalovat'
      : state.kind === 'downloading' || isBusy
        ? 'Stahuji…'
        : 'Stáhnout';

  const isPrimaryDisabled = isBusy || state.kind === 'downloading';

  return (
    <footer className={tw('MinutesVersionFooter')}>
      <p className={tw('MinutesVersionFooter__line')}>
        <span className={tw('MinutesVersionFooter__label')}>Verze:</span>{' '}
        {versionLabel}
      </p>
      <p className={tw('MinutesVersionFooter__status')}>{getStatusText(state)}</p>

      {showUpdateActions && (
        <div className={tw('MinutesVersionFooter__actions')}>
          <button
            type="button"
            className={tw(
              'MinutesVersionFooter__button',
              'MinutesVersionFooter__button--primary'
            )}
            disabled={isPrimaryDisabled}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className={tw('MinutesVersionFooter__button')}
            disabled={isPrimaryDisabled}
            onClick={handleOpenRelease}
          >
            Release notes
          </button>
        </div>
      )}

      {state.kind === 'error' && !state.check?.updateAvailable && (
        <div className={tw('MinutesVersionFooter__actions')}>
          <button
            type="button"
            className={tw('MinutesVersionFooter__button')}
            onClick={handleOpenRelease}
          >
            Otevřít Releases
          </button>
        </div>
      )}

      {state.kind === 'downloading' && typeof state.progress.percent === 'number' && (
        <div className={tw('MinutesVersionFooter__progress')}>
          <div className={tw('MinutesVersionFooter__progressBar')}>
            <div
              className={tw('MinutesVersionFooter__progressFill')}
              style={{ width: `${state.progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {actionError && (
        <p className={tw('MinutesVersionFooter__error')}>{actionError}</p>
      )}
    </footer>
  );
}
