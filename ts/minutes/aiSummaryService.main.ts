// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  getAiOutputLanguageLabel,
  isCzechAiOutputLanguage,
  type AiProvider,
} from './aiSettings.std.ts';
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

const MAX_TRANSCRIPT_CHARS = 80_000;

function buildUnreadConversationPrompts(options: {
  outputLanguage: string;
  conversationTitle: string;
  unreadCount: number;
  transcript: string;
}): { systemPrompt: string; userPrompt: string } {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  if (isCzechAiOutputLanguage(options.outputLanguage)) {
    const systemPrompt = [
      'Shrnuješ nepřečtené zprávy z jedné konverzace Signal pro IT pracovníka.',
      'Celá odpověď musí být výhradně v češtině.',
      'Pokud jde jen o neformální small talk bez pracovní relevance (počasí, pozdravy, emoji, meme, off-topic mimo práci), odpověz přesně jedním slovem: SKIP',
      'Jinak urči typ konverzace: neformální, běžná, důležitá nebo kritická.',
      'Neformální = lehká pracovní komunikace; běžná = standardní koordinace; důležitá = rozhodnutí, termíny, blokery; kritická = výpadek, incident, urgentní eskalace.',
      'Zákaz: nepiš úvodní věty typu „Rozumím“, „Shrnutí“, „Zde je“ ani název chatu — ten doplní aplikace.',
      'Odpověz POUZE tímto přesným formátem (nic navíc):',
      'TÉMA: {jedna věta hlavního tématu}',
      '- {co se řeší / důležitý bod}',
      '- {další bod}',
      'TYP: {neformální|běžná|důležitá|kritická}',
      'Max 4 odrážky. Buď stručný, nevymýšlej fakta mimo přepis.',
    ].join('\n');

    const userPrompt = [
      `Chat: ${options.conversationTitle}`,
      `Nepřečtených zpráv: ${options.unreadCount}`,
      '',
      '---',
      '',
      transcript,
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
  const systemPrompt = [
    'You summarize unread messages from one Signal conversation for an IT professional.',
    `Write the entire response only in ${languageLabel}.`,
    'If the messages are trivial small talk with no work relevance (weather, greetings only, memes), reply with exactly: SKIP',
    'Otherwise classify the conversation: informal, normal, important, or critical.',
    'Do NOT write intro phrases or the chat title — the app adds the title.',
    'Reply ONLY in this exact format:',
    'TÉMA: {one sentence main topic}',
    '- {bullet}',
    '- {bullet}',
    'TYP: {informal|normal|important|critical}',
    'Max 4 bullets. Be concise; do not invent facts.',
  ].join('\n');

  const userPrompt = [
    `Chat: ${options.conversationTitle}`,
    `Unread messages: ${options.unreadCount}`,
    '',
    '---',
    '',
    transcript,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

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

  return generateAiTextForProvider({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 900,
  });
}

function buildSummaryPrompts(options: {
  outputLanguage: string;
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
}): { systemPrompt: string; userPrompt: string } {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  if (isCzechAiOutputLanguage(options.outputLanguage)) {
    const systemPrompt = [
      'Shrnuješ konverzace ze Signalu pro uživatele.',
      'Celé shrnutí piš výhradně v češtině. Nepoužívej angličtinu ani jiný jazyk.',
      'Použij markdown s těmito sekcemi, pokud jsou relevantní:',
      '## Shrnutí',
      '## Rozhodnutí a úkoly',
      '## Otevřené body',
      'Buď stručný, zachovej jména účastníků, nevymýšlej fakta, která v přepisu nejsou.',
      'Když jsou řádky ve tvaru [Jméno mluvčího]:, přiřaď rozhodnutí a úkoly těmto lidem.',
    ].join('\n');

    const userPrompt = [
      `Chat: ${options.conversationTitle}`,
      `Rozsah: ${options.scopeLabel}`,
      '',
      '---',
      '',
      transcript,
      '',
      'Napiš shrnutí výhradně v češtině.',
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  const languageLabel = getAiOutputLanguageLabel(options.outputLanguage);
  const systemPrompt = [
    'You summarize chat conversations from Signal for the user.',
    `IMPORTANT: Write the ENTIRE summary only in ${languageLabel}. Never use any other language.`,
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
    '',
    `Remember: write the summary exclusively in ${languageLabel}.`,
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
    case 'local':
      return generateLocalLlmSummary({
        modelFileName: options.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
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
    case 'local':
      return testLocalLlmConnection({ modelFileName: options.model });
    case 'openai':
    default:
      return testOpenAiConnection(options);
  }
}
