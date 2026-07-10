// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { createLogger } from '../logging/log.std.ts';
import { RECORDING_PCM_SIDECAR_SUFFIX } from './whisperSettings.std.ts';
import type {
  CallRecordingCatalogEntry,
  StoredCallRecordingMetadata,
} from './recordingsCatalog.std.ts';
import type { CallRecordingOutput } from './types.std.ts';
import { readCallTranscriptMetadata } from './transcriptMetadata.main.ts';

const log = createLogger('uuminutes/recordingsCatalog');

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isMetadataJsonFile(fileName: string): boolean {
  return fileName.endsWith('.json') && !fileName.endsWith('.speaker-activity.json');
}

function parseLegacyTitleFromMp3(fileName: string): string {
  const withoutExt = fileName.replace(/\.mp3$/i, '');
  const parts = withoutExt.split('_');
  if (parts.length <= 2) {
    return withoutExt;
  }
  return parts.slice(1, -1).join('_') || withoutExt;
}

async function buildCatalogEntry(
  metadata: StoredCallRecordingMetadata,
  mp3Path: string
): Promise<CallRecordingCatalogEntry | null> {
  if (!(await fileExists(mp3Path))) {
    return null;
  }

  const basePath = mp3Path.replace(/\.mp3$/i, '');
  const transcriptPath = `${basePath}.transcript.md`;
  const summaryPath = `${basePath}.summary.md`;
  const hasPcmSidecar = await fileExists(
    `${basePath}${RECORDING_PCM_SIDECAR_SUFFIX}`
  );
  const hasTranscript = await fileExists(transcriptPath);
  const hasSummary = await fileExists(summaryPath);
  const transcriptMeta = hasTranscript
    ? await readCallTranscriptMetadata(basePath)
    : null;

  return {
    conversationId: metadata.conversationId,
    conversationTitle: metadata.conversationTitle,
    startedAt: metadata.startedAt,
    endedAt: metadata.endedAt,
    durationMs: metadata.durationMs,
    mp3Path,
    hasPcmSidecar,
    hasTranscript,
    hasSummary,
    transcriptPath: hasTranscript ? transcriptPath : undefined,
    summaryPath: hasSummary ? summaryPath : undefined,
    transcriptWhisperModelFileName: transcriptMeta?.whisperModelFileName,
    transcriptWhisperModelLabel: transcriptMeta?.whisperModelLabel,
    transcriptGeneratedAt: transcriptMeta?.transcribedAt,
  };
}

export async function listCallRecordings(
  recordingsDir: string
): Promise<Array<CallRecordingCatalogEntry>> {
  let fileNames: Array<string>;
  try {
    fileNames = await readdir(recordingsDir);
  } catch (error) {
    log.warn('listCallRecordings: cannot read directory', error);
    return [];
  }

  const entries = new Map<string, CallRecordingCatalogEntry>();
  const metadataFiles = fileNames.filter(isMetadataJsonFile);

  for (const fileName of metadataFiles) {
    const jsonPath = join(recordingsDir, fileName);
    try {
      const raw = await readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(raw) as StoredCallRecordingMetadata;
      if (
        typeof parsed.conversationId !== 'string' ||
        typeof parsed.conversationTitle !== 'string' ||
        typeof parsed.audioFile !== 'string' ||
        typeof parsed.startedAt !== 'number' ||
        typeof parsed.endedAt !== 'number'
      ) {
        continue;
      }

      const mp3Path = join(recordingsDir, parsed.audioFile);
      const entry = await buildCatalogEntry(parsed, mp3Path);
      if (entry) {
        entries.set(entry.mp3Path, entry);
      }
    } catch (error) {
      log.warn(`listCallRecordings: skip ${fileName}`, error);
    }
  }

  for (const fileName of fileNames) {
    if (!fileName.toLowerCase().endsWith('.mp3')) {
      continue;
    }

    const mp3Path = join(recordingsDir, fileName);
    if (entries.has(mp3Path)) {
      continue;
    }

    const basePath = mp3Path.replace(/\.mp3$/i, '');
    const transcriptPath = `${basePath}.transcript.md`;
    const summaryPath = `${basePath}.summary.md`;
    const hasPcmSidecar = await fileExists(
      `${basePath}${RECORDING_PCM_SIDECAR_SUFFIX}`
    );
    const hasTranscript = await fileExists(transcriptPath);
    const hasSummary = await fileExists(summaryPath);
    const transcriptMeta = hasTranscript
      ? await readCallTranscriptMetadata(basePath)
      : null;
    let startedAt = Date.now();
    let durationMs = 0;
    try {
      const mp3Stat = await stat(mp3Path);
      startedAt = mp3Stat.mtimeMs;
      durationMs = 0;
    } catch {
      continue;
    }

    entries.set(mp3Path, {
      conversationId: fileName.slice(0, 8),
      conversationTitle: parseLegacyTitleFromMp3(fileName),
      startedAt,
      endedAt: startedAt,
      durationMs,
      mp3Path,
      hasPcmSidecar,
      hasTranscript,
      hasSummary,
      transcriptPath: hasTranscript ? transcriptPath : undefined,
      summaryPath: hasSummary ? summaryPath : undefined,
      transcriptWhisperModelFileName: transcriptMeta?.whisperModelFileName,
      transcriptWhisperModelLabel: transcriptMeta?.whisperModelLabel,
      transcriptGeneratedAt: transcriptMeta?.transcribedAt,
    });
  }

  return [...entries.values()].sort((a, b) => b.startedAt - a.startedAt);
}

function extractTranscriptBodyFromMarkdown(markdown: string): string {
  const marker = '## Přepis';
  const index = markdown.indexOf(marker);
  if (index >= 0) {
    return markdown.slice(index + marker.length).trim();
  }
  return markdown.trim();
}

export async function loadCallRecordingOutput(
  entry: Pick<
    CallRecordingCatalogEntry,
    | 'mp3Path'
    | 'conversationId'
    | 'conversationTitle'
    | 'hasTranscript'
    | 'hasSummary'
    | 'transcriptPath'
    | 'summaryPath'
  >
): Promise<CallRecordingOutput | null> {
  const basePath = entry.mp3Path.replace(/\.mp3$/i, '');
  const transcriptPath =
    entry.transcriptPath ?? `${basePath}.transcript.md`;
  const summaryPath = entry.summaryPath ?? `${basePath}.summary.md`;

  let transcriptText = '';
  if (entry.hasTranscript) {
    try {
      transcriptText = extractTranscriptBodyFromMarkdown(
        await readFile(transcriptPath, 'utf8')
      );
    } catch {
      return null;
    }
  }

  let summaryText: string | undefined;
  if (entry.hasSummary) {
    try {
      summaryText = (await readFile(summaryPath, 'utf8')).trim();
    } catch {
      summaryText = undefined;
    }
  }

  if (!entry.hasTranscript && !summaryText) {
    return null;
  }

  return {
    conversationId: entry.conversationId,
    conversationTitle: entry.conversationTitle,
    transcriptPath,
    transcriptText,
    summaryPath: entry.hasSummary ? summaryPath : undefined,
    summaryText,
  };
}
