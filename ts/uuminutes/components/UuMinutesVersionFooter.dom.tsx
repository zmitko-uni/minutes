// Copyright 2026 uuMinutes contributors
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
import { UUMINUTES_GITHUB_RELEASES_URL } from '../appUpdate.std.ts';
import {
  downloadAndInstallAppUpdate,
  installPendingAppUpdate,
  startBackgroundAppUpdateDownload,
} from '../appUpdateService.preload.ts';
import { formatUuMinutesVersionLabel } from '../welcomeContent.std.ts';

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

export function UuMinutesVersionFooter({ appVersion }: Props): JSX.Element {
  const [state, setState] = useState<AppUpdateUiState>(getAppUpdateUiState());
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const versionLabel = formatUuMinutesVersionLabel(appVersion);

  useEffect(() => subscribeAppUpdateUi(setState), []);

  const handleUpdate = useCallback(() => {
    if (state.kind === 'ready') {
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
      return;
    }

    if (
      state.kind !== 'available' &&
      state.kind !== 'downloading' &&
      state.kind !== 'error'
    ) {
      return;
    }

    const check =
      state.kind === 'available' ||
      state.kind === 'downloading' ||
      state.kind === 'error'
        ? state.check
        : null;

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
      (async () => {
        try {
          await downloadAndInstallAppUpdate({
            downloadUrl: check.downloadUrl!,
            latestVersion: check.latestVersion!,
            releaseUrl: check.releaseUrl!,
          });
        } catch (error) {
          setActionError(
            error instanceof Error ? error.message : 'Aktualizace selhala.'
          );
        } finally {
          setIsBusy(false);
        }
      })()
    );
  }, [state]);

  const handleRetryDownload = useCallback(() => {
    if (state.kind !== 'available' && state.kind !== 'error') {
      return;
    }
    const check = state.check;
    if (!check?.updateAvailable) {
      return;
    }
    setIsBusy(true);
    setActionError(null);
    drop(
      startBackgroundAppUpdateDownload(check).finally(() => {
        setIsBusy(false);
      })
    );
  }, [state]);

  const handleOpenRelease = useCallback(() => {
    const releaseUrl =
      state.kind === 'current' ||
      state.kind === 'available' ||
      state.kind === 'downloading' ||
      state.kind === 'ready' ||
      state.kind === 'error'
        ? state.check?.releaseUrl
        : UUMINUTES_GITHUB_RELEASES_URL;
    openLinkInWebBrowser(releaseUrl ?? UUMINUTES_GITHUB_RELEASES_URL);
  }, [state]);

  const showUpdateActions =
    state.kind === 'available' ||
    state.kind === 'ready' ||
    (state.kind === 'error' && state.check?.updateAvailable);

  const primaryLabel =
    state.kind === 'ready'
      ? 'Restartovat a nainstalovat'
      : isBusy
        ? 'Stahuji…'
        : 'Aktualizovat';

  return (
    <footer className={tw('UuMinutesVersionFooter')}>
      <p className={tw('UuMinutesVersionFooter__line')}>
        <span className={tw('UuMinutesVersionFooter__label')}>Verze:</span>{' '}
        {versionLabel}
      </p>
      <p className={tw('UuMinutesVersionFooter__status')}>{getStatusText(state)}</p>

      {showUpdateActions && (
        <div className={tw('UuMinutesVersionFooter__actions')}>
          <button
            type="button"
            className={tw(
              'UuMinutesVersionFooter__button',
              'UuMinutesVersionFooter__button--primary'
            )}
            disabled={isBusy || state.kind === 'downloading'}
            onClick={handleUpdate}
          >
            {primaryLabel}
          </button>
          {state.kind === 'error' && (
            <button
              type="button"
              className={tw('UuMinutesVersionFooter__button')}
              disabled={isBusy}
              onClick={handleRetryDownload}
            >
              Stáhnout znovu
            </button>
          )}
          <button
            type="button"
            className={tw('UuMinutesVersionFooter__button')}
            disabled={isBusy}
            onClick={handleOpenRelease}
          >
            Release notes
          </button>
        </div>
      )}

      {state.kind === 'error' && !state.check?.updateAvailable && (
        <div className={tw('UuMinutesVersionFooter__actions')}>
          <button
            type="button"
            className={tw('UuMinutesVersionFooter__button')}
            onClick={handleOpenRelease}
          >
            Otevřít Releases
          </button>
        </div>
      )}

      {state.kind === 'downloading' && typeof state.progress.percent === 'number' && (
        <div className={tw('UuMinutesVersionFooter__progress')}>
          <div className={tw('UuMinutesVersionFooter__progressBar')}>
            <div
              className={tw('UuMinutesVersionFooter__progressFill')}
              style={{ width: `${state.progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {actionError && (
        <p className={tw('UuMinutesVersionFooter__error')}>{actionError}</p>
      )}
    </footer>
  );
}
