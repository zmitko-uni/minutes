// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AiProvider } from './aiSettings.std.ts';
import { generateAiTextForProvider } from './aiSummaryService.main.ts';
import type { AlignedTranscriptSegment } from './speakerActivity.std.ts';

const MAX_TRANSCRIPT_CHARS = 80_000;

function buildCorrectionPrompts(options: {
  outputLanguage: string;
  rawTranscript: string;
}): { systemPrompt: string; userPrompt: string } {
  const transcript = options.rawTranscript.slice(0, MAX_TRANSCRIPT_CHARS);
  const systemPrompt = [
    'You are a Czech speech-to-text proofreader. This is NOT a summarization task.',
    `Output language: ${options.outputLanguage}.`,
    '',
    'Your ONLY job:',
    '- Fix misheard words, typos, and grammar in the raw ASR transcript.',
    '- Preserve the original meaning, facts, names, and sentence order.',
    '- Keep every speaker label, timestamp, and line structure exactly as in the input.',
    '',
    'FORBIDDEN:',
    '- Do NOT summarize, shorten, or rewrite beyond minimal corrections.',
    '- Do NOT add sections like "## Shrnutí", "## Rozhodnutí a úkoly", or "## Otevřené body".',
    '- Do NOT add commentary, bullet lists of tasks, or new sentences.',
    '- Do NOT invent names or facts not present in the raw transcript.',
    '',
    'When phonetically close, prefer common Czech phrases',
    '(e.g. "Jak se máš? Co jsi dělala?" instead of nonsense like "Kamile co sdělala").',
    '',
    'Return ONLY the corrected transcript text — same format as input.',
  ].join('\n');

  const userPrompt = [
    'Oprav pouze chyby rozpoznání řeči. Vrať celý přepis ve stejném formátu:',
    '',
    transcript,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

function parseCorrectedSegments(
  corrected: string,
  original: ReadonlyArray<AlignedTranscriptSegment>
): Array<AlignedTranscriptSegment> {
  if (original.length === 0) {
    return [];
  }

  const lines = corrected
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const parsedBlocks: Array<{ label: string; text: string }> = [];
  let current: { label: string; text: string } | null = null;

  for (const line of lines) {
    const segmentMatch = line.match(
      /^\*\*\[(.+?) – (.+?) \| (.+?)\]\*\*\s*(.*)$/
    );
    if (segmentMatch) {
      if (current) {
        parsedBlocks.push(current);
      }
      current = {
        label: segmentMatch[3] ?? '',
        text: segmentMatch[4]?.trim() ?? '',
      };
      continue;
    }
    const headerMatch = line.match(/^\*\*\[(.+?)\]\*\*$/);
    const inlineMatch = line.match(/^\*\*\[(.+?)\]\*\*\s*(.+)$/);
    if (headerMatch) {
      if (current) {
        parsedBlocks.push(current);
      }
      current = { label: headerMatch[1] ?? '', text: '' };
      continue;
    }
    if (inlineMatch) {
      if (current) {
        parsedBlocks.push(current);
      }
      current = {
        label: inlineMatch[1] ?? '',
        text: inlineMatch[2]?.trim() ?? '',
      };
      continue;
    }
    if (current) {
      current.text = current.text.length > 0 ? `${current.text}\n${line}` : line;
    }
  }
  if (current) {
    parsedBlocks.push(current);
  }

  if (parsedBlocks.length === 0) {
    return original.map(segment => ({ ...segment, text: corrected.trim() }));
  }

  return original.map((segment, index) => {
    const block =
      parsedBlocks[index] ??
      parsedBlocks.find(item => item.label === segment.speakerLabel);
    if (!block) {
      return segment;
    }
    return {
      ...segment,
      text: block.text.trim() || segment.text,
    };
  });
}

function looksLikeSummaryOutput(text: string): boolean {
  return /##\s*(Shrnutí|Rozhodnutí|Otevřené|Summary|Decisions|Action)/i.test(
    text
  );
}

export async function correctTranscriptWithAi(options: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  outputLanguage: string;
  conversationTitle: string;
  rawTranscript: string;
  alignedSegments?: ReadonlyArray<AlignedTranscriptSegment>;
}): Promise<{
  text: string;
  alignedSegments: Array<AlignedTranscriptSegment>;
}> {
  const { systemPrompt, userPrompt } = buildCorrectionPrompts({
    outputLanguage: options.outputLanguage,
    rawTranscript: options.rawTranscript,
  });

  const corrected = await generateAiTextForProvider({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    systemPrompt,
    userPrompt,
    temperature: 0.05,
    maxTokens: 16_000,
  });

  const trimmed = corrected.trim();
  if (trimmed.length === 0 || looksLikeSummaryOutput(trimmed)) {
    return {
      text: options.rawTranscript,
      alignedSegments: [...(options.alignedSegments ?? [])],
    };
  }

  const alignedSegments =
    options.alignedSegments && options.alignedSegments.length > 0
      ? parseCorrectedSegments(trimmed, options.alignedSegments)
      : [];

  return {
    text: trimmed,
    alignedSegments,
  };
}
