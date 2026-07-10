// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  DEFAULT_LOCAL_LLM_MODEL,
  LOCAL_LLM_MODEL_CATALOG,
  getLocalLlmModelLabel,
} from './localLlmSettings.std.ts';

export type AiProvider =
  | 'openai'
  | 'google'
  | 'anthropic'
  | 'perplexity'
  | 'local';

export type AiProviderDefinition = Readonly<{
  id: AiProvider;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyHelpUrl: string;
  keyHelpLabel: string;
  models: ReadonlyArray<string>;
  defaultModel: string;
  billingNote: string;
  /** Cloud poskytovatelé vyžadují API klíč; lokální ne. */
  requiresApiKey: boolean;
}>;

export const AI_PROVIDER_DEFINITIONS: ReadonlyArray<AiProviderDefinition> = [
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    keyLabel: 'OpenAI API klíč',
    keyPlaceholder: 'sk-…',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyHelpLabel: 'platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    defaultModel: 'gpt-4o-mini',
    billingNote:
      'Fakturace na OpenAI účtu. Pro nízké náklady doporučujeme gpt-4o-mini.',
    requiresApiKey: true,
  },
  {
    id: 'google',
    label: 'Google Gemini',
    keyLabel: 'Gemini API klíč',
    keyPlaceholder: 'AIza…',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    keyHelpLabel: 'aistudio.google.com/apikey',
    models: [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-2.5-pro',
    ],
    defaultModel: 'gemini-3.1-flash-lite',
    billingNote:
      'Fakturace v Google AI Studio. Pro nízké náklady doporučujeme gemini-3.1-flash-lite.',
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyLabel: 'Anthropic API klíč',
    keyPlaceholder: 'sk-ant-…',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    keyHelpLabel: 'console.anthropic.com',
    models: [
      'claude-3-5-haiku-latest',
      'claude-3-5-sonnet-latest',
      'claude-sonnet-4-20250514',
    ],
    defaultModel: 'claude-3-5-haiku-latest',
    billingNote:
      'Fakturace na Anthropic účtu. Haiku je nejlevnější volba.',
    requiresApiKey: true,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    keyLabel: 'Perplexity API klíč',
    keyPlaceholder: 'pplx-…',
    keyHelpUrl: 'https://www.perplexity.ai/settings/api',
    keyHelpLabel: 'perplexity.ai → API',
    models: ['sonar', 'sonar-pro'],
    defaultModel: 'sonar',
    billingNote:
      'Fakturace v Perplexity API Portal (prepaid kredity). Pro sumarizaci chatu bez webu doporučujeme sonar.',
    requiresApiKey: true,
  },
  {
    id: 'local',
    label: 'Lokální LLM (Gemma)',
    keyLabel: '',
    keyPlaceholder: '',
    keyHelpUrl: '',
    keyHelpLabel: '',
    models: LOCAL_LLM_MODEL_CATALOG.map(model => model.fileName),
    defaultModel: DEFAULT_LOCAL_LLM_MODEL.fileName,
    billingNote:
      'Model běží lokálně na vašem počítači. Nejdřív stáhněte a aktivujte model níže.',
    requiresApiKey: false,
  },
];

const DEFAULT_AI_PROVIDER = AI_PROVIDER_DEFINITIONS[0]!;

export function normalizeAiOutputLanguage(code: string): string {
  const normalized = code.trim().toLowerCase();
  return normalized || DEFAULT_AI_SETTINGS.outputLanguage;
}

const AI_OUTPUT_LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  cs: 'čeština',
  en: 'English',
  sk: 'slovenčina',
  de: 'Deutsch',
  pl: 'polština',
};

export function getAiOutputLanguageLabel(code: string): string {
  const normalized = normalizeAiOutputLanguage(code);
  return AI_OUTPUT_LANGUAGE_LABELS[normalized] ?? normalized;
}

export function isCzechAiOutputLanguage(code: string): boolean {
  return normalizeAiOutputLanguage(code) === 'cs';
}

export function getAiProviderDefinition(
  provider: AiProvider
): AiProviderDefinition {
  const found = AI_PROVIDER_DEFINITIONS.find(def => def.id === provider);
  if (!found) {
    return DEFAULT_AI_PROVIDER;
  }
  return found;
}

export function formatAiModelDisplayLabel(
  provider: AiProvider,
  model: string
): string {
  if (provider === 'local') {
    return getLocalLlmModelLabel(model);
  }
  return `${getAiProviderDefinition(provider).label} · ${model}`;
}

export function formatAiSummaryProgressMessage(
  provider: AiProvider,
  model: string
): string {
  return `Generuji AI shrnutí… (${formatAiModelDisplayLabel(provider, model)})`;
}

export type AiProviderKeyStatus = Readonly<{
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}>;

export type AiSettingsPublic = Readonly<{
  aiEnabled: boolean;
  provider: AiProvider;
  model: string;
  outputLanguage: string;
  /** Aktivní poskytovatel — zda má klíč */
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  /** Stav klíčů pro všechny poskytovatele */
  keyStatusByProvider: Readonly<Partial<Record<AiProvider, AiProviderKeyStatus>>>;
  /** Naposledy zvolený model pro každého poskytovatele */
  modelsByProvider: Readonly<Partial<Record<AiProvider, string>>>;
  /** Po přepisu Whisperem opravit zjevné chyby rozpoznání pomocí AI */
  transcriptCorrectionEnabled: boolean;
}>;

export type AiSettingsSaveInput = Readonly<{
  aiEnabled: boolean;
  provider: AiProvider;
  model: string;
  outputLanguage: string;
  transcriptCorrectionEnabled: boolean;
  /**
   * Per-provider API keys.
   * - non-empty string = uložit nový klíč
   * - empty string = smazat uložený klíč
   * - undefined / absent = ponechat stávající
   */
  apiKeys?: Partial<Record<AiProvider, string | undefined>>;
  /** @deprecated use apiKeys */
  apiKey?: string;
}>;

export const DEFAULT_AI_SETTINGS: AiSettingsPublic = {
  aiEnabled: false,
  provider: 'openai',
  model: 'gpt-4o-mini',
  outputLanguage: 'cs',
  hasApiKey: false,
  apiKeyMasked: null,
  keyStatusByProvider: {},
  modelsByProvider: {},
  transcriptCorrectionEnabled: true,
};

/** @deprecated use AI_PROVIDER_DEFINITIONS */
export const OPENAI_MODEL_OPTIONS = DEFAULT_AI_PROVIDER.models;

export type OpenAiModelOption = (typeof OPENAI_MODEL_OPTIONS)[number];
