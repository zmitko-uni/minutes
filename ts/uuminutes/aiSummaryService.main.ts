// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AiProvider } from './aiSettings.std.ts';
import { generateAnthropicSummary, testAnthropicConnection } from './anthropicSummary.main.ts';
import { generateGeminiSummary, testGeminiConnection } from './geminiSummary.main.ts';
import {
  generateOpenAiChatCompletion,
  testOpenAiConnection,
} from './openaiSummary.main.ts';
import {
  generatePerplexitySummary,
  testPerplexityConnection,
} from './perplexitySummary.main.ts';

const MAX_TRANSCRIPT_CHARS = 80_000;

function buildSummaryPrompts(options: {
  outputLanguage: string;
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
}): { systemPrompt: string; userPrompt: string } {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  const systemPrompt = [
    'You summarize chat conversations from Signal for the user.',
    `Write the summary in ${options.outputLanguage}.`,
    'Use markdown with these sections when relevant:',
    '## Shrnutí',
    '## Rozhodnutí a úkoly',
    '## Otevřené body',
    'Be concise, keep participant names, do not invent facts not present in the transcript.',
    'When lines are prefixed with [Speaker Name]:, attribute decisions and action items to those speakers.',
  ].join('\n');

  const userPrompt = [
    `Chat: ${options.conversationTitle}`,
    `Scope: ${options.scopeLabel}`,
    '',
    '---',
    '',
    transcript,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

export async function generateAiSummaryForProvider(options: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  outputLanguage: string;
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
  systemPromptOverride?: string;
  userPromptOverride?: string;
}): Promise<string> {
  const { systemPrompt, userPrompt } =
    options.systemPromptOverride && options.userPromptOverride
      ? {
          systemPrompt: options.systemPromptOverride,
          userPrompt: options.userPromptOverride,
        }
      : buildSummaryPrompts(options);

  return generateAiTextForProvider({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2000,
  });
}

export async function generateAiTextForProvider(options: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  switch (options.provider) {
    case 'google':
      return generateGeminiSummary({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
      });
    case 'anthropic':
      return generateAnthropicSummary({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
      });
    case 'perplexity':
      return generatePerplexitySummary({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
      });
    case 'openai':
    default:
      return generateOpenAiChatCompletion({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        temperature: options.temperature ?? 0.2,
        maxTokens: options.maxTokens ?? 2000,
      });
  }
}

export async function testAiConnectionForProvider(options: {
  provider: AiProvider;
  apiKey: string;
  model: string;
}): Promise<string> {
  switch (options.provider) {
    case 'google':
      return testGeminiConnection(options);
    case 'anthropic':
      return testAnthropicConnection(options);
    case 'perplexity':
      return testPerplexityConnection(options);
    case 'openai':
    default:
      return testOpenAiConnection(options);
  }
}
