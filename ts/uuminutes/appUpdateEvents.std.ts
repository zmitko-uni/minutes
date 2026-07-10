// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AppUpdateCheckResult,
  AppUpdateProgress,
  PendingAppUpdate,
} from './appUpdate.std.ts';

export type AppUpdateUiState = Readonly<
  | { kind: 'idle' }
  | { kind: 'checking' }
  | {
      kind: 'current';
      check: AppUpdateCheckResult;
    }
  | {
      kind: 'available';
      check: AppUpdateCheckResult;
    }
  | {
      kind: 'downloading';
      check: AppUpdateCheckResult;
      progress: AppUpdateProgress;
    }
  | {
      kind: 'ready';
      check: AppUpdateCheckResult;
      pending: PendingAppUpdate;
    }
  | {
      kind: 'error';
      check: AppUpdateCheckResult | null;
      message: string;
    }
>;

type AppUpdateUiListener = (state: AppUpdateUiState) => void;

const listeners = new Set<AppUpdateUiListener>();
let currentState: AppUpdateUiState = { kind: 'idle' };

function setState(state: AppUpdateUiState): void {
  currentState = state;
  for (const listener of listeners) {
    listener(currentState);
  }
}

export function subscribeAppUpdateUi(
  listener: AppUpdateUiListener
): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getAppUpdateUiState(): AppUpdateUiState {
  return currentState;
}

export const appUpdateUi = {
  setChecking(): void {
    setState({ kind: 'checking' });
  },
  setCurrent(check: AppUpdateCheckResult): void {
    setState({ kind: 'current', check });
  },
  setAvailable(check: AppUpdateCheckResult): void {
    setState({ kind: 'available', check });
  },
  setDownloading(
    check: AppUpdateCheckResult,
    progress: AppUpdateProgress
  ): void {
    setState({ kind: 'downloading', check, progress });
  },
  setReady(check: AppUpdateCheckResult, pending: PendingAppUpdate): void {
    setState({ kind: 'ready', check, pending });
  },
  setError(message: string, check: AppUpdateCheckResult | null = null): void {
    setState({ kind: 'error', check, message });
  },
  setIdle(): void {
    setState({ kind: 'idle' });
  },
};

export function isAppUpdateBannerDismissed(version: string): boolean {
  try {
    return sessionStorage.getItem(`uuminutes-dismissed-update-${version}`) === '1';
  } catch {
    return false;
  }
}

export function dismissAppUpdateBanner(version: string): void {
  try {
    sessionStorage.setItem(`uuminutes-dismissed-update-${version}`, '1');
  } catch {
    // ignore private mode / unavailable storage
  }
}
