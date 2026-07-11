// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

type PerplexityChatResponse = {
  choices?: ReadonlyArray<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

async function callPerplexity(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
}): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
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
      disable_search: true,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
    }),
  });

  const body = (await response.json()) as PerplexityChatResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Perplexity returned an empty summary');
  }

  return content;
}

export async function generatePerplexitySummary(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  return callPerplexity({ ...options, maxTokens: options.maxTokens ?? 2000 });
}

export async function testPerplexityConnection(options: {
  apiKey: string;
  model: string;
}): Promise<string> {
  return callPerplexity({
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt: 'Reply briefly.',
    userPrompt: 'Reply with exactly: OK',
    maxTokens: 32,
  });
}
