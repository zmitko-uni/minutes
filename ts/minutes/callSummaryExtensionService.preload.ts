// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer, type IpcRendererEvent } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import {
  DEFAULT_CALL_SUMMARY_EXTENSION,
  EXTENSION_REQUIRED_TOAST_CS,
  type CallSummaryExtensionProgress,
  type CallSummaryExtensionPublic,
} from './callSummaryExtension.std.ts';
import { callSummaryExtensionEvents } from './callSummaryExtensionEvents.std.ts';
import { summaryUi } from './summaryUiEvents.std.ts';

const log = createLogger('minutes/callSummaryExtensionService');

const openListeners = new Set<() => void>();

let cached: CallSummaryExtensionPublic = DEFAULT_CALL_SUMMARY_EXTENSION;

export function getCallSummaryExtensionState(): CallSummaryExtensionPublic {
  return cached;
}

export function isCallSummaryExtensionActive(): boolean {
  return (
    cached.activated && cached.modelReady && cached.whisperRuntimeReady
  );
}

export async function refreshCallSummaryExtension(): Promise<CallSummaryExtensionPublic> {
  try {
    const next = await ipcRenderer.invoke('minutes:get-call-summary-extension');
    if (next && typeof next === 'object') {
      cached = next as CallSummaryExtensionPublic;
      callSummaryExtensionEvents.emit(cached);
    }
  } catch (error) {
    log.warn('refreshCallSummaryExtension failed', error);
  }
  return cached;
}

export function showCallSummaryExtensionRequiredToast(): void {
  summaryUi.showError(EXTENSION_REQUIRED_TOAST_CS);
  setTimeout(() => {
    summaryUi.hide();
  }, 9000);
}

export async function installCallSummaryExtension(
  options: {
    modelFileName?: string;
    forceRedownload?: boolean;
  } = {}
): Promise<CallSummaryExtensionPublic> {
  const next = await ipcRenderer.invoke(
    'minutes:install-call-summary-extension',
    options
  );
  cached = next as CallSummaryExtensionPublic;
  callSummaryExtensionEvents.emit(cached);
  return cached;
}

export function subscribeCallSummaryExtensionProgress(
  listener: (progress: CallSummaryExtensionProgress) => void
): () => void {
  const handler = (
    _event: IpcRendererEvent,
    progress: CallSummaryExtensionProgress
  ): void => {
    listener(progress);
  };
  ipcRenderer.on('minutes:call-summary-extension-progress', handler);
  return () => {
    ipcRenderer.removeListener(
      'minutes:call-summary-extension-progress',
      handler
    );
  };
}

export function subscribeCallSummaryExtensionOpen(
  listener: () => void
): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function openCallSummaryExtensionModal(): void {
  for (const listener of openListeners) {
    listener();
  }
}

export async function saveWhisperTranscribeSettings(
  settings: Partial<CallSummaryExtensionPublic['transcribeSettings']>
): Promise<CallSummaryExtensionPublic> {
  const next = await ipcRenderer.invoke(
    'minutes:save-call-summary-transcribe-settings',
    settings
  );
  cached = next as CallSummaryExtensionPublic;
  callSummaryExtensionEvents.emit(cached);
  return cached;
}
