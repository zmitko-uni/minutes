// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { getAiProviderDefinition } from './aiSettings.std.ts';

const log = createLogger('minutes/gemini');

type GeminiGenerateResponse = {
  candidates?: ReadonlyArray<{
    content?: { parts?: ReadonlyArray<{ text?: string }> };
  }>;
  error?: { message?: string };
};

type GeminiListModelsResponse = {
  models?: ReadonlyArray<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: ReadonlyArray<string>;
  }>;
  nextPageToken?: string;
  error?: { message?: string };
};

const GEMINI_EXCLUDED_NAME_PARTS = [
  'embedding',
  'imagen',
  'image',
  'tts',
  'aqa',
  'robotics',
  'computer-use',
  'veo',
  'native-audio',
  'live',
] as const;

function stripGeminiModelPrefix(name: string): string {
  return name.replace(/^models\//, '').trim();
}

function isUsableGeminiChatModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (!id.startsWith('gemini-')) {
    return false;
  }
  if (id.includes('preview') && !id.includes('flash') && !id.includes('pro')) {
    return false;
  }
  return !GEMINI_EXCLUDED_NAME_PARTS.some(part => id.includes(part));
}

/**
 * Načte dostupné Gemini modely z API (generateContent).
 * Při chybě / bez klíče vrací kurátorovaný seznam z AI_PROVIDER_DEFINITIONS.
 */
export async function listGeminiModels(options: {
  apiKey?: string | null;
}): Promise<ReadonlyArray<string>> {
  const curated = [...getAiProviderDefinition('google').models];
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    return curated;
  }

  try {
    const discovered = new Set<string>();
    let pageToken: string | undefined;

    do {
      const url = new URL(
        'https://generativelanguage.googleapis.com/v1beta/models'
      );
      url.searchParams.set('key', apiKey);
      url.searchParams.set('pageSize', '100');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url);
      const body = (await response.json()) as GeminiListModelsResponse;
      if (!response.ok) {
        const message =
          body.error?.message ??
          `HTTP ${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      for (const model of body.models ?? []) {
        const methods = model.supportedGenerationMethods ?? [];
        if (!methods.includes('generateContent')) {
          continue;
        }
        const id = stripGeminiModelPrefix(model.name ?? '');
        if (!id || !isUsableGeminiChatModel(id)) {
          continue;
        }
        discovered.add(id);
      }

      pageToken = body.nextPageToken?.trim() || undefined;
    } while (pageToken);

    if (discovered.size === 0) {
      return curated;
    }

    const extras = [...discovered]
      .filter(id => !curated.includes(id))
      .sort((a, b) => a.localeCompare(b));
    return [...curated, ...extras];
  } catch (error) {
    log.warn(
      'listGeminiModels failed; falling back to curated list',
      error instanceof Error ? error.message : error
    );
    return curated;
  }
}

async function callGemini(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  temperature?: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: options.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens,
      },
    }),
  });

  const body = (await response.json()) as GeminiGenerateResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const content = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) {
    throw new Error('Gemini returned an empty summary');
  }

  return content;
}

export async function generateGeminiSummary(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  return callGemini({
    ...options,
    maxOutputTokens: options.maxOutputTokens ?? 2000,
  });
}

export async function testGeminiConnection(options: {
  apiKey: string;
  model: string;
}): Promise<string> {
  return callGemini({
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt: 'Reply briefly.',
    userPrompt: 'Reply with exactly: OK',
    maxOutputTokens: 10,
  });
}
