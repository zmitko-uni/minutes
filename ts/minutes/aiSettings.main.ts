// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { app, safeStorage } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import {
  AI_SETTINGS_DIR_NAME,
  AI_SETTINGS_FILE_NAME,
} from './constants.std.ts';
import type {
  AiProvider,
  AiProviderKeyStatus,
  AiSettingsPublic,
  AiSettingsSaveInput,
} from './aiSettings.std.ts';
import {
  AI_PROVIDER_DEFINITIONS,
  DEFAULT_AI_SETTINGS,
  getAiProviderDefinition,
} from './aiSettings.std.ts';
import {
  AI_DISABLED_MESSAGE_CS,
  AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS,
  AI_LOCAL_MODEL_SAVE_BLOCKED_MESSAGE_CS,
  AI_MISSING_API_KEY_MESSAGE_CS,
} from './aiUserMessages.std.ts';
import { isLocalLlmExtensionActive } from './localLlmExtension.main.ts';

const log = createLogger('minutes/aiSettings');

const ALL_PROVIDERS: ReadonlyArray<AiProvider> = AI_PROVIDER_DEFINITIONS.map(
  def => def.id
);

const PIPELINE_API_KEY_FILE = join(
  AI_SETTINGS_DIR_NAME,
  'pipeline-api-key.txt'
);

async function readPipelineApiKeyFallback(): Promise<string | null> {
  if (process.env.MINUTES_AI_API_KEY?.trim()) {
    return process.env.MINUTES_AI_API_KEY.trim();
  }
  try {
    const path = join(app.getPath('userData'), PIPELINE_API_KEY_FILE);
    const raw = await readFile(path, 'utf8');
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

type StoredAiSettings = {
  aiEnabled: boolean;
  provider: AiProvider;
  model?: string;
  modelsByProvider?: Partial<Record<AiProvider, string>>;
  outputLanguage: string;
  transcriptCorrectionEnabled?: boolean;
  encryptedApiKeys?: Partial<Record<AiProvider, string>>;
  /** @deprecated migrated to encryptedApiKeys.openai */
  encryptedApiKey?: string;
};

function getSettingsPath(): string {
  return join(
    app.getPath('userData'),
    AI_SETTINGS_DIR_NAME,
    AI_SETTINGS_FILE_NAME
  );
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '••••••••';
  }
  return `${key.slice(0, 7)}••••${key.slice(-4)}`;
}

function encryptApiKey(key: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(key).toString('hex');
  }
  log.warn('safeStorage unavailable; storing API key with base64 encoding');
  return `b64:${Buffer.from(key, 'utf8').toString('base64')}`;
}

function decryptApiKey(encrypted: string): string {
  if (encrypted.startsWith('b64:')) {
    return Buffer.from(encrypted.slice(4), 'base64').toString('utf8');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Cannot decrypt API key without safeStorage');
  }
  return safeStorage.decryptString(Buffer.from(encrypted, 'hex'));
}

function normalizeProvider(value: unknown): AiProvider {
  if (
    value === 'google' ||
    value === 'anthropic' ||
    value === 'perplexity' ||
    value === 'openai' ||
    value === 'local'
  ) {
    return value;
  }
  return DEFAULT_AI_SETTINGS.provider;
}

function migrateStoredKeys(parsed: Partial<StoredAiSettings>): Partial<
  Record<AiProvider, string>
> {
  const keys = { ...(parsed.encryptedApiKeys ?? {}) };
  if (parsed.encryptedApiKey && !keys.openai) {
    keys.openai = parsed.encryptedApiKey;
  }
  return keys;
}

function migrateModelsByProvider(
  parsed: Partial<StoredAiSettings>
): Partial<Record<AiProvider, string>> {
  const models = { ...(parsed.modelsByProvider ?? {}) };
  if (parsed.model && parsed.provider && !models[parsed.provider]) {
    models[normalizeProvider(parsed.provider)] = parsed.model;
  }
  if (parsed.model && !parsed.provider && !models.openai) {
    models.openai = parsed.model;
  }
  return models;
}

function getStoredKeyForProvider(
  stored: StoredAiSettings,
  provider: AiProvider
): string | undefined {
  const keys = migrateStoredKeys(stored);
  return keys[provider];
}

