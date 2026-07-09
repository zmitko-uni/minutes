// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type AiProvider = 'openai' | 'google' | 'anthropic' | 'perplexity';

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
  },
  {
    id: 'google',
    label: 'Google Gemini',
    keyLabel: 'Gemini API klíč',
    keyPlaceholder: 'AIza…',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    keyHelpLabel: 'aistudio.google.com/apikey',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.0-flash',
    billingNote:
      'Fakturace v Google AI Studio. Flash modely jsou obvykle levné.',
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
  },
];

const DEFAULT_AI_PROVIDER = AI_PROVIDER_DEFINITIONS[0]!;

export function getAiProviderDefinition(
  provider: AiProvider
): AiProviderDefinition {
  const found = AI_PROVIDER_DEFINITIONS.find(def => def.id === provider);
  if (!found) {
    return DEFAULT_AI_PROVIDER;
  }
  return found;
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
