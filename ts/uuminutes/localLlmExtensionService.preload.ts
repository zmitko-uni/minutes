// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer, type IpcRendererEvent } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import {
  DEFAULT_LOCAL_LLM_EXTENSION,
  LOCAL_LLM_REQUIRED_TOAST_CS,
  type LocalLlmExtensionProgress,
  type LocalLlmExtensionPublic,
} from './localLlmExtension.std.ts';
import { localLlmExtensionEvents } from './localLlmExtensionEvents.std.ts';
import { summaryUi } from './summaryUiEvents.std.ts';

const log = createLogger('uuminutes/localLlmExtensionService');

let cached: LocalLlmExtensionPublic = DEFAULT_LOCAL_LLM_EXTENSION;

export function getLocalLlmExtensionState(): LocalLlmExtensionPublic {
  return cached;
}

export function isLocalLlmExtensionActive(modelFileName?: string): boolean {
  const active =
    cached.activated && cached.modelReady && cached.runtimeReady;
  if (!active) {
    return false;
  }
  if (modelFileName && cached.modelFileName !== modelFileName) {
    return false;
  }
  return true;
}

export async function refreshLocalLlmExtension(): Promise<LocalLlmExtensionPublic> {
  try {
    const next = await ipcRenderer.invoke('uuminutes:get-local-llm-extension');
    if (next && typeof next === 'object') {
      cached = next as LocalLlmExtensionPublic;
      localLlmExtensionEvents.emit(cached);
    }
  } catch (error) {
    log.warn('refreshLocalLlmExtension failed', error);
  }
  return cached;
}

export function showLocalLlmRequiredToast(): void {
  summaryUi.showError(LOCAL_LLM_REQUIRED_TOAST_CS);
  setTimeout(() => {
    summaryUi.hide();
  }, 9000);
}

export async function installLocalLlmExtension(
  options: {
    modelFileName?: string;
    forceRedownload?: boolean;
  } = {}
): Promise<LocalLlmExtensionPublic> {
  const next = await ipcRenderer.invoke(
    'uuminutes:install-local-llm-extension',
    options
  );
  cached = next as LocalLlmExtensionPublic;
  localLlmExtensionEvents.emit(cached);
  return cached;
}

export async function cancelLocalLlmDownload(): Promise<void> {
  await ipcRenderer.invoke('uuminutes:cancel-local-llm-download');
}

export function subscribeLocalLlmExtensionProgress(
  listener: (progress: LocalLlmExtensionProgress) => void
): () => void {
  const handler = (
    _event: IpcRendererEvent,
    progress: LocalLlmExtensionProgress
  ): void => {
    listener(progress);
  };
  ipcRenderer.on('uuminutes:local-llm-extension-progress', handler);
  return () => {
    ipcRenderer.removeListener(
      'uuminutes:local-llm-extension-progress',
      handler
    );
  };
}
