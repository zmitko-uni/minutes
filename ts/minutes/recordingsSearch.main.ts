// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { createLogger } from '../logging/log.std.ts';
import type { RecordingTextMatch } from './recordingsSearch.std.ts';
import { SNIPPET_CONTEXT_CHARS } from './recordingsSearch.std.ts';

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
 * Hledá v uložených `.transcript.md` a `.summary.md`. Vrací základ cesty
 * nahrávky (bez přípony), aby si renderer výsledek spároval s katalogem.
 */
export async function searchRecordingTexts(
  recordingsDir: string,
  query: string
): Promise<Array<RecordingTextMatch>> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    return [];
  }

  let fileNames: Array<string>;
  try {
    fileNames = await readdir(recordingsDir);
  } catch (error) {
    log.warn(`nelze číst složku nahrávek: ${String(error)}`);
    return [];
  }

  const matches = new Map<string, RecordingTextMatch>();

  for (const fileName of fileNames) {
    const isTranscript = fileName.endsWith(TRANSCRIPT_SUFFIX);
    const isSummary = fileName.endsWith(SUMMARY_SUFFIX);
    if (!isTranscript && !isSummary) {
      continue;
    }

    // oxlint-disable-next-line no-await-in-loop
    const text = await readCachedText(join(recordingsDir, fileName));
    if (text == null) {
      continue;
    }

    const matchIndex = text.toLowerCase().indexOf(needle);
    if (matchIndex < 0) {
      continue;
    }

    const suffix = isTranscript ? TRANSCRIPT_SUFFIX : SUMMARY_SUFFIX;
    const basePath = join(recordingsDir, fileName.slice(0, -suffix.length));

    // Shrnutí je stručnější, takže z něj bývá užitečnější úryvek.
    if (isSummary || !matches.has(basePath)) {
      matches.set(basePath, {
        basePath,
        snippet: buildSnippet(text, matchIndex),
        source: isTranscript ? 'transcript' : 'summary',
      });
    }
  }

  return [...matches.values()];
}
