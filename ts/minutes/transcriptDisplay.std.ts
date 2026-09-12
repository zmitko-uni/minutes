// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Přepis se na disk ukládá jako `**[čas | Řečník]** text`. Tady se z toho
 * dělá struktura, kterou umí UI obarvit podle řečníka.
 */

export type TranscriptSegment = Readonly<{
  timeRange: string | null;
  speaker: string | null;
  text: string;
}>;

/** Počet barev v paletě řečníků (musí odpovídat SCSS `--speaker-N`). */
export const SPEAKER_COLOR_COUNT = 8;

const SEGMENT_PATTERN = /^\*\*\[([^|\]]*?)\s*\|\s*([^\]]+?)\]\*\*\s*([\s\S]*)$/;
const PLAIN_SPEAKER_PATTERN = /^\[([^\]]+)\]:\s*([\s\S]*)$/;

function toSegment(block: string): TranscriptSegment {
  const aligned = SEGMENT_PATTERN.exec(block);
  if (aligned != null) {
    return {
      timeRange: aligned[1]?.trim() || null,
      speaker: aligned[2]?.trim() ?? null,
      text: aligned[3]?.trim() ?? '',
    };
  }

  const plain = PLAIN_SPEAKER_PATTERN.exec(block);
  if (plain != null) {
    return {
      timeRange: null,
      speaker: plain[1]?.trim() ?? null,
      text: plain[2]?.trim() ?? '',
    };
  }

  return { timeRange: null, speaker: null, text: block.trim() };
}

export function parseTranscriptSegments(
  body: string
): ReadonlyArray<TranscriptSegment> {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(block => block.length > 0)
    .map(toSegment);
}

/**
 * Stejný řečník musí mít stejnou barvu i po znovunačtení, proto se index
 * počítá z jeho jména, ne z pořadí v seznamu.
 */
export function getSpeakerColorIndex(speaker: string): number {
  let hash = 0;
  for (let index = 0; index < speaker.length; index += 1) {
    hash = (hash * 31 + speaker.charCodeAt(index)) % 1_000_003;
  }
  return hash % SPEAKER_COLOR_COUNT;
}

export type TranscriptInlineToken = Readonly<{
  bold: boolean;
  value: string;
}>;

/** V textu segmentu podporujeme jen `**tučně**` — víc Whisper nevrací. */
export function parseTranscriptInline(
  text: string
): ReadonlyArray<TranscriptInlineToken> {
  const tokens: Array<TranscriptInlineToken> = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match != null) {
    if (match.index > lastIndex) {
      tokens.push({ bold: false, value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ bold: true, value: match[1] ?? '' });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    tokens.push({ bold: false, value: text.slice(lastIndex) });
  }

  return tokens;
}

/** Řečníci v pořadí prvního výskytu — pro legendu nad přepisem. */
export function listTranscriptSpeakers(
  segments: ReadonlyArray<TranscriptSegment>
): ReadonlyArray<string> {
  const seen: Array<string> = [];
  for (const segment of segments) {
    if (segment.speaker != null && !seen.includes(segment.speaker)) {
      seen.push(segment.speaker);
    }
  }
  return seen;
}