function resolveModelForProvider(
  stored: StoredAiSettings,
  provider: AiProvider
): string {
  const providerDef = getAiProviderDefinition(provider);
  const models = migrateModelsByProvider(stored);
  const candidate = models[provider];
  if (candidate && providerDef.models.includes(candidate)) {
    return candidate;
  }
  return providerDef.defaultModel;
}

function buildKeyStatusByProvider(
  stored: StoredAiSettings
): Partial<Record<AiProvider, AiProviderKeyStatus>> {
  const result: Partial<Record<AiProvider, AiProviderKeyStatus>> = {};
  for (const provider of ALL_PROVIDERS) {
    const encrypted = getStoredKeyForProvider(stored, provider);
    if (!encrypted) {
      result[provider] = { hasApiKey: false, apiKeyMasked: null };
      continue;
    }
    try {
      const key = decryptApiKey(encrypted);
      const hasApiKey = key.length > 0;
      result[provider] = {
        hasApiKey,
        apiKeyMasked: hasApiKey ? maskApiKey(key) : null,
      };
    } catch {
      result[provider] = { hasApiKey: false, apiKeyMasked: null };
    }
  }
  return result;
}

async function toPublicSettings(
  stored: StoredAiSettings
): Promise<AiSettingsPublic> {
  const provider = normalizeProvider(stored.provider);
  const model = resolveModelForProvider(stored, provider);
  const keyStatusByProvider = buildKeyStatusByProvider(stored);
  const activeKeyStatus = keyStatusByProvider[provider];

  let hasApiKey = activeKeyStatus?.hasApiKey ?? false;
  if (provider === 'local') {
    hasApiKey = await isLocalLlmExtensionActive(model);
  }

  return {
    aiEnabled: stored.aiEnabled,
    provider,
    model,
    outputLanguage: stored.outputLanguage || DEFAULT_AI_SETTINGS.outputLanguage,
    hasApiKey,
    apiKeyMasked: activeKeyStatus?.apiKeyMasked ?? null,
    keyStatusByProvider,
    modelsByProvider: migrateModelsByProvider(stored),
    transcriptCorrectionEnabled:
      stored.transcriptCorrectionEnabled ??
      DEFAULT_AI_SETTINGS.transcriptCorrectionEnabled,
  };
}

