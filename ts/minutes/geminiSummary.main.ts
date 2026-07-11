// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

type GeminiGenerateResponse = {
  candidates?: ReadonlyArray<{
    content?: { parts?: ReadonlyArray<{ text?: string }> };
  }>;
  error?: { message?: string };
};

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
