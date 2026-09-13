// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { createLogger } from '../logging/log.std.ts';
import {
  extractTranscriptBody,
  parseTranscriptInline,
  parseTranscriptSegments,
} from './transcriptDisplay.std.ts';
import type {
  RecordingTextHit,
  RecordingTextMatch,
} from './recordingsSearch.std.ts';
import {
  MAX_HITS_PER_RECORDING,
  MIN_SEARCH_QUERY_LENGTH,
  SNIPPET_CONTEXT_CHARS,
} from './recordingsSearch.std.ts';

const log = createLogger('minutes/recordingsSearch');

const TRANSCRIPT_SUFFIX = '.transcript.md';
const SUMMARY_SUFFIX = '.summary.md';

/** Přepisy se nemění, dokud neproběhne nový job — stačí cache podle mtime. */
const textCache = new Map<
  string,
  Readonly<{ mtimeMs: number; text: string }>
>();

async function readCachedText(path: string): Promise<string | null> {
  try {
    const { mtimeMs } = await stat(path);
    const cached = textCache.get(path);
    if (cached != null && cached.mtimeMs === mtimeMs) {
      return cached.text;
    }
    const text = await readFile(path, 'utf8');
    textCache.set(path, { mtimeMs, text });
    return text;
  } catch (error) {
    log.warn(`nelze načíst ${path}: ${String(error)}`);
    return null;
  }
}

function buildSnippet(text: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(text.length, matchIndex + SNIPPET_CONTEXT_CHARS);
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}

/**
 * Přepis se v UI vykresluje jen jako samotné repliky — bez hlavičky souboru,
 * bez značky řečníka a bez `**` okolo tučného textu. Hledáme proto ve stejně
 * složeném textu, aby n-tý nález hledání ukazoval na n-té zvýraznění v detailu.
 */
function toSearchableText(fileText: string, isTranscript: boolean): string {
  if (!isTranscript) {
    return fileText;
  }
  return parseTranscriptSegments(extractTranscriptBody(fileText))
    .map(segment =>
      parseTranscriptInline(segment.text)
        .map(token => token.value)
        .join('')
    )
    .join('\n\n');
}

function collectHits(
  text: string,
  needle: string,
  source: RecordingTextHit['source']
): Array<RecordingTextHit> {
  const lower = text.toLowerCase();
  const hits: Array<RecordingTextHit> = [];
  let found = lower.indexOf(needle);

  while (found >= 0 && hits.length < MAX_HITS_PER_RECORDING) {
    hits.push({
      source,
      index: hits.length,
      snippet: buildSnippet(text, found),
    });
    found = lower.indexOf(needle, found + needle.length);
  }

  return hits;
}

/**
 * Hledá v uložených `.transcript.md` a `.summary.md`. Vrací základ cesty
 * nahrávky (bez přípony), aby si renderer výsledek spároval s katalogem.
 */
export async function searchRecordingTexts(
  recordingsDir: string,
  query: string
): Promise<Array<RecordingTextMatch>> {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_SEARCH_QUERY_LENGTH) {
    return [];
  }

  let fileNames: Array<string>;
  try {
    fileNames = await readdir(recordingsDir);
  } catch (error) {
    log.warn(`nelze číst složku nahrávek: ${String(error)}`);
    return [];
  }

  // Shrnutí je stručnější, takže jeho nálezy nabízíme jako první.
  const summaryHits = new Map<string, Array<RecordingTextHit>>();
  const transcriptHits = new Map<string, Array<RecordingTextHit>>();

  for (const fileName of fileNames) {
    const isTranscript = fileName.endsWith(TRANSCRIPT_SUFFIX);
    const isSummary = fileName.endsWith(SUMMARY_SUFFIX);
    if (!isTranscript && !isSummary) {
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop
    const fileText = await readCachedText(join(recordingsDir, fileName));
    if (fileText == null) {
      continue;
    }

    const hits = collectHits(
      toSearchableText(fileText, isTranscript),
      needle,
      isTranscript ? 'transcript' : 'summary'
    );
    if (hits.length === 0) {
      continue;
    }

    const suffix = isTranscript ? TRANSCRIPT_SUFFIX : SUMMARY_SUFFIX;
    const basePath = join(recordingsDir, fileName.slice(0, -suffix.length));
    (isTranscript ? transcriptHits : summaryHits).set(basePath, hits);
  }

  const basePaths = new Set([...summaryHits.keys(), ...transcriptHits.keys()]);

  return [...basePaths].map(basePath => ({
    basePath,
    hits: [
      ...(summaryHits.get(basePath) ?? []),
      ...(transcriptHits.get(basePath) ?? []),
    ].slice(0, MAX_HITS_PER_RECORDING),
  }));
}