async function readStoredSettings(): Promise<StoredAiSettings> {
  try {
    const raw = await readFile(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAiSettings>;
    const provider = normalizeProvider(parsed.provider);
    return {
      aiEnabled: Boolean(parsed.aiEnabled),
      provider,
      model: parsed.model,
      modelsByProvider: migrateModelsByProvider(parsed),
      outputLanguage:
        parsed.outputLanguage ?? DEFAULT_AI_SETTINGS.outputLanguage,
      transcriptCorrectionEnabled: parsed.transcriptCorrectionEnabled,
      encryptedApiKeys: migrateStoredKeys(parsed),
    };
  } catch {
    return {
      aiEnabled: false,
      provider: DEFAULT_AI_SETTINGS.provider,
      outputLanguage: DEFAULT_AI_SETTINGS.outputLanguage,
      transcriptCorrectionEnabled: DEFAULT_AI_SETTINGS.transcriptCorrectionEnabled,
      encryptedApiKeys: {},
      modelsByProvider: {},
    };
  }
}

async function writeStoredSettings(stored: StoredAiSettings): Promise<void> {
  const path = getSettingsPath();
  await mkdir(join(app.getPath('userData'), AI_SETTINGS_DIR_NAME), {
    recursive: true,
  });
  const toWrite: StoredAiSettings = {
    aiEnabled: stored.aiEnabled,
    provider: stored.provider,
    modelsByProvider: migrateModelsByProvider(stored),
    outputLanguage: stored.outputLanguage,
    transcriptCorrectionEnabled: stored.transcriptCorrectionEnabled,
    encryptedApiKeys: migrateStoredKeys(stored),
  };
  await writeFile(path, JSON.stringify(toWrite, null, 2), 'utf8');
}

export async function getAiSettingsPublic(): Promise<AiSettingsPublic> {
  return toPublicSettings(await readStoredSettings());
}

function applyApiKeyUpdates(
  keys: Partial<Record<AiProvider, string>>,
  updates: Partial<Record<AiProvider, string | undefined>> | undefined,
  legacySingleKey: string | undefined,
  legacyProvider: AiProvider
): void {
  if (updates) {
    for (const provider of ALL_PROVIDERS) {
      if (!(provider in updates)) {
        continue;
      }
      const value = updates[provider];
      if (value === undefined) {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        delete keys[provider];
      } else {
        keys[provider] = encryptApiKey(trimmed);
      }
    }
  }

  if (legacySingleKey !== undefined) {
    const trimmed = legacySingleKey.trim();
    if (trimmed.length === 0) {
      delete keys[legacyProvider];
    } else {
      keys[legacyProvider] = encryptApiKey(trimmed);
    }
  }
}

export async function saveAiSettings(
  input: AiSettingsSaveInput
): Promise<AiSettingsPublic> {
  const stored = await readStoredSettings();
  const provider = normalizeProvider(input.provider);
  const providerDef = getAiProviderDefinition(provider);
  const models = migrateModelsByProvider(stored);

  stored.aiEnabled = input.aiEnabled;
  stored.provider = provider;
  stored.outputLanguage =
    input.outputLanguage.trim() || DEFAULT_AI_SETTINGS.outputLanguage;
  stored.transcriptCorrectionEnabled = input.transcriptCorrectionEnabled;

  const resolvedModel = input.model.trim() || providerDef.defaultModel;
  models[provider] = providerDef.models.includes(resolvedModel)
    ? resolvedModel
    : providerDef.defaultModel;
  stored.modelsByProvider = models;

  if (input.aiEnabled && provider === 'local') {
    const active = await isLocalLlmExtensionActive(models[provider]);
    if (!active) {
      throw new Error(AI_LOCAL_MODEL_SAVE_BLOCKED_MESSAGE_CS);
    }
  }

  const keys = migrateStoredKeys(stored);
  applyApiKeyUpdates(keys, input.apiKeys, input.apiKey, provider);
  stored.encryptedApiKeys = keys;
  delete stored.encryptedApiKey;

  await writeStoredSettings(stored);
  return toPublicSettings(stored);
}

export async function getAiApiKey(
  provider?: AiProvider
): Promise<string | null> {
  const stored = await readStoredSettings();
  const activeProvider = provider ?? normalizeProvider(stored.provider);
  const encrypted = getStoredKeyForProvider(stored, activeProvider);
  if (!encrypted) {
    return readPipelineApiKeyFallback();
  }
  try {
    const key = decryptApiKey(encrypted);
    return key.length > 0 ? key : null;
  } catch (error) {
    log.error(
      'getAiApiKey: decrypt failed',
      error instanceof Error ? error.message : error
    );
    return readPipelineApiKeyFallback();
  }
}

/** @deprecated use getAiApiKey('openai') */
export async function getOpenAiApiKey(): Promise<string | null> {
  return getAiApiKey('openai');
}

export async function isAiSummaryEnabled(): Promise<boolean> {
  const stored = await readStoredSettings();
  if (!stored.aiEnabled) {
    return false;
  }
  const provider = normalizeProvider(stored.provider);
  if (provider === 'local') {
    const model = resolveModelForProvider(stored, provider);
    return isLocalLlmExtensionActive(model);
  }
  if (getStoredKeyForProvider(stored, provider)) {
    return true;
  }
  return Boolean(await readPipelineApiKeyFallback());
}

/** Vyhodí srozumitelnou chybu, pokud AI funkce (shrnutí, názor…) nelze spustit. */
export async function assertAiSummaryReady(): Promise<void> {
  const stored = await readStoredSettings();
  if (!stored.aiEnabled) {
    throw new Error(AI_DISABLED_MESSAGE_CS);
  }

  const provider = normalizeProvider(stored.provider);
  if (provider === 'local') {
    const model = resolveModelForProvider(stored, provider);
    if (!(await isLocalLlmExtensionActive(model))) {
      throw new Error(AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS);
    }
    return;
  }

  if (getStoredKeyForProvider(stored, provider)) {
    return;
  }
  if (await readPipelineApiKeyFallback()) {
    return;
  }
  throw new Error(AI_MISSING_API_KEY_MESSAGE_CS);
}

export async function isTranscriptCorrectionEnabled(): Promise<boolean> {
  const stored = await readStoredSettings();
  if (
    stored.transcriptCorrectionEnabled === false ||
    !stored.aiEnabled
  ) {
    return false;
  }
  const provider = normalizeProvider(stored.provider);
  if (provider === 'local') {
    const model = resolveModelForProvider(stored, provider);
    return isLocalLlmExtensionActive(model);
  }
  return Boolean(await readPipelineApiKeyFallback());
}
