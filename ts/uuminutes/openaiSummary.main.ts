// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';

const log = createLogger('uuminutes/openai');

const MAX_TRANSCRIPT_CHARS = 80_000;

type OpenAiChatResponse = {
  choices?: ReadonlyArray<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

export async function generateOpenAiSummary(options: {
  apiKey: string;
  model: string;
  outputLanguage: string;
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
}): Promise<string> {
  const transcript = options.transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  if (transcript.length < options.transcript.length) {
    log.warn(
      `transcript truncated from ${options.transcript.length} to ${MAX_TRANSCRIPT_CHARS} chars`
    );
  }

  const systemPrompt = [
    'You summarize chat conversations from Signal for the user.',
    `Write the summary in ${options.outputLanguage}.`,
    'Use markdown with these sections when relevant:',
    '## Shrnutí',
    '## Rozhodnutí a úkoly',
    '## Otevřené body',
    'Be concise, keep participant names, do not invent facts not present in the transcript.',
  ].join('\n');

  const userPrompt = [
    `Chat: ${options.conversationTitle}`,
    `Scope: ${options.scopeLabel}`,
    '',
    '---',
    '',
    transcript,
  ].join('\n');

  return generateOpenAiChatCompletion({
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2000,
  });
}

export async function generateOpenAiChatCompletion(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2000,
    }),
  });

  const body = (await response.json()) as OpenAiChatResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return content;
}

export async function testOpenAiConnection(options: {
  apiKey: string;
  model: string;
}): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
    }),
  });

  const body = (await response.json()) as OpenAiChatResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return body.choices?.[0]?.message?.content?.trim() ?? 'OK';
}
