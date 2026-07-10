// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { BodyRange, type DraftBodyRanges } from '../types/BodyRange.std.ts';

/** Instrukce pro AI — výstup jako běžná Signal zpráva, ne markdown. */
export const SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_CS = [
  'Piš prostý text vhodný pro odeslání jako zpráva v Signalu — nepoužívej markdown.',
  'Nadpisy sekcí dej na samostatný řádek a zakonči dvojtečkou, např.:',
  'Shrnutí:',
  'Rozhodnutí a úkoly:',
  'Otevřené body:',
  'Odrážky začínej pomlčkou a mezerou (- ).',
  'Zákaz: **, ##, __, --- a jiná markdown syntaxe.',
].join('\n');

export const SIGNAL_AI_SUMMARY_FORMAT_INSTRUCTIONS_EN = [
  'Write plain text suitable for a Signal chat message — do not use markdown.',
  'Section titles on their own line ending with a colon, e.g.:',
  'Summary:',
  'Decisions and action items:',
  'Open items:',
  'Use bullet lines starting with "- ".',
  'Do not use **, ##, __, ---, or other markdown syntax.',
].join('\n');

export type SignalChatMessage = Readonly<{
  body: string;
  bodyRanges?: DraftBodyRanges;
}>;

function pushBoldRange(
  ranges: Array<BodyRange<BodyRange.Formatting>>,
  start: number,
  length: number
): void {
  if (length <= 0) {
    return;
  }
  ranges.push({
    start,
    length,
    style: BodyRange.Style.BOLD,
  });
}

/**
 * Converts markdown-ish AI/export text to Signal message body + optional bold ranges.
 */
export function formatMarkdownForSignalMessage(source: string): SignalChatMessage {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { body: '' };
  }

  const withoutHeadings = normalized
    .replace(/^#{1,6}\s+(.+)$/gm, (_, title: string) => `${title.trim()}:`)
    .replace(/^---+$/gm, '\n');

  const boldRanges: Array<BodyRange<BodyRange.Formatting>> = [];
  let body = '';
  let index = 0;

  while (index < withoutHeadings.length) {
    if (
      withoutHeadings[index] === '*' &&
      withoutHeadings[index + 1] === '*'
    ) {
      const close = withoutHeadings.indexOf('**', index + 2);
      if (close !== -1) {
        const content = withoutHeadings.slice(index + 2, close);
        const start = body.length;
        body += content;
        pushBoldRange(boldRanges, start, content.length);
        index = close + 2;
        continue;
      }
    }

    if (
      withoutHeadings[index] === '_' &&
      withoutHeadings[index + 1] === '_'
    ) {
      const close = withoutHeadings.indexOf('__', index + 2);
      if (close !== -1) {
        const content = withoutHeadings.slice(index + 2, close);
        const start = body.length;
        body += content;
        pushBoldRange(boldRanges, start, content.length);
        index = close + 2;
        continue;
      }
    }

    body += withoutHeadings[index];
    index += 1;
  }

  const cleaned = body
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (boldRanges.length === 0) {
    return { body: cleaned };
  }

  return { body: cleaned, bodyRanges: boldRanges };
}
