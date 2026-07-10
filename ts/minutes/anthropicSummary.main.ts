// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

type AnthropicMessageResponse = {
  content?: ReadonlyArray<{ type?: string; text?: string }>;
  error?: { message?: string };
};

async function callAnthropic(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.userPrompt }],
    }),
  });

  const body = (await response.json()) as AnthropicMessageResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const content = body.content
    ?.find(part => part.type === 'text')
    ?.text?.trim();

  if (!content) {
    throw new Error('Claude returned an empty summary');
  }

  return content;
}

export async function generateAnthropicSummary(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  return callAnthropic({ ...options, maxTokens: 2000 });
}

export async function testAnthropicConnection(options: {
  apiKey: string;
  model: string;
}): Promise<string> {
  return callAnthropic({
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt: 'Reply briefly.',
    userPrompt: 'Reply with exactly: OK',
    maxTokens: 10,
  });
}
