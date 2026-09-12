// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  AI_PROVIDER_DEFINITIONS,
  formatAiModelDisplayLabel,
  getAiProviderDefinition,
  type AiProvider,
  type AiSettingsPublic,
} from './aiSettings.std.ts';

export type AiModelChoice = Readonly<{
  provider: AiProvider;
  model: string;
  label: string;
}>;

/** Poskytovatel je použitelný, když nepotřebuje klíč, nebo ho má uložený. */
export function isAiProviderConfigured(
  settings: AiSettingsPublic,
  provider: AiProvider
): boolean {
  if (!getAiProviderDefinition(provider).requiresApiKey) {
    return true;
  }
  if (provider === settings.provider && settings.hasApiKey) {
    return true;
  }
  return settings.keyStatusByProvider[provider]?.hasApiKey === true;
}

/**
 * Modely, kterými jde shrnutí přegenerovat — jen od poskytovatelů,
 * které má uživatel nastavené.
 */
export function buildConfiguredAiModelChoices(
  settings: AiSettingsPublic
): ReadonlyArray<AiModelChoice> {
  const choices: Array<AiModelChoice> = [];

  for (const definition of AI_PROVIDER_DEFINITIONS) {
    if (!isAiProviderConfigured(settings, definition.id)) {
      continue;
    }
    for (const model of definition.models) {
      choices.push({
        provider: definition.id,
        model,
        label: formatAiModelDisplayLabel(definition.id, model),
      });
    }
  }

  // Model z Nastavení AI nemusí být ve výčtu (uživatel si ho mohl zapsat sám),
  // bez něj by ho ale nabídka nedokázala předvybrat.
  const hasActiveModel = choices.some(
    choice =>
      choice.provider === settings.provider && choice.model === settings.model
  );
  if (!hasActiveModel && settings.model.length > 0) {
    choices.unshift({
      provider: settings.provider,
      model: settings.model,
      label: formatAiModelDisplayLabel(settings.provider, settings.model),
    });
  }

  return choices;
}

export function formatActiveAiModelLabel(settings: AiSettingsPublic): string {
  return formatAiModelDisplayLabel(settings.provider, settings.model);
}
