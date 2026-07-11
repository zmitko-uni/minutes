// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AiProvider } from './aiSettings.std.ts';
import { generateAnthropicSummary, testAnthropicConnection } from './anthropicSummary.main.ts';
import { generateGeminiSummary, testGeminiConnection } from './geminiSummary.main.ts';
import {
  generateLocalLlmSummary,
  testLocalLlmConnection,
} from './localLlmExtension.main.ts';
import {
  generateOpenAiChatCompletion,
  testOpenAiConnection,
} from './openaiSummary.main.ts';
import {
  generatePerplexitySummary,
  testPerplexityConnection,
} from './perplexitySummary.main.ts';
import {
  AI_OPINION_MAX_TOKENS,
  buildAiOpinionPrompts,
} from './aiOpinionPrompts.std.ts';
import {
  AI_CHAT_SUMMARY_MAX_TOKENS,
  buildChatSummaryPrompts,
  buildUnreadConversationPrompts,
  sanitizeAiChatSummary,
} from './aiSummaryPrompts.std.ts';

export async function generateUnreadConversationSummaryForProvider(options: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  outputLanguage: string;
  conversationTitle: string;
  unreadCount: number;
  transcript: string;
}): Promise<string> {
  const { systemPrompt, userPrompt } = buildUnreadConversationPrompts(options);

  const raw = await generateAiTextForProvider({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 900,
  });

  return raw.trim() === 'SKIP' ? raw.trim() : sanitizeAiChatSummary(raw);
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
      : buildChatSummaryPrompts(options);

  const raw = await generateAiTextForProvider({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: AI_CHAT_SUMMARY_MAX_TOKENS,
  });

  return sanitizeAiChatSummary(raw);
}

export async function generateAiOpinionForProvider(options: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  outputLanguage: string;
  conversationTitle: string;
  messageAuthorLabel: string;
  messageText: string;
  isNoteToSelf: boolean;
}): Promise<string> {
  const { systemPrompt, userPrompt } = buildAiOpinionPrompts({
    outputLanguage: options.outputLanguage,
    conversationTitle: options.conversationTitle,
    messageAuthorLabel: options.messageAuthorLabel,
    messageText: options.messageText,
    isNoteToSelf: options.isNoteToSelf,
  });

  return generateAiTextForProvider({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.35,
    maxTokens: AI_OPINION_MAX_TOKENS,
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
  const maxTokens = options.maxTokens ?? 2000;
  const temperature = options.temperature ?? 0.2;

  switch (options.provider) {
    case 'google':
      return generateGeminiSummary({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        maxOutputTokens: maxTokens,
        temperature,
      });
    case 'anthropic':
      return generateAnthropicSummary({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        maxTokens,
        temperature,
      });
    case 'perplexity':
      return generatePerplexitySummary({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        maxTokens,
        temperature,
      });
    case 'local':
      return generateLocalLlmSummary({
        modelFileName: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        maxTokens,
        temperature,
      });
    case 'openai':
    default:
      return generateOpenAiChatCompletion({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        temperature,
        maxTokens,
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
    case 'local':
      return testLocalLlmConnection({ modelFileName: options.model });
    case 'openai':
    default:
      return testOpenAiConnection(options);
  }
}
