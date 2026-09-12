// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  getRecordingBasePath,
  type RecordingMediaKind,
} from './recordingArtifacts.std.ts';
import type { CallRecordingCatalogEntry } from './recordingsCatalog.std.ts';
import type { RecordingTextMatch } from './recordingsSearch.std.ts';
import type { TranscriptionJob } from './transcriptionQueue.std.ts';

export type RecordingListFilter = 'all' | 'active' | 'video' | 'no-transcript';

export const RECORDING_LIST_FILTERS: ReadonlyArray<
  Readonly<{ value: RecordingListFilter; label: string }>
> = [
  { value: 'all', label: 'Vše' },
  { value: 'active', label: 'Zpracovává se' },
  { value: 'video', label: 'Video' },
  { value: 'no-transcript', label: 'Bez přepisu' },
];

/**
 * Jeden řádek seznamu Přepisů. Spojuje uloženou nahrávku z katalogu
 * s právě běžícím jobem — hovor, který se teprve přepisuje, ještě nemusí
 * mít načtenou položku katalogu.
 */
export type RecordingListItem = Readonly<{
  recordingPath: string;
  basePath: string;
  conversationTitle: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  mediaKind: RecordingMediaKind;
  entry: CallRecordingCatalogEntry | null;
  job: TranscriptionJob | null;
  hasTranscript: boolean;
  hasSummary: boolean;
  /** Ve frontě, zpracovává se, nebo skončil chybou — patří na začátek seznamu. */
  isPinned: boolean;
  snippet: string | null;
}>;

function isPinnedJob(job: TranscriptionJob | null): boolean {
  return (
    job != null &&
    (job.status === 'queued' ||
      job.status === 'processing' ||
      job.status === 'failed')
  );
}

function pickJob(
  jobs: ReadonlyArray<TranscriptionJob>,
  recordingPath: string
): TranscriptionJob | null {
  const forRecording = jobs.filter(
    job => job.metadata.filePath === recordingPath
  );
  return (
    forRecording.find(job => job.status === 'processing') ??
    forRecording.find(job => job.status === 'queued') ??
    forRecording.find(job => job.status === 'failed') ??
    forRecording.at(-1) ??
    null
  );
}

function itemFromEntry(
  entry: CallRecordingCatalogEntry,
  job: TranscriptionJob | null,
  snippet: string | null
): RecordingListItem {
  return {
    recordingPath: entry.recordingPath,
    basePath: getRecordingBasePath(entry.recordingPath),
    conversationTitle: entry.conversationTitle,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    durationMs: entry.durationMs,
    mediaKind: entry.mediaKind,
    entry,
    job,
    hasTranscript: entry.hasTranscript,
    hasSummary: entry.hasSummary,
    isPinned: isPinnedJob(job),
    snippet,
  };
}

function itemFromJob(job: TranscriptionJob): RecordingListItem {
  const { metadata } = job;
  return {
    recordingPath: metadata.filePath,
    basePath: getRecordingBasePath(metadata.filePath),
    conversationTitle: metadata.conversationTitle,
    startedAt: metadata.startedAt,
    endedAt: metadata.endedAt,
    durationMs: metadata.durationMs,
    mediaKind: metadata.filePath.toLowerCase().endsWith('.webm')
      ? 'screen-share-video'
      : 'audio',
    entry: null,
    job,
    hasTranscript: Boolean(job.output?.transcriptText?.trim()),
    hasSummary: Boolean(job.output?.summaryText?.trim()),
    isPinned: isPinnedJob(job),
    snippet: null,
  };
}

function matchesFilter(
  item: RecordingListItem,
  filter: RecordingListFilter
): boolean {
  switch (filter) {
    case 'active':
      return item.isPinned;
    case 'video':
      return item.mediaKind === 'screen-share-video';
    case 'no-transcript':
      return !item.hasTranscript;
    default:
      return true;
  }
}

function matchesQuery(item: RecordingListItem, needle: string): boolean {
  if (needle.length === 0) {
    return true;
  }
  return (
    item.conversationTitle.toLowerCase().includes(needle) ||
    item.snippet != null
  );
}

export function buildRecordingListItems(
  options: Readonly<{
    entries: ReadonlyArray<CallRecordingCatalogEntry>;
    jobs: ReadonlyArray<TranscriptionJob>;
    textMatches: ReadonlyArray<RecordingTextMatch>;
    query: string;
    filter: RecordingListFilter;
  }>
): ReadonlyArray<RecordingListItem> {
  const snippets = new Map(
    options.textMatches.map(match => [match.basePath, match.snippet])
  );

  const items = new Map<string, RecordingListItem>();
  for (const entry of options.entries) {
    items.set(
      entry.recordingPath,
      itemFromEntry(
        entry,
        pickJob(options.jobs, entry.recordingPath),
        snippets.get(getRecordingBasePath(entry.recordingPath)) ?? null
      )
    );
  }

  // Job bez katalogové položky = nahrávka, kterou katalog ještě nezná.
  for (const job of options.jobs) {
    if (!items.has(job.metadata.filePath)) {
      items.set(job.metadata.filePath, itemFromJob(job));
    }
  }

  const needle = options.query.trim().toLowerCase();

  return [...items.values()]
    .filter(
      item => matchesFilter(item, options.filter) && matchesQuery(item, needle)
    )
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (a.isPinned && b.isPinned) {
        return (a.job?.createdAt ?? 0) - (b.job?.createdAt ?? 0);
      }
      return b.startedAt - a.startedAt;
    });
}
