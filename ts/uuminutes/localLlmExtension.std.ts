// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { APP_DISPLAY_NAME } from './branding.std.ts';
import {
  DEFAULT_LOCAL_LLM_MODEL,
  getLocalLlmModelDownloadUrl,
  getLocalLlmModelMinBytes,
  LOCAL_LLM_MODEL_CATALOG,
  type LocalLlmModelDefinition,
} from './localLlmSettings.std.ts';

export type LocalLlmModelPublic = Readonly<{
  fileName: string;
  label: string;
  description: string;
  downloadLabel: string;
  recommended: boolean;
  installed: boolean;
  installedSizeBytes: number | null;
  ready: boolean;
}>;

export type LocalLlmExtensionPublic = Readonly<{
  activated: boolean;
  modelReady: boolean;
  runtimeReady: boolean;
  modelFileName: string | null;
  modelSizeBytes: number | null;
  installedAt: number | null;
  recommendedModelFileName: string;
  availableModels: ReadonlyArray<LocalLlmModelPublic>;
}>;

export type LocalLlmExtensionProgress = Readonly<{
  phase:
    | 'checking'
    | 'downloading'
    | 'verifying'
    | 'complete'
    | 'cancelled'
    | 'error';
  message: string;
  percent?: number;
}>;

export const DEFAULT_LOCAL_LLM_EXTENSION: LocalLlmExtensionPublic = {
  activated: false,
  modelReady: false,
  runtimeReady: false,
  modelFileName: null,
  modelSizeBytes: null,
  installedAt: null,
  recommendedModelFileName: DEFAULT_LOCAL_LLM_MODEL.fileName,
  availableModels: [],
};

export const LOCAL_LLM_REQUIRED_TOAST_CS =
  `Stáhněte a aktivujte lokální model v menu ${APP_DISPLAY_NAME} → Nastavení AI.`;

export {
  getLocalLlmModelMinBytes,
  getLocalLlmModelDownloadUrl,
  LOCAL_LLM_MODEL_CATALOG,
};
export { getLocalLlmModelDownloadLabel } from './localLlmSettings.std.ts';
export type { LocalLlmModelDefinition };
