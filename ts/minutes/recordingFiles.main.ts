// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile, rm, writeFile } from 'node:fs/promises';

import { app } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { isPathInside } from '../util/isPathInside.node.ts';
import { getRecordingArtifactPaths } from './recordingArtifacts.std.ts';
import {
  isRecordingMeetingLink,
  type RecordingMeetingLink,
} from './recordingMeeting.std.ts';
import { getPrivateRecordingPcmPath } from './recordingPcmStorage.node.ts';
import { getMp4ExportPath } from './videoMp4Export.node.ts';

const log = createLogger('minutes/recordingFiles');

function getMeetingLinkPath(recordingPath: string): string {
  return `${getRecordingArtifactPaths(recordingPath).basePath}.meeting.json`;
}

/** Nahrávka musí ležet ve složce nahrávek — jinak nic nemažeme ani nepřepisujeme. */
function assertInsideRecordings(recordingPath: string, dir: string): void {
  if (!isPathInside(recordingPath, dir)) {
    throw new Error('Nahrávka neleží ve složce nahrávek.');
  }
}

/**
 * Smaže nahrávku i všechno, co k ní patří — metadata, PCM, přepis, shrnutí,
 * MP4 a vazbu na schůzku. Chybějící soubory se ignorují.
 */
export async function deleteCallRecording(
  recordingsDir: string,
  recordingPath: string
): Promise<void> {
  assertInsideRecordings(recordingPath, recordingsDir);

  const artifacts = getRecordingArtifactPaths(recordingPath);
  const targets = [
    recordingPath,
    `${artifacts.basePath}.json`,
    artifacts.pcmPath,
    artifacts.speakerActivityPath,
    artifacts.transcriptPath,
    artifacts.whisperTranscriptPath,
    artifacts.transcriptMetadataPath,
    artifacts.summaryPath,
    getMeetingLinkPath(recordingPath),
    getMp4ExportPath(recordingPath),
    getPrivateRecordingPcmPath(app.getPath('userData'), recordingPath),
  ];

  for (const target of targets) {
    try {
      await rm(target, { force: true });
    } catch (error) {
      log.warn('nepodařilo se smazat soubor nahrávky', error);
    }
  }

  log.info('nahrávka a její soubory smazány');
}

/** Uloží ručně upravené shrnutí zpět do `<nahrávka>.summary.md`. */
export async function saveRecordingSummary(
  recordingsDir: string,
  recordingPath: string,
  summaryMarkdown: string
): Promise<{ summaryPath: string }> {
  assertInsideRecordings(recordingPath, recordingsDir);

  const { summaryPath } = getRecordingArtifactPaths(recordingPath);
  await writeFile(summaryPath, `${summaryMarkdown.trim()}\n`, 'utf8');
  return { summaryPath };
}

export async function readRecordingMeeting(
  recordingPath: string
): Promise<RecordingMeetingLink | null> {
  try {
    const raw = await readFile(getMeetingLinkPath(recordingPath), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return isRecordingMeetingLink(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeRecordingMeeting(
  recordingsDir: string,
  recordingPath: string,
  link: RecordingMeetingLink
): Promise<RecordingMeetingLink> {
  assertInsideRecordings(recordingPath, recordingsDir);

  await writeFile(
    getMeetingLinkPath(recordingPath),
    `${JSON.stringify(link, null, 2)}\n`,
    'utf8'
  );
  return link;
}
