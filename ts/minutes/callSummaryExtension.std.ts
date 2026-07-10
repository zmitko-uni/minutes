// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { APP_DISPLAY_NAME } from './branding.std.ts';
import {
  DEFAULT_WHISPER_MODEL,
  getWhisperModelDownloadUrl,
  getWhisperModelMinBytes,
  WHISPER_MODEL_CATALOG,
  type WhisperModelDefinition,
} from './whisperSettings.std.ts';
import {
  DEFAULT_WHISPER_TRANSCRIBE_SETTINGS,
  type WhisperTranscribeSettingsPublic,
} from './whisperTranscribeSettings.std.ts';

/** @deprecated use DEFAULT_WHISPER_MODEL.fileName */
export const DEFAULT_WHISPER_MODEL_FILE = DEFAULT_WHISPER_MODEL.fileName;

export type WhisperModelPublic = Readonly<{
  fileName: string;
  label: string;
  description: string;
  downloadLabel: string;
  recommended: boolean;
  installed: boolean;
  installedSizeBytes: number | null;
  ready: boolean;
}>;

export type CallSummaryExtensionPublic = Readonly<{
  activated: boolean;
  modelReady: boolean;
  whisperRuntimeReady: boolean;
  modelFileName: string | null;
  modelSizeBytes: number | null;
  installedAt: number | null;
  recommendedModelFileName: string;
  availableModels: ReadonlyArray<WhisperModelPublic>;
  transcribeSettings: WhisperTranscribeSettingsPublic;
  cpuCount: number;
}>;

export type CallSummaryExtensionProgress = Readonly<{
  phase: 'checking' | 'downloading' | 'verifying' | 'complete' | 'error';
  message: string;
  percent?: number;
}>;

export const DEFAULT_CALL_SUMMARY_EXTENSION: CallSummaryExtensionPublic = {
  activated: false,
  modelReady: false,
  whisperRuntimeReady: false,
  modelFileName: null,
  modelSizeBytes: null,
  installedAt: null,
  recommendedModelFileName: DEFAULT_WHISPER_MODEL.fileName,
  availableModels: [],
  transcribeSettings: DEFAULT_WHISPER_TRANSCRIBE_SETTINGS,
  cpuCount: 1,
};

export const EXTENSION_REQUIRED_TOAST_CS =
  `Aktivujte funkcionalitu a stáhněte potřebné rozšíření v menu ${APP_DISPLAY_NAME} → Nastavení přepisů…`;

export { getWhisperModelMinBytes, getWhisperModelDownloadUrl, WHISPER_MODEL_CATALOG };
export { getWhisperModelDownloadLabel } from './whisperSettings.std.ts';
export type { WhisperModelDefinition };
export type { WhisperTranscribeSettingsPublic } from './whisperTranscribeSettings.std.ts';
